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

package function

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/shopspring/decimal"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/transform"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// DatetimeConversion is a shorthand function for CONVERT(expr, DATETIME)
type DatetimeConversion struct {
	Date sql.Expression
}

var _ sql.FunctionExpression = (*DatetimeConversion)(nil)
var _ sql.CollationCoercible = (*DatetimeConversion)(nil)

// FunctionName implements sql.FunctionExpression
func (t *DatetimeConversion) FunctionName() string {
	return "datetime"
}

// Description implements sql.FunctionExpression
func (t *DatetimeConversion) Description() string {
	return "returns a DATETIME value for the expression given (e.g. the string '2020-01-02')."
}

func (t *DatetimeConversion) Resolved() bool {
	return t.Date == nil || t.Date.Resolved()
}

func (t *DatetimeConversion) String() string {
	return fmt.Sprintf("%s(%s)", t.FunctionName(), t.Date)
}

func (t *DatetimeConversion) Type() sql.Type {
	return t.Date.Type()
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*DatetimeConversion) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

func (t *DatetimeConversion) IsNullable() bool {
	return false
}

func (t *DatetimeConversion) Eval(ctx *sql.Context, r sql.Row) (interface{}, error) {
	e, err := t.Date.Eval(ctx, r)
	if err != nil {
		return nil, err
	}
	ret, _, err := types.DatetimeMaxPrecision.Convert(ctx, e)
	return ret, err
}

func (t *DatetimeConversion) Children() []sql.Expression {
	if t.Date == nil {
		return nil
	}
	return []sql.Expression{t.Date}
}

func (t *DatetimeConversion) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	return NewDatetime(children...)
}

// NewDatetime returns a DatetimeConversion instance to handle the sql function "datetime". The standard
// MySQL function associated with this function is "timestamp", which actually returns a datetime type
// instead of a timestamp type.
// https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html#function_timestamp
func NewDatetime(args ...sql.Expression) (sql.Expression, error) {
	if len(args) != 1 {
		return nil, sql.ErrInvalidArgumentNumber.New("DATETIME", 1, len(args))
	}

	return &DatetimeConversion{args[0]}, nil
}

// UnixTimestamp converts the argument to the number of seconds since 1970-01-01 00:00:00 UTC.
// With no argument, returns number of seconds since unix epoch for the current time.
type UnixTimestamp struct {
	Date sql.Expression
	typ  sql.Type
}

var _ sql.FunctionExpression = (*UnixTimestamp)(nil)
var _ sql.CollationCoercible = (*UnixTimestamp)(nil)

const MaxUnixTimeMicroSecs = 32536771199999999
const MaxUnixTimeSecs = 32536771199

// canEval returns if the expression contains an expression that cannot be evaluated without sql.Context or sql.Row.
func canEval(expr sql.Expression) bool {
	evaluable := true
	transform.InspectExpr(expr, func(e sql.Expression) bool {
		switch e.(type) {
		case *expression.GetField, *ConvertTz:
			evaluable = false
			return true
		}
		return false
	})
	return evaluable
}

func getNowExpr(expr sql.Expression) *Now {
	var now *Now
	transform.InspectExpr(expr, func(e sql.Expression) bool {
		if n, ok := e.(*Now); ok {
			now = n
			return true
		}
		return false
	})
	return now
}

func evalNowType(now *Now) sql.Type {
	if now.prec == nil {
		return types.Int64
	}
	if !canEval(now.prec) {
		return types.MustCreateDecimalType(19, 6)
	}
	prec, pErr := now.prec.Eval(nil, nil)
	if pErr != nil {
		return nil
	}
	scale, ok := types.CoalesceInt(prec)
	if !ok {
		return nil
	}
	typ, tErr := types.CreateDecimalType(19, uint8(scale))
	if tErr != nil {
		return nil
	}
	return typ
}

