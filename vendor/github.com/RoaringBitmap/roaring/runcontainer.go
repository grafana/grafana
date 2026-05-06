package roaring

//
// Copyright (c) 2016 by the roaring authors.
// Licensed under the Apache License, Version 2.0.
//
// We derive a few lines of code from the sort.Search
// function in the golang standard library. That function
// is Copyright 2009 The Go Authors, and licensed
// under the following BSD-style license.
/*
Copyright (c) 2009 The Go Authors. All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are
met:

   * Redistributions of source code must retain the above copyright
notice, this list of conditions and the following disclaimer.
   * Redistributions in binary form must reproduce the above
copyright notice, this list of conditions and the following disclaimer
in the documentation and/or other materials provided with the
distribution.
   * Neither the name of Google Inc. nor the names of its
contributors may be used to endorse or promote products derived from
this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
"AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

import (
	"fmt"
	"sort"
	"unsafe"
)

// runContainer16 does run-length encoding of sets of
// uint16 integers.
type runContainer16 struct {
	// iv is a slice of sorted, non-overlapping, non-adjacent intervals.
	iv []interval16
}

// interval16 is the internal to runContainer16
// structure that maintains the individual [start, last]
// closed intervals.
type interval16 struct {
	start  uint16
	length uint16 // length minus 1
}

func newInterval16Range(start, last uint16) interval16 {
	if last < start {
		panic(fmt.Sprintf("last (%d) cannot be smaller than start (%d)", last, start))
	}

	return interval16{
		start,
		last - start,
	}
}

// runlen returns the count of integers in the interval.
func (iv interval16) runlen() int {
	return int(iv.length) + 1
}

func (iv interval16) last() uint16 {
	return iv.start + iv.length
}

// String produces a human viewable string of the contents.
func (iv interval16) String() string {
	return fmt.Sprintf("[%d, %d]", iv.start, iv.length)
}

func ivalString16(iv []interval16) string {
	var s string
	var j int
	var p interval16
	for j, p = range iv {
		s += fmt.Sprintf("%v:[%d, %d], ", j, p.start, p.last())
	}
	return s
}

// String produces a human viewable string of the contents.
func (rc *runContainer16) String() string {
	if len(rc.iv) == 0 {
		return "runContainer16{}"
	}
	is := ivalString16(rc.iv)
	return `runContainer16{` + is + `}`
}

// uint16Slice is a sort.Sort convenience method
type uint16Slice []uint16

// Len returns the length of p.
func (p uint16Slice) Len() int { return len(p) }

// Less returns p[i] < p[j]
func (p uint16Slice) Less(i, j int) bool { return p[i] < p[j] }

// Swap swaps elements i and j.
func (p uint16Slice) Swap(i, j int) { p[i], p[j] = p[j], p[i] }

// addHelper helps build a runContainer16.
type addHelper16 struct {
	runstart      uint16
	runlen        uint16
	actuallyAdded uint16
	m             []interval16
	rc            *runContainer16
}

func (ah *addHelper16) storeIval(runstart, runlen uint16) {
	mi := interval16{start: runstart, length: runlen}
	ah.m = append(ah.m, mi)
}

func (ah *addHelper16) add(cur, prev uint16, i int) {
	if cur == prev+1 {
		ah.runlen++
		ah.actuallyAdded++
	} else {
		if cur < prev {
			panic(fmt.Sprintf("newRunContainer16FromVals sees "+
				"unsorted vals; vals[%v]=cur=%v < prev=%v. Sort your vals"+
				" before calling us with alreadySorted == true.", i, cur, prev))
		}
		if cur == prev {
			// ignore duplicates
		} else {
			ah.actuallyAdded++
			ah.storeIval(ah.runstart, ah.runlen)
			ah.runstart = cur
			ah.runlen = 0
		}
	}
}

// newRunContainerRange makes a new container made of just the specified closed interval [rangestart,rangelast]
func newRunContainer16Range(rangestart uint16, rangelast uint16) *runContainer16 {
	rc := &runContainer16{}
	rc.iv = append(rc.iv, newInterval16Range(rangestart, rangelast))
	return rc
}

// newRunContainer16FromVals makes a new container from vals.
//
// For efficiency, vals should be sorted in ascending order.
// Ideally vals should not contain duplicates, but we detect and
// ignore them. If vals is already sorted in ascending order, then
// pass alreadySorted = true. Otherwise, for !alreadySorted,
// we will sort vals before creating a runContainer16 of them.
// We sort the original vals, so this will change what the
// caller sees in vals as a side effect.
func newRunContainer16FromVals(alreadySorted bool, vals ...uint16) *runContainer16 {
	// keep this in sync with newRunContainer16FromArray below

	rc := &runContainer16{}
	ah := addHelper16{rc: rc}

	if !alreadySorted {
		sort.Sort(uint16Slice(vals))
	}
	n := len(vals)
	var cur, prev uint16
	switch {
	case n == 0:
		// nothing more
	case n == 1:
		ah.m = append(ah.m, newInterval16Range(vals[0], vals[0]))
		ah.actuallyAdded++
	default:
		ah.runstart = vals[0]
		ah.actuallyAdded++
		for i := 1; i < n; i++ {
			prev = vals[i-1]
			cur = vals[i]
			ah.add(cur, prev, i)
		}
		ah.storeIval(ah.runstart, ah.runlen)
	}
	rc.iv = ah.m
	return rc
}

// newRunContainer16FromBitmapContainer makes a new run container from bc,
// somewhat efficiently. For reference, see the Java
// https://github.com/RoaringBitmap/RoaringBitmap/blob/master/src/main/java/org/roaringbitmap/RunContainer.java#L145-L192
func newRunContainer16FromBitmapContainer(bc *bitmapContainer) *runContainer16 {

	rc := &runContainer16{}
	nbrRuns := bc.numberOfRuns()
	if nbrRuns == 0 {
		return rc
	}
	rc.iv = make([]interval16, nbrRuns)

	longCtr := 0            // index of current long in bitmap
	curWord := bc.bitmap[0] // its value
	runCount := 0
	for {
		// potentially multiword advance to first 1 bit
		for curWord == 0 && longCtr < len(bc.bitmap)-1 {
			longCtr++
			curWord = bc.bitmap[longCtr]
		}

		if curWord == 0 {
			// wrap up, no more runs
			return rc
		}
		localRunStart := countTrailingZeros(curWord)
		runStart := localRunStart + 64*longCtr
		// stuff 1s into number's LSBs
		curWordWith1s := curWord | (curWord - 1)

		// find the next 0, potentially in a later word
		runEnd := 0
		for curWordWith1s == maxWord && longCtr < len(bc.bitmap)-1 {
			longCtr++
			curWordWith1s = bc.bitmap[longCtr]
		}

		if curWordWith1s == maxWord {
			// a final unterminated run of 1s
			runEnd = wordSizeInBits + longCtr*64
			rc.iv[runCount].start = uint16(runStart)
			rc.iv[runCount].length = uint16(runEnd) - uint16(runStart) - 1
			return rc
		}
		localRunEnd := countTrailingZeros(^curWordWith1s)
		runEnd = localRunEnd + longCtr*64
		rc.iv[runCount].start = uint16(runStart)
		rc.iv[runCount].length = uint16(runEnd) - 1 - uint16(runStart)
		runCount++
		// now, zero out everything right of runEnd.
		curWord = curWordWith1s & (curWordWith1s + 1)
		// We've lathered and rinsed, so repeat...
	}

}

// newRunContainer16FromArray populates a new
// runContainer16 from the contents of arr.
func newRunContainer16FromArray(arr *arrayContainer) *runContainer16 {
	// keep this in sync with newRunContainer16FromVals above

	rc := &runContainer16{}
	ah := addHelper16{rc: rc}

	n := arr.getCardinality()
	var cur, prev uint16
	switch {
	case n == 0:
		// nothing more
	case n == 1:
		ah.m = append(ah.m, newInterval16Range(arr.content[0], arr.content[0]))
		ah.actuallyAdded++
	default:
		ah.runstart = arr.content[0]
		ah.actuallyAdded++
		for i := 1; i < n; i++ {
			prev = arr.content[i-1]
			cur = arr.content[i]
			ah.add(cur, prev, i)
		}
		ah.storeIval(ah.runstart, ah.runlen)
	}
	rc.iv = ah.m
	return rc
}

// set adds the integers in vals to the set. Vals
// must be sorted in increasing order; if not, you should set
// alreadySorted to false, and we will sort them in place for you.
// (Be aware of this side effect -- it will affect the callers
// view of vals).
//
// If you have a small number of additions to an already
// big runContainer16, calling Add() may be faster.
func (rc *runContainer16) set(alreadySorted bool, vals ...uint16) {

	rc2 := newRunContainer16FromVals(alreadySorted, vals...)
	un := rc.union(rc2)
	rc.iv = un.iv
}

// canMerge returns true iff the intervals
// a and b either overlap or they are
// contiguous and so can be merged into
// a single interval.
func canMerge16(a, b interval16) bool {
	if int(a.last())+1 < int(b.start) {
		return false
	}
	return int(b.last())+1 >= int(a.start)
}

// haveOverlap differs from canMerge in that
// it tells you if the intersection of a
// and b would contain an element (otherwise
// it would be the empty set, and we return
// false).
func haveOverlap16(a, b interval16) bool {
	if int(a.last())+1 <= int(b.start) {
		return false
	}
	return int(b.last())+1 > int(a.start)
}

// mergeInterval16s joins a and b into a
// new interval, and panics if it cannot.
func mergeInterval16s(a, b interval16) (res interval16) {
	if !canMerge16(a, b) {
		panic(fmt.Sprintf("cannot merge %#v and %#v", a, b))
	}

	if b.start < a.start {
		res.start = b.start
	} else {
		res.start = a.start
	}

	if b.last() > a.last() {
		res.length = b.last() - res.start
	} else {
		res.length = a.last() - res.start
	}

	return
}

// intersectInterval16s returns the intersection
// of a and b. The isEmpty flag will be true if
// a and b were disjoint.
func intersectInterval16s(a, b interval16) (res interval16, isEmpty bool) {
	if !haveOverlap16(a, b) {
		isEmpty = true
		return
	}
	if b.start > a.start {
		res.start = b.start
	} else {
		res.start = a.start
	}

	bEnd := b.last()
	aEnd := a.last()
	var resEnd uint16

	if bEnd < aEnd {
		resEnd = bEnd
	} else {
		resEnd = aEnd
	}
	res.length = resEnd - res.start
	return
}

// union merges two runContainer16s, producing
// a new runContainer16 with the union of rc and b.
func (rc *runContainer16) union(b *runContainer16) *runContainer16 {

	// rc is also known as 'a' here, but golint insisted we
	// call it rc for consistency with the rest of the methods.

	var m []interval16

	alim := int(len(rc.iv))
	blim := int(len(b.iv))

	var na int // next from a
	var nb int // next from b

	// merged holds the current merge output, which might
	// get additional merges before being appended to m.
	var merged interval16
	var mergedUsed bool // is merged being used at the moment?

	var cura interval16 // currently considering this interval16 from a
	var curb interval16 // currently considering this interval16 from b

	pass := 0
	for na < alim && nb < blim {
		pass++
		cura = rc.iv[na]
		curb = b.iv[nb]

		if mergedUsed {
			mergedUpdated := false
			if canMerge16(cura, merged) {
				merged = mergeInterval16s(cura, merged)
				na = rc.indexOfIntervalAtOrAfter(int(merged.last())+1, na+1)
				mergedUpdated = true
			}
			if canMerge16(curb, merged) {
				merged = mergeInterval16s(curb, merged)
				nb = b.indexOfIntervalAtOrAfter(int(merged.last())+1, nb+1)
				mergedUpdated = true
			}
			if !mergedUpdated {
				// we know that merged is disjoint from cura and curb
				m = append(m, merged)
				mergedUsed = false
			}
			continue

		} else {
			// !mergedUsed
			if !canMerge16(cura, curb) {
				if cura.start < curb.start {
					m = append(m, cura)
					na++
				} else {
					m = append(m, curb)
					nb++
				}
			} else {
				merged = mergeInterval16s(cura, curb)
				mergedUsed = true
				na = rc.indexOfIntervalAtOrAfter(int(merged.last())+1, na+1)
				nb = b.indexOfIntervalAtOrAfter(int(merged.last())+1, nb+1)
			}
		}
	}
	var aDone, bDone bool
	if na >= alim {
		aDone = true
	}
	if nb >= blim {
		bDone = true
	}
	// finish by merging anything remaining into merged we can:
	if mergedUsed {
		if !aDone {
		aAdds:
			for na < alim {
				cura = rc.iv[na]
				if canMerge16(cura, merged) {
					merged = mergeInterval16s(cura, merged)
					na = rc.indexOfIntervalAtOrAfter(int(merged.last())+1, na+1)
				} else {
					break aAdds
				}
			}

		}

		if !bDone {
		bAdds:
			for nb < blim {
				curb = b.iv[nb]
				if canMerge16(curb, merged) {
					merged = mergeInterval16s(curb, merged)
					nb = b.indexOfIntervalAtOrAfter(int(merged.last())+1, nb+1)
				} else {
					break bAdds
				}
			}

		}

		m = append(m, merged)
	}
	if na < alim {
		m = append(m, rc.iv[na:]...)
	}
	if nb < blim {
		m = append(m, b.iv[nb:]...)
	}

	res := &runContainer16{iv: m}
	return res
}

// unionCardinality returns the cardinality of the merger of two runContainer16s,  the union of rc and b.
func (rc *runContainer16) unionCardinality(b *runContainer16) uint {

	// rc is also known as 'a' here, but golint insisted we
	// call it rc for consistency with the rest of the methods.
	answer := uint(0)

	alim := int(len(rc.iv))
	blim := int(len(b.iv))

	var na int // next from a
	var nb int // next from b

	// merged holds the current merge output, which might
	// get additional merges before being appended to m.
	var merged interval16
	var mergedUsed bool // is merged being used at the moment?

	var cura interval16 // currently considering this interval16 from a
	var curb interval16 // currently considering this interval16 from b

	pass := 0
	for na < alim && nb < blim {
		pass++
		cura = rc.iv[na]
		curb = b.iv[nb]

		if mergedUsed {
			mergedUpdated := false
			if canMerge16(cura, merged) {
				merged = mergeInterval16s(cura, merged)
				na = rc.indexOfIntervalAtOrAfter(int(merged.last())+1, na+1)
				mergedUpdated = true
			}
			if canMerge16(curb, merged) {
				merged = mergeInterval16s(curb, merged)
				nb = b.indexOfIntervalAtOrAfter(int(merged.last())+1, nb+1)
				mergedUpdated = true
			}
			if !mergedUpdated {
				// we know that merged is disjoint from cura and curb
				//m = append(m, merged)
				answer += uint(merged.last()) - uint(merged.start) + 1
				mergedUsed = false
			}
			continue

		} else {
			// !mergedUsed
			if !canMerge16(cura, curb) {
				if cura.start < curb.start {
					answer += uint(cura.last()) - uint(cura.start) + 1
					//m = append(m, cura)
					na++
				} else {
					answer += uint(curb.last()) - uint(curb.start) + 1
					//m = append(m, curb)
					nb++
				}
			} else {
				merged = mergeInterval16s(cura, curb)
				mergedUsed = true
				na = rc.indexOfIntervalAtOrAfter(int(merged.last())+1, na+1)
				nb = b.indexOfIntervalAtOrAfter(int(merged.last())+1, nb+1)
			}
		}
	}
	var aDone, bDone bool
	if na >= alim {
		aDone = true
	}
	if nb >= blim {
		bDone = true
	}
	// finish by merging anything remaining into merged we can:
	if mergedUsed {
		if !aDone {
		aAdds:
			for na < alim {
				cura = rc.iv[na]
				if canMerge16(cura, merged) {
					merged = mergeInterval16s(cura, merged)
					na = rc.indexOfIntervalAtOrAfter(int(merged.last())+1, na+1)
				} else {
					break aAdds
				}
			}

		}

		if !bDone {
		bAdds:
			for nb < blim {
				curb = b.iv[nb]
				if canMerge16(curb, merged) {
					merged = mergeInterval16s(curb, merged)
					nb = b.indexOfIntervalAtOrAfter(int(merged.last())+1, nb+1)
				} else {
					break bAdds
				}
			}

		}

		//m = append(m, merged)
		answer += uint(merged.last()) - uint(merged.start) + 1
	}
	for _, r := range rc.iv[na:] {
		answer += uint(r.last()) - uint(r.start) + 1
	}
	for _, r := range b.iv[nb:] {
		answer += uint(r.last()) - uint(r.start) + 1
	}
	return answer
}

// indexOfIntervalAtOrAfter is a helper for union.
func (rc *runContainer16) indexOfIntervalAtOrAfter(key int, startIndex int) int {
	w, already, _ := rc.searchRange(key, startIndex, 0)
	if already {
		return w
	}
	return w + 1
}

// intersect returns a new runContainer16 holding the
// intersection of rc (also known as 'a')  and b.
func (rc *runContainer16) intersect(b *runContainer16) *runContainer16 {

	a := rc
	numa := int(len(a.iv))
	numb := int(len(b.iv))
	res := &runContainer16{}
	if numa == 0 || numb == 0 {
		return res
	}

	if numa == 1 && numb == 1 {
		if !haveOverlap16(a.iv[0], b.iv[0]) {
			return res
		}
	}

	var output []interval16

	var acuri int
	var bcuri int

	astart := int(a.iv[acuri].start)
	bstart := int(b.iv[bcuri].start)

	var intersection interval16
	var leftoverstart int
	var isOverlap, isLeftoverA, isLeftoverB bool
	var done bool
toploop:
	for acuri < numa && bcuri < numb {

		isOverlap, isLeftoverA, isLeftoverB, leftoverstart, intersection =
			intersectWithLeftover16(astart, int(a.iv[acuri].last()), bstart, int(b.iv[bcuri].last()))

		if !isOverlap {
			switch {
			case astart < bstart:
				acuri, done = a.findNextIntervalThatIntersectsStartingFrom(acuri+1, bstart)
				if done {
					break toploop
				}
				astart = int(a.iv[acuri].start)

			case astart > bstart:
				bcuri, done = b.findNextIntervalThatIntersectsStartingFrom(bcuri+1, astart)
				if done {
					break toploop
				}
				bstart = int(b.iv[bcuri].start)
			}

		} else {
			// isOverlap
			output = append(output, intersection)
			switch {
			case isLeftoverA:
				// note that we change astart without advancing acuri,
				// since we need to capture any 2ndary intersections with a.iv[acuri]
				astart = leftoverstart
				bcuri++
				if bcuri >= numb {
					break toploop
				}
				bstart = int(b.iv[bcuri].start)
			case isLeftoverB:
				// note that we change bstart without advancing bcuri,
				// since we need to capture any 2ndary intersections with b.iv[bcuri]
				bstart = leftoverstart
				acuri++
				if acuri >= numa {
					break toploop
				}
				astart = int(a.iv[acuri].start)
			default:
				// neither had leftover, both completely consumed

				// advance to next a interval
				acuri++
				if acuri >= numa {
					break toploop
				}
				astart = int(a.iv[acuri].start)

				// advance to next b interval
				bcuri++
				if bcuri >= numb {
					break toploop
				}
				bstart = int(b.iv[bcuri].start)
			}
		}
	} // end for toploop

	if len(output) == 0 {
		return res
	}

	res.iv = output
	return res
}

// intersectCardinality returns the cardinality of  the
// intersection of rc (also known as 'a')  and b.
func (rc *runContainer16) intersectCardinality(b *runContainer16) int {
	answer := int(0)

	a := rc
	numa := int(len(a.iv))
	numb := int(len(b.iv))
	if numa == 0 || numb == 0 {
		return 0
	}

	if numa == 1 && numb == 1 {
		if !haveOverlap16(a.iv[0], b.iv[0]) {
			return 0
		}
	}

	var acuri int
	var bcuri int

	astart := int(a.iv[acuri].start)
	bstart := int(b.iv[bcuri].start)

	var intersection interval16
	var leftoverstart int
	var isOverlap, isLeftoverA, isLeftoverB bool
	var done bool
	pass := 0
toploop:
	for acuri < numa && bcuri < numb {
		pass++

		isOverlap, isLeftoverA, isLeftoverB, leftoverstart, intersection =
			intersectWithLeftover16(astart, int(a.iv[acuri].last()), bstart, int(b.iv[bcuri].last()))

		if !isOverlap {
			switch {
			case astart < bstart:
				acuri, done = a.findNextIntervalThatIntersectsStartingFrom(acuri+1, bstart)
				if done {
					break toploop
				}
				astart = int(a.iv[acuri].start)

			case astart > bstart:
				bcuri, done = b.findNextIntervalThatIntersectsStartingFrom(bcuri+1, astart)
				if done {
					break toploop
				}
				bstart = int(b.iv[bcuri].start)
			}

		} else {
			// isOverlap
			answer += int(intersection.last()) - int(intersection.start) + 1
			switch {
			case isLeftoverA:
				// note that we change astart without advancing acuri,
				// since we need to capture any 2ndary intersections with a.iv[acuri]
				astart = leftoverstart
				bcuri++
				if bcuri >= numb {
					break toploop
				}
				bstart = int(b.iv[bcuri].start)
			case isLeftoverB:
				// note that we change bstart without advancing bcuri,
				// since we need to capture any 2ndary intersections with b.iv[bcuri]
				bstart = leftoverstart
				acuri++
				if acuri >= numa {
					break toploop
				}
				astart = int(a.iv[acuri].start)
			default:
				// neither had leftover, both completely consumed

				// advance to next a interval
				acuri++
				if acuri >= numa {
					break toploop
				}
				astart = int(a.iv[acuri].start)

				// advance to next b interval
				bcuri++
				if bcuri >= numb {
					break toploop
				}
				bstart = int(b.iv[bcuri].start)
			}
		}
	} // end for toploop

	return answer
}

// get returns true iff key is in the container.
func (rc *runContainer16) contains(key uint16) bool {
	_, in, _ := rc.search(int(key))
	return in
}

// numIntervals returns the count of intervals in the container.
func (rc *runContainer16) numIntervals() int {
	return len(rc.iv)
}

// searchRange returns alreadyPresent to indicate if the
// key is already in one of our interval16s.
//
// If key is alreadyPresent, then whichInterval16 tells
// you where.
//
// If key is not already present, then whichInterval16 is
// set as follows:
//
//	a) whichInterval16 == len(rc.iv)-1 if key is beyond our
//	   last interval16 in rc.iv;
//
//	b) whichInterval16 == -1 if key is before our first
//	   interval16 in rc.iv;
//
//	c) whichInterval16 is set to the minimum index of rc.iv
//	   which comes strictly before the key;
//	   so  rc.iv[whichInterval16].last < key,
//	   and  if whichInterval16+1 exists, then key < rc.iv[whichInterval16+1].start
//	   (Note that whichInterval16+1 won't exist when
//	   whichInterval16 is the last interval.)
//
// runContainer16.search always returns whichInterval16 < len(rc.iv).
//
// The search space is from startIndex to endxIndex. If endxIndex is set to zero, then there
// no upper bound.
func (rc *runContainer16) searchRange(key int, startIndex int, endxIndex int) (whichInterval16 int, alreadyPresent bool, numCompares int) {
	n := int(len(rc.iv))
	if n == 0 {
		return -1, false, 0
	}
	if endxIndex == 0 {
		endxIndex = n
	}

	// sort.Search returns the smallest index i
	// in [0, n) at which f(i) is true, assuming that on the range [0, n),
	// f(i) == true implies f(i+1) == true.
	// If there is no such index, Search returns n.

	// For correctness, this began as verbatim snippet from
	// sort.Search in the Go standard lib.
	// We inline our comparison function for speed, and
	// annotate with numCompares
	// to observe and test that extra bounds are utilized.
	i, j := startIndex, endxIndex
	for i < j {
		h := i + (j-i)/2 // avoid overflow when computing h as the bisector
		// i <= h < j
		numCompares++
		if !(key < int(rc.iv[h].start)) {
			i = h + 1
		} else {
			j = h
		}
	}
	below := i
	// end std lib snippet.

	// The above is a simple in-lining and annotation of:
	/*	below := sort.Search(n,
		func(i int) bool {
			return key < rc.iv[i].start
		})
	*/
	whichInterval16 = below - 1

	if below == n {
		// all falses => key is >= start of all interval16s
		// ... so does it belong to the last interval16?
		if key < int(rc.iv[n-1].last())+1 {
			// yes, it belongs to the last interval16
			alreadyPresent = true
			return
		}
		// no, it is beyond the last interval16.
		// leave alreadyPreset = false
		return
	}

	// INVAR: key is below rc.iv[below]
	if below == 0 {
		// key is before the first first interval16.
		// leave alreadyPresent = false
		return
	}

	// INVAR: key is >= rc.iv[below-1].start and
	//        key is <  rc.iv[below].start

	// is key in below-1 interval16?
	if key >= int(rc.iv[below-1].start) && key < int(rc.iv[below-1].last())+1 {
		// yes, it is. key is in below-1 interval16.
		alreadyPresent = true
		return
	}

	// INVAR: key >= rc.iv[below-1].endx && key < rc.iv[below].start
	// leave alreadyPresent = false
	return
}

