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
	"fmt"
	"math"
	"reflect"
	"time"
	"unicode"

	"github.com/dolthub/vitess/go/sqltypes"
	"github.com/dolthub/vitess/go/vt/proto/query"
	"github.com/shopspring/decimal"
	"gopkg.in/src-d/go-errors.v1"

	"github.com/dolthub/go-mysql-server/sql"
)

const ZeroDateStr = "0000-00-00"

const ZeroTimestampDatetimeStr = "0000-00-00 00:00:00"

const MinDatetimeStringLength = 8 // length of "2000-1-1"

const MaxDatetimePrecision = 6

var (
	// ErrConvertingToTime is thrown when a value cannot be converted to a Time
	ErrConvertingToTime = errors.NewKind("Incorrect datetime value: '%v'")

	ErrConvertingToTimeOutOfRange = errors.NewKind("value %q is outside of %v range")

	// datetimeTypeMaxDatetime is the maximum representable Datetime/Date value. MYSQL: 9999-12-31 23:59:59.499999 (microseconds)
	datetimeTypeMaxDatetime = time.Date(9999, 12, 31, 23, 59, 59, 499999000, time.UTC)

	// datetimeTypeMinDatetime is the minimum representable Datetime/Date value. MYSQL: 1000-01-01 00:00:00.000000 (microseconds)
	datetimeTypeMinDatetime = time.Date(1000, 1, 1, 0, 0, 0, 0, time.UTC)

	// datetimeTypeMaxTimestamp is the maximum representable Timestamp value, MYSQL: 2038-01-19 03:14:07.999999 (microseconds)
	datetimeTypeMaxTimestamp = time.Unix(math.MaxInt32, 999999000).UTC()

	// datetimeTypeMinTimestamp is the minimum representable Timestamp value, MYSQL: 1970-01-01 00:00:01.000000 (microseconds)
	datetimeTypeMinTimestamp = time.Unix(1, 0).UTC()

	datetimeTypeMaxDate = time.Date(9999, 12, 31, 0, 0, 0, 0, time.UTC)

	// datetimeTypeMinDate is the minimum representable Date value, MYSQL: 1000-01-01 00:00:00.000000 (microseconds)
	datetimeTypeMinDate = time.Date(1000, 1, 1, 0, 0, 0, 0, time.UTC)

	// The MAX and MIN are extrapolated from commit ff05628a530 in the MySQL source code from my_time.cc
	// datetimeMaxTime is the maximum representable time value, MYSQL: 9999-12-31 23:59:59.999999 (microseconds)
	datetimeMaxTime = time.Date(9999, 12, 31, 23, 59, 59, 999999000, time.UTC)

	// datetimeMinTime is the minimum representable time value, MYSQL: 0000-01-01 00:00:00.000000 (microseconds)
	datetimeMinTime = time.Date(0000, 0, 0, 0, 0, 0, 0, time.UTC)

	DateOnlyLayouts = []string{
		"2006-01-02",
		"2006/01/02",
		"20060102",
		"2006-1-2",
	}

	TimezoneTimestampDatetimeLayout = "2006-01-02 15:04:05.999999999 -0700 MST" // represents standard Time.time.UTC()

	// TimestampDatetimeLayouts hold extra timestamps allowed for parsing. It does
	// not have all the layouts supported by mysql. Missing are two digit year
	// versions of common cases and dates that use non common separators.
	//
	// https://github.com/MariaDB/server/blob/mysql-5.5.36/sql-common/my_time.c#L124
	TimestampDatetimeLayouts = append([]string{
		time.RFC3339Nano,
		"2006-01-02 15:04:05.999999999",
		"2006-1-2 15:4:5.999999999",
		"2006-1-2:15:4:5.999999999",
		time.RFC3339,
		"2006-01-02 15:04:05.",
		"2006-01-02T15:04:05",
		"2006-01-02 15:04:.",
		"2006-01-02 15:04:",
		"2006-01-02 15:04",
		"2006-01-02 15:4",
		"20060102150405",
	}, DateOnlyLayouts...)

	// zeroTime is 0000-01-01 00:00:00 UTC which is the closest Go can get to 0000-00-00 00:00:00
	zeroTime = time.Unix(-62167219200, 0).UTC()

	// Date is a date with day, month and year.
	Date = MustCreateDatetimeType(sqltypes.Date, 0)
	// Datetime is a date and a time with default precision (no fractional seconds).
	Datetime = MustCreateDatetimeType(sqltypes.Datetime, 0)
	// DatetimeMaxPrecision is a date and a time with maximum precision
	DatetimeMaxPrecision = MustCreateDatetimeType(sqltypes.Datetime, MaxDatetimePrecision)
	// Timestamp is a UNIX timestamp with default precision (no fractional seconds).
	Timestamp = MustCreateDatetimeType(sqltypes.Timestamp, 0)
	// TimestampMaxPrecision is a UNIX timestamp with maximum precision
	TimestampMaxPrecision = MustCreateDatetimeType(sqltypes.Timestamp, MaxDatetimePrecision)
	// DatetimeMaxRange is a date and a time with maximum precision and maximum range.
	DatetimeMaxRange = MustCreateDatetimeType(sqltypes.Datetime, MaxDatetimePrecision)

	datetimeValueType = reflect.TypeOf(time.Time{})
)

