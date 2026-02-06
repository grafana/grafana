package pgproto3

import (
	"bytes"
	"encoding/json"
)

type Query struct {
	String string
}

// Frontend identifies this message as sendable by a PostgreSQL frontend.
func (*Query) Frontend() {}

// Decode decodes src into dst. src must contain the complete message with the exception of the initial 1 byte message
// type identifier and 4 byte message length.
func (dst *Query) Decode(src []byte) error {
	i := bytes.IndexByte(src, 0)
	if i != len(src)-1 {
		return &invalidMessageFormatErr{messageType: "Query"}
	}

	dst.String = string(src[:i])

	return nil
}

// Encode encodes src into dst. dst will include the 1 byte message type identifier and the 4 byte message length.
func (src *Query) Encode(dst []byte) ([]byte, error) {
	dst, sp := beginMessage(dst, 'Q')
	dst = append(dst, src.String...)
	dst = append(dst, 0)
	return finishMessage(dst, sp)
}

// MarshalJSON implements encoding/json.Marshaler.
func (src Query) MarshalJSON() ([]byte, error) {
	return json.Marshal(struct {
		Type   string
		String string
	}{
		Type:   "Query",
		String: src.String,
	})
}
