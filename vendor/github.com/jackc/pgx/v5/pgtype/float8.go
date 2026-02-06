package pgtype

import (
	"database/sql/driver"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"math"
	"strconv"

	"github.com/jackc/pgx/v5/internal/pgio"
)

type Float64Scanner interface {
	ScanFloat64(Float8) error
}

type Float64Valuer interface {
	Float64Value() (Float8, error)
}

type Float8 struct {
	Float64 float64
	Valid   bool
}

// ScanFloat64 implements the [Float64Scanner] interface.
func (f *Float8) ScanFloat64(n Float8) error {
	*f = n
	return nil
}

// Float64Value implements the [Float64Valuer] interface.
func (f Float8) Float64Value() (Float8, error) {
	return f, nil
}

// ScanInt64 implements the [Int64Scanner] interface.
func (f *Float8) ScanInt64(n Int8) error {
	*f = Float8{Float64: float64(n.Int64), Valid: n.Valid}
	return nil
}

// Int64Value implements the [Int64Valuer] interface.
func (f Float8) Int64Value() (Int8, error) {
	return Int8{Int64: int64(f.Float64), Valid: f.Valid}, nil
}

// Scan implements the [database/sql.Scanner] interface.
func (f *Float8) Scan(src any) error {
	if src == nil {
		*f = Float8{}
		return nil
	}

	switch src := src.(type) {
	case float64:
		*f = Float8{Float64: src, Valid: true}
		return nil
	case string:
		n, err := strconv.ParseFloat(string(src), 64)
		if err != nil {
			return err
		}
		*f = Float8{Float64: n, Valid: true}
		return nil
	}

	return fmt.Errorf("cannot scan %T", src)
}

// Value implements the [database/sql/driver.Valuer] interface.
func (f Float8) Value() (driver.Value, error) {
	if !f.Valid {
		return nil, nil
	}
	return f.Float64, nil
}

// MarshalJSON implements the [encoding/json.Marshaler] interface.
func (f Float8) MarshalJSON() ([]byte, error) {
	if !f.Valid {
		return []byte("null"), nil
	}
	return json.Marshal(f.Float64)
}

// UnmarshalJSON implements the [encoding/json.Unmarshaler] interface.
func (f *Float8) UnmarshalJSON(b []byte) error {
	var n *float64
	err := json.Unmarshal(b, &n)
	if err != nil {
		return err
	}

	if n == nil {
		*f = Float8{}
	} else {
		*f = Float8{Float64: *n, Valid: true}
	}

	return nil
}

type Float8Codec struct{}

func (Float8Codec) FormatSupported(format int16) bool {
	return format == TextFormatCode || format == BinaryFormatCode
}

func (Float8Codec) PreferredFormat() int16 {
	return BinaryFormatCode
}

func (Float8Codec) PlanEncode(m *Map, oid uint32, format int16, value any) EncodePlan {
	switch format {
	case BinaryFormatCode:
		switch value.(type) {
		case float64:
			return encodePlanFloat8CodecBinaryFloat64{}
		case Float64Valuer:
			return encodePlanFloat8CodecBinaryFloat64Valuer{}
		case Int64Valuer:
			return encodePlanFloat8CodecBinaryInt64Valuer{}
		}
	case TextFormatCode:
		switch value.(type) {
		case float64:
			return encodePlanTextFloat64{}
		case Float64Valuer:
			return encodePlanTextFloat64Valuer{}
		case Int64Valuer:
			return encodePlanTextInt64Valuer{}
		}
	}

	return nil
}

type encodePlanFloat8CodecBinaryFloat64 struct{}

func (encodePlanFloat8CodecBinaryFloat64) Encode(value any, buf []byte) (newBuf []byte, err error) {
	n := value.(float64)
	return pgio.AppendUint64(buf, math.Float64bits(n)), nil
}

type encodePlanTextFloat64 struct{}

func (encodePlanTextFloat64) Encode(value any, buf []byte) (newBuf []byte, err error) {
	n := value.(float64)
	return append(buf, strconv.FormatFloat(n, 'f', -1, 64)...), nil
}

type encodePlanFloat8CodecBinaryFloat64Valuer struct{}

func (encodePlanFloat8CodecBinaryFloat64Valuer) Encode(value any, buf []byte) (newBuf []byte, err error) {
	n, err := value.(Float64Valuer).Float64Value()
	if err != nil {
		return nil, err
	}

	if !n.Valid {
		return nil, nil
	}

	return pgio.AppendUint64(buf, math.Float64bits(n.Float64)), nil
}

type encodePlanTextFloat64Valuer struct{}

func (encodePlanTextFloat64Valuer) Encode(value any, buf []byte) (newBuf []byte, err error) {
	n, err := value.(Float64Valuer).Float64Value()
	if err != nil {
		return nil, err
	}

	if !n.Valid {
		return nil, nil
	}

	return append(buf, strconv.FormatFloat(n.Float64, 'f', -1, 64)...), nil
}

type encodePlanFloat8CodecBinaryInt64Valuer struct{}

func (encodePlanFloat8CodecBinaryInt64Valuer) Encode(value any, buf []byte) (newBuf []byte, err error) {
	n, err := value.(Int64Valuer).Int64Value()
	if err != nil {
		return nil, err
	}

	if !n.Valid {
		return nil, nil
	}

	f := float64(n.Int64)
	return pgio.AppendUint64(buf, math.Float64bits(f)), nil
}

