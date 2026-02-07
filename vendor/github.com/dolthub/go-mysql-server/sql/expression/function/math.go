// Copyright 2020-2024 Dolthub, Inc.
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
	"hash/crc32"
	"math"
	"math/rand"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/dolthub/vitess/go/mysql"
	"github.com/shopspring/decimal"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// Rand returns a random float 0 <= x < 1. If it has an argument, that argument will be used to seed the random number
// generator, effectively turning it into a hash on that value.
type Rand struct {
	Child sql.Expression
}

var _ sql.Expression = (*Rand)(nil)
var _ sql.NonDeterministicExpression = (*Rand)(nil)
var _ sql.FunctionExpression = (*Rand)(nil)
var _ sql.CollationCoercible = (*Rand)(nil)

// NewRand creates a new Rand expression.
func NewRand(exprs ...sql.Expression) (sql.Expression, error) {
	if len(exprs) > 1 {
		return nil, sql.ErrInvalidArgumentNumber.New("rand", "0 or 1", len(exprs))
	}
	if len(exprs) > 0 {
		return &Rand{Child: exprs[0]}, nil
	}
	return &Rand{}, nil
}

// FunctionName implements sql.FunctionExpression
func (r *Rand) FunctionName() string {
	return "rand"
}

// Description implements sql.FunctionExpression
func (r *Rand) Description() string {
	return "returns a random number in the range 0 <= x < 1. If an argument is given, it is used to seed the random number generator."
}

// Type implements sql.Expression.
func (r *Rand) Type() sql.Type {
	return types.Float64
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*Rand) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

// IsNonDeterministic implements sql.NonDeterministicExpression
func (r *Rand) IsNonDeterministic() bool {
	return r.Child == nil
}

// IsNullable implements sql.Expression
func (r *Rand) IsNullable() bool {
	return false
}

// Resolved implements sql.Expression
func (r *Rand) Resolved() bool {
	return r.Child == nil || r.Child.Resolved()
}

func (r *Rand) String() string {
	if r.Child != nil {
		return fmt.Sprintf("%s(%s)", r.FunctionName(), r.Child)
	}
	return fmt.Sprintf("%s()", r.FunctionName())
}

// WithChildren implements sql.Expression.
func (r *Rand) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) > 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(r, len(children), 1)
	}
	if len(children) == 0 {
		return r, nil
	}

	return NewRand(children[0])
}

// Children implements sql.Expression
func (r *Rand) Children() []sql.Expression {
	if r.Child == nil {
		return nil
	}
	return []sql.Expression{r.Child}
}

// Eval implements sql.Expression.
func (r *Rand) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	if r.Child == nil {
		return rand.Float64(), nil
	}

	// For child expressions, the mysql semantics are to seed the PRNG with an int64 value of the expression given. For
	// non-numeric types, the seed will always be 0, which means that rand() will always return the same result for all
	// non-numeric seed arguments.
	e, err := r.Child.Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	e, _, err = types.Int64.Convert(ctx, e)
	if err != nil {
		if !sql.ErrTruncatedIncorrect.Is(err) {
			return nil, err
		}
		ctx.Warn(mysql.ERTruncatedWrongValue, "%s", err.Error())
	}

	return rand.New(rand.NewSource(e.(int64))).Float64(), nil
}

// Sin is the SIN function
type Sin struct {
	*UnaryFunc
}

var _ sql.FunctionExpression = (*Sin)(nil)
var _ sql.CollationCoercible = (*Sin)(nil)

// NewSin returns a new SIN function expression
func NewSin(arg sql.Expression) sql.Expression {
	return &Sin{NewUnaryFunc(arg, "SIN", types.Float64)}
}

// Description implements sql.FunctionExpression
func (s *Sin) Description() string {
	return "returns the sine of the expression given."
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*Sin) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

