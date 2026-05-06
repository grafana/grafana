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

// DecoderOptions is the Decoder configuration options.
type DecoderOptions struct {
	Logger      logging.Logger
	LogMessages bool
}

// Decoder provides decoding of an Event Stream messages.
type Decoder struct {
	options DecoderOptions
}

// NewDecoder initializes and returns a Decoder for decoding event
// stream messages from the reader provided.
func NewDecoder(optFns ...func(*DecoderOptions)) *Decoder {
	options := DecoderOptions{}

	for _, fn := range optFns {
		fn(&options)
	}

	return &Decoder{
		options: options,
	}
}

// Decode attempts to decode a single message from the event stream reader.
// Will return the event stream message, or error if decodeMessage fails to read
// the message from the stream.
//
// payloadBuf is a byte slice that will be used in the returned Message.Payload. Callers
// must ensure that the Message.Payload from a previous decode has been consumed before passing in the same underlying
// payloadBuf byte slice.
func (d *Decoder) Decode(reader io.Reader, payloadBuf []byte) (m Message, err error) {
	if d.options.Logger != nil && d.options.LogMessages {
		debugMsgBuf := bytes.NewBuffer(nil)
		reader = io.TeeReader(reader, debugMsgBuf)
		defer func() {
			logMessageDecode(d.options.Logger, debugMsgBuf, m, err)
		}()
	}

	m, err = decodeMessage(reader, payloadBuf)

	return m, err
}

// decodeMessage attempts to decode a single message from the event stream reader.
// Will return the event stream message, or error if decodeMessage fails to read
// the message from the reader.
func decodeMessage(reader io.Reader, payloadBuf []byte) (m Message, err error) {
	crc := crc32.New(crc32IEEETable)
	hashReader := io.TeeReader(reader, crc)

	prelude, err := decodePrelude(hashReader, crc)
	if err != nil {
		return Message{}, err
	}

	if prelude.HeadersLen > 0 {
		lr := io.LimitReader(hashReader, int64(prelude.HeadersLen))
		m.Headers, err = decodeHeaders(lr)
		if err != nil {
			return Message{}, err
		}
	}

	if payloadLen := prelude.PayloadLen(); payloadLen > 0 {
		buf, err := decodePayload(payloadBuf, io.LimitReader(hashReader, int64(payloadLen)))
		if err != nil {
			return Message{}, err
		}
		m.Payload = buf
	}

	msgCRC := crc.Sum32()
	if err := validateCRC(reader, msgCRC); err != nil {
		return Message{}, err
	}

	return m, nil
}

func logMessageDecode(logger logging.Logger, msgBuf *bytes.Buffer, msg Message, decodeErr error) {
	w := bytes.NewBuffer(nil)
	defer func() { logger.Logf(logging.Debug, w.String()) }()

	fmt.Fprintf(w, "Raw message:\n%s\n",
		hex.Dump(msgBuf.Bytes()))

	if decodeErr != nil {
		fmt.Fprintf(w, "decodeMessage error: %v\n", decodeErr)
		return
	}

	rawMsg, err := msg.rawMessage()
	if err != nil {
		fmt.Fprintf(w, "failed to create raw message, %v\n", err)
		return
	}

	decodedMsg := decodedMessage{
		rawMessage: rawMsg,
		Headers:    decodedHeaders(msg.Headers),
	}

	fmt.Fprintf(w, "Decoded message:\n")
	encoder := json.NewEncoder(w)
	if err := encoder.Encode(decodedMsg); err != nil {
		fmt.Fprintf(w, "failed to generate decoded message, %v\n", err)
	}
}

func decodePrelude(r io.Reader, crc hash.Hash32) (messagePrelude, error) {
	var p messagePrelude

	var err error
	p.Length, err = decodeUint32(r)
	if err != nil {
		return messagePrelude{}, err
	}

	p.HeadersLen, err = decodeUint32(r)
	if err != nil {
		return messagePrelude{}, err
	}

	if err := p.ValidateLens(); err != nil {
		return messagePrelude{}, err
	}

	preludeCRC := crc.Sum32()
	if err := validateCRC(r, preludeCRC); err != nil {
		return messagePrelude{}, err
	}

	p.PreludeCRC = preludeCRC

	return p, nil
}

func decodePayload(buf []byte, r io.Reader) ([]byte, error) {
	w := bytes.NewBuffer(buf[0:0])

	_, err := io.Copy(w, r)
	return w.Bytes(), err
}

func decodeUint8(r io.Reader) (uint8, error) {
	type byteReader interface {
		ReadByte() (byte, error)
	}

	if br, ok := r.(byteReader); ok {
		v, err := br.ReadByte()
		return v, err
	}

	var b [1]byte
	_, err := io.ReadFull(r, b[:])
	return b[0], err
}

func decodeUint16(r io.Reader) (uint16, error) {
	var b [2]byte
	bs := b[:]
	_, err := io.ReadFull(r, bs)
	if err != nil {
		return 0, err
	}
	return binary.BigEndian.Uint16(bs), nil
}

func decodeUint32(r io.Reader) (uint32, error) {
	var b [4]byte
	bs := b[:]
	_, err := io.ReadFull(r, bs)
	if err != nil {
		return 0, err
	}
	return binary.BigEndian.Uint32(bs), nil
}

func decodeUint64(r io.Reader) (uint64, error) {
	var b [8]byte
	bs := b[:]
	_, err := io.ReadFull(r, bs)
	if err != nil {
		return 0, err
	}
	return binary.BigEndian.Uint64(bs), nil
}

func validateCRC(r io.Reader, expect uint32) error {
	msgCRC, err := decodeUint32(r)
	if err != nil {
		return err
	}

	if msgCRC != expect {
		return ChecksumError{}
	}

	return nil
}
