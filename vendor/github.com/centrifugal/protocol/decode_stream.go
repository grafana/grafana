package protocol

import (
	"bufio"
	"encoding/binary"
	"errors"
	"io"
	"sync"

	"github.com/segmentio/encoding/json"
)

var (
	streamJsonCommandDecoderPool     sync.Pool
	streamProtobufCommandDecoderPool sync.Pool
)

func GetStreamCommandDecoder(protoType Type, reader io.Reader) StreamCommandDecoder {
	return GetStreamCommandDecoderLimited(protoType, reader, 0)
}

func GetStreamCommandDecoderLimited(protoType Type, reader io.Reader, messageSizeLimit int64) StreamCommandDecoder {
	if protoType == TypeJSON {
		e := streamJsonCommandDecoderPool.Get()
		if e == nil {
			return NewJSONStreamCommandDecoder(reader, messageSizeLimit)
		}
		commandDecoder := e.(*JSONStreamCommandDecoder)
		commandDecoder.Reset(reader, messageSizeLimit)
		return commandDecoder
	}
	e := streamProtobufCommandDecoderPool.Get()
	if e == nil {
		return NewProtobufStreamCommandDecoder(reader, messageSizeLimit)
	}
	commandDecoder := e.(*ProtobufStreamCommandDecoder)
	commandDecoder.Reset(reader, messageSizeLimit)
	return commandDecoder
}

func PutStreamCommandDecoder(protoType Type, e StreamCommandDecoder) {
	e.Reset(nil, 0)
	if protoType == TypeJSON {
		streamJsonCommandDecoderPool.Put(e)
		return
	}
	streamProtobufCommandDecoderPool.Put(e)
}

type StreamCommandDecoder interface {
	Decode() (*Command, int, error)
	Reset(reader io.Reader, messageSizeLimit int64)
}

// ErrMessageTooLarge for when the message exceeds the limit.
var ErrMessageTooLarge = errors.New("message size exceeds the limit")

type JSONStreamCommandDecoder struct {
	reader           *bufio.Reader
	limitedReader    *io.LimitedReader
	messageSizeLimit int64
}

func NewJSONStreamCommandDecoder(reader io.Reader, messageSizeLimit int64) *JSONStreamCommandDecoder {
	var limitedReader *io.LimitedReader
	var bufioReader *bufio.Reader
	if messageSizeLimit > 0 {
		limitedReader = &io.LimitedReader{R: reader, N: messageSizeLimit + 1}
		bufioReader = bufio.NewReader(limitedReader)
	} else {
		bufioReader = bufio.NewReader(reader)
	}
	return &JSONStreamCommandDecoder{
		reader:           bufioReader,
		limitedReader:    limitedReader,
		messageSizeLimit: messageSizeLimit,
	}
}

func (d *JSONStreamCommandDecoder) Decode() (*Command, int, error) {
	if d.messageSizeLimit > 0 {
		d.limitedReader.N = int64(d.messageSizeLimit) + 1
	}
	cmdBytes, err := d.reader.ReadBytes('\n')
	if err != nil {
		if d.messageSizeLimit > 0 && int64(len(cmdBytes)) > d.messageSizeLimit {
			return nil, 0, ErrMessageTooLarge
		}
		if err == io.EOF && len(cmdBytes) > 0 {
			var c Command
			_, parseErr := json.Parse(cmdBytes, &c, 0)
			if parseErr != nil {
				return nil, 0, parseErr
			}
			return &c, len(cmdBytes), err
		}
		return nil, 0, err
	}

	var c Command
	_, err = json.Parse(cmdBytes, &c, 0)
	if err != nil {
		return nil, 0, err
	}
	return &c, len(cmdBytes), nil
}

func (d *JSONStreamCommandDecoder) Reset(reader io.Reader, messageSizeLimit int64) {
	d.messageSizeLimit = messageSizeLimit
	if messageSizeLimit > 0 {
		limitedReader := &io.LimitedReader{R: reader, N: messageSizeLimit + 1}
		bufioReader := bufio.NewReader(limitedReader)
		d.limitedReader = limitedReader
		d.reader.Reset(bufioReader)
	} else {
		d.limitedReader = nil
		d.reader.Reset(reader)
	}
}

type ProtobufStreamCommandDecoder struct {
	reader           *bufio.Reader
	messageSizeLimit int64
}

func NewProtobufStreamCommandDecoder(reader io.Reader, messageSizeLimit int64) *ProtobufStreamCommandDecoder {
	return &ProtobufStreamCommandDecoder{reader: bufio.NewReader(reader), messageSizeLimit: messageSizeLimit}
}

func (d *ProtobufStreamCommandDecoder) Decode() (*Command, int, error) {
	msgLength, err := binary.ReadUvarint(d.reader)
	if err != nil {
		return nil, 0, err
	}

	if d.messageSizeLimit > 0 && msgLength > uint64(d.messageSizeLimit) {
		return nil, 0, ErrMessageTooLarge
	}

	bb := getByteBuffer(int(msgLength))
	defer putByteBuffer(bb)

	n, err := io.ReadFull(d.reader, bb.B[:int(msgLength)])
	if err != nil {
		return nil, 0, err
	}
	if uint64(n) != msgLength {
		return nil, 0, io.ErrShortBuffer
	}
	var c Command
	err = c.UnmarshalVT(bb.B[:int(msgLength)]) // Note, UnmarshalVTUnsafe here will result into issues.
	if err != nil {
		return nil, 0, err
	}
	return &c, int(msgLength) + 8, nil
}

func (d *ProtobufStreamCommandDecoder) Reset(reader io.Reader, messageSizeLimit int64) {
	d.messageSizeLimit = messageSizeLimit
	d.reader.Reset(reader)
}
