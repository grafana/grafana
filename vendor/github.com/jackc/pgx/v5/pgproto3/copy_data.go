package pgproto3

import (
	"encoding/hex"
	"encoding/json"
)

type CopyData struct {
	Data []byte
}

// Backend identifies this message as sendable by the PostgreSQL backend.
func (*CopyData) Backend() {}

// Frontend identifies this message as sendable by a PostgreSQL frontend.
func (*CopyData) Frontend() {}

// Decode decodes src into dst. src must contain the complete message with the exception of the initial 1 byte message
// type identifier and 4 byte message length.
func (dst *CopyData) Decode(src []byte) error {
	dst.Data = src
	return nil
}

// Encode encodes src into dst. dst will include the 1 byte message type identifier and the 4 byte message length.
func (src *CopyData) Encode(dst []byte) ([]byte, error) {
	dst, sp := beginMessage(dst, 'd')
	dst = append(dst, src.Data...)
	return finishMessage(dst, sp)
}

// MarshalJSON implements encoding/json.Marshaler.
func (src CopyData) MarshalJSON() ([]byte, error) {
	return json.Marshal(struct {
		Type string
		Data string
	}{
		Type: "CopyData",
		Data: hex.EncodeToString(src.Data),
	})
}

// UnmarshalJSON implements encoding/json.Unmarshaler.
func (dst *CopyData) UnmarshalJSON(data []byte) error {
	// Ignore null, like in the main JSON package.
	if string(data) == "null" {
		return nil
	}

	var msg struct {
		Data string
	}
	if err := json.Unmarshal(data, &msg); err != nil {
		return err
	}

	dst.Data = []byte(msg.Data)
	return nil
}
