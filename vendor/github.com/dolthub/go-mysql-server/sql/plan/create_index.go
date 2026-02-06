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

package plan

import (
	"fmt"
	"strings"

	errors "gopkg.in/src-d/go-errors.v1"

	"github.com/dolthub/go-mysql-server/sql"
)

var (
	// ErrNotIndexable is returned when the table is not indexable.
	ErrNotIndexable = errors.NewKind("the table is not indexable")

	// ErrInvalidIndexDriver is returned when the index driver can't be found.
	ErrInvalidIndexDriver = errors.NewKind("invalid driver index %q")

	// ErrExprTypeNotIndexable is returned when the expression type cannot be
	// indexed, such as BLOB or JSON.
	ErrExprTypeNotIndexable = errors.NewKind("expression %q with type %s cannot be indexed")
)

// CreateIndex is a node to create an index.
type CreateIndex struct {
	Table   sql.Node
	Catalog sql.Catalog
	Config  map[string]string

	Name            string
	Driver          string
	CurrentDatabase string
	Exprs           []sql.Expression
}

var _ sql.Node = (*CreateIndex)(nil)
var _ sql.Databaseable = (*CreateIndex)(nil)
var _ sql.CollationCoercible = (*CreateIndex)(nil)

// NewCreateIndex creates a new CreateIndex node.
func NewCreateIndex(
	name string,
	table sql.Node,
	exprs []sql.Expression,
	driver string,
	config map[string]string,
) *CreateIndex {
	return &CreateIndex{
		Name:   name,
		Table:  table,
		Exprs:  exprs,
		Driver: driver,
		Config: config,
	}
}

func (c *CreateIndex) Database() string { return c.CurrentDatabase }

// Children implements the Node interface.
func (c *CreateIndex) Children() []sql.Node { return []sql.Node{c.Table} }

// Resolved implements the Node interface.
func (c *CreateIndex) Resolved() bool {
	if !c.Table.Resolved() {
		return false
	}

	for _, e := range c.Exprs {
		if !e.Resolved() {
			return false
		}
	}

	return true
}

func (c *CreateIndex) IsReadOnly() bool {
	return false
}

// Schema implements the Node interface.
func (c *CreateIndex) Schema() sql.Schema { return nil }

func (c *CreateIndex) String() string {
	var exprs = make([]string, len(c.Exprs))
	for i, e := range c.Exprs {
		exprs[i] = e.String()
	}

	pr := sql.NewTreePrinter()
	_ = pr.WriteNode("CreateIndex(%s)", c.Name)
	_ = pr.WriteChildren(
		fmt.Sprintf("USING %s", c.Driver),
		fmt.Sprintf("Expressions (%s)", strings.Join(exprs, ", ")),
		c.Table.String(),
	)
	return pr.String()
}

// Expressions implements the Expressioner interface.
func (c *CreateIndex) Expressions() []sql.Expression {
	return c.Exprs
}

// WithExpressions implements the Expressioner interface.
func (c *CreateIndex) WithExpressions(exprs ...sql.Expression) (sql.Node, error) {
	if len(exprs) != len(c.Exprs) {
		return nil, sql.ErrInvalidChildrenNumber.New(c, len(exprs), len(c.Exprs))
	}

	nc := *c
	nc.Exprs = exprs
	return &nc, nil
}

// WithChildren implements the Node interface.
func (c *CreateIndex) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(c, len(children), 1)
	}

	nc := *c
	nc.Table = children[0]
	return &nc, nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*CreateIndex) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}
