// Copyright 2020-2025 Dolthub, Inc.
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

package rowexec

import (
	"errors"
	"fmt"
	"io"
	"reflect"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/hash"
	"github.com/dolthub/go-mysql-server/sql/plan"
	"github.com/dolthub/go-mysql-server/sql/transform"
)

// joinState is the common state for all join iterators.
// This type encapsulates accesses to the underlying iterators and handles things like managing outer scopes.
// Various join iters wrap a joinState value and handle behavior specific to that join type.
//
// The general usage pattern looks like this:
//
//	 while there are rows in the primary/left child iterator:
//	   advance the primary iterator and store the yielded rows, stripping columns that refer to outer scopes
//	   build a new child iterator for the right/secondary child, using the new values from the primary (and from outer scopes) as the parent row.
//	   while there are rows in the secondary/right child iterator:
//	     advance the secondary iterator and store the yielded rows, stripping columns that refer to outer scopes
//			check whether the current state satisfied any join conditions
//		    potentially yield a new row containing values from the outer scope, and from both children
//
// All row iterators, including join iterators, currently obey the following invariant:
//   - When constructed, they take a `parentRow` parameter containing values for all values defined outside of the node.
//     This includes, in order:
//     -- Values from outer and lateral scopes
//     -- Values from parent join nodes
//   - When yielding rows, the row contains, in order:
//     -- Values from outer and lateral scopes
//     -- Values defined by the node
//
// Yielding values defined in outer scopes is necessary because a parent node may need to use that value in an expression;
// prepending these values to iterator rows is how we expose them.
// Notably, join iterators do *not* yield values defined in parent nodes unless those values constitute an outer or lateral
// scope (such as in the case of lateralJoinIterator). This is important, because it allows a join iterator to not care
// whether or not its children are also join iterators: both join and non-join nodes yield values in the same format.
//
// Q: Why do we only copy the last rows returned by the child iterators? Why can't we just use the result of primaryRowIter.Next() as primaryRow?
// A: There is a subtle correctness issue if we do that, because the child could be a cached subquery. We cache subqueries if they don't reference
// any columns in their outer scope, but we still pass in those columns when building the iterator, and the iterator still returns values
// for those columns in its results. Thus for values corresponding to outer scopes, it is possible for the values returned by the child iterator
// to differ from the values in the join's parentRow, and the values returned by the iterator should be discarded.
//
// TODO: This is dangerous and there may be existing correctness bugs because of this. We should fix this by moving to
// an implementation where parent scope values are not returned by iterators at all.
type joinState struct {
	builder  sql.NodeExecBuilder
	joinType plan.JoinType

	// scopeLen is the number of columns inherited from outer scopes. These are additional columns that are prepended
	// to every child iterator, allowing child iterators to resolve references to these outer scopes.
	scopeLen int
	// parentLen is the number of columns inherited from parent nodes, including both outer scopes and parent nodes
	// within the same scope (such as parent join nodes in a many-table-join.) This value is always greater than or
	// equal to the value of |scopeLen|
	parentLen int
	// leftLen and rightLen are the number of columns in the left/primary and right/secondary child node schemas.
	leftLen  int
	rightLen int

	// join nodes and their children obey the following invariants:
	// - rows returned by primaryRowIter contain the outer scope rows, followed by the left child rows.
	//   Thus, they are always of length scopeLen + leftLen.
	// - rows returned by secondaryRowIter contain the outer scope rows, followed by the right child rows.
	// For non-lateral joins they are always of length scopeLen + rightLen.
	// Lateral joins make this slightly more complicated.

	primaryRowIter   sql.RowIter
	secondaryRowIter sql.RowIter

	// primaryRow is the row that will get passed to the builder when building the secondary child iterator.
	// It is always of length parentLen + leftLen
	primaryRow sql.Row

	// fullRow is the row that will get passed to any join conditions. It is always of length rowSize (aka parentLen + leftLen + rightLen)
	fullRow sql.Row

	// secondaryProvider is a node from which secondaryRowIter can be constructed. It is usually built once
	// for each value pulled from primaryRowIter
	secondaryProvider sql.Node

	// cond is the join condition, if any
	cond sql.Expression

	// foundMatch indicates whether the iterator has returned a result for the current primaryRow. It is
	// needed for left outer joins and full outer joins.
	foundMatch bool
}

