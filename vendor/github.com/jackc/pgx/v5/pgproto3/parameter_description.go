package pgproto3

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"errors"
	"math"

	"github.com/jackc/pgx/v5/internal/pgio"
)

type ParameterDescription struct {
	ParameterOIDs []uint32
}

// Backend identifies this message as sendable by the PostgreSQL backend.
func (*ParameterDescription) Backend() {}

// Decode decodes src into dst. src must contain the complete message with the exception of the initial 1 byte message
// type identifier and 4 byte message length.
func (dst *ParameterDescription) Decode(src []byte) error {
	buf := bytes.NewBuffer(src)

	if buf.Len() < 2 {
		return &invalidMessageFormatErr{messageType: "ParameterDescription"}
	}

	// Reported parameter count will be incorrect when number of args is greater than uint16
	buf.Next(2)
	// Instead infer parameter count by remaining size of message
	parameterCount := buf.Len() / 4

	*dst = ParameterDescription{ParameterOIDs: make([]uint32, parameterCount)}

	for i := range parameterCount {
		dst.ParameterOIDs[i] = binary.BigEndian.Uint32(buf.Next(4))
	}

	return nil
}

// Encode encodes src into dst. dst will include the 1 byte message type identifier and the 4 byte message length.
func (src *ParameterDescription) Encode(dst []byte) ([]byte, error) {
	dst, sp := beginMessage(dst, 't')

	if len(src.ParameterOIDs) > math.MaxUint16 {
		return nil, errors.New("too many parameter oids")
	}
	dst = pgio.AppendUint16(dst, uint16(len(src.ParameterOIDs)))
	for _, oid := range src.ParameterOIDs {
		dst = pgio.AppendUint32(dst, oid)
	}

	return finishMessage(dst, sp)
}

// MarshalJSON implements encoding/json.Marshaler.
func (src ParameterDescription) MarshalJSON() ([]byte, error) {
	return json.Marshal(struct {
		Type          string
		ParameterOIDs []uint32
	}{
		Type:          "ParameterDescription",
		ParameterOIDs: src.ParameterOIDs,
	})
}
