package pgproto3

import (
	"encoding/binary"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5/internal/pgio"
)

const sslRequestNumber = 80877103

type SSLRequest struct{}

// Frontend identifies this message as sendable by a PostgreSQL frontend.
func (*SSLRequest) Frontend() {}

func (dst *SSLRequest) Decode(src []byte) error {
	if len(src) < 4 {
		return errors.New("ssl request too short")
	}

	requestCode := binary.BigEndian.Uint32(src)

	if requestCode != sslRequestNumber {
		return errors.New("bad ssl request code")
	}

	return nil
}

// Encode encodes src into dst. dst will include the 4 byte message length.
func (src *SSLRequest) Encode(dst []byte) ([]byte, error) {
	dst = pgio.AppendInt32(dst, 8)
	dst = pgio.AppendInt32(dst, sslRequestNumber)
	return dst, nil
}

// MarshalJSON implements encoding/json.Marshaler.
func (src SSLRequest) MarshalJSON() ([]byte, error) {
	return json.Marshal(struct {
		Type            string
		ProtocolVersion uint32
		Parameters      map[string]string
	}{
		Type: "SSLRequest",
	})
}
