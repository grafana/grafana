package pgtype

import (
	"bytes"
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
)

type BoolScanner interface {
	ScanBool(v Bool) error
}

type BoolValuer interface {
	BoolValue() (Bool, error)
}

type Bool struct {
	Bool  bool
	Valid bool
}

// ScanBool implements the [BoolScanner] interface.
func (b *Bool) ScanBool(v Bool) error {
	*b = v
	return nil
}

// BoolValue implements the [BoolValuer] interface.
func (b Bool) BoolValue() (Bool, error) {
	return b, nil
}

// Scan implements the [database/sql.Scanner] interface.
func (dst *Bool) Scan(src any) error {
	if src == nil {
		*dst = Bool{}
		return nil
	}

	switch src := src.(type) {
	case bool:
		*dst = Bool{Bool: src, Valid: true}
		return nil
	case string:
		b, err := strconv.ParseBool(src)
		if err != nil {
			return err
		}
		*dst = Bool{Bool: b, Valid: true}
		return nil
	case []byte:
		b, err := strconv.ParseBool(string(src))
		if err != nil {
			return err
		}
		*dst = Bool{Bool: b, Valid: true}
		return nil
	}

	return fmt.Errorf("cannot scan %T", src)
}

// Value implements the [database/sql/driver.Valuer] interface.
func (src Bool) Value() (driver.Value, error) {
	if !src.Valid {
		return nil, nil
	}

	return src.Bool, nil
}

// MarshalJSON implements the [encoding/json.Marshaler] interface.
func (src Bool) MarshalJSON() ([]byte, error) {
	if !src.Valid {
		return []byte("null"), nil
	}

	if src.Bool {
		return []byte("true"), nil
	} else {
		return []byte("false"), nil
	}
}

// UnmarshalJSON implements the [encoding/json.Unmarshaler] interface.
func (dst *Bool) UnmarshalJSON(b []byte) error {
	var v *bool
	err := json.Unmarshal(b, &v)
	if err != nil {
		return err
	}

	if v == nil {
		*dst = Bool{}
	} else {
		*dst = Bool{Bool: *v, Valid: true}
	}

	return nil
}

type BoolCodec struct{}

func (BoolCodec) FormatSupported(format int16) bool {
	return format == TextFormatCode || format == BinaryFormatCode
}

func (BoolCodec) PreferredFormat() int16 {
	return BinaryFormatCode
}

func (BoolCodec) PlanEncode(m *Map, oid uint32, format int16, value any) EncodePlan {
	switch format {
	case BinaryFormatCode:
		switch value.(type) {
		case bool:
			return encodePlanBoolCodecBinaryBool{}
		case BoolValuer:
			return encodePlanBoolCodecBinaryBoolValuer{}
		}
	case TextFormatCode:
		switch value.(type) {
		case bool:
			return encodePlanBoolCodecTextBool{}
		case BoolValuer:
			return encodePlanBoolCodecTextBoolValuer{}
		}
	}

	return nil
}

type encodePlanBoolCodecBinaryBool struct{}

func (encodePlanBoolCodecBinaryBool) Encode(value any, buf []byte) (newBuf []byte, err error) {
	v := value.(bool)

	if v {
		buf = append(buf, 1)
	} else {
		buf = append(buf, 0)
	}

	return buf, nil
}

type encodePlanBoolCodecTextBoolValuer struct{}

func (encodePlanBoolCodecTextBoolValuer) Encode(value any, buf []byte) (newBuf []byte, err error) {
	b, err := value.(BoolValuer).BoolValue()
	if err != nil {
		return nil, err
	}

	if !b.Valid {
		return nil, nil
	}

	if b.Bool {
		buf = append(buf, 't')
	} else {
		buf = append(buf, 'f')
	}

	return buf, nil
}

type encodePlanBoolCodecBinaryBoolValuer struct{}

func (encodePlanBoolCodecBinaryBoolValuer) Encode(value any, buf []byte) (newBuf []byte, err error) {
	b, err := value.(BoolValuer).BoolValue()
	if err != nil {
		return nil, err
	}

	if !b.Valid {
		return nil, nil
	}

	if b.Bool {
		buf = append(buf, 1)
	} else {
		buf = append(buf, 0)
	}

	return buf, nil
}

