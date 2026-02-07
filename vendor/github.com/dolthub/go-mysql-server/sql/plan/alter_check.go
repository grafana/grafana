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

	"gopkg.in/src-d/go-errors.v1"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/transform"
	"github.com/dolthub/go-mysql-server/sql/types"
)

var (
	// ErrNoCheckConstraintSupport is returned when the table does not support CONSTRAINT CHECK operations.
	ErrNoCheckConstraintSupport = errors.NewKind("the table does not support check constraint operations: %s")
)

type CreateCheck struct {
	ddlNode
	Table *ResolvedTable
	Check *sql.CheckConstraint
}

var _ sql.Node = (*CreateCheck)(nil)
var _ sql.CollationCoercible = (*CreateCheck)(nil)

type DropCheck struct {
	ddlNode
	Table    *ResolvedTable
	Name     string
	IfExists bool
}

var _ sql.Node = (*DropCheck)(nil)
var _ sql.CollationCoercible = (*DropCheck)(nil)

func NewAlterAddCheck(table *ResolvedTable, check *sql.CheckConstraint) *CreateCheck {
	return &CreateCheck{
		ddlNode: ddlNode{table.SqlDatabase},
		Table:   table,
		Check:   check,
	}
}

func NewAlterDropCheck(table *ResolvedTable, name string) *DropCheck {
	return &DropCheck{
		ddlNode: ddlNode{table.SqlDatabase},
		Table:   table,
		Name:    name,
	}
}

// Expressions implements the sql.Expressioner interface.
func (c *CreateCheck) Expressions() []sql.Expression {
	return []sql.Expression{c.Check.Expr}
}

// Resolved implements the Resolvable interface.
func (c *CreateCheck) Resolved() bool {
	return c.Check.Expr.Resolved()
}

func (c *CreateCheck) IsReadOnly() bool {
	return false
}

// WithExpressions implements the sql.Expressioner interface.
func (c *CreateCheck) WithExpressions(exprs ...sql.Expression) (sql.Node, error) {
	if len(exprs) != 1 {
		return nil, fmt.Errorf("expected one expression, got: %d", len(exprs))
	}

	nc := *c
	nc.Check.Expr = exprs[0]
	return &nc, nil
}

// WithChildren implements the Node interface.
func (c *CreateCheck) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(c, len(children), 1)
	}
	return NewAlterAddCheck(children[0].(*ResolvedTable), c.Check), nil
}

func (c *CreateCheck) Children() []sql.Node {
	return []sql.Node{c.Table}
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (c *CreateCheck) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}

func (c *CreateCheck) Schema() sql.Schema { return types.OkResultSchema }

func (c CreateCheck) String() string {
	pr := sql.NewTreePrinter()
	_ = pr.WriteNode("AddCheck(%s)", c.Check.Name)
	_ = pr.WriteChildren(
		fmt.Sprintf("Table(%s)", c.Table.Name()),
		fmt.Sprintf("Expr(%s)", c.Check.Expr.String()),
	)
	return pr.String()
}

func (d *DropCheck) Children() []sql.Node {
	return []sql.Node{d.Table}
}

// WithChildren implements the Node interface.
func (d *DropCheck) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(d, len(children), 1)
	}

	newAlterDropCheck := NewAlterDropCheck(children[0].(*ResolvedTable), d.Name)
	newAlterDropCheck.IfExists = d.IfExists
	return newAlterDropCheck, nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (d *DropCheck) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}

func (d *DropCheck) Schema() sql.Schema { return nil }

func (d *DropCheck) IsReadOnly() bool { return false }

func (d DropCheck) String() string {
	pr := sql.NewTreePrinter()
	_ = pr.WriteNode("DropCheck(%s)", d.Name)
	_ = pr.WriteChildren(fmt.Sprintf("Table(%s)", d.Table.Name()))
	return pr.String()
}

func NewCheckDefinition(ctx *sql.Context, check *sql.CheckConstraint) (*sql.CheckDefinition, error) {
	// When transforming an analyzed CheckConstraint into a CheckDefinition (for storage), we strip off any table
	// qualifiers that got resolved during analysis. This is to naively match the MySQL behavior, which doesn't print
	// any table qualifiers in check expressions.
	unqualifiedCols, _, err := transform.Expr(check.Expr, func(e sql.Expression) (sql.Expression, transform.TreeIdentity, error) {
		gf, ok := e.(*expression.GetField)
		if ok {
			newGf := expression.NewGetField(gf.Index(), gf.Type(), gf.Name(), gf.IsNullable())
			newGf = newGf.WithQuotedNames(sql.GlobalSchemaFormatter, true)
			return newGf, transform.NewTree, nil
		}
		return e, transform.SameTree, nil
	})
	if err != nil {
		return nil, err
	}

	return &sql.CheckDefinition{
		Name:            check.Name,
		CheckExpression: unqualifiedCols.String(),
		Enforced:        check.Enforced,
	}, nil
}

// DropConstraint is a temporary node to handle dropping a named constraint on a table. The type of the constraint is
// not known, and is determined during analysis.
type DropConstraint struct {
	UnaryNode
	Name     string
	IfExists bool
}

var _ sql.Node = (*DropConstraint)(nil)
var _ sql.CollationCoercible = (*DropConstraint)(nil)

func (d *DropConstraint) String() string {
	tp := sql.NewTreePrinter()
	_ = tp.WriteNode("DropConstraint(%s)", d.Name)
	_ = tp.WriteChildren(d.UnaryNode.Child.String())
	return tp.String()
}

func (d DropConstraint) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(d, len(children), 1)
	}

	nd := &d
	nd.UnaryNode = UnaryNode{children[0]}
	return nd, nil
}

func (d *DropConstraint) IsReadOnly() bool { return false }

// CollationCoercibility implements the interface sql.CollationCoercible.
func (d *DropConstraint) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}

// NewDropConstraint returns a new DropConstraint node
func NewDropConstraint(table *UnresolvedTable, name string) *DropConstraint {
	return &DropConstraint{
		UnaryNode: UnaryNode{table},
		Name:      name,
	}
}
