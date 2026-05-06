package pgproto3

import (
	"encoding/binary"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5/internal/pgio"
)

const gssEncReqNumber = 80877104

type GSSEncRequest struct{}

// Frontend identifies this message as sendable by a PostgreSQL frontend.
func (*GSSEncRequest) Frontend() {}

func (dst *GSSEncRequest) Decode(src []byte) error {
	if len(src) < 4 {
		return errors.New("gss encoding request too short")
	}

	requestCode := binary.BigEndian.Uint32(src)

	if requestCode != gssEncReqNumber {
		return errors.New("bad gss encoding request code")
	}

	return nil
}

// Encode encodes src into dst. dst will include the 4 byte message length.
func (src *GSSEncRequest) Encode(dst []byte) ([]byte, error) {
	dst = pgio.AppendInt32(dst, 8)
	dst = pgio.AppendInt32(dst, gssEncReqNumber)
	return dst, nil
}

// MarshalJSON implements encoding/json.Marshaler.
func (src GSSEncRequest) MarshalJSON() ([]byte, error) {
	return json.Marshal(struct {
		Type            string
		ProtocolVersion uint32
		Parameters      map[string]string
	}{
		Type: "GSSEncRequest",
	})
}
