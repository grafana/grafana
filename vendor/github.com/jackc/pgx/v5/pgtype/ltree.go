package pgtype

import (
	"database/sql/driver"
	"fmt"
)

type LtreeCodec struct{}

func (l LtreeCodec) FormatSupported(format int16) bool {
	return format == TextFormatCode || format == BinaryFormatCode
}

// PreferredFormat returns the preferred format.
func (l LtreeCodec) PreferredFormat() int16 {
	return TextFormatCode
}

// PlanEncode returns an EncodePlan for encoding value into PostgreSQL format for oid and format. If no plan can be
// found then nil is returned.
func (l LtreeCodec) PlanEncode(m *Map, oid uint32, format int16, value any) EncodePlan {
	switch format {
	case TextFormatCode:
		return (TextCodec)(l).PlanEncode(m, oid, format, value)
	case BinaryFormatCode:
		switch value.(type) {
		case string:
			return encodeLtreeCodecBinaryString{}
		case []byte:
			return encodeLtreeCodecBinaryByteSlice{}
		case TextValuer:
			return encodeLtreeCodecBinaryTextValuer{}
		}
	}

	return nil
}

type encodeLtreeCodecBinaryString struct{}

func (encodeLtreeCodecBinaryString) Encode(value any, buf []byte) (newBuf []byte, err error) {
	ltree := value.(string)
	buf = append(buf, 1)
	return append(buf, ltree...), nil
}

type encodeLtreeCodecBinaryByteSlice struct{}

func (encodeLtreeCodecBinaryByteSlice) Encode(value any, buf []byte) (newBuf []byte, err error) {
	ltree := value.([]byte)
	buf = append(buf, 1)
	return append(buf, ltree...), nil
}

type encodeLtreeCodecBinaryTextValuer struct{}

func (encodeLtreeCodecBinaryTextValuer) Encode(value any, buf []byte) (newBuf []byte, err error) {
	t, err := value.(TextValuer).TextValue()
	if err != nil {
		return nil, err
	}
	if !t.Valid {
		return nil, nil
	}

	buf = append(buf, 1)
	return append(buf, t.String...), nil
}

// PlanScan returns a ScanPlan for scanning a PostgreSQL value into a destination with the same type as target. If
// no plan can be found then nil is returned.
func (l LtreeCodec) PlanScan(m *Map, oid uint32, format int16, target any) ScanPlan {
	switch format {
	case TextFormatCode:
		return (TextCodec)(l).PlanScan(m, oid, format, target)
	case BinaryFormatCode:
		switch target.(type) {
		case *string:
			return scanPlanBinaryLtreeToString{}
		case TextScanner:
			return scanPlanBinaryLtreeToTextScanner{}
		}
	}

	return nil
}

type scanPlanBinaryLtreeToString struct{}

func (scanPlanBinaryLtreeToString) Scan(src []byte, target any) error {
	version := src[0]
	if version != 1 {
		return fmt.Errorf("unsupported ltree version %d", version)
	}

	p := (target).(*string)
	*p = string(src[1:])

	return nil
}

type scanPlanBinaryLtreeToTextScanner struct{}

func (scanPlanBinaryLtreeToTextScanner) Scan(src []byte, target any) error {
	version := src[0]
	if version != 1 {
		return fmt.Errorf("unsupported ltree version %d", version)
	}

	scanner := (target).(TextScanner)
	return scanner.ScanText(Text{String: string(src[1:]), Valid: true})
}

// DecodeDatabaseSQLValue returns src decoded into a value compatible with the sql.Scanner interface.
func (l LtreeCodec) DecodeDatabaseSQLValue(m *Map, oid uint32, format int16, src []byte) (driver.Value, error) {
	return (TextCodec)(l).DecodeDatabaseSQLValue(m, oid, format, src)
}

// DecodeValue returns src decoded into its default format.
func (l LtreeCodec) DecodeValue(m *Map, oid uint32, format int16, src []byte) (any, error) {
	return (TextCodec)(l).DecodeValue(m, oid, format, src)
}
