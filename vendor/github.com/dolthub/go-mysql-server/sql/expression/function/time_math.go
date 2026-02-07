// Copyright 2021 Dolthub, Inc.
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
	"math"
	"strings"
	"time"

	"gopkg.in/src-d/go-errors.v1"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// DateDiff returns expr1 − expr2 expressed as a value in days from one date to the other.
type DateDiff struct {
	expression.BinaryExpressionStub
}

var _ sql.FunctionExpression = (*DateDiff)(nil)
var _ sql.CollationCoercible = (*DateDiff)(nil)

// NewDateDiff creates a new DATEDIFF() function.
func NewDateDiff(expr1, expr2 sql.Expression) sql.Expression {
	return &DateDiff{
		expression.BinaryExpressionStub{
			LeftChild:  expr1,
			RightChild: expr2,
		},
	}
}

// FunctionName implements sql.FunctionExpression
func (d *DateDiff) FunctionName() string {
	return "datediff"
}

// Description implements sql.FunctionExpression
func (d *DateDiff) Description() string {
	return "gets difference between two dates in result of days."
}

// String implements Stringer
func (d *DateDiff) String() string {
	return fmt.Sprintf("DATEDIFF(%s, %s)", d.LeftChild, d.RightChild)
}

// Type implements the sql.Expression interface.
func (d *DateDiff) Type() sql.Type { return types.Int64 }

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*DateDiff) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

// WithChildren implements the Expression interface.
func (d *DateDiff) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 2 {
		return nil, sql.ErrInvalidChildrenNumber.New(d, len(children), 2)
	}
	return NewDateDiff(children[0], children[1]), nil
}

// Eval implements the sql.Expression interface.
func (d *DateDiff) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	if d.LeftChild == nil || d.RightChild == nil {
		return nil, nil
	}

	expr1, err := d.LeftChild.Eval(ctx, row)
	if err != nil {
		return nil, err
	}
	if expr1 == nil {
		return nil, nil
	}

	expr1, _, err = types.DatetimeMaxPrecision.Convert(ctx, expr1)
	if err != nil {
		return nil, err
	}

	expr1str := expr1.(time.Time).String()[:10]
	expr1, _, _ = types.DatetimeMaxPrecision.Convert(ctx, expr1str)

	expr2, err := d.RightChild.Eval(ctx, row)
	if err != nil {
		return nil, err
	}
	if expr2 == nil {
		return nil, nil
	}

	expr2, _, err = types.DatetimeMaxPrecision.Convert(ctx, expr2)
	if err != nil {
		return nil, err
	}

	expr2str := expr2.(time.Time).String()[:10]
	expr2, _, _ = types.DatetimeMaxPrecision.Convert(ctx, expr2str)

	date1 := expr1.(time.Time)
	date2 := expr2.(time.Time)

	diff := int64(math.Round(date1.Sub(date2).Hours() / 24))

	return diff, nil
}

// DateAdd adds an interval to a date.
type DateAdd struct {
	Date     sql.Expression
	Interval *expression.Interval
}

var _ sql.FunctionExpression = (*DateAdd)(nil)
var _ sql.CollationCoercible = (*DateAdd)(nil)

// NewDateAdd creates a new date add function.
func NewDateAdd(args ...sql.Expression) (sql.Expression, error) {
	if len(args) != 2 {
		return nil, sql.ErrInvalidArgumentNumber.New("DATE_ADD", 2, len(args))
	}

	i, ok := args[1].(*expression.Interval)
	if !ok {
		return nil, fmt.Errorf("DATE_ADD expects an interval as second parameter")
	}

	return &DateAdd{args[0], i}, nil
}