func NewUnixTimestamp(args ...sql.Expression) (sql.Expression, error) {
	// TODO: Add context.parameter
	ctx := context.Background()
	if len(args) > 1 {
		return nil, sql.ErrInvalidArgumentNumber.New("UNIX_TIMESTAMP", 1, len(args))
	}
	if len(args) == 0 {
		return &UnixTimestamp{}, nil
	}

	arg := args[0]
	if dtType, isDtType := arg.Type().(sql.DatetimeType); isDtType {
		return &UnixTimestamp{Date: arg, typ: types.MustCreateDecimalType(19, uint8(dtType.Precision()))}, nil
	}
	if !canEval(arg) {
		return &UnixTimestamp{Date: arg, typ: types.MustCreateDecimalType(19, 6)}, nil
	}
	if now := getNowExpr(arg); now != nil {
		return &UnixTimestamp{Date: arg, typ: evalNowType(now)}, nil
	}

	// evaluate arg to determine return type
	// no need to consider timezone conversions, because they have no impact on precision
	date, err := arg.Eval(nil, nil)
	if err != nil || date == nil {
		return &UnixTimestamp{Date: arg}, nil
	}
	// special case: text types with fractional seconds preserve scale
	// e.g. '2000-01-02 12:34:56.000' -> scale 3
	if types.IsText(arg.Type()) {
		dateStr := date.(string)
		idx := strings.Index(dateStr, ".")
		if idx != -1 {
			dateStr = strings.TrimSpace(dateStr[idx:])
			scale := uint8(len(dateStr) - 1)
			if scale > 0 {
				if scale > 6 {
					scale = 6
				}
				typ, tErr := types.CreateDecimalType(19, scale)
				if tErr != nil {
					return nil, tErr
				}
				return &UnixTimestamp{Date: arg, typ: typ}, nil
			}
		}
	}
	date, _, err = types.DatetimeMaxPrecision.Convert(ctx, date)
	if err != nil {
		return &UnixTimestamp{Date: arg}, nil
	}
	unixMicro := date.(time.Time).UnixMicro()
	if unixMicro%1e6 > 0 {
		scale := uint8(6)
		for ; unixMicro%10 == 0; unixMicro /= 10 {
			scale--
		}
		typ, tErr := types.CreateDecimalType(19, scale)
		if tErr != nil {
			return nil, tErr
		}
		return &UnixTimestamp{Date: arg, typ: typ}, nil
	}

	return &UnixTimestamp{Date: arg, typ: types.Int64}, nil
}

// FunctionName implements sql.FunctionExpression
func (ut *UnixTimestamp) FunctionName() string {
	return "unix_timestamp"
}

// Description implements sql.FunctionExpression
func (ut *UnixTimestamp) Description() string {
	return "returns the datetime argument to the number of seconds since the Unix epoch. With no argument, returns the number of seconds since the Unix epoch for the current time."
}

func (ut *UnixTimestamp) Children() []sql.Expression {
	if ut.Date != nil {
		return []sql.Expression{ut.Date}
	}
	return nil
}

func (ut *UnixTimestamp) Resolved() bool {
	if ut.Date != nil {
		return ut.Date.Resolved()
	}
	return true
}

func (ut *UnixTimestamp) IsNullable() bool {
	return true
}

func (ut *UnixTimestamp) Type() sql.Type {
	if ut.typ == nil {
		return types.Int64
	}
	return ut.typ
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*UnixTimestamp) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

func (ut *UnixTimestamp) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	return NewUnixTimestamp(children...)
}

