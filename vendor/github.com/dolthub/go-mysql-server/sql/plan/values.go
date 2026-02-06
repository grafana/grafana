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
	"strings"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
)

// Values represents a set of tuples of expressions.
type Values struct {
	AliasName        string
	ColumnNames      map[string]string
	ExpressionTuples [][]sql.Expression
}

var _ sql.Node = (*Values)(nil)
var _ sql.CollationCoercible = (*Values)(nil)

// NewValues creates a Values node with the given tuples.
func NewValues(tuples [][]sql.Expression) *Values {
	return &Values{ExpressionTuples: tuples}
}

// NewValuesWithAlias creates a Values node with the given row and column aliases.
func NewValuesWithAlias(tableName string, columnNames map[string]string, tuples [][]sql.Expression) *Values {
	return &Values{ExpressionTuples: tuples, AliasName: tableName, ColumnNames: columnNames}
}

// Schema implements the Node interface.
func (p *Values) Schema() sql.Schema {
	if len(p.ExpressionTuples) == 0 {
		return nil
	}

	exprs := p.ExpressionTuples[0]
	s := make(sql.Schema, len(exprs))
	for i, e := range exprs {
		var name string
		if n, ok := e.(sql.Nameable); ok {
			name = n.Name()
		} else {
			name = e.String()
		}
		s[i] = &sql.Column{
			Name:     name,
			Type:     e.Type(),
			Nullable: e.IsNullable(),
		}
	}

	return s
}

// Children implements the Node interface.
func (p *Values) Children() []sql.Node {
	return nil
}

// Resolved implements the Resolvable interface.
func (p *Values) Resolved() bool {
	for _, et := range p.ExpressionTuples {
		if !expression.ExpressionsResolved(et...) {
			return false
		}
	}

	return true
}

func (p *Values) IsReadOnly() bool {
	return true
}

// RowIter implements the Node interface.
func (p *Values) RowIter(ctx *sql.Context, row sql.Row) (sql.RowIter, error) {
	rows := make([]sql.Row, len(p.ExpressionTuples))
	for i, et := range p.ExpressionTuples {
		vals := make([]interface{}, len(et))
		for j, e := range et {
			var err error
			vals[j], err = e.Eval(ctx, row)
			if err != nil {
				return nil, err
			}
		}

		rows[i] = sql.NewRow(vals...)
	}

	return sql.RowsToRowIter(rows...), nil
}

func (p *Values) String() string {
	var sb strings.Builder
	sb.WriteString("Values(")
	for i, tuple := range p.ExpressionTuples {
		if i > 0 {
			sb.WriteString(",\n")
		}
		for j, e := range tuple {
			if j > 0 {
				sb.WriteString(",")
			}
			sb.WriteString(e.String())
		}
	}

	sb.WriteString(")")
	return sb.String()
}

func (p *Values) DebugString() string {
	var sb strings.Builder
	sb.WriteString("Values(")
	for i, tuple := range p.ExpressionTuples {
		if i > 0 {
			sb.WriteString(",\n")
		}
		sb.WriteRune('[')
		for j, e := range tuple {
			if j > 0 {
				sb.WriteString(",")
			}
			sb.WriteString(sql.DebugString(e))
		}
		sb.WriteRune(']')
	}

	sb.WriteString(")")
	return sb.String()
}

// Expressions implements the Expressioner interface.
func (p *Values) Expressions() []sql.Expression {
	var exprs []sql.Expression
	for _, tuple := range p.ExpressionTuples {
		exprs = append(exprs, tuple...)
	}
	return exprs
}

// WithChildren implements the Node interface.
func (p *Values) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 0 {
		return nil, sql.ErrInvalidChildrenNumber.New(p, len(children), 0)
	}

	return p, nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*Values) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}

// WithExpressions implements the Expressioner interface.
func (p *Values) WithExpressions(exprs ...sql.Expression) (sql.Node, error) {
	var expected int
	for _, t := range p.ExpressionTuples {
		expected += len(t)
	}

	if len(exprs) != expected {
		return nil, sql.ErrInvalidChildrenNumber.New(p, len(exprs), expected)
	}

	var offset int
	var tuples = make([][]sql.Expression, len(p.ExpressionTuples))
	for i, t := range p.ExpressionTuples {
		for range t {
			tuples[i] = append(tuples[i], exprs[offset])
			offset++
		}
	}

	return NewValuesWithAlias(p.AliasName, p.ColumnNames, tuples), nil
}
