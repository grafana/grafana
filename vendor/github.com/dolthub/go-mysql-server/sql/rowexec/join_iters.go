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

package rowexec

import (
	"errors"
	"fmt"
	"io"
	"reflect"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/hash"
	"github.com/dolthub/go-mysql-server/sql/plan"
	"github.com/dolthub/go-mysql-server/sql/transform"
)

// joinIter is an iterator that iterates over every row in the primary table and performs an index lookup in
// the secondary table for each value
type joinIter struct {
	b                 sql.NodeExecBuilder
	cond              sql.Expression
	primary           sql.RowIter
	secondaryProvider sql.Node
	secondary         sql.RowIter
	primaryRow        sql.Row
	rowSize           int
	scopeLen          int
	parentLen         int
	joinType          plan.JoinType
	loadPrimaryRow    bool
	foundMatch        bool
}

func newJoinIter(ctx *sql.Context, b sql.NodeExecBuilder, j *plan.JoinNode, row sql.Row) (sql.RowIter, error) {
	var leftName, rightName string
	if leftTable, ok := j.Left().(sql.Nameable); ok {
		leftName = leftTable.Name()
	} else {
		leftName = reflect.TypeOf(j.Left()).String()
	}

	if rightTable, ok := j.Right().(sql.Nameable); ok {
		rightName = rightTable.Name()
	} else {
		rightName = reflect.TypeOf(j.Right()).String()
	}

	span, ctx := ctx.Span("plan.joinIter", trace.WithAttributes(
		attribute.String("left", leftName),
		attribute.String("right", rightName),
	))

	l, err := b.Build(ctx, j.Left(), row)
	if err != nil {
		span.End()
		return nil, err
	}

	parentLen := len(row)

	primaryRow := make(sql.Row, parentLen+len(j.Left().Schema()))
	copy(primaryRow, row)

	return sql.NewSpanIter(span, &joinIter{
		b:        b,
		joinType: j.Op,
		cond:     j.Filter,

		primary:        l,
		primaryRow:     primaryRow,
		loadPrimaryRow: true,

		secondaryProvider: j.Right(),

		rowSize:   parentLen + len(j.Left().Schema()) + len(j.Right().Schema()),
		scopeLen:  j.ScopeLen,
		parentLen: parentLen,
	}), nil
}

func (i *joinIter) loadPrimary(ctx *sql.Context) error {
	if i.loadPrimaryRow {
		r, err := i.primary.Next(ctx)
		if err != nil {
			return err
		}
		copy(i.primaryRow[i.parentLen:], r)
		i.foundMatch = false
		i.loadPrimaryRow = false
	}
	return nil
}

func (i *joinIter) loadSecondary(ctx *sql.Context) (sql.Row, error) {
	if i.secondary == nil {
		rowIter, err := i.b.Build(ctx, i.secondaryProvider, i.primaryRow)
		if err != nil {
			return nil, err
		}
		if plan.IsEmptyIter(rowIter) {
			return nil, plan.ErrEmptyCachedResult
		}
		i.secondary = rowIter
	}

	secondaryRow, err := i.secondary.Next(ctx)
	if err != nil {
		if err == io.EOF {
			err = i.secondary.Close(ctx)
			i.secondary = nil
			if err != nil {
				return nil, err
			}
			i.loadPrimaryRow = true
			return nil, io.EOF
		}
		return nil, err
	}

	return secondaryRow, nil
}

func (i *joinIter) Next(ctx *sql.Context) (sql.Row, error) {
	for {
		if err := i.loadPrimary(ctx); err != nil {
			return nil, err
		}

		primary := i.primaryRow
		secondary, err := i.loadSecondary(ctx)
		if err != nil {
			if errors.Is(err, io.EOF) {
				if !i.foundMatch && i.joinType.IsLeftOuter() {
					i.loadPrimaryRow = true
					row := i.buildRow(primary, nil)
					return i.removeParentRow(row), nil
				}
				continue
			}
			if errors.Is(err, plan.ErrEmptyCachedResult) {
				if !i.foundMatch && i.joinType.IsLeftOuter() {
					i.loadPrimaryRow = true
					row := i.buildRow(primary, nil)
					return i.removeParentRow(row), nil
				}
				return nil, io.EOF
			}
			return nil, err
		}

		row := i.buildRow(primary, secondary)
		res, err := sql.EvaluateCondition(ctx, i.cond, row)
		if err != nil {
			return nil, err
		}

		if res == nil && i.joinType.IsExcludeNulls() {
			err = i.secondary.Close(ctx)
			i.secondary = nil
			if err != nil {
				return nil, err
			}
			i.loadPrimaryRow = true
			continue
		}

		if !sql.IsTrue(res) {
			continue
		}

		i.foundMatch = true
		return i.removeParentRow(row), nil
	}
}

