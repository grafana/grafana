package pgtype

import (
	"database/sql/driver"
	"encoding/binary"
	"fmt"
	"math"
	"strconv"

	"github.com/jackc/pgx/v5/internal/pgio"
)

type Uint64Scanner interface {
	ScanUint64(v Uint64) error
}

type Uint64Valuer interface {
	Uint64Value() (Uint64, error)
}

// Uint64 is the core type that is used to represent PostgreSQL types such as XID8.
type Uint64 struct {
	Uint64 uint64
	Valid  bool
}

// ScanUint64 implements the [Uint64Scanner] interface.
func (n *Uint64) ScanUint64(v Uint64) error {
	*n = v
	return nil
}

// Uint64Value implements the [Uint64Valuer] interface.
func (n Uint64) Uint64Value() (Uint64, error) {
	return n, nil
}

// Scan implements the [database/sql.Scanner] interface.
func (dst *Uint64) Scan(src any) error {
	if src == nil {
		*dst = Uint64{}
		return nil
	}

	var n uint64

	switch src := src.(type) {
	case int64:
		if src < 0 {
			return fmt.Errorf("%d is less than the minimum value for Uint64", src)
		}
		n = uint64(src)
	case string:
		un, err := strconv.ParseUint(src, 10, 64)
		if err != nil {
			return err
		}
		n = un
	default:
		return fmt.Errorf("cannot scan %T", src)
	}

	*dst = Uint64{Uint64: n, Valid: true}

	return nil
}

// Value implements the [database/sql/driver.Valuer] interface.
func (src Uint64) Value() (driver.Value, error) {
	if !src.Valid {
		return nil, nil
	}

	// If the value is greater than the maximum value for int64, return it as a string instead of losing data or returning
	// an error.
	if src.Uint64 > math.MaxInt64 {
		return strconv.FormatUint(src.Uint64, 10), nil
	}

	return int64(src.Uint64), nil
}

type Uint64Codec struct{}

func (Uint64Codec) FormatSupported(format int16) bool {
	return format == TextFormatCode || format == BinaryFormatCode
}

func (Uint64Codec) PreferredFormat() int16 {
	return BinaryFormatCode
}

func (Uint64Codec) PlanEncode(m *Map, oid uint32, format int16, value any) EncodePlan {
	switch format {
	case BinaryFormatCode:
		switch value.(type) {
		case uint64:
			return encodePlanUint64CodecBinaryUint64{}
		case Uint64Valuer:
			return encodePlanUint64CodecBinaryUint64Valuer{}
		case Int64Valuer:
			return encodePlanUint64CodecBinaryInt64Valuer{}
		}
	case TextFormatCode:
		switch value.(type) {
		case uint64:
			return encodePlanUint64CodecTextUint64{}
		case Int64Valuer:
			return encodePlanUint64CodecTextInt64Valuer{}
		}
	}

	return nil
}

type encodePlanUint64CodecBinaryUint64 struct{}

func (encodePlanUint64CodecBinaryUint64) Encode(value any, buf []byte) (newBuf []byte, err error) {
	v := value.(uint64)
	return pgio.AppendUint64(buf, v), nil
}

type encodePlanUint64CodecBinaryUint64Valuer struct{}

func (encodePlanUint64CodecBinaryUint64Valuer) Encode(value any, buf []byte) (newBuf []byte, err error) {
	v, err := value.(Uint64Valuer).Uint64Value()
	if err != nil {
		return nil, err
	}

	if !v.Valid {
		return nil, nil
	}

	return pgio.AppendUint64(buf, v.Uint64), nil
}

type encodePlanUint64CodecBinaryInt64Valuer struct{}

func (encodePlanUint64CodecBinaryInt64Valuer) Encode(value any, buf []byte) (newBuf []byte, err error) {
	v, err := value.(Int64Valuer).Int64Value()
	if err != nil {
		return nil, err
	}

	if !v.Valid {
		return nil, nil
	}

	if v.Int64 < 0 {
		return nil, fmt.Errorf("%d is less than minimum value for uint64", v.Int64)
	}

	return pgio.AppendUint64(buf, uint64(v.Int64)), nil
}

type encodePlanUint64CodecTextUint64 struct{}

func (encodePlanUint64CodecTextUint64) Encode(value any, buf []byte) (newBuf []byte, err error) {
	v := value.(uint64)
	return append(buf, strconv.FormatUint(uint64(v), 10)...), nil
}

type encodePlanUint64CodecTextUint64Valuer struct{}