// Eval implements sql.Expression
func (s *Sin) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	val, err := s.EvalChild(ctx, row)
	if err != nil {
		return nil, err
	}

	if val == nil {
		return nil, nil
	}

	n, _, err := types.Float64.Convert(ctx, val)
	if err != nil {
		if !sql.ErrTruncatedIncorrect.Is(err) {
			return nil, err
		}
		ctx.Warn(mysql.ERTruncatedWrongValue, "%s", err.Error())
	}

	return math.Sin(n.(float64)), nil
}

// WithChildren implements sql.Expression
func (s *Sin) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(s, len(children), 1)
	}
	return NewSin(children[0]), nil
}

type Cos struct {
	*UnaryFunc
}

var _ sql.FunctionExpression = (*Cos)(nil)
var _ sql.CollationCoercible = (*Cos)(nil)

// NewCos returns a new COS function expression
func NewCos(arg sql.Expression) sql.Expression {
	return &Cos{NewUnaryFunc(arg, "COS", types.Float64)}
}

// Description implements sql.FunctionExpression
func (s *Cos) Description() string {
	return "returns the cosine of an expression."
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*Cos) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

// Eval implements sql.Expression
func (s *Cos) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	val, err := s.EvalChild(ctx, row)
	if err != nil {
		return nil, err
	}

	if val == nil {
		return nil, nil
	}

	n, _, err := types.Float64.Convert(ctx, val)
	if err != nil {
		if !sql.ErrTruncatedIncorrect.Is(err) {
			return nil, err
		}
		ctx.Warn(mysql.ERTruncatedWrongValue, "%s", err.Error())
	}

	return math.Cos(n.(float64)), nil
}

// WithChildren implements sql.Expression
func (c *Cos) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(c, len(children), 1)
	}
	return NewCos(children[0]), nil
}

type Tan struct {
	*UnaryFunc
}

var _ sql.FunctionExpression = (*Tan)(nil)
var _ sql.CollationCoercible = (*Tan)(nil)

// NewTan returns a new TAN function expression
func NewTan(arg sql.Expression) sql.Expression {
	return &Tan{NewUnaryFunc(arg, "TAN", types.Float64)}
}

// Description implements sql.FunctionExpression
func (t *Tan) Description() string {
	return "returns the tangent of the expression given."
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*Tan) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

// Eval implements sql.Expression
func (t *Tan) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	val, err := t.EvalChild(ctx, row)
	if err != nil {
		return nil, err
	}

	if val == nil {
		return nil, nil
	}

	n, _, err := types.Float64.Convert(ctx, val)
	if err != nil {
		if !sql.ErrTruncatedIncorrect.Is(err) {
			return nil, err
		}
		ctx.Warn(mysql.ERTruncatedWrongValue, "%s", err.Error())
	}

	res := math.Tan(n.(float64))
	if math.IsNaN(res) {
		return nil, nil
	}

	return res, nil
}

// WithChildren implements sql.Expression
func (t *Tan) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(t, len(children), 1)
	}
	return NewTan(children[0]), nil
}

type Asin struct {
	*UnaryFunc
}

var _ sql.FunctionExpression = (*Asin)(nil)
var _ sql.CollationCoercible = (*Asin)(nil)

// NewAsin returns a new ASIN function expression
func NewAsin(arg sql.Expression) sql.Expression {
	return &Asin{NewUnaryFunc(arg, "ASIN", types.Float64)}
}

// Description implements sql.FunctionExpression
func (a *Asin) Description() string {
	return "returns the arcsin of an expression."
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*Asin) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

// Eval implements sql.Expression
func (a *Asin) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	val, err := a.EvalChild(ctx, row)
	if err != nil {
		return nil, err
	}

	if val == nil {
		return nil, nil
	}

	n, _, err := types.Float64.Convert(ctx, val)
	if err != nil {
		if !sql.ErrTruncatedIncorrect.Is(err) {
			return nil, err
		}
		ctx.Warn(mysql.ERTruncatedWrongValue, "%s", err.Error())
	}

	res := math.Asin(n.(float64))
	if math.IsNaN(res) {
		return nil, nil
	}

	return res, nil
}

