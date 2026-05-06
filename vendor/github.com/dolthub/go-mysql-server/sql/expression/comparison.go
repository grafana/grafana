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

	"gopkg.in/src-d/go-errors.v1"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
)

var ErrInvalidRegexp = errors.NewKind("Invalid regular expression: %s")

// Comparer implements a comparison expression.
type Comparer interface {
	sql.Expression
	Compare(ctx *sql.Context, row sql.Row) (int, error)
	Left() sql.Expression
	Right() sql.Expression
}

// ErrNilOperand ir returned if some or both of the comparison's operands is nil.
var ErrNilOperand = errors.NewKind("nil operand found in comparison")

// PreciseComparison searches an expression tree for comparison
// expressions that require a conversion or type promotion.
// This utility helps determine if filter predicates can be pushed down.
func PreciseComparison(e sql.Expression) bool {
	var imprecise bool
	sql.Inspect(e, func(expr sql.Expression) bool {
		if cmp, ok := expr.(Comparer); ok {
			left, right := cmp.Left().Type(), cmp.Right().Type()

			// integer comparisons are exact
			if types.IsInteger(left) && types.IsInteger(right) {
				return true
			}

			// string type comparisons are exact
			if types.IsText(left) && types.IsText(right) {
				return true
			}

			if tupType, ok := right.(types.TupleType); ok {
				if tupleTypesMatch(left, tupType, types.IsInteger) || tupleTypesMatch(left, tupType, types.IsText) {
					return true
				}
				for _, right := range tupType {
					if !left.Equals(right) {
						imprecise = true
						return false
					}
				}
				return true
			}

			// comparisons with type conversions are sometimes imprecise
			// TODO: this sometimes leads to creating unnecessary filters
			//  for example, when comparing int key to decimal key (that is too large for integer).
			if !left.Equals(right) {
				imprecise = true
				return false
			}
		}
		return true
	})
	return !imprecise
}

func tupleTypesMatch(left sql.Type, tup types.TupleType, typeCb func(t sql.Type) bool) bool {
	if !typeCb(left) {
		return false
	}
	for _, right := range tup {
		if !typeCb(right) {
			return false
		}
	}
	return true
}

type comparison struct {
	BinaryExpressionStub
}

// disableRounding disables rounding for the given expression.
func disableRounding(expr sql.Expression) {
	setArithmeticOps(expr, -1)
	setDivOps(expr, -1)
}

func newComparison(left, right sql.Expression) comparison {
	disableRounding(left)
	disableRounding(right)
	return comparison{BinaryExpressionStub{left, right}}
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (c *comparison) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	leftCollation, leftCoercibility := sql.GetCoercibility(ctx, c.Left())
	rightCollation, rightCoercibility := sql.GetCoercibility(ctx, c.Right())
	return sql.ResolveCoercibility(leftCollation, leftCoercibility, rightCollation, rightCoercibility)
}

// Compare the two given values using the types of the expressions in the comparison.
// Since both types should be equal, it does not matter which type is used, but for
// reference, the left type is always used.
func (c *comparison) Compare(ctx *sql.Context, row sql.Row) (int, error) {
	left, right, err := c.evalLeftAndRight(ctx, row)
	if err != nil {
		return 0, err
	}

	if left == nil || right == nil {
		return 0, ErrNilOperand.New()
	}

	left, err = sql.UnwrapAny(ctx, left)
	if err != nil {
		return 0, err
	}

	right, err = sql.UnwrapAny(ctx, right)
	if err != nil {
		return 0, err
	}

	lTyp, rTyp := c.Left().Type(), c.Right().Type()
	if types.TypesEqual(lTyp, rTyp) {
		return lTyp.Compare(ctx, left, right)
	}

	l, r, compareType, err := c.castLeftAndRight(ctx, left, right)
	if err != nil {
		return 0, err
	}

	// Set comparison relies on empty strings not being converted yet
	if types.IsSet(compareType) {
		return compareType.Compare(ctx, left, right)
	}
	collationPreference, _ := c.CollationCoercibility(ctx)
	if stringCompareType, ok := compareType.(sql.StringType); ok && types.IsTextOnly(stringCompareType) {
		compareType = types.MustCreateString(stringCompareType.Type(), stringCompareType.Length(), collationPreference)
	}
	return compareType.Compare(ctx, l, r)
}

