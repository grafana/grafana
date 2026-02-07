// Copyright 2020-2021 Dolthub, Inc.
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

package expression

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/dolthub/vitess/go/mysql"
	errors "gopkg.in/src-d/go-errors.v1"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// Interval defines a time duration.
type Interval struct {
	UnaryExpression
	Unit string
}

var _ sql.Expression = (*Interval)(nil)
var _ sql.CollationCoercible = (*Interval)(nil)

// NewInterval creates a new interval expression.
func NewInterval(child sql.Expression, unit string) *Interval {
	return &Interval{UnaryExpression{Child: child}, strings.ToUpper(unit)}
}

// Type implements the sql.Expression interface.
func (i *Interval) Type() sql.Type { return types.Uint64 }

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*Interval) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

// IsNullable implements the sql.Expression interface.
func (i *Interval) IsNullable() bool { return i.Child.IsNullable() }

// Eval implements the sql.Expression interface.
func (i *Interval) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	panic("Interval.Eval is just a placeholder method and should not be called directly")
}

var (
	errInvalidIntervalUnit   = errors.NewKind("invalid interval unit: %s")
	errInvalidIntervalFormat = errors.NewKind("invalid interval format for %q: %s")
)

// EvalDelta evaluates the expression returning a TimeDelta. This method should
// be used instead of Eval, as this expression returns a TimeDelta, which is not
// a valid value that can be returned in Eval.
func (i *Interval) EvalDelta(ctx *sql.Context, row sql.Row) (*TimeDelta, error) {
	val, err := i.Child.Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	if val == nil {
		return nil, nil
	}

	var td TimeDelta

	if r, ok := unitTextFormats[i.Unit]; ok {
		val, _, err = types.LongText.Convert(ctx, val)
		if err != nil {
			return nil, err
		}

		text := val.(string)
		if !r.MatchString(text) {
			return nil, errInvalidIntervalFormat.New(i.Unit, text)
		}

		parts := textFormatParts(text, r)

		switch i.Unit {
		case "DAY_HOUR":
			td.Days = parts[0]
			td.Hours = parts[1]
		case "DAY_MICROSECOND":
			td.Days = parts[0]
			td.Hours = parts[1]
			td.Minutes = parts[2]
			td.Seconds = parts[3]
			td.Microseconds = parts[4]
		case "DAY_MINUTE":
			td.Days = parts[0]
			td.Hours = parts[1]
			td.Minutes = parts[2]
		case "DAY_SECOND":
			td.Days = parts[0]
			td.Hours = parts[1]
			td.Minutes = parts[2]
			td.Seconds = parts[3]
		case "HOUR_MICROSECOND":
			td.Hours = parts[0]
			td.Minutes = parts[1]
			td.Seconds = parts[2]
			td.Microseconds = parts[3]
		case "HOUR_SECOND":
			td.Hours = parts[0]
			td.Minutes = parts[1]
			td.Seconds = parts[2]
		case "HOUR_MINUTE":
			td.Hours = parts[0]
			td.Minutes = parts[1]
		case "MINUTE_MICROSECOND":
			td.Minutes = parts[0]
			td.Seconds = parts[1]
			td.Microseconds = parts[2]
		case "MINUTE_SECOND":
			td.Minutes = parts[0]
			td.Seconds = parts[1]
		case "SECOND_MICROSECOND":
			td.Seconds = parts[0]
			td.Microseconds = parts[1]
		case "YEAR_MONTH":
			td.Years = parts[0]
			td.Months = parts[1]
		default:
			return nil, errInvalidIntervalUnit.New(i.Unit)
		}
	} else {
		val, _, err = types.Int64.Convert(ctx, val)
		if err != nil {
			if !sql.ErrTruncatedIncorrect.Is(err) {
				return nil, err
			}
			ctx.Warn(mysql.ERTruncatedWrongValue, "%s", err.Error())
		}

		num := val.(int64)

		switch i.Unit {
		case "DAY":
			td.Days = num
		case "HOUR":
			td.Hours = num
		case "MINUTE":
			td.Minutes = num
		case "SECOND":
			td.Seconds = num
		case "MICROSECOND":
			td.Microseconds = num
		case "QUARTER":
			td.Months = num * 3
		case "MONTH":
			td.Months = num
		case "WEEK":
			td.Days = num * 7
		case "YEAR":
			td.Years = num
		default:
			return nil, errInvalidIntervalUnit.New(i.Unit)
		}
	}

	return &td, nil
}

// WithChildren implements the Expression interface.
func (i *Interval) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(i, len(children), 1)
	}
	return NewInterval(children[0], i.Unit), nil
}

func (i *Interval) String() string {
	return fmt.Sprintf("INTERVAL %s %s", i.Child, i.Unit)
}