// NewAddDate returns a new function expression, or an error if one couldn't be created. The ADDDATE
// function is a synonym for DATE_ADD, with the one exception that if the second argument is NOT an
// explicitly declared interval, then the value is used and the interval period is assumed to be DAY.
// In either case, this function will actually return a *DateAdd struct.
func NewAddDate(args ...sql.Expression) (sql.Expression, error) {
	if len(args) != 2 {
		return nil, sql.ErrInvalidArgumentNumber.New("ADDDATE", 2, len(args))
	}

	// If the interval is explicitly specified, then we simply pass it all to DateSub
	i, ok := args[1].(*expression.Interval)
	if ok {
		return &DateAdd{args[0], i}, nil
	}

	// Otherwise, the interval period is assumed to be DAY
	i = expression.NewInterval(args[1], "DAY")
	return &DateAdd{args[0], i}, nil
}

// FunctionName implements sql.FunctionExpression
func (d *DateAdd) FunctionName() string {
	return "date_add"
}

// Description implements sql.FunctionExpression
func (d *DateAdd) Description() string {
	return "adds the interval to the given date."
}

// String implements Stringer
func (d *DateAdd) String() string {
	return fmt.Sprintf("%s(%s,%s)", d.FunctionName(), d.Date, d.Interval)
}

// Children implements the sql.Expression interface.
func (d *DateAdd) Children() []sql.Expression {
	return []sql.Expression{d.Date, d.Interval}
}

// Resolved implements the sql.Expression interface.
func (d *DateAdd) Resolved() bool {
	return d.Date.Resolved() && d.Interval.Resolved()
}

// IsNullable implements the sql.Expression interface.
func (d *DateAdd) IsNullable() bool {
	return true
}

// Type implements the sql.Expression interface.
func (d *DateAdd) Type() sql.Type {
	sqlType := dateOffsetType(d.Date, d.Interval)
	return sqlType
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*DateAdd) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return ctx.GetCollation(), 4
}

// WithChildren implements the Expression interface.
func (d *DateAdd) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	return NewDateAdd(children...)
}

// Eval implements the sql.Expression interface.
func (d *DateAdd) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	date, err := d.Date.Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	if date == nil {
		return nil, nil
	}

	delta, err := d.Interval.EvalDelta(ctx, row)
	if err != nil {
		return nil, err
	}

	if delta == nil {
		return nil, nil
	}

	var dateVal interface{}
	dateVal, _, err = types.DatetimeMaxRange.Convert(ctx, date)
	if err != nil {
		ctx.Warn(1292, "%s", err.Error())
		return nil, nil
	}

	// return appropriate type
	res := types.ValidateTime(delta.Add(dateVal.(time.Time)))
	if res == nil {
		return nil, nil
	}

	resType := d.Type()
	if types.IsText(resType) {
		// If the input is a properly formatted date/datetime string, the output should also be a string
		if dateStr, isStr := date.(string); isStr {
			if res.(time.Time).Nanosecond() > 0 {
				return res.(time.Time).Format(sql.DatetimeLayoutNoTrim), nil
			}
			if isHmsInterval(d.Interval) {
				return res.(time.Time).Format(sql.TimestampDatetimeLayout), nil
			}
			for _, layout := range types.DateOnlyLayouts {
				if _, pErr := time.Parse(layout, dateStr); pErr != nil {
					continue
				}
				return res.(time.Time).Format(sql.DateLayout), nil
			}
		}
	}

	ret, _, err := resType.Convert(ctx, res)
	if err != nil {
		return nil, err
	}
	return ret, nil
}

// DateSub subtracts an interval from a date.
type DateSub struct {
	Date     sql.Expression
	Interval *expression.Interval
}

var _ sql.FunctionExpression = (*DateSub)(nil)
var _ sql.CollationCoercible = (*DateSub)(nil)

// NewDateSub creates a new date add function.
func NewDateSub(args ...sql.Expression) (sql.Expression, error) {
	if len(args) != 2 {
		return nil, sql.ErrInvalidArgumentNumber.New("DATE_SUB", 2, len(args))
	}

	i, ok := args[1].(*expression.Interval)
	if !ok {
		return nil, fmt.Errorf("DATE_SUB expects an interval as second parameter")
	}

	return &DateSub{args[0], i}, nil
}