// fullRowSize is the total number of columns visible in the join. It includes columns from the outer scope,
// columns from parent join nodes, and columns from both children.
func (i *joinState) fullRowSize() int {
	return i.parentLen + i.leftLen + i.rightLen
}

// resultRowSize is the size of the rows produced by the join iterator
func (i *joinState) resultRowSize() int {
	return i.scopeLen + i.leftLen + i.rightLen
}

// makeResultRow creates a new sql.Row computed from the most recently visited children.
func (i *joinState) makeResultRow() sql.Row {
	resultRow := make(sql.Row, i.resultRowSize())
	copy(resultRow, i.fullRow[:i.scopeLen])
	copy(resultRow[i.scopeLen:], i.fullRow[i.parentLen:])
	return resultRow
}

// scopeColumns returns the values defined in outer scopes that are visible to this join.
// It is a subset of parentColumns.
func (i *joinState) scopeColumns() sql.Row {
	return i.fullRow[:i.scopeLen]
}

// parentColumns returns the values defined in all parent nodes that are visible to this join.
// It is a superset of scopeColumns, but also includes parent nodes in the same scope, such as parent join nodes.
func (i *joinState) parentColumns() sql.Row {
	return i.fullRow[:i.parentLen]
}

// leftColumns returns the values most recently yielded from the primary/left child node.
func (i *joinState) leftColumns() sql.Row {
	return i.fullRow[i.parentLen : i.parentLen+i.leftLen]
}

// rightColumns returns the values most recently yielded from the secondary/right child node.
func (i *joinState) rightColumns() sql.Row {
	return i.fullRow[i.parentLen+i.leftLen : i.parentLen+i.leftLen+i.rightLen]
}

// makeLeftOuterNonMatchingResult returns a new sql.Row representing a row from an OUTER LEFT join where no match was made with the right child.
func (i *joinState) makeLeftOuterNonMatchingResult() sql.Row {
	resultRow := make(sql.Row, i.resultRowSize())
	copy(resultRow, i.scopeColumns())
	copy(resultRow[i.scopeLen:], i.leftColumns())
	return resultRow
}

// makeLeftOuterNonMatchingResult returns a new sql.Row representing a row from an OUTER RIGHT join where no match was made with the left child.
func (i *joinState) makeRightOuterNonMatchingResult() sql.Row {
	resultRow := make(sql.Row, i.resultRowSize())
	copy(resultRow, i.scopeColumns())
	copy(resultRow[i.scopeLen+i.leftLen:], i.rightColumns())
	return resultRow
}

// makeSemiJoinResult returns a new sql.Row representing a row from a SemiJoin or ExistsIter
func (i *joinState) makeSemiJoinResult() sql.Row {
	resultRow := make(sql.Row, i.scopeLen+i.leftLen)
	copy(resultRow, i.scopeColumns())
	copy(resultRow[i.scopeLen:], i.leftColumns())
	return resultRow
}

