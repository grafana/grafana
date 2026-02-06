package pgproto3

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"io"
)

// Backend acts as a server for the PostgreSQL wire protocol version 3.
type Backend struct {
	cr *chunkReader
	w  io.Writer

	// tracer is used to trace messages when Send or Receive is called. This means an outbound message is traced
	// before it is actually transmitted (i.e. before Flush).
	tracer *tracer

	wbuf        []byte
	encodeError error

	// Frontend message flyweights
	bind           Bind
	cancelRequest  CancelRequest
	_close         Close
	copyFail       CopyFail
	copyData       CopyData
	copyDone       CopyDone
	describe       Describe
	execute        Execute
	flush          Flush
	functionCall   FunctionCall
	gssEncRequest  GSSEncRequest
	parse          Parse
	query          Query
	sslRequest     SSLRequest
	startupMessage StartupMessage
	sync           Sync
	terminate      Terminate

	bodyLen    int
	maxBodyLen int // maxBodyLen is the maximum length of a message body in octets. If a message body exceeds this length, Receive will return an error.
	msgType    byte
	partialMsg bool
	authType   uint32
}

const (
	minStartupPacketLen = 4     // minStartupPacketLen is a single 32-bit int version or code.
	maxStartupPacketLen = 10000 // maxStartupPacketLen is MAX_STARTUP_PACKET_LENGTH from PG source.
)

// NewBackend creates a new Backend.
func NewBackend(r io.Reader, w io.Writer) *Backend {
	cr := newChunkReader(r, 0)
	return &Backend{cr: cr, w: w}
}

// Send sends a message to the frontend (i.e. the client). The message is buffered until Flush is called. Any error
// encountered will be returned from Flush.
func (b *Backend) Send(msg BackendMessage) {
	if b.encodeError != nil {
		return
	}

	prevLen := len(b.wbuf)
	newBuf, err := msg.Encode(b.wbuf)
	if err != nil {
		b.encodeError = err
		return
	}
	b.wbuf = newBuf

	if b.tracer != nil {
		b.tracer.traceMessage('B', int32(len(b.wbuf)-prevLen), msg)
	}
}

// Flush writes any pending messages to the frontend (i.e. the client).
func (b *Backend) Flush() error {
	if err := b.encodeError; err != nil {
		b.encodeError = nil
		b.wbuf = b.wbuf[:0]
		return &writeError{err: err, safeToRetry: true}
	}

	n, err := b.w.Write(b.wbuf)

	const maxLen = 1024
	if len(b.wbuf) > maxLen {
		b.wbuf = make([]byte, 0, maxLen)
	} else {
		b.wbuf = b.wbuf[:0]
	}

	if err != nil {
		return &writeError{err: err, safeToRetry: n == 0}
	}

	return nil
}

// Trace starts tracing the message traffic to w. It writes in a similar format to that produced by the libpq function
// PQtrace.
func (b *Backend) Trace(w io.Writer, options TracerOptions) {
	b.tracer = &tracer{
		w:             w,
		buf:           &bytes.Buffer{},
		TracerOptions: options,
	}
}

// Untrace stops tracing.
func (b *Backend) Untrace() {
	b.tracer = nil
}

// ReceiveStartupMessage receives the initial connection message. This method is used of the normal Receive method
// because the initial connection message is "special" and does not include the message type as the first byte. This
// will return either a StartupMessage, SSLRequest, GSSEncRequest, or CancelRequest.
func (b *Backend) ReceiveStartupMessage() (FrontendMessage, error) {
	buf, err := b.cr.Next(4)
	if err != nil {
		return nil, err
	}
	msgSize := int(binary.BigEndian.Uint32(buf) - 4)

	if msgSize < minStartupPacketLen || msgSize > maxStartupPacketLen {
		return nil, fmt.Errorf("invalid length of startup packet: %d", msgSize)
	}

	buf, err = b.cr.Next(msgSize)
	if err != nil {
		return nil, translateEOFtoErrUnexpectedEOF(err)
	}

	code := binary.BigEndian.Uint32(buf)

	switch code {
	case ProtocolVersionNumber:
		err = b.startupMessage.Decode(buf)
		if err != nil {
			return nil, err
		}
		return &b.startupMessage, nil
	case sslRequestNumber:
		err = b.sslRequest.Decode(buf)
		if err != nil {
			return nil, err
		}
		return &b.sslRequest, nil
	case cancelRequestCode:
		err = b.cancelRequest.Decode(buf)
		if err != nil {
			return nil, err
		}
		return &b.cancelRequest, nil
	case gssEncReqNumber:
		err = b.gssEncRequest.Decode(buf)
		if err != nil {
			return nil, err
		}
		return &b.gssEncRequest, nil
	default:
		return nil, fmt.Errorf("unknown startup message code: %d", code)
	}
}

