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
	"github.com/dolthub/go-mysql-server/sql/types"
)

// AliasReference is a named reference to an aliased expression.
type AliasReference struct {
	name string
}

// NewAliasReference creates a new AliasReference from the specified alias name.
func NewAliasReference(name string) *AliasReference {
	return &AliasReference{name}
}

func (a AliasReference) Name() string {
	return a.name
}

func (a AliasReference) Table() string {
	return ""
}

func (a AliasReference) String() string {
	return fmt.Sprintf("(alias reference)%s", a.name)
}

func (a AliasReference) Resolved() bool {
	return false
}

func (a AliasReference) IsNullable() bool {
	return true
}

func (a AliasReference) Children() []sql.Expression {
	return []sql.Expression{}
}

func (a AliasReference) Type() sql.Type {
	return types.Null
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (AliasReference) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}

func (a AliasReference) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	return nil, fmt.Errorf("tried to call eval on an unresolved AliasReference")
}

func (a AliasReference) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 0 {
		return nil, sql.ErrInvalidChildrenNumber.New(a, len(children), 0)
	}
	return NewAliasReference(a.name), nil
}

var _ sql.Expression = (*AliasReference)(nil)
var _ sql.CollationCoercible = (*AliasReference)(nil)

// Alias is a node that gives a name to an expression.
type Alias struct {
	UnaryExpression
	name           string
	unreferencable bool
	id             sql.ColumnId
}

var _ sql.Expression = (*Alias)(nil)
var _ sql.IdExpression = (*Alias)(nil)
var _ sql.CollationCoercible = (*Alias)(nil)

// NewAlias returns a new Alias node.
func NewAlias(name string, expr sql.Expression) *Alias {
	return &Alias{UnaryExpression{expr}, name, false, 0}
}

// AsUnreferencable marks the alias outside of scope referencing
func (e *Alias) AsUnreferencable() *Alias {
	ret := *e
	ret.unreferencable = true
	return &ret
}

func (e *Alias) Unreferencable() bool {
	return e.unreferencable
}

func (e *Alias) WithId(id sql.ColumnId) sql.IdExpression {
	ret := *e
	ret.id = id
	return &ret
}

func (e *Alias) Id() sql.ColumnId {
	return e.id
}

// Type returns the type of the expression.
func (e *Alias) Type() sql.Type {
	return e.Child.Type()
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (e *Alias) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.GetCoercibility(ctx, e.Child)
}

// Eval implements the Expression interface.
func (e *Alias) Eval(ctx *sql.Context, row sql.Row) (interface{}, error) {
	return e.Child.Eval(ctx, row)
}

// Describe implements the sql.Describable interface
func (e *Alias) Describe(options sql.DescribeOptions) string {
	if options.Debug {
		if e.unreferencable {
			return fmt.Sprintf("%s->%s", sql.Describe(e.Child, options), e.name)
		} else {
			return fmt.Sprintf("%s->%s:%d", sql.Describe(e.Child, options), e.name, e.id)
		}
	}
	return fmt.Sprintf("%s as %s", sql.Describe(e.Child, options), e.name)
}

func (e *Alias) String() string {
	return e.Describe(sql.DescribeOptions{
		Debug: false,
	})
}

func (e *Alias) DebugString() string {
	return e.Describe(sql.DescribeOptions{
		Debug: true,
	})
}

// WithChildren implements the Expression interface.
func (e *Alias) WithChildren(children ...sql.Expression) (sql.Expression, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(e, len(children), 1)
	}
	return NewAlias(e.name, children[0]), nil
}

// Name implements the Nameable interface.
func (e *Alias) Name() string { return e.name }
