package pgtype

import (
	"database/sql/driver"
	"encoding/binary"
	"fmt"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5/internal/pgio"
)

const (
	microsecondsPerSecond = 1_000_000
	microsecondsPerMinute = 60 * microsecondsPerSecond
	microsecondsPerHour   = 60 * microsecondsPerMinute
	microsecondsPerDay    = 24 * microsecondsPerHour
	microsecondsPerMonth  = 30 * microsecondsPerDay
)

type IntervalScanner interface {
	ScanInterval(v Interval) error
}

type IntervalValuer interface {
	IntervalValue() (Interval, error)
}

type Interval struct {
	Microseconds int64
	Days         int32
	Months       int32
	Valid        bool
}

// ScanInterval implements the [IntervalScanner] interface.
func (interval *Interval) ScanInterval(v Interval) error {
	*interval = v
	return nil
}

// IntervalValue implements the [IntervalValuer] interface.
func (interval Interval) IntervalValue() (Interval, error) {
	return interval, nil
}

// Scan implements the [database/sql.Scanner] interface.
func (interval *Interval) Scan(src any) error {
	if src == nil {
		*interval = Interval{}
		return nil
	}

	switch src := src.(type) {
	case string:
		return scanPlanTextAnyToIntervalScanner{}.Scan([]byte(src), interval)
	}

	return fmt.Errorf("cannot scan %T", src)
}

// Value implements the [database/sql/driver.Valuer] interface.
func (interval Interval) Value() (driver.Value, error) {
	if !interval.Valid {
		return nil, nil
	}

	buf, err := IntervalCodec{}.PlanEncode(nil, 0, TextFormatCode, interval).Encode(interval, nil)
	if err != nil {
		return nil, err
	}
	return string(buf), err
}

type IntervalCodec struct{}

func (IntervalCodec) FormatSupported(format int16) bool {
	return format == TextFormatCode || format == BinaryFormatCode
}

func (IntervalCodec) PreferredFormat() int16 {
	return BinaryFormatCode
}

func (IntervalCodec) PlanEncode(m *Map, oid uint32, format int16, value any) EncodePlan {
	if _, ok := value.(IntervalValuer); !ok {
		return nil
	}

	switch format {
	case BinaryFormatCode:
		return encodePlanIntervalCodecBinary{}
	case TextFormatCode:
		return encodePlanIntervalCodecText{}
	}

	return nil
}

type encodePlanIntervalCodecBinary struct{}

func (encodePlanIntervalCodecBinary) Encode(value any, buf []byte) (newBuf []byte, err error) {
	interval, err := value.(IntervalValuer).IntervalValue()
	if err != nil {
		return nil, err
	}

	if !interval.Valid {
		return nil, nil
	}

	buf = pgio.AppendInt64(buf, interval.Microseconds)
	buf = pgio.AppendInt32(buf, interval.Days)
	buf = pgio.AppendInt32(buf, interval.Months)
	return buf, nil
}

type encodePlanIntervalCodecText struct{}

func (encodePlanIntervalCodecText) Encode(value any, buf []byte) (newBuf []byte, err error) {
	interval, err := value.(IntervalValuer).IntervalValue()
	if err != nil {
		return nil, err
	}

	if !interval.Valid {
		return nil, nil
	}

	if interval.Months != 0 {
		buf = append(buf, strconv.FormatInt(int64(interval.Months), 10)...)
		buf = append(buf, " mon "...)
	}

	if interval.Days != 0 {
		buf = append(buf, strconv.FormatInt(int64(interval.Days), 10)...)
		buf = append(buf, " day "...)
	}

	absMicroseconds := interval.Microseconds
	if absMicroseconds < 0 {
		absMicroseconds = -absMicroseconds
		buf = append(buf, '-')
	}

	hours := absMicroseconds / microsecondsPerHour
	minutes := (absMicroseconds % microsecondsPerHour) / microsecondsPerMinute
	seconds := (absMicroseconds % microsecondsPerMinute) / microsecondsPerSecond

	timeStr := fmt.Sprintf("%02d:%02d:%02d", hours, minutes, seconds)
	buf = append(buf, timeStr...)

	microseconds := absMicroseconds % microsecondsPerSecond
	if microseconds != 0 {
		buf = append(buf, fmt.Sprintf(".%06d", microseconds)...)
	}

	return buf, nil
}

