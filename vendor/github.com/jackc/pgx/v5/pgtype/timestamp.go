package pgtype

import (
	"database/sql/driver"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/internal/pgio"
)

const (
	pgTimestampFormat = "2006-01-02 15:04:05.999999999"
	jsonISO8601       = "2006-01-02T15:04:05.999999999"
)

type TimestampScanner interface {
	ScanTimestamp(v Timestamp) error
}

type TimestampValuer interface {
	TimestampValue() (Timestamp, error)
}

// Timestamp represents the PostgreSQL timestamp type.
type Timestamp struct {
	Time             time.Time // Time zone will be ignored when encoding to PostgreSQL.
	InfinityModifier InfinityModifier
	Valid            bool
}

// ScanTimestamp implements the [TimestampScanner] interface.
func (ts *Timestamp) ScanTimestamp(v Timestamp) error {
	*ts = v
	return nil
}

// TimestampValue implements the [TimestampValuer] interface.
func (ts Timestamp) TimestampValue() (Timestamp, error) {
	return ts, nil
}

// Scan implements the [database/sql.Scanner] interface.
func (ts *Timestamp) Scan(src any) error {
	if src == nil {
		*ts = Timestamp{}
		return nil
	}

	switch src := src.(type) {
	case string:
		return (&scanPlanTextTimestampToTimestampScanner{}).Scan([]byte(src), ts)
	case time.Time:
		*ts = Timestamp{Time: src, Valid: true}
		return nil
	}

	return fmt.Errorf("cannot scan %T", src)
}

// Value implements the [database/sql/driver.Valuer] interface.
func (ts Timestamp) Value() (driver.Value, error) {
	if !ts.Valid {
		return nil, nil
	}

	if ts.InfinityModifier != Finite {
		return ts.InfinityModifier.String(), nil
	}
	return ts.Time, nil
}

// MarshalJSON implements the [encoding/json.Marshaler] interface.
func (ts Timestamp) MarshalJSON() ([]byte, error) {
	if !ts.Valid {
		return []byte("null"), nil
	}

	var s string

	switch ts.InfinityModifier {
	case Finite:
		s = ts.Time.Format(jsonISO8601)
	case Infinity:
		s = "infinity"
	case NegativeInfinity:
		s = "-infinity"
	}

	return json.Marshal(s)
}

// UnmarshalJSON implements the [encoding/json.Unmarshaler] interface.
func (ts *Timestamp) UnmarshalJSON(b []byte) error {
	var s *string
	err := json.Unmarshal(b, &s)
	if err != nil {
		return err
	}

	if s == nil {
		*ts = Timestamp{}
		return nil
	}

	switch *s {
	case "infinity":
		*ts = Timestamp{Valid: true, InfinityModifier: Infinity}
	case "-infinity":
		*ts = Timestamp{Valid: true, InfinityModifier: -Infinity}
	default:
		// Parse time with or without timezonr
		tss := *s
		//		PostgreSQL uses ISO 8601 without timezone for to_json function and casting from a string to timestampt
		tim, err := time.Parse(time.RFC3339Nano, tss)
		if err == nil {
			*ts = Timestamp{Time: tim, Valid: true}
			return nil
		}
		tim, err = time.ParseInLocation(jsonISO8601, tss, time.UTC)
		if err == nil {
			*ts = Timestamp{Time: tim, Valid: true}
			return nil
		}
		ts.Valid = false
		return fmt.Errorf("cannot unmarshal %s to timestamp with layout %s or %s (%w)",
			*s, time.RFC3339Nano, jsonISO8601, err)
	}
	return nil
}

type TimestampCodec struct {
	// ScanLocation is the location that the time is assumed to be in for scanning. This is different from
	// TimestamptzCodec.ScanLocation in that this setting does change the instant in time that the timestamp represents.
	ScanLocation *time.Location
}

func (*TimestampCodec) FormatSupported(format int16) bool {
	return format == TextFormatCode || format == BinaryFormatCode
}

func (*TimestampCodec) PreferredFormat() int16 {
	return BinaryFormatCode
}

func (*TimestampCodec) PlanEncode(m *Map, oid uint32, format int16, value any) EncodePlan {
	if _, ok := value.(TimestampValuer); !ok {
		return nil
	}

	switch format {
	case BinaryFormatCode:
		return encodePlanTimestampCodecBinary{}
	case TextFormatCode:
		return encodePlanTimestampCodecText{}
	}

	return nil
}

type encodePlanTimestampCodecBinary struct{}

func (encodePlanTimestampCodecBinary) Encode(value any, buf []byte) (newBuf []byte, err error) {
	ts, err := value.(TimestampValuer).TimestampValue()
	if err != nil {
		return nil, err
	}

	if !ts.Valid {
		return nil, nil
	}

	var microsecSinceY2K int64
	switch ts.InfinityModifier {
	case Finite:
		t := discardTimeZone(ts.Time)
		microsecSinceUnixEpoch := t.Unix()*1000000 + int64(t.Nanosecond())/1000
		microsecSinceY2K = microsecSinceUnixEpoch - microsecFromUnixEpochToY2K
	case Infinity:
		microsecSinceY2K = infinityMicrosecondOffset
	case NegativeInfinity:
		microsecSinceY2K = negativeInfinityMicrosecondOffset
	}

	buf = pgio.AppendInt64(buf, microsecSinceY2K)

	return buf, nil
}

type encodePlanTimestampCodecText struct{}