// search returns alreadyPresent to indicate if the
// key is already in one of our interval16s.
//
// If key is alreadyPresent, then whichInterval16 tells
// you where.
//
// If key is not already present, then whichInterval16 is
// set as follows:
//
//	a) whichInterval16 == len(rc.iv)-1 if key is beyond our
//	   last interval16 in rc.iv;
//
//	b) whichInterval16 == -1 if key is before our first
//	   interval16 in rc.iv;
//
//	c) whichInterval16 is set to the minimum index of rc.iv
//	   which comes strictly before the key;
//	   so  rc.iv[whichInterval16].last < key,
//	   and  if whichInterval16+1 exists, then key < rc.iv[whichInterval16+1].start
//	   (Note that whichInterval16+1 won't exist when
//	   whichInterval16 is the last interval.)
//
// runContainer16.search always returns whichInterval16 < len(rc.iv).
func (rc *runContainer16) search(key int) (whichInterval16 int, alreadyPresent bool, numCompares int) {
	return rc.searchRange(key, 0, 0)
}

// getCardinality returns the count of the integers stored in the
// runContainer16. The running complexity depends on the size
// of the container.
func (rc *runContainer16) getCardinality() int {
	// have to compute it
	n := 0
	for _, p := range rc.iv {
		n += p.runlen()
	}
	return n
}

