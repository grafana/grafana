package pgtype

import (
	"database/sql/driver"
	"fmt"
	"math"
)

// QCharCodec is for PostgreSQL's special 8-bit-only "char" type more akin to the C
// language's char type, or Go's byte type. (Note that the name in PostgreSQL
// itself is "char", in double-quotes, and not char.) It gets used a lot in
// PostgreSQL's system tables to hold a single ASCII character value (eg
// pg_class.relkind). It is named Qchar for quoted char to disambiguate from SQL
// standard type char.
type QCharCodec struct{}

func (QCharCodec) FormatSupported(format int16) bool {
	return format == TextFormatCode || format == BinaryFormatCode
}

func (QCharCodec) PreferredFormat() int16 {
	return BinaryFormatCode
}

func (QCharCodec) PlanEncode(m *Map, oid uint32, format int16, value any) EncodePlan {
	switch format {
	case TextFormatCode, BinaryFormatCode:
		switch value.(type) {
		case byte:
			return encodePlanQcharCodecByte{}
		case rune:
			return encodePlanQcharCodecRune{}
		}
	}

	return nil
}

type encodePlanQcharCodecByte struct{}

func (encodePlanQcharCodecByte) Encode(value any, buf []byte) (newBuf []byte, err error) {
	b := value.(byte)
	buf = append(buf, b)
	return buf, nil
}

type encodePlanQcharCodecRune struct{}

func (encodePlanQcharCodecRune) Encode(value any, buf []byte) (newBuf []byte, err error) {
	r := value.(rune)
	if r > math.MaxUint8 {
		return nil, fmt.Errorf(`%v cannot be encoded to "char"`, r)
	}
	b := byte(r)
	buf = append(buf, b)
	return buf, nil
}

func (QCharCodec) PlanScan(m *Map, oid uint32, format int16, target any) ScanPlan {
	switch format {
	case TextFormatCode, BinaryFormatCode:
		switch target.(type) {
		case *byte:
			return scanPlanQcharCodecByte{}
		case *rune:
			return scanPlanQcharCodecRune{}
		}
	}

	return nil
}

type scanPlanQcharCodecByte struct{}

func (scanPlanQcharCodecByte) Scan(src []byte, dst any) error {
	if src == nil {
		return fmt.Errorf("cannot scan NULL into %T", dst)
	}

	if len(src) > 1 {
		return fmt.Errorf(`invalid length for "char": %v`, len(src))
	}

	b := dst.(*byte)
	// In the text format the zero value is returned as a zero byte value instead of 0
	if len(src) == 0 {
		*b = 0
	} else {
		*b = src[0]
	}

	return nil
}

type scanPlanQcharCodecRune struct{}

func (scanPlanQcharCodecRune) Scan(src []byte, dst any) error {
	if src == nil {
		return fmt.Errorf("cannot scan NULL into %T", dst)
	}

	if len(src) > 1 {
		return fmt.Errorf(`invalid length for "char": %v`, len(src))
	}

	r := dst.(*rune)
	// In the text format the zero value is returned as a zero byte value instead of 0
	if len(src) == 0 {
		*r = 0
	} else {
		*r = rune(src[0])
	}

	return nil
}

func (c QCharCodec) DecodeDatabaseSQLValue(m *Map, oid uint32, format int16, src []byte) (driver.Value, error) {
	if src == nil {
		return nil, nil
	}

	var r rune
	err := codecScan(c, m, oid, format, src, &r)
	if err != nil {
		return nil, err
	}
	return string(r), nil
}

func (c QCharCodec) DecodeValue(m *Map, oid uint32, format int16, src []byte) (any, error) {
	if src == nil {
		return nil, nil
	}

	var r rune
	err := codecScan(c, m, oid, format, src, &r)
	if err != nil {
		return nil, err
	}
	return r, nil
}
