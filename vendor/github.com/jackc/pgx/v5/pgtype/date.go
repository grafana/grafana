package pgtype

import (
	"database/sql/driver"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5/internal/pgio"
)

type DateScanner interface {
	ScanDate(v Date) error
}

type DateValuer interface {
	DateValue() (Date, error)
}

type Date struct {
	Time             time.Time
	InfinityModifier InfinityModifier
	Valid            bool
}

// ScanDate implements the [DateScanner] interface.
func (d *Date) ScanDate(v Date) error {
	*d = v
	return nil
}

// DateValue implements the [DateValuer] interface.
func (d Date) DateValue() (Date, error) {
	return d, nil
}

const (
	negativeInfinityDayOffset = -2147483648
	infinityDayOffset         = 2147483647
)

// Scan implements the [database/sql.Scanner] interface.
func (dst *Date) Scan(src any) error {
	if src == nil {
		*dst = Date{}
		return nil
	}

	switch src := src.(type) {
	case string:
		return scanPlanTextAnyToDateScanner{}.Scan([]byte(src), dst)
	case time.Time:
		*dst = Date{Time: src, Valid: true}
		return nil
	}

	return fmt.Errorf("cannot scan %T", src)
}

// Value implements the [database/sql/driver.Valuer] interface.
func (src Date) Value() (driver.Value, error) {
	if !src.Valid {
		return nil, nil
	}

	if src.InfinityModifier != Finite {
		return src.InfinityModifier.String(), nil
	}
	return src.Time, nil
}

// MarshalJSON implements the [encoding/json.Marshaler] interface.
func (src Date) MarshalJSON() ([]byte, error) {
	if !src.Valid {
		return []byte("null"), nil
	}

	var s string

	switch src.InfinityModifier {
	case Finite:
		s = src.Time.Format("2006-01-02")
	case Infinity:
		s = "infinity"
	case NegativeInfinity:
		s = "-infinity"
	}

	return json.Marshal(s)
}

// UnmarshalJSON implements the [encoding/json.Unmarshaler] interface.
func (dst *Date) UnmarshalJSON(b []byte) error {
	var s *string
	err := json.Unmarshal(b, &s)
	if err != nil {
		return err
	}

	if s == nil {
		*dst = Date{}
		return nil
	}

	switch *s {
	case "infinity":
		*dst = Date{Valid: true, InfinityModifier: Infinity}
	case "-infinity":
		*dst = Date{Valid: true, InfinityModifier: -Infinity}
	default:
		t, err := time.ParseInLocation("2006-01-02", *s, time.UTC)
		if err != nil {
			return err
		}

		*dst = Date{Time: t, Valid: true}
	}

	return nil
}

type DateCodec struct{}

func (DateCodec) FormatSupported(format int16) bool {
	return format == TextFormatCode || format == BinaryFormatCode
}

func (DateCodec) PreferredFormat() int16 {
	return BinaryFormatCode
}

func (DateCodec) PlanEncode(m *Map, oid uint32, format int16, value any) EncodePlan {
	if _, ok := value.(DateValuer); !ok {
		return nil
	}

	switch format {
	case BinaryFormatCode:
		return encodePlanDateCodecBinary{}
	case TextFormatCode:
		return encodePlanDateCodecText{}
	}

	return nil
}

type encodePlanDateCodecBinary struct{}

func (encodePlanDateCodecBinary) Encode(value any, buf []byte) (newBuf []byte, err error) {
	date, err := value.(DateValuer).DateValue()
	if err != nil {
		return nil, err
	}

	if !date.Valid {
		return nil, nil
	}

	var daysSinceDateEpoch int32
	switch date.InfinityModifier {
	case Finite:
		tUnix := time.Date(date.Time.Year(), date.Time.Month(), date.Time.Day(), 0, 0, 0, 0, time.UTC).Unix()
		dateEpoch := time.Date(2000, 1, 1, 0, 0, 0, 0, time.UTC).Unix()

		secSinceDateEpoch := tUnix - dateEpoch
		daysSinceDateEpoch = int32(secSinceDateEpoch / 86400)
	case Infinity:
		daysSinceDateEpoch = infinityDayOffset
	case NegativeInfinity:
		daysSinceDateEpoch = negativeInfinityDayOffset
	}

	return pgio.AppendInt32(buf, daysSinceDateEpoch), nil
}

type encodePlanDateCodecText struct{}

