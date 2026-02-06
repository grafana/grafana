package sql

import (
	"bytes"
	"fmt"
)

type ColumnId uint16

type ColSet struct {
	set FastIntSet
}

func NewColSet(vals ...ColumnId) ColSet {
	var ret ColSet
	for _, v := range vals {
		ret.Add(v)
	}
	return ret
}

func NewColSetFromIntSet(set FastIntSet) ColSet {
	return ColSet{set: set}
}

// We offset the ColumnIDs in the underlying FastIntSet by 1, so that the
// internal set fast-path can be used for ColumnIDs in the range [1, 64] instead
// of [0, 63]. ColumnId 0 is reserved as an unknown ColumnId, and a ColSet
// should never contain it, so this shift allows us to make use of the set
// fast-path in a few more cases.
const offset = 1

// setVal returns the value to store in the internal set for the given ColumnId.
func setVal(col ColumnId) int {
	return int(col - offset)
}

// retVal returns the ColumnId to return for the given value in the internal
// set.
func retVal(i int) ColumnId {
	return ColumnId(i + offset)
}

// MakeColSet returns a set initialized with the given values.
func MakeColSet(vals ...ColumnId) ColSet {
	var res ColSet
	for _, v := range vals {
		res.Add(v)
	}
	return res
}

// Add adds a column to the set. No-op if the column is already in the set.
func (s *ColSet) Add(col ColumnId) {
	s.set.Add(setVal(col))
}

// Remove removes a column from the set. No-op if the column is not in the set.
func (s *ColSet) Remove(col ColumnId) { s.set.Remove(setVal(col)) }

// Contains returns true if the set contains the column.
func (s ColSet) Contains(col ColumnId) bool { return s.set.Contains(setVal(col)) }

// Empty returns true if the set is empty.
func (s ColSet) Empty() bool { return s.set.Empty() }

// Len returns the number of the columns in the set.
func (s ColSet) Len() int { return s.set.Len() }

// Next returns the first value in the set which is >= startVal. If there is no
// such column, the second return value is false.
func (s ColSet) Next(startVal ColumnId) (ColumnId, bool) {
	c, ok := s.set.Next(setVal(startVal))
	return retVal(c), ok
}

// ForEach calls a function for each column in the set (in increasing order).
func (s ColSet) ForEach(f func(col ColumnId)) { s.set.ForEach(func(i int) { f(retVal(i)) }) }

// Copy returns a copy of s which can be modified independently.
func (s ColSet) Copy() ColSet { return ColSet{set: s.set.Copy()} }

// UnionWith adds all the columns from rhs to this set.
func (s *ColSet) UnionWith(rhs ColSet) { s.set.UnionWith(rhs.set) }

// Union returns the union of s and rhs as a new set.
func (s ColSet) Union(rhs ColSet) ColSet { return ColSet{set: s.set.Union(rhs.set)} }

// IntersectionWith removes any columns not in rhs from this set.
func (s *ColSet) IntersectionWith(rhs ColSet) { s.set.IntersectionWith(rhs.set) }

// Intersection returns the intersection of s and rhs as a new set.
func (s ColSet) Intersection(rhs ColSet) ColSet { return ColSet{set: s.set.Intersection(rhs.set)} }

// DifferenceWith removes any elements in rhs from this set.
func (s *ColSet) DifferenceWith(rhs ColSet) { s.set.DifferenceWith(rhs.set) }

// Difference returns the elements of s that are not in rhs as a new set.
func (s ColSet) Difference(rhs ColSet) ColSet { return ColSet{set: s.set.Difference(rhs.set)} }

// Intersects returns true if s has any elements in common with rhs.
func (s ColSet) Intersects(rhs ColSet) bool { return s.set.Intersects(rhs.set) }

// Equals returns true if the two sets are identical.
func (s ColSet) Equals(rhs ColSet) bool { return s.set.Equals(rhs.set) }

// SubsetOf returns true if rhs contains all the elements in s.
func (s ColSet) SubsetOf(rhs ColSet) bool { return s.set.SubsetOf(rhs.set) }

func (s ColSet) String() string {
	var buf bytes.Buffer
	buf.WriteByte('(')
	appendRange := func(start, end ColumnId) {
		if buf.Len() > 1 {
			buf.WriteByte(',')
		}
		if start == end {
			fmt.Fprintf(&buf, "%d", start)
		} else if start+1 == end {
			fmt.Fprintf(&buf, "%d,%d", start, end)
		} else {
			fmt.Fprintf(&buf, "%d-%d", start, end)
		}
	}
	rangeStart, rangeEnd := -1, -1
	s.set.ForEach(func(i int) {
		if i < 0 {
			appendRange(retVal(i), retVal(i))
			return
		}
		if rangeStart != -1 && rangeEnd == i-1 {
			rangeEnd = i
		} else {
			if rangeStart != -1 {
				appendRange(retVal(rangeStart), retVal(rangeEnd))
			}
			rangeStart, rangeEnd = i, i
		}
	})
	if rangeStart != -1 {
		appendRange(retVal(rangeStart), retVal(rangeEnd))
	}
	buf.WriteByte(')')
	return buf.String()
}