func (IntervalCodec) PlanScan(m *Map, oid uint32, format int16, target any) ScanPlan {
	switch format {
	case BinaryFormatCode:
		switch target.(type) {
		case IntervalScanner:
			return scanPlanBinaryIntervalToIntervalScanner{}
		}
	case TextFormatCode:
		switch target.(type) {
		case IntervalScanner:
			return scanPlanTextAnyToIntervalScanner{}
		}
	}

	return nil
}

type scanPlanBinaryIntervalToIntervalScanner struct{}

func (scanPlanBinaryIntervalToIntervalScanner) Scan(src []byte, dst any) error {
	scanner := (dst).(IntervalScanner)

	if src == nil {
		return scanner.ScanInterval(Interval{})
	}

	if len(src) != 16 {
		return fmt.Errorf("Received an invalid size for an interval: %d", len(src))
	}

	microseconds := int64(binary.BigEndian.Uint64(src))
	days := int32(binary.BigEndian.Uint32(src[8:]))
	months := int32(binary.BigEndian.Uint32(src[12:]))

	return scanner.ScanInterval(Interval{Microseconds: microseconds, Days: days, Months: months, Valid: true})
}

type scanPlanTextAnyToIntervalScanner struct{}

func (scanPlanTextAnyToIntervalScanner) Scan(src []byte, dst any) error {
	scanner := (dst).(IntervalScanner)

	if src == nil {
		return scanner.ScanInterval(Interval{})
	}

	var microseconds int64
	var days int32
	var months int32

	parts := strings.Split(string(src), " ")

	for i := 0; i < len(parts)-1; i += 2 {
		scalar, err := strconv.ParseInt(parts[i], 10, 64)
		if err != nil {
			return fmt.Errorf("bad interval format")
		}

		switch parts[i+1] {
		case "year", "years":
			months += int32(scalar * 12)
		case "mon", "mons":
			months += int32(scalar)
		case "day", "days":
			days = int32(scalar)
		default:
			return fmt.Errorf("bad interval format: %q", parts[i+1])
		}
	}

	if len(parts)%2 == 1 {
		timeParts := strings.SplitN(parts[len(parts)-1], ":", 3)
		if len(timeParts) != 3 {
			return fmt.Errorf("bad interval format")
		}

		var negative bool
		if timeParts[0][0] == '-' {
			negative = true
			timeParts[0] = timeParts[0][1:]
		}

		hours, err := strconv.ParseInt(timeParts[0], 10, 64)
		if err != nil {
			return fmt.Errorf("bad interval hour format: %s", timeParts[0])
		}

		minutes, err := strconv.ParseInt(timeParts[1], 10, 64)
		if err != nil {
			return fmt.Errorf("bad interval minute format: %s", timeParts[1])
		}

		sec, secFrac, secFracFound := strings.Cut(timeParts[2], ".")

		seconds, err := strconv.ParseInt(sec, 10, 64)
		if err != nil {
			return fmt.Errorf("bad interval second format: %s", sec)
		}

		var uSeconds int64
		if secFracFound {
			uSeconds, err = strconv.ParseInt(secFrac, 10, 64)
			if err != nil {
				return fmt.Errorf("bad interval decimal format: %s", secFrac)
			}

			for i := 0; i < 6-len(secFrac); i++ {
				uSeconds *= 10
			}
		}

		microseconds = hours * microsecondsPerHour
		microseconds += minutes * microsecondsPerMinute
		microseconds += seconds * microsecondsPerSecond
		microseconds += uSeconds

		if negative {
			microseconds = -microseconds
		}
	}

	return scanner.ScanInterval(Interval{Months: months, Days: days, Microseconds: microseconds, Valid: true})
}

func (c IntervalCodec) DecodeDatabaseSQLValue(m *Map, oid uint32, format int16, src []byte) (driver.Value, error) {
	return codecDecodeToTextFormat(c, m, oid, format, src)
}

func (c IntervalCodec) DecodeValue(m *Map, oid uint32, format int16, src []byte) (any, error) {
	if src == nil {
		return nil, nil
	}

	var interval Interval
	err := codecScan(c, m, oid, format, src, &interval)
	if err != nil {
		return nil, err
	}
	return interval, nil
}