func (i *joinIter) removeParentRow(r sql.Row) sql.Row {
	copy(r[i.scopeLen:], r[i.parentLen:])
	r = r[:len(r)-i.parentLen+i.scopeLen]
	return r
}

// buildRow builds the result set row using the rows from the primary and secondary tables
func (i *joinIter) buildRow(primary, secondary sql.Row) sql.Row {
	row := make(sql.Row, i.rowSize)
	copy(row, primary)
	copy(row[len(primary):], secondary)
	return row
}

func (i *joinIter) Close(ctx *sql.Context) (err error) {
	if i.primary != nil {
		if err = i.primary.Close(ctx); err != nil {
			if i.secondary != nil {
				_ = i.secondary.Close(ctx)
			}
			return err
		}
	}

	if i.secondary != nil {
		err = i.secondary.Close(ctx)
		i.secondary = nil
	}

	return err
}

func newExistsIter(ctx *sql.Context, b sql.NodeExecBuilder, j *plan.JoinNode, row sql.Row) (sql.RowIter, error) {
	leftIter, err := b.Build(ctx, j.Left(), row)
	if err != nil {
		return nil, err
	}

	parentLen := len(row)

	rowSize := parentLen + len(j.Left().Schema()) + len(j.Right().Schema())
	fullRow := make(sql.Row, rowSize)
	copy(fullRow, row)

	primaryRow := make(sql.Row, parentLen+len(j.Left().Schema()))
	copy(primaryRow, row)

	return &existsIter{
		b:                 b,
		typ:               j.Op,
		primary:           leftIter,
		primaryRow:        primaryRow,
		fullRow:           fullRow,
		parentLen:         parentLen,
		secondaryProvider: j.Right(),
		cond:              j.Filter,
		scopeLen:          j.ScopeLen,
		rowSize:           rowSize,
		nullRej:           j.Filter != nil && plan.IsNullRejecting(j.Filter),
	}, nil
}

type existsIter struct {
	b                 sql.NodeExecBuilder
	cond              sql.Expression
	primary           sql.RowIter
	secondaryProvider sql.Node
	primaryRow        sql.Row
	fullRow           sql.Row
	parentLen         int
	scopeLen          int
	rowSize           int
	typ               plan.JoinType
	nullRej           bool
	rightIterNonEmpty bool
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
	var right sql.Row
	var rIter sql.RowIter
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
			r, err := i.primary.Next(ctx)
			if err != nil {
				return nil, err
			}
			copy(i.primaryRow[i.parentLen:], r)
			rIter, err = i.b.Build(ctx, i.secondaryProvider, i.primaryRow)
			if err != nil {
				return nil, err
			}
			if plan.IsEmptyIter(rIter) {
				switch {
				case i.typ.IsSemi():
					// EXISTS with empty right is always false → skip this left row
					nextState = esIncLeft
				case i.typ.IsAnti():
					if i.nullRej {
						// Filter is null-rejecting: need to run condition once with nil right so NULL can propagate
						// and row may be excluded
						nextState = esCompare
					} else {
						// Filter is not null-rejecting: no matches possible, row passes
						nextState = esRet
					}
				default:
					nextState = esCompare
				}
			} else {
				nextState = esIncRight
			}
		case esIncRight:
			right, err = rIter.Next(ctx)
			if err != nil {
				iterErr := rIter.Close(ctx)
				if iterErr != nil {
					return nil, fmt.Errorf("%w; error on close: %s", err, iterErr)
				}
				if errors.Is(err, io.EOF) {
					nextState = esRightIterEOF
				} else {
					return nil, err
				}
			} else {
				i.rightIterNonEmpty = true
				nextState = esCompare
			}
		case esRightIterEOF:
			if i.typ.IsSemi() {
				// reset iter, no match
				nextState = esIncLeft
			} else {
				nextState = esRet
			}
		case esCompare:
			copy(i.fullRow[i.parentLen:], i.primaryRow[i.parentLen:])
			copy(i.fullRow[len(i.primaryRow):], right)
			res, err := sql.EvaluateCondition(ctx, i.cond, i.fullRow)
			if err != nil {
				return nil, err
			}

			if res == nil && i.typ.IsExcludeNulls() {
				nextState = esRejectNull
				continue
			}

			if !sql.IsTrue(res) {
				nextState = esIncRight
			} else {
				err = rIter.Close(ctx)
				if err != nil {
					return nil, err
				}
				if i.typ.IsAnti() {
					// reset iter, found match -> no return row
					nextState = esIncLeft
				} else {
					nextState = esRet
				}
			}
		case esRejectNull:
			if i.typ.IsAnti() {
				nextState = esIncLeft
			} else {
				nextState = esIncRight
			}
		case esRet:
			return i.removeParentRow(i.primaryRow.Copy()), nil
		default:
			return nil, fmt.Errorf("invalid exists join state")
		}
	}
}

