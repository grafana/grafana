package deque

import "fmt"

// minCapacity is the smallest capacity that deque may have. Must be power of 2
// for bitwise modulus: x % n == x & (n - 1).
const minCapacity = 16

// Deque represents a single instance of the deque data structure. A Deque
// instance contains items of the type specified by the type argument.
type Deque[T any] struct {
	buf    []T
	head   int
	tail   int
	count  int
	minCap int
}

// New creates a new Deque, optionally setting the current and minimum capacity
// when non-zero values are given for these. The Deque instance returns
// operates on items of the type specified by the type argument. For example,
// to create a Deque that contains strings,
//
//	stringDeque := deque.New[string]()
//
// To create a Deque with capacity to store 2048 ints without resizing, and
// that will not resize below space for 32 items when removing items:
//
//	d := deque.New[int](2048, 32)
//
// To create a Deque that has not yet allocated memory, but after it does will
// never resize to have space for less than 64 items:
//
//	d := deque.New[int](0, 64)
//
// Any size values supplied here are rounded up to the nearest power of 2.
func New[T any](size ...int) *Deque[T] {
	var capacity, minimum int
	if len(size) >= 1 {
		capacity = size[0]
		if len(size) >= 2 {
			minimum = size[1]
		}
	}

	minCap := minCapacity
	for minCap < minimum {
		minCap <<= 1
	}

	var buf []T
	if capacity != 0 {
		bufSize := minCap
		for bufSize < capacity {
			bufSize <<= 1
		}
		buf = make([]T, bufSize)
	}

	return &Deque[T]{
		buf:    buf,
		minCap: minCap,
	}
}

// Cap returns the current capacity of the Deque. If q is nil, q.Cap() is zero.
func (q *Deque[T]) Cap() int {
	if q == nil {
		return 0
	}
	return len(q.buf)
}

// Len returns the number of elements currently stored in the queue. If q is
// nil, q.Len() is zero.
func (q *Deque[T]) Len() int {
	if q == nil {
		return 0
	}
	return q.count
}

// PushBack appends an element to the back of the queue. Implements FIFO when
// elements are removed with PopFront, and LIFO when elements are removed with
// PopBack.
func (q *Deque[T]) PushBack(elem T) {
	q.growIfFull()

	q.buf[q.tail] = elem
	// Calculate new tail position.
	q.tail = q.next(q.tail)
	q.count++
}

// PushFront prepends an element to the front of the queue.
func (q *Deque[T]) PushFront(elem T) {
	q.growIfFull()

	// Calculate new head position.
	q.head = q.prev(q.head)
	q.buf[q.head] = elem
	q.count++
}

// PopFront removes and returns the element from the front of the queue.
// Implements FIFO when used with PushBack. If the queue is empty, the call
// panics.
func (q *Deque[T]) PopFront() T {
	if q.count <= 0 {
		panic("deque: PopFront() called on empty queue")
	}
	ret := q.buf[q.head]
	var zero T
	q.buf[q.head] = zero
	// Calculate new head position.
	q.head = q.next(q.head)
	q.count--

	q.shrinkIfExcess()
	return ret
}

// PopBack removes and returns the element from the back of the queue.
// Implements LIFO when used with PushBack. If the queue is empty, the call
// panics.
func (q *Deque[T]) PopBack() T {
	if q.count <= 0 {
		panic("deque: PopBack() called on empty queue")
	}

	// Calculate new tail position
	q.tail = q.prev(q.tail)

	// Remove value at tail.
	ret := q.buf[q.tail]
	var zero T
	q.buf[q.tail] = zero
	q.count--

	q.shrinkIfExcess()
	return ret
}

// Front returns the element at the front of the queue. This is the element
// that would be returned by PopFront. This call panics if the queue is empty.
func (q *Deque[T]) Front() T {
	if q.count <= 0 {
		panic("deque: Front() called when empty")
	}
	return q.buf[q.head]
}

// Back returns the element at the back of the queue. This is the element that
// would be returned by PopBack. This call panics if the queue is empty.
func (q *Deque[T]) Back() T {
	if q.count <= 0 {
		panic("deque: Back() called when empty")
	}
	return q.buf[q.prev(q.tail)]
}

