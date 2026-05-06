// Copyright 2022 DoltHub, Inc.
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

package aggregation

import (
	"errors"
	"io"

	ast "github.com/dolthub/vitess/go/vt/sqlparser"
	sqlerr "gopkg.in/src-d/go-errors.v1"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
)

//go:generate go run ../../../../optgen/cmd/optgen/main.go -out window_framer.og.go -pkg aggregation framer window_framer.go

var ErrPartitionNotSet = errors.New("attempted to general a window frame interval before framer partition was set")
var ErrRangeIntervalTypeMismatch = errors.New("range bound type must match the order by expression type")
var ErrRangeInvalidOrderBy = sqlerr.NewKind("a range's order by must be one expression; found: %d")

var _ sql.WindowFramer = (*PartitionFramer)(nil)
var _ sql.WindowFramer = (*GroupByFramer)(nil)
var _ sql.WindowFramer = (*rowFramerBase)(nil)
var _ sql.WindowFramer = (*rangeFramerBase)(nil)
var _ sql.WindowFramer = (*PeerGroupFramer)(nil)

// NewUnboundedPrecedingToCurrentRowFramer generates sql.WindowInterval
// from the first row in a partition to the current row.
//
// Ex: partition = [0, 1, 2, 3, 4, 5]
// =>
// frames: {0,0},   {0,1}, {0,2},   {0,3},     {0,4},     {0,5}
// rows:   [0],     [0,1], [0,1,2], [1,2,3,4], [1,2,3,4], [1,2,3,4,5]
func NewUnboundedPrecedingToCurrentRowFramer() *RowsUnboundedPrecedingToCurrentRowFramer {
	return &RowsUnboundedPrecedingToCurrentRowFramer{
		rowFramerBase{
			unboundedPreceding: true,
			endCurrentRow:      false,
		},
	}
}

type PartitionFramer struct {
	idx                          int
	partitionStart, partitionEnd int

	followOffset, precOffset int
	frameStart, frameEnd     int
	partitionSet             bool
}

func NewPartitionFramer() *PartitionFramer {
	return &PartitionFramer{
		idx:            -1,
		frameEnd:       -1,
		frameStart:     -1,
		partitionStart: -1,
		partitionEnd:   -1,
	}
}

func (f *PartitionFramer) NewFramer(interval sql.WindowInterval) (sql.WindowFramer, error) {
	return &PartitionFramer{
		idx:            interval.Start,
		frameEnd:       interval.End,
		frameStart:     interval.Start,
		partitionStart: interval.Start,
		partitionEnd:   interval.End,
		partitionSet:   true,
	}, nil
}

func (f *PartitionFramer) Next(ctx *sql.Context, buffer sql.WindowBuffer) (sql.WindowInterval, error) {
	if !f.partitionSet {
		return sql.WindowInterval{}, io.EOF
	}
	if f.idx == 0 || (0 < f.idx && f.idx < f.partitionEnd) {
		f.idx++
		return f.Interval()
	}
	return sql.WindowInterval{}, io.EOF
}

func (f *PartitionFramer) FirstIdx() int {
	return f.frameStart
}

func (f *PartitionFramer) LastIdx() int {
	return f.frameEnd
}

func (f *PartitionFramer) Interval() (sql.WindowInterval, error) {
	if !f.partitionSet {
		return sql.WindowInterval{}, ErrPartitionNotSet
	}
	return sql.WindowInterval{Start: f.frameStart, End: f.frameEnd}, nil
}

func (f *PartitionFramer) SlidingInterval(ctx sql.Context) (sql.WindowInterval, sql.WindowInterval, sql.WindowInterval) {
	panic("implement me")
}

func (f *PartitionFramer) Close() {
	panic("implement me")
}

func NewGroupByFramer() *GroupByFramer {
	return &GroupByFramer{
		frameEnd:       -1,
		frameStart:     -1,
		partitionStart: -1,
		partitionEnd:   -1,
	}
}

type GroupByFramer struct {
	partitionStart int
	partitionEnd   int
	frameStart     int
	frameEnd       int
	evaluated      bool
	partitionSet   bool
}

