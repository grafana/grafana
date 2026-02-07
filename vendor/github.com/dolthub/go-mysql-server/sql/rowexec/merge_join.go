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

package rowexec

import (
	"errors"
	"io"

	"github.com/dolthub/go-mysql-server/sql/plan"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
)

// NewMergeJoin returns a node that performs a presorted merge join on
// two relations. We require 1) the join filter is an equality with disjoint
// join attributes, 2) the free attributes for a relation are a prefix for
// an index that will be used to return sorted rows.
func NewMergeJoin(left, right sql.Node, cond sql.Expression) *plan.JoinNode {
	return plan.NewJoin(left, right, plan.JoinTypeMerge, cond)
}

func NewLeftMergeJoin(left, right sql.Node, cond sql.Expression) *plan.JoinNode {
	return plan.NewJoin(left, right, plan.JoinTypeLeftOuterMerge, cond)
}

func newMergeJoinIter(ctx *sql.Context, b sql.NodeExecBuilder, j *plan.JoinNode, row sql.Row) (sql.RowIter, error) {
	l, err := b.Build(ctx, j.Left(), row)
	if err != nil {
		return nil, err
	}
	r, err := b.Build(ctx, j.Right(), row)
	if err != nil {
		return nil, err
	}

	fullRow := make(sql.Row, len(row)+len(j.Left().Schema())+len(j.Right().Schema()))
	fullRow[0] = row
	if len(row) > 0 {
		copy(fullRow[0:], row[:])
	}

	// a merge join's first filter provides direction information
	// for which iter to update next
	filters := expression.SplitConjunction(j.Filter)
	cmp, ok := filters[0].(expression.Comparer)
	if !ok {
		if equality, ok := filters[0].(expression.Equality); ok {
			cmp, err = equality.ToComparer()
			if err != nil {
				return nil, err
			}
		} else {
			return nil, sql.ErrMergeJoinExpectsComparerFilters.New(filters[0])
		}
	}

	if len(filters) == 0 {
		return nil, sql.ErrNoJoinFilters.New()
	}

	var iter sql.RowIter = &mergeJoinIter{
		left:        l,
		right:       r,
		filters:     filters[1:],
		cmp:         cmp,
		typ:         j.Op,
		fullRow:     fullRow,
		scopeLen:    j.ScopeLen,
		parentLen:   len(row) - j.ScopeLen,
		leftRowLen:  len(j.Left().Schema()),
		rightRowLen: len(j.Right().Schema()),
		isReversed:  j.IsReversed,
	}
	return iter, nil
}

// mergeJoinIter alternates incrementing two RowIters, assuming
// rows will be provided in a sorted order given the join |expr|
// (see sortedIndexScanForTableCol). Extra join |filters| that do
// not provide a directional ordering signal for index iteration
// are evaluated separately.
type mergeJoinIter struct {
	// cmp is a directional indicator for row iter increments
	cmp   expression.Comparer
	left  sql.RowIter
	right sql.RowIter

	// filters is the remaining set of join conditions
	filters []sql.Expression

	// match lookahead buffers and state tracking (private to match)
	rightBuf  []sql.Row
	rightPeek sql.Row
	leftPeek  sql.Row
	fullRow   sql.Row

	bufI        int
	parentLen   int
	leftRowLen  int
	rightRowLen int
	scopeLen    int

	leftDone  bool
	rightDone bool

	// lifecycle maintenance
	init           bool
	leftExhausted  bool
	rightExhausted bool
	// leftMatched indicates whether the current left in |i.fullRow| has satisfied the join condition.
	leftMatched bool
	// matchIncLeft indicates whether the most recent |i.incMatch| call incremented the left row.
	matchIncLeft bool
	// isReversed indicates if this join is over two reversed indexes.
	isReversed bool

	typ plan.JoinType
}

var _ sql.RowIter = (*mergeJoinIter)(nil)

func (i *mergeJoinIter) sel(ctx *sql.Context, row sql.Row) (bool, error) {
	for _, f := range i.filters {
		res, err := sql.EvaluateCondition(ctx, f, row)
		if err != nil {
			return false, err
		}

		if !sql.IsTrue(res) {
			return false, nil
		}
	}
	return true, nil
}

