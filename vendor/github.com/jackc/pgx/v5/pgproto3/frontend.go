package pgproto3

import (
	"bytes"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
)

// Frontend acts as a client for the PostgreSQL wire protocol version 3.
type Frontend struct {
	cr *chunkReader
	w  io.Writer

	// tracer is used to trace messages when Send or Receive is called. This means an outbound message is traced
	// before it is actually transmitted (i.e. before Flush). It is safe to change this variable when the Frontend is
	// idle. Setting and unsetting tracer provides equivalent functionality to PQtrace and PQuntrace in libpq.
	tracer *tracer

	wbuf        []byte
	encodeError error

	// Backend message flyweights
	authenticationOk                AuthenticationOk
	authenticationCleartextPassword AuthenticationCleartextPassword
	authenticationMD5Password       AuthenticationMD5Password
	authenticationGSS               AuthenticationGSS
	authenticationGSSContinue       AuthenticationGSSContinue
	authenticationSASL              AuthenticationSASL
	authenticationSASLContinue      AuthenticationSASLContinue
	authenticationSASLFinal         AuthenticationSASLFinal
	backendKeyData                  BackendKeyData
	bindComplete                    BindComplete
	closeComplete                   CloseComplete
	commandComplete                 CommandComplete
	copyBothResponse                CopyBothResponse
	copyData                        CopyData
	copyInResponse                  CopyInResponse
	copyOutResponse                 CopyOutResponse
	copyDone                        CopyDone
	dataRow                         DataRow
	emptyQueryResponse              EmptyQueryResponse
	errorResponse                   ErrorResponse
	functionCallResponse            FunctionCallResponse
	noData                          NoData
	noticeResponse                  NoticeResponse
	notificationResponse            NotificationResponse
	parameterDescription            ParameterDescription
	parameterStatus                 ParameterStatus
	parseComplete                   ParseComplete
	readyForQuery                   ReadyForQuery
	rowDescription                  RowDescription
	portalSuspended                 PortalSuspended

	bodyLen    int
	maxBodyLen int // maxBodyLen is the maximum length of a message body in octets. If a message body exceeds this length, Receive will return an error.
	msgType    byte
	partialMsg bool
	authType   uint32
}

// NewFrontend creates a new Frontend.
func NewFrontend(r io.Reader, w io.Writer) *Frontend {
	cr := newChunkReader(r, 0)
	return &Frontend{cr: cr, w: w}
}

// Send sends a message to the backend (i.e. the server). The message is buffered until Flush is called. Any error
// encountered will be returned from Flush.
//
// Send can work with any FrontendMessage. Some commonly used message types such as Bind have specialized send methods
// such as SendBind. These methods should be preferred when the type of message is known up front (e.g. when building an
// extended query protocol query) as they may be faster due to knowing the type of msg rather than it being hidden
// behind an interface.
func (f *Frontend) Send(msg FrontendMessage) {
	if f.encodeError != nil {
		return
	}

	prevLen := len(f.wbuf)
	newBuf, err := msg.Encode(f.wbuf)
	if err != nil {
		f.encodeError = err
		return
	}
	f.wbuf = newBuf

	if f.tracer != nil {
		f.tracer.traceMessage('F', int32(len(f.wbuf)-prevLen), msg)
	}
}

// Flush writes any pending messages to the backend (i.e. the server).
func (f *Frontend) Flush() error {
	if err := f.encodeError; err != nil {
		f.encodeError = nil
		f.wbuf = f.wbuf[:0]
		return &writeError{err: err, safeToRetry: true}
	}

	if len(f.wbuf) == 0 {
		return nil
	}

	n, err := f.w.Write(f.wbuf)

	const maxLen = 1024
	if len(f.wbuf) > maxLen {
		f.wbuf = make([]byte, 0, maxLen)
	} else {
		f.wbuf = f.wbuf[:0]
	}

	if err != nil {
		return &writeError{err: err, safeToRetry: n == 0}
	}

	return nil
}

// Trace starts tracing the message traffic to w. It writes in a similar format to that produced by the libpq function
// PQtrace.
func (f *Frontend) Trace(w io.Writer, options TracerOptions) {
	f.tracer = &tracer{
		w:             w,
		buf:           &bytes.Buffer{},
		TracerOptions: options,
	}
}

// Untrace stops tracing.
func (f *Frontend) Untrace() {
	f.tracer = nil
}

// SendBind sends a Bind message to the backend (i.e. the server). The message is buffered until Flush is called. Any
// error encountered will be returned from Flush.
func (f *Frontend) SendBind(msg *Bind) {
	if f.encodeError != nil {
		return
	}

	prevLen := len(f.wbuf)
	newBuf, err := msg.Encode(f.wbuf)
	if err != nil {
		f.encodeError = err
		return
	}
	f.wbuf = newBuf

	if f.tracer != nil {
		f.tracer.traceBind('F', int32(len(f.wbuf)-prevLen), msg)
	}
}