// isEmpty returns true if the container is empty.
// It runs in constant time.
func (rc *runContainer16) isEmpty() bool {
	return len(rc.iv) == 0
}

// AsSlice decompresses the contents into a []uint16 slice.
func (rc *runContainer16) AsSlice() []uint16 {
	s := make([]uint16, rc.getCardinality())
	j := 0
	for _, p := range rc.iv {
		for i := p.start; i <= p.last(); i++ {
			s[j] = i
			j++
		}
	}
	return s
}

// newRunContainer16 creates an empty run container.
func newRunContainer16() *runContainer16 {
	return &runContainer16{}
}

// newRunContainer16CopyIv creates a run container, initializing
// with a copy of the supplied iv slice.
func newRunContainer16CopyIv(iv []interval16) *runContainer16 {
	rc := &runContainer16{
		iv: make([]interval16, len(iv)),
	}
	copy(rc.iv, iv)
	return rc
}

func (rc *runContainer16) Clone() *runContainer16 {
	rc2 := newRunContainer16CopyIv(rc.iv)
	return rc2
}

// newRunContainer16TakeOwnership returns a new runContainer16
// backed by the provided iv slice, which we will
// assume exclusive control over from now on.
func newRunContainer16TakeOwnership(iv []interval16) *runContainer16 {
	rc := &runContainer16{
		iv: iv,
	}
	return rc
}

const baseRc16Size = int(unsafe.Sizeof(runContainer16{}))
const perIntervalRc16Size = int(unsafe.Sizeof(interval16{}))

const baseDiskRc16Size = int(unsafe.Sizeof(uint16(0)))

// see also runContainer16SerializedSizeInBytes(numRuns int) int