func (ut *UnixTimestamp) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	if ut.Date == nil {
		return toUnixTimestamp(ctx.QueryTime(), ut.Type()), nil
	}

	date, err := ut.Date.Eval(ctx, row)
	if err != nil {
		return nil, err
	}
	if date == nil {
		return nil, nil
	}

	date, _, err = types.DatetimeMaxPrecision.Convert(ctx, date)
	if err != nil {
		// If we aren't able to convert the value to a date, return 0 and set
		// a warning to match MySQL's behavior
		ctx.Warn(1292, "Incorrect datetime value: %s", ut.Date.String())
		return int64(0), nil
	}

	// https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html#function_unix-timestamp
	// When the date argument is a TIMESTAMP column,
	// UNIX_TIMESTAMP() returns the internal timestamp value directly,
	// with no implicit “string-to-Unix-timestamp” conversion.
	if ut.Date.Type().Equals(types.Timestamp) {
		return toUnixTimestamp(date.(time.Time), ut.Type()), nil
	}
	// The function above returns the time value in UTC time zone.
	// Instead, it should use the current session time zone.

	// For example, if the current session TZ is set to +07:00 and given value is '2023-09-25 07:02:57',
	// then the correct time value is '2023-09-25 07:02:57 +07:00'.
	// Currently, we get '2023-09-25 07:02:57 +00:00' from the above function.
	// ConvertTimeZone function is used to get the value in +07:00 TZ
	// It will return the correct value of '2023-09-25 00:02:57 +00:00',
	// which is equivalent of '2023-09-25 07:02:57 +07:00'.
	stz, err := SessionTimeZone(ctx)
	if err != nil {
		return nil, err
	}

	ctz, ok := sql.ConvertTimeZone(date.(time.Time), stz, "UTC")
	if ok {
		date = ctz
	}

	return toUnixTimestamp(date.(time.Time), ut.Type()), nil
}

func toUnixTimestamp(t time.Time, resType sql.Type) interface{} {
	unixMicro := t.UnixMicro()
	if unixMicro > MaxUnixTimeMicroSecs {
		return int64(0)
	}
	if unixMicro < 1e6 {
		return resType.Zero()
	}
	if types.IsDecimal(resType) {
		// scale decimal
		scale := int32(resType.(types.DecimalType_).Scale())
		for i := 6 - scale; i > 0; i-- {
			unixMicro /= 10
		}
		res := decimal.New(unixMicro, -scale)
		str := res.String()
		if str == "" {
		}
		return res
	}
	return unixMicro / 1e6
}

func (ut *UnixTimestamp) String() string {
	if ut.Date != nil {
		return fmt.Sprintf("%s(%s)", ut.FunctionName(), ut.Date)
	} else {
		return fmt.Sprintf("%s()", ut.FunctionName())
	}
}

// FromUnixtime converts the argument to a datetime.
type FromUnixtime struct {
	expression.NaryExpression
}

var _ sql.FunctionExpression = (*FromUnixtime)(nil)
var _ sql.CollationCoercible = (*FromUnixtime)(nil)

// NewFromUnixtime https://dev.mysql.com/doc/refman/8.4/en/date-and-time-functions.html#function_from-unixtime
func NewFromUnixtime(args ...sql.Expression) (sql.Expression, error) {
	switch len(args) {
	case 1, 2:
		return &FromUnixtime{expression.NaryExpression{ChildExpressions: args}}, nil
	default:
		return nil, sql.ErrInvalidArgumentNumber.New("FROM_UNIXTIME", 2, len(args))
	}
}

// Description implements sql.FunctionExpression
func (r *FromUnixtime) Description() string {
	return "formats Unix timestamp as a date."
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*FromUnixtime) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

func (r *FromUnixtime) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	vals := make([]interface{}, len(r.ChildExpressions))
	for i, e := range r.ChildExpressions {
		val, err := e.Eval(ctx, row)
		if err != nil {
			return nil, err
		}
		vals[i] = val
	}

	// TODO support decimal value in timestamp
	n, _, err := types.Int64.Convert(ctx, vals[0])
	if err != nil {
		return nil, err
	}
	if n == nil {
		return nil, nil
	}
	sec := n.(int64)
	if sec > MaxUnixTimeSecs || sec < 0 {
		return nil, nil
	}
	t := time.Unix(sec, 0).In(time.UTC)
	tz, err := SessionTimeZone(ctx)
	if err != nil {
		return nil, err
	}
	t, _ = sql.ConvertTimeZone(t, "UTC", tz)
	if len(vals) == 1 {
		return t, nil // If format is omitted, this function returns a DATETIME value.
	}
	format, _, err := types.Text.Convert(ctx, vals[1])
	if err != nil {
		return nil, err
	}
	if format == nil {
		return nil, nil
	}
	return formatDate(format.(string), t)
}

func (r *FromUnixtime) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	return NewFromUnixtime(children...)
}

func (r *FromUnixtime) FunctionName() string {
	return "FROM_UNIXTIME"
}

