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

type Uint32Scanner interface {
	ScanUint32(v Uint32) error
}

type Uint32Valuer interface {
	Uint32Value() (Uint32, error)
}

// Uint32 is the core type that is used to represent PostgreSQL types such as OID, CID, and XID.
type Uint32 struct {
	Uint32 uint32
	Valid  bool
}

// ScanUint32 implements the [Uint32Scanner] interface.
func (n *Uint32) ScanUint32(v Uint32) error {
	*n = v
	return nil
}

// Uint32Value implements the [Uint32Valuer] interface.
func (n Uint32) Uint32Value() (Uint32, error) {
	return n, nil
}

// Scan implements the [database/sql.Scanner] interface.
func (dst *Uint32) Scan(src any) error {
	if src == nil {
		*dst = Uint32{}
		return nil
	}

	var n int64

	switch src := src.(type) {
	case int64:
		n = src
	case string:
		un, err := strconv.ParseUint(src, 10, 32)
		if err != nil {
			return err
		}
		n = int64(un)
	default:
		return fmt.Errorf("cannot scan %T", src)
	}

	if n < 0 {
		return fmt.Errorf("%d is less than the minimum value for Uint32", n)
	}
	if n > math.MaxUint32 {
		return fmt.Errorf("%d is greater than maximum value for Uint32", n)
	}

	*dst = Uint32{Uint32: uint32(n), Valid: true}

	return nil
}

// Value implements the [database/sql/driver.Valuer] interface.
func (src Uint32) Value() (driver.Value, error) {
	if !src.Valid {
		return nil, nil
	}
	return int64(src.Uint32), nil
}

// MarshalJSON implements the [encoding/json.Marshaler] interface.
func (src Uint32) MarshalJSON() ([]byte, error) {
	if !src.Valid {
		return []byte("null"), nil
	}
	return json.Marshal(src.Uint32)
}

// UnmarshalJSON implements the [encoding/json.Unmarshaler] interface.
func (dst *Uint32) UnmarshalJSON(b []byte) error {
	var n *uint32
	err := json.Unmarshal(b, &n)
	if err != nil {
		return err
	}

	if n == nil {
		*dst = Uint32{}
	} else {
		*dst = Uint32{Uint32: *n, Valid: true}
	}

	return nil
}

type Uint32Codec struct{}

func (Uint32Codec) FormatSupported(format int16) bool {
	return format == TextFormatCode || format == BinaryFormatCode
}

func (Uint32Codec) PreferredFormat() int16 {
	return BinaryFormatCode
}

func (Uint32Codec) PlanEncode(m *Map, oid uint32, format int16, value any) EncodePlan {
	switch format {
	case BinaryFormatCode:
		switch value.(type) {
		case uint32:
			return encodePlanUint32CodecBinaryUint32{}
		case Uint32Valuer:
			return encodePlanUint32CodecBinaryUint32Valuer{}
		case Int64Valuer:
			return encodePlanUint32CodecBinaryInt64Valuer{}
		}
	case TextFormatCode:
		switch value.(type) {
		case uint32:
			return encodePlanUint32CodecTextUint32{}
		case Int64Valuer:
			return encodePlanUint32CodecTextInt64Valuer{}
		}
	}

	return nil
}

type encodePlanUint32CodecBinaryUint32 struct{}

func (encodePlanUint32CodecBinaryUint32) Encode(value any, buf []byte) (newBuf []byte, err error) {
	v := value.(uint32)
	return pgio.AppendUint32(buf, v), nil
}

type encodePlanUint32CodecBinaryUint32Valuer struct{}

func (encodePlanUint32CodecBinaryUint32Valuer) Encode(value any, buf []byte) (newBuf []byte, err error) {
	v, err := value.(Uint32Valuer).Uint32Value()
	if err != nil {
		return nil, err
	}

	if !v.Valid {
		return nil, nil
	}

	return pgio.AppendUint32(buf, v.Uint32), nil
}

type encodePlanUint32CodecBinaryInt64Valuer struct{}

func (encodePlanUint32CodecBinaryInt64Valuer) Encode(value any, buf []byte) (newBuf []byte, err error) {
	v, err := value.(Int64Valuer).Int64Value()
	if err != nil {
		return nil, err
	}

	if !v.Valid {
		return nil, nil
	}

	if v.Int64 < 0 {
		return nil, fmt.Errorf("%d is less than minimum value for uint32", v.Int64)
	}
	if v.Int64 > math.MaxUint32 {
		return nil, fmt.Errorf("%d is greater than maximum value for uint32", v.Int64)
	}

	return pgio.AppendUint32(buf, uint32(v.Int64)), nil
}

type encodePlanUint32CodecTextUint32 struct{}