func newJoinState(ctx *sql.Context, b sql.NodeExecBuilder, j *plan.JoinNode, parentRow sql.Row, opName string) (joinState, trace.Span, error) {
	var left, right string
	if leftTable, ok := j.Left().(sql.Nameable); ok {
		left = leftTable.Name()
	} else {
		left = reflect.TypeOf(j.Left()).String()
	}
	if rightTable, ok := j.Right().(sql.Nameable); ok {
		right = rightTable.Name()
	} else {
		right = reflect.TypeOf(j.Right()).String()
	}

	span, ctx := ctx.Span(opName, trace.WithAttributes(
		attribute.String("left", left),
		attribute.String("right", right),
	))

	parentLen := len(parentRow)
	scopeLen := j.ScopeLen
	leftLen := len(j.Left().Schema())
	rightLen := len(j.Right().Schema())

	primaryRow := make(sql.Row, parentLen+leftLen)
	copy(primaryRow, parentRow)

	resultRow := make(sql.Row, scopeLen+leftLen+rightLen)
	copy(resultRow, parentRow[:scopeLen])

	fullRow := make(sql.Row, parentLen+leftLen+rightLen)
	copy(fullRow, parentRow[:parentLen])

	primaryRowIter, err := b.Build(ctx, j.Left(), parentRow)
	if err != nil {
		span.End()
		return joinState{}, nil, err
	}

	return joinState{
		builder:  b,
		joinType: j.Op,

		scopeLen:  scopeLen,
		parentLen: parentLen,
		leftLen:   leftLen,
		rightLen:  rightLen,

		primaryRowIter:    primaryRowIter,
		primaryRow:        primaryRow,
		fullRow:           fullRow,
		secondaryProvider: j.Right(),
		secondaryRowIter:  nil,

		cond: j.Filter,
	}, span, nil
}

// loadPrimary advances the primary iterator and updates internal state.
func (i *joinState) loadPrimary(ctx *sql.Context) error {
	childRow, err := i.primaryRowIter.Next(ctx)
	if err != nil {
		return err
	}
	i.foundMatch = false
	// the child iter begins with rows from the outer scope; strip those away
	rowsFromChild := childRow[len(childRow)-i.leftLen:]
	copy(i.primaryRow[i.parentLen:], rowsFromChild)
	copy(i.fullRow[i.parentLen:], rowsFromChild)
	return nil
}

// loadSecondary advances the secondary iterator and updates internal state.
// If the secondary iterator is exhausted, close and remove it.
func (i *joinState) loadSecondary(ctx *sql.Context) error {
	childRow, err := i.secondaryRowIter.Next(ctx)
	if err == io.EOF {
		err = i.secondaryRowIter.Close(ctx)
		if err != nil {
			return err
		}
		i.secondaryRowIter = nil
		return io.EOF
	} else if err != nil {
		return err
	}

	// the child iter begins with rows from the outer scope; strip those away
	rowsFromChild := childRow[len(childRow)-i.rightLen:]
	copy(i.fullRow[i.parentLen+i.leftLen:], rowsFromChild)
	return nil
}

// resetSecondaryIter closes and removes the secondary iterator.
func (i *joinState) resetSecondaryIter(ctx *sql.Context) (err error) {
	if i.secondaryRowIter != nil {
		err = i.secondaryRowIter.Close(ctx)
		i.secondaryRowIter = nil
	}
	return err
}

// Close cleans up the iterator by recursively closing the children iterators.
func (i *joinState) Close(ctx *sql.Context) (err error) {
	if i.primaryRowIter != nil {
		if err = i.primaryRowIter.Close(ctx); err != nil {
			if i.secondaryRowIter != nil {
				_ = i.secondaryRowIter.Close(ctx)
			}
			return err
		}
	}

	if i.secondaryRowIter != nil {
		err = i.secondaryRowIter.Close(ctx)
		i.secondaryRowIter = nil
	}

	return err
}

// joinIter is an iterator that iterates over every row in the primary table and performs an index lookup in
// the secondary table for each value
type joinIter struct {
	joinState
}

func newJoinIter(ctx *sql.Context, b sql.NodeExecBuilder, j *plan.JoinNode, row sql.Row) (sql.RowIter, error) {
	js, span, err := newJoinState(ctx, b, j, row, "plan.joinIter")
	if err != nil {
		return nil, err
	}

	return sql.NewSpanIter(span, &joinIter{
		joinState: js,
	}), nil
}

