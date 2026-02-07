package protocol

import (
	"bytes"
	"encoding/binary"
	"io"

	"github.com/segmentio/encoding/json"
)

// CommandDecoder ...
type CommandDecoder interface {
	Reset([]byte) error
	Decode() (*Command, error)
}

// JSONCommandDecoder ...
type JSONCommandDecoder struct {
	data            []byte
	messageCount    int
	prevNewLine     int
	numMessagesRead int
}

// NewJSONCommandDecoder ...
func NewJSONCommandDecoder(data []byte) *JSONCommandDecoder {
	// Protocol message must be separated by exactly one `\n`.
	messageCount := bytes.Count(data, []byte("\n")) + 1
	if len(data) == 0 || data[len(data)-1] == '\n' {
		// Protocol message must have zero or one `\n` at the end.
		messageCount--
	}
	return &JSONCommandDecoder{
		data:            data,
		messageCount:    messageCount,
		prevNewLine:     0,
		numMessagesRead: 0,
	}
}

// Reset ...
func (d *JSONCommandDecoder) Reset(data []byte) error {
	// We have a strict contract that protocol messages should be separated by at most one `\n`.
	messageCount := bytes.Count(data, []byte("\n")) + 1
	if len(data) == 0 || data[len(data)-1] == '\n' {
		// We have a strict contract that protocol message should use at most one `\n` at the end.
		messageCount--
	}
	d.data = data
	d.messageCount = messageCount
	d.prevNewLine = 0
	d.numMessagesRead = 0
	return nil
}

// Decode ...
func (d *JSONCommandDecoder) Decode() (*Command, error) {
	if d.messageCount == 0 {
		return nil, io.ErrUnexpectedEOF
	}
	var c Command
	if d.messageCount == 1 {
		_, err := json.Parse(d.data, &c, json.ZeroCopy)
		if err != nil {
			return nil, err
		}
		return &c, io.EOF
	}
	var nextNewLine int
	if d.numMessagesRead == d.messageCount-1 {
		// Last message, no need to search for a new line.
		nextNewLine = len(d.data[d.prevNewLine:])
	} else if len(d.data) > d.prevNewLine {
		nextNewLine = bytes.Index(d.data[d.prevNewLine:], []byte("\n"))
		if nextNewLine < 0 {
			return nil, io.ErrShortBuffer
		}
	} else {
		return nil, io.ErrShortBuffer
	}
	if len(d.data) >= d.prevNewLine+nextNewLine {
		_, err := json.Parse(d.data[d.prevNewLine:d.prevNewLine+nextNewLine], &c, json.ZeroCopy)
		if err != nil {
			return nil, err
		}
		d.numMessagesRead++
		d.prevNewLine = d.prevNewLine + nextNewLine + 1
		if d.numMessagesRead == d.messageCount {
			return &c, io.EOF
		}
		return &c, nil
	} else {
		return nil, io.ErrShortBuffer
	}
}

// ProtobufCommandDecoder ...
type ProtobufCommandDecoder struct {
	data   []byte
	offset int
}

// NewProtobufCommandDecoder ...
func NewProtobufCommandDecoder(data []byte) *ProtobufCommandDecoder {
	return &ProtobufCommandDecoder{
		data: data,
	}
}

// Reset ...
func (d *ProtobufCommandDecoder) Reset(data []byte) error {
	d.data = data
	d.offset = 0
	return nil
}

// Decode ...
func (d *ProtobufCommandDecoder) Decode() (*Command, error) {
	if d.offset < len(d.data) {
		var c Command
		l, n := binary.Uvarint(d.data[d.offset:])
		if n <= 0 {
			return nil, io.EOF
		}
		from := d.offset + n
		to := d.offset + n + int(l)
		if to > 0 && to <= len(d.data) {
			cmdBytes := d.data[from:to]
			err := c.UnmarshalVT(cmdBytes) // Check whether UnmarshalVTUnsafe here is OK.
			if err != nil {
				return nil, err
			}
			d.offset = to
			if d.offset == len(d.data) {
				err = io.EOF
			}
			return &c, err
		} else {
			return nil, io.ErrShortBuffer
		}
	}
	return nil, io.EOF
}

// ReplyDecoder ...
type ReplyDecoder interface {
	Reset([]byte) error
	Decode() (*Reply, error)
}

var _ ReplyDecoder = NewJSONReplyDecoder(nil)

// JSONReplyDecoder ...
type JSONReplyDecoder struct {
	decoder *json.Decoder
}

// NewJSONReplyDecoder ...
func NewJSONReplyDecoder(data []byte) *JSONReplyDecoder {
	return &JSONReplyDecoder{
		decoder: json.NewDecoder(bytes.NewReader(data)),
	}
}

// Reset ...
func (d *JSONReplyDecoder) Reset(data []byte) error {
	d.decoder = json.NewDecoder(bytes.NewReader(data))
	return nil
}

// Decode ...
func (d *JSONReplyDecoder) Decode() (*Reply, error) {
	var c Reply
	err := d.decoder.Decode(&c)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

var _ ReplyDecoder = NewProtobufReplyDecoder(nil)

// ProtobufReplyDecoder ...
type ProtobufReplyDecoder struct {
	data   []byte
	offset int
}

// NewProtobufReplyDecoder ...
func NewProtobufReplyDecoder(data []byte) *ProtobufReplyDecoder {
	return &ProtobufReplyDecoder{
		data: data,
	}
}

// Reset ...
func (d *ProtobufReplyDecoder) Reset(data []byte) error {
	d.data = data
	d.offset = 0
	return nil
}

// Decode ...
func (d *ProtobufReplyDecoder) Decode() (*Reply, error) {
	if d.offset < len(d.data) {
		var c Reply
		l, n := binary.Uvarint(d.data[d.offset:])
		replyBytes := d.data[d.offset+n : d.offset+n+int(l)]
		err := c.UnmarshalVT(replyBytes)
		if err != nil {
			return nil, err
		}
		d.offset = d.offset + n + int(l)
		return &c, nil
	}
	return nil, io.EOF
}