// getSizeInBytes returns the number of bytes of memory
// required by this runContainer16.
func (rc *runContainer16) getSizeInBytes() int {
	return perIntervalRc16Size*len(rc.iv) + baseRc16Size
}

// runContainer16SerializedSizeInBytes returns the number of bytes of disk
// required to hold numRuns in a runContainer16.
func runContainer16SerializedSizeInBytes(numRuns int) int {
	return perIntervalRc16Size*numRuns + baseDiskRc16Size
}

// Add adds a single value k to the set.
func (rc *runContainer16) Add(k uint16) (wasNew bool) {
	// TODO comment from runContainer16.java:
	// it might be better and simpler to do return
	// toBitmapOrArrayContainer(getCardinality()).add(k)
	// but note that some unit tests use this method to build up test
	// runcontainers without calling runOptimize

	k64 := int(k)

	index, present, _ := rc.search(k64)
	if present {
		return // already there
	}
	wasNew = true

	n := int(len(rc.iv))
	if index == -1 {
		// we may need to extend the first run
		if n > 0 {
			if rc.iv[0].start == k+1 {
				rc.iv[0].start = k
				rc.iv[0].length++
				return
			}
		}
		// nope, k stands alone, starting the new first interval16.
		rc.iv = append([]interval16{newInterval16Range(k, k)}, rc.iv...)
		return
	}

	// are we off the end? handle both index == n and index == n-1:
	if index >= n-1 {
		if int(rc.iv[n-1].last())+1 == k64 {
			rc.iv[n-1].length++
			return
		}
		rc.iv = append(rc.iv, newInterval16Range(k, k))
		return
	}

	// INVAR: index and index+1 both exist, and k goes between them.
	//
	// Now: add k into the middle,
	// possibly fusing with index or index+1 interval16
	// and possibly resulting in fusing of two interval16s
	// that had a one integer gap.

	left := index
	right := index + 1

	// are we fusing left and right by adding k?
	if int(rc.iv[left].last())+1 == k64 && int(rc.iv[right].start) == k64+1 {
		// fuse into left
		rc.iv[left].length = rc.iv[right].last() - rc.iv[left].start
		// remove redundant right
		rc.iv = append(rc.iv[:left+1], rc.iv[right+1:]...)
		return
	}

	// are we an addition to left?
	if int(rc.iv[left].last())+1 == k64 {
		// yes
		rc.iv[left].length++
		return
	}

	// are we an addition to right?
	if int(rc.iv[right].start) == k64+1 {
		// yes
		rc.iv[right].start = k
		rc.iv[right].length++
		return
	}

	// k makes a standalone new interval16, inserted in the middle
	tail := append([]interval16{newInterval16Range(k, k)}, rc.iv[right:]...)
	rc.iv = append(rc.iv[:left+1], tail...)
	return
}

// runIterator16 advice: you must call hasNext()
// before calling next()/peekNext() to insure there are contents.
type runIterator16 struct {
	rc            *runContainer16
	curIndex      int
	curPosInIndex uint16
}

// newRunIterator16 returns a new empty run container.
func (rc *runContainer16) newRunIterator16() *runIterator16 {
	return &runIterator16{rc: rc, curIndex: 0, curPosInIndex: 0}
}

func (rc *runContainer16) iterate(cb func(x uint16) bool) bool {
	iterator := runIterator16{rc, 0, 0}

	for iterator.hasNext() {
		if !cb(iterator.next()) {
			return false
		}
	}

	return true
}

// hasNext returns false if calling next will panic. It
// returns true when there is at least one more value
// available in the iteration sequence.
func (ri *runIterator16) hasNext() bool {
	return int(len(ri.rc.iv)) > ri.curIndex+1 ||
		(int(len(ri.rc.iv)) == ri.curIndex+1 && ri.rc.iv[ri.curIndex].length >= ri.curPosInIndex)
}

// next returns the next value in the iteration sequence.
func (ri *runIterator16) next() uint16 {
	next := ri.rc.iv[ri.curIndex].start + ri.curPosInIndex

	if ri.curPosInIndex == ri.rc.iv[ri.curIndex].length {
		ri.curPosInIndex = 0
		ri.curIndex++
	} else {
		ri.curPosInIndex++
	}

	return next
}

// peekNext returns the next value in the iteration sequence without advancing the iterator
func (ri *runIterator16) peekNext() uint16 {
	return ri.rc.iv[ri.curIndex].start + ri.curPosInIndex
}

// advanceIfNeeded advances as long as the next value is smaller than minval
func (ri *runIterator16) advanceIfNeeded(minval uint16) {
	if !ri.hasNext() || ri.peekNext() >= minval {
		return
	}

	// interval cannot be -1 because of minval > peekNext
	interval, isPresent, _ := ri.rc.searchRange(int(minval), ri.curIndex, int(len(ri.rc.iv)))

	// if the minval is present, set the curPosIndex at the right position
	if isPresent {
		ri.curIndex = interval
		ri.curPosInIndex = minval - ri.rc.iv[ri.curIndex].start
	} else {
		// otherwise interval is set to to the minimum index of rc.iv
		// which comes strictly before the key, that's why we set the next interval
		ri.curIndex = interval + 1
		ri.curPosInIndex = 0
	}
}

// runReverseIterator16 advice: you must call hasNext()
// before calling next() to insure there are contents.
type runReverseIterator16 struct {
	rc            *runContainer16
	curIndex      int    // index into rc.iv
	curPosInIndex uint16 // offset in rc.iv[curIndex]
}

// newRunReverseIterator16 returns a new empty run iterator.
func (rc *runContainer16) newRunReverseIterator16() *runReverseIterator16 {
	index := int(len(rc.iv)) - 1
	pos := uint16(0)

	if index >= 0 {
		pos = rc.iv[index].length
	}

	return &runReverseIterator16{
		rc:            rc,
		curIndex:      index,
		curPosInIndex: pos,
	}
}

// hasNext returns false if calling next will panic. It
// returns true when there is at least one more value
// available in the iteration sequence.
func (ri *runReverseIterator16) hasNext() bool {
	return ri.curIndex > 0 || ri.curIndex == 0 && ri.curPosInIndex >= 0
}

// next returns the next value in the iteration sequence.
func (ri *runReverseIterator16) next() uint16 {
	next := ri.rc.iv[ri.curIndex].start + ri.curPosInIndex

	if ri.curPosInIndex > 0 {
		ri.curPosInIndex--
	} else {
		ri.curIndex--

		if ri.curIndex >= 0 {
			ri.curPosInIndex = ri.rc.iv[ri.curIndex].length
		}
	}

	return next
}

func (rc *runContainer16) newManyRunIterator16() *runIterator16 {
	return rc.newRunIterator16()
}

// hs are the high bits to include to avoid needing to reiterate over the buffer in NextMany
func (ri *runIterator16) nextMany(hs uint32, buf []uint32) int {
	n := 0

	if !ri.hasNext() {
		return n
	}

	// start and end are inclusive
	for n < len(buf) {
		moreVals := 0

		if ri.rc.iv[ri.curIndex].length >= ri.curPosInIndex {
			// add as many as you can from this seq
			moreVals = minOfInt(int(ri.rc.iv[ri.curIndex].length-ri.curPosInIndex)+1, len(buf)-n)
			base := uint32(ri.rc.iv[ri.curIndex].start+ri.curPosInIndex) | hs

			// allows BCE
			buf2 := buf[n : n+moreVals]
			for i := range buf2 {
				buf2[i] = base + uint32(i)
			}

			// update values
			n += moreVals
		}

		if moreVals+int(ri.curPosInIndex) > int(ri.rc.iv[ri.curIndex].length) {
			ri.curPosInIndex = 0
			ri.curIndex++

			if ri.curIndex == int(len(ri.rc.iv)) {
				break
			}
		} else {
			ri.curPosInIndex += uint16(moreVals) //moreVals always fits in uint16
		}
	}

	return n
}

func (ri *runIterator16) nextMany64(hs uint64, buf []uint64) int {
	n := 0

	if !ri.hasNext() {
		return n
	}

	// start and end are inclusive
	for n < len(buf) {
		moreVals := 0

		if ri.rc.iv[ri.curIndex].length >= ri.curPosInIndex {
			// add as many as you can from this seq
			moreVals = minOfInt(int(ri.rc.iv[ri.curIndex].length-ri.curPosInIndex)+1, len(buf)-n)
			base := uint64(ri.rc.iv[ri.curIndex].start+ri.curPosInIndex) | hs

			// allows BCE
			buf2 := buf[n : n+moreVals]
			for i := range buf2 {
				buf2[i] = base + uint64(i)
			}

			// update values
			n += moreVals
		}

		if moreVals+int(ri.curPosInIndex) > int(ri.rc.iv[ri.curIndex].length) {
			ri.curPosInIndex = 0
			ri.curIndex++

			if ri.curIndex == int(len(ri.rc.iv)) {
				break
			}
		} else {
			ri.curPosInIndex += uint16(moreVals) //moreVals always fits in uint16
		}
	}

	return n
}

// remove removes key from the container.
func (rc *runContainer16) removeKey(key uint16) (wasPresent bool) {

	var index int
	index, wasPresent, _ = rc.search(int(key))
	if !wasPresent {
		return // already removed, nothing to do.
	}
	pos := key - rc.iv[index].start
	rc.deleteAt(&index, &pos)
	return
}

// internal helper functions