// WithChildren implements sql.Expression
func (a *Asin) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(a, len(children), 1)
	}
	return NewAsin(children[0]), nil
}

type Acos struct {
	*UnaryFunc
}

var _ sql.FunctionExpression = (*Acos)(nil)
var _ sql.CollationCoercible = (*Acos)(nil)

// NewAcos returns a new ACOS function expression
func NewAcos(arg sql.Expression) sql.Expression {
	return &Acos{NewUnaryFunc(arg, "ACOS", types.Float64)}
}

// Description implements sql.FunctionExpression
func (a *Acos) Description() string {
	return "returns the arccos of an expression."
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*Acos) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

// Eval implements sql.Expression
func (a *Acos) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	val, err := a.EvalChild(ctx, row)
	if err != nil {
		return nil, err
	}

	if val == nil {
		return nil, nil
	}

	n, _, err := types.Float64.Convert(ctx, val)
	if err != nil {
		if !sql.ErrTruncatedIncorrect.Is(err) {
			return nil, err
		}
		ctx.Warn(mysql.ERTruncatedWrongValue, "%s", err.Error())
	}

	res := math.Acos(n.(float64))
	if math.IsNaN(res) {
		return nil, nil
	}

	return res, nil
}

// WithChildren implements sql.Expression
func (a *Acos) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(a, len(children), 1)
	}
	return NewAcos(children[0]), nil
}

type Atan struct {
	x, y sql.Expression
}

var _ sql.FunctionExpression = (*Atan)(nil)
var _ sql.CollationCoercible = (*Atan)(nil)

// NewAtan returns a new ATAN function expression
func NewAtan(args ...sql.Expression) (sql.Expression, error) {
	if len(args) == 1 {
		return &Atan{x: expression.NewLiteral(1, types.Int32), y: args[0]}, nil
	}
	if len(args) == 2 {
		return &Atan{x: args[1], y: args[0]}, nil
	}
	return nil, sql.ErrInvalidArgumentNumber.New("atan", "1 or 2", len(args))
}

// FunctionName implements sql.FunctionExpression
func (a *Atan) FunctionName() string {
	return "atan"
}

// Resolved implements sql.Expression
func (a *Atan) Resolved() bool {
	if a.x != nil && !a.x.Resolved() {
		return false
	}
	if a.y != nil && !a.y.Resolved() {
		return false
	}
	return true
}

// String implements sql.Expression
func (a *Atan) String() string {
	if a.x != nil {
		return fmt.Sprintf("%s(%s, %s)", a.FunctionName(), a.x, a.y)
	}
	return fmt.Sprintf("%s(%s)", a.FunctionName(), a.y)
}

// Type implements sql.Expression
func (a *Atan) Type() sql.Type {
	return types.Float64
}

// IsNullable implements sql.Expression
func (a *Atan) IsNullable() bool {
	return true
}

// Description implements sql.FunctionExpression
func (a *Atan) Description() string {
	return "returns the arctan of an expression."
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*Atan) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

// Eval implements sql.Expression
func (a *Atan) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	if a.y == nil {
		return nil, nil
	}

	yy, err := a.y.Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	if yy == nil {
		return nil, nil
	}

	var xx interface{} = float64(1)
	if a.x != nil {
		xx, err = a.x.Eval(ctx, row)
		if err != nil {
			return nil, err
		}
	}
	if xx == nil {
		return nil, nil
	}

	nx, _, err := types.Float64.Convert(ctx, xx)
	if err != nil {
		if !sql.ErrTruncatedIncorrect.Is(err) {
			return nil, err
		}
		ctx.Warn(mysql.ERTruncatedWrongValue, "%s", err.Error())
	}

	ny, _, err := types.Float64.Convert(ctx, yy)
	if err != nil {
		if !sql.ErrTruncatedIncorrect.Is(err) {
			return nil, err
		}
		ctx.Warn(mysql.ERTruncatedWrongValue, "%s", err.Error())
	}

	return math.Atan2(ny.(float64), nx.(float64)), nil
}

