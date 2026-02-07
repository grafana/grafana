// Copyright 2024 Dolthub, Inc.
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

package stats

import (
	"container/heap"
	"context"
	"fmt"
	"log"
	"math"
	"time"

	"github.com/pkg/errors"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
)

var ErrJoinStringStatistics = errors.New("joining string histograms is unsupported")

// Join performs an alignment algorithm on two sets of statistics, and
// then pairwise estimates bucket cardinalities by joining most common
// values (mcvs) directly and assuming key uniformity otherwise. Only
// numeric types are supported.
func Join(ctx *sql.Context, s1, s2 sql.Statistic, prefixCnt int, debug bool) (sql.Statistic, error) {
	cmp := func(row1, row2 sql.Row) (int, error) {
		var cmp int
		var err error
		for i := 0; i < prefixCnt; i++ {
			if s1.Types()[i].Equals(s2.Types()[i]) {
				cmp, err = s1.Types()[i].Compare(ctx, row1[i], row2[i])
			} else {
				k1 := row1[i]
				k2, _, err := s1.Types()[i].Convert(ctx, row2[i])
				if err != nil {
					return 0, fmt.Errorf("incompatible types")
				}
				cmp, err = s1.Types()[i].Compare(ctx, k1, k2)
			}
			if err != nil {
				return 0, err
			}
			if cmp == 0 {
				continue
			}
			break
		}
		return cmp, nil
	}

	s1Buckets := s1.Histogram()
	s2Buckets := s2.Histogram()

	s1AliHist, s2AliHist, err := AlignBuckets(s1Buckets, s2Buckets, s1.LowerBound(), s2.LowerBound(), s1.Types()[:prefixCnt], s2.Types()[:prefixCnt], cmp)
	if err != nil {
		return nil, err
	}
	if debug {
		log.Println("left", s1AliHist.DebugString())
		log.Println("right", s2AliHist.DebugString())
	}

	newHist, err := joinAlignedStats(s1AliHist, s2AliHist, cmp)
	ret := NewStatistic(0, 0, 0, s1.AvgSize(), time.Now(), s1.Qualifier(), s1.Columns(), s1.Types(), newHist, s1.IndexClass(), nil)
	return UpdateCounts(ret), nil
}

// joinAlignedStats assumes |left| and |right| have the same number of
// buckets to estimate the join cardinality. Most common values (mcvs) adjust
// the estimates to account for outlier keys that are a disproportionately
// high fraction of the index.
func joinAlignedStats(left, right []sql.HistogramBucket, cmp func(sql.Row, sql.Row) (int, error)) ([]sql.HistogramBucket, error) {
	var newBuckets []sql.HistogramBucket
	for i := range left {
		l := left[i]
		r := right[i]
		lDistinct := float64(l.DistinctCount())
		rDistinct := float64(r.DistinctCount())

		lRows := float64(l.RowCount())
		rRows := float64(r.RowCount())

		var rows uint64

		// mcvs counted in isolation
		// todo: should we assume non-match MCVs in smaller set
		// contribute MCV count * average frequency from the larger?
		var mcvMatch int
		var i, j int
		for i < len(l.Mcvs()) && j < len(r.Mcvs()) {
			v, err := cmp(l.Mcvs()[i], r.Mcvs()[j])
			if err != nil {
				return nil, err
			}
			switch v {
			case 0:
				rows += l.McvCounts()[i] * r.McvCounts()[j]
				lRows -= float64(l.McvCounts()[i])
				rRows -= float64(r.McvCounts()[j])
				lDistinct--
				rDistinct--
				mcvMatch++
				i++
				j++
			case -1:
				i++
			case +1:
				j++
			}
		}

		// true up negative approximations
		lRows = math.Max(lRows, 0)
		rRows = math.Max(rRows, 0)
		lDistinct = math.Max(lDistinct, 0)
		rDistinct = math.Max(rDistinct, 0)

		// Selinger method on rest of buckets
		maxDistinct := math.Max(lDistinct, rDistinct)
		minDistinct := math.Min(lDistinct, rDistinct)

		if maxDistinct > 0 {
			rows += uint64(float64(lRows*rRows) / float64(maxDistinct))
		}

		newBucket := NewHistogramBucket(
			rows,
			uint64(minDistinct)+uint64(mcvMatch), // matched mcvs contribute back to result distinct count
			0,
			l.BoundCount(), l.UpperBound(), nil, nil)
		newBuckets = append(newBuckets, newBucket)
	}
	return newBuckets, nil
}

