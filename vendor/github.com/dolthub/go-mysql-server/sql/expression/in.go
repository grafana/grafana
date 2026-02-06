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

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/hash"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// InTuple is an expression that checks an expression is inside a list of expressions.
type InTuple struct {
	BinaryExpressionStub
}

// We implement Comparer because we have a Left() and a Right(), but we can't be Compare()d
var _ Comparer = (*InTuple)(nil)
var _ sql.CollationCoercible = (*InTuple)(nil)

func (in *InTuple) Compare(ctx *sql.Context, row sql.Row) (int, error) {
	panic("Compare not implemented for InTuple")
}

func (in *InTuple) Type() sql.Type {
	return types.Boolean
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*InTuple) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

func (in *InTuple) Left() sql.Expression {
	return in.BinaryExpressionStub.LeftChild
}

func (in *InTuple) Right() sql.Expression {
	return in.BinaryExpressionStub.RightChild
}

// NewInTuple creates an InTuple expression.
func NewInTuple(left sql.Expression, right sql.Expression) *InTuple {
	disableRounding(left)
	disableRounding(right)
	return &InTuple{BinaryExpressionStub{left, right}}
}

// Eval implements the Expression interface.
func (in *InTuple) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	lVal, err := in.Left().Eval(ctx, row)
	if err != nil {
		return nil, err
	}

	// The NULL handling for IN expressions is tricky. According to
	// https://dev.mysql.com/doc/refman/8.0/en/comparison-operators.html#operator_in:
	// To comply with the SQL standard, IN() returns NULL not only if the expression on the left hand side is NULL, but
	// also if no match is found in the list and one of the expressions in the list is NULL.
	if lVal == nil {
		return nil, nil
	}

	lType := in.Left().Type()
	lColCount := types.NumColumns(lType)
	lLit := NewLiteral(lVal, lType)

	right, isTuple := in.Right().(Tuple)
	if !isTuple {
		return nil, ErrUnsupportedInOperand.New(right)
	}

	var rHasNull bool
	for _, el := range right {
		rType := el.Type()
		if rType == types.Null {
			rHasNull = true
			continue
		}

		// Nested tuples must have the same number of columns
		rColCount := types.NumColumns(rType)
		if rColCount != lColCount {
			return nil, sql.ErrInvalidOperandColumns.New(lColCount, rColCount)
		}

		rVal, rErr := el.Eval(ctx, row)
		if rErr != nil {
			return nil, rErr
		}
		if rVal == nil {
			rHasNull = true
			continue
		}

		cmpExpr := newComparison(lLit, NewLiteral(rVal, rType))
		res, cErr := cmpExpr.Compare(ctx, nil)
		if cErr != nil {
			continue
		}
		if res == 0 {
			return true, nil
		}
	}

	if rHasNull {
		return nil, nil
	}
	return false, nil
}

// WithChildren implements the Expression interface.
func (in *InTuple) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 2 {
		return nil, sql.ErrInvalidChildrenNumber.New(in, len(children), 2)
	}
	return NewInTuple(children[0], children[1]), nil
}

func (in *InTuple) String() string {
	// scalar expression must round-trip
	return fmt.Sprintf("(%s IN %s)", in.Left(), in.Right())
}

func (in *InTuple) DebugString() string {
	pr := sql.NewTreePrinter()
	_ = pr.WriteNode("IN")
	children := []string{fmt.Sprintf("left: %s", sql.DebugString(in.Left())), fmt.Sprintf("right: %s", sql.DebugString(in.Right()))}
	_ = pr.WriteChildren(children...)
	return pr.String()
}

// Children implements the Expression interface.
func (in *InTuple) Children() []sql.Expression {
	return []sql.Expression{in.Left(), in.Right()}
}

// NewNotInTuple creates a new NotInTuple expression.
func NewNotInTuple(left sql.Expression, right sql.Expression) sql.Expression {
	return NewNot(NewInTuple(left, right))
}

// HashInTuple is an expression that checks an expression is inside a list of expressions using a hashmap.
type HashInTuple struct {
	in      *InTuple
	cmp     map[uint64]struct{}
	cmpType sql.Type
	hasNull bool
}

var _ Comparer = (*HashInTuple)(nil)
var _ sql.CollationCoercible = (*HashInTuple)(nil)
var _ sql.Expression = (*HashInTuple)(nil)