// NewSubDate returns a new function expression, or an error if one couldn't be created. The SUBDATE
// function is a synonym for DATE_SUB, with the one exception that if the second argument is NOT an
// explicitly declared interval, then the value is used and the interval period is assumed to be DAY.
// In either case, this function will actually return a *DateSub struct.
func NewSubDate(args ...sql.Expression) (sql.Expression, error) {
	if len(args) != 2 {
		return nil, sql.ErrInvalidArgumentNumber.New("SUBDATE", 2, len(args))
	}

	// If the interval is explicitly specified, then we simply pass it all to DateSub
	i, ok := args[1].(*expression.Interval)
	if ok {
		return &DateSub{args[0], i}, nil
	}

	// Otherwise, the interval period is assumed to be DAY
	i = expression.NewInterval(args[1], "DAY")
	return &DateSub{args[0], i}, nil
}

// FunctionName implements sql.FunctionExpression
func (d *DateSub) FunctionName() string {
	return "date_sub"
}

// Description implements sql.FunctionExpression
func (d *DateSub) Description() string {
	return "subtracts the interval from the given date."
}

// String implements Stringer
func (d *DateSub) String() string {
	return fmt.Sprintf("%s(%s,%s)", d.FunctionName(), d.Date, d.Interval)
}

// Children implements the sql.Expression interface.
func (d *DateSub) Children() []sql.Expression {
	return []sql.Expression{d.Date, d.Interval}
}

// Resolved implements the sql.Expression interface.
func (d *DateSub) Resolved() bool {
	return d.Date.Resolved() && d.Interval.Resolved()
}

// IsNullable implements the sql.Expression interface.
func (d *DateSub) IsNullable() bool {
	return true
}

// Type implements the sql.Expression interface.
func (d *DateSub) Type() sql.Type {
	sqlType := dateOffsetType(d.Date, d.Interval)
	return sqlType
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*DateSub) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return ctx.GetCollation(), 4
}

// WithChildren implements the Expression interface.
func (d *DateSub) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	return NewDateSub(children...)
}

// Eval implements the sql.Expression interface.
func (d *DateSub) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	date, err := d.Date.Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	if date == nil {
		return nil, nil
	}

	delta, err := d.Interval.EvalDelta(ctx, row)
	if err != nil {
		return nil, err
	}

	if delta == nil {
		return nil, nil
	}

	var dateVal interface{}
	dateVal, _, err = types.DatetimeMaxRange.Convert(ctx, date)
	if err != nil {
		ctx.Warn(1292, "%s", err.Error())
		return nil, nil
	}

	// return appropriate type
	res := types.ValidateTime(delta.Sub(dateVal.(time.Time)))
	if res == nil {
		return nil, nil
	}

	resType := d.Type()
	if types.IsText(resType) {
		// If the input is a properly formatted date/datetime string, the output should also be a string
		if dateStr, isStr := date.(string); isStr {
			if res.(time.Time).Nanosecond() > 0 {
				return res.(time.Time).Format(sql.DatetimeLayoutNoTrim), nil
			}
			if isHmsInterval(d.Interval) {
				return res.(time.Time).Format(sql.TimestampDatetimeLayout), nil
			}
			for _, layout := range types.DateOnlyLayouts {
				if _, pErr := time.Parse(layout, dateStr); pErr != nil {
					continue
				}
				return res.(time.Time).Format(sql.DateLayout), nil
			}
		}
	}

	ret, _, err := resType.Convert(ctx, res)
	if err != nil {
		return nil, err
	}
	return ret, nil
}

// TimeDiff subtracts the second argument from the first expressed as a time value.
type TimeDiff struct {
	expression.BinaryExpressionStub
}

var _ sql.FunctionExpression = (*TimeDiff)(nil)
var _ sql.CollationCoercible = (*TimeDiff)(nil)

// NewTimeDiff creates a new NewTimeDiff expression.
func NewTimeDiff(e1, e2 sql.Expression) sql.Expression {
	return &TimeDiff{
		expression.BinaryExpressionStub{
			LeftChild:  e1,
			RightChild: e2,
		},
	}
}