// AlignBuckets produces two histograms with the same number of buckets.
// Start by using upper bound keys to truncate histogram with a larger
// keyspace. Then for every misaligned pair of buckets, cut the one with the
// higher bound value on the smaller's key. We use a linear interpolation
// to divide keys when splitting.
func AlignBuckets(h1, h2 sql.Histogram, lBound1, lBound2 sql.Row, s1Types, s2Types []sql.Type, cmp func(sql.Row, sql.Row) (int, error)) (sql.Histogram, sql.Histogram, error) {
	var numericTypes bool = true
	for _, t := range s1Types {
		if _, ok := t.(sql.NumberType); !ok {
			numericTypes = false
			break
		}
	}

	if !numericTypes {
		// todo(max): distance between two strings is difficult,
		// but we could cut equal fractions depending on total
		// cuts for a bucket
		return nil, nil, ErrJoinStringStatistics
	}

	var leftRes sql.Histogram
	var rightRes sql.Histogram
	var leftStack sql.Histogram
	var rightStack sql.Histogram
	var nextL sql.HistogramBucket
	var nextR sql.HistogramBucket
	var keyCmp int
	var err error
	var reverse bool

	swap := func() {
		leftStack, rightStack = rightStack, leftStack
		nextL, nextR = nextR, nextL
		leftRes, rightRes = rightRes, leftRes
		h1, h2 = h2, h1
		reverse = !reverse
	}

	var state sjState = sjStateInit
	for state != sjStateEOF {
		switch state {
		case sjStateInit:
			// Merge adjacent overlapping buckets within each histogram.
			// Truncate non-overlapping tail buckets between left and right.
			// Reverse the buckets into stacks.
			s1Hist := h1
			s2Hist := h2

			s1Last := s1Hist[len(s1Hist)-1].UpperBound()
			s2Last := s2Hist[len(s2Hist)-1].UpperBound()
			idx1, err := PrefixLtHist(s1Hist, s2Last, cmp)
			if err != nil {
				return nil, nil, err
			}
			idx2, err := PrefixLtHist(s2Hist, s1Last, cmp)
			if err != nil {
				return nil, nil, err
			}
			if idx1 < len(s1Hist) {
				idx1++
			}
			if idx2 < len(s2Hist) {
				idx2++
			}
			s1Hist = s1Hist[:idx1]
			s2Hist = s2Hist[:idx2]

			if lBound2 != nil {
				idx, err := PrefixGteHist(s1Hist, lBound2, cmp)
				if err != nil {
					return nil, nil, err
				}
				s1Hist = s1Hist[idx:]
			}
			if lBound1 != nil {
				idx, err := PrefixGteHist(s2Hist, lBound1, cmp)
				if err != nil {
					return nil, nil, err
				}
				s2Hist = s2Hist[idx:]
			}

			if len(s1Hist) == 0 || len(s2Hist) == 0 {
				return nil, nil, nil
			}

			if len(s1Hist) == 0 || len(s2Hist) == 0 {
				return nil, nil, nil
			}

			m := len(s1Hist) - 1
			leftStack = make([]sql.HistogramBucket, m)
			for i, b := range s1Hist {
				if i == 0 {
					nextL = b
					continue
				}
				leftStack[m-i] = b
			}

			n := len(s2Hist) - 1
			rightStack = make([]sql.HistogramBucket, n)
			for i, b := range s2Hist {
				if i == 0 {
					nextR = b
					continue
				}
				rightStack[n-i] = b
			}

			state = sjStateCmp

		case sjStateCmp:
			keyCmp, err = cmp(nextL.UpperBound(), nextR.UpperBound())
			if err != nil {
				return nil, nil, err
			}
			switch keyCmp {
			case 0:
				state = sjStateInc
			case 1:
				state = sjStateCutLeft
			case -1:
				state = sjStateCutRight
			}

		case sjStateCutLeft:
			// default cuts left
			state = sjStateCut

		case sjStateCutRight:
			// switch to make left the cut target
			swap()
			state = sjStateCut

		case sjStateCut:
			state = sjStateInc
			// The left bucket is longer than the right bucket.
			// In the default case, we will cut the left bucket on
			// the right boundary, and put the right remainder back
			// on the stack.

			if len(leftRes) == 0 {
				// It is difficult to cut the first bucket because the
				// lower bound is negative infinity. We instead extend the
				// smaller side (right) by stealing form its precedeccors
				// up to the left cutpoint.

				if len(rightStack) == 0 {
					continue
				}

				var peekR sql.HistogramBucket
				for len(rightStack) > 0 {
					// several right buckets might be less than the left cutpoint
					peekR = rightStack[len(rightStack)-1]
					rightStack = rightStack[:len(rightStack)-1]
					keyCmp, err = cmp(peekR.UpperBound(), nextL.UpperBound())
					if err != nil {
						return nil, nil, err
					}
					if keyCmp > 0 {
						break
					}

					nextR = NewHistogramBucket(
						uint64(float64(nextR.RowCount())+float64(peekR.RowCount())),
						uint64(float64(nextR.DistinctCount())+float64(peekR.DistinctCount())),
						uint64(float64(nextR.NullCount())+float64(peekR.NullCount())),
						peekR.BoundCount(), peekR.UpperBound(), peekR.McvCounts(), peekR.Mcvs())
				}

				// nextR < nextL < peekR
				bucketMagnitude, err := euclideanDistance(nextR.UpperBound(), peekR.UpperBound(), len(s1Types))
				if err != nil {
					return nil, nil, err
				}

				if bucketMagnitude == 0 {
					peekR = nil
					continue
				}

				// estimate midpoint
				cutMagnitude, err := euclideanDistance(nextR.UpperBound(), nextL.UpperBound(), len(s1Types))
				if err != nil {
					return nil, nil, err
				}

				cutFrac := cutMagnitude / bucketMagnitude

				// lastL -> nextR
				firstHalf := NewHistogramBucket(
					uint64(float64(nextR.RowCount())+float64(peekR.RowCount())*cutFrac),
					uint64(float64(nextR.DistinctCount())+float64(peekR.DistinctCount())*cutFrac),
					uint64(float64(nextR.NullCount())+float64(peekR.NullCount())*cutFrac),
					1, nextL.UpperBound(), nil, nil)

				// nextR -> nextL
				secondHalf := NewHistogramBucket(
					uint64(float64(peekR.RowCount())*(1-cutFrac)),
					uint64(float64(peekR.DistinctCount())*(1-cutFrac)),
					uint64(float64(peekR.NullCount())*(1-cutFrac)),
					peekR.BoundCount(),
					peekR.UpperBound(),
					peekR.McvCounts(),
					peekR.Mcvs())

				nextR = firstHalf
				rightStack = append(rightStack, secondHalf)
				continue
			}

			// get left "distance"
			bucketMagnitude, err := euclideanDistance(nextL.UpperBound(), leftRes[len(leftRes)-1].UpperBound(), len(s1Types))
			if err != nil {
				return nil, nil, err
			}

			// estimate midpoint
			cutMagnitude, err := euclideanDistance(nextL.UpperBound(), nextR.UpperBound(), len(s1Types))
			if err != nil {
				return nil, nil, err
			}

			cutFrac := cutMagnitude / bucketMagnitude

			// lastL -> nextR
			firstHalf := NewHistogramBucket(
				uint64(float64(nextL.RowCount())*(1-cutFrac)),
				uint64(float64(nextL.DistinctCount())*(1-cutFrac)),
				uint64(float64(nextL.NullCount())*(1-cutFrac)),
				1, nextR.UpperBound(), nil, nil)

			// nextR -> nextL
			secondHalf := NewHistogramBucket(
				uint64(float64(nextL.RowCount())*cutFrac),
				uint64(float64(nextL.DistinctCount())*cutFrac),
				uint64(float64(nextL.NullCount())*cutFrac),
				nextL.BoundCount(),
				nextL.UpperBound(),
				nextL.McvCounts(),
				nextL.Mcvs())

			nextL = firstHalf
			leftStack = append(leftStack, secondHalf)

		case sjStateInc:
			leftRes = append(leftRes, nextL)
			rightRes = append(rightRes, nextR)

			nextL = nil
			nextR = nil

			if len(leftStack) > 0 {
				nextL = leftStack[len(leftStack)-1]
				leftStack = leftStack[:len(leftStack)-1]
			}
			if len(rightStack) > 0 {
				nextR = rightStack[len(rightStack)-1]
				rightStack = rightStack[:len(rightStack)-1]
			}

			state = sjStateCmp

			if nextL == nil || nextR == nil {
				state = sjStateExhaust
			}

		case sjStateExhaust:
			state = sjStateEOF

			if nextL == nil && nextR == nil {
				continue
			}

			if nextL == nil {
				// swap so right side is nil
				swap()
			}

			// squash the trailing buckets into one
			// TODO: cut the left side on the right's final bound when there is >1 left
			leftStack = append(leftStack, nextL)
			nextL = leftRes[len(leftRes)-1]
			leftRes = leftRes[:len(leftRes)-1]
			for len(leftStack) > 0 {
				peekL := leftStack[len(leftStack)-1]
				leftStack = leftStack[:len(leftStack)-1]
				nextL = NewHistogramBucket(
					uint64(float64(nextL.RowCount())+float64(peekL.RowCount())),
					uint64(float64(nextL.DistinctCount())+float64(peekL.DistinctCount())),
					uint64(float64(nextL.NullCount())+float64(peekL.NullCount())),
					peekL.BoundCount(), peekL.UpperBound(), peekL.McvCounts(), peekL.Mcvs())
			}
			leftRes = append(leftRes, nextL)
			nextL = nil

		}
	}

	if reverse {
		leftRes, rightRes = rightRes, leftRes
	}
	return leftRes, rightRes, nil
}