func (f *GroupByFramer) NewFramer(interval sql.WindowInterval) (sql.WindowFramer, error) {
	return &GroupByFramer{
		evaluated:      false,
		frameEnd:       interval.End,
		frameStart:     interval.Start,
		partitionStart: interval.Start,
		partitionEnd:   interval.End,
		partitionSet:   true,
	}, nil
}

func (f *GroupByFramer) Next(ctx *sql.Context, buffer sql.WindowBuffer) (sql.WindowInterval, error) {
	if !f.partitionSet {
		return sql.WindowInterval{}, io.EOF
	}
	if !f.evaluated {
		f.evaluated = true
		return f.Interval()
	}
	return sql.WindowInterval{}, io.EOF
}

func (f *GroupByFramer) FirstIdx() int {
	return f.frameStart
}

func (f *GroupByFramer) LastIdx() int {
	return f.frameEnd
}

func (f *GroupByFramer) Interval() (sql.WindowInterval, error) {
	if !f.partitionSet {
		return sql.WindowInterval{}, ErrPartitionNotSet
	}
	return sql.WindowInterval{Start: f.frameStart, End: f.frameEnd}, nil
}

func (f *GroupByFramer) SlidingInterval(ctx sql.Context) (sql.WindowInterval, sql.WindowInterval, sql.WindowInterval) {
	panic("implement me")
}

// rowFramerBase is a sql.WindowFramer iterator that tracks
// index frames in a sql.WindowBuffer using integer offsets.
// Only a subset of bound conditions will be set for a given
// framer implementation, one start and one end bound.
//
// Ex: startCurrentRow = true; endNFollowing = 1;
// buffer = [0, 1, 2, 3, 4, 5];
// =>
// pos:    0->0   1->1   2->2   3->3   4->4   5->5
// frame:  {0,2}, {1,3}, {2,4}, {3,5}, {4,6}, {4,5}
// rows:   [0,1], [1,2], [2,3], [3,4], [4,5], [5]
type rowFramerBase struct {
	idx             int
	partitionStart  int
	partitionEnd    int
	frameStart      int
	frameEnd        int
	startNPreceding int
	endNPreceding   int
	startNFollowing int
	endNFollowing   int

	// add [startOffset] to current [idx] to find start index
	// is set unless [unboundedPreceding] is true
	startOffset int

	// add [endOffset] to current [idx] to find end index
	// is set unless [unboundedFollowing] is true
	endOffset int

	partitionSet       bool
	unboundedPreceding bool
	unboundedFollowing bool

	// optional start fields; one is set
	startCurrentRow bool

	// optional end fields; one is set
	endCurrentRow bool
}

func (f *rowFramerBase) NewFramer(interval sql.WindowInterval) (sql.WindowFramer, error) {
	var startOffset int
	switch {
	case f.startNPreceding != 0:
		startOffset = -f.startNPreceding
	case f.startNFollowing != 0:
		startOffset = f.startNFollowing
	case f.startCurrentRow:
		startOffset = 0
	}

	var endOffset int
	switch {
	case f.endNPreceding != 0:
		endOffset = -f.endNPreceding
	case f.endNFollowing != 0:
		endOffset = f.endNFollowing
	case f.endCurrentRow:
		endOffset = 0
	}

	return &rowFramerBase{
		idx:            interval.Start,
		partitionStart: interval.Start,
		partitionEnd:   interval.End,
		frameStart:     -1,
		frameEnd:       -1,
		partitionSet:   true,
		// pass through parent state
		unboundedPreceding: f.unboundedPreceding,
		unboundedFollowing: f.unboundedFollowing,
		startCurrentRow:    f.startCurrentRow,
		endCurrentRow:      f.endCurrentRow,
		startNPreceding:    f.startNPreceding,
		startNFollowing:    f.startNFollowing,
		endNPreceding:      f.endNPreceding,
		endNFollowing:      f.endNFollowing,
		// row specific
		startOffset: startOffset,
		endOffset:   endOffset,
	}, nil
}

