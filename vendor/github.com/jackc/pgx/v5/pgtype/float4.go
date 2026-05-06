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

type Float4 struct {
	Float32 float32
	Valid   bool
}

// ScanFloat64 implements the [Float64Scanner] interface.
func (f *Float4) ScanFloat64(n Float8) error {
	*f = Float4{Float32: float32(n.Float64), Valid: n.Valid}
	return nil
}

// Float64Value implements the [Float64Valuer] interface.
func (f Float4) Float64Value() (Float8, error) {
	return Float8{Float64: float64(f.Float32), Valid: f.Valid}, nil
}

// ScanInt64 implements the [Int64Scanner] interface.
func (f *Float4) ScanInt64(n Int8) error {
	*f = Float4{Float32: float32(n.Int64), Valid: n.Valid}
	return nil
}

// Int64Value implements the [Int64Valuer] interface.
func (f Float4) Int64Value() (Int8, error) {
	return Int8{Int64: int64(f.Float32), Valid: f.Valid}, nil
}

// Scan implements the [database/sql.Scanner] interface.
func (f *Float4) Scan(src any) error {
	if src == nil {
		*f = Float4{}
		return nil
	}

	switch src := src.(type) {
	case float64:
		*f = Float4{Float32: float32(src), Valid: true}
		return nil
	case string:
		n, err := strconv.ParseFloat(string(src), 32)
		if err != nil {
			return err
		}
		*f = Float4{Float32: float32(n), Valid: true}
		return nil
	}

	return fmt.Errorf("cannot scan %T", src)
}

// Value implements the [database/sql/driver.Valuer] interface.
func (f Float4) Value() (driver.Value, error) {
	if !f.Valid {
		return nil, nil
	}
	return float64(f.Float32), nil
}

// MarshalJSON implements the [encoding/json.Marshaler] interface.
func (f Float4) MarshalJSON() ([]byte, error) {
	if !f.Valid {
		return []byte("null"), nil
	}
	return json.Marshal(f.Float32)
}

// UnmarshalJSON implements the [encoding/json.Unmarshaler] interface.
func (f *Float4) UnmarshalJSON(b []byte) error {
	var n *float32
	err := json.Unmarshal(b, &n)
	if err != nil {
		return err
	}

	if n == nil {
		*f = Float4{}
	} else {
		*f = Float4{Float32: *n, Valid: true}
	}

	return nil
}

type Float4Codec struct{}

func (Float4Codec) FormatSupported(format int16) bool {
	return format == TextFormatCode || format == BinaryFormatCode
}

func (Float4Codec) PreferredFormat() int16 {
	return BinaryFormatCode
}

func (Float4Codec) PlanEncode(m *Map, oid uint32, format int16, value any) EncodePlan {
	switch format {
	case BinaryFormatCode:
		switch value.(type) {
		case float32:
			return encodePlanFloat4CodecBinaryFloat32{}
		case Float64Valuer:
			return encodePlanFloat4CodecBinaryFloat64Valuer{}
		case Int64Valuer:
			return encodePlanFloat4CodecBinaryInt64Valuer{}
		}
	case TextFormatCode:
		switch value.(type) {
		case float32:
			return encodePlanTextFloat32{}
		case Float64Valuer:
			return encodePlanTextFloat64Valuer{}
		case Int64Valuer:
			return encodePlanTextInt64Valuer{}
		}
	}

	return nil
}

type encodePlanFloat4CodecBinaryFloat32 struct{}

func (encodePlanFloat4CodecBinaryFloat32) Encode(value any, buf []byte) (newBuf []byte, err error) {
	n := value.(float32)
	return pgio.AppendUint32(buf, math.Float32bits(n)), nil
}

type encodePlanTextFloat32 struct{}

func (encodePlanTextFloat32) Encode(value any, buf []byte) (newBuf []byte, err error) {
	n := value.(float32)
	return append(buf, strconv.FormatFloat(float64(n), 'f', -1, 32)...), nil
}

type encodePlanFloat4CodecBinaryFloat64Valuer struct{}

func (encodePlanFloat4CodecBinaryFloat64Valuer) Encode(value any, buf []byte) (newBuf []byte, err error) {
	n, err := value.(Float64Valuer).Float64Value()
	if err != nil {
		return nil, err
	}

	if !n.Valid {
		return nil, nil
	}

	return pgio.AppendUint32(buf, math.Float32bits(float32(n.Float64))), nil
}

type encodePlanFloat4CodecBinaryInt64Valuer struct{}