func isTrueLit(e sql.Expression) bool {
	if lit, ok := e.(*expression.Literal); ok {
		return lit.Value() == true
	}
	return false
}

func (i *existsIter) removeParentRow(r sql.Row) sql.Row {
	copy(r[i.scopeLen:], r[i.parentLen:])
	r = r[:len(r)-i.parentLen+i.scopeLen]
	return r
}

// buildRow builds the result set row using the rows from the primary and secondary tables
func (i *existsIter) buildRow(primary, secondary sql.Row) sql.Row {
	row := make(sql.Row, i.rowSize)
	copy(row, primary)
	copy(row[len(primary):], secondary)
	return row
}

func (i *existsIter) Close(ctx *sql.Context) (err error) {
	if i.primary != nil {
		if err = i.primary.Close(ctx); err != nil {
			return err
		}
	}
	return err
}

func newFullJoinIter(ctx *sql.Context, b sql.NodeExecBuilder, j *plan.JoinNode, row sql.Row) (sql.RowIter, error) {
	leftIter, err := b.Build(ctx, j.Left(), row)
	if err != nil {
		return nil, err
	}
	return &fullJoinIter{
		parentRow: row,
		l:         leftIter,
		rp:        j.Right(),
		cond:      j.Filter,
		scopeLen:  j.ScopeLen,
		rowSize:   len(row) + len(j.Left().Schema()) + len(j.Right().Schema()),
		seenLeft:  make(map[uint64]struct{}),
		seenRight: make(map[uint64]struct{}),
		leftLen:   len(j.Left().Schema()),
		rightLen:  len(j.Right().Schema()),
		b:         b,
	}, nil
}

// fullJoinIter implements full join as a union of left and right join:
// FJ(A,B) => U(LJ(A,B), RJ(A,B)). The current algorithm will have a
// runtime and memory complexity O(m+n).
type fullJoinIter struct {
	rp        sql.Node
	b         sql.NodeExecBuilder
	r         sql.RowIter
	cond      sql.Expression
	l         sql.RowIter
	seenLeft  map[uint64]struct{}
	seenRight map[uint64]struct{}
	leftRow   sql.Row
	parentRow sql.Row
	rowSize   int
	leftLen   int
	rightLen  int
	scopeLen  int
	leftDone  bool
}

func (i *fullJoinIter) Next(ctx *sql.Context) (sql.Row, error) {
	for {
		if i.leftDone {
			break
		}
		if i.leftRow == nil {
			r, err := i.l.Next(ctx)
			if errors.Is(err, io.EOF) {
				i.leftDone = true
				i.l = nil
				i.r = nil
				continue
			}
			if err != nil {
				return nil, err
			}

			i.leftRow = r
		}

		if i.r == nil {
			iter, err := i.b.Build(ctx, i.rp, i.leftRow)
			if err != nil {
				return nil, err
			}
			i.r = iter
		}

		rightRow, err := i.r.Next(ctx)
		if err == io.EOF {
			key, err := hash.HashOf(ctx, nil, i.leftRow)
			if err != nil {
				return nil, err
			}
			if _, ok := i.seenLeft[key]; !ok {
				// (left, null) only if we haven't matched left
				ret := i.buildRow(i.leftRow, make(sql.Row, i.rightLen))
				i.r = nil
				i.leftRow = nil
				return i.removeParentRow(ret), nil
			}
			i.r = nil
			i.leftRow = nil
			continue
		}
		if err != nil {
			return nil, err
		}

		row := i.buildRow(i.leftRow, rightRow)
		matches, err := sql.EvaluateCondition(ctx, i.cond, row)
		if err != nil {
			return nil, err
		}
		if !sql.IsTrue(matches) {
			continue
		}
		rkey, err := hash.HashOf(ctx, nil, rightRow)
		if err != nil {
			return nil, err
		}
		i.seenRight[rkey] = struct{}{}
		lKey, err := hash.HashOf(ctx, nil, i.leftRow)
		if err != nil {
			return nil, err
		}
		i.seenLeft[lKey] = struct{}{}
		return i.removeParentRow(row), nil
	}

	for {
		if i.r == nil {
			// Phase 2 of FULL OUTER JOIN: return unmatched right rows as (null, rightRow).
			// Use parentRow instead of leftRow since leftRow is nil when left side is empty.
			iter, err := i.b.Build(ctx, i.rp, i.parentRow)
			if err != nil {
				return nil, err
			}

			i.r = iter
		}

		rightRow, err := i.r.Next(ctx)
		if errors.Is(err, io.EOF) {
			err := i.r.Close(ctx)
			if err != nil {
				return nil, err
			}
			return nil, io.EOF
		}

		key, err := hash.HashOf(ctx, nil, rightRow)
		if err != nil {
			return nil, err
		}
		if _, ok := i.seenRight[key]; ok {
			continue
		}
		// (null, right) only if we haven't matched right
		ret := make(sql.Row, i.rowSize)
		copy(ret[i.leftLen:], rightRow)
		return i.removeParentRow(ret), nil
	}
}