// SendParse sends a Parse message to the backend (i.e. the server). The message is buffered until Flush is called. Any
// error encountered will be returned from Flush.
func (f *Frontend) SendParse(msg *Parse) {
	if f.encodeError != nil {
		return
	}

	prevLen := len(f.wbuf)
	newBuf, err := msg.Encode(f.wbuf)
	if err != nil {
		f.encodeError = err
		return
	}
	f.wbuf = newBuf

	if f.tracer != nil {
		f.tracer.traceParse('F', int32(len(f.wbuf)-prevLen), msg)
	}
}

// SendClose sends a Close message to the backend (i.e. the server). The message is buffered until Flush is called. Any
// error encountered will be returned from Flush.
func (f *Frontend) SendClose(msg *Close) {
	if f.encodeError != nil {
		return
	}

	prevLen := len(f.wbuf)
	newBuf, err := msg.Encode(f.wbuf)
	if err != nil {
		f.encodeError = err
		return
	}
	f.wbuf = newBuf

	if f.tracer != nil {
		f.tracer.traceClose('F', int32(len(f.wbuf)-prevLen), msg)
	}
}

// SendDescribe sends a Describe message to the backend (i.e. the server). The message is buffered until Flush is
// called. Any error encountered will be returned from Flush.
func (f *Frontend) SendDescribe(msg *Describe) {
	if f.encodeError != nil {
		return
	}

	prevLen := len(f.wbuf)
	newBuf, err := msg.Encode(f.wbuf)
	if err != nil {
		f.encodeError = err
		return
	}
	f.wbuf = newBuf

	if f.tracer != nil {
		f.tracer.traceDescribe('F', int32(len(f.wbuf)-prevLen), msg)
	}
}

// SendExecute sends an Execute message to the backend (i.e. the server). The message is buffered until Flush is called.
// Any error encountered will be returned from Flush.
func (f *Frontend) SendExecute(msg *Execute) {
	if f.encodeError != nil {
		return
	}

	prevLen := len(f.wbuf)
	newBuf, err := msg.Encode(f.wbuf)
	if err != nil {
		f.encodeError = err
		return
	}
	f.wbuf = newBuf

	if f.tracer != nil {
		f.tracer.TraceQueryute('F', int32(len(f.wbuf)-prevLen), msg)
	}
}

// SendSync sends a Sync message to the backend (i.e. the server). The message is buffered until Flush is called. Any
// error encountered will be returned from Flush.
func (f *Frontend) SendSync(msg *Sync) {
	if f.encodeError != nil {
		return
	}

	prevLen := len(f.wbuf)
	newBuf, err := msg.Encode(f.wbuf)
	if err != nil {
		f.encodeError = err
		return
	}
	f.wbuf = newBuf

	if f.tracer != nil {
		f.tracer.traceSync('F', int32(len(f.wbuf)-prevLen), msg)
	}
}

// SendQuery sends a Query message to the backend (i.e. the server). The message is buffered until Flush is called. Any
// error encountered will be returned from Flush.
func (f *Frontend) SendQuery(msg *Query) {
	if f.encodeError != nil {
		return
	}

	prevLen := len(f.wbuf)
	newBuf, err := msg.Encode(f.wbuf)
	if err != nil {
		f.encodeError = err
		return
	}
	f.wbuf = newBuf

	if f.tracer != nil {
		f.tracer.traceQuery('F', int32(len(f.wbuf)-prevLen), msg)
	}
}

// SendUnbufferedEncodedCopyData immediately sends an encoded CopyData message to the backend (i.e. the server). This method
// is more efficient than sending a CopyData message with Send as the message data is not copied to the internal buffer
// before being written out. The internal buffer is flushed before the message is sent.
func (f *Frontend) SendUnbufferedEncodedCopyData(msg []byte) error {
	err := f.Flush()
	if err != nil {
		return err
	}

	n, err := f.w.Write(msg)
	if err != nil {
		return &writeError{err: err, safeToRetry: n == 0}
	}

	if f.tracer != nil {
		f.tracer.traceCopyData('F', int32(len(msg)-1), &CopyData{})
	}

	return nil
}

func translateEOFtoErrUnexpectedEOF(err error) error {
	if err == io.EOF {
		return io.ErrUnexpectedEOF
	}
	return err
}

