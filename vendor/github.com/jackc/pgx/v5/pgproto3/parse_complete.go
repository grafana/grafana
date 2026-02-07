package pgproto3

import (
	"encoding/json"
)

type ParseComplete struct{}

// Backend identifies this message as sendable by the PostgreSQL backend.
func (*ParseComplete) Backend() {}

// Decode decodes src into dst. src must contain the complete message with the exception of the initial 1 byte message
// type identifier and 4 byte message length.
func (dst *ParseComplete) Decode(src []byte) error {
	if len(src) != 0 {
		return &invalidMessageLenErr{messageType: "ParseComplete", expectedLen: 0, actualLen: len(src)}
	}

	return nil
}

// Encode encodes src into dst. dst will include the 1 byte message type identifier and the 4 byte message length.
func (src *ParseComplete) Encode(dst []byte) ([]byte, error) {
	return append(dst, '1', 0, 0, 0, 4), nil
}

// MarshalJSON implements encoding/json.Marshaler.
func (src ParseComplete) MarshalJSON() ([]byte, error) {
	return json.Marshal(struct {
		Type string
	}{
		Type: "ParseComplete",
	})
}