func (rc *runContainer16) deleteAt(curIndex *int, curPosInIndex *uint16) {
	ci := *curIndex
	pos := *curPosInIndex

	// are we first, last, or in the middle of our interval16?
	switch {
	case pos == 0:
		if int(rc.iv[ci].length) == 0 {
			// our interval disappears
			rc.iv = append(rc.iv[:ci], rc.iv[ci+1:]...)
			// curIndex stays the same, since the delete did
			// the advance for us.
			*curPosInIndex = 0
		} else {
			rc.iv[ci].start++ // no longer overflowable
			rc.iv[ci].length--
		}
	case pos == rc.iv[ci].length:
		// length
		rc.iv[ci].length--
		// our interval16 cannot disappear, else we would have been pos == 0, case first above.
		*curPosInIndex--
		// if we leave *curIndex alone, then Next() will work properly even after the delete.
	default:
		//middle
		// split into two, adding an interval16
		new0 := newInterval16Range(rc.iv[ci].start, rc.iv[ci].start+*curPosInIndex-1)

		new1start := int(rc.iv[ci].start+*curPosInIndex) + 1
		if new1start > int(MaxUint16) {
			panic("overflow?!?!")
		}
		new1 := newInterval16Range(uint16(new1start), rc.iv[ci].last())
		tail := append([]interval16{new0, new1}, rc.iv[ci+1:]...)
		rc.iv = append(rc.iv[:ci], tail...)
		// update curIndex and curPosInIndex
		*curIndex++
		*curPosInIndex = 0
	}

}

func have4Overlap16(astart, alast, bstart, blast int) bool {
	if alast+1 <= bstart {
		return false
	}
	return blast+1 > astart
}

func intersectWithLeftover16(astart, alast, bstart, blast int) (isOverlap, isLeftoverA, isLeftoverB bool, leftoverstart int, intersection interval16) {
	if !have4Overlap16(astart, alast, bstart, blast) {
		return
	}
	isOverlap = true

	// do the intersection:
	if bstart > astart {
		intersection.start = uint16(bstart)
	} else {
		intersection.start = uint16(astart)
	}

	switch {
	case blast < alast:
		isLeftoverA = true
		leftoverstart = blast + 1
		intersection.length = uint16(blast) - intersection.start
	case alast < blast:
		isLeftoverB = true
		leftoverstart = alast + 1
		intersection.length = uint16(alast) - intersection.start
	default:
		// alast == blast
		intersection.length = uint16(alast) - intersection.start
	}

	return
}

func (rc *runContainer16) findNextIntervalThatIntersectsStartingFrom(startIndex int, key int) (index int, done bool) {
	w, _, _ := rc.searchRange(key, startIndex, 0)
	// rc.search always returns w < len(rc.iv)
	if w < startIndex {
		// not found and comes before lower bound startIndex,
		// so just use the lower bound.
		if startIndex == int(len(rc.iv)) {
			// also this bump up means that we are done
			return startIndex, true
		}
		return startIndex, false
	}

	return w, false
}

func sliceToString16(m []interval16) string {
	s := ""
	for i := range m {
		s += fmt.Sprintf("%v: %s, ", i, m[i])
	}
	return s
}

// helper for invert
func (rc *runContainer16) invertlastInterval(origin uint16, lastIdx int) []interval16 {
	cur := rc.iv[lastIdx]
	if cur.last() == MaxUint16 {
		if cur.start == origin {
			return nil // empty container
		}
		return []interval16{newInterval16Range(origin, cur.start-1)}
	}
	if cur.start == origin {
		return []interval16{newInterval16Range(cur.last()+1, MaxUint16)}
	}
	// invert splits
	return []interval16{
		newInterval16Range(origin, cur.start-1),
		newInterval16Range(cur.last()+1, MaxUint16),
	}
}

// invert returns a new container (not inplace), that is
// the inversion of rc. For each bit b in rc, the
// returned value has !b
func (rc *runContainer16) invert() *runContainer16 {
	ni := len(rc.iv)
	var m []interval16
	switch ni {
	case 0:
		return &runContainer16{iv: []interval16{newInterval16Range(0, MaxUint16)}}
	case 1:
		return &runContainer16{iv: rc.invertlastInterval(0, 0)}
	}
	var invstart int
	ult := ni - 1
	for i, cur := range rc.iv {
		if i == ult {
			// invertlastInteval will add both intervals (b) and (c) in
			// diagram below.
			m = append(m, rc.invertlastInterval(uint16(invstart), i)...)
			break
		}
		// INVAR: i and cur are not the last interval, there is a next at i+1
		//
		// ........[cur.start, cur.last] ...... [next.start, next.last]....
		//    ^                             ^                           ^
		//   (a)                           (b)                         (c)
		//
		// Now: we add interval (a); but if (a) is empty, for cur.start==0, we skip it.
		if cur.start > 0 {
			m = append(m, newInterval16Range(uint16(invstart), cur.start-1))
		}
		invstart = int(cur.last() + 1)
	}
	return &runContainer16{iv: m}
}

func (iv interval16) equal(b interval16) bool {
	return iv.start == b.start && iv.length == b.length
}

func (iv interval16) isSuperSetOf(b interval16) bool {
	return iv.start <= b.start && b.last() <= iv.last()
}

func (iv interval16) subtractInterval(del interval16) (left []interval16, delcount int) {
	isect, isEmpty := intersectInterval16s(iv, del)

	if isEmpty {
		return nil, 0
	}
	if del.isSuperSetOf(iv) {
		return nil, iv.runlen()
	}

	switch {
	case isect.start > iv.start && isect.last() < iv.last():
		new0 := newInterval16Range(iv.start, isect.start-1)
		new1 := newInterval16Range(isect.last()+1, iv.last())
		return []interval16{new0, new1}, isect.runlen()
	case isect.start == iv.start:
		return []interval16{newInterval16Range(isect.last()+1, iv.last())}, isect.runlen()
	default:
		return []interval16{newInterval16Range(iv.start, isect.start-1)}, isect.runlen()
	}
}

func (rc *runContainer16) isubtract(del interval16) {
	origiv := make([]interval16, len(rc.iv))
	copy(origiv, rc.iv)
	n := int(len(rc.iv))
	if n == 0 {
		return // already done.
	}

	_, isEmpty := intersectInterval16s(newInterval16Range(rc.iv[0].start, rc.iv[n-1].last()), del)
	if isEmpty {
		return // done
	}

	// INVAR there is some intersection between rc and del
	istart, startAlready, _ := rc.search(int(del.start))
	ilast, lastAlready, _ := rc.search(int(del.last()))
	if istart == -1 {
		if ilast == n-1 && !lastAlready {
			rc.iv = nil
			return
		}
	}
	// some intervals will remain
	switch {
	case startAlready && lastAlready:
		res0, _ := rc.iv[istart].subtractInterval(del)

		// would overwrite values in iv b/c res0 can have len 2. so
		// write to origiv instead.
		lost := 1 + ilast - istart
		changeSize := int(len(res0)) - lost
		newSize := int(len(rc.iv)) + changeSize

		//	rc.iv = append(pre, caboose...)
		//	return

		if ilast != istart {
			res1, _ := rc.iv[ilast].subtractInterval(del)
			res0 = append(res0, res1...)
			changeSize = int(len(res0)) - lost
			newSize = int(len(rc.iv)) + changeSize
		}
		switch {
		case changeSize < 0:
			// shrink
			copy(rc.iv[istart+int(len(res0)):], rc.iv[ilast+1:])
			copy(rc.iv[istart:istart+int(len(res0))], res0)
			rc.iv = rc.iv[:newSize]
			return
		case changeSize == 0:
			// stay the same
			copy(rc.iv[istart:istart+int(len(res0))], res0)
			return
		default:
			// changeSize > 0 is only possible when ilast == istart.
			// Hence we now know: changeSize == 1 and len(res0) == 2
			rc.iv = append(rc.iv, interval16{})
			// len(rc.iv) is correct now, no need to rc.iv = rc.iv[:newSize]

			// copy the tail into place
			copy(rc.iv[ilast+2:], rc.iv[ilast+1:])
			// copy the new item(s) into place
			copy(rc.iv[istart:istart+2], res0)
			return
		}

	case !startAlready && !lastAlready:
		// we get to discard whole intervals

		// from the search() definition:

		// if del.start is not present, then istart is
		// set as follows:
		//
		//  a) istart == n-1 if del.start is beyond our
		//     last interval16 in rc.iv;
		//
		//  b) istart == -1 if del.start is before our first
		//     interval16 in rc.iv;
		//
		//  c) istart is set to the minimum index of rc.iv
		//     which comes strictly before the del.start;
		//     so  del.start > rc.iv[istart].last,
		//     and  if istart+1 exists, then del.start < rc.iv[istart+1].startx

		// if del.last is not present, then ilast is
		// set as follows:
		//
		//  a) ilast == n-1 if del.last is beyond our
		//     last interval16 in rc.iv;
		//
		//  b) ilast == -1 if del.last is before our first
		//     interval16 in rc.iv;
		//
		//  c) ilast is set to the minimum index of rc.iv
		//     which comes strictly before the del.last;
		//     so  del.last > rc.iv[ilast].last,
		//     and  if ilast+1 exists, then del.last < rc.iv[ilast+1].start

		// INVAR: istart >= 0
		pre := rc.iv[:istart+1]
		if ilast == n-1 {
			rc.iv = pre
			return
		}
		// INVAR: ilast < n-1
		lost := ilast - istart
		changeSize := -lost
		newSize := int(len(rc.iv)) + changeSize
		if changeSize != 0 {
			copy(rc.iv[ilast+1+changeSize:], rc.iv[ilast+1:])
		}
		rc.iv = rc.iv[:newSize]
		return

	case startAlready && !lastAlready:
		// we can only shrink or stay the same size
		// i.e. we either eliminate the whole interval,
		// or just cut off the right side.
		res0, _ := rc.iv[istart].subtractInterval(del)
		if len(res0) > 0 {
			// len(res) must be 1
			rc.iv[istart] = res0[0]
		}
		lost := 1 + (ilast - istart)
		changeSize := int(len(res0)) - lost
		newSize := int(len(rc.iv)) + changeSize
		if changeSize != 0 {
			copy(rc.iv[ilast+1+changeSize:], rc.iv[ilast+1:])
		}
		rc.iv = rc.iv[:newSize]
		return

	case !startAlready && lastAlready:
		// we can only shrink or stay the same size
		res1, _ := rc.iv[ilast].subtractInterval(del)
		lost := ilast - istart
		changeSize := int(len(res1)) - lost
		newSize := int(len(rc.iv)) + changeSize
		if changeSize != 0 {
			// move the tail first to make room for res1
			copy(rc.iv[ilast+1+changeSize:], rc.iv[ilast+1:])
		}
		copy(rc.iv[istart+1:], res1)
		rc.iv = rc.iv[:newSize]
		return
	}
}