func (f *rowFramerBase) Next(ctx *sql.Context, buffer sql.WindowBuffer) (sql.WindowInterval, error) {
	if f.idx != 0 && f.idx >= f.partitionEnd || !f.partitionSet {
		return sql.WindowInterval{}, io.EOF
	}

	if f.partitionEnd == 0 {
		return sql.WindowInterval{}, io.EOF
	}

	newStart := f.idx + f.startOffset
	if f.unboundedPreceding || newStart < f.partitionStart {
		newStart = f.partitionStart
	}

	newEnd := f.idx + f.endOffset + 1
	if f.unboundedFollowing || newEnd > f.partitionEnd {
		newEnd = f.partitionEnd
	}

	if newStart > newEnd {
		newStart = newEnd
	}

	f.frameStart = newStart
	f.frameEnd = newEnd

	f.idx++
	return f.Interval()
}

func (f *rowFramerBase) FirstIdx() int {
	return f.frameStart
}

func (f *rowFramerBase) LastIdx() int {
	return f.frameEnd
}

func (f *rowFramerBase) Interval() (sql.WindowInterval, error) {
	if !f.partitionSet {
		return sql.WindowInterval{}, ErrPartitionNotSet
	}
	return sql.WindowInterval{Start: f.frameStart, End: f.frameEnd}, nil
}

// rangeFramerBase is a sql.WindowFramer iterator that tracks
// value ranges in a sql.WindowBuffer using bound
// conditions on the order by [orderBy] column. Only a subset of
// bound conditions will be set for a given framer implementation,
// one start and one end bound.
//
// Ex: startCurrentRow = true; endNFollowing = 2; orderBy = x;
// -> startInclusion = (x), endInclusion = (x+2)
// buffer = [0, 1, 2, 4, 4, 5];
// =>
// pos:    0->0     1->1   2->2   3->4     4->4     5->5
// frame:  {0,3},   {1,3}, {2,3}, {3,5},   {3,5},   {4,5}
// rows:   [0,1,2], [1,2], [2],   [4,4,5], [4,4,5], [5]
type rangeFramerBase struct {
	startNFollowing sql.Expression // optional
	endNFollowing   sql.Expression // optional
	startNPreceding sql.Expression // optional
	endNPreceding   sql.Expression // optional
	// boundary arithmetic on [orderBy] for range start value
	// is set unless [unboundedPreceding] is true
	startInclusion sql.Expression
	// boundary arithmetic on [orderBy] for range end value
	// is set unless [unboundedFollowing] is true
	endInclusion sql.Expression
	// reference expression for boundary calculation
	orderBy sql.Expression

	idx                int
	partitionStart     int
	partitionEnd       int
	frameStart         int  // optional
	frameEnd           int  // optional
	startCurrentRow    bool // optional
	endCurrentRow      bool // optional
	unboundedFollowing bool // optional
	unboundedPreceding bool // optional
	partitionSet       bool
}

func (f *rangeFramerBase) NewFramer(interval sql.WindowInterval) (sql.WindowFramer, error) {
	var startInclusion sql.Expression
	switch {
	case f.startCurrentRow:
		startInclusion = f.orderBy
	case f.startNPreceding != nil:
		startInclusion = expression.NewArithmetic(f.orderBy, f.startNPreceding, ast.MinusStr)
	case f.startNFollowing != nil:
		startInclusion = expression.NewArithmetic(f.orderBy, f.startNFollowing, ast.PlusStr)
	}

	// TODO: how to validate datetime, interval pair when they aren't type comparable
	//if startInclusion != nil && startInclusion.Type().Promote()  != f.orderBy.Type().Promote() {
	//	return nil, ErrRangeIntervalTypeMismatch
	//}

	var endInclusion sql.Expression
	switch {
	case f.endCurrentRow:
		endInclusion = f.orderBy
	case f.endNPreceding != nil:
		endInclusion = expression.NewArithmetic(f.orderBy, f.endNPreceding, ast.MinusStr)
	case f.endNFollowing != nil:
		endInclusion = expression.NewArithmetic(f.orderBy, f.endNFollowing, ast.PlusStr)
	}

	// TODO: how to validate datetime, interval pair when they aren't type comparable
	//if endInclusion != nil && endInclusion.Type().Promote() != f.orderBy.Type().Promote() {
	//	return nil, ErrRangeIntervalTypeMismatch
	//}

	return &rangeFramerBase{
		idx:            interval.Start,
		partitionStart: interval.Start,
		partitionEnd:   interval.End,
		frameStart:     interval.Start,
		frameEnd:       interval.Start,
		partitionSet:   true,
		// pass through parent state
		unboundedPreceding: f.unboundedPreceding,
		unboundedFollowing: f.unboundedFollowing,
		startCurrentRow:    f.startCurrentRow,
		endCurrentRow:      f.endCurrentRow,
		startNPreceding:    f.startNPreceding,
		startNFollowing:    f.startNFollowing,
		endNPreceding:      f.endNPreceding,
		endNFollowing:      f.endNFollowing,
		// range specific
		orderBy:        f.orderBy,
		startInclusion: startInclusion,
		endInclusion:   endInclusion,
	}, nil
}

