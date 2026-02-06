package pgproto3

import (
	"encoding/json"
)

type Flush struct{}

// Frontend identifies this message as sendable by a PostgreSQL frontend.
func (*Flush) Frontend() {}

// Decode decodes src into dst. src must contain the complete message with the exception of the initial 1 byte message
// type identifier and 4 byte message length.
func (dst *Flush) Decode(src []byte) error {
	if len(src) != 0 {
		return &invalidMessageLenErr{messageType: "Flush", expectedLen: 0, actualLen: len(src)}
	}

	return nil
}

// Encode encodes src into dst. dst will include the 1 byte message type identifier and the 4 byte message length.
func (src *Flush) Encode(dst []byte) ([]byte, error) {
	return append(dst, 'H', 0, 0, 0, 4), nil
}

// MarshalJSON implements encoding/json.Marshaler.
func (src Flush) MarshalJSON() ([]byte, error) {
	return json.Marshal(struct {
		Type string
	}{
		Type: "Flush",
	})
}
