// Copyright 2022 Dolthub, Inc.
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

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
)

// Fetch represents the FETCH statement, which handles value acquisition from cursors.
type Fetch struct {
	Name     string
	InnerSet *Set
	ToSet    []sql.Expression
	Pref     *expression.ProcedureReference
	Sch      sql.Schema
}

var _ sql.Node = (*Fetch)(nil)
var _ sql.CollationCoercible = (*Fetch)(nil)
var _ expression.ProcedureReferencable = (*Fetch)(nil)

// NewFetch returns a new *Fetch node.
func NewFetch(name string, toSet []sql.Expression) *Fetch {
	return &Fetch{
		Name:  name,
		ToSet: toSet,
	}
}

// Resolved implements the interface sql.Node.
func (f *Fetch) Resolved() bool {
	for _, e := range f.ToSet {
		if !e.Resolved() {
			return false
		}
	}
	return true
}

// String implements the interface sql.Node.
func (f *Fetch) String() string {
	vars := make([]string, len(f.ToSet))
	for i, e := range f.ToSet {
		vars[i] = e.String()
	}
	return fmt.Sprintf("FETCH %s INTO %s", f.Name, strings.Join(vars, ", "))
}

// DebugString implements the interface sql.DebugStringer.
func (f *Fetch) DebugString() string {
	vars := make([]string, len(f.ToSet))
	for i, e := range f.ToSet {
		vars[i] = sql.DebugString(e)
	}
	return fmt.Sprintf("FETCH %s INTO %s", f.Name, strings.Join(vars, ", "))
}

// Schema implements the interface sql.Node.
func (f *Fetch) Schema() sql.Schema {
	return nil
}

func (f *Fetch) Expressions() []sql.Expression {
	return f.ToSet
}

func (f *Fetch) WithExpressions(exprs ...sql.Expression) (sql.Node, error) {
	if len(exprs) != len(f.ToSet) {
		return nil, sql.ErrInvalidExpressionNumber.New(len(exprs), len(f.ToSet))
	}
	ret := *f
	ret.ToSet = exprs
	return &ret, nil
}

// Children implements the interface sql.Node.
func (f *Fetch) Children() []sql.Node {
	return nil
}

func (f *Fetch) IsReadOnly() bool {
	return true
}

// WithChildren implements the interface sql.Node.
func (f *Fetch) WithChildren(children ...sql.Node) (sql.Node, error) {
	return f, nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*Fetch) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}

// WithParamReference implements the interface expression.ProcedureReferencable.
func (f *Fetch) WithParamReference(pRef *expression.ProcedureReference) sql.Node {
	nf := *f
	nf.Pref = pRef
	return &nf
}

// fetchIter is the sql.RowIter of *Fetch.
type fetchIter struct {
	*Fetch
	rowIter sql.RowIter
}

var _ sql.RowIter = (*fetchIter)(nil)

// Next implements the interface sql.RowIter.
func (f *fetchIter) Next(ctx *sql.Context) (sql.Row, error) {
	row, err := f.rowIter.Next(ctx)
	if err != nil {
		return nil, err
	}
	return row, nil
}

// Close implements the interface sql.RowIter.
func (f *fetchIter) Close(ctx *sql.Context) error {
	return f.rowIter.Close(ctx)
}