// compute rc minus b, and return the result as a new value (not inplace).
// port of run_container_andnot from CRoaring...
// https://github.com/RoaringBitmap/CRoaring/blob/master/src/containers/run.c#L435-L496
func (rc *runContainer16) AndNotRunContainer16(b *runContainer16) *runContainer16 {

	if len(b.iv) == 0 || len(rc.iv) == 0 {
		return rc
	}

	dst := newRunContainer16()
	apos := 0
	bpos := 0

	a := rc

	astart := a.iv[apos].start
	alast := a.iv[apos].last()
	bstart := b.iv[bpos].start
	blast := b.iv[bpos].last()

	alen := len(a.iv)
	blen := len(b.iv)

	for apos < alen && bpos < blen {
		switch {
		case alast < bstart:
			// output the first run
			dst.iv = append(dst.iv, newInterval16Range(astart, alast))
			apos++
			if apos < alen {
				astart = a.iv[apos].start
				alast = a.iv[apos].last()
			}
		case blast < astart:
			// exit the second run
			bpos++
			if bpos < blen {
				bstart = b.iv[bpos].start
				blast = b.iv[bpos].last()
			}
		default:
			//   a: [             ]
			//   b:            [    ]
			// alast >= bstart
			// blast >= astart
			if astart < bstart {
				dst.iv = append(dst.iv, newInterval16Range(astart, bstart-1))
			}
			if alast > blast {
				astart = blast + 1
			} else {
				apos++
				if apos < alen {
					astart = a.iv[apos].start
					alast = a.iv[apos].last()
				}
			}
		}
	}
	if apos < alen {
		dst.iv = append(dst.iv, newInterval16Range(astart, alast))
		apos++
		if apos < alen {
			dst.iv = append(dst.iv, a.iv[apos:]...)
		}
	}

	return dst
}

func (rc *runContainer16) numberOfRuns() (nr int) {
	return len(rc.iv)
}

func (rc *runContainer16) containerType() contype {
	return run16Contype
}

func (rc *runContainer16) equals16(srb *runContainer16) bool {
	// Check if the containers are the same object.
	if rc == srb {
		return true
	}

	if len(srb.iv) != len(rc.iv) {
		return false
	}

	for i, v := range rc.iv {
		if v != srb.iv[i] {
			return false
		}
	}
	return true
}

// compile time verify we meet interface requirements
var _ container = &runContainer16{}

func (rc *runContainer16) clone() container {
	return newRunContainer16CopyIv(rc.iv)
}

func (rc *runContainer16) minimum() uint16 {
	return rc.iv[0].start // assume not empty
}

func (rc *runContainer16) maximum() uint16 {
	return rc.iv[len(rc.iv)-1].last() // assume not empty
}

func (rc *runContainer16) isFull() bool {
	return (len(rc.iv) == 1) && ((rc.iv[0].start == 0) && (rc.iv[0].last() == MaxUint16))
}

func (rc *runContainer16) and(a container) container {
	if rc.isFull() {
		return a.clone()
	}
	switch c := a.(type) {
	case *runContainer16:
		return rc.intersect(c)
	case *arrayContainer:
		return rc.andArray(c)
	case *bitmapContainer:
		return rc.andBitmapContainer(c)
	}
	panic("unsupported container type")
}

func (rc *runContainer16) andCardinality(a container) int {
	switch c := a.(type) {
	case *runContainer16:
		return int(rc.intersectCardinality(c))
	case *arrayContainer:
		return rc.andArrayCardinality(c)
	case *bitmapContainer:
		return rc.andBitmapContainerCardinality(c)
	}
	panic("unsupported container type")
}

// andBitmapContainer finds the intersection of rc and b.
func (rc *runContainer16) andBitmapContainer(bc *bitmapContainer) container {
	bc2 := newBitmapContainerFromRun(rc)
	return bc2.andBitmap(bc)
}

func (rc *runContainer16) andArrayCardinality(ac *arrayContainer) int {
	pos := 0
	answer := 0
	maxpos := ac.getCardinality()
	if maxpos == 0 {
		return 0 // won't happen in actual code
	}
	v := ac.content[pos]
mainloop:
	for _, p := range rc.iv {
		for v < p.start {
			pos++
			if pos == maxpos {
				break mainloop
			}
			v = ac.content[pos]
		}
		for v <= p.last() {
			answer++
			pos++
			if pos == maxpos {
				break mainloop
			}
			v = ac.content[pos]
		}
	}
	return answer
}

func (rc *runContainer16) iand(a container) container {
	if rc.isFull() {
		return a.clone()
	}
	switch c := a.(type) {
	case *runContainer16:
		return rc.inplaceIntersect(c)
	case *arrayContainer:
		return rc.andArray(c)
	case *bitmapContainer:
		return rc.iandBitmapContainer(c)
	}
	panic("unsupported container type")
}

func (rc *runContainer16) inplaceIntersect(rc2 *runContainer16) container {
	sect := rc.intersect(rc2)
	*rc = *sect
	return rc
}

func (rc *runContainer16) iandBitmapContainer(bc *bitmapContainer) container {
	isect := rc.andBitmapContainer(bc)
	*rc = *newRunContainer16FromContainer(isect)
	return rc
}

func (rc *runContainer16) andArray(ac *arrayContainer) container {
	if len(rc.iv) == 0 {
		return newArrayContainer()
	}

	acCardinality := ac.getCardinality()
	c := newArrayContainerCapacity(acCardinality)

	for rlePos, arrayPos := 0, 0; arrayPos < acCardinality; {
		iv := rc.iv[rlePos]
		arrayVal := ac.content[arrayPos]

		for iv.last() < arrayVal {
			rlePos++
			if rlePos == len(rc.iv) {
				return c
			}
			iv = rc.iv[rlePos]
		}

		if iv.start > arrayVal {
			arrayPos = advanceUntil(ac.content, arrayPos, len(ac.content), iv.start)
		} else {
			c.content = append(c.content, arrayVal)
			arrayPos++
		}
	}
	return c
}

func (rc *runContainer16) andNot(a container) container {
	switch c := a.(type) {
	case *arrayContainer:
		return rc.andNotArray(c)
	case *bitmapContainer:
		return rc.andNotBitmap(c)
	case *runContainer16:
		return rc.andNotRunContainer16(c)
	}
	panic("unsupported container type")
}

func (rc *runContainer16) fillLeastSignificant16bits(x []uint32, i int, mask uint32) int {
	k := i
	var val int
	for _, p := range rc.iv {
		n := p.runlen()
		for j := int(0); j < n; j++ {
			val = int(p.start) + j
			x[k] = uint32(val) | mask
			k++
		}
	}
	return k
}

func (rc *runContainer16) getShortIterator() shortPeekable {
	return rc.newRunIterator16()
}

func (rc *runContainer16) getReverseIterator() shortIterable {
	return rc.newRunReverseIterator16()
}

func (rc *runContainer16) getManyIterator() manyIterable {
	return rc.newManyRunIterator16()
}

// add the values in the range [firstOfRange, endx). endx
// is still abe to express 2^16 because it is an int not an uint16.
func (rc *runContainer16) iaddRange(firstOfRange, endx int) container {

	if firstOfRange > endx {
		panic(fmt.Sprintf("invalid %v = endx > firstOfRange", endx))
	}
	if firstOfRange == endx {
		return rc
	}
	addme := newRunContainer16TakeOwnership([]interval16{
		{
			start:  uint16(firstOfRange),
			length: uint16(endx - 1 - firstOfRange),
		},
	})
	*rc = *rc.union(addme)
	return rc
}

// remove the values in the range [firstOfRange,endx)
func (rc *runContainer16) iremoveRange(firstOfRange, endx int) container {
	if firstOfRange > endx {
		panic(fmt.Sprintf("request to iremove empty set [%v, %v),"+
			" nothing to do.", firstOfRange, endx))
	}
	// empty removal
	if firstOfRange == endx {
		return rc
	}
	x := newInterval16Range(uint16(firstOfRange), uint16(endx-1))
	rc.isubtract(x)
	return rc
}

// not flip the values in the range [firstOfRange,endx)
func (rc *runContainer16) not(firstOfRange, endx int) container {
	if firstOfRange > endx {
		panic(fmt.Sprintf("invalid %v = endx > firstOfRange = %v", endx, firstOfRange))
	}

	return rc.Not(firstOfRange, endx)
}

