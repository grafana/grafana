package pgtype

import (
	"bytes"
	"database/sql/driver"
	"encoding/hex"
	"fmt"
)

type UUIDScanner interface {
	ScanUUID(v UUID) error
}

type UUIDValuer interface {
	UUIDValue() (UUID, error)
}

type UUID struct {
	Bytes [16]byte
	Valid bool
}

// ScanUUID implements the [UUIDScanner] interface.
func (b *UUID) ScanUUID(v UUID) error {
	*b = v
	return nil
}

// UUIDValue implements the [UUIDValuer] interface.
func (b UUID) UUIDValue() (UUID, error) {
	return b, nil
}

// parseUUID converts a string UUID in standard form to a byte array.
func parseUUID(src string) (dst [16]byte, err error) {
	switch len(src) {
	case 36:
		src = src[0:8] + src[9:13] + src[14:18] + src[19:23] + src[24:]
	case 32:
		// dashes already stripped, assume valid
	default:
		// assume invalid.
		return dst, fmt.Errorf("cannot parse UUID %v", src)
	}

	buf, err := hex.DecodeString(src)
	if err != nil {
		return dst, err
	}

	copy(dst[:], buf)
	return dst, err
}

// encodeUUID converts a uuid byte array to UUID standard string form.
func encodeUUID(src [16]byte) string {
	var buf [36]byte

	hex.Encode(buf[0:8], src[:4])
	buf[8] = '-'
	hex.Encode(buf[9:13], src[4:6])
	buf[13] = '-'
	hex.Encode(buf[14:18], src[6:8])
	buf[18] = '-'
	hex.Encode(buf[19:23], src[8:10])
	buf[23] = '-'
	hex.Encode(buf[24:], src[10:])

	return string(buf[:])
}

// Scan implements the [database/sql.Scanner] interface.
func (dst *UUID) Scan(src any) error {
	if src == nil {
		*dst = UUID{}
		return nil
	}

	switch src := src.(type) {
	case string:
		buf, err := parseUUID(src)
		if err != nil {
			return err
		}
		*dst = UUID{Bytes: buf, Valid: true}
		return nil
	}

	return fmt.Errorf("cannot scan %T", src)
}

// Value implements the [database/sql/driver.Valuer] interface.
func (src UUID) Value() (driver.Value, error) {
	if !src.Valid {
		return nil, nil
	}

	return encodeUUID(src.Bytes), nil
}

func (src UUID) String() string {
	if !src.Valid {
		return ""
	}

	return encodeUUID(src.Bytes)
}

// MarshalJSON implements the [encoding/json.Marshaler] interface.
func (src UUID) MarshalJSON() ([]byte, error) {
	if !src.Valid {
		return []byte("null"), nil
	}

	var buff bytes.Buffer
	buff.WriteByte('"')
	buff.WriteString(encodeUUID(src.Bytes))
	buff.WriteByte('"')
	return buff.Bytes(), nil
}

// UnmarshalJSON implements the [encoding/json.Unmarshaler] interface.
func (dst *UUID) UnmarshalJSON(src []byte) error {
	if bytes.Equal(src, []byte("null")) {
		*dst = UUID{}
		return nil
	}
	if len(src) != 38 {
		return fmt.Errorf("invalid length for UUID: %v", len(src))
	}
	buf, err := parseUUID(string(src[1 : len(src)-1]))
	if err != nil {
		return err
	}
	*dst = UUID{Bytes: buf, Valid: true}
	return nil
}

type UUIDCodec struct{}

func (UUIDCodec) FormatSupported(format int16) bool {
	return format == TextFormatCode || format == BinaryFormatCode
}

func (UUIDCodec) PreferredFormat() int16 {
	return BinaryFormatCode
}