// CompareValue the two given values using the types of the expressions in the comparison.
func (c *comparison) CompareValue(ctx *sql.Context, row sql.ValueRow) (int, error) {
	// TODO: avoid type assertions
	lv, err := c.LeftChild.(sql.ValueExpression).EvalValue(ctx, row)
	if err != nil {
		return 0, err
	}
	rv, err := c.RightChild.(sql.ValueExpression).EvalValue(ctx, row)
	if err != nil {
		return 0, err
	}

	if lv.IsNull() || rv.IsNull() {
		return 0, nil
	}

	lTyp, rTyp := c.LeftChild.Type().(sql.ValueType), c.RightChild.Type().(sql.ValueType)
	if types.TypesEqual(lTyp, rTyp) {
		return lTyp.(sql.ValueType).CompareValue(ctx, lv, rv)
	}

	if types.IsNumber(lTyp) || types.IsNumber(rTyp) {
		if types.IsUnsigned(lTyp) && types.IsUnsigned(rTyp) {
			return types.Uint64.(sql.ValueType).CompareValue(ctx, lv, rv)
		}
		if types.IsSigned(lTyp) && types.IsSigned(rTyp) {
			return types.Int64.(sql.ValueType).CompareValue(ctx, lv, rv)
		}
		if types.IsDecimal(lTyp) || types.IsDecimal(rTyp) {
			return types.InternalDecimalType.(sql.ValueType).CompareValue(ctx, lv, rv)
		}
		return types.Float64.(sql.ValueType).CompareValue(ctx, lv, rv)
	}

	return lTyp.CompareValue(ctx, lv, rv)
}

// IsValueExpression returns whether every child supports sql.ValueExpression
func (c *comparison) IsValueExpression() bool {
	l, ok := c.LeftChild.(sql.ValueExpression)
	if !ok {
		return false
	}
	r, ok := c.RightChild.(sql.ValueExpression)
	if !ok {
		return false
	}
	// TODO: only allow comparisons between Integers, Floats, Decimals, Bits and Year for now
	if !types.IsNumber(c.LeftChild.Type()) || !types.IsNumber(c.RightChild.Type()) {
		return false
	}
	return l.IsValueExpression() && r.IsValueExpression()
}

func (c *comparison) evalLeftAndRight(ctx *sql.Context, row sql.Row) (interface{}, interface{}, error) {
	left, err := c.Left().Eval(ctx, row)
	if err != nil {
		return nil, nil, err
	}

	right, err := c.Right().Eval(ctx, row)
	if err != nil {
		return nil, nil, err
	}

	return left, right, nil
}