// FunctionName implements sql.FunctionExpression
func (td *TimeDiff) FunctionName() string {
	return "timediff"
}

// Description implements sql.FunctionExpression
func (td *TimeDiff) Description() string {
	return "returns expr1 − expr2 expressed as a time value. expr1 and expr2 are time or date-and-time expressions, but both must be of the same type."
}

// Type implements the Expression interface.
func (td *TimeDiff) Type() sql.Type { return types.Time }

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*TimeDiff) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

func (td *TimeDiff) String() string {
	return fmt.Sprintf("%s(%s,%s)", td.FunctionName(), td.LeftChild, td.RightChild)
}

// WithChildren implements the Expression interface.
func (td *TimeDiff) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 2 {
		return nil, sql.ErrInvalidChildrenNumber.New(td, len(children), 2)
	}
	return NewTimeDiff(children[0], children[1]), nil
}

func convToDateOrTime(ctx *sql.Context, val interface{}) (interface{}, error) {
	date, _, err := types.DatetimeMaxPrecision.Convert(ctx, val)
	if err == nil {
		return date, nil
	}
	tim, _, err := types.Time.Convert(ctx, val)
	if err == nil {
		return tim, err
	}
	return nil, err
}

// Eval implements the Expression interface.
func (td *TimeDiff) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	if td.LeftChild == nil || td.RightChild == nil {
		return nil, nil
	}

	left, err := td.LeftChild.Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	right, err := td.RightChild.Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	if left == nil || right == nil {
		return nil, nil
	}

	// always convert string types
	if _, ok := left.(string); ok {
		left, err = convToDateOrTime(ctx, left)
		if err != nil {
			ctx.Warn(1292, "%s", err.Error())
			return nil, nil
		}
	}
	if _, ok := right.(string); ok {
		right, err = convToDateOrTime(ctx, right)
		if err != nil {
			ctx.Warn(1292, "%s", err.Error())
			return nil, nil
		}
	}

	// handle as date
	if leftDatetime, ok := left.(time.Time); ok {
		rightDatetime, ok := right.(time.Time)
		if !ok {
			return nil, nil
		}
		if leftDatetime.Location() != rightDatetime.Location() {
			rightDatetime = rightDatetime.In(leftDatetime.Location())
		}
		ret, _, err := types.Time.Convert(ctx, leftDatetime.Sub(rightDatetime))
		return ret, err
	}

	// handle as time
	if leftTime, ok := left.(types.Timespan); ok {
		rightTime, ok := right.(types.Timespan)
		if !ok {
			return nil, nil
		}
		return leftTime.Subtract(rightTime), nil
	}
	return nil, sql.ErrInvalidArgumentType.New("timediff")
}

// TimestampDiff returns expr1 − expr2 expressed as a value in unit specified.
type TimestampDiff struct {
	unit  sql.Expression
	expr1 sql.Expression
	expr2 sql.Expression
}

var _ sql.FunctionExpression = (*TimestampDiff)(nil)
var _ sql.CollationCoercible = (*TimestampDiff)(nil)

// NewTimestampDiff creates a new TIMESTAMPDIFF() function.
func NewTimestampDiff(u, e1, e2 sql.Expression) sql.Expression {
	return &TimestampDiff{u, e1, e2}
}

// FunctionName implements sql.FunctionExpression
func (t *TimestampDiff) FunctionName() string {
	return "timestampdiff"
}

// Description implements sql.FunctionExpression
func (t *TimestampDiff) Description() string {
	return "gets difference between two dates in result of units specified."
}

// String implements Stringer
func (t *TimestampDiff) String() string {
	return fmt.Sprintf("TIMESTAMPDIFF(%s, %s, %s)", t.unit, t.expr1, t.expr2)
}

// Children implements the sql.Expression interface.
func (t *TimestampDiff) Children() []sql.Expression {
	return []sql.Expression{t.unit, t.expr1, t.expr2}
}

// Resolved implements the sql.Expression interface.
func (t *TimestampDiff) Resolved() bool {
	return t.unit.Resolved() && t.expr1.Resolved() && t.expr2.Resolved()
}

