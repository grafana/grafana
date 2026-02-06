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

	"gopkg.in/src-d/go-errors.v1"

	"github.com/dolthub/go-mysql-server/sql"
)

// UnresolvedColumn is an expression of a column that is not yet resolved.
// This is a placeholder node, so its methods Type, IsNullable and Eval are not
// supposed to be called.
type UnresolvedColumn struct {
	name  string
	table string
}

var _ sql.Expression = (*UnresolvedColumn)(nil)
var _ sql.Expression2 = (*UnresolvedColumn)(nil)
var _ sql.CollationCoercible = (*UnresolvedColumn)(nil)

// NewUnresolvedColumn creates a new UnresolvedColumn expression.
func NewUnresolvedColumn(name string) *UnresolvedColumn {
	return &UnresolvedColumn{name: name}
}

// NewUnresolvedQualifiedColumn creates a new UnresolvedColumn expression
// with a table qualifier.
func NewUnresolvedQualifiedColumn(table, name string) *UnresolvedColumn {
	return &UnresolvedColumn{name: name, table: table}
}

// Children implements the Expression interface.
func (*UnresolvedColumn) Children() []sql.Expression {
	return nil
}

// Resolved implements the Expression interface.
func (*UnresolvedColumn) Resolved() bool {
	return false
}

// IsNullable implements the Expression interface.
func (*UnresolvedColumn) IsNullable() bool {
	panic("unresolved column is a placeholder node, but IsNullable was called")
}

// Type implements the Expression interface.
func (*UnresolvedColumn) Type() sql.Type {
	panic("unresolved column is a placeholder node, but Type was called")
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*UnresolvedColumn) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}

func (uc *UnresolvedColumn) Eval2(ctx *sql.Context, row sql.Row2) (sql.Value, error) {
	panic("unresolved column is a placeholder node, but Eval2 was called")
}

func (uc *UnresolvedColumn) Type2() sql.Type2 {
	panic("unresolved column is a placeholder node, but Type2 was called")
}

// Name implements the Nameable interface.
func (uc *UnresolvedColumn) Name() string { return uc.name }

// Table returns the table name.
func (uc *UnresolvedColumn) Table() string { return uc.table }

func (uc *UnresolvedColumn) String() string {
	if uc.table == "" {
		return uc.name
	}
	return fmt.Sprintf("%s.%s", uc.table, uc.name)
}

// Eval implements the Expression interface.
func (*UnresolvedColumn) Eval(ctx *sql.Context, r sql.Row) (interface{}, error) {
	panic("unresolved column is a placeholder node, but Eval was called")
}

// WithChildren implements the Expression interface.
func (uc *UnresolvedColumn) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 0 {
		return nil, sql.ErrInvalidChildrenNumber.New(uc, len(children), 0)
	}
	return uc, nil
}

// ErrUnresolvedTableFunction is thrown when a table function cannot be resolved
var ErrUnresolvedTableFunction = errors.NewKind("unresolved table function")

var _ sql.TableFunction = (*UnresolvedTableFunction)(nil)

// UnresolvedTableFunction represents a table function that is not yet resolved.
// This is a placeholder node, so methods such as Schema, RowIter, etc, are not
// intended to be used.
type UnresolvedTableFunction struct {
	database  sql.Database
	name      string
	Alias     string
	Arguments []sql.Expression
}

var _ sql.Node = (*UnresolvedTableFunction)(nil)
var _ sql.CollationCoercible = (*UnresolvedTableFunction)(nil)
var _ sql.RenameableNode = (*UnresolvedTableFunction)(nil)

// NewUnresolvedTableFunction creates a new UnresolvedTableFunction node for a sql plan.
func NewUnresolvedTableFunction(name string, arguments []sql.Expression) *UnresolvedTableFunction {
	return &UnresolvedTableFunction{
		name:      name,
		Arguments: arguments,
	}
}

func (utf *UnresolvedTableFunction) WithName(s string) sql.Node {
	ret := *utf
	ret.name = s
	return &ret
}

// NewInstance implements the TableFunction interface
func (utf *UnresolvedTableFunction) NewInstance(_ *sql.Context, _ sql.Database, _ []sql.Expression) (sql.Node, error) {
	return nil, ErrUnresolvedTableFunction.New()
}

// Database implements the Databaser interface
func (utf *UnresolvedTableFunction) Database() sql.Database {
	return utf.database
}

// WithDatabase implements the Databaser interface
func (utf *UnresolvedTableFunction) WithDatabase(database sql.Database) (sql.Node, error) {
	utf.database = database
	return utf, nil
}

// Name implements the TableFunction interface
func (utf *UnresolvedTableFunction) Name() string {
	return utf.name
}

// Expressions implements the Expressioner interface
func (utf *UnresolvedTableFunction) Expressions() []sql.Expression {
	return utf.Arguments
}

func (utf *UnresolvedTableFunction) IsReadOnly() bool {
	return true
}