func (c *comparison) castLeftAndRight(ctx *sql.Context, left, right any) (any, any, sql.Type, error) {
	lTyp := c.Left().Type()
	rTyp := c.Right().Type()

	leftIsEnumOrSet := types.IsEnum(lTyp) || types.IsSet(lTyp)
	rightIsEnumOrSet := types.IsEnum(rTyp) || types.IsSet(rTyp)

	// Only convert if same Enum or Set
	if leftIsEnumOrSet && rightIsEnumOrSet && types.TypesEqual(lTyp, rTyp) {
		return left, right, lTyp, nil
	}

	// If right side is convertible to enum/set, convert. Otherwise, convert left side
	if leftIsEnumOrSet && (types.IsText(rTyp) || types.IsNumber(rTyp)) {
		if r, inRange, err := lTyp.Convert(ctx, right); inRange == sql.InRange && err == nil {
			return left, r, lTyp, nil
		}
		l, _, err := types.TypeAwareConversion(ctx, left, lTyp, rTyp)
		if err != nil {
			return nil, nil, nil, err
		}
		return l, right, rTyp, nil
	}
	// If left side is convertible to enum/set, convert. Otherwise, convert right side
	if rightIsEnumOrSet && (types.IsText(lTyp) || types.IsNumber(lTyp)) {
		if l, inRange, err := rTyp.Convert(ctx, left); inRange == sql.InRange && err == nil {
			return l, right, rTyp, nil
		}
		r, _, err := types.TypeAwareConversion(ctx, right, rTyp, lTyp)
		if err != nil {
			return nil, nil, nil, err
		}
		return left, r, lTyp, nil
	}

	if types.IsTimespan(lTyp) || types.IsTimespan(rTyp) {
		if l, err := types.Time.ConvertToTimespan(left); err == nil {
			if r, err := types.Time.ConvertToTimespan(right); err == nil {
				return l, r, types.Time, nil
			}
		}
	}

	if types.IsTuple(lTyp) && types.IsTuple(rTyp) {
		return left, right, lTyp, nil
	}

	if types.IsTime(lTyp) || types.IsTime(rTyp) {
		l, err := convertValue(ctx, left, ConvertToDatetime, lTyp, types.MaxDatetimePrecision, 0)
		if err != nil {
			return nil, nil, nil, err
		}
		r, err := convertValue(ctx, right, ConvertToDatetime, rTyp, types.MaxDatetimePrecision, 0)
		if err != nil {
			return nil, nil, nil, err
		}
		return l, r, types.DatetimeMaxPrecision, nil
	}

	// Rely on types.JSON.Compare to handle JSON comparisons
	if types.IsJSON(lTyp) || types.IsJSON(rTyp) {
		return left, right, types.JSON, nil
	}

	if types.IsBinaryType(lTyp) || types.IsBinaryType(rTyp) {
		l, err := convertValue(ctx, left, ConvertToBinary, lTyp, 0, 0)
		if err != nil {
			return nil, nil, nil, err
		}
		r, err := convertValue(ctx, right, ConvertToBinary, rTyp, 0, 0)
		if err != nil {
			return nil, nil, nil, err
		}
		return l, r, types.LongBlob, nil
	}

	if types.IsNumber(lTyp) || types.IsNumber(rTyp) {
		if types.IsDecimal(lTyp) || types.IsDecimal(rTyp) {
			// TODO: We need to set to the actual DECIMAL type
			l, err := convertValue(ctx, left, ConvertToDecimal, lTyp, 0, 0)
			if err != nil {
				return nil, nil, nil, err
			}
			r, err := convertValue(ctx, right, ConvertToDecimal, rTyp, 0, 0)
			if err != nil {
				return nil, nil, nil, err
			}
			if types.IsDecimal(lTyp) {
				return l, r, lTyp, nil
			} else {
				return l, r, rTyp, nil
			}
		}

		if types.IsFloat(lTyp) || types.IsFloat(rTyp) {
			l, err := convertValue(ctx, left, ConvertToDouble, lTyp, 0, 0)
			if err != nil {
				return nil, nil, nil, err
			}
			r, err := convertValue(ctx, right, ConvertToDouble, rTyp, 0, 0)
			if err != nil {
				return nil, nil, nil, err
			}
			if err != nil {
				return nil, nil, nil, err
			}

			return l, r, types.Float64, nil
		}

		if types.IsSigned(lTyp) && types.IsSigned(rTyp) {
			l, err := convertValue(ctx, left, ConvertToSigned, lTyp, 0, 0)
			if err != nil {
				return nil, nil, nil, err
			}
			r, err := convertValue(ctx, right, ConvertToSigned, rTyp, 0, 0)
			if err != nil {
				return nil, nil, nil, err
			}
			return l, r, types.Int64, nil
		}

		if types.IsUnsigned(lTyp) && types.IsUnsigned(rTyp) {
			l, err := convertValue(ctx, left, ConvertToUnsigned, lTyp, 0, 0)
			if err != nil {
				return nil, nil, nil, err
			}
			r, err := convertValue(ctx, right, ConvertToUnsigned, rTyp, 0, 0)
			if err != nil {
				return nil, nil, nil, err
			}
			return l, r, types.Uint64, nil
		}

		l, err := convertValue(ctx, left, ConvertToDouble, lTyp, 0, 0)
		if err != nil {
			return nil, nil, nil, err
		}
		r, err := convertValue(ctx, right, ConvertToDouble, rTyp, 0, 0)
		if err != nil {
			return nil, nil, nil, err
		}
		return l, r, types.Float64, nil
	}

	l, err := convertValue(ctx, left, ConvertToChar, lTyp, 0, 0)
	if err != nil {
		return nil, nil, nil, err
	}
	r, err := convertValue(ctx, right, ConvertToChar, rTyp, 0, 0)
	if err != nil {
		return nil, nil, nil, err
	}
	return l, r, types.LongText, nil
}

// Type implements the Expression interface.
func (*comparison) Type() sql.Type {
	return types.Boolean
}

// Left implements Comparer interface
func (c *comparison) Left() sql.Expression { return c.BinaryExpressionStub.LeftChild }