func (encodePlanTimestampCodecText) Encode(value any, buf []byte) (newBuf []byte, err error) {
	ts, err := value.(TimestampValuer).TimestampValue()
	if err != nil {
		return nil, err
	}

	if !ts.Valid {
		return nil, nil
	}

	var s string

	switch ts.InfinityModifier {
	case Finite:
		t := discardTimeZone(ts.Time)

		// Year 0000 is 1 BC
		bc := false
		if year := t.Year(); year <= 0 {
			year = -year + 1
			t = time.Date(year, t.Month(), t.Day(), t.Hour(), t.Minute(), t.Second(), t.Nanosecond(), time.UTC)
			bc = true
		}

		s = t.Truncate(time.Microsecond).Format(pgTimestampFormat)

		if bc {
			s = s + " BC"
		}
	case Infinity:
		s = "infinity"
	case NegativeInfinity:
		s = "-infinity"
	}

	buf = append(buf, s...)

	return buf, nil
}

func discardTimeZone(t time.Time) time.Time {
	if t.Location() != time.UTC {
		return time.Date(t.Year(), t.Month(), t.Day(), t.Hour(), t.Minute(), t.Second(), t.Nanosecond(), time.UTC)
	}

	return t
}

func (c *TimestampCodec) PlanScan(m *Map, oid uint32, format int16, target any) ScanPlan {
	switch format {
	case BinaryFormatCode:
		switch target.(type) {
		case TimestampScanner:
			return &scanPlanBinaryTimestampToTimestampScanner{location: c.ScanLocation}
		}
	case TextFormatCode:
		switch target.(type) {
		case TimestampScanner:
			return &scanPlanTextTimestampToTimestampScanner{location: c.ScanLocation}
		}
	}

	return nil
}

type scanPlanBinaryTimestampToTimestampScanner struct{ location *time.Location }

func (plan *scanPlanBinaryTimestampToTimestampScanner) Scan(src []byte, dst any) error {
	scanner := (dst).(TimestampScanner)

	if src == nil {
		return scanner.ScanTimestamp(Timestamp{})
	}

	if len(src) != 8 {
		return fmt.Errorf("invalid length for timestamp: %v", len(src))
	}

	var ts Timestamp
	microsecSinceY2K := int64(binary.BigEndian.Uint64(src))

	switch microsecSinceY2K {
	case infinityMicrosecondOffset:
		ts = Timestamp{Valid: true, InfinityModifier: Infinity}
	case negativeInfinityMicrosecondOffset:
		ts = Timestamp{Valid: true, InfinityModifier: -Infinity}
	default:
		tim := time.Unix(
			microsecFromUnixEpochToY2K/1000000+microsecSinceY2K/1000000,
			(microsecFromUnixEpochToY2K%1000000*1000)+(microsecSinceY2K%1000000*1000),
		).UTC()
		if plan.location != nil {
			tim = time.Date(tim.Year(), tim.Month(), tim.Day(), tim.Hour(), tim.Minute(), tim.Second(), tim.Nanosecond(), plan.location)
		}
		ts = Timestamp{Time: tim, Valid: true}
	}

	return scanner.ScanTimestamp(ts)
}

type scanPlanTextTimestampToTimestampScanner struct{ location *time.Location }

func (plan *scanPlanTextTimestampToTimestampScanner) Scan(src []byte, dst any) error {
	scanner := (dst).(TimestampScanner)

	if src == nil {
		return scanner.ScanTimestamp(Timestamp{})
	}

	var ts Timestamp
	sbuf := string(src)
	switch sbuf {
	case "infinity":
		ts = Timestamp{Valid: true, InfinityModifier: Infinity}
	case "-infinity":
		ts = Timestamp{Valid: true, InfinityModifier: -Infinity}
	default:
		bc := false
		if strings.HasSuffix(sbuf, " BC") {
			sbuf = sbuf[:len(sbuf)-3]
			bc = true
		}
		tim, err := time.Parse(pgTimestampFormat, sbuf)
		if err != nil {
			return err
		}

		if bc {
			year := -tim.Year() + 1
			tim = time.Date(year, tim.Month(), tim.Day(), tim.Hour(), tim.Minute(), tim.Second(), tim.Nanosecond(), tim.Location())
		}

		if plan.location != nil {
			tim = time.Date(tim.Year(), tim.Month(), tim.Day(), tim.Hour(), tim.Minute(), tim.Second(), tim.Nanosecond(), plan.location)
		}

		ts = Timestamp{Time: tim, Valid: true}
	}

	return scanner.ScanTimestamp(ts)
}

func (c *TimestampCodec) DecodeDatabaseSQLValue(m *Map, oid uint32, format int16, src []byte) (driver.Value, error) {
	if src == nil {
		return nil, nil
	}

	var ts Timestamp
	err := codecScan(c, m, oid, format, src, &ts)
	if err != nil {
		return nil, err
	}

	if ts.InfinityModifier != Finite {
		return ts.InfinityModifier.String(), nil
	}

	return ts.Time, nil
}

func (c *TimestampCodec) DecodeValue(m *Map, oid uint32, format int16, src []byte) (any, error) {
	if src == nil {
		return nil, nil
	}

	var ts Timestamp
	err := codecScan(c, m, oid, format, src, &ts)
	if err != nil {
		return nil, err
	}

	if ts.InfinityModifier != Finite {
		return ts.InfinityModifier, nil
	}

	return ts.Time, nil
}