var unitTextFormats = map[string]*regexp.Regexp{
	"DAY_HOUR":           regexp.MustCompile(`^(\d+)\s+(\d+)$`),
	"DAY_MICROSECOND":    regexp.MustCompile(`^(\d+)\s+(\d+):(\d+):(\d+).(\d+)$`),
	"DAY_MINUTE":         regexp.MustCompile(`^(\d+)\s+(\d+):(\d+)$`),
	"DAY_SECOND":         regexp.MustCompile(`^(\d+)\s+(\d+):(\d+):(\d+)$`),
	"HOUR_MICROSECOND":   regexp.MustCompile(`^(\d+):(\d+):(\d+).(\d+)$`),
	"HOUR_SECOND":        regexp.MustCompile(`^(\d+):(\d+):(\d+)$`),
	"HOUR_MINUTE":        regexp.MustCompile(`^(\d+):(\d+)$`),
	"MINUTE_MICROSECOND": regexp.MustCompile(`^(\d+):(\d+).(\d+)$`),
	"MINUTE_SECOND":      regexp.MustCompile(`^(\d+):(\d+)$`),
	"SECOND_MICROSECOND": regexp.MustCompile(`^(\d+).(\d+)$`),
	"YEAR_MONTH":         regexp.MustCompile(`^(\d+)-(\d+)$`),
}

func textFormatParts(text string, r *regexp.Regexp) []int64 {
	parts := r.FindStringSubmatch(text)
	var result []int64
	for _, p := range parts[1:] {
		// It is safe to ignore the error here, because at this point we know
		// the string matches the regexp, and that means it can't be an
		// invalid number.
		n, _ := strconv.ParseInt(p, 10, 64)
		result = append(result, n)
	}
	return result
}

// TimeDelta is the difference between a time and another time.
type TimeDelta struct {
	Years        int64
	Months       int64
	Days         int64
	Hours        int64
	Minutes      int64
	Seconds      int64
	Microseconds int64
}

// Add returns the given time plus the time delta.
func (td TimeDelta) Add(t time.Time) time.Time {
	return td.apply(t, 1)
}

// Sub returns the given time minus the time delta.
func (td TimeDelta) Sub(t time.Time) time.Time {
	return td.apply(t, -1)
}

const (
	day  = 24 * time.Hour
	week = 7 * day
)

// isLeapYear determines if a given year is a leap year
func isLeapYear(year int) bool {
	return daysInMonth(year, time.February) == 29
}

// daysInMonth returns the number of days in a given month/year combination
func daysInMonth(year int, month time.Month) int {
	return time.Date(year, month+1, 0, 0, 0, 0, 0, time.UTC).Day()
}

// apply applies the time delta to the given time, using the specified sign
func (td TimeDelta) apply(t time.Time, sign int64) time.Time {
	if td.Years != 0 {
		targetYear := t.Year() + int(td.Years*sign)

		// special handling for Feb 29 on leap years
		if t.Month() == time.February && t.Day() == 29 && !isLeapYear(targetYear) {
			// if we're on Feb 29 and target year is not a leap year,
			// move to Feb 28
			t = time.Date(targetYear, time.February, 28,
				t.Hour(), t.Minute(), t.Second(), t.Nanosecond(), t.Location())
		} else {
			t = time.Date(targetYear, t.Month(), t.Day(),
				t.Hour(), t.Minute(), t.Second(), t.Nanosecond(), t.Location())
		}
	}

	if td.Months != 0 {
		totalMonths := int(t.Month()) - 1 + int(td.Months*sign) // convert to 0-based

		// calculate target year and month
		yearOffset := totalMonths / 12
		if totalMonths < 0 {
			yearOffset = (totalMonths - 11) / 12 // handle negative division correctly
		}
		targetYear := t.Year() + yearOffset
		targetMonth := time.Month((totalMonths%12+12)%12 + 1) // ensure positive month

		// handle end-of-month edge cases
		originalDay := t.Day()
		maxDaysInTargetMonth := daysInMonth(targetYear, targetMonth)

		targetDay := originalDay
		if originalDay > maxDaysInTargetMonth {
			targetDay = maxDaysInTargetMonth
		}

		t = time.Date(targetYear, targetMonth, targetDay,
			t.Hour(), t.Minute(), t.Second(), t.Nanosecond(), t.Location())
	}

	if td.Days != 0 {
		t = t.AddDate(0, 0, int(td.Days*sign))
	}

	duration := time.Duration(td.Hours*sign)*time.Hour +
		time.Duration(td.Minutes*sign)*time.Minute +
		time.Duration(td.Seconds*sign)*time.Second +
		time.Duration(td.Microseconds*sign)*time.Microsecond

	if duration != 0 {
		t = t.Add(duration)
	}

	return t
}