func (f *rangeFramerBase) Next(ctx *sql.Context, buf sql.WindowBuffer) (sql.WindowInterval, error) {
	if f.idx != 0 && f.idx >= f.partitionEnd || !f.partitionSet {
		return sql.WindowInterval{}, io.EOF
	}

	var err error
	newStart := f.frameStart
	switch {
	case newStart < f.partitionStart, f.unboundedPreceding, f.startCurrentRow && f.orderBy == nil:
		// Start the frame at the partition start for unbounded preceding, or for current row when no order by clause
		// has been specified. From the MySQL docs, when an order by clause is not specified with range framing, the
		// default frame includes all rows, since all rows in the current partition are peers when no order has been
		// specified.
		newStart = f.partitionStart
	default:
		newStart, err = findInclusionBoundary(ctx, f.idx, newStart, f.partitionEnd, f.startInclusion, f.orderBy, buf, greaterThanOrEqual)
		if err != nil {
			return sql.WindowInterval{}, err
		}
	}

	newEnd := f.frameEnd
	if newStart > newEnd {
		newEnd = newStart
	}
	switch {
	case newEnd > f.partitionEnd, f.unboundedFollowing, f.endCurrentRow && f.orderBy == nil:
		newEnd = f.partitionEnd
	default:
		newEnd, err = findInclusionBoundary(ctx, f.idx, newEnd, f.partitionEnd, f.endInclusion, f.orderBy, buf, greaterThan)
		if err != nil {
			return sql.WindowInterval{}, err
		}
	}

	f.idx++
	f.frameStart = newStart
	f.frameEnd = newEnd
	return f.Interval()
}

type stopCond int

const (
	unknown            = -2
	greaterThan        = 1
	greaterThanOrEqual = 0
)

// findInclusionBoundary searches a sorted [buffer] for the last index satisfying
// the comparison: [inclusion] [stopCond] [expr]. For example, (x+2) > (x).
// [expr] is evaluated at the current row, [inclusion] is evaluated on the boundary
// candidate. This is used as a sliding window algorithm for value ranges.
func findInclusionBoundary(ctx *sql.Context, pos, searchStart, partitionEnd int, inclusion, expr sql.Expression, buf sql.WindowBuffer, stopCond stopCond) (int, error) {
	cur, err := inclusion.Eval(ctx, buf[pos])
	if err != nil {
		return 0, err
	}

	i := searchStart
	cmp := unknown
	for ; cmp < int(stopCond); i++ {
		if i >= partitionEnd {
			return i, nil
		}

		res, err := expr.Eval(ctx, buf[i])
		if err != nil {
			return 0, err
		}

		cmp, err = expr.Type().Compare(ctx, res, cur)
		if err != nil {
			return 0, err
		}
	}

	return i - 1, nil
}

func (f *rangeFramerBase) FirstIdx() int {
	return f.frameStart
}

func (f *rangeFramerBase) LastIdx() int {
	return f.frameEnd
}

