package seq

import "iter"

// Sequence is a function that turns its input into an `iter.Seq[T]` that
// yields values in the order that they were provided to the function.
func Sequence[T any](items ...T) iter.Seq[T] {
	return func(yield func(T) bool) {
		for _, item := range items {
			if !yield(item) {
				return
			}
		}
	}
}

// Flatten is a function that merges a set of provided `iter.Seq[T]`
// values into a single `iter.Seq[T]` value. The values of each input are
// yielded in the order yielded by each `iter.Seq[T]`, in the order provided
// to the function.
func Flatten[T any](seqs ...iter.Seq[T]) iter.Seq[T] {
	return func(yield func(T) bool) {
		for _, seq := range seqs {
			for item := range seq {
				if !yield(item) {
					return
				}
			}
		}
	}
}

// Transform is a function that maps the values yielded by the input `seq`
// to values produced by the input function `fn`, and returns an `iter.Seq`
// that yields those new values.
func Transform[T any, U any](seq iter.Seq[T], fn func(T) U) iter.Seq[U] {
	return func(yield func(U) bool) {
		for item := range seq {
			if !yield(fn(item)) {
				return
			}
		}
	}
}

// Filter is a function the yields only values for which the predicate
// returns `true`.
func Filter[T any](seq iter.Seq[T], fn func(T) bool) iter.Seq[T] {
	return func(yield func(T) bool) {
		for item := range seq {
			if fn(item) {
				if !yield(item) {
					return
				}
			}
		}
	}
}
