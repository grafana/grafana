package rowexec

import (
	"container/heap"
	"errors"
	"io"
	"reflect"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/plan"
)

// joinIter is an iterator that iterates over every row in the primary table and performs an index lookup in
// the secondary table for each value
type rangeHeapJoinIter struct {
	b   sql.NodeExecBuilder
	err error

	cond         sql.Expression
	primary      sql.RowIter
	secondary    sql.RowIter
	childRowIter sql.RowIter

	ctx           *sql.Context
	rangeHeapPlan *plan.RangeHeap

	activeRanges []sql.Row
	pendingRow   sql.Row
	primaryRow   sql.Row

	scopeLen  int
	parentLen int
	rowSize   int

	foundMatch     bool
	loadPrimaryRow bool
	joinType       plan.JoinType
}

func newRangeHeapJoinIter(ctx *sql.Context, b sql.NodeExecBuilder, j *plan.JoinNode, row sql.Row) (sql.RowIter, error) {
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

	span, ctx := ctx.Span("plan.rangeHeapJoinIter", trace.WithAttributes(
		attribute.String("left", leftName),
		attribute.String("right", rightName),
	))

	l, err := b.Build(ctx, j.Left(), row)
	if err != nil {
		span.End()
		return nil, err
	}

	rhp, ok := j.Right().(*plan.RangeHeap)
	if !ok {
		return nil, errors.New("right side of join must be a range heap")
	}

	parentLen := len(row)

	primaryRow := make(sql.Row, parentLen+len(j.Left().Schema()))
	copy(primaryRow, row)

	return sql.NewSpanIter(span, &rangeHeapJoinIter{
		ctx:      ctx,
		b:        b,
		joinType: j.Op,
		cond:     j.Filter,

		primary:        l,
		primaryRow:     primaryRow,
		loadPrimaryRow: true,

		rowSize:   len(row) + len(j.Left().Schema()) + len(j.Right().Schema()),
		scopeLen:  j.ScopeLen,
		parentLen: parentLen,

		rangeHeapPlan: rhp,
	}), nil
}

func (iter *rangeHeapJoinIter) loadPrimary(ctx *sql.Context) error {
	if iter.loadPrimaryRow {
		r, err := iter.primary.Next(ctx)
		if err != nil {
			return err
		}

		copy(iter.primaryRow[iter.parentLen:], r)
		iter.foundMatch = false
		iter.loadPrimaryRow = false

		err = iter.initializeHeap(ctx, iter.b, iter.primaryRow)
		if err != nil {
			return err
		}
	}

	return nil
}

func (iter *rangeHeapJoinIter) loadSecondary(ctx *sql.Context) (sql.Row, error) {
	if iter.secondary == nil {
		rowIter, err := iter.getActiveRanges(ctx, iter.b, iter.primaryRow)
		if err != nil {
			return nil, err
		}
		if plan.IsEmptyIter(rowIter) {
			return nil, plan.ErrEmptyCachedResult
		}
		iter.secondary = rowIter
	}

	secondaryRow, err := iter.secondary.Next(ctx)
	if err != nil {
		if err == io.EOF {
			err = iter.secondary.Close(ctx)
			iter.secondary = nil
			if err != nil {
				return nil, err
			}
			iter.loadPrimaryRow = true
			return nil, io.EOF
		}
		return nil, err
	}

	return secondaryRow, nil
}

func (iter *rangeHeapJoinIter) Next(ctx *sql.Context) (sql.Row, error) {
	for {
		if err := iter.loadPrimary(ctx); err != nil {
			return nil, err
		}

		primary := iter.primaryRow
		secondary, err := iter.loadSecondary(ctx)
		if err != nil {
			if errors.Is(err, io.EOF) {
				if !iter.foundMatch && iter.joinType.IsLeftOuter() {
					iter.loadPrimaryRow = true
					row := iter.buildRow(primary, nil)
					return iter.removeParentRow(row), nil
				}
				continue
			} else if errors.Is(err, plan.ErrEmptyCachedResult) {
				if !iter.foundMatch && iter.joinType.IsLeftOuter() {
					iter.loadPrimaryRow = true
					row := iter.buildRow(primary, nil)
					return iter.removeParentRow(row), nil
				}

				return nil, io.EOF
			}
			return nil, err
		}

		row := iter.buildRow(primary, secondary)
		res, err := iter.cond.Eval(ctx, row)
		matches := res == true
		if err != nil {
			return nil, err
		}

		if res == nil && iter.joinType.IsExcludeNulls() {
			err = iter.secondary.Close(ctx)
			iter.secondary = nil
			if err != nil {
				return nil, err
			}
			iter.loadPrimaryRow = true
			continue
		}

		if !matches {
			continue
		}

		iter.foundMatch = true
		return iter.removeParentRow(row), nil
	}
}

func (iter *rangeHeapJoinIter) removeParentRow(r sql.Row) sql.Row {
	copy(r[iter.scopeLen:], r[iter.parentLen:])
	r = r[:len(r)-iter.parentLen+iter.scopeLen]
	return r
}

// buildRow builds the result set row using the rows from the primary and secondary tables
func (iter *rangeHeapJoinIter) buildRow(primary, secondary sql.Row) sql.Row {
	row := make(sql.Row, iter.rowSize)
	copy(row, primary)
	copy(row[len(primary):], secondary)
	return row
}