type encodePlanTextInt64Valuer struct{}

func (encodePlanTextInt64Valuer) Encode(value any, buf []byte) (newBuf []byte, err error) {
	n, err := value.(Int64Valuer).Int64Value()
	if err != nil {
		return nil, err
	}

	if !n.Valid {
		return nil, nil
	}

	return append(buf, strconv.FormatInt(n.Int64, 10)...), nil
}

func (Float8Codec) PlanScan(m *Map, oid uint32, format int16, target any) ScanPlan {
	switch format {
	case BinaryFormatCode:
		switch target.(type) {
		case *float64:
			return scanPlanBinaryFloat8ToFloat64{}
		case Float64Scanner:
			return scanPlanBinaryFloat8ToFloat64Scanner{}
		case Int64Scanner:
			return scanPlanBinaryFloat8ToInt64Scanner{}
		case TextScanner:
			return scanPlanBinaryFloat8ToTextScanner{}
		}
	case TextFormatCode:
		switch target.(type) {
		case *float64:
			return scanPlanTextAnyToFloat64{}
		case Float64Scanner:
			return scanPlanTextAnyToFloat64Scanner{}
		case Int64Scanner:
			return scanPlanTextAnyToInt64Scanner{}
		}
	}

	return nil
}

type scanPlanBinaryFloat8ToFloat64 struct{}

func (scanPlanBinaryFloat8ToFloat64) Scan(src []byte, dst any) error {
	if src == nil {
		return fmt.Errorf("cannot scan NULL into %T", dst)
	}

	if len(src) != 8 {
		return fmt.Errorf("invalid length for float8: %v", len(src))
	}

	n := int64(binary.BigEndian.Uint64(src))
	f := (dst).(*float64)
	*f = math.Float64frombits(uint64(n))

	return nil
}

type scanPlanBinaryFloat8ToFloat64Scanner struct{}

func (scanPlanBinaryFloat8ToFloat64Scanner) Scan(src []byte, dst any) error {
	s := (dst).(Float64Scanner)

	if src == nil {
		return s.ScanFloat64(Float8{})
	}

	if len(src) != 8 {
		return fmt.Errorf("invalid length for float8: %v", len(src))
	}

	n := int64(binary.BigEndian.Uint64(src))
	return s.ScanFloat64(Float8{Float64: math.Float64frombits(uint64(n)), Valid: true})
}

type scanPlanBinaryFloat8ToInt64Scanner struct{}

func (scanPlanBinaryFloat8ToInt64Scanner) Scan(src []byte, dst any) error {
	s := (dst).(Int64Scanner)

	if src == nil {
		return s.ScanInt64(Int8{})
	}

	if len(src) != 8 {
		return fmt.Errorf("invalid length for float8: %v", len(src))
	}

	ui64 := int64(binary.BigEndian.Uint64(src))
	f64 := math.Float64frombits(uint64(ui64))
	i64 := int64(f64)
	if f64 != float64(i64) {
		return fmt.Errorf("cannot losslessly convert %v to int64", f64)
	}

	return s.ScanInt64(Int8{Int64: i64, Valid: true})
}

type scanPlanBinaryFloat8ToTextScanner struct{}

func (scanPlanBinaryFloat8ToTextScanner) Scan(src []byte, dst any) error {
	s := (dst).(TextScanner)

	if src == nil {
		return s.ScanText(Text{})
	}

	if len(src) != 8 {
		return fmt.Errorf("invalid length for float8: %v", len(src))
	}

	ui64 := int64(binary.BigEndian.Uint64(src))
	f64 := math.Float64frombits(uint64(ui64))

	return s.ScanText(Text{String: strconv.FormatFloat(f64, 'f', -1, 64), Valid: true})
}

type scanPlanTextAnyToFloat64 struct{}

func (scanPlanTextAnyToFloat64) Scan(src []byte, dst any) error {
	if src == nil {
		return fmt.Errorf("cannot scan NULL into %T", dst)
	}

	n, err := strconv.ParseFloat(string(src), 64)
	if err != nil {
		return err
	}

	f := (dst).(*float64)
	*f = n

	return nil
}

type scanPlanTextAnyToFloat64Scanner struct{}

func (scanPlanTextAnyToFloat64Scanner) Scan(src []byte, dst any) error {
	s := (dst).(Float64Scanner)

	if src == nil {
		return s.ScanFloat64(Float8{})
	}

	n, err := strconv.ParseFloat(string(src), 64)
	if err != nil {
		return err
	}

	return s.ScanFloat64(Float8{Float64: n, Valid: true})
}

func (c Float8Codec) DecodeDatabaseSQLValue(m *Map, oid uint32, format int16, src []byte) (driver.Value, error) {
	return c.DecodeValue(m, oid, format, src)
}

func (c Float8Codec) DecodeValue(m *Map, oid uint32, format int16, src []byte) (any, error) {
	if src == nil {
		return nil, nil
	}

	var n float64
	err := codecScan(c, m, oid, format, src, &n)
	if err != nil {
		return nil, err
	}
	return n, nil
}