type encodePlanBoolCodecTextBool struct{}

func (encodePlanBoolCodecTextBool) Encode(value any, buf []byte) (newBuf []byte, err error) {
	v := value.(bool)

	if v {
		buf = append(buf, 't')
	} else {
		buf = append(buf, 'f')
	}

	return buf, nil
}

func (BoolCodec) PlanScan(m *Map, oid uint32, format int16, target any) ScanPlan {
	switch format {
	case BinaryFormatCode:
		switch target.(type) {
		case *bool:
			return scanPlanBinaryBoolToBool{}
		case BoolScanner:
			return scanPlanBinaryBoolToBoolScanner{}
		}
	case TextFormatCode:
		switch target.(type) {
		case *bool:
			return scanPlanTextAnyToBool{}
		case BoolScanner:
			return scanPlanTextAnyToBoolScanner{}
		}
	}

	return nil
}

func (c BoolCodec) DecodeDatabaseSQLValue(m *Map, oid uint32, format int16, src []byte) (driver.Value, error) {
	return c.DecodeValue(m, oid, format, src)
}

func (c BoolCodec) DecodeValue(m *Map, oid uint32, format int16, src []byte) (any, error) {
	if src == nil {
		return nil, nil
	}

	var b bool
	err := codecScan(c, m, oid, format, src, &b)
	if err != nil {
		return nil, err
	}
	return b, nil
}

type scanPlanBinaryBoolToBool struct{}

func (scanPlanBinaryBoolToBool) Scan(src []byte, dst any) error {
	if src == nil {
		return fmt.Errorf("cannot scan NULL into %T", dst)
	}

	if len(src) != 1 {
		return fmt.Errorf("invalid length for bool: %v", len(src))
	}

	p, ok := (dst).(*bool)
	if !ok {
		return ErrScanTargetTypeChanged
	}

	*p = src[0] == 1

	return nil
}

type scanPlanTextAnyToBool struct{}

func (scanPlanTextAnyToBool) Scan(src []byte, dst any) error {
	if src == nil {
		return fmt.Errorf("cannot scan NULL into %T", dst)
	}

	if len(src) == 0 {
		return fmt.Errorf("cannot scan empty string into %T", dst)
	}

	p, ok := (dst).(*bool)
	if !ok {
		return ErrScanTargetTypeChanged
	}

	v, err := planTextToBool(src)
	if err != nil {
		return err
	}

	*p = v

	return nil
}

type scanPlanBinaryBoolToBoolScanner struct{}

func (scanPlanBinaryBoolToBoolScanner) Scan(src []byte, dst any) error {
	s, ok := (dst).(BoolScanner)
	if !ok {
		return ErrScanTargetTypeChanged
	}

	if src == nil {
		return s.ScanBool(Bool{})
	}

	if len(src) != 1 {
		return fmt.Errorf("invalid length for bool: %v", len(src))
	}

	return s.ScanBool(Bool{Bool: src[0] == 1, Valid: true})
}

type scanPlanTextAnyToBoolScanner struct{}

func (scanPlanTextAnyToBoolScanner) Scan(src []byte, dst any) error {
	s, ok := (dst).(BoolScanner)
	if !ok {
		return ErrScanTargetTypeChanged
	}

	if src == nil {
		return s.ScanBool(Bool{})
	}

	if len(src) == 0 {
		return fmt.Errorf("cannot scan empty string into %T", dst)
	}

	v, err := planTextToBool(src)
	if err != nil {
		return err
	}

	return s.ScanBool(Bool{Bool: v, Valid: true})
}

// https://www.postgresql.org/docs/current/datatype-boolean.html
func planTextToBool(src []byte) (bool, error) {
	s := string(bytes.ToLower(bytes.TrimSpace(src)))

	switch {
	case strings.HasPrefix("true", s), strings.HasPrefix("yes", s), s == "on", s == "1":
		return true, nil
	case strings.HasPrefix("false", s), strings.HasPrefix("no", s), strings.HasPrefix("off", s), s == "0":
		return false, nil
	default:
		return false, fmt.Errorf("unknown boolean string representation %q", src)
	}
}
