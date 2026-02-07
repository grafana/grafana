// Copyright 2024 Dolthub, Inc.
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

package function

import (
	"fmt"
	"time"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// ToDays is a function that converts a date to a number of days since year 0.
type ToDays struct {
	expression.UnaryExpression
}

var _ sql.FunctionExpression = (*ToDays)(nil)
var _ sql.CollationCoercible = (*ToDays)(nil)

// NewToDays creates a new ToDays function.
func NewToDays(date sql.Expression) sql.Expression {
	return &ToDays{expression.UnaryExpression{Child: date}}
}

// CollationCoercibility implements sql.CollationCoercible
func (t *ToDays) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

// String implements sql.Stringer
func (t *ToDays) String() string {
	return fmt.Sprintf("%s(%s)", t.FunctionName(), t.Child.String())
}

// FunctionName implements sql.FunctionExpression
func (t *ToDays) FunctionName() string {
	return "to_days"
}

// Description implements sql.FunctionExpression
func (t *ToDays) Description() string {
	return "return the date argument converted to days"
}

// Type implements sql.Expression
func (t *ToDays) Type() sql.Type {
	return types.Int64
}

// WithChildren implements sql.Expression
func (t *ToDays) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(t, len(children), 1)
	}
	return NewToDays(children[0]), nil
}

// countLeapYears returns the number of leap years between year 0 and the given year
func countLeapYears(year int) int {
	if year < 0 {
		return 0
	}
	return year/4 - year/100 + year/400
}

// Eval implements sql.Expression
func (t *ToDays) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	date, err := t.Child.Eval(ctx, row)
	if err != nil {
		return nil, err
	}
	if date == nil {
		return nil, nil
	}

	// Special case for zero date
	if dateStr, isStr := date.(string); isStr && (dateStr == types.ZeroDateStr || dateStr == types.ZeroTimestampDatetimeStr) {
		return nil, nil
	}

	date, _, err = types.Date.Convert(ctx, date)
	if err != nil {
		ctx.Warn(1292, "%s", err.Error())
		return nil, nil
	}
	d := date.(time.Time)

	// Using zeroTime.Sub(date) doesn't work because it overflows time.Duration
	// so we need to calculate the number of days manually
	// Additionally, MySQL states that this function isn't really accurate for dates before the year 1582
	years := d.Year()

	// YearDay includes leap day, so we subtract 1 from years to not count it twice
	res := 365*years + countLeapYears(years-1) + d.YearDay()
	return res, nil
}

// FromDays is a function that returns date for a given number of days since year 0.
type FromDays struct {
	expression.UnaryExpression
}

var _ sql.FunctionExpression = (*FromDays)(nil)
var _ sql.CollationCoercible = (*FromDays)(nil)

// NewFromDays creates a new FromDays function.
func NewFromDays(days sql.Expression) sql.Expression {
	return &FromDays{expression.UnaryExpression{Child: days}}
}

// CollationCoercibility implements sql.CollationCoercible
func (f *FromDays) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

// String implements sql.Stringer
func (f *FromDays) String() string {
	return fmt.Sprintf("%s(%s)", f.FunctionName(), f.Child.String())
}

// FunctionName implements sql.FunctionExpression
func (f *FromDays) FunctionName() string {
	return "from_days"
}

// Description implements sql.FunctionExpression
func (f *FromDays) Description() string {
	return "convert a day number to a date"
}

// Type implements sql.Expression
func (f *FromDays) Type() sql.Type {
	return types.Date
}

// WithChildren implements sql.Expression
func (f *FromDays) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(f, len(children), 1)
	}
	return NewFromDays(children[0]), nil
}

const (
	DaysPerYear     = 365
	DaysPer400Years = 400*DaysPerYear + 97
	DaysPer100Years = 100*DaysPerYear + 24
	DaysPer4Years   = 4*DaysPerYear + 1
)