func (encodePlanDateCodecText) Encode(value any, buf []byte) (newBuf []byte, err error) {
	date, err := value.(DateValuer).DateValue()
	if err != nil {
		return nil, err
	}

	if !date.Valid {
		return nil, nil
	}

	switch date.InfinityModifier {
	case Finite:
		// Year 0000 is 1 BC
		bc := false
		year := date.Time.Year()
		if year <= 0 {
			year = -year + 1
			bc = true
		}

		yearBytes := strconv.AppendInt(make([]byte, 0, 6), int64(year), 10)
		for i := len(yearBytes); i < 4; i++ {
			buf = append(buf, '0')
		}
		buf = append(buf, yearBytes...)
		buf = append(buf, '-')
		if date.Time.Month() < 10 {
			buf = append(buf, '0')
		}
		buf = strconv.AppendInt(buf, int64(date.Time.Month()), 10)
		buf = append(buf, '-')
		if date.Time.Day() < 10 {
			buf = append(buf, '0')
		}
		buf = strconv.AppendInt(buf, int64(date.Time.Day()), 10)

		if bc {
			buf = append(buf, " BC"...)
		}
	case Infinity:
		buf = append(buf, "infinity"...)
	case NegativeInfinity:
		buf = append(buf, "-infinity"...)
	}

	return buf, nil
}

func (DateCodec) PlanScan(m *Map, oid uint32, format int16, target any) ScanPlan {
	switch format {
	case BinaryFormatCode:
		switch target.(type) {
		case DateScanner:
			return scanPlanBinaryDateToDateScanner{}
		}
	case TextFormatCode:
		switch target.(type) {
		case DateScanner:
			return scanPlanTextAnyToDateScanner{}
		}
	}

	return nil
}

type scanPlanBinaryDateToDateScanner struct{}

func (scanPlanBinaryDateToDateScanner) Scan(src []byte, dst any) error {
	scanner := (dst).(DateScanner)

	if src == nil {
		return scanner.ScanDate(Date{})
	}

	if len(src) != 4 {
		return fmt.Errorf("invalid length for date: %v", len(src))
	}

	dayOffset := int32(binary.BigEndian.Uint32(src))

	switch dayOffset {
	case infinityDayOffset:
		return scanner.ScanDate(Date{InfinityModifier: Infinity, Valid: true})
	case negativeInfinityDayOffset:
		return scanner.ScanDate(Date{InfinityModifier: -Infinity, Valid: true})
	default:
		t := time.Date(2000, 1, int(1+dayOffset), 0, 0, 0, 0, time.UTC)
		return scanner.ScanDate(Date{Time: t, Valid: true})
	}
}

type scanPlanTextAnyToDateScanner struct{}

var dateRegexp = regexp.MustCompile(`^(\d{4,})-(\d\d)-(\d\d)( BC)?$`)

func (scanPlanTextAnyToDateScanner) Scan(src []byte, dst any) error {
	scanner := (dst).(DateScanner)

	if src == nil {
		return scanner.ScanDate(Date{})
	}

	sbuf := string(src)
	match := dateRegexp.FindStringSubmatch(sbuf)
	if match != nil {
		year, err := strconv.ParseInt(match[1], 10, 32)
		if err != nil {
			return fmt.Errorf("BUG: cannot parse date that regexp matched (year): %w", err)
		}

		month, err := strconv.ParseInt(match[2], 10, 32)
		if err != nil {
			return fmt.Errorf("BUG: cannot parse date that regexp matched (month): %w", err)
		}

		day, err := strconv.ParseInt(match[3], 10, 32)
		if err != nil {
			return fmt.Errorf("BUG: cannot parse date that regexp matched (month): %w", err)
		}

		// BC matched
		if len(match[4]) > 0 {
			year = -year + 1
		}

		t := time.Date(int(year), time.Month(month), int(day), 0, 0, 0, 0, time.UTC)
		return scanner.ScanDate(Date{Time: t, Valid: true})
	}

	switch sbuf {
	case "infinity":
		return scanner.ScanDate(Date{InfinityModifier: Infinity, Valid: true})
	case "-infinity":
		return scanner.ScanDate(Date{InfinityModifier: -Infinity, Valid: true})
	default:
		return fmt.Errorf("invalid date format")
	}
}

func (c DateCodec) DecodeDatabaseSQLValue(m *Map, oid uint32, format int16, src []byte) (driver.Value, error) {
	if src == nil {
		return nil, nil
	}

	var date Date
	err := codecScan(c, m, oid, format, src, &date)
	if err != nil {
		return nil, err
	}

	if date.InfinityModifier != Finite {
		return date.InfinityModifier.String(), nil
	}

	return date.Time, nil
}

func (c DateCodec) DecodeValue(m *Map, oid uint32, format int16, src []byte) (any, error) {
	if src == nil {
		return nil, nil
	}

	var date Date
	err := codecScan(c, m, oid, format, src, &date)
	if err != nil {
		return nil, err
	}

	if date.InfinityModifier != Finite {
		return date.InfinityModifier, nil
	}

	return date.Time, nil
}