// Right implements Comparer interface
func (c *comparison) Right() sql.Expression { return c.BinaryExpressionStub.RightChild }

// Equality is an expression that may represent equality between two parameters (the equals operator is one such example).
type Equality interface {
	BinaryExpression
	RepresentsEquality() bool
	SwapParameters(ctx *sql.Context) (Equality, error)
	ToComparer() (Comparer, error)
}

// Equals is a comparison that checks an expression is equal to another.
type Equals struct {
	comparison
}

var _ sql.Expression = (*Equals)(nil)
var _ sql.CollationCoercible = (*Equals)(nil)
var _ Equality = (*Equals)(nil)

// NewEquals returns a new Equals expression.
func NewEquals(left sql.Expression, right sql.Expression) *Equals {
	return &Equals{newComparison(left, right)}
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (e *Equals) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

// Eval implements the Expression interface.
func (e *Equals) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	result, err := e.Compare(ctx, row)
	if err != nil {
		if ErrNilOperand.Is(err) {
			return nil, nil
		}

		return nil, err
	}

	return result == 0, nil
}

// WithChildren implements the Expression interface.
func (e *Equals) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 2 {
		return nil, sql.ErrInvalidChildrenNumber.New(e, len(children), 2)
	}
	return NewEquals(children[0], children[1]), nil
}

func (e *Equals) String() string {
	if e == nil {
		return ""
	}
	return fmt.Sprintf("(%s = %s)", e.Left(), e.Right())
}

func (e *Equals) DebugString() string {
	if e == nil {
		return ""
	}
	pr := sql.NewTreePrinter()
	_ = pr.WriteNode("Eq")
	children := []string{sql.DebugString(e.Left()), sql.DebugString(e.Right())}
	_ = pr.WriteChildren(children...)
	return pr.String()
}

// RepresentsEquality implements the Equality interface.
func (e *Equals) RepresentsEquality() bool {
	return true
}

// SwapParameters implements the Equality interface.
func (e *Equals) SwapParameters(ctx *sql.Context) (Equality, error) {
	return NewEquals(e.RightChild, e.LeftChild), nil
}

// ToComparer implements the Equality interface.
func (e *Equals) ToComparer() (Comparer, error) {
	return e, nil
}

// NullSafeEquals is a comparison that checks an expression is equal to
// another, where NULLs do not coalesce to NULL and two NULLs compare equal to
// each other.
type NullSafeEquals struct {
	comparison
}

var _ sql.Expression = (*NullSafeEquals)(nil)
var _ sql.CollationCoercible = (*NullSafeEquals)(nil)

// NewNullSafeEquals returns a new NullSafeEquals expression.
func NewNullSafeEquals(left sql.Expression, right sql.Expression) *NullSafeEquals {
	return &NullSafeEquals{newComparison(left, right)}
}

// Type implements the Expression interface.
func (e *NullSafeEquals) Type() sql.Type {
	return types.Boolean
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (e *NullSafeEquals) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

func (e *NullSafeEquals) Compare(ctx *sql.Context, row sql.Row) (int, error) {
	left, right, err := e.evalLeftAndRight(ctx, row)
	if err != nil {
		return 0, err
	}

	if left == nil && right == nil {
		return 0, nil
	} else if left == nil {
		return 1, nil
	} else if right == nil {
		return -1, nil
	}

	lTyp, rTyp := e.Left().Type(), e.Right().Type()
	if types.TypesEqual(lTyp, rTyp) {
		return lTyp.Compare(ctx, left, right)
	}

	var compareType sql.Type
	left, right, compareType, err = e.castLeftAndRight(ctx, left, right)
	if err != nil {
		return 0, err
	}

	return compareType.Compare(ctx, left, right)
}

// Eval implements the Expression interface.
func (e *NullSafeEquals) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	result, err := e.Compare(ctx, row)
	if err != nil {
		return nil, err
	}

	return result == 0, nil
}

// IsNullable implements sql.Expression
func (e *NullSafeEquals) IsNullable() bool {
	return false
}

// WithChildren implements the Expression interface.
func (e *NullSafeEquals) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 2 {
		return nil, sql.ErrInvalidChildrenNumber.New(e, len(children), 2)
	}
	return NewNullSafeEquals(children[0], children[1]), nil
}

func (e *NullSafeEquals) String() string {
	return fmt.Sprintf("(%s <=> %s)", e.Left(), e.Right())
}

