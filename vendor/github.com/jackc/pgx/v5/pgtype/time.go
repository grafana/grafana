package pgtype

import (
	"database/sql/driver"
	"encoding/binary"
	"fmt"
	"strconv"

	"github.com/jackc/pgx/v5/internal/pgio"
)

type TimeScanner interface {
	ScanTime(v Time) error
}

type TimeValuer interface {
	TimeValue() (Time, error)
}

// Time represents the PostgreSQL time type. The PostgreSQL time is a time of day without time zone.
//
// Time is represented as the number of microseconds since midnight in the same way that PostgreSQL does. Other time and
// date types in pgtype can use time.Time as the underlying representation. However, pgtype.Time type cannot due to
// needing to handle 24:00:00. time.Time converts that to 00:00:00 on the following day.
//
// The time with time zone type is not supported. Use of time with time zone is discouraged by the PostgreSQL documentation.
type Time struct {
	Microseconds int64 // Number of microseconds since midnight
	Valid        bool
}

// ScanTime implements the [TimeScanner] interface.
func (t *Time) ScanTime(v Time) error {
	*t = v
	return nil
}

// TimeValue implements the [TimeValuer] interface.
func (t Time) TimeValue() (Time, error) {
	return t, nil
}

// Scan implements the [database/sql.Scanner] interface.
func (t *Time) Scan(src any) error {
	if src == nil {
		*t = Time{}
		return nil
	}

	switch src := src.(type) {
	case string:
		err := scanPlanTextAnyToTimeScanner{}.Scan([]byte(src), t)
		if err != nil {
			t.Microseconds = 0
			t.Valid = false
		}
		return err
	}

	return fmt.Errorf("cannot scan %T", src)
}

// Value implements the [database/sql/driver.Valuer] interface.
func (t Time) Value() (driver.Value, error) {
	if !t.Valid {
		return nil, nil
	}

	buf, err := TimeCodec{}.PlanEncode(nil, 0, TextFormatCode, t).Encode(t, nil)
	if err != nil {
		return nil, err
	}
	return string(buf), err
}

type TimeCodec struct{}

func (TimeCodec) FormatSupported(format int16) bool {
	return format == TextFormatCode || format == BinaryFormatCode
}

func (TimeCodec) PreferredFormat() int16 {
	return BinaryFormatCode
}

func (TimeCodec) PlanEncode(m *Map, oid uint32, format int16, value any) EncodePlan {
	if _, ok := value.(TimeValuer); !ok {
		return nil
	}

	switch format {
	case BinaryFormatCode:
		return encodePlanTimeCodecBinary{}
	case TextFormatCode:
		return encodePlanTimeCodecText{}
	}

	return nil
}

type encodePlanTimeCodecBinary struct{}

func (encodePlanTimeCodecBinary) Encode(value any, buf []byte) (newBuf []byte, err error) {
	t, err := value.(TimeValuer).TimeValue()
	if err != nil {
		return nil, err
	}

	if !t.Valid {
		return nil, nil
	}

	return pgio.AppendInt64(buf, t.Microseconds), nil
}

type encodePlanTimeCodecText struct{}

func (encodePlanTimeCodecText) Encode(value any, buf []byte) (newBuf []byte, err error) {
	t, err := value.(TimeValuer).TimeValue()
	if err != nil {
		return nil, err
	}

	if !t.Valid {
		return nil, nil
	}

	usec := t.Microseconds
	hours := usec / microsecondsPerHour
	usec -= hours * microsecondsPerHour
	minutes := usec / microsecondsPerMinute
	usec -= minutes * microsecondsPerMinute
	seconds := usec / microsecondsPerSecond
	usec -= seconds * microsecondsPerSecond

	s := fmt.Sprintf("%02d:%02d:%02d.%06d", hours, minutes, seconds, usec)

	return append(buf, s...), nil
}

