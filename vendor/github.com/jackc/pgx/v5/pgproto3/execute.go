package pgproto3

import (
	"bytes"
	"encoding/binary"
	"encoding/json"

	"github.com/jackc/pgx/v5/internal/pgio"
)

type Execute struct {
	Portal  string
	MaxRows uint32
}

// Frontend identifies this message as sendable by a PostgreSQL frontend.
func (*Execute) Frontend() {}

// Decode decodes src into dst. src must contain the complete message with the exception of the initial 1 byte message
// type identifier and 4 byte message length.
func (dst *Execute) Decode(src []byte) error {
	buf := bytes.NewBuffer(src)

	b, err := buf.ReadBytes(0)
	if err != nil {
		return err
	}
	dst.Portal = string(b[:len(b)-1])

	if buf.Len() < 4 {
		return &invalidMessageFormatErr{messageType: "Execute"}
	}
	dst.MaxRows = binary.BigEndian.Uint32(buf.Next(4))

	return nil
}

// Encode encodes src into dst. dst will include the 1 byte message type identifier and the 4 byte message length.
func (src *Execute) Encode(dst []byte) ([]byte, error) {
	dst, sp := beginMessage(dst, 'E')
	dst = append(dst, src.Portal...)
	dst = append(dst, 0)
	dst = pgio.AppendUint32(dst, src.MaxRows)
	return finishMessage(dst, sp)
}

// MarshalJSON implements encoding/json.Marshaler.
func (src Execute) MarshalJSON() ([]byte, error) {
	return json.Marshal(struct {
		Type    string
		Portal  string
		MaxRows uint32
	}{
		Type:    "Execute",
		Portal:  src.Portal,
		MaxRows: src.MaxRows,
	})
}
