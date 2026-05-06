package seq

import "iter"

// SeqReader is a struct that provides functionality for reading from an iter.Seq value.
//
// SeqReader is provided as a way to read chunks of values from an iter.Seq without needing
// to allocate a new slice for each chunk.
type SeqReader[T any] struct {
	// next is the function returned by iter.Pull that provides the next available
	// element from the iter.Seq.
	next func() (T, bool)

	// stop is the function returned by iter.Pull that signals that the iter.Seq will
	// no longer be iterated.
	stop func()
}

// Read is a function that fills the given buffer with elements from the internal iter.Seq value.
// A count of total items read into the buffer is returned. The count returned will be less than
// the size of the buffer when fewer items remain in the internal iter.Seq value. In this case,
// the sequence is complete and subsequent calls to Read will return a count of 0.
func (r *SeqReader[T]) Read(buf []T) int {
	var head int

	for head < len(buf) {
		value, ok := r.next()
		if !ok {
			r.stop()
			break
		}

		buf[head] = value
		head++
	}
	return head
}

// Close is a function that indicates that the caller will not continue to read from the iter.Seq.
// A call to Read after calling Close is considered a programming error.
func (r *SeqReader[T]) Close() error {
	r.stop()
	return nil
}

// NewSeqReader is a function that constructs a new SeqReader that wraps the given iter.Seq value.
func NewSeqReader[T any](seq iter.Seq[T]) *SeqReader[T] {
	next, stop := iter.Pull(seq)
	return &SeqReader[T]{
		next: next,
		stop: stop,
	}
}