func (f *rangeFramerBase) Interval() (sql.WindowInterval, error) {
	if !f.partitionSet {
		return sql.WindowInterval{}, ErrPartitionNotSet
	}
	return sql.WindowInterval{Start: f.frameStart, End: f.frameEnd}, nil
}

type PeerGroupFramer struct {
	orderBy        []sql.Expression
	idx            int
	partitionStart int
	partitionEnd   int
	frameStart     int
	frameEnd       int
	partitionSet   bool
}

func NewPeerGroupFramer(orderBy []sql.Expression) *PeerGroupFramer {
	return &PeerGroupFramer{
		frameEnd:       -1,
		frameStart:     -1,
		partitionStart: -1,
		partitionEnd:   -1,
		orderBy:        orderBy,
	}
}

func (f *PeerGroupFramer) NewFramer(interval sql.WindowInterval) (sql.WindowFramer, error) {
	return &PeerGroupFramer{
		idx:            interval.Start,
		partitionStart: interval.Start,
		partitionEnd:   interval.End,
		frameStart:     interval.Start,
		frameEnd:       interval.Start,
		partitionSet:   true,
		orderBy:        f.orderBy,
	}, nil
}

func (f *PeerGroupFramer) Next(ctx *sql.Context, buf sql.WindowBuffer) (sql.WindowInterval, error) {
	if f.idx != 0 && f.idx >= f.partitionEnd || !f.partitionSet {
		return sql.WindowInterval{}, io.EOF
	}
	if f.idx >= f.frameEnd {
		peerGroup, err := nextPeerGroup(ctx, f.idx, f.partitionEnd, f.orderBy, buf)
		if err != nil {
			return sql.WindowInterval{}, err
		}
		f.frameStart = peerGroup.Start
		f.frameEnd = peerGroup.End
	}
	f.idx++
	return f.Interval()
}

func (f *PeerGroupFramer) FirstIdx() int {
	return f.frameStart
}

func (f *PeerGroupFramer) LastIdx() int {
	return f.frameEnd
}

func (f *PeerGroupFramer) Interval() (sql.WindowInterval, error) {
	if !f.partitionSet {
		return sql.WindowInterval{}, ErrPartitionNotSet
	}
	return sql.WindowInterval{Start: f.frameStart, End: f.frameEnd}, nil
}

// nextPeerGroup scans for a sql.WindowInterval of rows with the same value as
// the current row [a.pos]. This is equivalent to a partitioning algorithm, but
// we are using the OrderBy fields, and we stream the results.
// ex: [1, 2, 2, 2, 2, 3, 3, 4, 5, 5, 6] => {0,1}, {1,5}, {5,7}, {8,9}, {9,10}
func nextPeerGroup(ctx *sql.Context, pos, partitionEnd int, orderBy []sql.Expression, buffer sql.WindowBuffer) (sql.WindowInterval, error) {
	if pos >= partitionEnd || pos > len(buffer) {
		return sql.WindowInterval{}, nil
	}
	var row sql.Row
	i := pos + 1
	last := buffer[pos]
	for i < partitionEnd {
		row = buffer[i]
		if newPeerGroup, err := isNewOrderByValue(ctx, orderBy, last, row); err != nil {
			return sql.WindowInterval{}, err
		} else if newPeerGroup {
			break
		}
		i++
		last = row
	}
	return sql.WindowInterval{Start: pos, End: i}, nil
}

// isNewOrderByValue compares the order by columns between two rows, returning true when the last row is null or
// when the next row's orderBy columns are unique
func isNewOrderByValue(ctx *sql.Context, orderByExprs []sql.Expression, last sql.Row, row sql.Row) (bool, error) {
	if len(last) == 0 {
		return true, nil
	}

	lastExp, _, err := evalExprs(ctx, orderByExprs, last)
	if err != nil {
		return false, err
	}

	thisExp, _, err := evalExprs(ctx, orderByExprs, row)
	if err != nil {
		return false, err
	}

	for i := range lastExp {
		compare, err := orderByExprs[i].Type().Compare(ctx, lastExp[i], thisExp[i])
		if err != nil {
			return false, err
		}
		if compare != 0 {
			return true, nil
		}
	}

	return false, nil
}