func (i *joinIter) Next(ctx *sql.Context) (sql.Row, error) {
	for {
		if i.secondaryRowIter == nil {
			if err := i.loadPrimary(ctx); err != nil {
				return nil, err
			}

			rowIter, err := i.builder.Build(ctx, i.secondaryProvider, i.primaryRow)
			if err != nil {
				return nil, err
			}
			if plan.IsEmptyIter(rowIter) {
				if !i.foundMatch && i.joinType.IsLeftOuter() {
					return i.makeLeftOuterNonMatchingResult(), nil
				}
				return nil, io.EOF
			}
			i.secondaryRowIter = rowIter
		}

		err := i.loadSecondary(ctx)
		if err != nil {
			if errors.Is(err, io.EOF) {
				if !i.foundMatch && i.joinType.IsLeftOuter() {
					return i.makeLeftOuterNonMatchingResult(), nil
				}
				continue
			}
			return nil, err
		}

		res, err := sql.EvaluateCondition(ctx, i.cond, i.fullRow)
		if err != nil {
			return nil, err
		}

		if res == nil && i.joinType.IsExcludeNulls() {
			if err := i.resetSecondaryIter(ctx); err != nil {
				return nil, err
			}
			continue
		}

		if !sql.IsTrue(res) {
			continue
		}

		i.foundMatch = true
		return i.makeResultRow(), nil
	}
}

func newExistsIter(ctx *sql.Context, b sql.NodeExecBuilder, j *plan.JoinNode, row sql.Row) (sql.RowIter, error) {

	js, span, err := newJoinState(ctx, b, j, row, "plan.existsIter")
	if err != nil {
		return nil, err
	}

	return sql.NewSpanIter(span, &existsIter{
		joinState: js,
	}), nil
}

type existsIter struct {
	joinState
}

type existsState uint8

const (
	esIncLeft existsState = iota
	esIncRight
	esRightIterEOF
	esCompare
	esRejectNull
	esRet
)

func (i *existsIter) Next(ctx *sql.Context) (sql.Row, error) {
	var err error

	// the common sequence is: LOAD_LEFT -> LOAD_RIGHT -> COMPARE -> RET
	// notable exceptions are represented as goto jumps:
	//  - non-null rejecting filters jump to COMPARE with a nil right row
	//    when the secondaryProvider is empty
	//  - antiJoin succeeds to RET when LOAD_RIGHT EOF's
	//  - semiJoin fails when LOAD_RIGHT EOF's, falling back to LOAD_LEFT
	//  - antiJoin fails when COMPARE returns true, falling back to LOAD_LEFT
	nextState := esIncLeft
	for {
		switch nextState {
		case esIncLeft:
			if err := i.loadPrimary(ctx); err != nil {
				return nil, err
			}
			i.secondaryRowIter, err = i.builder.Build(ctx, i.secondaryProvider, i.primaryRow)
			if err != nil {
				return nil, err
			}
			if plan.IsEmptyIter(i.secondaryRowIter) {
				nextState = esRightIterEOF
			} else {
				nextState = esIncRight
			}
		case esIncRight:
			err := i.loadSecondary(ctx)
			if err != nil {
				if errors.Is(err, io.EOF) {
					nextState = esRightIterEOF
				} else {
					return nil, err
				}
			} else {
				nextState = esCompare
			}
		case esRightIterEOF:
			if i.joinType.IsSemi() {
				// reset iter, no match
				nextState = esIncLeft
			} else {
				nextState = esRet
			}
		case esCompare:
			res, err := sql.EvaluateCondition(ctx, i.cond, i.fullRow)
			if err != nil {
				return nil, err
			}

			if res == nil && i.joinType.IsExcludeNulls() {
				nextState = esRejectNull
				continue
			}

			if !sql.IsTrue(res) {
				nextState = esIncRight
			} else {
				if err = i.resetSecondaryIter(ctx); err != nil {
					return nil, err
				}
				if i.joinType.IsAnti() {
					// reset iter, found match -> no return row
					nextState = esIncLeft
				} else {
					nextState = esRet
				}
			}
		case esRejectNull:
			if i.joinType.IsAnti() {
				nextState = esIncLeft
			} else {
				nextState = esIncRight
			}
		case esRet:
			return i.makeSemiJoinResult(), nil
		default:
			return nil, fmt.Errorf("invalid exists join state")
		}
	}
}

