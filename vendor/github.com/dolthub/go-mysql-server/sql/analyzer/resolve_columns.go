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

package analyzer

import (
	"fmt"
	"strings"

	"gopkg.in/src-d/go-errors.v1"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/plan"
	"github.com/dolthub/go-mysql-server/sql/transform"
)

type tableCol struct {
	table string
	col   string
}

func newTableCol(table, col string) tableCol {
	return tableCol{
		table: strings.ToLower(table),
		col:   strings.ToLower(col),
	}
}

var _ sql.Tableable = tableCol{}
var _ sql.Nameable = tableCol{}

func (tc tableCol) Table() string {
	return tc.table
}

func (tc tableCol) Name() string {
	return tc.col
}

func (tc tableCol) String() string {
	if tc.table != "" {
		return fmt.Sprintf("%s.%s", tc.table, tc.col)
	} else {
		return tc.col
	}
}

type indexedCol struct {
	*sql.Column
	index int
}

// column is the common interface that groups UnresolvedColumn and deferredColumn.
type column interface {
	sql.Nameable
	sql.Tableable
	sql.Expression
}

var errGlobalVariablesNotSupported = errors.NewKind("can't resolve global variable, %s was requested")

// indexColumns returns a map of column identifiers to their index in the node's schema. Columns from outer scopes are
// included as well, with lower indexes (prepended to node schema) but lower precedence (overwritten by inner nodes in
// map)
func indexColumns(_ *sql.Context, _ *Analyzer, n sql.Node, scope *plan.Scope) (map[tableCol]indexedCol, error) {
	var columns = make(map[tableCol]indexedCol)
	var idx int

	indexColumn := func(col *sql.Column) {
		columns[tableCol{
			table: strings.ToLower(col.Source),
			col:   strings.ToLower(col.Name),
		}] = indexedCol{col, idx}
		idx++
	}

	indexSchema := func(n sql.Schema) {
		for _, col := range n {
			indexColumn(col)
		}
	}

	var indexColumnExpr func(e sql.Expression)
	indexColumnExpr = func(e sql.Expression) {
		switch e := e.(type) {
		case *expression.Alias:
			// Aliases get indexed twice with the same index number: once with the aliased name and once with the
			// underlying name
			indexColumn(transform.ExpressionToColumn(e, plan.AliasSubqueryString(e)))
			idx--
			indexColumnExpr(e.Child)
		default:
			indexColumn(transform.ExpressionToColumn(e, plan.AliasSubqueryString(e)))
		}
	}

	indexChildNode := func(n sql.Node) {
		switch n := n.(type) {
		case sql.Projector:
			for _, e := range n.ProjectedExprs() {
				indexColumnExpr(e)
			}
		case *plan.Values:
			// values nodes don't have a schema to index like other nodes that provide columns
		default:
			indexSchema(n.Schema())
		}
	}

	if scope.OuterRelUnresolved() {
		// the columns in this relation will be mis-indexed, skip
		// until outer rel is resolved
		return nil, nil
	}

	// Index the columns in the outer scope, outer to inner. This means inner scope columns will overwrite the outer
	// ones of the same name. This matches the MySQL scope precedence rules.
	indexSchema(scope.Schema())

	// For the innermost scope (the node being evaluated), look at the schemas of the children instead of this node
	// itself. Skip this for DDL nodes that handle indexing separately.
	shouldIndexChildNode := true
	switch n.(type) {
	case *plan.AddColumn, *plan.ModifyColumn:
		shouldIndexChildNode = false
	case *plan.RecursiveCte, *plan.SetOp:
		shouldIndexChildNode = false
	}

	if shouldIndexChildNode {
		for _, child := range n.Children() {
			indexChildNode(child)
		}
	}

	// For certain DDL nodes, we have to do more work
	indexSchemaForDefaults := func(column *sql.Column, order *sql.ColumnOrder, sch sql.Schema) {
		tblSch := make(sql.Schema, len(sch))
		copy(tblSch, sch)
		if order == nil {
			tblSch = append(tblSch, column)
		} else if order.First {
			tblSch = append(sql.Schema{column}, tblSch...)
		} else { // must be After
			index := 1
			afterColumn := strings.ToLower(order.AfterColumn)
			for _, col := range tblSch {
				if strings.ToLower(col.Name) == afterColumn {
					break
				}
				index++
			}
			if index <= len(tblSch) {
				tblSch = append(tblSch, nil)
				copy(tblSch[index+1:], tblSch[index:])
				tblSch[index] = column
			}
		}
		for _, col := range tblSch {
			columns[tableCol{
				table: "",
				col:   strings.ToLower(col.Name),
			}] = indexedCol{col, idx}
			columns[tableCol{
				table: strings.ToLower(col.Source),
				col:   strings.ToLower(col.Name),
			}] = indexedCol{col, idx}
			idx++
		}
	}

	switch node := n.(type) {
	case *plan.CreateTable: // For this node in particular, the columns will only come into existence after the analyzer step, so we forge them here.
		for _, col := range node.PkSchema().Schema {
			columns[tableCol{
				table: "",
				col:   strings.ToLower(col.Name),
			}] = indexedCol{col, idx}
			columns[tableCol{
				table: strings.ToLower(col.Source),
				col:   strings.ToLower(col.Name),
			}] = indexedCol{col, idx}
			idx++
		}
	case *plan.AddColumn: // Add/Modify need to have the full column set in order to resolve a default expression.
		tbl := node.Table
		indexSchemaForDefaults(node.Column(), node.Order(), tbl.Schema())
	case *plan.ModifyColumn:
		tbl := node.Table
		indexSchemaForDefaults(node.NewColumn(), node.Order(), tbl.Schema())
	case *plan.RecursiveCte, *plan.SetOp:
		// opaque nodes have derived schemas
		// TODO also subquery aliases?
		indexChildNode(node.(sql.BinaryNode).Left())
	case *plan.InsertInto:
		// should index columns in InsertInto.Source
		aliasedTables := make(map[sql.Node]bool)
		transform.Inspect(node.Source, func(n sql.Node) bool {
			// need to reset idx for each table found, as this function assumes only 1 table
			if tblAlias, ok := n.(*plan.TableAlias); ok && tblAlias.Resolved() {
				idx = 0
				indexSchema(tblAlias.Schema())
				aliasedTables[tblAlias.Child] = true
			}
			return true
		})
		transform.Inspect(node.Source, func(n sql.Node) bool {
			if resTbl, ok := n.(*plan.ResolvedTable); ok && !aliasedTables[resTbl] {
				indexSchema(resTbl.Schema())
			}
			return true
		})
		transform.Inspect(node.Source, func(n sql.Node) bool {
			if resTbl, ok := n.(*plan.SubqueryAlias); ok && resTbl.Resolved() && !aliasedTables[resTbl] {
				idx = 0
				indexSchema(resTbl.Schema())
			}
			return true
		})
	}

	return columns, nil
}