func (encodePlanUint64CodecTextUint64Valuer) Encode(value any, buf []byte) (newBuf []byte, err error) {
	v, err := value.(Uint64Valuer).Uint64Value()
	if err != nil {
		return nil, err
	}

	if !v.Valid {
		return nil, nil
	}

	return append(buf, strconv.FormatUint(v.Uint64, 10)...), nil
}

type encodePlanUint64CodecTextInt64Valuer struct{}

func (encodePlanUint64CodecTextInt64Valuer) Encode(value any, buf []byte) (newBuf []byte, err error) {
	v, err := value.(Int64Valuer).Int64Value()
	if err != nil {
		return nil, err
	}

	if !v.Valid {
		return nil, nil
	}

	if v.Int64 < 0 {
		return nil, fmt.Errorf("%d is less than minimum value for uint64", v.Int64)
	}

	return append(buf, strconv.FormatInt(v.Int64, 10)...), nil
}

func (Uint64Codec) PlanScan(m *Map, oid uint32, format int16, target any) ScanPlan {
	switch format {
	case BinaryFormatCode:
		switch target.(type) {
		case *uint64:
			return scanPlanBinaryUint64ToUint64{}
		case Uint64Scanner:
			return scanPlanBinaryUint64ToUint64Scanner{}
		case TextScanner:
			return scanPlanBinaryUint64ToTextScanner{}
		}
	case TextFormatCode:
		switch target.(type) {
		case *uint64:
			return scanPlanTextAnyToUint64{}
		case Uint64Scanner:
			return scanPlanTextAnyToUint64Scanner{}
		}
	}

	return nil
}

func (c Uint64Codec) DecodeDatabaseSQLValue(m *Map, oid uint32, format int16, src []byte) (driver.Value, error) {
	if src == nil {
		return nil, nil
	}

	var n uint64
	err := codecScan(c, m, oid, format, src, &n)
	if err != nil {
		return nil, err
	}
	return int64(n), nil
}

func (c Uint64Codec) DecodeValue(m *Map, oid uint32, format int16, src []byte) (any, error) {
	if src == nil {
		return nil, nil
	}

	var n uint64
	err := codecScan(c, m, oid, format, src, &n)
	if err != nil {
		return nil, err
	}
	return n, nil
}

type scanPlanBinaryUint64ToUint64 struct{}

func (scanPlanBinaryUint64ToUint64) Scan(src []byte, dst any) error {
	if src == nil {
		return fmt.Errorf("cannot scan NULL into %T", dst)
	}

	if len(src) != 8 {
		return fmt.Errorf("invalid length for uint64: %v", len(src))
	}

	p := (dst).(*uint64)
	*p = binary.BigEndian.Uint64(src)

	return nil
}

type scanPlanBinaryUint64ToUint64Scanner struct{}

func (scanPlanBinaryUint64ToUint64Scanner) Scan(src []byte, dst any) error {
	s, ok := (dst).(Uint64Scanner)
	if !ok {
		return ErrScanTargetTypeChanged
	}

	if src == nil {
		return s.ScanUint64(Uint64{})
	}

	if len(src) != 8 {
		return fmt.Errorf("invalid length for uint64: %v", len(src))
	}

	n := binary.BigEndian.Uint64(src)

	return s.ScanUint64(Uint64{Uint64: n, Valid: true})
}

type scanPlanBinaryUint64ToTextScanner struct{}

func (scanPlanBinaryUint64ToTextScanner) Scan(src []byte, dst any) error {
	s, ok := (dst).(TextScanner)
	if !ok {
		return ErrScanTargetTypeChanged
	}

	if src == nil {
		return s.ScanText(Text{})
	}

	if len(src) != 8 {
		return fmt.Errorf("invalid length for uint64: %v", len(src))
	}

	n := uint64(binary.BigEndian.Uint64(src))
	return s.ScanText(Text{String: strconv.FormatUint(n, 10), Valid: true})
}

type scanPlanTextAnyToUint64Scanner struct{}

func (scanPlanTextAnyToUint64Scanner) Scan(src []byte, dst any) error {
	s, ok := (dst).(Uint64Scanner)
	if !ok {
		return ErrScanTargetTypeChanged
	}

	if src == nil {
		return s.ScanUint64(Uint64{})
	}

	n, err := strconv.ParseUint(string(src), 10, 64)
	if err != nil {
		return err
	}

	return s.ScanUint64(Uint64{Uint64: n, Valid: true})
}
