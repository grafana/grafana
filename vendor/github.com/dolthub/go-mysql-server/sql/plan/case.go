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

package plan

import (
	"fmt"

	"github.com/dolthub/go-mysql-server/sql"
)

// CaseStatement represents CASE statements, which are different from CASE expressions. These are intended for use in
// triggers and stored procedures. Specifically, this implements CASE statements when comparing each conditional to a
// value. The version of CASE that does not compare each conditional to a value is functionally equivalent to a series
// of IF/ELSE statements, and therefore we simply use an IfElseBlock.
type CaseStatement struct {
	Expr   sql.Expression
	IfElse *IfElseBlock
}

var _ sql.Node = (*CaseStatement)(nil)
var _ sql.DebugStringer = (*CaseStatement)(nil)
var _ sql.Expressioner = (*CaseStatement)(nil)
var _ sql.CollationCoercible = (*CaseStatement)(nil)

// NewCaseStatement creates a new *NewCaseStatement or *IfElseBlock node.
func NewCaseStatement(caseExpr sql.Expression, ifConditionals []*IfConditional, elseStatement sql.Node) sql.Node {
	if elseStatement == nil {
		elseStatement = ElseCaseError{}
	}
	ifElse := &IfElseBlock{
		IfConditionals: ifConditionals,
		Else:           elseStatement,
	}
	if caseExpr != nil {
		return &CaseStatement{
			Expr:   caseExpr,
			IfElse: ifElse,
		}
	}
	return ifElse
}

// Resolved implements the interface sql.Node.
func (c *CaseStatement) Resolved() bool {
	return c.Expr.Resolved() && c.IfElse.Resolved()
}

func (c *CaseStatement) IsReadOnly() bool {
	return c.IfElse.IsReadOnly()
}

// String implements the interface sql.Node.
func (c *CaseStatement) String() string {
	p := sql.NewTreePrinter()
	_ = p.WriteNode("CASE %s", c.Expr.String())
	_ = p.WriteChildren(c.IfElse.String())
	return p.String()
}

// DebugString implements the sql.DebugStringer interface.
func (c *CaseStatement) DebugString() string {
	p := sql.NewTreePrinter()
	_ = p.WriteNode("CASE %s", sql.DebugString(c.Expr))
	_ = p.WriteChildren(sql.DebugString(c.IfElse))
	return p.String()
}

// Schema implements the interface sql.Node.
func (c *CaseStatement) Schema() sql.Schema {
	return c.IfElse.Schema()
}

// Children implements the interface sql.Node.
func (c *CaseStatement) Children() []sql.Node {
	return c.IfElse.Children()
}

// WithChildren implements the interface sql.Node.
func (c *CaseStatement) WithChildren(children ...sql.Node) (sql.Node, error) {
	newIfElseNode, err := c.IfElse.WithChildren(children...)
	if err != nil {
		return nil, err
	}
	newIfElse, ok := newIfElseNode.(*IfElseBlock)
	if !ok {
		return nil, fmt.Errorf("%T: expected child %T but got %T", c, c.IfElse, newIfElseNode)
	}

	return &CaseStatement{
		Expr:   c.Expr,
		IfElse: newIfElse,
	}, nil
}

// Expressions implements the interface sql.Node.
func (c *CaseStatement) Expressions() []sql.Expression {
	return []sql.Expression{c.Expr}
}

// WithExpressions implements the interface sql.Node.
func (c *CaseStatement) WithExpressions(exprs ...sql.Expression) (sql.Node, error) {
	if len(exprs) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(c, len(exprs), 1)
	}

	return &CaseStatement{
		Expr:   exprs[0],
		IfElse: c.IfElse,
	}, nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (c *CaseStatement) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return c.IfElse.CollationCoercibility(ctx)
}

type ElseCaseError struct{}

var _ sql.Node = ElseCaseError{}

// Resolved implements the interface sql.Node.
func (e ElseCaseError) Resolved() bool {
	return true
}

func (e ElseCaseError) IsReadOnly() bool {
	return true
}

// String implements the interface sql.Node.
func (e ElseCaseError) String() string {
	return "ELSE CASE ERROR"
}

// Schema implements the interface sql.Node.
func (e ElseCaseError) Schema() sql.Schema {
	return nil
}

// Children implements the interface sql.Node.
func (e ElseCaseError) Children() []sql.Node {
	return nil
}

// WithChildren implements the interface sql.Node.
func (e ElseCaseError) WithChildren(children ...sql.Node) (sql.Node, error) {
	return NillaryWithChildren(e, children...)
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (e ElseCaseError) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}
