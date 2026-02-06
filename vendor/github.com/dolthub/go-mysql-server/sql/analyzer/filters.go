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
	"reflect"
	"strings"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/plan"
	"github.com/dolthub/go-mysql-server/sql/transform"
)

type filtersByTable map[string][]sql.Expression

func newFiltersByTable() filtersByTable {
	return make(filtersByTable)
}

func (f filtersByTable) merge(f2 filtersByTable) {
	for k, exprs := range f2 {
		f[k] = append(f[k], exprs...)
	}
}

func (f filtersByTable) size() int {
	return len(f)
}

// getFiltersByTable returns a map of table name to filter expressions on that table for the node provided. Any
// predicates that contain no table or more than one table are not included in the result.
func getFiltersByTable(n sql.Node) filtersByTable {
	filters := newFiltersByTable()
	transform.Inspect(n, func(node sql.Node) bool {
		switch node := node.(type) {
		case *plan.Filter:
			fs := exprToTableFilters(node.Expression)
			filters.merge(fs)
		}
		if o, ok := node.(sql.OpaqueNode); ok {
			return !o.Opaque()
		}
		return true
	})

	return filters
}

// exprToTableFilters returns a map of table name to filter expressions on that table for all parts of the expression
// given, split at AND. Any expressions that contain subquerys, or refer to more than one table, are not included in
// the result.
func exprToTableFilters(expr sql.Expression) filtersByTable {
	filters := newFiltersByTable()
	for _, expr := range expression.SplitConjunction(expr) {
		var seenTables = make(map[string]bool)
		var lastTable string
		hasSubquery := false
		sql.Inspect(expr, func(e sql.Expression) bool {
			f, ok := e.(*expression.GetField)
			if ok {
				if !seenTables[f.Table()] {
					seenTables[f.Table()] = true
					lastTable = f.Table()
				}
			} else if _, isSubquery := e.(*plan.Subquery); isSubquery {
				hasSubquery = true
				return false
			}

			return true
		})

		if len(seenTables) == 1 && !hasSubquery {
			filters[lastTable] = append(filters[lastTable], expr)
		}
	}

	return filters
}

type filterSet struct {
	filtersByTable      filtersByTable
	tableAliases        TableAliases
	filterPredicates    []sql.Expression
	handledFilters      []sql.Expression
	handledIndexFilters []string
}

// newFilterSet returns a new filter set that will track available filters with the filters and aliases given. Aliases
// are necessary to normalize expressions from indexes when in the presence of aliases.
func newFilterSet(filter sql.Expression, filtersByTable filtersByTable, tableAliases TableAliases) *filterSet {
	return &filterSet{
		filterPredicates: expression.SplitConjunction(filter),
		filtersByTable:   filtersByTable,
		tableAliases:     tableAliases,
	}
}

// availableFiltersForTable returns the filters that are still available for the table given (not previously marked
// handled)
func (fs *filterSet) availableFiltersForTable(ctx *sql.Context, table string) []sql.Expression {
	filters, ok := fs.filtersByTable[strings.ToLower(table)]
	if !ok {
		return nil
	}
	return fs.subtractUsedIndexes(ctx, subtractExprSet(filters, fs.handledFilters))
}

// unhandledPredicates returns the filters that are still available (not previously marked handled)
func (fs *filterSet) unhandledPredicates(ctx *sql.Context) []sql.Expression {
	var available []sql.Expression
	for _, e := range fs.filterPredicates {
		available = append(available, fs.subtractUsedIndexes(ctx, subtractExprSet([]sql.Expression{e}, fs.handledFilters))...)
	}
	return available
}

// handledCount returns the number of filter expressions that have been marked as handled
func (fs *filterSet) handledCount() int {
	return len(fs.handledIndexFilters) + len(fs.handledFilters)
}

// markFilterUsed marks the filter given as handled, so it will no longer be returned by availableFiltersForTable
func (fs *filterSet) markFiltersHandled(exprs ...sql.Expression) {
	fs.handledFilters = append(fs.handledFilters, exprs...)
}

// markIndexesHandled marks the indexes given as handled, so expressions on them will no longer be returned by
// availableFiltersForTable
// TODO: this is currently unused because we can't safely remove indexed predicates from the filter in all cases
func (fs *filterSet) markIndexesHandled(indexes []sql.Index) {
	for _, index := range indexes {
		fs.handledIndexFilters = append(fs.handledIndexFilters, index.Expressions()...)
	}
}

// subtractExprSet returns all expressions in the first parameter that aren't present in the second.
func subtractExprSet(all, toSubtract []sql.Expression) []sql.Expression {
	var remainder []sql.Expression

	for _, e := range all {
		var found bool
		for _, s := range toSubtract {
			if reflect.DeepEqual(e, s) {
				found = true
				break
			}
		}

		if !found {
			remainder = append(remainder, e)
		}
	}

	return remainder
}

// subtractUsedIndexes returns the filter expressions given with used indexes subtracted off.
func (fs *filterSet) subtractUsedIndexes(ctx *sql.Context, all []sql.Expression) []sql.Expression {
	var remainder []sql.Expression

	// Careful: index expressions are always normalized (contain actual table names), whereas filter expressions can
	// contain aliases for both expressions and table names. We want to normalize all expressions for comparison, but
	// return the original expressions.
	normalized := normalizeExpressions(fs.tableAliases, all...)

	for i, e := range normalized {
		var found bool

		cmpStr := e.String()
		comparable, ok := e.(expression.Comparer)
		if ok {
			left, right := comparable.Left(), comparable.Right()
			if _, ok := left.(*expression.GetField); ok {
				cmpStr = left.String()
			} else {
				cmpStr = right.String()
			}
		}

		for _, s := range fs.handledIndexFilters {
			if cmpStr == s {
				found = true
				break
			}
		}

		if !found {
			remainder = append(remainder, all[i])
		}
	}

	return remainder
}