func (encodePlanFloat4CodecBinaryInt64Valuer) Encode(value any, buf []byte) (newBuf []byte, err error) {
	n, err := value.(Int64Valuer).Int64Value()
	if err != nil {
		return nil, err
	}

	if !n.Valid {
		return nil, nil
	}

	f := float32(n.Int64)
	return pgio.AppendUint32(buf, math.Float32bits(f)), nil
}

func (Float4Codec) PlanScan(m *Map, oid uint32, format int16, target any) ScanPlan {
	switch format {
	case BinaryFormatCode:
		switch target.(type) {
		case *float32:
			return scanPlanBinaryFloat4ToFloat32{}
		case Float64Scanner:
			return scanPlanBinaryFloat4ToFloat64Scanner{}
		case Int64Scanner:
			return scanPlanBinaryFloat4ToInt64Scanner{}
		case TextScanner:
			return scanPlanBinaryFloat4ToTextScanner{}
		}
	case TextFormatCode:
		switch target.(type) {
		case *float32:
			return scanPlanTextAnyToFloat32{}
		case Float64Scanner:
			return scanPlanTextAnyToFloat64Scanner{}
		case Int64Scanner:
			return scanPlanTextAnyToInt64Scanner{}
		}
	}

	return nil
}

type scanPlanBinaryFloat4ToFloat32 struct{}

func (scanPlanBinaryFloat4ToFloat32) Scan(src []byte, dst any) error {
	if src == nil {
		return fmt.Errorf("cannot scan NULL into %T", dst)
	}

	if len(src) != 4 {
		return fmt.Errorf("invalid length for float4: %v", len(src))
	}

	n := int32(binary.BigEndian.Uint32(src))
	f := (dst).(*float32)
	*f = math.Float32frombits(uint32(n))

	return nil
}

type scanPlanBinaryFloat4ToFloat64Scanner struct{}

func (scanPlanBinaryFloat4ToFloat64Scanner) Scan(src []byte, dst any) error {
	s := (dst).(Float64Scanner)

	if src == nil {
		return s.ScanFloat64(Float8{})
	}

	if len(src) != 4 {
		return fmt.Errorf("invalid length for float4: %v", len(src))
	}

	n := int32(binary.BigEndian.Uint32(src))
	return s.ScanFloat64(Float8{Float64: float64(math.Float32frombits(uint32(n))), Valid: true})
}

type scanPlanBinaryFloat4ToInt64Scanner struct{}

func (scanPlanBinaryFloat4ToInt64Scanner) Scan(src []byte, dst any) error {
	s := (dst).(Int64Scanner)

	if src == nil {
		return s.ScanInt64(Int8{})
	}

	if len(src) != 4 {
		return fmt.Errorf("invalid length for float4: %v", len(src))
	}

	ui32 := int32(binary.BigEndian.Uint32(src))
	f32 := math.Float32frombits(uint32(ui32))
	i64 := int64(f32)
	if f32 != float32(i64) {
		return fmt.Errorf("cannot losslessly convert %v to int64", f32)
	}

	return s.ScanInt64(Int8{Int64: i64, Valid: true})
}

type scanPlanBinaryFloat4ToTextScanner struct{}

func (scanPlanBinaryFloat4ToTextScanner) Scan(src []byte, dst any) error {
	s := (dst).(TextScanner)

	if src == nil {
		return s.ScanText(Text{})
	}

	if len(src) != 4 {
		return fmt.Errorf("invalid length for float4: %v", len(src))
	}

	ui32 := int32(binary.BigEndian.Uint32(src))
	f32 := math.Float32frombits(uint32(ui32))

	return s.ScanText(Text{String: strconv.FormatFloat(float64(f32), 'f', -1, 32), Valid: true})
}

type scanPlanTextAnyToFloat32 struct{}

func (scanPlanTextAnyToFloat32) Scan(src []byte, dst any) error {
	if src == nil {
		return fmt.Errorf("cannot scan NULL into %T", dst)
	}

	n, err := strconv.ParseFloat(string(src), 32)
	if err != nil {
		return err
	}

	f := (dst).(*float32)
	*f = float32(n)

	return nil
}

func (c Float4Codec) DecodeDatabaseSQLValue(m *Map, oid uint32, format int16, src []byte) (driver.Value, error) {
	if src == nil {
		return nil, nil
	}

	var n float32
	err := codecScan(c, m, oid, format, src, &n)
	if err != nil {
		return nil, err
	}
	return float64(n), nil
}

func (c Float4Codec) DecodeValue(m *Map, oid uint32, format int16, src []byte) (any, error) {
	if src == nil {
		return nil, nil
	}

	var n float32
	err := codecScan(c, m, oid, format, src, &n)
	if err != nil {
		return nil, err
	}
	return n, nil
}
