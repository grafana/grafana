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
	"gopkg.in/src-d/go-errors.v1"

	"github.com/dolthub/go-mysql-server/sql"
)

var ErrInvalidOffset = errors.NewKind("offset must be a non-negative integer; found: %v")

// IsUnary returns whether the expression is unary or not.
func IsUnary(e sql.Expression) bool {
	return len(e.Children()) == 1
}

// IsBinary returns whether the expression is binary or not.
func IsBinary(e sql.Expression) bool {
	return len(e.Children()) == 2
}

// UnaryExpression is an expression that has only one child.
type UnaryExpression struct {
	Child sql.Expression
}

// Children implements the Expression interface.
func (p *UnaryExpression) Children() []sql.Expression {
	return []sql.Expression{p.Child}
}

// Resolved implements the Expression interface.
func (p *UnaryExpression) Resolved() bool {
	return p.Child.Resolved()
}

// IsNullable returns whether the expression can be null.
func (p *UnaryExpression) IsNullable() bool {
	return p.Child.IsNullable()
}

// BinaryExpressionStub is an expression that has two children.
type BinaryExpressionStub struct {
	LeftChild  sql.Expression
	RightChild sql.Expression
}

// BinaryExpression is an expression that has two children
type BinaryExpression interface {
	sql.Expression
	Left() sql.Expression
	Right() sql.Expression
}

func (p *BinaryExpressionStub) Left() sql.Expression {
	return p.LeftChild
}

func (p *BinaryExpressionStub) Right() sql.Expression {
	return p.RightChild
}

// Children implements the Expression interface.
func (p *BinaryExpressionStub) Children() []sql.Expression {
	return []sql.Expression{p.LeftChild, p.RightChild}
}

// Resolved implements the Expression interface.
func (p *BinaryExpressionStub) Resolved() bool {
	return p.LeftChild.Resolved() && p.RightChild.Resolved()
}

// IsNullable returns whether the expression can be null.
func (p *BinaryExpressionStub) IsNullable() bool {
	return p.LeftChild.IsNullable() || p.RightChild.IsNullable()
}

type NaryExpression struct {
	ChildExpressions []sql.Expression
}

// Children implements the Expression interface.
func (n *NaryExpression) Children() []sql.Expression {
	return n.ChildExpressions
}

// Resolved implements the Expression interface.
func (n *NaryExpression) Resolved() bool {
	for _, child := range n.Children() {
		if !child.Resolved() {
			return false
		}
	}
	return true
}

// IsNullable returns whether the expression can be null.
func (n *NaryExpression) IsNullable() bool {
	for _, child := range n.Children() {
		if child.IsNullable() {
			return true
		}
	}
	return false
}

// ExpressionsResolved returns whether all the expressions in the slice given are resolved
func ExpressionsResolved(exprs ...sql.Expression) bool {
	for _, e := range exprs {
		if !e.Resolved() {
			return false
		}
	}

	return true
}

func Dispose(e sql.Expression) {
	sql.Inspect(e, func(e sql.Expression) bool {
		sql.Dispose(e)
		return true
	})
}

// LiteralToInt extracts a non-negative integer from an expression.Literal, or errors
func LiteralToInt(e sql.Expression) (int, error) {
	lit, ok := e.(*Literal)
	if !ok {
		return 0, ErrInvalidOffset.New(e)
	}
	val := lit.Value()
	var offset int
	switch e := val.(type) {
	case int:
		offset = e
	case int8:
		offset = int(e)
	case int16:
		offset = int(e)
	case int32:
		offset = int(e)
	case int64:
		offset = int(e)
	case uint:
		offset = int(e)
	case uint8:
		offset = int(e)
	case uint16:
		offset = int(e)
	case uint32:
		offset = int(e)
	case uint64:
		offset = int(e)
	default:
		return 0, ErrInvalidOffset.New(e)
	}

	if offset < 0 {
		return 0, ErrInvalidOffset.New(e)
	}

	return offset, nil
}
