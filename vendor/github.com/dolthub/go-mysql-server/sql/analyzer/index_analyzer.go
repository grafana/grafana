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
	"sort"
	"strings"

	"github.com/dolthub/go-mysql-server/sql/transform"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/plan"
)

type indexAnalyzer struct {
	// TODO: these need to be qualified by database name as well to be valid. Otherwise we can't distinguish between two
	//  tables with the same name in different databases. But right now table nodes aren't qualified by their resolved
	//  database in the plan, so we can't do this.
	indexesByTable map[string][]sql.Index
	indexRegistry  *sql.IndexRegistry
	registryIdxes  []sql.Index
}

// newIndexAnalyzerForNode returns an analyzer for indexes available in the node given, keyed by the table name. These
// might come from either the tables themselves natively, or else from an index driver that has indexes for the tables
// included in the nodes. Indexes are keyed by the aliased name of the table, if applicable. These names must be
// unaliased when matching against the names of tables in index definitions.
func newIndexAnalyzerForNode(ctx *sql.Context, n sql.Node) (*indexAnalyzer, error) {
	var analysisErr error
	indexes := make(map[string][]sql.Index)

	var indexesForTable = func(name string, table sql.Table) error {
		name = strings.ToLower(name)
		it, ok := table.(sql.IndexAddressableTable)

		if !ok {
			return nil
		}

		idxes, err := it.GetIndexes(ctx)
		if err != nil {
			return err
		}

		indexes[name] = append(indexes[name], idxes...)
		return nil
	}

	// Find all of the native indexed tables in the node (those that don't require a driver)
	if n != nil {
		transform.Inspect(n, func(n sql.Node) bool {
			switch n := n.(type) {
			// Because we previously pushed filters as close to their relevant tables as possible, we know that there
			// cannot be another Filter between our node and any tables with relevant indexes.
			case *plan.Filter:
				return false
			case *plan.TableAlias:
				rt, ok := n.Child.(sql.TableNode)
				if !ok {
					return false
				}

				err := indexesForTable(n.Name(), rt.UnderlyingTable())
				if err != nil {
					analysisErr = err
					return false
				}

				return false
			case *plan.ResolvedTable:
				err := indexesForTable(n.Name(), n.UnderlyingTable())
				if err != nil {
					analysisErr = err
					return false
				}
			case *plan.IndexedTableAccess:
				err := indexesForTable(n.Name(), n.TableNode.UnderlyingTable())
				if err != nil {
					analysisErr = err
					return false
				}
			}
			return true
		})
	}

	if analysisErr != nil {
		return nil, analysisErr
	}

	var idxRegistry *sql.IndexRegistry
	if ctx.GetIndexRegistry().HasIndexes() {
		idxRegistry = ctx.GetIndexRegistry()
	}

	return &indexAnalyzer{
		indexesByTable: indexes,
		indexRegistry:  idxRegistry,
	}, nil
}

// IndexesByTable returns all indexes on the table named. The table must be present in the node used to create the
// analyzer.
func (r *indexAnalyzer) IndexesByTable(ctx *sql.Context, db, table string) []sql.Index {
	indexes := r.indexesByTable[strings.ToLower(table)]

	if r.indexRegistry != nil {
		idxes := r.indexRegistry.IndexesByTable(db, table)
		for _, idx := range idxes {
			indexes = append(indexes, idx)
		}
	}

	return indexes
}

// MatchingIndex returns the index that best fits the given expressions. See MatchingIndexes for the rules regarding
// which index is considered the best.
func (r *indexAnalyzer) MatchingIndex(ctx *sql.Context, table, db string, exprs ...sql.Expression) sql.Index {
	indexes := r.MatchingIndexes(ctx, table, db, exprs...)
	if len(indexes) > 0 {
		return indexes[0]
	}
	return nil
}