// Children implements sql.Expression
func (a *Atan) Children() []sql.Expression {
	if a.x == nil {
		return []sql.Expression{a.y}
	}
	return []sql.Expression{a.y, a.x}
}

// WithChildren implements sql.Expression
func (a *Atan) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	return NewAtan(children...)
}

type Cot struct {
	*UnaryFunc
}

var _ sql.FunctionExpression = (*Cot)(nil)
var _ sql.CollationCoercible = (*Cot)(nil)

// NewCot returns a new COT function expression
func NewCot(arg sql.Expression) sql.Expression {
	return &Cot{NewUnaryFunc(arg, "COT", types.Float64)}
}

// Description implements sql.FunctionExpression
func (c *Cot) Description() string {
	return "returns the arctangent of an expression."
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*Cot) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

// Eval implements sql.Expression
func (c *Cot) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	val, err := c.EvalChild(ctx, row)
	if err != nil {
		return nil, err
	}

	if val == nil {
		return nil, nil
	}

	n, _, err := types.Float64.Convert(ctx, val)
	if err != nil {
		if !sql.ErrTruncatedIncorrect.Is(err) {
			return nil, err
		}
		ctx.Warn(mysql.ERTruncatedWrongValue, "%s", err.Error())
	}

	tan := math.Tan(n.(float64))
	if math.IsNaN(tan) {
		return nil, nil
	}

	res := 1.0 / tan
	if math.IsInf(res, 0) {
		return nil, sql.ErrValueOutOfRange.New("DOUBLE", c.Name)
	}

	return res, nil
}

// WithChildren implements sql.Expression
func (c *Cot) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(c, len(children), 1)
	}
	return NewCot(children[0]), nil
}

type Degrees struct {
	*UnaryFunc
}

var _ sql.FunctionExpression = (*Degrees)(nil)
var _ sql.CollationCoercible = (*Degrees)(nil)

// NewDegrees returns a new DEGREES function expression
func NewDegrees(arg sql.Expression) sql.Expression {
	return &Degrees{NewUnaryFunc(arg, "DEGREES", types.Float64)}
}

// FunctionName implements sql.FunctionExpression
func (d *Degrees) FunctionName() string {
	return "degrees"
}

// Description implements sql.FunctionExpression
func (d *Degrees) Description() string {
	return "returns the number of degrees in the radian expression given."
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*Degrees) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

// Eval implements sql.Expression
func (d *Degrees) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	val, err := d.EvalChild(ctx, row)
	if err != nil {
		return nil, err
	}

	if val == nil {
		return nil, nil
	}

	n, _, err := types.Float64.Convert(ctx, val)
	if err != nil {
		if !sql.ErrTruncatedIncorrect.Is(err) {
			return nil, err
		}
		ctx.Warn(mysql.ERTruncatedWrongValue, "%s", err.Error())
	}

	return (n.(float64) * 180.0) / math.Pi, nil
}

// WithChildren implements sql.Expression
func (d *Degrees) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(d, len(children), 1)
	}
	return NewDegrees(children[0]), nil
}

type Radians struct {
	*UnaryFunc
}

var _ sql.FunctionExpression = (*Radians)(nil)
var _ sql.CollationCoercible = (*Radians)(nil)

// NewRadians returns a new RADIANS function expression
func NewRadians(arg sql.Expression) sql.Expression {
	return &Radians{NewUnaryFunc(arg, "RADIANS", types.Float64)}
}

// Description implements sql.FunctionExpression
func (r *Radians) Description() string {
	return "returns the radian value of the degrees argument given."
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*Radians) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