type mergeState uint8

const (
	msInit mergeState = iota
	msExhaustCheck
	msCompare
	msIncLeft
	msIncRight
	msSelect
	msRet
	msRetLeft
	msRejectNull
)

func (i *mergeJoinIter) Next(ctx *sql.Context) (sql.Row, error) {
	var err error
	var ret sql.Row
	var res int

	//  The common inner join match flow:
	//  1) check for io.EOF
	//  2) evaluate compare filter
	//  3) evaluate select filters
	//  4) initialize match state
	//  5) drain match state
	//  6) repeat
	//
	// Left-join matching is unique. At any given time, we need to know whether
	// a unique left row: 1) has already matched, 2) has more right rows
	// available for matching before we can return a nullified-row. Otherwise
	// we may accidentally return nullified rows that have matches (before or
	// after the current row), or fail to return a nullified row that has no
	// matches.
	//
	// We use two variables to manage the lookahead state management.
	// |matchedleft| is a forward-looking indicator of whether the current left
	// row has satisfied a join condition. It is reset to false when we
	// increment left. |matchingleft| is true when the most recent call to
	// |incmatch| incremented the left row. The two vars combined let us
	// lookahead during msSelect to 1) identify proper nullified row matches,
	// and 2) maintain forward-looking state for the next |i.fullrow|.
	//
	nextState := msInit
	for {
		switch nextState {
		case msInit:
			if !i.init {
				err = i.initIters(ctx)
				if err != nil {
					return nil, err
				}
			}
			nextState = msExhaustCheck
		case msExhaustCheck:
			if i.lojFinalize() {
				ret = i.copyReturnRow()
				nextState = msRetLeft
			} else if i.exhausted() {
				return nil, io.EOF
			} else {
				nextState = msCompare
			}
		case msCompare:
			res, err = i.cmp.Compare(ctx, i.fullRow)
			if expression.ErrNilOperand.Is(err) {
				nextState = msRejectNull
				break
			} else if err != nil {
				return nil, err
			}
			// merge join assumes children are sorted in ascending order, so we need to invert the comparison to
			// iterate over descending order.
			if i.isReversed {
				res = -res
			}
			switch {
			case res < 0:
				if i.typ.IsLeftOuter() {
					if i.leftMatched {
						nextState = msIncLeft
					} else {
						ret = i.copyReturnRow()
						nextState = msRetLeft
					}
				} else {
					nextState = msIncLeft
				}
			case res > 0:
				nextState = msIncRight
			case res == 0:
				nextState = msSelect
			}
		case msRejectNull:
			left, _ := i.cmp.Left().Eval(ctx, i.fullRow)
			if left == nil {
				if i.typ.IsLeftOuter() && !i.leftMatched {
					ret = i.copyReturnRow()
					nextState = msRetLeft
				} else {
					nextState = msIncLeft
				}
			} else {
				nextState = msIncRight
			}
		case msIncLeft:
			err = i.incLeft(ctx)
			if err != nil {
				return nil, err
			}
			nextState = msExhaustCheck
		case msIncRight:
			err = i.incRight(ctx)
			if err != nil {
				return nil, err
			}
			nextState = msExhaustCheck
		case msSelect:
			ret = i.copyReturnRow()
			currLeftMatched := i.leftMatched

			ok, err := i.sel(ctx, ret)
			if err != nil {
				return nil, err
			}
			err = i.incMatch(ctx)
			if err != nil {
				return nil, err
			}
			if ok {
				if !i.matchIncLeft {
					// |leftMatched| is forward-looking, sets state for
					// current |i.fullRow| (next |ret|)
					i.leftMatched = true
				}

				nextState = msRet
				break
			}

			if !i.typ.IsLeftOuter() {
				nextState = msExhaustCheck
				break
			}

			if i.matchIncLeft && !currLeftMatched {
				// |i.matchIncLeft| indicates whether the most recent
				// |i.incMatch| call incremented the left row.
				// |currLeftMatched| indicates whether |ret| has already
				// successfully met a join condition.
				return i.removeParentRow(i.nullifyRightRow(ret)), nil
			} else {
				nextState = msExhaustCheck
			}

		case msRet:
			return i.removeParentRow(ret), nil
		case msRetLeft:
			ret = i.removeParentRow(i.nullifyRightRow(ret))
			err = i.incLeft(ctx)
			if err != nil {
				return nil, err
			}
			return ret, nil
		}
	}
}