func (e *NullSafeEquals) DebugString() string {
	return fmt.Sprintf("(%s <=> %s)", sql.DebugString(e.Left()), sql.DebugString(e.Right()))
}

// GreaterThan is a comparison that checks an expression is greater than another.
type GreaterThan struct {
	comparison
}

var _ sql.Expression = (*GreaterThan)(nil)
var _ sql.ValueExpression = (*GreaterThan)(nil)
var _ sql.CollationCoercible = (*GreaterThan)(nil)

// NewGreaterThan creates a new GreaterThan expression.
func NewGreaterThan(left sql.Expression, right sql.Expression) *GreaterThan {
	return &GreaterThan{newComparison(left, right)}
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (gt *GreaterThan) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

// Eval implements the Expression interface.
func (gt *GreaterThan) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	result, err := gt.Compare(ctx, row)
	if err != nil {
		if ErrNilOperand.Is(err) {
			return nil, nil
		}

		return nil, err
	}

	return result == 1, nil
}

// WithChildren implements the Expression interface.
func (gt *GreaterThan) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 2 {
		return nil, sql.ErrInvalidChildrenNumber.New(gt, len(children), 2)
	}
	return NewGreaterThan(children[0], children[1]), nil
}

func (gt *GreaterThan) String() string {
	return fmt.Sprintf("(%s > %s)", gt.Left(), gt.Right())
}

func (gt *GreaterThan) DebugString() string {
	pr := sql.NewTreePrinter()
	_ = pr.WriteNode("GreaterThan")
	children := []string{sql.DebugString(gt.Left()), sql.DebugString(gt.Right())}
	_ = pr.WriteChildren(children...)
	return pr.String()
}

// EvalValue implements the sql.ValueExpression interface.
func (gt *GreaterThan) EvalValue(ctx *sql.Context, row sql.ValueRow) (sql.Value, error) {
	cmp, err := gt.CompareValue(ctx, row)
	if err != nil {
		return sql.NullValue, err
	}
	if cmp != 1 {
		return sql.FalseValue, nil
	}
	return sql.TrueValue, nil
}

// IsValueExpression implements the ValueExpression interface.
func (gt *GreaterThan) IsValueExpression() bool {
	return gt.comparison.IsValueExpression()
}

// LessThan is a comparison that checks an expression is less than another.
type LessThan struct {
	comparison
}

var _ sql.Expression = (*LessThan)(nil)
var _ sql.CollationCoercible = (*LessThan)(nil)

// NewLessThan creates a new LessThan expression.
func NewLessThan(left sql.Expression, right sql.Expression) *LessThan {
	return &LessThan{newComparison(left, right)}
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (lt *LessThan) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

// Eval implements the expression interface.
func (lt *LessThan) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	result, err := lt.Compare(ctx, row)
	if err != nil {
		if ErrNilOperand.Is(err) {
			return nil, nil
		}
		return nil, err
	}
	return result == -1, nil
}

// WithChildren implements the Expression interface.
func (lt *LessThan) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 2 {
		return nil, sql.ErrInvalidChildrenNumber.New(lt, len(children), 2)
	}
	return NewLessThan(children[0], children[1]), nil
}

func (lt *LessThan) String() string {
	return fmt.Sprintf("(%s < %s)", lt.Left(), lt.Right())
}

func (lt *LessThan) DebugString() string {
	pr := sql.NewTreePrinter()
	_ = pr.WriteNode("LessThan")
	children := []string{sql.DebugString(lt.Left()), sql.DebugString(lt.Right())}
	_ = pr.WriteChildren(children...)
	return pr.String()
}

// EvalValue implements the sql.ValueExpression interface.
func (lt *LessThan) EvalValue(ctx *sql.Context, row sql.ValueRow) (sql.Value, error) {
	cmp, err := lt.CompareValue(ctx, row)
	if err != nil {
		return sql.NullValue, err
	}
	if cmp != -1 {
		return sql.FalseValue, nil
	}
	return sql.TrueValue, nil
}

// IsValueExpression implements the ValueExpression interface.
func (lt *LessThan) IsValueExpression() bool {
	return lt.comparison.IsValueExpression()
}

// GreaterThanOrEqual is a comparison that checks an expression is greater or equal to
// another.
type GreaterThanOrEqual struct {
	comparison
}

var _ sql.Expression = (*GreaterThanOrEqual)(nil)
var _ sql.CollationCoercible = (*GreaterThanOrEqual)(nil)

