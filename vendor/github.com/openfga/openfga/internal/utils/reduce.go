package utils

// Reduce accepts a generic slice, an initializer value, and a function.
// It iterates over the slice applying the supplied function to the current accumulated value and each element in the slice,
// reducing the slice to a single value.
//
// Example reducing to a sum:
//
//	Reduce([]int{1, 2, 3}, 0, func(accumulator int, currentValue int) int {
//		return accumulator + currentValue
//	})
//
// returns 6.
func Reduce[S ~[]E, E any, A any](s S, initializer A, f func(A, E) A) A {
	i := initializer
	for _, item := range s {
		i = f(i, item)
	}
	return i
}