func (i *fullJoinIter) removeParentRow(r sql.Row) sql.Row {
	copy(r[i.scopeLen:], r[len(i.parentRow):])
	r = r[:len(r)-len(i.parentRow)+i.scopeLen]
	return r
}

// buildRow builds the result set row using the rows from the primary and secondary tables
func (i *fullJoinIter) buildRow(primary, secondary sql.Row) sql.Row {
	row := make(sql.Row, i.rowSize)
	copy(row, i.parentRow)
	copy(row[len(i.parentRow):], primary)
	copy(row[len(i.parentRow)+len(primary):], secondary)
	return row
}

func (i *fullJoinIter) Close(ctx *sql.Context) (err error) {
	if i.l != nil {
		err = i.l.Close(ctx)
	}

	if i.r != nil {
		if err == nil {
			err = i.r.Close(ctx)
		} else {
			i.r.Close(ctx)
		}
	}

	return err
}

type crossJoinIterator struct {
	l  sql.RowIter
	r  sql.RowIter
	rp sql.Node
	b  sql.NodeExecBuilder

	primaryRow sql.Row

	rowSize   int
	scopeLen  int
	parentLen int
}

func newCrossJoinIter(ctx *sql.Context, b sql.NodeExecBuilder, j *plan.JoinNode, row sql.Row) (sql.RowIter, error) {
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

	span, ctx := ctx.Span("plan.CrossJoin", trace.WithAttributes(
		attribute.String("left", left),
		attribute.String("right", right),
	))

	l, err := b.Build(ctx, j.Left(), row)
	if err != nil {
		span.End()
		return nil, err
	}

	parentLen := len(row)

	primaryRow := make(sql.Row, parentLen+len(j.Left().Schema()))
	copy(primaryRow, row)

	return sql.NewSpanIter(span, &crossJoinIterator{
		b:  b,
		l:  l,
		rp: j.Right(),

		primaryRow: primaryRow,

		rowSize:   len(row) + len(j.Left().Schema()) + len(j.Right().Schema()),
		scopeLen:  j.ScopeLen,
		parentLen: parentLen,
	}), nil
}

func (i *crossJoinIterator) Next(ctx *sql.Context) (sql.Row, error) {
	for {
		if i.r == nil {
			r, err := i.l.Next(ctx)
			if err != nil {
				return nil, err
			}
			copy(i.primaryRow[i.parentLen:], r)

			iter, err := i.b.Build(ctx, i.rp, i.primaryRow)
			if err != nil {
				return nil, err
			}
			i.r = iter
		}

		rightRow, err := i.r.Next(ctx)
		if err == io.EOF {
			i.r = nil
			continue
		}

		if err != nil {
			return nil, err
		}

		row := make(sql.Row, i.rowSize)
		copy(row, i.primaryRow)
		copy(row[len(i.primaryRow):], rightRow)
		return i.removeParentRow(row), nil
	}
}

func (i *crossJoinIterator) removeParentRow(r sql.Row) sql.Row {
	copy(r[i.scopeLen:], r[i.parentLen:])
	r = r[:len(r)-i.parentLen+i.scopeLen]
	return r
}

func (i *crossJoinIterator) Close(ctx *sql.Context) (err error) {
	if i.l != nil {
		err = i.l.Close(ctx)
	}
	if i.r != nil {
		if err == nil {
			err = i.r.Close(ctx)
		} else {
			i.r.Close(ctx)
		}
	}
	return err
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
	primary       sql.RowIter
	secondary     sql.RowIter
	secondaryNode sql.Node
	cond          sql.Expression
	b             sql.NodeExecBuilder
	parentRow     sql.Row
	primaryRow    sql.Row
	secondaryRow  sql.Row
	rowSize       int
	scopeLen      int
	jType         plan.JoinType
	foundMatch    bool
}

