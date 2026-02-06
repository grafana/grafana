package pgproto3

import (
	"encoding/json"
)

type GSSResponse struct {
	Data []byte
}

// Frontend identifies this message as sendable by a PostgreSQL frontend.
func (g *GSSResponse) Frontend() {}

func (g *GSSResponse) Decode(data []byte) error {
	g.Data = data
	return nil
}

func (g *GSSResponse) Encode(dst []byte) ([]byte, error) {
	dst, sp := beginMessage(dst, 'p')
	dst = append(dst, g.Data...)
	return finishMessage(dst, sp)
}

// MarshalJSON implements encoding/json.Marshaler.
func (g *GSSResponse) MarshalJSON() ([]byte, error) {
	return json.Marshal(struct {
		Type string
		Data []byte
	}{
		Type: "GSSResponse",
		Data: g.Data,
	})
}

// UnmarshalJSON implements encoding/json.Unmarshaler.
func (g *GSSResponse) UnmarshalJSON(data []byte) error {
	var msg struct {
		Data []byte
	}
	if err := json.Unmarshal(data, &msg); err != nil {
		return err
	}
	g.Data = msg.Data
	return nil
}