// mergeMcvs combines two sets of most common values, merging the bound keys
// with the same value and keeping the top k of the merge result.
func mergeMcvs(mcvs1, mcvs2 []sql.Row, mcvCnts1, mcvCnts2 []uint64, cmp func(sql.Row, sql.Row) (int, error)) ([]sql.Row, []uint64, error) {
	if len(mcvs1) < len(mcvs2) {
		// mcvs2 is low
		mcvs1, mcvs2 = mcvs2, mcvs1
		mcvCnts1, mcvCnts2 = mcvCnts2, mcvCnts1
	}
	if len(mcvs2) == 0 {
		return mcvs1, mcvCnts1, nil
	}

	ret := NewSqlHeap(len(mcvs2))
	seen := make(map[int]bool)
	for i, row1 := range mcvs1 {
		matched := -1
		for j, row2 := range mcvs2 {
			c, err := cmp(row1, row2)
			if err != nil {
				return nil, nil, err
			}
			if c == 0 {
				matched = j
				break
			}
		}
		if matched > 0 {
			seen[matched] = true
			heap.Push(ret, NewHeapRow(mcvs1[i], int(mcvCnts1[i]+mcvCnts2[matched])))
		} else {
			heap.Push(ret, NewHeapRow(mcvs1[i], int(mcvCnts1[i])))
		}
	}
	for j := range mcvs2 {
		if !seen[j] {
			heap.Push(ret, NewHeapRow(mcvs2[j], int(mcvCnts2[j])))

		}
	}
	return ret.Array(), ret.Counts(), nil
}

