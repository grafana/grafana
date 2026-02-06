package pgproto3

import (
	"encoding/binary"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5/internal/pgio"
)

const cancelRequestCode = 80877102

type CancelRequest struct {
	ProcessID uint32
	SecretKey uint32
}

// Frontend identifies this message as sendable by a PostgreSQL frontend.
func (*CancelRequest) Frontend() {}

func (dst *CancelRequest) Decode(src []byte) error {
	if len(src) != 12 {
		return errors.New("bad cancel request size")
	}

	requestCode := binary.BigEndian.Uint32(src)

	if requestCode != cancelRequestCode {
		return errors.New("bad cancel request code")
	}

	dst.ProcessID = binary.BigEndian.Uint32(src[4:])
	dst.SecretKey = binary.BigEndian.Uint32(src[8:])

	return nil
}

// Encode encodes src into dst. dst will include the 4 byte message length.
func (src *CancelRequest) Encode(dst []byte) ([]byte, error) {
	dst = pgio.AppendInt32(dst, 16)
	dst = pgio.AppendInt32(dst, cancelRequestCode)
	dst = pgio.AppendUint32(dst, src.ProcessID)
	dst = pgio.AppendUint32(dst, src.SecretKey)
	return dst, nil
}

// MarshalJSON implements encoding/json.Marshaler.
func (src CancelRequest) MarshalJSON() ([]byte, error) {
	return json.Marshal(struct {
		Type      string
		ProcessID uint32
		SecretKey uint32
	}{
		Type:      "CancelRequest",
		ProcessID: src.ProcessID,
		SecretKey: src.SecretKey,
	})
}