// NewGreaterThanOrEqual creates a new GreaterThanOrEqual
func NewGreaterThanOrEqual(left sql.Expression, right sql.Expression) *GreaterThanOrEqual {
	return &GreaterThanOrEqual{newComparison(left, right)}
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (gte *GreaterThanOrEqual) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

// Eval implements the Expression interface.
func (gte *GreaterThanOrEqual) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	result, err := gte.Compare(ctx, row)
	if err != nil {
		if ErrNilOperand.Is(err) {
			return nil, nil
		}
		return nil, err
	}
	return result > -1, nil
}

// WithChildren implements the Expression interface.
func (gte *GreaterThanOrEqual) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 2 {
		return nil, sql.ErrInvalidChildrenNumber.New(gte, len(children), 2)
	}
	return NewGreaterThanOrEqual(children[0], children[1]), nil
}

func (gte *GreaterThanOrEqual) String() string {
	return fmt.Sprintf("(%s >= %s)", gte.Left(), gte.Right())
}

func (gte *GreaterThanOrEqual) DebugString() string {
	pr := sql.NewTreePrinter()
	_ = pr.WriteNode("GreaterThanOrEqual")
	children := []string{sql.DebugString(gte.Left()), sql.DebugString(gte.Right())}
	_ = pr.WriteChildren(children...)
	return pr.String()
}

// EvalValue implements the sql.ValueExpression interface.
func (gte *GreaterThanOrEqual) EvalValue(ctx *sql.Context, row sql.ValueRow) (sql.Value, error) {
	cmp, err := gte.CompareValue(ctx, row)
	if err != nil {
		return sql.NullValue, err
	}
	if cmp == -1 {
		return sql.FalseValue, nil
	}
	return sql.TrueValue, nil
}

// IsValueExpression implements the ValueExpression interface.
func (gte *GreaterThanOrEqual) IsValueExpression() bool {
	return gte.comparison.IsValueExpression()
}

// LessThanOrEqual is a comparison that checks an expression is equal or lower than
// another.
type LessThanOrEqual struct {
	comparison
}

var _ sql.Expression = (*LessThanOrEqual)(nil)
var _ sql.CollationCoercible = (*LessThanOrEqual)(nil)

// NewLessThanOrEqual creates a LessThanOrEqual expression.
func NewLessThanOrEqual(left sql.Expression, right sql.Expression) *LessThanOrEqual {
	return &LessThanOrEqual{newComparison(left, right)}
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (lte *LessThanOrEqual) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

// Eval implements the Expression interface.
func (lte *LessThanOrEqual) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	result, err := lte.Compare(ctx, row)
	if err != nil {
		if ErrNilOperand.Is(err) {
			return nil, nil
		}

		return nil, err
	}

	return result < 1, nil
}

// WithChildren implements the Expression interface.
func (lte *LessThanOrEqual) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 2 {
		return nil, sql.ErrInvalidChildrenNumber.New(lte, len(children), 2)
	}
	return NewLessThanOrEqual(children[0], children[1]), nil
}

func (lte *LessThanOrEqual) String() string {
	return fmt.Sprintf("(%s <= %s)", lte.Left(), lte.Right())
}

func (lte *LessThanOrEqual) DebugString() string {
	pr := sql.NewTreePrinter()
	_ = pr.WriteNode("LessThanOrEqual")
	children := []string{sql.DebugString(lte.Left()), sql.DebugString(lte.Right())}
	_ = pr.WriteChildren(children...)
	return pr.String()
}

// EvalValue implements the sql.ValueExpression interface.
func (lte *LessThanOrEqual) EvalValue(ctx *sql.Context, row sql.ValueRow) (sql.Value, error) {
	cmp, err := lte.CompareValue(ctx, row)
	if err != nil {
		return sql.NullValue, err
	}
	if cmp == 1 {
		return sql.FalseValue, nil
	}
	return sql.TrueValue, nil
}

// IsValueExpression implements the ValueExpression interface.
func (lte *LessThanOrEqual) IsValueExpression() bool {
	return lte.comparison.IsValueExpression()
}

var (
	// ErrUnsupportedInOperand is returned when there is an invalid righthand
	// operand in an IN operator.
	ErrUnsupportedInOperand = errors.NewKind("right operand in IN operation must be tuple, but is %T")
)
