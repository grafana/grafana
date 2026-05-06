package miniredis

// The most KISS way to implement a sorted set. Luckily we don't care about
// performance that much.

import (
	"sort"
)

type direction int

const (
	unsorted direction = iota
	asc
	desc
)

type sortedSet map[string]float64

type ssElem struct {
	score  float64
	member string
}
type ssElems []ssElem

type byScore ssElems

func (sse byScore) Len() int      { return len(sse) }
func (sse byScore) Swap(i, j int) { sse[i], sse[j] = sse[j], sse[i] }
func (sse byScore) Less(i, j int) bool {
	if sse[i].score != sse[j].score {
		return sse[i].score < sse[j].score
	}
	return sse[i].member < sse[j].member
}

func newSortedSet() sortedSet {
	return sortedSet{}
}

func (ss *sortedSet) card() int {
	return len(*ss)
}

func (ss *sortedSet) set(score float64, member string) {
	(*ss)[member] = score
}

func (ss *sortedSet) get(member string) (float64, bool) {
	v, ok := (*ss)[member]
	return v, ok
}

// elems gives the list of ssElem, ready to sort.
func (ss *sortedSet) elems() ssElems {
	elems := make(ssElems, 0, len(*ss))
	for e, s := range *ss {
		elems = append(elems, ssElem{s, e})
	}
	return elems
}

func (ss *sortedSet) byScore(d direction) ssElems {
	elems := ss.elems()
	sort.Sort(byScore(elems))
	if d == desc {
		reverseElems(elems)
	}
	return ssElems(elems)
}

// rankByScore gives the (0-based) index of member, or returns false.
func (ss *sortedSet) rankByScore(member string, d direction) (int, bool) {
	if _, ok := (*ss)[member]; !ok {
		return 0, false
	}
	for i, e := range ss.byScore(d) {
		if e.member == member {
			return i, true
		}
	}
	// Can't happen
	return 0, false
}

func reverseSlice(o []string) {
	for i := range make([]struct{}, len(o)/2) {
		other := len(o) - 1 - i
		o[i], o[other] = o[other], o[i]
	}
}

func reverseElems(o ssElems) {
	for i := range make([]struct{}, len(o)/2) {
		other := len(o) - 1 - i
		o[i], o[other] = o[other], o[i]
	}
}