// Eval implements sql.Expression
func (r *Radians) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	val, err := r.EvalChild(ctx, row)
	if err != nil {
		return nil, err
	}

	if val == nil {
		return nil, nil
	}

	n, _, err := types.Float64.Convert(ctx, val)
	if err != nil {
		if !sql.ErrTruncatedIncorrect.Is(err) {
			return nil, err
		}
		ctx.Warn(mysql.ERTruncatedWrongValue, "%s", err.Error())
	}

	return (n.(float64) * math.Pi) / 180.0, nil
}

// WithChildren implements sql.Expression
func (r *Radians) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(r, len(children), 1)
	}
	return NewRadians(children[0]), nil
}

type Crc32 struct {
	*UnaryFunc
}

var _ sql.FunctionExpression = (*Crc32)(nil)
var _ sql.CollationCoercible = (*Crc32)(nil)

// NewCrc32 returns a new CRC32 function expression
func NewCrc32(arg sql.Expression) sql.Expression {
	return &Crc32{NewUnaryFunc(arg, "CRC32", types.Uint32)}
}

// Description implements sql.FunctionExpression
func (c *Crc32) Description() string {
	return "returns the cyclic redundancy check value of a given string as a 32-bit unsigned value."
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*Crc32) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

// Eval implements sql.Expression
func (c *Crc32) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	arg, err := c.EvalChild(ctx, row)
	if err != nil {
		return nil, err
	}

	if arg == nil {
		return nil, nil
	}

	var bytes []byte
	switch val := arg.(type) {
	case string:
		bytes = []byte(val)
	case int8, int16, int32, int64, int:
		val, _, err := types.Int64.Convert(ctx, arg)

		if err != nil {
			return nil, err
		}

		bytes = []byte(strconv.FormatInt(val.(int64), 10))
	case uint8, uint16, uint32, uint64, uint:
		val, _, err := types.Uint64.Convert(ctx, arg)

		if err != nil {
			return nil, err
		}

		bytes = []byte(strconv.FormatUint(val.(uint64), 10))
	case float32:
		s := floatToString(float64(val))
		bytes = []byte(s)
	case float64:
		s := floatToString(val)
		bytes = []byte(s)
	case bool:
		if val {
			bytes = []byte{1}
		} else {
			bytes = []byte{0}
		}
	default:
		return nil, sql.ErrInvalidArgumentDetails.New("crc32", fmt.Sprint(arg))
	}

	return crc32.ChecksumIEEE(bytes), nil
}

// WithChildren implements sql.Expression
func (c *Crc32) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(c, len(children), 1)
	}
	return NewCrc32(children[0]), nil
}

func floatToString(f float64) string {
	s := strconv.FormatFloat(f, 'f', -1, 32)
	idx := strings.IndexRune(s, '.')

	if idx == -1 {
		s += ".0"
	}

	return s
}

type Sign struct {
	*UnaryFunc
}

var _ sql.FunctionExpression = (*Sign)(nil)
var _ sql.CollationCoercible = (*Sign)(nil)

// NewSign returns a new SIGN function expression
func NewSign(arg sql.Expression) sql.Expression {
	return &Sign{NewUnaryFunc(arg, "SIGN", types.Int8)}
}

var negativeSignRegex = regexp.MustCompile(`^-[0-9]*\.?[0-9]*[1-9]`)
var positiveSignRegex = regexp.MustCompile(`^+?[0-9]*\.?[0-9]*[1-9]`)

// Description implements sql.FunctionExpression
func (s *Sign) Description() string {
	return "returns the sign of the argument."
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*Sign) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

