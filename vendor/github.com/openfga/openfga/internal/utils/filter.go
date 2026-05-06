package utils

import "iter"

// Filter functions similar to other language list filter functions.
// It accepts a generic slice and a predicate function to apply to each element,
// returning an iterator sequence containing only the elements for which the predicate returned true.
//
// Example filtering for even numbers:
//
//	iter := Filter([]int{1, 2, 3, 4, 5}, func(n int) bool { return n%2 == 0})
//	// To collect results: slices.Collect(iter) returns []int{2, 4}
func Filter[T any](s []T, predicate func(T) bool) iter.Seq[T] {
	return func(yield func(T) bool) {
		for _, item := range s {
			if predicate(item) {
				if !yield(item) {
					// Stop if yield returns false (no more items)
					return
				}
			}
		}
	}
}