func (i *mergeJoinIter) copyReturnRow() sql.Row {
	ret := make(sql.Row, len(i.fullRow))
	copy(ret, i.fullRow)
	return ret
}

// incMatch uses two phases to find all left and right rows that match their
// companion rows for the given match stats:
//  1. collect all right rows that match the current left row into a buffer;
//  2. for every left row that matches the original right row, match every
//     right row.
//
// We maintain lookaheads for the first non-matching row in each iter. If
// there is no next non-matching row (io.EOF), we trigger |i.exhausted| at
// the appropriate time depending on whether we are left-joining.
func (i *mergeJoinIter) incMatch(ctx *sql.Context) error {
	i.matchIncLeft = false

	if !i.rightDone {
		// initialize right matches buffer
		right := make(sql.Row, i.rightRowLen)
		copy(right, i.fullRow[i.scopeLen+i.parentLen+i.leftRowLen:])
		i.rightBuf = append(i.rightBuf, right)

		match := true
		var err error
		var peek sql.Row
		for match {
			match, peek, err = i.peekMatch(ctx, i.right)
			if err != nil {
				return err
			} else if match {
				i.rightBuf = append(i.rightBuf, peek)
			} else {
				i.rightPeek = peek
				i.rightDone = true
			}
		}
		// left row 1 and right row 1 is a duplicate of the first match
		// captured in outer closure, slough one iteration
		err = i.incMatch(ctx)
		if err != nil {
			return err
		}

	}

	if i.bufI > len(i.rightBuf)-1 {
		// matched entire right buffer to the current left row, reset
		i.matchIncLeft = true
		i.bufI = 0
		match, peek, err := i.peekMatch(ctx, i.left)
		if err != nil {
			return err
		} else if !match {
			i.leftPeek = peek
			i.leftDone = true
		}
		i.leftMatched = false
	}

	if !i.leftDone {
		// rightBuf has already been validated, we don't need compare
		copySubslice(i.fullRow, i.rightBuf[i.bufI], i.scopeLen+i.parentLen+i.leftRowLen)
		i.bufI++
		return nil
	}

	defer i.resetMatchState()

	if i.leftPeek == nil {
		i.leftExhausted = true
	}
	if i.rightPeek == nil {
		i.rightExhausted = true
	}

	if i.exhausted() {
		if i.lojFinalize() {
			// left joins expect the left row in |i.fullRow| as long
			// as the left iter is not exhausted.
			copySubslice(i.fullRow, i.leftPeek, i.scopeLen+i.parentLen)
		}
		return nil
	}

	// both lookaheads fail the join condition. Drain
	// lookahead rows / increment both iterators.
	i.matchIncLeft = true
	copySubslice(i.fullRow, i.leftPeek, i.scopeLen+i.parentLen)
	copySubslice(i.fullRow, i.rightPeek, i.scopeLen+i.parentLen+i.leftRowLen)

	return nil
}

// lojFinalize is a unique state where we have exhausted the outer iterator,
// but not the inner iterator we are outer joining against.
func (i *mergeJoinIter) lojFinalize() bool {
	return i.rightExhausted && !i.leftExhausted && i.typ.IsLeftOuter()
}

// nullifyRightRow sets the values corresponding to the right row to nil
func (i *mergeJoinIter) nullifyRightRow(r sql.Row) sql.Row {
	for j := i.scopeLen + i.parentLen + i.leftRowLen; j < len(r); j++ {
		r[j] = nil
	}
	return r
}

// initIters populates i.fullRow and clears the match state
func (i *mergeJoinIter) initIters(ctx *sql.Context) error {
	err := i.incLeft(ctx)
	if err != nil {
		return err
	}
	err = i.incRight(ctx)
	if err != nil {
		return err
	}
	i.init = true
	i.resetMatchState()
	return nil
}

// resetMatchState clears the match state variables to zero values
func (i *mergeJoinIter) resetMatchState() {
	i.leftPeek = nil
	i.rightPeek = nil
	i.leftDone = false
	i.rightDone = false
	i.rightBuf = i.rightBuf[:0]
	i.bufI = 0
}

