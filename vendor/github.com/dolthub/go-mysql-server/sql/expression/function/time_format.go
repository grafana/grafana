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
	"fmt"
	"time"

	"github.com/lestrrat-go/strftime"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/types"
)

var mysqlTimeFormatSpec = strftime.NewSpecificationSet()
var timeFormatSpecifierToFunc = map[byte]func(time.Time) string{
	'f': microsecondsStr,
	'H': nil,
	'h': twelveHourPadded,
	'I': twelveHourPadded,
	'i': minutesStr,
	'p': nil,
	'r': ampmClockStr,
	'S': nil,
	's': secondsStr,
	'T': nil,
}

func init() {
	for specifier, fn := range timeFormatSpecifierToFunc {
		if fn != nil {
			panicIfErr(mysqlTimeFormatSpec.Set(specifier, wrap(fn)))
		}
	}

	// replace any strftime specifiers that aren't supported
	fn := func(b byte) {
		if _, ok := timeFormatSpecifierToFunc[b]; !ok {
			panicIfErr(mysqlTimeFormatSpec.Set(b, wrap(func(time.Time) string {
				return string(b)
			})))
		}
	}

	capToLower := byte('a' - 'A')
	for i := byte('A'); i <= 'Z'; i++ {
		fn(i)
		fn(i + capToLower)
	}
}

func formatTime(format string, t time.Time) (string, error) {
	formatter, err := strftime.New(format, strftime.WithSpecificationSet(mysqlTimeFormatSpec))
	if err != nil {
		return "", err
	}

	return formatter.FormatString(t), nil
}

// TimeFormat function returns a string representation of the date specified in the format specified
type TimeFormat struct {
	expression.BinaryExpressionStub
}

var _ sql.FunctionExpression = (*TimeFormat)(nil)
var _ sql.CollationCoercible = (*TimeFormat)(nil)

// FunctionName implements sql.FunctionExpression
func (f *TimeFormat) FunctionName() string {
	return "time_format"
}

// Description implements sql.FunctionExpression
func (f *TimeFormat) Description() string {
	return "format time as specified."
}

// NewTimeFormat returns a new TimeFormat UDF
func NewTimeFormat(ex, value sql.Expression) sql.Expression {
	return &TimeFormat{
		expression.BinaryExpressionStub{
			LeftChild:  ex,
			RightChild: value,
		},
	}
}

// Eval implements the Expression interface.
func (f *TimeFormat) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	if f.LeftChild == nil || f.RightChild == nil {
		return nil, nil
	}

	left, err := f.LeftChild.Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	if left == nil {
		return nil, nil
	}

	d, err := types.Time.ConvertToTimeDuration(left)
	if err != nil {
		return nil, err
	}

	right, err := f.RightChild.Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	if right == nil {
		return nil, nil
	}

	formatStr, ok := right.(string)
	if !ok {
		return nil, sql.ErrInvalidArgumentDetails.New("time_format", "format must be a string")
	}

	return formatTime(
		formatStr,
		time.Date(1980, time.January, 1, int(d.Hours())%24, int(d.Minutes())%60, int(d.Seconds())%60, int(d.Nanoseconds())%1e9, time.UTC),
	)
}

// Type implements the Expression interface.
func (f *TimeFormat) Type() sql.Type {
	return types.Text
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*TimeFormat) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return ctx.GetCollation(), 4
}

// IsNullable implements the Expression interface.
func (f *TimeFormat) IsNullable() bool {
	if types.IsNull(f.LeftChild) {
		if types.IsNull(f.RightChild) {
			return true
		}
		return f.RightChild.IsNullable()
	}
	return f.LeftChild.IsNullable()
}

func (f *TimeFormat) String() string {
	return fmt.Sprintf("%s(%s,%s)", f.FunctionName(), f.LeftChild, f.RightChild)
}

// WithChildren implements the Expression interface.
func (f *TimeFormat) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 2 {
		return nil, sql.ErrInvalidChildrenNumber.New(f, len(children), 2)
	}
	return NewTimeFormat(children[0], children[1]), nil
}
