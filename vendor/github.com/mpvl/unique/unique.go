// Package unique provides primitives for finding unique elements of types that
// implement sort.Interface.
package unique

import "sort"

// Types that implement unique.Interface can have duplicate elements removed by
// the functionality in this package.
type Interface interface {
	sort.Interface

	// Truncate reduces the length to the first n elements.
	Truncate(n int)
}

// Unique removes duplicate elements from data. It assumes sort.IsSorted(data).
func Unique(data Interface) {
	data.Truncate(ToFront(data))
}

// ToFront reports the number of unique elements of data which it moves to the
// first n positions. It assumes sort.IsSorted(data).
func ToFront(data sort.Interface) (n int) {
	n = data.Len()
	if n == 0 {
		return
	}
	k := 0
	for i := 1; i < n; i++ {
		if data.Less(k, i) {
			k++
			data.Swap(k, i)
		}
	}
	return k + 1
}

// Sort sorts and removes duplicate entries from data.
func Sort(data Interface) {
	sort.Sort(data)
	Unique(data)
}

// IsUniqued reports whether the elements in data are sorted and unique.
func IsUniqued(data sort.Interface) bool {
	n := data.Len()
	for i := n - 1; i > 0; i-- {
		if !data.Less(i-1, i) {
			return false
		}
	}
	return true
}

// Float64Slice attaches the methods of Interface to []float64.
type Float64Slice struct{ P *[]float64 }

func (p Float64Slice) Len() int           { return len(*p.P) }
func (p Float64Slice) Swap(i, j int)      { (*p.P)[i], (*p.P)[j] = (*p.P)[j], (*p.P)[i] }
func (p Float64Slice) Less(i, j int) bool { return (*p.P)[i] < (*p.P)[j] }
func (p Float64Slice) Truncate(n int)     { *p.P = (*p.P)[:n] }

// Float64s removes duplicate elements from a sorted slice of float64s.
func Float64s(a *[]float64) { Unique(Float64Slice{a}) }

// Float64sAreUnique tests whether a slice of float64s is sorted and its
// elements are unique.
func Float64sAreUnique(a []float64) bool { return IsUniqued(sort.Float64Slice(a)) }

// IntSlice attaches the methods of Interface to []int.
type IntSlice struct{ P *[]int }

func (p IntSlice) Len() int           { return len(*p.P) }
func (p IntSlice) Swap(i, j int)      { (*p.P)[i], (*p.P)[j] = (*p.P)[j], (*p.P)[i] }
func (p IntSlice) Less(i, j int) bool { return (*p.P)[i] < (*p.P)[j] }
func (p IntSlice) Truncate(n int)     { *p.P = (*p.P)[:n] }

// Ints removes duplicate elements from a sorted slice of ints.
func Ints(a *[]int) { Unique(IntSlice{a}) }

// IntsAreUnique tests whether a slice of ints is sorted and its elements are
// unique.
func IntsAreUnique(a []int) bool { return IsUniqued(sort.IntSlice(a)) }

// StringSlice attaches the methods of Interface to []string.
type StringSlice struct{ P *[]string }

func (p StringSlice) Len() int           { return len(*p.P) }
func (p StringSlice) Swap(i, j int)      { (*p.P)[i], (*p.P)[j] = (*p.P)[j], (*p.P)[i] }
func (p StringSlice) Less(i, j int) bool { return (*p.P)[i] < (*p.P)[j] }
func (p StringSlice) Truncate(n int)     { *p.P = (*p.P)[:n] }

// Strings removes duplicate elements from a sorted slice of strings.
func Strings(a *[]string) { Unique(StringSlice{a}) }

// StringsAreUnique tests whether a slice of strings is sorted and its elements
// are unique.
func StringsAreUnique(a []string) bool { return IsUniqued(sort.StringSlice(a)) }
