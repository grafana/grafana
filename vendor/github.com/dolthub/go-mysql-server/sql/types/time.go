// Copyright 2022 Dolthub, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package types

import (
	"context"
	"math"
	"reflect"
	"strconv"
	"strings"
	"time"

	"github.com/dolthub/vitess/go/sqltypes"
	"github.com/dolthub/vitess/go/vt/proto/query"
	"github.com/shopspring/decimal"
	"gopkg.in/src-d/go-errors.v1"

	"github.com/dolthub/go-mysql-server/sql"
)

var (
	Time TimeType = TimespanType_{}

	ErrConvertingToTimeType = errors.NewKind("value %v is not a valid Time")

	timespanMinimum           int64 = -3020399000000
	timespanMaximum           int64 = 3020399000000
	microsecondsPerSecond     int64 = 1000000
	microsecondsPerMinute     int64 = 60000000
	microsecondsPerHour       int64 = 3600000000
	nanosecondsPerMicrosecond int64 = 1000

	timeValueType = reflect.TypeOf(Timespan(0))
)

// TimeType represents the TIME type.
// https://dev.mysql.com/doc/refman/8.0/en/time.html
// TIME is implemented as TIME(6).
// The type of the returned value is Timespan.
// TODO: implement parameters on the TIME type
type TimeType interface {
	sql.Type
	// ConvertToTimespan returns a Timespan from the given interface. Follows the same conversion rules as
	// Convert(), in that this will process the value based on its base-10 visual representation (for example, Convert()
	// will interpret the value `1234` as 12 minutes and 34 seconds). Returns an error for nil values.
	ConvertToTimespan(v interface{}) (Timespan, error)
	// ConvertToTimeDuration returns a time.Duration from the given interface. Follows the same conversion rules as
	// Convert(), in that this will process the value based on its base-10 visual representation (for example, Convert()
	// will interpret the value `1234` as 12 minutes and 34 seconds). Returns an error for nil values.
	ConvertToTimeDuration(v interface{}) (time.Duration, error)
	// MicrosecondsToTimespan returns a Timespan from the given number of microseconds. This differs from Convert(), as
	// that will process the value based on its base-10 visual representation (for example, Convert() will interpret
	// the value `1234` as 12 minutes and 34 seconds). This clamps the given microseconds to the allowed range.
	MicrosecondsToTimespan(v int64) Timespan
}

type TimespanType_ struct{}

var _ TimeType = TimespanType_{}
var _ sql.CollationCoercible = TimespanType_{}

// MaxTextResponseByteLength implements the Type interface
func (t TimespanType_) MaxTextResponseByteLength(*sql.Context) uint32 {
	// 10 digits are required for a text representation without microseconds, but with microseconds
	// requires 17, so return 17 as an upper limit (i.e. len(+123:00:00.999999"))
	return 17
}

// Timespan is the value type returned by TimeType.Convert().
type Timespan int64

// Compare implements Type interface.
func (t TimespanType_) Compare(s context.Context, a interface{}, b interface{}) (int, error) {
	if hasNulls, res := CompareNulls(a, b); hasNulls {
		return res, nil
	}

	as, err := t.ConvertToTimespan(a)
	if err != nil {
		return 0, err
	}
	bs, err := t.ConvertToTimespan(b)
	if err != nil {
		return 0, err
	}

	return as.Compare(bs), nil
}

func (t TimespanType_) Convert(c context.Context, v interface{}) (interface{}, sql.ConvertInRange, error) {
	if v == nil {
		return nil, sql.InRange, nil
	}
	ret, err := t.ConvertToTimespan(v)
	return ret, sql.InRange, err
}