type datetimeType struct {
	baseType  query.Type
	precision int
}

var _ sql.DatetimeType = datetimeType{}
var _ sql.CollationCoercible = datetimeType{}

// CreateDatetimeType creates a Type dealing with all temporal types that are not TIME nor YEAR.
func CreateDatetimeType(baseType query.Type, precision int) (sql.DatetimeType, error) {
	switch baseType {
	case sqltypes.Date, sqltypes.Datetime, sqltypes.Timestamp:
		if precision < 0 || precision > MaxDatetimePrecision {
			return nil, fmt.Errorf("precision must be between 0 and 6, got %d", precision)
		}
		return datetimeType{
			baseType:  baseType,
			precision: precision,
		}, nil
	}
	return nil, sql.ErrInvalidBaseType.New(baseType.String(), "datetime")
}

// MustCreateDatetimeType is the same as CreateDatetimeType except it panics on errors.
func MustCreateDatetimeType(baseType query.Type, precision int) sql.DatetimeType {
	dt, err := CreateDatetimeType(baseType, precision)
	if err != nil {
		panic(err)
	}
	return dt
}

func (t datetimeType) Precision() int {
	return t.precision
}

// Compare implements Type interface.
func (t datetimeType) Compare(ctx context.Context, a interface{}, b interface{}) (int, error) {
	if hasNulls, res := CompareNulls(a, b); hasNulls {
		return res, nil
	}

	var at time.Time
	var bt time.Time
	var ok bool
	var err error
	if at, ok = a.(time.Time); !ok {
		at, err = ConvertToTime(ctx, a, t)
		if err != nil {
			return 0, err
		}
	} else if t.baseType == sqltypes.Date {
		at = at.Truncate(24 * time.Hour)
	}
	if bt, ok = b.(time.Time); !ok {
		bt, err = ConvertToTime(ctx, b, t)
		if err != nil {
			return 0, err
		}

	} else if t.baseType == sqltypes.Date {
		bt = bt.Truncate(24 * time.Hour)
	}

	if at.Before(bt) {
		return -1, nil
	} else if at.After(bt) {
		return 1, nil
	}
	return 0, nil
}

// Convert implements Type interface.
func (t datetimeType) Convert(ctx context.Context, v interface{}) (interface{}, sql.ConvertInRange, error) {
	if v == nil {
		return nil, sql.InRange, nil
	}
	res, err := ConvertToTime(ctx, v, t)
	if err != nil && !sql.ErrTruncatedIncorrect.Is(err) {
		return nil, sql.OutOfRange, err
	}
	return res, sql.InRange, err
}

// precisionConversion is a conversion ratio to divide time.Second by to truncate the appropriate amount for the
// precision of a type with time info
var precisionConversion = [7]int{
	1, 10, 100, 1_000, 10_000, 100_000, 1_000_000,
}

func ConvertToTime(ctx context.Context, v interface{}, t datetimeType) (time.Time, error) {
	if v == nil {
		return time.Time{}, nil
	}

	res, err := t.ConvertWithoutRangeCheck(ctx, v)
	if err != nil && !sql.ErrTruncatedIncorrect.Is(err) {
		return time.Time{}, err
	}

	if res.Equal(zeroTime) {
		return zeroTime, nil
	}

	// Round the date to the precision of this type
	if t.precision < MaxDatetimePrecision {
		truncationDuration := time.Second / time.Duration(precisionConversion[t.precision])
		res = res.Round(truncationDuration)
	} else {
		res = res.Round(time.Microsecond)
	}

	if t == DatetimeMaxRange {
		validated := ValidateTime(res)
		if validated == nil {
			return time.Time{}, ErrConvertingToTimeOutOfRange.New(v, t)
		}
		return validated.(time.Time), err
	}

	switch t.baseType {
	case sqltypes.Date:
		if res.Year() < 0 || res.Year() > 9999 {
			return time.Time{}, ErrConvertingToTimeOutOfRange.New(res.Format(sql.DateLayout), t.String())
		}
	case sqltypes.Datetime:
		if res.Year() < 0 || res.Year() > 9999 {
			return time.Time{}, ErrConvertingToTimeOutOfRange.New(res.Format(sql.TimestampDatetimeLayout), t.String())
		}
	case sqltypes.Timestamp:
		if ValidateTimestamp(res) == nil {
			return time.Time{}, ErrConvertingToTimeOutOfRange.New(res.Format(sql.TimestampDatetimeLayout), t.String())
		}
	}

	return res, err
}