// At returns the element at index i in the queue without removing the element
// from the queue. This method accepts only non-negative index values. At(0)
// refers to the first element and is the same as Front(). At(Len()-1) refers
// to the last element and is the same as Back(). If the index is invalid, the
// call panics.
//
// The purpose of At is to allow Deque to serve as a more general purpose
// circular buffer, where items are only added to and removed from the ends of
// the deque, but may be read from any place within the deque. Consider the
// case of a fixed-size circular log buffer: A new entry is pushed onto one end
// and when full the oldest is popped from the other end. All the log entries
// in the buffer must be readable without altering the buffer contents.
func (q *Deque[T]) At(i int) T {
	if i < 0 || i >= q.count {
		panic(outOfRangeText(i, q.Len()))
	}
	// bitwise modulus
	return q.buf[(q.head+i)&(len(q.buf)-1)]
}

// Set assigns the item to index i in the queue. Set indexes the deque the same
// as At but perform the opposite operation. If the index is invalid, the call
// panics.
func (q *Deque[T]) Set(i int, item T) {
	if i < 0 || i >= q.count {
		panic(outOfRangeText(i, q.Len()))
	}
	// bitwise modulus
	q.buf[(q.head+i)&(len(q.buf)-1)] = item
}

// Clear removes all elements from the queue, but retains the current capacity.
// This is useful when repeatedly reusing the queue at high frequency to avoid
// GC during reuse. The queue will not be resized smaller as long as items are
// only added. Only when items are removed is the queue subject to getting
// resized smaller.
func (q *Deque[T]) Clear() {
	var zero T
	modBits := len(q.buf) - 1
	h := q.head
	for i := 0; i < q.Len(); i++ {
		q.buf[(h+i)&modBits] = zero
	}
	q.head = 0
	q.tail = 0
	q.count = 0
}

// Rotate rotates the deque n steps front-to-back. If n is negative, rotates
// back-to-front. Having Deque provide Rotate avoids resizing that could happen
// if implementing rotation using only Pop and Push methods. If q.Len() is one
// or less, or q is nil, then Rotate does nothing.
func (q *Deque[T]) Rotate(n int) {
	if q.Len() <= 1 {
		return
	}
	// Rotating a multiple of q.count is same as no rotation.
	n %= q.count
	if n == 0 {
		return
	}

	modBits := len(q.buf) - 1
	// If no empty space in buffer, only move head and tail indexes.
	if q.head == q.tail {
		// Calculate new head and tail using bitwise modulus.
		q.head = (q.head + n) & modBits
		q.tail = q.head
		return
	}

	var zero T

	if n < 0 {
		// Rotate back to front.
		for ; n < 0; n++ {
			// Calculate new head and tail using bitwise modulus.
			q.head = (q.head - 1) & modBits
			q.tail = (q.tail - 1) & modBits
			// Put tail value at head and remove value at tail.
			q.buf[q.head] = q.buf[q.tail]
			q.buf[q.tail] = zero
		}
		return
	}

	// Rotate front to back.
	for ; n > 0; n-- {
		// Put head value at tail and remove value at head.
		q.buf[q.tail] = q.buf[q.head]
		q.buf[q.head] = zero
		// Calculate new head and tail using bitwise modulus.
		q.head = (q.head + 1) & modBits
		q.tail = (q.tail + 1) & modBits
	}
}

// Index returns the index into the Deque of the first item satisfying f(item),
// or -1 if none do. If q is nil, then -1 is always returned. Search is linear
// starting with index 0.
func (q *Deque[T]) Index(f func(T) bool) int {
	if q.Len() > 0 {
		modBits := len(q.buf) - 1
		for i := 0; i < q.count; i++ {
			if f(q.buf[(q.head+i)&modBits]) {
				return i
			}
		}
	}
	return -1
}

// RIndex is the same as Index, but searches from Back to Front. The index
// returned is from Front to Back, where index 0 is the index of the item
// returned by Front().
func (q *Deque[T]) RIndex(f func(T) bool) int {
	if q.Len() > 0 {
		modBits := len(q.buf) - 1
		for i := q.count - 1; i >= 0; i-- {
			if f(q.buf[(q.head+i)&modBits]) {
				return i
			}
		}
	}
	return -1
}

