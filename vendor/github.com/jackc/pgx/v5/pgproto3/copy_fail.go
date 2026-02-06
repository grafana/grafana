package pgproto3

import (
	"bytes"
	"encoding/json"
)

type CopyFail struct {
	Message string
}

// Frontend identifies this message as sendable by a PostgreSQL frontend.
func (*CopyFail) Frontend() {}

// Decode decodes src into dst. src must contain the complete message with the exception of the initial 1 byte message
// type identifier and 4 byte message length.
func (dst *CopyFail) Decode(src []byte) error {
	idx := bytes.IndexByte(src, 0)
	if idx != len(src)-1 {
		return &invalidMessageFormatErr{messageType: "CopyFail"}
	}

	dst.Message = string(src[:idx])

	return nil
}

// Encode encodes src into dst. dst will include the 1 byte message type identifier and the 4 byte message length.
func (src *CopyFail) Encode(dst []byte) ([]byte, error) {
	dst, sp := beginMessage(dst, 'f')
	dst = append(dst, src.Message...)
	dst = append(dst, 0)
	return finishMessage(dst, sp)
}

// MarshalJSON implements encoding/json.Marshaler.
func (src CopyFail) MarshalJSON() ([]byte, error) {
	return json.Marshal(struct {
		Type    string
		Message string
	}{
		Type:    "CopyFail",
		Message: src.Message,
	})
}
