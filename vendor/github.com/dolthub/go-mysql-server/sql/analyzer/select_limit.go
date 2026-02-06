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

package analyzer

import (
	"fmt"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/plan"
	"github.com/dolthub/go-mysql-server/sql/transform"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// applyDefaultSelectLimit wraps the root node in a Limit clause
// if 1) `sql_select_limit` is non-default and 2) there is no
// user-provided Limit already applied to the root node.
func applyDefaultSelectLimit(
	ctx *sql.Context,
	a *Analyzer,
	n sql.Node,
	scope *plan.Scope,
	_ RuleSelector,
	_ *sql.QueryFlags,
) (sql.Node, transform.TreeIdentity, error) {
	if !scope.IsEmpty() || scope.RecursionDepth() > 0 {
		return n, transform.SameTree, nil
	}
	ok, val := sql.HasDefaultValue(ctx, ctx.Session, "sql_select_limit")
	if ok {
		// we only apply limit if the default has been modified
		return n, transform.SameTree, nil
	}
	limit := expression.NewLiteral(mustCastNumToInt64(val), types.Int64)
	ret, same := applyLimit(n, limit)
	return ret, same, nil
}

func applyLimit(n sql.Node, limit sql.Expression) (sql.Node, transform.TreeIdentity) {
	var child sql.Node
	switch n := n.(type) {
	case *plan.Limit:
		return n, transform.SameTree
	case *plan.SetOp:
		if n.Limit != nil {
			return n, transform.SameTree
		}
		return n.WithLimit(limit), transform.NewTree
	case *plan.With:
		child = n.Child
	case *plan.Describe:
		child = n.Child
	case *plan.Sort, *plan.GroupBy, *plan.Project, *plan.SubqueryAlias,
		*plan.Window:
		ret := plan.NewLimit(limit, n)
		return ret, transform.NewTree
	default:
		return n, transform.SameTree
	}
	c, same := applyLimit(child, limit)
	if !same {
		ret, _ := n.WithChildren(c)
		return ret, transform.NewTree
	}
	return n, transform.SameTree
}

func mustCastNumToInt64(x interface{}) int64 {
	switch v := x.(type) {
	case int8:
		return int64(v)
	case int16:
		return int64(v)
	case int32:
		return int64(v)
	case uint8:
		return int64(v)
	case uint16:
		return int64(v)
	case uint32:
		return int64(v)
	case int64:
		return int64(v)
	case uint64:
		i64 := int64(v)
		if v == uint64(i64) {
			return i64
		}
	}

	panic(fmt.Sprintf("failed to convert to int64: %v", x))
}