// NewHashInTuple creates an InTuple expression.
func NewHashInTuple(ctx *sql.Context, left, right sql.Expression) (*HashInTuple, error) {
	rightTup, ok := right.(Tuple)
	if !ok {
		return nil, ErrUnsupportedInOperand.New(right)
	}

	cmp, cmpType, hasNull, err := newInMap(ctx, left.Type(), rightTup)
	if err != nil {
		return nil, err
	}

	return &HashInTuple{
		in:      NewInTuple(left, right),
		cmp:     cmp,
		cmpType: cmpType,
		hasNull: hasNull,
	}, nil
}

// newInMap hashes static expressions in the right child Tuple of a InTuple node
// returns
//   - map of the hashed elements
//   - sql.Type to convert elements to before hashing
//   - bool indicating if there are null elements
//   - error
func newInMap(ctx *sql.Context, lType sql.Type, right Tuple) (map[uint64]struct{}, sql.Type, bool, error) {
	if lType == types.Null {
		return nil, nil, true, nil
	}
	lColCount := types.NumColumns(lType)
	if len(right) == 0 {
		return nil, nil, false, nil
	}
	// only non-nil elements are included
	rVals := make([]any, 0, len(right))
	var rHasNull bool
	for _, el := range right {
		rType := el.Type()
		rColCount := types.NumColumns(rType)
		if lColCount != rColCount {
			return nil, nil, false, sql.ErrInvalidOperandColumns.New(lColCount, rColCount)
		}
		if rType == types.Null {
			rHasNull = true
			continue
		}
		rVal, err := el.Eval(ctx, nil)
		if err != nil {
			return nil, nil, false, err
		}
		if rVal == nil {
			rHasNull = true
			continue
		}
		rVals = append(rVals, rVal)
	}

	var cmpType sql.Type
	if types.IsEnum(lType) || types.IsSet(lType) {
		cmpType = lType
	} else {
		// If we've made it this far, we are guaranteed that the right Tuple has a consistent set of types
		// (all numeric, string, or time), so it is enough to just compare against the first element of the right Tuple
		cmpType = types.GetCompareType(lType, right[0].Type())
	}
	elements := map[uint64]struct{}{}
	for _, rVal := range rVals {
		key, hErr := hash.HashOfSimple(ctx, rVal, cmpType)
		if hErr != nil {
			return nil, nil, false, hErr
		}
		elements[key] = struct{}{}
	}
	return elements, cmpType, rHasNull, nil
}

// Eval implements the Expression interface.
func (hit *HashInTuple) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	leftVal, err := hit.in.Left().Eval(ctx, row)
	if err != nil {
		return nil, err
	}
	if leftVal == nil {
		return nil, nil
	}

	key, err := hash.HashOfSimple(ctx, leftVal, hit.cmpType)
	if err != nil {
		return nil, err
	}

	if _, ok := hit.cmp[key]; ok {
		return true, nil
	}
	if hit.hasNull {
		return nil, nil
	}
	return false, nil
}

func (hit *HashInTuple) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return hit.in.CollationCoercibility(ctx)
}

func (hit *HashInTuple) Resolved() bool {
	return hit.in.Resolved()
}

func (hit *HashInTuple) Type() sql.Type {
	return hit.in.Type()
}

func (hit *HashInTuple) IsNullable() bool {
	return hit.in.IsNullable()
}

func (hit *HashInTuple) Children() []sql.Expression {
	return hit.in.Children()
}

func (hit *HashInTuple) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 2 {
		return nil, sql.ErrInvalidChildrenNumber.New(hit, len(children), 2)
	}
	ret := *hit
	newIn, err := ret.in.WithChildren(children...)
	ret.in = newIn.(*InTuple)
	return &ret, err
}

func (hit *HashInTuple) Compare(ctx *sql.Context, row sql.Row) (int, error) {
	return hit.in.Compare(ctx, row)
}

func (hit *HashInTuple) Left() sql.Expression {
	return hit.in.Left()
}

func (hit *HashInTuple) Right() sql.Expression {
	return hit.in.Right()
}

func (hit *HashInTuple) String() string {
	return fmt.Sprintf("(%s HASH IN %s)", hit.in.Left(), hit.in.Right())
}

func (hit *HashInTuple) DebugString() string {
	pr := sql.NewTreePrinter()
	_ = pr.WriteNode("HashIn")
	children := []string{sql.DebugString(hit.in.Left()), sql.DebugString(hit.in.Right())}
	_ = pr.WriteChildren(children...)
	return pr.String()
}