// Receive receives a message from the backend. The returned message is only valid until the next call to Receive.
func (f *Frontend) Receive() (BackendMessage, error) {
	if !f.partialMsg {
		header, err := f.cr.Next(5)
		if err != nil {
			return nil, translateEOFtoErrUnexpectedEOF(err)
		}

		f.msgType = header[0]

		msgLength := int(binary.BigEndian.Uint32(header[1:]))
		if msgLength < 4 {
			return nil, fmt.Errorf("invalid message length: %d", msgLength)
		}

		f.bodyLen = msgLength - 4
		if f.maxBodyLen > 0 && f.bodyLen > f.maxBodyLen {
			return nil, &ExceededMaxBodyLenErr{f.maxBodyLen, f.bodyLen}
		}
		f.partialMsg = true
	}

	msgBody, err := f.cr.Next(f.bodyLen)
	if err != nil {
		return nil, translateEOFtoErrUnexpectedEOF(err)
	}

	f.partialMsg = false

	var msg BackendMessage
	switch f.msgType {
	case '1':
		msg = &f.parseComplete
	case '2':
		msg = &f.bindComplete
	case '3':
		msg = &f.closeComplete
	case 'A':
		msg = &f.notificationResponse
	case 'c':
		msg = &f.copyDone
	case 'C':
		msg = &f.commandComplete
	case 'd':
		msg = &f.copyData
	case 'D':
		msg = &f.dataRow
	case 'E':
		msg = &f.errorResponse
	case 'G':
		msg = &f.copyInResponse
	case 'H':
		msg = &f.copyOutResponse
	case 'I':
		msg = &f.emptyQueryResponse
	case 'K':
		msg = &f.backendKeyData
	case 'n':
		msg = &f.noData
	case 'N':
		msg = &f.noticeResponse
	case 'R':
		var err error
		msg, err = f.findAuthenticationMessageType(msgBody)
		if err != nil {
			return nil, err
		}
	case 's':
		msg = &f.portalSuspended
	case 'S':
		msg = &f.parameterStatus
	case 't':
		msg = &f.parameterDescription
	case 'T':
		msg = &f.rowDescription
	case 'V':
		msg = &f.functionCallResponse
	case 'W':
		msg = &f.copyBothResponse
	case 'Z':
		msg = &f.readyForQuery
	default:
		return nil, fmt.Errorf("unknown message type: %c", f.msgType)
	}

	err = msg.Decode(msgBody)
	if err != nil {
		return nil, err
	}

	if f.tracer != nil {
		f.tracer.traceMessage('B', int32(5+len(msgBody)), msg)
	}

	return msg, nil
}

// Authentication message type constants.
// See src/include/libpq/pqcomm.h for all
// constants.
const (
	AuthTypeOk                = 0
	AuthTypeCleartextPassword = 3
	AuthTypeMD5Password       = 5
	AuthTypeSCMCreds          = 6
	AuthTypeGSS               = 7
	AuthTypeGSSCont           = 8
	AuthTypeSSPI              = 9
	AuthTypeSASL              = 10
	AuthTypeSASLContinue      = 11
	AuthTypeSASLFinal         = 12
)

func (f *Frontend) findAuthenticationMessageType(src []byte) (BackendMessage, error) {
	if len(src) < 4 {
		return nil, errors.New("authentication message too short")
	}
	f.authType = binary.BigEndian.Uint32(src[:4])

	switch f.authType {
	case AuthTypeOk:
		return &f.authenticationOk, nil
	case AuthTypeCleartextPassword:
		return &f.authenticationCleartextPassword, nil
	case AuthTypeMD5Password:
		return &f.authenticationMD5Password, nil
	case AuthTypeSCMCreds:
		return nil, errors.New("AuthTypeSCMCreds is unimplemented")
	case AuthTypeGSS:
		return &f.authenticationGSS, nil
	case AuthTypeGSSCont:
		return &f.authenticationGSSContinue, nil
	case AuthTypeSSPI:
		return nil, errors.New("AuthTypeSSPI is unimplemented")
	case AuthTypeSASL:
		return &f.authenticationSASL, nil
	case AuthTypeSASLContinue:
		return &f.authenticationSASLContinue, nil
	case AuthTypeSASLFinal:
		return &f.authenticationSASLFinal, nil
	default:
		return nil, fmt.Errorf("unknown authentication type: %d", f.authType)
	}
}

// GetAuthType returns the authType used in the current state of the frontend.
// See SetAuthType for more information.
func (f *Frontend) GetAuthType() uint32 {
	return f.authType
}

func (f *Frontend) ReadBufferLen() int {
	return f.cr.wp - f.cr.rp
}

// SetMaxBodyLen sets the maximum length of a message body in octets.
// If a message body exceeds this length, Receive will return an error.
// This is useful for protecting against a corrupted server that sends
// messages with incorrect length, which can cause memory exhaustion.
// The default value is 0.
// If maxBodyLen is 0, then no maximum is enforced.
func (f *Frontend) SetMaxBodyLen(maxBodyLen int) {
	f.maxBodyLen = maxBodyLen
}