// IsNullable implements the sql.Expression interface.
func (t *TimestampDiff) IsNullable() bool {
	return t.unit.IsNullable() && t.expr1.IsNullable() && t.expr2.IsNullable()
}

// Type implements the sql.Expression interface.
func (t *TimestampDiff) Type() sql.Type { return types.Int64 }

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*TimestampDiff) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

// WithChildren implements the Expression interface.
func (t *TimestampDiff) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 3 {
		return nil, sql.ErrInvalidChildrenNumber.New(t, len(children), 3)
	}
	return NewTimestampDiff(children[0], children[1], children[2]), nil
}

// Eval implements the sql.Expression interface.
func (t *TimestampDiff) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	if t.unit == nil {
		return nil, errors.NewKind("unit cannot be null").New(t.unit)
	}
	if t.expr1 == nil || t.expr2 == nil {
		return nil, nil
	}

	expr1, err := t.expr1.Eval(ctx, row)
	if err != nil {
		return nil, err
	}
	if expr1 == nil {
		return nil, nil
	}

	expr2, err := t.expr2.Eval(ctx, row)
	if err != nil {
		return nil, err
	}
	if expr2 == nil {
		return nil, nil
	}

	expr1, _, err = types.DatetimeMaxPrecision.Convert(ctx, expr1)
	if err != nil {
		return nil, err
	}

	expr2, _, err = types.DatetimeMaxPrecision.Convert(ctx, expr2)
	if err != nil {
		return nil, err
	}

	unit, err := t.unit.Eval(ctx, row)
	if err != nil {
		return nil, err
	}
	if unit == nil {
		return nil, errors.NewKind("unit cannot be null").New(unit)
	}

	unit = strings.TrimPrefix(strings.ToLower(unit.(string)), "sql_tsi_")

	date1 := expr1.(time.Time)
	date2 := expr2.(time.Time)

	diff := date2.Sub(date1)

	var res int64
	switch unit {
	case "microsecond":
		res = diff.Microseconds()
	case "second":
		res = int64(diff.Seconds())
	case "minute":
		res = int64(diff.Minutes())
	case "hour":
		res = int64(diff.Hours())
	case "day":
		res = int64(diff.Hours() / 24)
	case "week":
		res = int64(diff.Hours() / (24 * 7))
	case "month":
		res = int64(diff.Hours() / (24 * 30))
		if res > 0 {
			if date2.Day()-date1.Day() < 0 {
				res -= 1
			} else if date2.Hour()-date1.Hour() < 0 {
				res -= 1
			} else if date2.Minute()-date1.Minute() < 0 {
				res -= 1
			} else if date2.Second()-date1.Second() < 0 {
				res -= 1
			}
		}
	case "quarter":
		monthRes := int64(diff.Hours() / (24 * 30))
		if monthRes > 0 {
			if date2.Day()-date1.Day() < 0 {
				monthRes -= 1
			} else if date2.Hour()-date1.Hour() < 0 {
				monthRes -= 1
			} else if date2.Minute()-date1.Minute() < 0 {
				monthRes -= 1
			} else if date2.Second()-date1.Second() < 0 {
				monthRes -= 1
			}
		}
		res = monthRes / 3
	case "year":
		yearRes := int64(diff.Hours() / (24 * 365))
		if yearRes > 0 {
			monthRes := int64(diff.Hours() / (24 * 30))
			if monthRes > 0 {
				if date2.Day()-date1.Day() < 0 {
					monthRes -= 1
				} else if date2.Hour()-date1.Hour() < 0 {
					monthRes -= 1
				} else if date2.Minute()-date1.Minute() < 0 {
					monthRes -= 1
				} else if date2.Second()-date1.Second() < 0 {
					monthRes -= 1
				}
			}
			res = monthRes / 12
		} else {
			res = yearRes
		}

	default:
		return nil, errors.NewKind("invalid interval unit: %s").New(unit)
	}

	return res, nil
}