func (UUIDCodec) PlanEncode(m *Map, oid uint32, format int16, value any) EncodePlan {
	if _, ok := value.(UUIDValuer); !ok {
		return nil
	}

	switch format {
	case BinaryFormatCode:
		return encodePlanUUIDCodecBinaryUUIDValuer{}
	case TextFormatCode:
		return encodePlanUUIDCodecTextUUIDValuer{}
	}

	return nil
}

type encodePlanUUIDCodecBinaryUUIDValuer struct{}

func (encodePlanUUIDCodecBinaryUUIDValuer) Encode(value any, buf []byte) (newBuf []byte, err error) {
	uuid, err := value.(UUIDValuer).UUIDValue()
	if err != nil {
		return nil, err
	}

	if !uuid.Valid {
		return nil, nil
	}

	return append(buf, uuid.Bytes[:]...), nil
}

type encodePlanUUIDCodecTextUUIDValuer struct{}

func (encodePlanUUIDCodecTextUUIDValuer) Encode(value any, buf []byte) (newBuf []byte, err error) {
	uuid, err := value.(UUIDValuer).UUIDValue()
	if err != nil {
		return nil, err
	}

	if !uuid.Valid {
		return nil, nil
	}

	return append(buf, encodeUUID(uuid.Bytes)...), nil
}

func (UUIDCodec) PlanScan(m *Map, oid uint32, format int16, target any) ScanPlan {
	switch format {
	case BinaryFormatCode:
		switch target.(type) {
		case UUIDScanner:
			return scanPlanBinaryUUIDToUUIDScanner{}
		case TextScanner:
			return scanPlanBinaryUUIDToTextScanner{}
		}
	case TextFormatCode:
		switch target.(type) {
		case UUIDScanner:
			return scanPlanTextAnyToUUIDScanner{}
		}
	}

	return nil
}

type scanPlanBinaryUUIDToUUIDScanner struct{}

func (scanPlanBinaryUUIDToUUIDScanner) Scan(src []byte, dst any) error {
	scanner := (dst).(UUIDScanner)

	if src == nil {
		return scanner.ScanUUID(UUID{})
	}

	if len(src) != 16 {
		return fmt.Errorf("invalid length for UUID: %v", len(src))
	}

	uuid := UUID{Valid: true}
	copy(uuid.Bytes[:], src)

	return scanner.ScanUUID(uuid)
}

type scanPlanBinaryUUIDToTextScanner struct{}

func (scanPlanBinaryUUIDToTextScanner) Scan(src []byte, dst any) error {
	scanner := (dst).(TextScanner)

	if src == nil {
		return scanner.ScanText(Text{})
	}

	if len(src) != 16 {
		return fmt.Errorf("invalid length for UUID: %v", len(src))
	}

	var buf [16]byte
	copy(buf[:], src)

	return scanner.ScanText(Text{String: encodeUUID(buf), Valid: true})
}

type scanPlanTextAnyToUUIDScanner struct{}

func (scanPlanTextAnyToUUIDScanner) Scan(src []byte, dst any) error {
	scanner := (dst).(UUIDScanner)

	if src == nil {
		return scanner.ScanUUID(UUID{})
	}

	buf, err := parseUUID(string(src))
	if err != nil {
		return err
	}

	return scanner.ScanUUID(UUID{Bytes: buf, Valid: true})
}

func (c UUIDCodec) DecodeDatabaseSQLValue(m *Map, oid uint32, format int16, src []byte) (driver.Value, error) {
	if src == nil {
		return nil, nil
	}

	var uuid UUID
	err := codecScan(c, m, oid, format, src, &uuid)
	if err != nil {
		return nil, err
	}

	return encodeUUID(uuid.Bytes), nil
}

func (c UUIDCodec) DecodeValue(m *Map, oid uint32, format int16, src []byte) (any, error) {
	if src == nil {
		return nil, nil
	}

	var uuid UUID
	err := codecScan(c, m, oid, format, src, &uuid)
	if err != nil {
		return nil, err
	}
	return uuid.Bytes, nil
}