// Eval implements sql.Expression
func (s *Sign) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	arg, err := s.EvalChild(ctx, row)
	if err != nil {
		return nil, err
	}

	if arg == nil {
		return nil, nil
	}

	switch typedVal := arg.(type) {
	case int8, int16, int32, int64, float64, float32, int, decimal.Decimal:
		val, _, err := types.Int64.Convert(ctx, arg)

		if err != nil {
			return nil, err
		}

		n := val.(int64)
		if n == 0 {
			return int8(0), nil
		} else if n < 0 {
			return int8(-1), nil
		}

		return int8(1), nil

	case uint8, uint16, uint32, uint64, uint:
		val, _, err := types.Uint64.Convert(ctx, arg)

		if err != nil {
			return nil, err
		}

		n := val.(uint64)
		if n == 0 {
			return int8(0), nil
		}

		return int8(1), nil

	case bool:
		if typedVal {
			return int8(1), nil
		}

		return int8(0), nil

	case time.Time:
		return int8(1), nil

	case string:
		if negativeSignRegex.MatchString(typedVal) {
			return int8(-1), nil
		} else if positiveSignRegex.MatchString(typedVal) {
			return int8(1), nil
		}

		return int8(0), nil
	}

	return int8(0), nil
}

// WithChildren implements sql.Expression
func (s *Sign) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(s, len(children), 1)
	}
	return NewSign(children[0]), nil
}

// NewMod returns a new MOD function expression
func NewMod(args ...sql.Expression) (sql.Expression, error) {
	if len(args) != 2 {
		return nil, sql.ErrInvalidArgumentNumber.New("mod", "2", len(args))
	}

	return expression.NewMod(args[0], args[1]), nil
}

type Pi struct{}

func NewPi() sql.Expression {
	return &Pi{}
}

var _ sql.FunctionExpression = &Pi{}
var _ sql.CollationCoercible = &Pi{}

// FunctionName implements sql.FunctionExpression
func (p *Pi) FunctionName() string {
	return "pi"
}

// Description implements sql.FunctionExpression
func (p *Pi) Description() string {
	return "return the value of pi."
}

// Resolved implements sql.Expression
func (p *Pi) Resolved() bool {
	return true
}

// String implements sql.Expression
func (p *Pi) String() string {
	return fmt.Sprintf("%s()", p.FunctionName())
}

// Type implements sql.Expression
func (p *Pi) Type() sql.Type {
	return types.Float64
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (p *Pi) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

// IsNullable implements sql.Expression
func (p *Pi) IsNullable() bool {
	return false
}

// Eval implements sql.Expression
func (p *Pi) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	return math.Pi, nil
}

// Children implements sql.Expression
func (p *Pi) Children() []sql.Expression {
	return nil
}

// WithChildren implements sql.Expression
func (p *Pi) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	return sql.NillaryWithChildren(p, children...)
}

type Exp struct {
	*UnaryFunc
}

func NewExp(arg sql.Expression) sql.Expression {
	return &Exp{NewUnaryFunc(arg, "EXP", types.Float64)}
}

var _ sql.FunctionExpression = (*Exp)(nil)
var _ sql.CollationCoercible = (*Exp)(nil)

// Description implements sql.FunctionExpression
func (e *Exp) Description() string {
	return "returns e raised to the power of the argument given."
}

// Type implements the Expression interface.
func (e *Exp) Type() sql.Type {
	return types.Float64
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (e *Exp) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

// Eval implements the Expression interface.
func (e *Exp) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	if e.Child == nil {
		return nil, nil
	}

	val, err := e.Child.Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	if val == nil {
		return nil, err
	}

	v, _, err := types.Float64.Convert(ctx, val)
	if err != nil {
		if !sql.ErrTruncatedIncorrect.Is(err) {
			return nil, err
		}
		ctx.Warn(mysql.ERTruncatedWrongValue, "%s", err.Error())
	}

	res := math.Exp(v.(float64))

	if math.IsNaN(res) || math.IsInf(res, 0) {
		return nil, nil
	}

	return res, nil
}

// WithChildren implements the Expression interface.
func (e *Exp) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(e, len(children), 1)
	}
	return NewExp(children[0]), nil
}