// MatchingIndexes returns a list of all matching indexes for the given expressions. The returned order of the indexes
// are deterministic and follow the given rules, from the highest priority in descending order:
//
//  1. Expressions exactly match the index
//  2. Expressions match as much of the index prefix as possible
//  3. Primary Key index ordered before secondary indexes
//     TODO: for rule 3, we want to prioritize "covering" indexes over non-covering indexes, but sql.Index doesn't
//     provide the necessary information to evaluate this condition. Primary Key status approximates it.
//  4. Largest index by expression count
//  5. Index ID in ascending order
//
// It is worth noting that all returned indexes will have at least the first index expression satisfied (creating a
// partial index), as otherwise the index would be no better than a table scan (for which integrators may have
// optimizations).
func (r *indexAnalyzer) MatchingIndexes(ctx *sql.Context, table, db string, exprs ...sql.Expression) []sql.Index {
	// As multiple expressions may be the same, we filter out duplicates
	distinctExprs := make(map[string]struct{})
	var exprStrs []string
	for _, e := range exprs {
		es := strings.ToLower(e.String())
		if _, ok := distinctExprs[es]; !ok {
			distinctExprs[es] = struct{}{}
			exprStrs = append(exprStrs, es)
		}
	}

	type idxWithLen struct {
		sql.Index
		exprLen     int
		prefixCount int
	}

	var indexes []idxWithLen
	for _, idx := range r.indexesByTable[strings.ToLower(table)] {
		indexExprs := idx.Expressions()
		if ok, prefixCount := exprsAreIndexSubset(exprStrs, indexExprs); ok && prefixCount >= 1 {
			indexes = append(indexes, idxWithLen{idx, len(indexExprs), prefixCount})
		}
	}

	if r.indexRegistry != nil {
		idx, prefixCount, err := r.indexRegistry.MatchingIndex(ctx, db, exprs...)
		if err != nil {
			// We just abandon indexes rather than returning an error here
			return nil
		}
		if idx != nil && prefixCount >= 1 {
			r.registryIdxes = append(r.registryIdxes, idx)
			indexes = append(indexes, idxWithLen{idx, len(idx.Expressions()), prefixCount})
		}
	}

	exprLen := len(exprStrs)
	sort.Slice(indexes, func(i, j int) bool {
		idxI := indexes[i]
		idxJ := indexes[j]
		if idxI.exprLen == exprLen && idxJ.exprLen != exprLen {
			return true
		} else if idxI.exprLen != exprLen && idxJ.exprLen == exprLen {
			return false
		} else if idxI.prefixCount != idxJ.prefixCount {
			return idxI.prefixCount > idxJ.prefixCount
			// TODO: ID() == "PRIMARY" is purely convention
		} else if idxI.ID() == "PRIMARY" || idxJ.ID() == "PRIMARY" {
			return idxI.ID() == "PRIMARY"
		} else if idxI.exprLen != idxJ.exprLen {
			return idxI.exprLen > idxJ.exprLen
		} else {
			return idxI.Index.ID() < idxJ.Index.ID()
		}
	})
	sortedIndexes := make([]sql.Index, len(indexes))
	for i := 0; i < len(sortedIndexes); i++ {
		sortedIndexes[i] = indexes[i].Index
	}
	return sortedIndexes
}

// ExpressionsWithIndexes finds all the combinations of expressions with matching indexes. This only matches
// multi-column indexes. Sorts the list of expressions by their length in descending order.
func (r *indexAnalyzer) ExpressionsWithIndexes(db string, exprs ...sql.Expression) [][]sql.Expression {
	var results [][]sql.Expression

	// First find matches in the native indexes
	for _, idxes := range r.indexesByTable {
	Indexes:
		for _, idx := range idxes {
			var used = make(map[int]struct{})
			var matched []sql.Expression
			for _, ie := range idx.Expressions() {
				var found bool
				for i, e := range exprs {
					if _, ok := used[i]; ok {
						continue
					}

					if strings.EqualFold(ie, e.String()) {
						used[i] = struct{}{}
						found = true
						matched = append(matched, e)
						break
					}
				}

				if !found {
					break
				}
			}
			if len(matched) == 0 {
				continue Indexes
			}

			results = append(results, matched)
		}
	}

	// Expand the search to the index registry if present
	if r.indexRegistry != nil {
		indexes := r.indexRegistry.ExpressionsWithIndexes(db, exprs...)
		results = append(results, indexes...)
	}

	sort.SliceStable(results, func(i, j int) bool {
		return len(results[i]) > len(results[j])
	})
	return results
}

// releaseUsedIndexes should be called in the top level function of index analysis to return any held res
func (r *indexAnalyzer) releaseUsedIndexes() {
	if r.indexRegistry == nil {
		return
	}

	for _, i := range r.registryIdxes {
		if i != nil {
			r.indexRegistry.ReleaseIndex(i)
		}
	}
}

// exprsAreIndexSubset returns whether exprs are a subset of indexExprs. If they are a subset, then also returns how
// many expressions are the prefix to the index expressions. If the first index expression is not present, then the scan
// is equivalent to a table scan (which may have special optimizations that do not apply to an index scan). With at
// least the first index expression (prefixCount >= 1), the searchable area for the index is limited, making an index
// scan useful. It is assumed that indexExprs are ordered by their declaration. For example `INDEX (v3, v2, v1)` would
// pass in `[]string{"v3", "v2", v1"}` and no other order.
//
// The returned prefixCount states how many expressions are a part of the index prefix. If len(exprs) == prefixCount
// then all of the expressions are a prefix. If prefixCount == 0 then no expressions are part of the index prefix. This
// is not recommended for direct index usage, but should instead be used for indexes that may intersect another.
//
// Using the above example index, the filter (v2 < 5 AND v1 < 5) is a subset but not a prefix. However, it may be
// intersected with (v3 > 1 AND v1 > 1) which contains a prefix (but is not a prefix in its entirety).
func exprsAreIndexSubset(exprs, indexExprs []string) (ok bool, prefixCount int) {
	if len(exprs) > len(indexExprs) {
		return false, 0
	}

	visitedIndexExprs := make([]bool, len(indexExprs))
	for _, expr := range exprs {
		found := false
		for j, indexExpr := range indexExprs {
			if visitedIndexExprs[j] {
				continue
			}
			if strings.EqualFold(expr, indexExpr) {
				visitedIndexExprs[j] = true
				found = true
				break
			}
		}
		if !found {
			return false, 0
		}
	}

	// This checks the length of the prefix by checking how many true booleans are encountered before the first false
	for i, visitedExpr := range visitedIndexExprs {
		if visitedExpr {
			continue
		}
		return true, i
	}

	return true, len(exprs)
}
