package pgtype

import (
	"database/sql/driver"
	"encoding/binary"
	"fmt"

	"github.com/jackc/pgx/v5/internal/pgio"
)

type BitsScanner interface {
	ScanBits(v Bits) error
}

type BitsValuer interface {
	BitsValue() (Bits, error)
}

// Bits represents the PostgreSQL bit and varbit types.
type Bits struct {
	Bytes []byte
	Len   int32 // Number of bits
	Valid bool
}

// ScanBits implements the [BitsScanner] interface.
func (b *Bits) ScanBits(v Bits) error {
	*b = v
	return nil
}

// BitsValue implements the [BitsValuer] interface.
func (b Bits) BitsValue() (Bits, error) {
	return b, nil
}

// Scan implements the [database/sql.Scanner] interface.
func (dst *Bits) Scan(src any) error {
	if src == nil {
		*dst = Bits{}
		return nil
	}

	switch src := src.(type) {
	case string:
		return scanPlanTextAnyToBitsScanner{}.Scan([]byte(src), dst)
	}

	return fmt.Errorf("cannot scan %T", src)
}

// Value implements the [database/sql/driver.Valuer] interface.
func (src Bits) Value() (driver.Value, error) {
	if !src.Valid {
		return nil, nil
	}

	buf, err := BitsCodec{}.PlanEncode(nil, 0, TextFormatCode, src).Encode(src, nil)
	if err != nil {
		return nil, err
	}
	return string(buf), err
}

type BitsCodec struct{}

func (BitsCodec) FormatSupported(format int16) bool {
	return format == TextFormatCode || format == BinaryFormatCode
}

func (BitsCodec) PreferredFormat() int16 {
	return BinaryFormatCode
}

func (BitsCodec) PlanEncode(m *Map, oid uint32, format int16, value any) EncodePlan {
	if _, ok := value.(BitsValuer); !ok {
		return nil
	}

	switch format {
	case BinaryFormatCode:
		return encodePlanBitsCodecBinary{}
	case TextFormatCode:
		return encodePlanBitsCodecText{}
	}

	return nil
}

type encodePlanBitsCodecBinary struct{}

func (encodePlanBitsCodecBinary) Encode(value any, buf []byte) (newBuf []byte, err error) {
	bits, err := value.(BitsValuer).BitsValue()
	if err != nil {
		return nil, err
	}

	if !bits.Valid {
		return nil, nil
	}

	buf = pgio.AppendInt32(buf, bits.Len)
	return append(buf, bits.Bytes...), nil
}

type encodePlanBitsCodecText struct{}

func (encodePlanBitsCodecText) Encode(value any, buf []byte) (newBuf []byte, err error) {
	bits, err := value.(BitsValuer).BitsValue()
	if err != nil {
		return nil, err
	}

	if !bits.Valid {
		return nil, nil
	}

	for i := int32(0); i < bits.Len; i++ {
		byteIdx := i / 8
		bitMask := byte(128 >> byte(i%8))
		char := byte('0')
		if bits.Bytes[byteIdx]&bitMask > 0 {
			char = '1'
		}
		buf = append(buf, char)
	}

	return buf, nil
}

func (BitsCodec) PlanScan(m *Map, oid uint32, format int16, target any) ScanPlan {
	switch format {
	case BinaryFormatCode:
		switch target.(type) {
		case BitsScanner:
			return scanPlanBinaryBitsToBitsScanner{}
		}
	case TextFormatCode:
		switch target.(type) {
		case BitsScanner:
			return scanPlanTextAnyToBitsScanner{}
		}
	}

	return nil
}

func (c BitsCodec) DecodeDatabaseSQLValue(m *Map, oid uint32, format int16, src []byte) (driver.Value, error) {
	return codecDecodeToTextFormat(c, m, oid, format, src)
}

func (c BitsCodec) DecodeValue(m *Map, oid uint32, format int16, src []byte) (any, error) {
	if src == nil {
		return nil, nil
	}

	var box Bits
	err := codecScan(c, m, oid, format, src, &box)
	if err != nil {
		return nil, err
	}
	return box, nil
}

type scanPlanBinaryBitsToBitsScanner struct{}

func (scanPlanBinaryBitsToBitsScanner) Scan(src []byte, dst any) error {
	scanner := (dst).(BitsScanner)

	if src == nil {
		return scanner.ScanBits(Bits{})
	}

	if len(src) < 4 {
		return fmt.Errorf("invalid length for bit/varbit: %v", len(src))
	}

	bitLen := int32(binary.BigEndian.Uint32(src))
	rp := 4
	buf := make([]byte, len(src[rp:]))
	copy(buf, src[rp:])

	return scanner.ScanBits(Bits{Bytes: buf, Len: bitLen, Valid: true})
}

type scanPlanTextAnyToBitsScanner struct{}

func (scanPlanTextAnyToBitsScanner) Scan(src []byte, dst any) error {
	scanner := (dst).(BitsScanner)

	if src == nil {
		return scanner.ScanBits(Bits{})
	}

	bitLen := len(src)
	byteLen := bitLen / 8
	if bitLen%8 > 0 {
		byteLen++
	}
	buf := make([]byte, byteLen)

	for i, b := range src {
		if b == '1' {
			byteIdx := i / 8
			bitIdx := uint(i % 8)
			buf[byteIdx] = buf[byteIdx] | (128 >> bitIdx)
		}
	}

	return scanner.ScanBits(Bits{Bytes: buf, Len: int32(bitLen), Valid: true})
}