func (TimeCodec) PlanScan(m *Map, oid uint32, format int16, target any) ScanPlan {
	switch format {
	case BinaryFormatCode:
		switch target.(type) {
		case TimeScanner:
			return scanPlanBinaryTimeToTimeScanner{}
		case TextScanner:
			return scanPlanBinaryTimeToTextScanner{}
		}
	case TextFormatCode:
		switch target.(type) {
		case TimeScanner:
			return scanPlanTextAnyToTimeScanner{}
		}
	}

	return nil
}

type scanPlanBinaryTimeToTimeScanner struct{}

func (scanPlanBinaryTimeToTimeScanner) Scan(src []byte, dst any) error {
	scanner := (dst).(TimeScanner)

	if src == nil {
		return scanner.ScanTime(Time{})
	}

	if len(src) != 8 {
		return fmt.Errorf("invalid length for time: %v", len(src))
	}

	usec := int64(binary.BigEndian.Uint64(src))

	return scanner.ScanTime(Time{Microseconds: usec, Valid: true})
}

type scanPlanBinaryTimeToTextScanner struct{}

func (scanPlanBinaryTimeToTextScanner) Scan(src []byte, dst any) error {
	ts, ok := (dst).(TextScanner)
	if !ok {
		return ErrScanTargetTypeChanged
	}

	if src == nil {
		return ts.ScanText(Text{})
	}

	if len(src) != 8 {
		return fmt.Errorf("invalid length for time: %v", len(src))
	}

	usec := int64(binary.BigEndian.Uint64(src))

	tim := Time{Microseconds: usec, Valid: true}

	buf, err := TimeCodec{}.PlanEncode(nil, 0, TextFormatCode, tim).Encode(tim, nil)
	if err != nil {
		return err
	}

	return ts.ScanText(Text{String: string(buf), Valid: true})
}

type scanPlanTextAnyToTimeScanner struct{}

func (scanPlanTextAnyToTimeScanner) Scan(src []byte, dst any) error {
	scanner := (dst).(TimeScanner)

	if src == nil {
		return scanner.ScanTime(Time{})
	}

	s := string(src)

	if len(s) < 8 || s[2] != ':' || s[5] != ':' {
		return fmt.Errorf("cannot decode %v into Time", s)
	}

	hours, err := strconv.ParseInt(s[0:2], 10, 64)
	if err != nil {
		return fmt.Errorf("cannot decode %v into Time", s)
	}
	usec := hours * microsecondsPerHour

	minutes, err := strconv.ParseInt(s[3:5], 10, 64)
	if err != nil {
		return fmt.Errorf("cannot decode %v into Time", s)
	}
	usec += minutes * microsecondsPerMinute

	seconds, err := strconv.ParseInt(s[6:8], 10, 64)
	if err != nil {
		return fmt.Errorf("cannot decode %v into Time", s)
	}
	usec += seconds * microsecondsPerSecond

	if len(s) > 9 {
		if s[8] != '.' || len(s) > 15 {
			return fmt.Errorf("cannot decode %v into Time", s)
		}

		fraction := s[9:]
		n, err := strconv.ParseInt(fraction, 10, 64)
		if err != nil {
			return fmt.Errorf("cannot decode %v into Time", s)
		}

		for i := len(fraction); i < 6; i++ {
			n *= 10
		}

		usec += n
	}

	return scanner.ScanTime(Time{Microseconds: usec, Valid: true})
}

func (c TimeCodec) DecodeDatabaseSQLValue(m *Map, oid uint32, format int16, src []byte) (driver.Value, error) {
	return codecDecodeToTextFormat(c, m, oid, format, src)
}

func (c TimeCodec) DecodeValue(m *Map, oid uint32, format int16, src []byte) (any, error) {
	if src == nil {
		return nil, nil
	}

	var t Time
	err := codecScan(c, m, oid, format, src, &t)
	if err != nil {
		return nil, err
	}
	return t, nil
}
