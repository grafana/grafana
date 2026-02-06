// Copyright 2023 Dolthub, Inc.
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

// Extract takes out the specified unit(s) from the time expression.
type Extract struct {
	expression.BinaryExpressionStub
}

var _ sql.FunctionExpression = (*Extract)(nil)
var _ sql.CollationCoercible = (*Extract)(nil)

// NewExtract creates a new Extract expression.
func NewExtract(e1, e2 sql.Expression) sql.Expression {
	return &Extract{
		expression.BinaryExpressionStub{
			LeftChild:  e1,
			RightChild: e2,
		},
	}
}

// FunctionName implements sql.FunctionExpression
func (td *Extract) FunctionName() string {
	return "extract"
}

// Description implements sql.FunctionExpression
func (td *Extract) Description() string {
	return "returns the values of the unit(s) specified in the time expression"
}

// Type implements the Expression interface.
func (td *Extract) Type() sql.Type { return types.Int64 }

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*Extract) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

func (td *Extract) String() string {
	return fmt.Sprintf("%s(%s from %s)", td.FunctionName(), td.LeftChild, td.RightChild)
}

// WithChildren implements the Expression interface.
func (td *Extract) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 2 {
		return nil, sql.ErrInvalidChildrenNumber.New(td, len(children), 2)
	}
	return NewExtract(children[0], children[1]), nil
}

// Eval implements the Expression interface.
func (td *Extract) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	if td.LeftChild == nil || td.RightChild == nil {
		return nil, nil
	}

	left, err := td.LeftChild.Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	if left == nil {
		return nil, nil
	}

	unit, ok := left.(string)
	if !ok {
		return nil, fmt.Errorf("unit is not string type")
	}

	right, err := td.RightChild.Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	if right == nil {
		return nil, nil
	}

	right, err = types.DatetimeMaxPrecision.ConvertWithoutRangeCheck(ctx, right)
	if err != nil {
		ctx.Warn(1292, "%s", err.Error())
		return nil, nil
	}

	dateTime, ok := right.(time.Time)
	if !ok {
		ctx.Warn(1292, "invalid DateTime")
		return nil, nil
	}

	switch unit {
	case "DAY":
		return dateTime.Day(), nil
	case "HOUR":
		return dateTime.Hour(), nil
	case "MINUTE":
		return dateTime.Minute(), nil
	case "SECOND":
		return dateTime.Second(), nil
	case "MICROSECOND":
		return dateTime.Nanosecond() / 1000, nil
	case "QUARTER":
		return (int(dateTime.Month())-1)/3 + 1, nil
	case "MONTH":
		return int(dateTime.Month()), nil
	case "WEEK":
		date, err := getDate(ctx, expression.UnaryExpression{Child: td.RightChild}, row)
		if err != nil {
			return nil, err
		}
		yyyy, ok := year(date).(int32)
		if !ok {
			return nil, sql.ErrInvalidArgumentDetails.New("WEEK", "invalid year")
		}
		mm, ok := month(date).(int32)
		if !ok {
			return nil, sql.ErrInvalidArgumentDetails.New("WEEK", "invalid month")
		}
		dd, ok := day(date).(int32)
		if !ok {
			return nil, sql.ErrInvalidArgumentDetails.New("WEEK", "invalid day")
		}
		yearForWeek, week := calcWeek(yyyy, mm, dd, weekBehaviourYear)
		if yearForWeek < yyyy {
			week = 0
		} else if yearForWeek > yyyy {
			week = 53
		}
		return int(week), nil
	case "YEAR":
		return dateTime.Year(), nil
	case "DAY_HOUR":
		dd := dateTime.Day() * 1_00
		hh := dateTime.Hour()
		return dd + hh, nil
	case "DAY_MINUTE":
		dd := dateTime.Day() * 1_00_00
		hh := dateTime.Hour() * 1_00
		mm := dateTime.Minute()
		return dd + hh + mm, nil
	case "DAY_SECOND":
		dd := dateTime.Day() * 1_00_00_00
		hh := dateTime.Hour() * 1_00_00
		mm := dateTime.Minute() * 1_00
		ss := dateTime.Second()
		return dd + hh + mm + ss, nil
	case "DAY_MICROSECOND":
		dd := dateTime.Day() * 1_00_00_00_000000
		hh := dateTime.Hour() * 1_00_00_000000
		mm := dateTime.Minute() * 1_00_000000
		ss := dateTime.Second() * 1_000000
		mmmmmm := dateTime.Nanosecond() / 1000
		return dd + hh + mm + ss + mmmmmm, nil
	case "HOUR_MINUTE":
		hh := dateTime.Hour() * 1_00
		mm := dateTime.Minute()
		return hh + mm, nil
	case "HOUR_SECOND":
		hh := dateTime.Hour() * 1_00_00
		mm := dateTime.Minute() * 1_00
		ss := dateTime.Second()
		return hh + mm + ss, nil
	case "HOUR_MICROSECOND":
		hh := dateTime.Hour() * 1_00_00_000000
		mm := dateTime.Minute() * 1_00_000000
		ss := dateTime.Second() * 1_000000
		mmmmmm := dateTime.Nanosecond() / 1000
		return hh + mm + ss + mmmmmm, nil
	case "MINUTE_SECOND":
		mm := dateTime.Minute() * 1_00
		ss := dateTime.Second()
		return mm + ss, nil
	case "MINUTE_MICROSECOND":
		mm := dateTime.Minute() * 1_00_000000
		ss := dateTime.Second() * 1_000000
		mmmmmm := dateTime.Nanosecond() / 1000
		return mm + ss + mmmmmm, nil
	case "SECOND_MICROSECOND":
		ss := dateTime.Second() * 1_000000
		mmmmmm := dateTime.Nanosecond() / 1000
		return ss + mmmmmm, nil
	case "YEAR_MONTH":
		yyyy := dateTime.Year() * 1_00
		dateTime.Month()
		mm := int(dateTime.Month())
		return yyyy + mm, nil
	default:
		return nil, fmt.Errorf("invalid time unit")
	}
}