// Not flips the values in the range [firstOfRange,endx).
// This is not inplace. Only the returned value has the flipped bits.
//
// Currently implemented as (!A intersect B) union (A minus B),
// where A is rc, and B is the supplied [firstOfRange, endx) interval.
//
// TODO(time optimization): convert this to a single pass
// algorithm by copying AndNotRunContainer16() and modifying it.
// Current routine is correct but
// makes 2 more passes through the arrays than should be
// strictly necessary. Measure both ways though--this may not matter.
func (rc *runContainer16) Not(firstOfRange, endx int) *runContainer16 {

	if firstOfRange > endx {
		panic(fmt.Sprintf("invalid %v = endx > firstOfRange == %v", endx, firstOfRange))
	}

	if firstOfRange >= endx {
		return rc.Clone()
	}

	a := rc
	// algo:
	// (!A intersect B) union (A minus B)

	nota := a.invert()

	bs := []interval16{newInterval16Range(uint16(firstOfRange), uint16(endx-1))}
	b := newRunContainer16TakeOwnership(bs)

	notAintersectB := nota.intersect(b)

	aMinusB := a.AndNotRunContainer16(b)

	rc2 := notAintersectB.union(aMinusB)
	return rc2
}

// equals is now logical equals; it does not require the
// same underlying container type.
func (rc *runContainer16) equals(o container) bool {
	srb, ok := o.(*runContainer16)

	if !ok {
		// maybe value instead of pointer
		val, valok := o.(*runContainer16)
		if valok {
			srb = val
			ok = true
		}
	}
	if ok {
		// Check if the containers are the same object.
		if rc == srb {
			return true
		}

		if len(srb.iv) != len(rc.iv) {
			return false
		}

		for i, v := range rc.iv {
			if v != srb.iv[i] {
				return false
			}
		}
		return true
	}

	// use generic comparison
	if o.getCardinality() != rc.getCardinality() {
		return false
	}
	rit := rc.getShortIterator()
	bit := o.getShortIterator()

	//k := 0
	for rit.hasNext() {
		if bit.next() != rit.next() {
			return false
		}
		//k++
	}
	return true
}

func (rc *runContainer16) iaddReturnMinimized(x uint16) container {
	rc.Add(x)
	return rc
}

func (rc *runContainer16) iadd(x uint16) (wasNew bool) {
	return rc.Add(x)
}

func (rc *runContainer16) iremoveReturnMinimized(x uint16) container {
	rc.removeKey(x)
	return rc
}

func (rc *runContainer16) iremove(x uint16) bool {
	return rc.removeKey(x)
}

func (rc *runContainer16) or(a container) container {
	if rc.isFull() {
		return rc.clone()
	}
	switch c := a.(type) {
	case *runContainer16:
		return rc.union(c)
	case *arrayContainer:
		return rc.orArray(c)
	case *bitmapContainer:
		return rc.orBitmapContainer(c)
	}
	panic("unsupported container type")
}

func (rc *runContainer16) orCardinality(a container) int {
	switch c := a.(type) {
	case *runContainer16:
		return int(rc.unionCardinality(c))
	case *arrayContainer:
		return rc.orArrayCardinality(c)
	case *bitmapContainer:
		return rc.orBitmapContainerCardinality(c)
	}
	panic("unsupported container type")
}

// orBitmapContainer finds the union of rc and bc.
func (rc *runContainer16) orBitmapContainer(bc *bitmapContainer) container {
	bc2 := newBitmapContainerFromRun(rc)
	return bc2.iorBitmap(bc)
}

func (rc *runContainer16) andBitmapContainerCardinality(bc *bitmapContainer) int {
	answer := 0
	for i := range rc.iv {
		answer += bc.getCardinalityInRange(uint(rc.iv[i].start), uint(rc.iv[i].last())+1)
	}
	//bc.computeCardinality()
	return answer
}

func (rc *runContainer16) orBitmapContainerCardinality(bc *bitmapContainer) int {
	return rc.getCardinality() + bc.getCardinality() - rc.andBitmapContainerCardinality(bc)
}

// orArray finds the union of rc and ac.
func (rc *runContainer16) orArray(ac *arrayContainer) container {
	if ac.isEmpty() {
		return rc.clone()
	}
	if rc.isEmpty() {
		return ac.clone()
	}
	intervals, cardMinusOne := runArrayUnionToRuns(rc, ac)
	result := newRunContainer16TakeOwnership(intervals)
	if len(intervals) >= 2048 && cardMinusOne >= arrayDefaultMaxSize {
		return newBitmapContainerFromRun(result)
	}
	if len(intervals)*2 > 1+int(cardMinusOne) {
		return result.toArrayContainer()
	}
	return result
}

// orArray finds the union of rc and ac.
func (rc *runContainer16) orArrayCardinality(ac *arrayContainer) int {
	return ac.getCardinality() + rc.getCardinality() - rc.andArrayCardinality(ac)
}

func (rc *runContainer16) ior(a container) container {
	if rc.isFull() {
		return rc
	}
	switch c := a.(type) {
	case *runContainer16:
		return rc.inplaceUnion(c)
	case *arrayContainer:
		return rc.iorArray(c)
	case *bitmapContainer:
		return rc.iorBitmapContainer(c)
	}
	panic("unsupported container type")
}

func (rc *runContainer16) inplaceUnion(rc2 *runContainer16) container {
	for _, p := range rc2.iv {
		last := int(p.last())
		for i := int(p.start); i <= last; i++ {
			rc.Add(uint16(i))
		}
	}
	return rc
}

func (rc *runContainer16) iorBitmapContainer(bc *bitmapContainer) container {

	it := bc.getShortIterator()
	for it.hasNext() {
		rc.Add(it.next())
	}
	return rc
}

func (rc *runContainer16) iorArray(ac *arrayContainer) container {
	if rc.isEmpty() {
		return ac.clone()
	}
	if ac.isEmpty() {
		return rc
	}
	var cardMinusOne uint16
	//TODO: perform the union algorithm in-place using rc.iv
	// this can be done with methods like the in-place array container union
	// but maybe lazily moving the remaining elements back.
	rc.iv, cardMinusOne = runArrayUnionToRuns(rc, ac)
	if len(rc.iv) >= 2048 && cardMinusOne >= arrayDefaultMaxSize {
		return newBitmapContainerFromRun(rc)
	}
	if len(rc.iv)*2 > 1+int(cardMinusOne) {
		return rc.toArrayContainer()
	}
	return rc
}

func runArrayUnionToRuns(rc *runContainer16, ac *arrayContainer) ([]interval16, uint16) {
	pos1 := 0
	pos2 := 0
	length1 := len(ac.content)
	length2 := len(rc.iv)
	target := make([]interval16, 0, len(rc.iv))
	// have to find the first range
	// options are
	// 1. from array container
	// 2. from run container
	var previousInterval interval16
	var cardMinusOne uint16
	if ac.content[0] < rc.iv[0].start {
		previousInterval.start = ac.content[0]
		previousInterval.length = 0
		pos1++
	} else {
		previousInterval.start = rc.iv[0].start
		previousInterval.length = rc.iv[0].length
		pos2++
	}

	for pos1 < length1 || pos2 < length2 {
		if pos1 < length1 {
			s1 := ac.content[pos1]
			if s1 <= previousInterval.start+previousInterval.length {
				pos1++
				continue
			}
			if previousInterval.last() < MaxUint16 && previousInterval.last()+1 == s1 {
				previousInterval.length++
				pos1++
				continue
			}
		}
		if pos2 < length2 {
			range2 := rc.iv[pos2]
			if range2.start <= previousInterval.last() || range2.start > 0 && range2.start-1 == previousInterval.last() {
				pos2++
				if previousInterval.last() < range2.last() {
					previousInterval.length = range2.last() - previousInterval.start
				}
				continue
			}
		}
		cardMinusOne += previousInterval.length + 1
		target = append(target, previousInterval)
		if pos2 == length2 || pos1 < length1 && ac.content[pos1] < rc.iv[pos2].start {
			previousInterval.start = ac.content[pos1]
			previousInterval.length = 0
			pos1++
		} else {
			previousInterval = rc.iv[pos2]
			pos2++
		}
	}
	cardMinusOne += previousInterval.length
	target = append(target, previousInterval)

	return target, cardMinusOne
}

// lazyIOR is described (not yet implemented) in
// this nice note from @lemire on
// https://github.com/RoaringBitmap/roaring/pull/70#issuecomment-263613737
//
// Description of lazyOR and lazyIOR from @lemire:
//
// Lazy functions are optional and can be simply
// wrapper around non-lazy functions.
//
// The idea of "laziness" is as follows. It is
// inspired by the concept of lazy evaluation
// you might be familiar with (functional programming
// and all that). So a roaring bitmap is
// such that all its containers are, in some
// sense, chosen to use as little memory as
// possible. This is nice. Also, all bitsets
// are "cardinality aware" so that you can do
// fast rank/select queries, or query the
// cardinality of the whole bitmap... very fast,
// without latency.
//
// However, imagine that you are aggregating 100
// bitmaps together. So you OR the first two, then OR
// that with the third one and so forth. Clearly,
// intermediate bitmaps don't need to be as
// compressed as possible, right? They can be
// in a "dirty state". You only need the end
// result to be in a nice state... which you
// can achieve by calling repairAfterLazy at the end.
//
// The Java/C code does something special for
// the in-place lazy OR runs. The idea is that
// instead of taking two run containers and
// generating a new one, we actually try to
// do the computation in-place through a
// technique invented by @gssiyankai (pinging him!).
// What you do is you check whether the host
// run container has lots of extra capacity.
// If it does, you move its data at the end of
// the backing array, and then you write
// the answer at the beginning. What this
// trick does is minimize memory allocations.
func (rc *runContainer16) lazyIOR(a container) container {
	// not lazy at the moment
	return rc.ior(a)
}

