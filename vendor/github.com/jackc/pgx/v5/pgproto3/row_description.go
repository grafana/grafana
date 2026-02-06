package pgproto3

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"errors"
	"math"

	"github.com/jackc/pgx/v5/internal/pgio"
)

const (
	TextFormat   = 0
	BinaryFormat = 1
)

type FieldDescription struct {
	Name                 []byte
	TableOID             uint32
	TableAttributeNumber uint16
	DataTypeOID          uint32
	DataTypeSize         int16
	TypeModifier         int32
	Format               int16
}

// MarshalJSON implements encoding/json.Marshaler.
func (fd FieldDescription) MarshalJSON() ([]byte, error) {
	return json.Marshal(struct {
		Name                 string
		TableOID             uint32
		TableAttributeNumber uint16
		DataTypeOID          uint32
		DataTypeSize         int16
		TypeModifier         int32
		Format               int16
	}{
		Name:                 string(fd.Name),
		TableOID:             fd.TableOID,
		TableAttributeNumber: fd.TableAttributeNumber,
		DataTypeOID:          fd.DataTypeOID,
		DataTypeSize:         fd.DataTypeSize,
		TypeModifier:         fd.TypeModifier,
		Format:               fd.Format,
	})
}

type RowDescription struct {
	Fields []FieldDescription
}

// Backend identifies this message as sendable by the PostgreSQL backend.
func (*RowDescription) Backend() {}

// Decode decodes src into dst. src must contain the complete message with the exception of the initial 1 byte message
// type identifier and 4 byte message length.
func (dst *RowDescription) Decode(src []byte) error {
	if len(src) < 2 {
		return &invalidMessageFormatErr{messageType: "RowDescription"}
	}
	fieldCount := int(binary.BigEndian.Uint16(src))
	rp := 2

	dst.Fields = dst.Fields[0:0]

	for i := 0; i < fieldCount; i++ {
		var fd FieldDescription

		idx := bytes.IndexByte(src[rp:], 0)
		if idx < 0 {
			return &invalidMessageFormatErr{messageType: "RowDescription"}
		}
		fd.Name = src[rp : rp+idx]
		rp += idx + 1

		// Since buf.Next() doesn't return an error if we hit the end of the buffer
		// check Len ahead of time
		if len(src[rp:]) < 18 {
			return &invalidMessageFormatErr{messageType: "RowDescription"}
		}

		fd.TableOID = binary.BigEndian.Uint32(src[rp:])
		rp += 4
		fd.TableAttributeNumber = binary.BigEndian.Uint16(src[rp:])
		rp += 2
		fd.DataTypeOID = binary.BigEndian.Uint32(src[rp:])
		rp += 4
		fd.DataTypeSize = int16(binary.BigEndian.Uint16(src[rp:]))
		rp += 2
		fd.TypeModifier = int32(binary.BigEndian.Uint32(src[rp:]))
		rp += 4
		fd.Format = int16(binary.BigEndian.Uint16(src[rp:]))
		rp += 2

		dst.Fields = append(dst.Fields, fd)
	}

	return nil
}

// Encode encodes src into dst. dst will include the 1 byte message type identifier and the 4 byte message length.
func (src *RowDescription) Encode(dst []byte) ([]byte, error) {
	dst, sp := beginMessage(dst, 'T')

	if len(src.Fields) > math.MaxUint16 {
		return nil, errors.New("too many fields")
	}
	dst = pgio.AppendUint16(dst, uint16(len(src.Fields)))
	for _, fd := range src.Fields {
		dst = append(dst, fd.Name...)
		dst = append(dst, 0)

		dst = pgio.AppendUint32(dst, fd.TableOID)
		dst = pgio.AppendUint16(dst, fd.TableAttributeNumber)
		dst = pgio.AppendUint32(dst, fd.DataTypeOID)
		dst = pgio.AppendInt16(dst, fd.DataTypeSize)
		dst = pgio.AppendInt32(dst, fd.TypeModifier)
		dst = pgio.AppendInt16(dst, fd.Format)
	}

	return finishMessage(dst, sp)
}

// MarshalJSON implements encoding/json.Marshaler.
func (src RowDescription) MarshalJSON() ([]byte, error) {
	return json.Marshal(struct {
		Type   string
		Fields []FieldDescription
	}{
		Type:   "RowDescription",
		Fields: src.Fields,
	})
}

// UnmarshalJSON implements encoding/json.Unmarshaler.
func (dst *RowDescription) UnmarshalJSON(data []byte) error {
	var msg struct {
		Fields []struct {
			Name                 string
			TableOID             uint32
			TableAttributeNumber uint16
			DataTypeOID          uint32
			DataTypeSize         int16
			TypeModifier         int32
			Format               int16
		}
	}
	if err := json.Unmarshal(data, &msg); err != nil {
		return err
	}
	dst.Fields = make([]FieldDescription, len(msg.Fields))
	for n, field := range msg.Fields {
		dst.Fields[n] = FieldDescription{
			Name:                 []byte(field.Name),
			TableOID:             field.TableOID,
			TableAttributeNumber: field.TableAttributeNumber,
			DataTypeOID:          field.DataTypeOID,
			DataTypeSize:         field.DataTypeSize,
			TypeModifier:         field.TypeModifier,
			Format:               field.Format,
		}
	}
	return nil
}