// daysToYear converts a number of days to number of years since year 0 (including leap years), and the remaining days
func daysToYear(days int64) (int64, int64) {
	// Special case for year 0, which is not a leap year
	years := int64(1)
	days -= DaysPerYear

	years += 400 * (days / DaysPer400Years)
	days %= DaysPer400Years

	years += 100 * (days / DaysPer100Years)
	days %= DaysPer100Years

	years += 4 * (days / DaysPer4Years)
	days %= DaysPer4Years

	years += days / DaysPerYear
	days %= DaysPerYear

	return years, days
}

func isLeapYear(year int64) bool {
	return year != 0 && ((year%4 == 0 && year%100 != 0) || year%400 == 0)
}

var daysPerMonth = [12]int64{31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31}

// daysToMonth converts a number of days to the month and the remaining days in that month
func daysToMonth(year, days int64) (int64, int64) {
	for i, m := range daysPerMonth {
		if i == 1 && isLeapYear(year) {
			m++ // leap day
		}
		if days < m {
			return int64(i + 1), days
		}
		days -= m
	}
	return -1, -1 // should be impossible
}

// Eval implements sql.Expression
func (f *FromDays) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	d, err := f.Child.Eval(ctx, row)
	if err != nil {
		return nil, err
	}
	if d == nil {
		return nil, nil
	}

	d, _, err = types.Int64.Convert(ctx, d)
	if err != nil {
		ctx.Warn(1292, "%s", err.Error())
		return "0000-00-00", nil
	}

	days, ok := d.(int64)
	if !ok {
		return "0000-00-00", nil
	}

	// For some reason, MySQL returns 0000-00-00 for days <= 365
	if days <= DaysPerYear {
		return "0000-00-00", nil
	}
	years, days := daysToYear(days)
	months, days := daysToMonth(years, days)
	return time.Date(int(years), time.Month(months), int(days), 0, 0, 0, 0, time.UTC), nil
}

// LastDay is a function that returns the date at the last day of the month.
type LastDay struct {
	expression.UnaryExpression
}

var _ sql.FunctionExpression = (*LastDay)(nil)
var _ sql.CollationCoercible = (*LastDay)(nil)

// NewLastDay creates a new LastDay function.
func NewLastDay(date sql.Expression) sql.Expression {
	return &LastDay{expression.UnaryExpression{Child: date}}
}

// CollationCoercibility implements sql.CollationCoercible
func (f *LastDay) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

// String implements sql.Stringer
func (f *LastDay) String() string {
	return fmt.Sprintf("%s(%s)", f.FunctionName(), f.Child.String())
}

// FunctionName implements sql.FunctionExpression
func (f *LastDay) FunctionName() string {
	return "last_day"
}

// Description implements sql.FunctionExpression
func (f *LastDay) Description() string {
	return "return the last day of the month for date"
}

// Type implements sql.Expression
func (f *LastDay) Type() sql.Type {
	return types.Date
}

// WithChildren implements sql.Expression
func (f *LastDay) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(f, len(children), 1)
	}
	return NewLastDay(children[0]), nil
}

// lastDay returns the last day of the month for the given year and month
func lastDay(year, month int) int {
	if month == 2 && isLeapYear(int64(year)) {
		return 29
	}
	return int(daysPerMonth[month-1])
}

// Eval implements sql.Expression
func (f *LastDay) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	date, err := f.Child.Eval(ctx, row)
	if err != nil {
		return nil, err
	}
	if date == nil {
		return nil, nil
	}

	date, _, err = types.Date.Convert(ctx, date)
	if err != nil {
		ctx.Warn(1292, "%s", err.Error())
		return nil, nil
	}

	d, ok := date.(time.Time)
	if !ok {
		return nil, nil
	}

	lDay := lastDay(d.Year(), int(d.Month()))
	return time.Date(d.Year(), d.Month(), lDay, 0, 0, 0, 0, time.UTC), nil
}