func newFullJoinIter(ctx *sql.Context, b sql.NodeExecBuilder, j *plan.JoinNode, row sql.Row) (sql.RowIter, error) {
	js, span, err := newJoinState(ctx, b, j, row, "plan.fullJoinIter")
	if err != nil {
		return nil, err
	}
	return sql.NewSpanIter(span, &fullJoinIter{
		joinState: js,
		parentRow: row,
		seenLeft:  make(map[uint64]struct{}),
		seenRight: make(map[uint64]struct{}),
	}), nil
}

// fullJoinIter implements full join as a union of left and right join:
// FJ(A,B) => U(LJ(A,B), RJ(A,B)). The current algorithm will have a
// runtime and memory complexity O(m+n).
type fullJoinIter struct {
	joinState
	seenLeft  map[uint64]struct{}
	seenRight map[uint64]struct{}
	parentRow sql.Row
	leftDone  bool
}

func (i *fullJoinIter) Next(ctx *sql.Context) (sql.Row, error) {
	for {
		if i.leftDone {
			break
		}
		if i.secondaryRowIter == nil {
			err := i.loadPrimary(ctx)
			if errors.Is(err, io.EOF) {
				i.leftDone = true
				i.primaryRowIter = nil
				continue
			} else if err != nil {
				return nil, err
			}

			iter, err := i.builder.Build(ctx, i.secondaryProvider, i.primaryRow)
			if err != nil {
				return nil, err
			}
			i.secondaryRowIter = iter
		}

		err := i.loadSecondary(ctx)
		if err == io.EOF {
			key, err := hash.HashOf(ctx, nil, i.leftColumns())
			if err != nil {
				return nil, err
			}
			if _, ok := i.seenLeft[key]; !ok {
				// (left, null) only if we haven't matched left
				ret := i.makeLeftOuterNonMatchingResult()
				err := i.resetSecondaryIter(ctx)
				return ret, err
			}
			i.secondaryRowIter = nil
			continue
		}
		if err != nil {
			return nil, err
		}

		matches, err := sql.EvaluateCondition(ctx, i.cond, i.fullRow)
		if err != nil {
			return nil, err
		}
		if !sql.IsTrue(matches) {
			continue
		}
		rkey, err := hash.HashOf(ctx, nil, i.rightColumns())
		if err != nil {
			return nil, err
		}
		i.seenRight[rkey] = struct{}{}
		lKey, err := hash.HashOf(ctx, nil, i.leftColumns())
		if err != nil {
			return nil, err
		}
		i.seenLeft[lKey] = struct{}{}
		return i.makeResultRow(), nil
	}

	for {
		if i.secondaryRowIter == nil {
			// Phase 2 of FULL OUTER JOIN: return unmatched right rows as (null, rightRow).
			// Use parentRow instead of leftRow since leftRow is nil when left side is empty.
			iter, err := i.builder.Build(ctx, i.secondaryProvider, i.parentRow)
			if err != nil {
				return nil, err
			}

			i.secondaryRowIter = iter
		}

		if err := i.loadSecondary(ctx); err != nil {
			return nil, err
		}

		key, err := hash.HashOf(ctx, nil, i.rightColumns())
		if err != nil {
			return nil, err
		}
		if _, ok := i.seenRight[key]; ok {
			continue
		}
		// (null, right) only if we haven't matched right
		return i.makeRightOuterNonMatchingResult(), nil
	}
}

type crossJoinIterator struct {
	joinState
}