func (iter *rangeHeapJoinIter) Close(ctx *sql.Context) (err error) {
	if iter.primary != nil {
		if err = iter.primary.Close(ctx); err != nil {
			if iter.secondary != nil {
				_ = iter.secondary.Close(ctx)
			}
			return err
		}
	}

	if iter.secondary != nil {
		err = iter.secondary.Close(ctx)
		iter.secondary = nil
	}

	return err
}

func (iter *rangeHeapJoinIter) initializeHeap(ctx *sql.Context, builder sql.NodeExecBuilder, primaryRow sql.Row) (err error) {
	iter.childRowIter, err = builder.Build(ctx, iter.rangeHeapPlan.Child, primaryRow)
	if err != nil {
		return err
	}
	iter.activeRanges = nil
	iter.rangeHeapPlan.ComparisonType = iter.rangeHeapPlan.Schema()[iter.rangeHeapPlan.MaxColumnIndex].Type

	iter.pendingRow, err = iter.childRowIter.Next(ctx)
	if err == io.EOF {
		iter.pendingRow = nil
		return nil
	}
	return err
}

func (iter *rangeHeapJoinIter) getActiveRanges(ctx *sql.Context, _ sql.NodeExecBuilder, row sql.Row) (sql.RowIter, error) {
	// Remove rows from the heap if we've advanced beyond their max value.
	for iter.Len() > 0 {
		maxValue := iter.Peek()
		compareResult, err := compareNullsFirst(ctx, iter.rangeHeapPlan.ComparisonType, row[iter.rangeHeapPlan.ValueColumnIndex], maxValue)
		if err != nil {
			return nil, err
		}
		if (iter.rangeHeapPlan.RangeIsClosedAbove && compareResult > 0) || (!iter.rangeHeapPlan.RangeIsClosedAbove && compareResult >= 0) {
			heap.Pop(iter)
			if iter.err != nil {
				err = iter.err
				iter.err = nil
				return nil, err
			}
		} else {
			break
		}
	}

	// Advance the child iterator until we encounter a row whose min value is beyond the range.
	for iter.pendingRow != nil {
		minValue := iter.pendingRow[iter.rangeHeapPlan.MinColumnIndex]
		compareResult, err := compareNullsFirst(ctx, iter.rangeHeapPlan.ComparisonType, row[iter.rangeHeapPlan.ValueColumnIndex], minValue)
		if err != nil {
			return nil, err
		}

		if (iter.rangeHeapPlan.RangeIsClosedBelow && compareResult < 0) || (!iter.rangeHeapPlan.RangeIsClosedBelow && compareResult <= 0) {
			break
		} else {
			heap.Push(iter, iter.pendingRow)
			if iter.err != nil {
				err = iter.err
				iter.err = nil
				return nil, err
			}
		}

		iter.pendingRow, err = iter.childRowIter.Next(ctx)
		if err != nil {
			if errors.Is(err, io.EOF) {
				// We've already imported every range into the priority queue.
				iter.pendingRow = nil
				break
			}
			return nil, err
		}
	}

	// Every active row must match the accepted row.
	return sql.RowsToRowIter(iter.activeRanges...), nil
}

// When managing the heap, consider all NULLs to come before any non-NULLS.
// This is consistent with the order received if either child node is an index.
// Note: We could get the same behavior by simply excluding values and ranges containing NULL,
// but this is forward compatible if we ever want to convert joins with null-safe conditions into RangeHeapJoins.
func compareNullsFirst(ctx *sql.Context, comparisonType sql.Type, a, b interface{}) (int, error) {
	if a == nil {
		if b == nil {
			return 0, nil
		} else {
			return -1, nil
		}
	}
	if b == nil {
		return 1, nil
	}
	return comparisonType.Compare(ctx, a, b)
}

func (iter *rangeHeapJoinIter) Len() int { return len(iter.activeRanges) }

func (iter *rangeHeapJoinIter) Less(i, j int) bool {
	lhs := iter.activeRanges[i][iter.rangeHeapPlan.MaxColumnIndex]
	rhs := iter.activeRanges[j][iter.rangeHeapPlan.MaxColumnIndex]
	// compareResult will be 0 if lhs==rhs, -1 if lhs < rhs, and +1 if lhs > rhs.
	compareResult, err := compareNullsFirst(iter.ctx, iter.rangeHeapPlan.ComparisonType, lhs, rhs)
	if iter.err == nil && err != nil {
		iter.err = err
	}
	return compareResult < 0
}

func (iter *rangeHeapJoinIter) Swap(i, j int) {
	iter.activeRanges[i], iter.activeRanges[j] = iter.activeRanges[j], iter.activeRanges[i]
}

func (iter *rangeHeapJoinIter) Push(x any) {
	item := x.(sql.Row)
	iter.activeRanges = append(iter.activeRanges, item)
}

func (iter *rangeHeapJoinIter) Pop() any {
	n := len(iter.activeRanges)
	x := iter.activeRanges[n-1]
	iter.activeRanges = iter.activeRanges[0 : n-1]
	return x
}

func (iter *rangeHeapJoinIter) Peek() interface{} {
	n := len(iter.activeRanges)
	return iter.activeRanges[n-1][iter.rangeHeapPlan.MaxColumnIndex]
}