// Insert is used to insert an element into the middle of the queue, before the
// element at the specified index. Insert(0,e) is the same as PushFront(e) and
// Insert(Len(),e) is the same as PushBack(e). Accepts only non-negative index
// values, and panics if index is out of range.
//
// Important: Deque is optimized for O(1) operations at the ends of the queue,
// not for operations in the the middle. Complexity of this function is
// constant plus linear in the lesser of the distances between the index and
// either of the ends of the queue.
func (q *Deque[T]) Insert(at int, item T) {
	if at < 0 || at > q.count {
		panic(outOfRangeText(at, q.Len()))
	}
	if at*2 < q.count {
		q.PushFront(item)
		front := q.head
		for i := 0; i < at; i++ {
			next := q.next(front)
			q.buf[front], q.buf[next] = q.buf[next], q.buf[front]
			front = next
		}
		return
	}
	swaps := q.count - at
	q.PushBack(item)
	back := q.prev(q.tail)
	for i := 0; i < swaps; i++ {
		prev := q.prev(back)
		q.buf[back], q.buf[prev] = q.buf[prev], q.buf[back]
		back = prev
	}
}

// Remove removes and returns an element from the middle of the queue, at the
// specified index. Remove(0) is the same as PopFront() and Remove(Len()-1) is
// the same as PopBack(). Accepts only non-negative index values, and panics if
// index is out of range.
//
// Important: Deque is optimized for O(1) operations at the ends of the queue,
// not for operations in the the middle. Complexity of this function is
// constant plus linear in the lesser of the distances between the index and
// either of the ends of the queue.
func (q *Deque[T]) Remove(at int) T {
	if at < 0 || at >= q.Len() {
		panic(outOfRangeText(at, q.Len()))
	}

	rm := (q.head + at) & (len(q.buf) - 1)
	if at*2 < q.count {
		for i := 0; i < at; i++ {
			prev := q.prev(rm)
			q.buf[prev], q.buf[rm] = q.buf[rm], q.buf[prev]
			rm = prev
		}
		return q.PopFront()
	}
	swaps := q.count - at - 1
	for i := 0; i < swaps; i++ {
		next := q.next(rm)
		q.buf[rm], q.buf[next] = q.buf[next], q.buf[rm]
		rm = next
	}
	return q.PopBack()
}

// SetMinCapacity sets a minimum capacity of 2^minCapacityExp. If the value of
// the minimum capacity is less than or equal to the minimum allowed, then
// capacity is set to the minimum allowed. This may be called at anytime to set
// a new minimum capacity.
//
// Setting a larger minimum capacity may be used to prevent resizing when the
// number of stored items changes frequently across a wide range.
func (q *Deque[T]) SetMinCapacity(minCapacityExp uint) {
	if 1<<minCapacityExp > minCapacity {
		q.minCap = 1 << minCapacityExp
	} else {
		q.minCap = minCapacity
	}
}

// prev returns the previous buffer position wrapping around buffer.
func (q *Deque[T]) prev(i int) int {
	return (i - 1) & (len(q.buf) - 1) // bitwise modulus
}

// next returns the next buffer position wrapping around buffer.
func (q *Deque[T]) next(i int) int {
	return (i + 1) & (len(q.buf) - 1) // bitwise modulus
}

// growIfFull resizes up if the buffer is full.
func (q *Deque[T]) growIfFull() {
	if q.count != len(q.buf) {
		return
	}
	if len(q.buf) == 0 {
		if q.minCap == 0 {
			q.minCap = minCapacity
		}
		q.buf = make([]T, q.minCap)
		return
	}
	q.resize()
}

// shrinkIfExcess resize down if the buffer 1/4 full.
func (q *Deque[T]) shrinkIfExcess() {
	if len(q.buf) > q.minCap && (q.count<<2) == len(q.buf) {
		q.resize()
	}
}

// resize resizes the deque to fit exactly twice its current contents. This is
// used to grow the queue when it is full, and also to shrink it when it is
// only a quarter full.
func (q *Deque[T]) resize() {
	newBuf := make([]T, q.count<<1)
	if q.tail > q.head {
		copy(newBuf, q.buf[q.head:q.tail])
	} else {
		n := copy(newBuf, q.buf[q.head:])
		copy(newBuf[n:], q.buf[:q.tail])
	}

	q.head = 0
	q.tail = q.count
	q.buf = newBuf
}

func outOfRangeText(i, len int) string {
	return fmt.Sprintf("deque: index out of range %d with length %d", i, len)
}
