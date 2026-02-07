package pgproto3

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"errors"
	"math"

	"github.com/jackc/pgx/v5/internal/pgio"
)

type CopyOutResponse struct {
	OverallFormat     byte
	ColumnFormatCodes []uint16
}

func (*CopyOutResponse) Backend() {}

// Decode decodes src into dst. src must contain the complete message with the exception of the initial 1 byte message
// type identifier and 4 byte message length.
func (dst *CopyOutResponse) Decode(src []byte) error {
	buf := bytes.NewBuffer(src)

	if buf.Len() < 3 {
		return &invalidMessageFormatErr{messageType: "CopyOutResponse"}
	}

	overallFormat := buf.Next(1)[0]

	columnCount := int(binary.BigEndian.Uint16(buf.Next(2)))
	if buf.Len() != columnCount*2 {
		return &invalidMessageFormatErr{messageType: "CopyOutResponse"}
	}

	columnFormatCodes := make([]uint16, columnCount)
	for i := 0; i < columnCount; i++ {
		columnFormatCodes[i] = binary.BigEndian.Uint16(buf.Next(2))
	}

	*dst = CopyOutResponse{OverallFormat: overallFormat, ColumnFormatCodes: columnFormatCodes}

	return nil
}

// Encode encodes src into dst. dst will include the 1 byte message type identifier and the 4 byte message length.
func (src *CopyOutResponse) Encode(dst []byte) ([]byte, error) {
	dst, sp := beginMessage(dst, 'H')

	dst = append(dst, src.OverallFormat)

	if len(src.ColumnFormatCodes) > math.MaxUint16 {
		return nil, errors.New("too many column format codes")
	}
	dst = pgio.AppendUint16(dst, uint16(len(src.ColumnFormatCodes)))
	for _, fc := range src.ColumnFormatCodes {
		dst = pgio.AppendUint16(dst, fc)
	}

	return finishMessage(dst, sp)
}

// MarshalJSON implements encoding/json.Marshaler.
func (src CopyOutResponse) MarshalJSON() ([]byte, error) {
	return json.Marshal(struct {
		Type              string
		ColumnFormatCodes []uint16
	}{
		Type:              "CopyOutResponse",
		ColumnFormatCodes: src.ColumnFormatCodes,
	})
}

// UnmarshalJSON implements encoding/json.Unmarshaler.
func (dst *CopyOutResponse) UnmarshalJSON(data []byte) error {
	// Ignore null, like in the main JSON package.
	if string(data) == "null" {
		return nil
	}

	var msg struct {
		OverallFormat     string
		ColumnFormatCodes []uint16
	}
	if err := json.Unmarshal(data, &msg); err != nil {
		return err
	}

	if len(msg.OverallFormat) != 1 {
		return errors.New("invalid length for CopyOutResponse.OverallFormat")
	}

	dst.OverallFormat = msg.OverallFormat[0]
	dst.ColumnFormatCodes = msg.ColumnFormatCodes
	return nil
}
