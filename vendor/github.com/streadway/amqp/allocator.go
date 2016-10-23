package amqp

import (
	"bytes"
	"fmt"
	"math/big"
)

const (
	free      = 0
	allocated = 1
)

// allocator maintains a bitset of allocated numbers.
type allocator struct {
	pool *big.Int
	last int
	low  int
	high int
}

// NewAllocator reserves and frees integers out of a range between low and
// high.
//
// O(N) worst case space used, where N is maximum allocated, divided by
// sizeof(big.Word)
func newAllocator(low, high int) *allocator {
	return &allocator{
		pool: big.NewInt(0),
		last: low,
		low:  low,
		high: high,
	}
}

// String returns a string describing the contents of the allocator like
// "allocator[low..high] reserved..until"
//
// O(N) where N is high-low
func (a allocator) String() string {
	b := &bytes.Buffer{}
	fmt.Fprintf(b, "allocator[%d..%d]", a.low, a.high)

	for low := a.low; low <= a.high; low++ {
		high := low
		for a.reserved(high) && high <= a.high {
			high++
		}

		if high > low+1 {
			fmt.Fprintf(b, " %d..%d", low, high-1)
		} else if high > low {
			fmt.Fprintf(b, " %d", high-1)
		}

		low = high
	}
	return b.String()
}

// Next reserves and returns the next available number out of the range between
// low and high.  If no number is available, false is returned.
//
// O(N) worst case runtime where N is allocated, but usually O(1) due to a
// rolling index into the oldest allocation.
func (a *allocator) next() (int, bool) {
	wrapped := a.last

	// Find trailing bit
	for ; a.last <= a.high; a.last++ {
		if a.reserve(a.last) {
			return a.last, true
		}
	}

	// Find preceeding free'd pool
	a.last = a.low

	for ; a.last < wrapped; a.last++ {
		if a.reserve(a.last) {
			return a.last, true
		}
	}

	return 0, false
}

// reserve claims the bit if it is not already claimed, returning true if
// succesfully claimed.
func (a *allocator) reserve(n int) bool {
	if a.reserved(n) {
		return false
	}
	a.pool.SetBit(a.pool, n-a.low, allocated)
	return true
}

// reserved returns true if the integer has been allocated
func (a *allocator) reserved(n int) bool {
	return a.pool.Bit(n-a.low) == allocated
}

// release frees the use of the number for another allocation
func (a *allocator) release(n int) {
	a.pool.SetBit(a.pool, n-a.low, free)
}