// ConvertToTimespan converts the given interface value to a Timespan. This follows the conversion rules of MySQL, which
// are based on the base-10 visual representation of numbers (for example, Time.Convert() will interpret the value
// `1234` as 12 minutes and 34 seconds). Returns an error on a nil value.
func (t TimespanType_) ConvertToTimespan(v interface{}) (Timespan, error) {
	switch value := v.(type) {
	case Timespan:
		// We only create a Timespan if it's valid, so we can skip this check if we receive a Timespan.
		// Timespan values are not intended to be modified by an integrator, therefore it is on the integrator if they corrupt a Timespan.
		return value, nil
	case int:
		return t.ConvertToTimespan(int64(value))
	case uint:
		return t.ConvertToTimespan(int64(value))
	case int8:
		return t.ConvertToTimespan(int64(value))
	case uint8:
		return t.ConvertToTimespan(int64(value))
	case int16:
		return t.ConvertToTimespan(int64(value))
	case uint16:
		return t.ConvertToTimespan(int64(value))
	case int32:
		return t.ConvertToTimespan(int64(value))
	case uint32:
		return t.ConvertToTimespan(int64(value))
	case int64:
		absValue := int64Abs(value)
		if absValue >= -59 && absValue <= 59 {
			return t.MicrosecondsToTimespan(value * microsecondsPerSecond), nil
		} else if absValue >= 100 && absValue <= 9999 {
			minutes := absValue / 100
			seconds := absValue % 100
			if minutes <= 59 && seconds <= 59 {
				microseconds := (seconds * microsecondsPerSecond) + (minutes * microsecondsPerMinute)
				if value < 0 {
					return t.MicrosecondsToTimespan(-1 * microseconds), nil
				}
				return t.MicrosecondsToTimespan(microseconds), nil
			}
		} else if absValue >= 10000 && absValue <= 9999999 {
			hours := absValue / 10000
			minutes := (absValue / 100) % 100
			seconds := absValue % 100
			if minutes <= 59 && seconds <= 59 {
				microseconds := (seconds * microsecondsPerSecond) + (minutes * microsecondsPerMinute) + (hours * microsecondsPerHour)
				if value < 0 {
					return t.MicrosecondsToTimespan(-1 * microseconds), nil
				}
				return t.MicrosecondsToTimespan(microseconds), nil
			}
		}
	case uint64:
		return t.ConvertToTimespan(int64(value))
	case float32:
		return t.ConvertToTimespan(float64(value))
	case float64:
		intValue := int64(value)
		microseconds := int64Abs(int64(math.Round((value - float64(intValue)) * float64(microsecondsPerSecond))))
		absValue := int64Abs(intValue)
		if absValue >= -59 && absValue <= 59 {
			totalMicroseconds := (absValue * microsecondsPerSecond) + microseconds
			if value < 0 {
				return t.MicrosecondsToTimespan(-1 * totalMicroseconds), nil
			}
			return t.MicrosecondsToTimespan(totalMicroseconds), nil
		} else if absValue >= 100 && absValue <= 9999 {
			minutes := absValue / 100
			seconds := absValue % 100
			if minutes <= 59 && seconds <= 59 {
				totalMicroseconds := (seconds * microsecondsPerSecond) + (minutes * microsecondsPerMinute) + microseconds
				if value < 0 {
					return t.MicrosecondsToTimespan(-1 * totalMicroseconds), nil
				}
				return t.MicrosecondsToTimespan(totalMicroseconds), nil
			}
		} else if absValue >= 10000 && absValue <= 9999999 {
			hours := absValue / 10000
			minutes := (absValue / 100) % 100
			seconds := absValue % 100
			if minutes <= 59 && seconds <= 59 {
				totalMicroseconds := (seconds * microsecondsPerSecond) + (minutes * microsecondsPerMinute) + (hours * microsecondsPerHour) + microseconds
				if value < 0 {
					return t.MicrosecondsToTimespan(-1 * totalMicroseconds), nil
				}
				return t.MicrosecondsToTimespan(totalMicroseconds), nil
			}
		}
	case decimal.Decimal:
		return t.ConvertToTimespan(value.IntPart())
	case decimal.NullDecimal:
		if value.Valid {
			return t.ConvertToTimespan(value.Decimal.IntPart())
		}
	case string:
		impl, err := stringToTimespan(value)
		if err == nil {
			return impl, nil
		}
		if strings.Contains(value, ".") {
			strAsDouble, err := strconv.ParseFloat(value, 64)
			if err != nil {
				return Timespan(0), ErrConvertingToTimeType.New(v)
			}
			return t.ConvertToTimespan(strAsDouble)
		} else {
			strAsInt, err := strconv.ParseInt(value, 10, 64)
			if err != nil {
				return Timespan(0), ErrConvertingToTimeType.New(v)
			}
			return t.ConvertToTimespan(strAsInt)
		}
	case time.Duration:
		microseconds := value.Nanoseconds() / nanosecondsPerMicrosecond
		return t.MicrosecondsToTimespan(microseconds), nil
	case time.Time:
		h, m, s := value.Clock()
		us := int64(value.Nanosecond())/nanosecondsPerMicrosecond +
			microsecondsPerSecond*int64(s) +
			microsecondsPerMinute*int64(m) +
			microsecondsPerHour*int64(h)
		return Timespan(us), nil
	}

	return Timespan(0), ErrConvertingToTimeType.New(v)
}

// ConvertToTimeDuration implements the TimeType interface.
func (t TimespanType_) ConvertToTimeDuration(v interface{}) (time.Duration, error) {
	val, err := t.ConvertToTimespan(v)
	if err != nil {
		return time.Duration(0), err
	}
	return val.AsTimeDuration(), nil
}

