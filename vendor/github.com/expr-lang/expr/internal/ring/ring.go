package ring

// Ring is a very simple ring buffer implementation that uses a slice. The
// internal slice will only grow, never shrink. When it grows, it grows in
// chunks of "chunkSize" (given as argument in the [New] function). Pointer and
// reference types can be safely used because memory is cleared.
type Ring[T any] struct {
	data                 []T
	back, len, chunkSize int
}

func New[T any](chunkSize int) *Ring[T] {
	if chunkSize < 1 {
		panic("chunkSize must be greater than zero")
	}
	return &Ring[T]{
		chunkSize: chunkSize,
	}
}

func (r *Ring[T]) Len() int {
	return r.len
}

func (r *Ring[T]) Cap() int {
	return len(r.data)
}

func (r *Ring[T]) Reset() {
	var zero T
	for i := range r.data {
		r.data[i] = zero // clear mem, optimized by the compiler, in Go 1.21 the "clear" builtin can be used
	}
	r.back = 0
	r.len = 0
}

// Nth returns the n-th oldest value (zero-based) in the ring without making
// any change.
func (r *Ring[T]) Nth(n int) (v T, ok bool) {
	if n < 0 || n >= r.len || len(r.data) == 0 {
		return v, false
	}
	n = (n + r.back) % len(r.data)
	return r.data[n], true
}

// Dequeue returns the oldest value.
func (r *Ring[T]) Dequeue() (v T, ok bool) {
	if r.len == 0 {
		return v, false
	}
	v, r.data[r.back] = r.data[r.back], v // retrieve and clear mem
	r.len--
	r.back = (r.back + 1) % len(r.data)
	return v, true
}

// Enqueue adds an item to the ring.
func (r *Ring[T]) Enqueue(v T) {
	if r.len == len(r.data) {
		r.grow()
	}
	writePos := (r.back + r.len) % len(r.data)
	r.data[writePos] = v
	r.len++
}

func (r *Ring[T]) grow() {
	s := make([]T, len(r.data)+r.chunkSize)
	if r.len > 0 {
		chunk1 := r.back + r.len
		if chunk1 > len(r.data) {
			chunk1 = len(r.data)
		}
		copied := copy(s, r.data[r.back:chunk1])

		if copied < r.len { // wrapped slice
			chunk2 := r.len - copied
			copy(s[copied:], r.data[:chunk2])
		}
	}
	r.back = 0
	r.data = s
}