// WithExpressions implements the Expressioner interface
func (utf *UnresolvedTableFunction) WithExpressions(expression ...sql.Expression) (sql.Node, error) {
	if len(expression) != len(utf.Expressions()) {
		return nil, sql.ErrInvalidExpressionNumber.New(utf, len(expression), len(utf.Expressions()))
	}

	nutf := *utf
	nutf.Arguments = make([]sql.Expression, len(expression))
	for i, _ := range expression {
		nutf.Arguments[i] = expression[i]
	}

	return &nutf, nil
}

// Schema implements the Node interface
func (utf *UnresolvedTableFunction) Schema() sql.Schema {
	return nil
}

// Children implements the Node interface
func (utf *UnresolvedTableFunction) Children() []sql.Node {
	return nil
}

// RowIter implements the Node interface
func (utf *UnresolvedTableFunction) RowIter(ctx *sql.Context, row sql.Row) (sql.RowIter, error) {
	return nil, ErrUnresolvedTableFunction.New()
}

// WithChildren implements the Node interface
func (utf *UnresolvedTableFunction) WithChildren(node ...sql.Node) (sql.Node, error) {
	panic("no expected children for unresolved table function")
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (UnresolvedTableFunction) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}

// Resolved implements the Resolvable interface
func (utf *UnresolvedTableFunction) Resolved() bool {
	return false
}

// String implements the Stringer interface
func (utf *UnresolvedTableFunction) String() string {
	var exprs = make([]string, len(utf.Arguments))
	for i, e := range utf.Arguments {
		exprs[i] = e.String()
	}

	return fmt.Sprintf("%s(%s)", utf.name, strings.Join(exprs, ", "))
}

var _ sql.Expression = (*UnresolvedFunction)(nil)
var _ sql.CollationCoercible = (*UnresolvedFunction)(nil)

// UnresolvedFunction represents a function that is not yet resolved.
// This is a placeholder node, so its methods Type, IsNullable and Eval are not
// supposed to be called.
type UnresolvedFunction struct {
	Window      *sql.WindowDefinition
	name        string
	Arguments   []sql.Expression
	IsAggregate bool
}

// NewUnresolvedFunction creates a new UnresolvedFunction expression.
func NewUnresolvedFunction(
	name string,
	agg bool,
	window *sql.WindowDefinition,
	arguments ...sql.Expression,
) *UnresolvedFunction {
	return &UnresolvedFunction{
		name:        name,
		IsAggregate: agg,
		Window:      window,
		Arguments:   arguments,
	}
}

// Children implements the Expression interface.
func (uf *UnresolvedFunction) Children() []sql.Expression {
	return append(uf.Arguments, uf.Window.ToExpressions()...)
}

// WithWindow implements the Expression interface.
func (uf *UnresolvedFunction) WithWindow(def *sql.WindowDefinition) *UnresolvedFunction {
	nf := *uf
	nf.Window = def
	return &nf
}

// Resolved implements the Expression interface.
func (*UnresolvedFunction) Resolved() bool {
	return false
}

// IsNullable implements the Expression interface.
func (*UnresolvedFunction) IsNullable() bool {
	panic("unresolved function is a placeholder node, but IsNullable was called")
}

// Type implements the Expression interface.
func (*UnresolvedFunction) Type() sql.Type {
	panic("unresolved function is a placeholder node, but Type was called")
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*UnresolvedFunction) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}

// Name implements the Nameable interface.
func (uf *UnresolvedFunction) Name() string { return uf.name }

func (uf *UnresolvedFunction) String() string {
	var exprs = make([]string, len(uf.Arguments))
	for i, e := range uf.Arguments {
		exprs[i] = e.String()
	}

	over := ""
	if uf.Window != nil {
		over = fmt.Sprintf(" %s", uf.Window)
	}

	return fmt.Sprintf("%s(%s)%s", uf.name, strings.Join(exprs, ", "), over)
}

func (uf *UnresolvedFunction) DebugString() string {
	var exprs = make([]string, len(uf.Arguments))
	for i, e := range uf.Arguments {
		exprs[i] = sql.DebugString(e)
	}

	over := ""
	if uf.Window != nil {
		over = fmt.Sprintf(" %s", sql.DebugString(uf.Window))
	}

	return fmt.Sprintf("(unresolved)%s(%s)%s", uf.name, strings.Join(exprs, ", "), over)
}

// Eval implements the Expression interface.
func (*UnresolvedFunction) Eval(ctx *sql.Context, r sql.Row) (interface{}, error) {
	panic("unresolved function is a placeholder node, but Eval was called")
}

// WithChildren implements the Expression interface.
func (uf *UnresolvedFunction) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != len(uf.Arguments)+len(uf.Window.ToExpressions()) {
		return nil, sql.ErrInvalidChildrenNumber.New(uf, len(children), len(uf.Arguments)+len(uf.Window.ToExpressions()))
	}

	window, err := uf.Window.FromExpressions(children[len(uf.Arguments):])
	if err != nil {
		return nil, err
	}

	return NewUnresolvedFunction(uf.name, uf.IsAggregate, window, children[:len(uf.Arguments)]...), nil
}