// Equals implements the Type interface.
func (t TimespanType_) Equals(otherType sql.Type) bool {
	_, ok := otherType.(TimespanType_)
	return ok
}

// Promote implements the Type interface.
func (t TimespanType_) Promote() sql.Type {
	return t
}

// SQL implements Type interface.
func (t TimespanType_) SQL(_ *sql.Context, dest []byte, v interface{}) (sqltypes.Value, error) {
	if v == nil {
		return sqltypes.NULL, nil
	}
	ti, err := t.ConvertToTimespan(v)
	if err != nil {
		return sqltypes.Value{}, err
	}

	val := ti.Bytes()
	return sqltypes.MakeTrusted(sqltypes.Time, val), nil
}

// String implements Type interface.
func (t TimespanType_) String() string {
	return "time(6)"
}

// Type implements Type interface.
func (t TimespanType_) Type() query.Type {
	return sqltypes.Time
}

// ValueType implements Type interface.
func (t TimespanType_) ValueType() reflect.Type {
	return timeValueType
}

// Zero implements Type interface.
func (t TimespanType_) Zero() interface{} {
	return Timespan(0)
}

// CollationCoercibility implements sql.CollationCoercible interface.
func (TimespanType_) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

// No built in for absolute values on int64
func int64Abs(v int64) int64 {
	shift := v >> 63
	return (v ^ shift) - shift
}

func stringToTimespan(s string) (Timespan, error) {
	var negative bool
	var hours int16
	var minutes int8
	var seconds int8
	var microseconds int32

	if len(s) > 0 && s[0] == '-' {
		negative = true
		s = s[1:]
	}

	comps := strings.SplitN(s, ".", 2)

	// Parse microseconds
	if len(comps) == 2 {
		microStr := comps[1]
		if len(microStr) < 6 {
			microStr += strings.Repeat("0", 6-len(comps[1]))
		}
		microStr, remainStr := microStr[0:6], microStr[6:]
		convertedMicroseconds, err := strconv.Atoi(microStr)
		if err != nil {
			return Timespan(0), ErrConvertingToTimeType.New(s)
		}
		// MySQL just uses the last digit to round up. This is weird, but matches their implementation.
		if len(remainStr) > 0 && remainStr[len(remainStr)-1:] >= "5" {
			convertedMicroseconds++
		}
		microseconds = int32(convertedMicroseconds)
	}

	// Parse H-M-S time
	hmsComps := strings.SplitN(comps[0], ":", 3)
	hms := make([]string, 3)
	if len(hmsComps) >= 2 {
		if len(hmsComps[0]) > 3 {
			return Timespan(0), ErrConvertingToTimeType.New(s)
		}
		hms[0] = hmsComps[0]
		if len(hmsComps[1]) > 2 {
			return Timespan(0), ErrConvertingToTimeType.New(s)
		}
		hms[1] = hmsComps[1]
		if len(hmsComps) == 3 {
			if len(hmsComps[2]) > 2 {
				return Timespan(0), ErrConvertingToTimeType.New(s)
			}
			hms[2] = hmsComps[2]
		}
	} else {
		l := len(hmsComps[0])
		hms[2] = safeSubstr(hmsComps[0], l-2, l)
		hms[1] = safeSubstr(hmsComps[0], l-4, l-2)
		hms[0] = safeSubstr(hmsComps[0], l-7, l-4)
	}

	hmsHours, err := strconv.Atoi(hms[0])
	if len(hms[0]) > 0 && err != nil {
		return Timespan(0), ErrConvertingToTimeType.New(s)
	}
	hours = int16(hmsHours)

	hmsMinutes, err := strconv.Atoi(hms[1])
	if len(hms[1]) > 0 && err != nil {
		return Timespan(0), ErrConvertingToTimeType.New(s)
	} else if hmsMinutes >= 60 {
		return Timespan(0), ErrConvertingToTimeType.New(s)
	}
	minutes = int8(hmsMinutes)

	hmsSeconds, err := strconv.Atoi(hms[2])
	if len(hms[2]) > 0 && err != nil {
		return Timespan(0), ErrConvertingToTimeType.New(s)
	} else if hmsSeconds >= 60 {
		return Timespan(0), ErrConvertingToTimeType.New(s)
	}
	seconds = int8(hmsSeconds)

	if microseconds == int32(microsecondsPerSecond) {
		microseconds = 0
		seconds++
	}
	if seconds == 60 {
		seconds = 0
		minutes++
	}
	if minutes == 60 {
		minutes = 0
		hours++
	}

	if hours > 838 {
		hours = 838
		minutes = 59
		seconds = 59
	}

	if hours == 838 && minutes == 59 && seconds == 59 {
		microseconds = 0
	}

	return unitsToTimespan(negative, hours, minutes, seconds, microseconds), nil
}