// ConvertWithoutRangeCheck converts the parameter to time.Time without checking the range.
func (t datetimeType) ConvertWithoutRangeCheck(ctx context.Context, v interface{}) (time.Time, error) {
	var res time.Time

	var err error
	v, err = sql.UnwrapAny(ctx, v)
	if err != nil {
		return time.Time{}, err
	}
	if bs, ok := v.([]byte); ok {
		v = string(bs)
	}
	switch value := v.(type) {
	case string:
		if value == ZeroDateStr || value == ZeroTimestampDatetimeStr {
			return zeroTime, nil
		}
		// TODO: consider not using time.Parse if we want to match MySQL exactly ('2010-06-03 11:22.:.:.:.:' is a valid timestamp)
		var parsed bool
		res, parsed, err = t.parseDatetime(value)
		if !parsed {
			return zeroTime, ErrConvertingToTime.New(v)
		}
	case time.Time:
		res = value.UTC()
		// For most integer values, we just return an error (but MySQL is more lenient for some of these). A special case
		// is zero values, which are important when converting from postgres defaults.
	case int:
		if value == 0 {
			return zeroTime, nil
		}
		return zeroTime, ErrConvertingToTime.New(v)
	case int8:
		if value == 0 {
			return zeroTime, nil
		}
		return zeroTime, ErrConvertingToTime.New(v)
	case int16:
		if value == 0 {
			return zeroTime, nil
		}
		return zeroTime, ErrConvertingToTime.New(v)
	case int32:
		if value == 0 {
			return zeroTime, nil
		}
		return zeroTime, ErrConvertingToTime.New(v)
	case int64:
		if value == 0 {
			return zeroTime, nil
		}
		return zeroTime, ErrConvertingToTime.New(v)
	case uint:
		if value == 0 {
			return zeroTime, nil
		}
		return zeroTime, ErrConvertingToTime.New(v)
	case uint8:
		if value == 0 {
			return zeroTime, nil
		}
		return zeroTime, ErrConvertingToTime.New(v)
	case uint16:
		if value == 0 {
			return zeroTime, nil
		}
		return zeroTime, ErrConvertingToTime.New(v)
	case uint32:
		if value == 0 {
			return zeroTime, nil
		}
		return zeroTime, ErrConvertingToTime.New(v)
	case uint64:
		if value == 0 {
			return zeroTime, nil
		}
		return zeroTime, ErrConvertingToTime.New(v)
	case float32:
		if value == 0 {
			return zeroTime, nil
		}
		return zeroTime, ErrConvertingToTime.New(v)
	case float64:
		if value == 0 {
			return zeroTime, nil
		}
		return zeroTime, ErrConvertingToTime.New(v)
	case decimal.Decimal:
		if value.IsZero() {
			return zeroTime, nil
		}
		return zeroTime, ErrConvertingToTime.New(v)
	case decimal.NullDecimal:
		if value.Valid && value.Decimal.IsZero() {
			return zeroTime, nil
		}
		return zeroTime, ErrConvertingToTime.New(v)
	case Timespan:
		// when receiving TIME, MySQL fills in date with today
		nowTimeStr := sql.Now().Format("2006-01-02")
		nowTime, err := time.Parse("2006-01-02", nowTimeStr)
		if err != nil {
			return zeroTime, ErrConvertingToTime.New(v)
		}
		return nowTime.Add(value.AsTimeDuration()), nil
	default:
		return zeroTime, sql.ErrConvertToSQL.New(value, t)
	}

	if t.baseType == sqltypes.Date {
		res = res.Truncate(24 * time.Hour)
	}

	return res, err
}

func (t datetimeType) parseDatetime(value string) (time.Time, bool, error) {
	if t, err := time.Parse(TimezoneTimestampDatetimeLayout, value); err == nil {
		return t.UTC(), true, nil
	}

	valueLen := len(value)
	end := valueLen

	for end >= MinDatetimeStringLength {
		for _, layout := range TimestampDatetimeLayouts {
			if t, err := time.Parse(layout, value[0:end]); err == nil {
				if end != valueLen {
					err = sql.ErrTruncatedIncorrect.New(t, value)
				}
				return t.UTC(), true, err
			}
		}
		end = findDatetimeEnd(value, end-1)
	}
	return time.Time{}, false, nil
}