func newCrossJoinIter(ctx *sql.Context, b sql.NodeExecBuilder, j *plan.JoinNode, row sql.Row) (sql.RowIter, error) {
	js, span, err := newJoinState(ctx, b, j, row, "plan.crossJoinIter")
	if err != nil {
		return nil, err
	}

	return sql.NewSpanIter(span, &crossJoinIterator{
		joinState: js,
	}), nil
}

func (i *crossJoinIterator) Next(ctx *sql.Context) (sql.Row, error) {
	for {
		if i.secondaryRowIter == nil {
			if err := i.loadPrimary(ctx); err != nil {
				return nil, err
			}

			iter, err := i.builder.Build(ctx, i.secondaryProvider, i.primaryRow)
			if err != nil {
				return nil, err
			}
			i.secondaryRowIter = iter
		}

		err := i.loadSecondary(ctx)
		if err == io.EOF {
			continue
		} else if err != nil {
			return nil, err
		}

		return i.makeResultRow(), nil
	}
}

// lateralJoinIterator is an iterator that performs a lateral join.
// A LateralJoin is a join where the right side is a subquery that can reference the left side, like through a filter.
// MySQL Docs: https://dev.mysql.com/doc/refman/8.0/en/lateral-derived-tables.html
// Example:
// select * from t;
// +---+
// | i |
// +---+
// | 1 |
// | 2 |
// | 3 |
// +---+
// select * from t1;
// +---+
// | i |
// +---+
// | 1 |
// | 4 |
// | 5 |
// +---+
// select * from t, lateral (select * from t1 where t.i = t1.j) tt;
// +---+---+
// | i | j |
// +---+---+
// | 1 | 1 |
// +---+---+
// cond is passed to the filter iter to be evaluated.
type lateralJoinIterator struct {
	joinState
}

func newLateralJoinIter(ctx *sql.Context, b sql.NodeExecBuilder, j *plan.JoinNode, parentRow sql.Row) (sql.RowIter, error) {

	js, span, err := newJoinState(ctx, b, j, parentRow, "plan.lateralJoinIter")
	if err != nil {
		return nil, err
	}

	return sql.NewSpanIter(span, &lateralJoinIterator{
		joinState: js,
	}), nil
}

func (i *lateralJoinIterator) buildSecondary(ctx *sql.Context) error {
	prepended, _, err := transform.Node(i.secondaryProvider, plan.PrependRowInPlan(i.primaryRow[i.parentLen:], true))
	if err != nil {
		return err
	}
	iter, err := i.builder.Build(ctx, prepended, i.primaryRow)
	if err != nil {
		return err
	}
	i.secondaryRowIter = iter
	return nil
}

func (i *lateralJoinIterator) Next(ctx *sql.Context) (sql.Row, error) {
	for {
		// secondary being nil means we've exhausted all secondary rows for the current primary.
		if i.secondaryRowIter == nil {
			if err := i.loadPrimary(ctx); err != nil {
				return nil, err
			}
			if err := i.buildSecondary(ctx); err != nil {
				return nil, err
			}
		}
		if err := i.loadSecondary(ctx); err != nil {
			if errors.Is(err, io.EOF) {
				if !i.foundMatch && i.joinType == plan.JoinTypeLateralLeft {
					res := make(sql.Row, i.fullRowSize())
					copy(res, i.primaryRow)
					if resetErr := i.resetSecondaryIter(ctx); resetErr != nil {
						return nil, resetErr
					}
					return res, nil
				}
				if resetErr := i.resetSecondaryIter(ctx); resetErr != nil {
					return nil, resetErr
				}
				continue
			}
			return nil, err
		}
		row := i.fullRow
		if i.cond != nil {
			if res, err := sql.EvaluateCondition(ctx, i.cond, row); err != nil {
				return nil, err
			} else if !sql.IsTrue(res) {
				continue
			}
		}

		i.foundMatch = true
		return row.Copy(), nil
	}
}