func newLateralJoinIter(ctx *sql.Context, b sql.NodeExecBuilder, j *plan.JoinNode, row sql.Row) (sql.RowIter, error) {
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

	span, ctx := ctx.Span("plan.LateralJoin", trace.WithAttributes(
		attribute.String("left", left),
		attribute.String("right", right),
	))

	l, err := b.Build(ctx, j.Left(), row)
	if err != nil {
		span.End()
		return nil, err
	}

	return sql.NewSpanIter(span, &lateralJoinIterator{
		parentRow:     row,
		primary:       l,
		secondaryNode: j.Right(),
		cond:          j.Filter,
		jType:         j.Op,
		rowSize:       len(row) + len(j.Left().Schema()) + len(j.Right().Schema()),
		scopeLen:      j.ScopeLen,
		b:             b,
	}), nil
}

func (i *lateralJoinIterator) loadPrimary(ctx *sql.Context) error {
	if i.primaryRow == nil {
		lRow, err := i.primary.Next(ctx)
		if err != nil {
			return err
		}
		i.primaryRow = lRow
		i.foundMatch = false
	}
	return nil
}

func (i *lateralJoinIterator) buildSecondary(ctx *sql.Context) error {
	if i.secondary == nil {
		prepended, _, err := transform.Node(i.secondaryNode, plan.PrependRowInPlan(i.primaryRow, true))
		if err != nil {
			return err
		}
		iter, err := i.b.Build(ctx, prepended, i.primaryRow)
		if err != nil {
			return err
		}
		i.secondary = iter
	}
	return nil
}

func (i *lateralJoinIterator) loadSecondary(ctx *sql.Context) error {
	if i.secondaryRow == nil {
		sRow, err := i.secondary.Next(ctx)
		if err != nil {
			return err
		}
		i.secondaryRow = sRow[len(i.primaryRow):]
	}
	return nil
}

func (i *lateralJoinIterator) buildRow(primaryRow, secondaryRow sql.Row) sql.Row {
	row := make(sql.Row, i.rowSize)
	copy(row, i.parentRow)
	copy(row[len(i.parentRow):], primaryRow)
	copy(row[len(i.parentRow)+len(primaryRow):], secondaryRow)
	return row
}

func (i *lateralJoinIterator) removeParentRow(r sql.Row) sql.Row {
	copy(r[i.scopeLen:], r[len(i.parentRow):])
	r = r[:len(r)-len(i.parentRow)+i.scopeLen]
	return r
}

func (i *lateralJoinIterator) reset(ctx *sql.Context) (err error) {
	if i.secondary != nil {
		err = i.secondary.Close(ctx)
		i.secondary = nil
	}
	i.primaryRow = nil
	i.secondaryRow = nil
	return
}

func (i *lateralJoinIterator) Next(ctx *sql.Context) (sql.Row, error) {
	for {
		if err := i.loadPrimary(ctx); err != nil {
			return nil, err
		}
		if err := i.buildSecondary(ctx); err != nil {
			return nil, err
		}
		if err := i.loadSecondary(ctx); err != nil {
			if errors.Is(err, io.EOF) {
				if !i.foundMatch && i.jType == plan.JoinTypeLateralLeft {
					res := i.buildRow(i.primaryRow, nil)
					if resetErr := i.reset(ctx); resetErr != nil {
						return nil, resetErr
					}
					return i.removeParentRow(res), nil
				}
				if resetErr := i.reset(ctx); resetErr != nil {
					return nil, resetErr
				}
				continue
			}
			return nil, err
		}

		row := i.buildRow(i.primaryRow, i.secondaryRow)
		i.secondaryRow = nil
		if i.cond != nil {
			if res, err := sql.EvaluateCondition(ctx, i.cond, row); err != nil {
				return nil, err
			} else if !sql.IsTrue(res) {
				continue
			}
		}

		i.foundMatch = true
		return i.removeParentRow(row), nil
	}
}

func (i *lateralJoinIterator) Close(ctx *sql.Context) error {
	var pErr, sErr error
	if i.primary != nil {
		pErr = i.primary.Close(ctx)
	}
	if i.secondary != nil {
		sErr = i.secondary.Close(ctx)
	}
	if pErr != nil {
		return pErr
	}
	if sErr != nil {
		return sErr
	}
	return nil
}
