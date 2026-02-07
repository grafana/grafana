package pgtype

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
)

type TextScanner interface {
	ScanText(v Text) error
}

type TextValuer interface {
	TextValue() (Text, error)
}

type Text struct {
	String string
	Valid  bool
}

// ScanText implements the [TextScanner] interface.
func (t *Text) ScanText(v Text) error {
	*t = v
	return nil
}

// TextValue implements the [TextValuer] interface.
func (t Text) TextValue() (Text, error) {
	return t, nil
}

// Scan implements the [database/sql.Scanner] interface.
func (dst *Text) Scan(src any) error {
	if src == nil {
		*dst = Text{}
		return nil
	}

	switch src := src.(type) {
	case string:
		*dst = Text{String: src, Valid: true}
		return nil
	case []byte:
		*dst = Text{String: string(src), Valid: true}
		return nil
	}

	return fmt.Errorf("cannot scan %T", src)
}

// Value implements the [database/sql/driver.Valuer] interface.
func (src Text) Value() (driver.Value, error) {
	if !src.Valid {
		return nil, nil
	}
	return src.String, nil
}

// MarshalJSON implements the [encoding/json.Marshaler] interface.
func (src Text) MarshalJSON() ([]byte, error) {
	if !src.Valid {
		return []byte("null"), nil
	}

	return json.Marshal(src.String)
}

// UnmarshalJSON implements the [encoding/json.Unmarshaler] interface.
func (dst *Text) UnmarshalJSON(b []byte) error {
	var s *string
	err := json.Unmarshal(b, &s)
	if err != nil {
		return err
	}

	if s == nil {
		*dst = Text{}
	} else {
		*dst = Text{String: *s, Valid: true}
	}

	return nil
}

type TextCodec struct{}

func (TextCodec) FormatSupported(format int16) bool {
	return format == TextFormatCode || format == BinaryFormatCode
}

func (TextCodec) PreferredFormat() int16 {
	return TextFormatCode
}

func (TextCodec) PlanEncode(m *Map, oid uint32, format int16, value any) EncodePlan {
	switch format {
	case TextFormatCode, BinaryFormatCode:
		switch value.(type) {
		case string:
			return encodePlanTextCodecString{}
		case []byte:
			return encodePlanTextCodecByteSlice{}
		case TextValuer:
			return encodePlanTextCodecTextValuer{}
		}
	}

	return nil
}

type encodePlanTextCodecString struct{}

func (encodePlanTextCodecString) Encode(value any, buf []byte) (newBuf []byte, err error) {
	s := value.(string)
	buf = append(buf, s...)
	return buf, nil
}

type encodePlanTextCodecByteSlice struct{}

func (encodePlanTextCodecByteSlice) Encode(value any, buf []byte) (newBuf []byte, err error) {
	s := value.([]byte)
	buf = append(buf, s...)
	return buf, nil
}

type encodePlanTextCodecStringer struct{}

func (encodePlanTextCodecStringer) Encode(value any, buf []byte) (newBuf []byte, err error) {
	s := value.(fmt.Stringer)
	buf = append(buf, s.String()...)
	return buf, nil
}

type encodePlanTextCodecTextValuer struct{}

func (encodePlanTextCodecTextValuer) Encode(value any, buf []byte) (newBuf []byte, err error) {
	text, err := value.(TextValuer).TextValue()
	if err != nil {
		return nil, err
	}

	if !text.Valid {
		return nil, nil
	}

	buf = append(buf, text.String...)
	return buf, nil
}

func (TextCodec) PlanScan(m *Map, oid uint32, format int16, target any) ScanPlan {
	switch format {
	case TextFormatCode, BinaryFormatCode:
		switch target.(type) {
		case *string:
			return scanPlanTextAnyToString{}
		case *[]byte:
			return scanPlanAnyToNewByteSlice{}
		case BytesScanner:
			return scanPlanAnyToByteScanner{}
		case TextScanner:
			return scanPlanTextAnyToTextScanner{}
		}
	}

	return nil
}

func (c TextCodec) DecodeDatabaseSQLValue(m *Map, oid uint32, format int16, src []byte) (driver.Value, error) {
	return c.DecodeValue(m, oid, format, src)
}

func (c TextCodec) DecodeValue(m *Map, oid uint32, format int16, src []byte) (any, error) {
	if src == nil {
		return nil, nil
	}

	return string(src), nil
}

type scanPlanTextAnyToString struct{}

func (scanPlanTextAnyToString) Scan(src []byte, dst any) error {
	if src == nil {
		return fmt.Errorf("cannot scan NULL into %T", dst)
	}

	p := (dst).(*string)
	*p = string(src)

	return nil
}

type scanPlanAnyToNewByteSlice struct{}

func (scanPlanAnyToNewByteSlice) Scan(src []byte, dst any) error {
	p := (dst).(*[]byte)
	if src == nil {
		*p = nil
	} else {
		*p = make([]byte, len(src))
		copy(*p, src)
	}

	return nil
}

type scanPlanAnyToByteScanner struct{}

func (scanPlanAnyToByteScanner) Scan(src []byte, dst any) error {
	p := (dst).(BytesScanner)
	return p.ScanBytes(src)
}

type scanPlanTextAnyToTextScanner struct{}

func (scanPlanTextAnyToTextScanner) Scan(src []byte, dst any) error {
	scanner := (dst).(TextScanner)

	if src == nil {
		return scanner.ScanText(Text{})
	}

	return scanner.ScanText(Text{String: string(src), Valid: true})
}