func safeSubstr(s string, start int, end int) string {
	if start < 0 {
		start = 0
	}
	if end < 0 {
		end = 0
	}
	if start > len(s) {
		start = len(s)
		end = len(s)
	} else if end > len(s) {
		end = len(s)
	}
	return s[start:end]
}

// MicrosecondsToTimespan implements the TimeType interface.
func (_ TimespanType_) MicrosecondsToTimespan(v int64) Timespan {
	if v < timespanMinimum {
		v = timespanMinimum
	} else if v > timespanMaximum {
		v = timespanMaximum
	}
	return Timespan(v)
}

func unitsToTimespan(isNegative bool, hours int16, minutes int8, seconds int8, microseconds int32) Timespan {
	negative := int64(1)
	if isNegative {
		negative = -1
	}
	return Timespan(negative *
		(int64(microseconds) +
			(int64(seconds) * microsecondsPerSecond) +
			(int64(minutes) * microsecondsPerMinute) +
			(int64(hours) * microsecondsPerHour)))
}

func (t Timespan) timespanToUnits() (isNegative bool, hours int16, minutes int8, seconds int8, microseconds int32) {
	isNegative = t < 0
	absV := int64Abs(int64(t))
	hours = int16(absV / microsecondsPerHour)
	minutes = int8((absV / microsecondsPerMinute) % 60)
	seconds = int8((absV / microsecondsPerSecond) % 60)
	microseconds = int32(absV % microsecondsPerSecond)
	return
}

// String returns the Timespan formatted as a string (such as for display purposes).
func (t Timespan) String() string {
	return string(t.Bytes())
}

func (t Timespan) Bytes() []byte {
	isNegative, hours, minutes, seconds, microseconds := t.timespanToUnits()
	sz := 10
	if microseconds > 0 {
		sz += 7
	}
	ret := make([]byte, sz)
	i := 0
	if isNegative {
		ret[0] = '-'
		i++
	}

	i = appendDigit(int64(hours), 2, ret, i)
	ret[i] = ':'
	i++
	i = appendDigit(int64(minutes), 2, ret, i)
	ret[i] = ':'
	i++
	i = appendDigit(int64(seconds), 2, ret, i)
	if microseconds > 0 {
		ret[i] = '.'
		i++
		i = appendDigit(int64(microseconds), 6, ret, i)
	}

	return ret[:i]
}

// appendDigit format prints 0-entended integer into buffer
func appendDigit(v int64, extend int, buf []byte, i int) int {
	cmp := int64(1)
	for _ = range extend - 1 {
		cmp *= 10
	}
	for cmp > 0 && v < cmp {
		buf[i] = '0'
		i++
		cmp /= 10
	}
	if v == 0 {
		return i
	}
	tmpBuf := strconv.AppendInt(buf[i:i], v, 10)
	return i + len(tmpBuf)
}

// AsMicroseconds returns the Timespan in microseconds.
func (t Timespan) AsMicroseconds() int64 {
	// Timespan already being implemented in microseconds is an implementation detail that integrators do not need to
	// know about. This is also the reason for the comparison functions.
	return int64(t)
}

// AsTimeDuration returns the Timespan as a time.Duration.
func (t Timespan) AsTimeDuration() time.Duration {
	return time.Duration(t.AsMicroseconds() * nanosecondsPerMicrosecond)
}

// Equals returns whether the calling Timespan and given Timespan are equivalent.
func (t Timespan) Equals(other Timespan) bool {
	return t == other
}

// Compare returns an integer comparing two values. The result will be 0 if t==other, -1 if t < other, and +1 if t > other.
func (t Timespan) Compare(other Timespan) int {
	if t < other {
		return -1
	} else if t > other {
		return 1
	}
	return 0
}

// Negate returns a new Timespan that has been negated.
func (t Timespan) Negate() Timespan {
	return -1 * t
}

// Add returns a new Timespan that is the sum of the calling Timespan and given Timespan. The resulting Timespan is
// clamped to the allowed range.
func (t Timespan) Add(other Timespan) Timespan {
	v := int64(t + other)
	if v < timespanMinimum {
		v = timespanMinimum
	} else if v > timespanMaximum {
		v = timespanMaximum
	}
	return Timespan(v)
}

// Subtract returns a new Timespan that is the difference of the calling Timespan and given Timespan. The resulting
// Timespan is clamped to the allowed range.
func (t Timespan) Subtract(other Timespan) Timespan {
	v := int64(t - other)
	if v < timespanMinimum {
		v = timespanMinimum
	} else if v > timespanMaximum {
		v = timespanMaximum
	}
	return Timespan(v)
}