// Receive receives a message from the frontend. The returned message is only valid until the next call to Receive.
func (b *Backend) Receive() (FrontendMessage, error) {
	if !b.partialMsg {
		header, err := b.cr.Next(5)
		if err != nil {
			return nil, translateEOFtoErrUnexpectedEOF(err)
		}

		b.msgType = header[0]

		msgLength := int(binary.BigEndian.Uint32(header[1:]))
		if msgLength < 4 {
			return nil, fmt.Errorf("invalid message length: %d", msgLength)
		}

		b.bodyLen = msgLength - 4
		if b.maxBodyLen > 0 && b.bodyLen > b.maxBodyLen {
			return nil, &ExceededMaxBodyLenErr{b.maxBodyLen, b.bodyLen}
		}
		b.partialMsg = true
	}

	var msg FrontendMessage
	switch b.msgType {
	case 'B':
		msg = &b.bind
	case 'C':
		msg = &b._close
	case 'D':
		msg = &b.describe
	case 'E':
		msg = &b.execute
	case 'F':
		msg = &b.functionCall
	case 'f':
		msg = &b.copyFail
	case 'd':
		msg = &b.copyData
	case 'c':
		msg = &b.copyDone
	case 'H':
		msg = &b.flush
	case 'P':
		msg = &b.parse
	case 'p':
		switch b.authType {
		case AuthTypeSASL:
			msg = &SASLInitialResponse{}
		case AuthTypeSASLContinue:
			msg = &SASLResponse{}
		case AuthTypeSASLFinal:
			msg = &SASLResponse{}
		case AuthTypeGSS, AuthTypeGSSCont:
			msg = &GSSResponse{}
		case AuthTypeCleartextPassword, AuthTypeMD5Password:
			fallthrough
		default:
			// to maintain backwards compatibility
			msg = &PasswordMessage{}
		}
	case 'Q':
		msg = &b.query
	case 'S':
		msg = &b.sync
	case 'X':
		msg = &b.terminate
	default:
		return nil, fmt.Errorf("unknown message type: %c", b.msgType)
	}

	msgBody, err := b.cr.Next(b.bodyLen)
	if err != nil {
		return nil, translateEOFtoErrUnexpectedEOF(err)
	}

	b.partialMsg = false

	err = msg.Decode(msgBody)
	if err != nil {
		return nil, err
	}

	if b.tracer != nil {
		b.tracer.traceMessage('F', int32(5+len(msgBody)), msg)
	}

	return msg, nil
}

// SetAuthType sets the authentication type in the backend.
// Since multiple message types can start with 'p', SetAuthType allows
// contextual identification of FrontendMessages. For example, in the
// PG message flow documentation for PasswordMessage:
//
//			Byte1('p')
//
//	     Identifies the message as a password response. Note that this is also used for
//			GSSAPI, SSPI and SASL response messages. The exact message type can be deduced from
//			the context.
//
// Since the Frontend does not know about the state of a backend, it is important
// to call SetAuthType() after an authentication request is received by the Frontend.
func (b *Backend) SetAuthType(authType uint32) error {
	switch authType {
	case AuthTypeOk,
		AuthTypeCleartextPassword,
		AuthTypeMD5Password,
		AuthTypeSCMCreds,
		AuthTypeGSS,
		AuthTypeGSSCont,
		AuthTypeSSPI,
		AuthTypeSASL,
		AuthTypeSASLContinue,
		AuthTypeSASLFinal:
		b.authType = authType
	default:
		return fmt.Errorf("authType not recognized: %d", authType)
	}

	return nil
}

// SetMaxBodyLen sets the maximum length of a message body in octets.
// If a message body exceeds this length, Receive will return an error.
// This is useful for protecting against malicious clients that send
// large messages with the intent of causing memory exhaustion.
// The default value is 0.
// If maxBodyLen is 0, then no maximum is enforced.
func (b *Backend) SetMaxBodyLen(maxBodyLen int) {
	b.maxBodyLen = maxBodyLen
}
