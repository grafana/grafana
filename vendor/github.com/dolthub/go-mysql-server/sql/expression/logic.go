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
	"strings"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// And checks whether two expressions are true.
type And struct {
	BinaryExpressionStub
}

var _ sql.Expression = (*And)(nil)
var _ sql.CollationCoercible = (*And)(nil)

// NewAnd creates a new And expression.
func NewAnd(left, right sql.Expression) sql.Expression {
	return &And{BinaryExpressionStub{LeftChild: left, RightChild: right}}
}

// JoinAnd joins several expressions with And.
func JoinAnd(exprs ...sql.Expression) sql.Expression {
	switch len(exprs) {
	case 0:
		return nil
	case 1:
		return exprs[0]
	default:
		if exprs[0] == nil {
			return JoinAnd(exprs[1:]...)
		}
		result := NewAnd(exprs[0], exprs[1])
		for _, e := range exprs[2:] {
			if e != nil {
				result = NewAnd(result, e)
			}
		}
		return result
	}
}

// SplitConjunction breaks AND expressions into their left and right parts, recursively
func SplitConjunction(expr sql.Expression) []sql.Expression {
	if expr == nil {
		return nil
	}
	and, ok := expr.(*And)
	if !ok {
		return []sql.Expression{expr}
	}

	return append(
		SplitConjunction(and.LeftChild),
		SplitConjunction(and.RightChild)...,
	)
}

// SplitDisjunction breaks OR expressions into their left and right parts, recursively
func SplitDisjunction(expr sql.Expression) []sql.Expression {
	if expr == nil {
		return nil
	}
	and, ok := expr.(*Or)
	if !ok {
		return []sql.Expression{expr}
	}

	return append(
		SplitDisjunction(and.LeftChild),
		SplitDisjunction(and.RightChild)...,
	)
}

type LookupColumn struct {
	Lit *Literal
	Eq  *Equals
	Col string
}

// LookupEqualityColumn breaks AND expressions into a list of equalities split into
// (1) the column names and (2) opposing *Literal expressions. If the expression is
// not an equality with literal columns, return (nil, false).
func LookupEqualityColumn(db, table string, e sql.Expression) (LookupColumn, bool) {
	if e == nil {
		return LookupColumn{}, false
	}
	switch e := e.(type) {
	case *Equals:
		if gf, ok := e.Left().(*GetField); ok {
			if strings.EqualFold(gf.Table(), table) && strings.EqualFold(gf.Database(), db) {
				switch r := e.Right().(type) {
				case *Literal:
					return LookupColumn{Eq: e, Lit: r, Col: strings.ToLower(gf.name)}, true
				}
			}
		}
		if gf, ok := e.Right().(*GetField); ok {
			if strings.EqualFold(gf.Table(), table) && strings.EqualFold(gf.Database(), db) {
				switch l := e.Left().(type) {
				case *Literal:
					return LookupColumn{Eq: e, Lit: l, Col: strings.ToLower(gf.name)}, true
				}
			}
		}
	}
	return LookupColumn{}, false
}

func (a *And) String() string {
	return fmt.Sprintf("(%s AND %s)", a.LeftChild, a.RightChild)
}

func (a *And) DebugString() string {
	pr := sql.NewTreePrinter()
	_ = pr.WriteNode("AND")
	children := []string{sql.DebugString(a.LeftChild), sql.DebugString(a.RightChild)}
	_ = pr.WriteChildren(children...)
	return pr.String()
}

// Type implements the Expression interface.
func (*And) Type() sql.Type {
	return types.Boolean
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*And) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

// Eval implements the Expression interface.
func (a *And) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	lval, err := a.LeftChild.Eval(ctx, row)
	if err != nil {
		return nil, err
	}
	if lval != nil {
		lvalBool, err := sql.ConvertToBool(ctx, lval)
		if err == nil && lvalBool == false {
			return false, nil
		}
	}

	rval, err := a.RightChild.Eval(ctx, row)
	if err != nil {
		return nil, err
	}
	if rval != nil {
		rvalBool, err := sql.ConvertToBool(ctx, rval)
		if err == nil && rvalBool == false {
			return false, nil
		}
	}

	if lval == nil || rval == nil {
		return nil, nil
	}

	return true, nil
}

// WithChildren implements the Expression interface.
func (a *And) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 2 {
		return nil, sql.ErrInvalidChildrenNumber.New(a, len(children), 2)
	}
	return NewAnd(children[0], children[1]), nil
}