// peekMatch reads the next row from an iterator, attempts to update i.fullRow
// to find a matching condition, rewinding the change in the case of failure.
// We return whether a successful match was found, the lookahead row for saving
// in the case of failure, and an error or nil. If the iterator io.EOFs, we return
// no match, no lookahead row, and no error.
func (i *mergeJoinIter) peekMatch(ctx *sql.Context, iter sql.RowIter) (bool, sql.Row, error) {
	var off int
	var restore sql.Row
	switch iter {
	case i.left:
		off = i.scopeLen + i.parentLen
		restore = make(sql.Row, i.leftRowLen)
		copy(restore, i.fullRow[off:off+i.leftRowLen])
	case i.right:
		off = i.scopeLen + i.parentLen + i.leftRowLen
		restore = make(sql.Row, i.rightRowLen)
		copy(restore, i.fullRow[off:off+i.rightRowLen])
	default:
	}

	// peek lookahead
	peek, err := iter.Next(ctx)
	if errors.Is(err, io.EOF) {
		// io.EOF is the only nil row nil err return
		return false, nil, nil
	} else if err != nil {
		return false, nil, err
	}

	// check if lookahead valid
	copySubslice(i.fullRow, peek, off)
	res, err := i.cmp.Compare(ctx, i.fullRow)
	if expression.ErrNilOperand.Is(err) {
		// revert change to output row if no match
		copySubslice(i.fullRow, restore, off)
	} else if err != nil {
		return false, nil, err
	}
	if res != 0 {
		// revert change to output row if no match
		copySubslice(i.fullRow, restore, off)
	}
	return res == 0, peek, nil
}

// exhausted returns true if either iterator has io.EOF'd
func (i *mergeJoinIter) exhausted() bool {
	return i.leftExhausted || i.rightExhausted
}

// copySubslice copies |src| into |dst| starting at index |off|
func copySubslice(dst, src sql.Row, off int) {
	for i, v := range src {
		dst[off+i] = v
	}
}

// incLeft updates |i.fullRow|'s left row
func (i *mergeJoinIter) incLeft(ctx *sql.Context) error {
	i.leftMatched = false
	var row sql.Row
	var err error
	if i.leftPeek != nil {
		row = i.leftPeek
		i.leftPeek = nil
	} else {
		row, err = i.left.Next(ctx)
		if errors.Is(err, io.EOF) {
			i.leftExhausted = true
			return nil
		} else if err != nil {
			return err
		}
	}

	off := i.scopeLen + i.parentLen
	for j, v := range row {
		i.fullRow[off+j] = v
	}

	return nil
}

// incRight updates |i.fullRow|'s right row
func (i *mergeJoinIter) incRight(ctx *sql.Context) error {
	var row sql.Row
	var err error
	if i.rightPeek != nil {
		row = i.rightPeek
		i.rightPeek = nil
	} else {
		row, err = i.right.Next(ctx)
		if errors.Is(err, io.EOF) {
			i.rightExhausted = true
			return nil
		} else if err != nil {
			return err
		}
	}

	off := i.scopeLen + i.parentLen + i.leftRowLen
	for j, v := range row {
		i.fullRow[off+j] = v
	}

	return nil
}

// incLeft updates |i.fullRow|'s |inRow|
func (i *mergeJoinIter) incIter(ctx *sql.Context, iter sql.RowIter, off int) error {
	row, err := iter.Next(ctx)
	if err != nil {
		return err
	}
	for j, v := range row {
		i.fullRow[off+j] = v
	}
	return nil
}

func (i *mergeJoinIter) removeParentRow(r sql.Row) sql.Row {
	copy(r[i.scopeLen:], r[i.scopeLen+i.parentLen:])
	r = r[:len(r)-i.parentLen]
	return r
}

func (i *mergeJoinIter) Close(ctx *sql.Context) (err error) {
	if i.left != nil {
		err = i.left.Close(ctx)
	}

	if i.right != nil {
		if err == nil {
			err = i.right.Close(ctx)
		} else {
			i.right.Close(ctx)
		}
	}

	return err
}
