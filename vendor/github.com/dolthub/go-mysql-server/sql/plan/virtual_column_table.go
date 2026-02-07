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
	"strings"

	"github.com/dolthub/go-mysql-server/sql"
)

// VirtualColumnTable is a sql.TableNode that combines a ResolvedTable with a Project, the latter of which is used
// to add the values of virtual columns to the table.
type VirtualColumnTable struct {
	sql.Table
	Projections []sql.Expression
}

var _ sql.TableWrapper = (*VirtualColumnTable)(nil)
var _ sql.MutableTableWrapper = (*VirtualColumnTable)(nil)
var _ sql.IndexedTable = (*VirtualColumnTable)(nil)

func (v *VirtualColumnTable) Underlying() sql.Table {
	return v.Table
}

func (v VirtualColumnTable) WithUnderlying(table sql.Table) sql.Table {
	v.Table = table
	return &v
}

// NewVirtualColumnTable creates a new VirtualColumnTable.
func NewVirtualColumnTable(table sql.Table, projections []sql.Expression) *VirtualColumnTable {
	return &VirtualColumnTable{
		Table:       table,
		Projections: projections,
	}
}

func (v *VirtualColumnTable) LookupPartitions(context *sql.Context, lookup sql.IndexLookup) (sql.PartitionIter, error) {
	// this will panic if we fail to correctly unwrap the underlying table during analysis to determine if it supports
	// index lookups
	return v.Table.(sql.IndexedTable).LookupPartitions(context, lookup)
}

func (v *VirtualColumnTable) String() string {
	pr := sql.NewTreePrinter()
	_ = pr.WriteNode("VirtualColumnTable")
	children := make([]string, 2)
	children[0] = fmt.Sprintf("name: %s", v.Name())
	exprs := make([]string, len(v.Projections))
	for i, expr := range v.Projections {
		exprs[i] = expr.String()
	}
	children[1] = fmt.Sprintf("columns: [%s]", strings.Join(exprs, ", "))
	_ = pr.WriteChildren(children...)

	return pr.String()
}

func (v *VirtualColumnTable) DebugString() string {
	pr := sql.NewTreePrinter()
	_ = pr.WriteNode("VirtualColumnTable")
	children := make([]string, 3)
	children[0] = fmt.Sprintf("name: %s", v.Name())
	exprs := make([]string, len(v.Projections))
	for i, expr := range v.Projections {
		exprs[i] = sql.DebugString(expr)
	}

	children[1] = fmt.Sprintf("columns: [%s]", strings.Join(exprs, ", "))
	children[2] = TableDebugString(v.Table)
	_ = pr.WriteChildren(children...)

	return pr.String()
}

// FindVirtualColumnTable returns the plan.VirtualTableColumn being wrapped by the given table, if any.
func FindVirtualColumnTable(table sql.Table) (*VirtualColumnTable, bool) {
	if vct, ok := table.(*VirtualColumnTable); ok {
		return vct, true
	}
	if tw, ok := table.(sql.TableWrapper); ok {
		return FindVirtualColumnTable(tw.Underlying())
	}
	return nil, false
}