// lazyOR is described above in lazyIOR.
func (rc *runContainer16) lazyOR(a container) container {
	// not lazy at the moment
	return rc.or(a)
}

func (rc *runContainer16) intersects(a container) bool {
	// TODO: optimize by doing inplace/less allocation
	isect := rc.and(a)
	return !isect.isEmpty()
}

func (rc *runContainer16) xor(a container) container {
	switch c := a.(type) {
	case *arrayContainer:
		return rc.xorArray(c)
	case *bitmapContainer:
		return rc.xorBitmap(c)
	case *runContainer16:
		return rc.xorRunContainer16(c)
	}
	panic("unsupported container type")
}

func (rc *runContainer16) iandNot(a container) container {
	switch c := a.(type) {
	case *arrayContainer:
		return rc.iandNotArray(c)
	case *bitmapContainer:
		return rc.iandNotBitmap(c)
	case *runContainer16:
		return rc.iandNotRunContainer16(c)
	}
	panic("unsupported container type")
}

// flip the values in the range [firstOfRange,endx)
func (rc *runContainer16) inot(firstOfRange, endx int) container {
	if firstOfRange > endx {
		panic(fmt.Sprintf("invalid %v = endx > firstOfRange = %v", endx, firstOfRange))
	}
	if firstOfRange > endx {
		return rc
	}
	// TODO: minimize copies, do it all inplace; not() makes a copy.
	rc = rc.Not(firstOfRange, endx)
	return rc
}

func (rc *runContainer16) rank(x uint16) int {
	n := int(len(rc.iv))
	xx := int(x)
	w, already, _ := rc.search(xx)
	if w < 0 {
		return 0
	}
	if !already && w == n-1 {
		return rc.getCardinality()
	}
	var rnk int
	if !already {
		for i := int(0); i <= w; i++ {
			rnk += rc.iv[i].runlen()
		}
		return int(rnk)
	}
	for i := int(0); i < w; i++ {
		rnk += rc.iv[i].runlen()
	}
	rnk += int(x-rc.iv[w].start) + 1
	return int(rnk)
}

func (rc *runContainer16) selectInt(x uint16) int {
	var offset int
	for k := range rc.iv {
		nextOffset := offset + rc.iv[k].runlen()
		if nextOffset > int(x) {
			return int(int(rc.iv[k].start) + (int(x) - offset))
		}
		offset = nextOffset
	}
	panic("cannot select x")
}

func (rc *runContainer16) andNotRunContainer16(b *runContainer16) container {
	return rc.AndNotRunContainer16(b)
}

func (rc *runContainer16) andNotArray(ac *arrayContainer) container {
	rcb := rc.toBitmapContainer()
	acb := ac.toBitmapContainer()
	return rcb.andNotBitmap(acb)
}

func (rc *runContainer16) andNotBitmap(bc *bitmapContainer) container {
	rcb := rc.toBitmapContainer()
	return rcb.andNotBitmap(bc)
}

func (rc *runContainer16) toBitmapContainer() *bitmapContainer {
	bc := newBitmapContainer()
	for i := range rc.iv {
		bc.iaddRange(int(rc.iv[i].start), int(rc.iv[i].last())+1)
	}
	bc.computeCardinality()
	return bc
}

func (rc *runContainer16) iandNotRunContainer16(x2 *runContainer16) container {
	rcb := rc.toBitmapContainer()
	x2b := x2.toBitmapContainer()
	rcb.iandNotBitmapSurely(x2b)
	// TODO: check size and optimize the return value
	// TODO: is inplace modification really required? If not, elide the copy.
	rc2 := newRunContainer16FromBitmapContainer(rcb)
	*rc = *rc2
	return rc
}

func (rc *runContainer16) iandNotArray(ac *arrayContainer) container {
	rcb := rc.toBitmapContainer()
	acb := ac.toBitmapContainer()
	rcb.iandNotBitmapSurely(acb)
	// TODO: check size and optimize the return value
	// TODO: is inplace modification really required? If not, elide the copy.
	rc2 := newRunContainer16FromBitmapContainer(rcb)
	*rc = *rc2
	return rc
}

func (rc *runContainer16) iandNotBitmap(bc *bitmapContainer) container {
	rcb := rc.toBitmapContainer()
	rcb.iandNotBitmapSurely(bc)
	// TODO: check size and optimize the return value
	// TODO: is inplace modification really required? If not, elide the copy.
	rc2 := newRunContainer16FromBitmapContainer(rcb)
	*rc = *rc2
	return rc
}

func (rc *runContainer16) xorRunContainer16(x2 *runContainer16) container {
	rcb := rc.toBitmapContainer()
	x2b := x2.toBitmapContainer()
	return rcb.xorBitmap(x2b)
}

func (rc *runContainer16) xorArray(ac *arrayContainer) container {
	rcb := rc.toBitmapContainer()
	acb := ac.toBitmapContainer()
	return rcb.xorBitmap(acb)
}

func (rc *runContainer16) xorBitmap(bc *bitmapContainer) container {
	rcb := rc.toBitmapContainer()
	return rcb.xorBitmap(bc)
}

// convert to bitmap or array *if needed*
func (rc *runContainer16) toEfficientContainer() container {
	sizeAsRunContainer := rc.getSizeInBytes()
	sizeAsBitmapContainer := bitmapContainerSizeInBytes()
	card := rc.getCardinality()
	sizeAsArrayContainer := arrayContainerSizeInBytes(card)
	if sizeAsRunContainer <= minOfInt(sizeAsBitmapContainer, sizeAsArrayContainer) {
		return rc
	}
	if card <= arrayDefaultMaxSize {
		return rc.toArrayContainer()
	}
	bc := newBitmapContainerFromRun(rc)
	return bc
}

func (rc *runContainer16) toArrayContainer() *arrayContainer {
	ac := newArrayContainer()
	for i := range rc.iv {
		ac.iaddRange(int(rc.iv[i].start), int(rc.iv[i].last())+1)
	}
	return ac
}

func newRunContainer16FromContainer(c container) *runContainer16 {

	switch x := c.(type) {
	case *runContainer16:
		return x.Clone()
	case *arrayContainer:
		return newRunContainer16FromArray(x)
	case *bitmapContainer:
		return newRunContainer16FromBitmapContainer(x)
	}
	panic("unsupported container type")
}

// And finds the intersection of rc and b.
func (rc *runContainer16) And(b *Bitmap) *Bitmap {
	out := NewBitmap()
	for _, p := range rc.iv {
		plast := p.last()
		for i := p.start; i <= plast; i++ {
			if b.Contains(uint32(i)) {
				out.Add(uint32(i))
			}
		}
	}
	return out
}

// Xor returns the exclusive-or of rc and b.
func (rc *runContainer16) Xor(b *Bitmap) *Bitmap {
	out := b.Clone()
	for _, p := range rc.iv {
		plast := p.last()
		for v := p.start; v <= plast; v++ {
			w := uint32(v)
			if out.Contains(w) {
				out.RemoveRange(uint64(w), uint64(w+1))
			} else {
				out.Add(w)
			}
		}
	}
	return out
}

// Or returns the union of rc and b.
func (rc *runContainer16) Or(b *Bitmap) *Bitmap {
	out := b.Clone()
	for _, p := range rc.iv {
		plast := p.last()
		for v := p.start; v <= plast; v++ {
			out.Add(uint32(v))
		}
	}
	return out
}

// serializedSizeInBytes returns the number of bytes of memory
// required by this runContainer16. This is for the
// Roaring format, as specified https://github.com/RoaringBitmap/RoaringFormatSpec/
func (rc *runContainer16) serializedSizeInBytes() int {
	// number of runs in one uint16, then each run
	// needs two more uint16
	return 2 + len(rc.iv)*4
}

func (rc *runContainer16) addOffset(x uint16) (container, container) {
	var low, high *runContainer16

	if len(rc.iv) == 0 {
		return nil, nil
	}

	first := uint32(rc.iv[0].start) + uint32(x)
	if highbits(first) == 0 {
		// Some elements will fall into low part, allocate a container.
		// Checking the first one is enough because they are ordered.
		low = newRunContainer16()
	}
	last := uint32(rc.iv[len(rc.iv)-1].start)
	last += uint32(rc.iv[len(rc.iv)-1].length)
	last += uint32(x)
	if highbits(last) > 0 {
		// Some elements will fall into high part, allocate a container.
		// Checking the last one is enough because they are ordered.
		high = newRunContainer16()
	}

	for _, iv := range rc.iv {
		val := int(iv.start) + int(x)
		finalVal := int(val) + int(iv.length)
		if val <= 0xffff {
			if finalVal <= 0xffff {
				low.iv = append(low.iv, interval16{uint16(val), iv.length})
			} else {
				low.iv = append(low.iv, interval16{uint16(val), uint16(0xffff - val)})
				high.iv = append(high.iv, interval16{uint16(0), uint16(finalVal & 0xffff)})
			}
		} else {
			high.iv = append(high.iv, interval16{uint16(val & 0xffff), iv.length})
		}
	}

	// Ensure proper nil interface.
	if low == nil {
		return nil, high
	}
	if high == nil {
		return low, nil
	}

	return low, high
}
