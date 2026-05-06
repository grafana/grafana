package pgproto3

import (
	"encoding/json"
)

type Sync struct{}

// Frontend identifies this message as sendable by a PostgreSQL frontend.
func (*Sync) Frontend() {}

// Decode decodes src into dst. src must contain the complete message with the exception of the initial 1 byte message
// type identifier and 4 byte message length.
func (dst *Sync) Decode(src []byte) error {
	if len(src) != 0 {
		return &invalidMessageLenErr{messageType: "Sync", expectedLen: 0, actualLen: len(src)}
	}

	return nil
}

// Encode encodes src into dst. dst will include the 1 byte message type identifier and the 4 byte message length.
func (src *Sync) Encode(dst []byte) ([]byte, error) {
	return append(dst, 'S', 0, 0, 0, 4), nil
}

// MarshalJSON implements encoding/json.Marshaler.
func (src Sync) MarshalJSON() ([]byte, error) {
	return json.Marshal(struct {
		Type string
	}{
		Type: "Sync",
	})
}
