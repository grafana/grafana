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
	"strings"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/plan"
	"github.com/dolthub/go-mysql-server/sql/transform"
)

// Returns the underlying table name, unaliased, for the node given
func getTableName(node sql.Node) string {
	var tableName string
	transform.Inspect(node, func(node sql.Node) bool {
		switch node := node.(type) {
		case *plan.ResolvedTable:
			tableName = node.Name()
			return false
		case *plan.UnresolvedTable:
			tableName = node.Name()
			return false
		case *plan.IndexedTableAccess:
			tableName = node.Name()
			return false
		}
		return true
	})

	return tableName
}

// Finds first table node that is a descendant of the node given
func getTable(node sql.Node) sql.Table {
	var table sql.Table
	transform.Inspect(node, func(n sql.Node) bool {
		// Inspect is called on all children of a node even if an earlier child's call returns false.
		// We only want the first TableNode match.
		if table != nil {
			return false
		}
		switch nn := n.(type) {
		case sql.TableNode:
			// TODO: unwinding a table wrapper here causes infinite analyzer recursion
			table = nn.UnderlyingTable()
			return false
		case *plan.IndexedTableAccess:
			table = nn.TableNode.UnderlyingTable()
			return false
		default:
			return true
		}
	})
	return table
}

// Finds first ResolvedTable node that is a descendant of the node given
// This function will not look inside SubqueryAliases
func getResolvedTable(node sql.Node) *plan.ResolvedTable {
	var table *plan.ResolvedTable
	transform.Inspect(node, func(n sql.Node) bool {
		// Inspect is called on all children of a node even if an earlier child's call returns false.
		// We only want the first TableNode match.
		if table != nil {
			return false
		}
		switch nn := n.(type) {
		case *plan.SubqueryAlias:
			// We should not be matching with ResolvedTables inside SubqueryAliases
			return false
		case *plan.ResolvedTable:
			if !plan.IsDualTable(nn) {
				table = nn
				return false
			}
		case *plan.IndexedTableAccess:
			if rt, ok := nn.TableNode.(*plan.ResolvedTable); ok {
				table = rt
				return false
			}
		}
		return true
	})
	return table
}

// getTablesByName takes a node and returns all found resolved tables in a map.
// This function will not look inside sql.OpaqueNodes (like plan.SubqueryAlias).
func getTablesByName(node sql.Node) map[string]*plan.ResolvedTable {
	ret := make(map[string]*plan.ResolvedTable)
	// TODO: We should change transform.Inspect to not walk the children of sql.OpaqueNodes (like transform.Node)
	//  and add a transform.InspectWithOpaque that does.
	//  Using transform.Node here achieves the same result without a large refactor.
	transform.Node(node, func(node sql.Node) (sql.Node, transform.TreeIdentity, error) {
		switch n := node.(type) {
		case *plan.ResolvedTable:
			ret[strings.ToLower(n.Table.Name())] = n
		case *plan.IndexedTableAccess:
			rt, ok := n.TableNode.(*plan.ResolvedTable)
			if ok {
				ret[strings.ToLower(rt.Name())] = rt
			}
		case *plan.TableAlias:
			rt := getResolvedTable(n)
			if rt != nil {
				ret[n.Name()] = rt
			}
		}
		return nil, transform.SameTree, nil
	})
	return ret
}