// Or checks whether one of the two given expressions is true.
type Or struct {
	BinaryExpressionStub
}

var _ sql.Expression = (*Or)(nil)
var _ sql.CollationCoercible = (*Or)(nil)

// NewOr creates a new Or expression.
func NewOr(left, right sql.Expression) sql.Expression {
	return &Or{BinaryExpressionStub{LeftChild: left, RightChild: right}}
}

// JoinOr joins several expressions with Or.
func JoinOr(exprs ...sql.Expression) sql.Expression {
	switch len(exprs) {
	case 0:
		return nil
	case 1:
		return exprs[0]
	default:
		if exprs[0] == nil {
			return JoinOr(exprs[1:]...)
		}
		result := NewOr(exprs[0], exprs[1])
		for _, e := range exprs[2:] {
			if e != nil {
				result = NewOr(result, e)
			}
		}
		return result
	}
}

func (o *Or) String() string {
	return fmt.Sprintf("(%s OR %s)", o.LeftChild, o.RightChild)
}

func (o *Or) DebugString() string {
	pr := sql.NewTreePrinter()
	_ = pr.WriteNode("Or")
	children := []string{sql.DebugString(o.LeftChild), sql.DebugString(o.RightChild)}
	_ = pr.WriteChildren(children...)
	return pr.String()
}

// Type implements the Expression interface.
func (*Or) Type() sql.Type {
	return types.Boolean
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*Or) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

// Eval implements the Expression interface.
func (o *Or) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	lval, err := o.LeftChild.Eval(ctx, row)
	if err != nil {
		return nil, err
	}
	if lval != nil {
		lval, err = sql.ConvertToBool(ctx, lval)
		if err == nil && lval.(bool) {
			return true, nil
		}
	}

	rval, err := o.RightChild.Eval(ctx, row)
	if err != nil {
		return nil, err
	}
	if rval != nil {
		rval, err = sql.ConvertToBool(ctx, rval)
		if err == nil && rval.(bool) {
			return true, nil
		}
	}

	// Can also be triggered by lval and rval not being bool types.
	if lval == false && rval == false {
		return false, nil
	}

	// (lval == nil && rval == nil) || (lval == false && rval == nil) || (lval == nil && rval == false)
	return nil, nil
}

// WithChildren implements the Expression interface.
func (o *Or) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 2 {
		return nil, sql.ErrInvalidChildrenNumber.New(o, len(children), 2)
	}
	return NewOr(children[0], children[1]), nil
}

// Xor checks whether only one of the two given expressions is true.
type Xor struct {
	BinaryExpressionStub
}

var _ sql.Expression = (*Xor)(nil)
var _ sql.CollationCoercible = (*Xor)(nil)

// NewXor creates a new Xor expression.
func NewXor(left, right sql.Expression) sql.Expression {
	return &Xor{BinaryExpressionStub{LeftChild: left, RightChild: right}}
}

func (x *Xor) String() string {
	return fmt.Sprintf("(%s XOR %s)", x.LeftChild, x.RightChild)
}

func (x *Xor) DebugString() string {
	return fmt.Sprintf("%s XOR %s", sql.DebugString(x.LeftChild), sql.DebugString(x.RightChild))
}

// Type implements the Expression interface.
func (*Xor) Type() sql.Type {
	return types.Boolean
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*Xor) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 5
}

// Eval implements the Expression interface.
func (x *Xor) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	lval, err := x.LeftChild.Eval(ctx, row)
	if err != nil {
		return nil, err
	}
	if lval == nil {
		return nil, nil
	}
	lvalue, err := sql.ConvertToBool(ctx, lval)
	if err != nil {
		return nil, err
	}

	rval, err := x.RightChild.Eval(ctx, row)
	if err != nil {
		return nil, err
	}
	if rval == nil {
		return nil, nil
	}
	rvalue, err := sql.ConvertToBool(ctx, rval)
	if err != nil {
		return nil, err
	}

	// a XOR b == (a AND (NOT b)) OR ((NOT a) and b)
	if (rvalue && !lvalue) || (!rvalue && lvalue) {
		return true, nil
	}
	return false, nil
}

// WithChildren implements the Expression interface.
func (x *Xor) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 2 {
		return nil, sql.ErrInvalidChildrenNumber.New(x, len(children), 2)
	}
	return NewXor(children[0], children[1]), nil
}
