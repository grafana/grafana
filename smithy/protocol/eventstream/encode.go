package eventstream

import (
	"bytes"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"github.com/aws/smithy-go/logging"
	"hash"
	"hash/crc32"
	"io"
)

// EncoderOptions is the configuration options for Encoder.
type EncoderOptions struct {
	Logger      logging.Logger
	LogMessages bool
}

// Encoder provides EventStream message encoding.
type Encoder struct {
	options EncoderOptions

	headersBuf *bytes.Buffer
	messageBuf *bytes.Buffer
}

// NewEncoder initializes and returns an Encoder to encode Event Stream
// messages.
func NewEncoder(optFns ...func(*EncoderOptions)) *Encoder {
	o := EncoderOptions{}

	for _, fn := range optFns {
		fn(&o)
	}

	return &Encoder{
		options:    o,
		headersBuf: bytes.NewBuffer(nil),
		messageBuf: bytes.NewBuffer(nil),
	}
}

// Encode encodes a single EventStream message to the io.Writer the Encoder
// was created with. An error is returned if writing the message fails.
func (e *Encoder) Encode(w io.Writer, msg Message) (err error) {
	e.headersBuf.Reset()
	e.messageBuf.Reset()

	var writer io.Writer = e.messageBuf
	if e.options.Logger != nil && e.options.LogMessages {
		encodeMsgBuf := bytes.NewBuffer(nil)
		writer = io.MultiWriter(writer, encodeMsgBuf)
		defer func() {
			logMessageEncode(e.options.Logger, encodeMsgBuf, msg, err)
		}()
	}

	if err = EncodeHeaders(e.headersBuf, msg.Headers); err != nil {
		return err
	}

	crc := crc32.New(crc32IEEETable)
	hashWriter := io.MultiWriter(writer, crc)

	headersLen := uint32(e.headersBuf.Len())
	payloadLen := uint32(len(msg.Payload))

	if err = encodePrelude(hashWriter, crc, headersLen, payloadLen); err != nil {
		return err
	}

	if headersLen > 0 {
		if _, err = io.Copy(hashWriter, e.headersBuf); err != nil {
			return err
		}
	}

	if payloadLen > 0 {
		if _, err = hashWriter.Write(msg.Payload); err != nil {
			return err
		}
	}

	msgCRC := crc.Sum32()
	if err := binary.Write(writer, binary.BigEndian, msgCRC); err != nil {
		return err
	}

	_, err = io.Copy(w, e.messageBuf)

	return err
}

func logMessageEncode(logger logging.Logger, msgBuf *bytes.Buffer, msg Message, encodeErr error) {
	w := bytes.NewBuffer(nil)
	defer func() { logger.Logf(logging.Debug, w.String()) }()

	fmt.Fprintf(w, "Message to encode:\n")
	encoder := json.NewEncoder(w)
	if err := encoder.Encode(msg); err != nil {
		fmt.Fprintf(w, "Failed to get encoded message, %v\n", err)
	}

	if encodeErr != nil {
		fmt.Fprintf(w, "Encode error: %v\n", encodeErr)
		return
	}

	fmt.Fprintf(w, "Raw message:\n%s\n", hex.Dump(msgBuf.Bytes()))
}

func encodePrelude(w io.Writer, crc hash.Hash32, headersLen, payloadLen uint32) error {
	p := messagePrelude{
		Length:     minMsgLen + headersLen + payloadLen,
		HeadersLen: headersLen,
	}
	if err := p.ValidateLens(); err != nil {
		return err
	}

	err := binaryWriteFields(w, binary.BigEndian,
		p.Length,
		p.HeadersLen,
	)
	if err != nil {
		return err
	}

	p.PreludeCRC = crc.Sum32()
	err = binary.Write(w, binary.BigEndian, p.PreludeCRC)
	if err != nil {
		return err
	}

	return nil
}

// EncodeHeaders writes the header values to the writer encoded in the event
// stream format. Returns an error if a header fails to encode.
func EncodeHeaders(w io.Writer, headers Headers) error {
	for _, h := range headers {
		hn := headerName{
			Len: uint8(len(h.Name)),
		}
		copy(hn.Name[:hn.Len], h.Name)
		if err := hn.encode(w); err != nil {
			return err
		}

		if err := h.Value.encode(w); err != nil {
			return err
		}
	}

	return nil
}

func binaryWriteFields(w io.Writer, order binary.ByteOrder, vs ...interface{}) error {
	for _, v := range vs {
		if err := binary.Write(w, order, v); err != nil {
			return err
		}
	}
	return nil
}