func (r *FromUnixtime) String() string {
	switch len(r.ChildExpressions) {
	case 1:
		return fmt.Sprintf("FROM_UNIXTIME(%s)", r.ChildExpressions[0])
	case 2:
		return fmt.Sprintf("FROM_UNIXTIME(%s, %s)", r.ChildExpressions[0], r.ChildExpressions[1])
	default:
		return "FROM_UNIXTIME(INVALID_NUMBER_OF_ARGUMENTS)"
	}
}

func (r *FromUnixtime) Type() sql.Type {
	switch len(r.ChildExpressions) {
	case 1:
		return types.DatetimeMaxPrecision
	case 2:
		return types.Text
	default:
		return types.Null
	}
}

type CurrDate struct {
	NoArgFunc
}

func (c CurrDate) IsNonDeterministic() bool {
	return true
}

var _ sql.FunctionExpression = CurrDate{}
var _ sql.CollationCoercible = CurrDate{}

// Description implements sql.FunctionExpression
func (c CurrDate) Description() string {
	return "returns the current date."
}

func NewCurrDate() sql.Expression {
	return CurrDate{
		NoArgFunc: NoArgFunc{Name: "curdate", SQLType: types.LongText},
	}
}

func NewCurrentDate() sql.Expression {
	return CurrDate{
		NoArgFunc: NoArgFunc{Name: "current_date", SQLType: types.LongText},
	}
}

func currDateLogic(ctx *sql.Context, _ sql.Row) (interface{}, error) {
	t := ctx.QueryTime()
	return fmt.Sprintf("%d-%02d-%02d", t.Year(), t.Month(), t.Day()), nil
}

// Eval implements sql.Expression
func (c CurrDate) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	return currDateLogic(ctx, row)
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (CurrDate) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

// WithChildren implements sql.Expression
func (c CurrDate) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	return NoArgFuncWithChildren(c, children)
}

func isYmdInterval(interval *expression.Interval) bool {
	return strings.Contains(interval.Unit, "YEAR") ||
		strings.Contains(interval.Unit, "QUARTER") ||
		strings.Contains(interval.Unit, "MONTH") ||
		strings.Contains(interval.Unit, "WEEK") ||
		strings.Contains(interval.Unit, "DAY")
}

func isHmsInterval(interval *expression.Interval) bool {
	return strings.Contains(interval.Unit, "HOUR") ||
		strings.Contains(interval.Unit, "MINUTE") ||
		strings.Contains(interval.Unit, "SECOND")
}

// Determines the return type of a DateAdd/DateSub expression
// Logic is based on https://dev.mysql.com/doc/refman/8.0/en/date-and-time-functions.html#function_date-add
func dateOffsetType(input sql.Expression, interval *expression.Interval) sql.Type {
	if input == nil {
		return types.Null
	}
	inputType := input.Type()

	// result is null if expression is null
	if inputType == types.Null {
		return types.Null
	}

	if types.IsDatetimeType(inputType) || types.IsTimestampType(inputType) {
		return types.DatetimeMaxPrecision
	}

	// set type flags
	isInputDate := inputType == types.Date
	isInputTime := inputType == types.Time

	// determine what kind of interval we're dealing with
	isYmd := isYmdInterval(interval)
	isHms := isHmsInterval(interval)
	isMixed := isYmd && isHms

	// handle input of Date type
	if isInputDate {
		if isHms || isMixed {
			// if interval contains time components, result is Datetime
			return types.DatetimeMaxPrecision
		} else {
			// otherwise result is Date
			return types.Date
		}
	}

	// handle input of Time type
	if isInputTime {
		if isYmd || isMixed {
			// if interval contains date components, result is Datetime
			return types.DatetimeMaxPrecision
		} else {
			// otherwise result is Time
			return types.Time
		}
	}

	// handle dynamic input type
	if types.IsDeferredType(inputType) {
		if isYmd && !isHms {
			// if interval contains only date components, result is Date
			return types.Date
		} else {
			// otherwise result is Datetime
			return types.DatetimeMaxPrecision
		}
	}

	// default type is VARCHAR
	return types.Text
}