// findDatetimeEnd returns the index of the last digit before `end`
func findDatetimeEnd(value string, end int) int {
	for end >= MinDatetimeStringLength {
		char := rune(value[end-1])
		if unicode.IsDigit(char) {
			return end
		}
		end--
	}
	return end
}

// Equals implements the Type interface.
func (t datetimeType) Equals(otherType sql.Type) bool {
	if dtType, isDtType := otherType.(sql.DatetimeType); isDtType {
		return t.baseType == dtType.Type() && t.precision == dtType.Precision()
	}
	return false
}

// MaxTextResponseByteLength implements the Type interface
func (t datetimeType) MaxTextResponseByteLength(*sql.Context) uint32 {
	switch t.baseType {
	case sqltypes.Date:
		return uint32(len(sql.DateLayout))
	case sqltypes.Datetime, sqltypes.Timestamp:
		return uint32(len(sql.TimestampDatetimeLayout))
	default:
		panic(sql.ErrInvalidBaseType.New(t.baseType.String(), "datetime"))
	}
}

// Promote implements the Type interface.
func (t datetimeType) Promote() sql.Type {
	return DatetimeMaxPrecision
}

// SQL implements Type interface.
func (t datetimeType) SQL(ctx *sql.Context, dest []byte, v interface{}) (sqltypes.Value, error) {
	if v == nil {
		return sqltypes.NULL, nil
	}

	vt, err := ConvertToTime(ctx, v, t)
	if err != nil {
		return sqltypes.Value{}, err
	}

	var typ query.Type
	var val []byte

	switch t.baseType {
	case sqltypes.Date:
		typ = sqltypes.Date
		if vt.Equal(zeroTime) {
			val = vt.AppendFormat(dest, ZeroDateStr)
		} else {
			val = vt.AppendFormat(dest, sql.DateLayout)
		}
	case sqltypes.Datetime:
		typ = sqltypes.Datetime
		if vt.Equal(zeroTime) {
			val = vt.AppendFormat(dest, ZeroTimestampDatetimeStr)
		} else {
			val = vt.AppendFormat(dest, sql.TimestampDatetimeLayout)
		}
	case sqltypes.Timestamp:
		typ = sqltypes.Timestamp
		if vt.Equal(zeroTime) {
			val = vt.AppendFormat(dest, ZeroTimestampDatetimeStr)
		} else {
			val = vt.AppendFormat(dest, sql.TimestampDatetimeLayout)
		}
	default:
		return sqltypes.Value{}, sql.ErrInvalidBaseType.New(t.baseType.String(), "datetime")
	}

	valBytes := val

	return sqltypes.MakeTrusted(typ, valBytes), nil
}

func (t datetimeType) String() string {
	switch t.baseType {
	case sqltypes.Date:
		return "date"
	case sqltypes.Datetime:
		if t.precision > 0 {
			return fmt.Sprintf("datetime(%d)", t.precision)
		}
		return "datetime"
	case sqltypes.Timestamp:
		if t.precision > 0 {
			return fmt.Sprintf("timestamp(%d)", t.precision)
		}
		return "timestamp"
	default:
		panic(sql.ErrInvalidBaseType.New(t.baseType.String(), "datetime"))
	}
}

// Type implements Type interface.
func (t datetimeType) Type() query.Type {
	return t.baseType
}

// ValueType implements Type interface.
func (t datetimeType) ValueType() reflect.Type {
	return datetimeValueType
}

func (t datetimeType) Zero() interface{} {
	return zeroTime
}

// CollationCoercibility implements sql.CollationCoercible interface.
func (datetimeType) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

// MaximumTime is the latest accepted time for this type.
func (t datetimeType) MaximumTime() time.Time {
	if t.baseType == sqltypes.Timestamp {
		return datetimeTypeMaxTimestamp
	}
	return datetimeTypeMaxDatetime
}

// MinimumTime is the earliest accepted time for this type.
func (t datetimeType) MinimumTime() time.Time {
	if t.baseType == sqltypes.Timestamp {
		return datetimeTypeMinTimestamp
	}
	return datetimeTypeMinDatetime
}

// ValidateTime receives a time and returns either that time or nil if it's
// not a valid time.
func ValidateTime(t time.Time) interface{} {
	if t.Before(datetimeMinTime) || t.After(datetimeMaxTime) {
		return nil
	}
	return t
}

// ValidateTimestamp receives a time and returns either that time or nil if it's
// not a valid timestamp.
func ValidateTimestamp(t time.Time) interface{} {
	if t.Before(datetimeTypeMinTimestamp) || t.After(datetimeTypeMaxTimestamp) {
		return nil
	}
	return t
}