func (encodePlanUint32CodecTextUint32) Encode(value any, buf []byte) (newBuf []byte, err error) {
	v := value.(uint32)
	return append(buf, strconv.FormatUint(uint64(v), 10)...), nil
}

type encodePlanUint32CodecTextUint32Valuer struct{}

func (encodePlanUint32CodecTextUint32Valuer) Encode(value any, buf []byte) (newBuf []byte, err error) {
	v, err := value.(Uint32Valuer).Uint32Value()
	if err != nil {
		return nil, err
	}

	if !v.Valid {
		return nil, nil
	}

	return append(buf, strconv.FormatUint(uint64(v.Uint32), 10)...), nil
}

type encodePlanUint32CodecTextInt64Valuer struct{}

func (encodePlanUint32CodecTextInt64Valuer) Encode(value any, buf []byte) (newBuf []byte, err error) {
	v, err := value.(Int64Valuer).Int64Value()
	if err != nil {
		return nil, err
	}

	if !v.Valid {
		return nil, nil
	}

	if v.Int64 < 0 {
		return nil, fmt.Errorf("%d is less than minimum value for uint32", v.Int64)
	}
	if v.Int64 > math.MaxUint32 {
		return nil, fmt.Errorf("%d is greater than maximum value for uint32", v.Int64)
	}

	return append(buf, strconv.FormatInt(v.Int64, 10)...), nil
}

func (Uint32Codec) PlanScan(m *Map, oid uint32, format int16, target any) ScanPlan {
	switch format {
	case BinaryFormatCode:
		switch target.(type) {
		case *uint32:
			return scanPlanBinaryUint32ToUint32{}
		case Uint32Scanner:
			return scanPlanBinaryUint32ToUint32Scanner{}
		case TextScanner:
			return scanPlanBinaryUint32ToTextScanner{}
		}
	case TextFormatCode:
		switch target.(type) {
		case *uint32:
			return scanPlanTextAnyToUint32{}
		case Uint32Scanner:
			return scanPlanTextAnyToUint32Scanner{}
		}
	}

	return nil
}

func (c Uint32Codec) DecodeDatabaseSQLValue(m *Map, oid uint32, format int16, src []byte) (driver.Value, error) {
	if src == nil {
		return nil, nil
	}

	var n uint32
	err := codecScan(c, m, oid, format, src, &n)
	if err != nil {
		return nil, err
	}
	return int64(n), nil
}

func (c Uint32Codec) DecodeValue(m *Map, oid uint32, format int16, src []byte) (any, error) {
	if src == nil {
		return nil, nil
	}

	var n uint32
	err := codecScan(c, m, oid, format, src, &n)
	if err != nil {
		return nil, err
	}
	return n, nil
}

type scanPlanBinaryUint32ToUint32 struct{}

func (scanPlanBinaryUint32ToUint32) Scan(src []byte, dst any) error {
	if src == nil {
		return fmt.Errorf("cannot scan NULL into %T", dst)
	}

	if len(src) != 4 {
		return fmt.Errorf("invalid length for uint32: %v", len(src))
	}

	p := (dst).(*uint32)
	*p = binary.BigEndian.Uint32(src)

	return nil
}

type scanPlanBinaryUint32ToUint32Scanner struct{}

func (scanPlanBinaryUint32ToUint32Scanner) Scan(src []byte, dst any) error {
	s, ok := (dst).(Uint32Scanner)
	if !ok {
		return ErrScanTargetTypeChanged
	}

	if src == nil {
		return s.ScanUint32(Uint32{})
	}

	if len(src) != 4 {
		return fmt.Errorf("invalid length for uint32: %v", len(src))
	}

	n := binary.BigEndian.Uint32(src)

	return s.ScanUint32(Uint32{Uint32: n, Valid: true})
}

type scanPlanBinaryUint32ToTextScanner struct{}

func (scanPlanBinaryUint32ToTextScanner) Scan(src []byte, dst any) error {
	s, ok := (dst).(TextScanner)
	if !ok {
		return ErrScanTargetTypeChanged
	}

	if src == nil {
		return s.ScanText(Text{})
	}

	if len(src) != 4 {
		return fmt.Errorf("invalid length for uint32: %v", len(src))
	}

	n := uint64(binary.BigEndian.Uint32(src))
	return s.ScanText(Text{String: strconv.FormatUint(n, 10), Valid: true})
}

type scanPlanTextAnyToUint32Scanner struct{}

func (scanPlanTextAnyToUint32Scanner) Scan(src []byte, dst any) error {
	s, ok := (dst).(Uint32Scanner)
	if !ok {
		return ErrScanTargetTypeChanged
	}

	if src == nil {
		return s.ScanUint32(Uint32{})
	}

	n, err := strconv.ParseUint(string(src), 10, 32)
	if err != nil {
		return err
	}

	return s.ScanUint32(Uint32{Uint32: uint32(n), Valid: true})
}