type BucketConstructor func(rows, distinct, nulls, boundCnt uint64, bound sql.Row, mcvCnt []uint64, mcv []sql.Row) sql.HistogramBucket

// MergeOverlappingBuckets folds bins with one element into the previous
// bucket when the bound keys match.
func MergeOverlappingBuckets(ctx *sql.Context, h []sql.HistogramBucket, types []sql.Type, newB BucketConstructor) ([]sql.HistogramBucket, error) {
	cmp := func(l, r sql.Row) (int, error) {
		for i := 0; i < len(types); i++ {
			cmp, err := types[i].Compare(ctx, l[i], r[i])
			if err != nil {
				return 0, err
			}
			switch cmp {
			case 0:
				continue
			case -1:
				return -1, nil
			case 1:
				return 1, nil
			}
		}
		return 0, nil
	}
	// |k| is the write position, |i| is the compare position
	// |k| <= |i|
	var ret []sql.HistogramBucket
	i := 0
	k := 0
	for i < len(h) {
		ret = append(ret, h[i])
		i++
		if i >= len(h) {
			k++
			break
		}
		for ; i < len(h) && h[i].DistinctCount() == 1; i++ {
			eq, err := cmp(ret[k].UpperBound(), h[i].UpperBound())
			if err != nil {
				return nil, err
			}
			if eq != 0 {
				break
			}

			ret[k] = newB(
				ret[k].RowCount()+h[i].RowCount(),
				ret[k].DistinctCount(),
				ret[k].NullCount()+h[i].NullCount(),
				ret[k].BoundCount()+h[i].BoundCount(),
				ret[k].UpperBound(),
				ret[k].McvCounts(),
				ret[k].Mcvs())
		}
		k++
	}
	return ret, nil
}

type sjState int8

const (
	sjStateUnknown = iota
	sjStateInit
	sjStateCmp
	sjStateCutLeft
	sjStateCutRight
	sjStateCut
	sjStateInc
	sjStateExhaust
	sjStateEOF
)

// euclideanDistance is a vectorwise sum of squares distance between
// two numeric types.
func euclideanDistance(row1, row2 sql.Row, prefixLen int) (float64, error) {
	// TODO: Add context parameter
	ctx := context.Background()
	var distSq float64
	for i := 0; i < prefixLen; i++ {
		v1, _, err := types.Float64.Convert(ctx, row1[i])
		if err != nil {
			return 0, err
		}
		v2, _, err := types.Float64.Convert(ctx, row2[i])
		if err != nil {
			return 0, err
		}
		f1 := v1.(float64)
		f2 := v2.(float64)
		distSq += f1*f1 - 2*f1*f2 + f2*f2
	}
	return math.Sqrt(distSq), nil
}
