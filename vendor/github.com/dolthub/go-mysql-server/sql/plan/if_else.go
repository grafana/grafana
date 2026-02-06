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

package plan

import (
	"fmt"

	"github.com/dolthub/go-mysql-server/sql"
)

// IfConditional represents IF statements only.
type IfConditional struct {
	Condition sql.Expression
	Body      sql.Node
}

var _ sql.Node = (*IfConditional)(nil)
var _ sql.DebugStringer = (*IfConditional)(nil)
var _ sql.Expressioner = (*IfConditional)(nil)
var _ sql.CollationCoercible = (*IfConditional)(nil)
var _ RepresentsBlock = (*IfConditional)(nil)

// NewIfConditional creates a new *IfConditional node.
func NewIfConditional(condition sql.Expression, body sql.Node) *IfConditional {
	return &IfConditional{
		Condition: condition,
		Body:      body,
	}
}

func (ic *IfConditional) IsReadOnly() bool {
	return ic.Body.IsReadOnly()
}

// Resolved implements the sql.Node interface.
func (ic *IfConditional) Resolved() bool {
	return ic.Condition.Resolved() && ic.Body.Resolved()
}

// String implements the sql.Node interface.
func (ic *IfConditional) String() string {
	p := sql.NewTreePrinter()
	_ = p.WriteNode("IF(%s)", ic.Condition.String())
	_ = p.WriteChildren(ic.Body.String())
	return p.String()
}

// DebugString implements the sql.DebugStringer interface.
func (ic *IfConditional) DebugString() string {
	p := sql.NewTreePrinter()
	_ = p.WriteNode("IF(%s)", sql.DebugString(ic.Condition))
	_ = p.WriteChildren(sql.DebugString(ic.Body))
	return p.String()
}

// Schema implements the sql.Node interface.
func (ic *IfConditional) Schema() sql.Schema {
	return ic.Body.Schema()
}

// Children implements the sql.Node interface.
func (ic *IfConditional) Children() []sql.Node {
	return []sql.Node{ic.Body}
}

// WithChildren implements the sql.Node interface.
func (ic *IfConditional) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(ic, len(children), 1)
	}

	nic := *ic
	nic.Body = children[0]
	return &nic, nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (ic *IfConditional) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.GetCoercibility(ctx, ic.Body)
}

// Expressions implements the sql.Expressioner interface.
func (ic *IfConditional) Expressions() []sql.Expression {
	return []sql.Expression{ic.Condition}
}

// WithExpressions implements the sql.Expressioner interface.
func (ic *IfConditional) WithExpressions(exprs ...sql.Expression) (sql.Node, error) {
	if len(exprs) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(ic, len(exprs), 1)
	}

	nic := *ic
	nic.Condition = exprs[0]
	return &nic, nil
}

// implementsRepresentsBlock implements the RepresentsBlock interface.
func (ic *IfConditional) implementsRepresentsBlock() {}

// IfElseBlock represents IF/ELSE IF/ELSE statements.
type IfElseBlock struct {
	Else           sql.Node
	IfConditionals []*IfConditional
}

var _ sql.CollationCoercible = (*IfElseBlock)(nil)
var _ sql.DebugStringer = (*IfElseBlock)(nil)
var _ RepresentsBlock = (*IfElseBlock)(nil)

// NewIfElse creates a new *IfElseBlock node.
func NewIfElse(ifConditionals []*IfConditional, elseStatement sql.Node) *IfElseBlock {
	return &IfElseBlock{
		IfConditionals: ifConditionals,
		Else:           elseStatement,
	}
}

// Resolved implements the sql.Node interface.
func (ieb *IfElseBlock) Resolved() bool {
	for _, s := range ieb.IfConditionals {
		if !s.Resolved() {
			return false
		}
	}
	return ieb.Else.Resolved()
}

func (ieb *IfElseBlock) IsReadOnly() bool {
	for _, s := range ieb.IfConditionals {
		if !s.IsReadOnly() {
			return false
		}
	}
	return ieb.Else.IsReadOnly()
}

// String implements the sql.Node interface.
func (ieb *IfElseBlock) String() string {
	p := sql.NewTreePrinter()
	_ = p.WriteNode("IF BLOCK")
	var children []string
	for _, s := range ieb.IfConditionals {
		children = append(children, s.String())
	}
	_ = p.WriteChildren(children...)

	ep := sql.NewTreePrinter()
	_ = ep.WriteNode("ELSE")
	_ = ep.WriteChildren(ieb.Else.String())
	_ = p.WriteChildren(ep.String())

	return p.String()
}

// DebugString implements the sql.DebugStringer interface.
func (ieb *IfElseBlock) DebugString() string {
	p := sql.NewTreePrinter()
	_ = p.WriteNode("IF BLOCK")
	var children []string
	for _, s := range ieb.IfConditionals {
		children = append(children, sql.DebugString(s))
	}
	_ = p.WriteChildren(children...)

	ep := sql.NewTreePrinter()
	_ = ep.WriteNode("ELSE")
	_ = ep.WriteChildren(sql.DebugString(ieb.Else))
	_ = p.WriteChildren(ep.String())

	return p.String()
}

// Schema implements the sql.Node interface.
func (ieb *IfElseBlock) Schema() sql.Schema {
	// NOTE: nil schema causes no result for over the wire clients
	return emptySch
}

// Children implements the sql.Node interface.
func (ieb *IfElseBlock) Children() []sql.Node {
	statements := make([]sql.Node, len(ieb.IfConditionals)+1)
	for i, ifConditional := range ieb.IfConditionals {
		statements[i] = ifConditional
	}
	statements[len(ieb.IfConditionals)] = ieb.Else
	return statements
}

// WithChildren implements the sql.Node interface.
func (ieb *IfElseBlock) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) < 2 {
		return nil, fmt.Errorf("%T: invalid children number, got %d, expected at least 2", ieb, len(children))
	}
	ifConditionals := make([]*IfConditional, len(children)-1)
	for i, child := range children[:len(children)-1] {
		ifConditional, ok := child.(*IfConditional)
		if !ok {
			return nil, fmt.Errorf("%T: expected if conditional child but got %T", ieb, child)
		}
		ifConditionals[i] = ifConditional
	}
	return NewIfElse(ifConditionals, children[len(children)-1]), nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (ieb *IfElseBlock) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	// We'll only be able to know which branch was taken during the RowIter, so we can't rely on that here.
	// I'm going to make the assumption that this will never need to be used, so we'll return 7 here.
	return sql.Collation_binary, 7
}

// implementsRepresentsBlock implements the RepresentsBlock interface.
func (ieb *IfElseBlock) implementsRepresentsBlock() {}
