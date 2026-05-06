package pgproto3

import (
	"bytes"
	"encoding/json"
)

type CommandComplete struct {
	CommandTag []byte
}

// Backend identifies this message as sendable by the PostgreSQL backend.
func (*CommandComplete) Backend() {}

// Decode decodes src into dst. src must contain the complete message with the exception of the initial 1 byte message
// type identifier and 4 byte message length.
func (dst *CommandComplete) Decode(src []byte) error {
	idx := bytes.IndexByte(src, 0)
	if idx == -1 {
		return &invalidMessageFormatErr{messageType: "CommandComplete", details: "unterminated string"}
	}
	if idx != len(src)-1 {
		return &invalidMessageFormatErr{messageType: "CommandComplete", details: "string terminated too early"}
	}

	dst.CommandTag = src[:idx]

	return nil
}

// Encode encodes src into dst. dst will include the 1 byte message type identifier and the 4 byte message length.
func (src *CommandComplete) Encode(dst []byte) ([]byte, error) {
	dst, sp := beginMessage(dst, 'C')
	dst = append(dst, src.CommandTag...)
	dst = append(dst, 0)
	return finishMessage(dst, sp)
}

// MarshalJSON implements encoding/json.Marshaler.
func (src CommandComplete) MarshalJSON() ([]byte, error) {
	return json.Marshal(struct {
		Type       string
		CommandTag string
	}{
		Type:       "CommandComplete",
		CommandTag: string(src.CommandTag),
	})
}

// UnmarshalJSON implements encoding/json.Unmarshaler.
func (dst *CommandComplete) UnmarshalJSON(data []byte) error {
	// Ignore null, like in the main JSON package.
	if string(data) == "null" {
		return nil
	}

	var msg struct {
		CommandTag string
	}
	if err := json.Unmarshal(data, &msg); err != nil {
		return err
	}

	dst.CommandTag = []byte(msg.CommandTag)
	return nil
}
