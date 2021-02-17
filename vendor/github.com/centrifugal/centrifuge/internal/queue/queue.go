package queue

import (
	"sync"
)

// Queue is an unbounded queue of []byte.
// The queue is goroutine safe.
// Inspired by http://blog.dubbelboer.com/2015/04/25/go-faster-queue.html (MIT)
type Queue interface {
	// Add an []byte to the back of the queue
	// will return false if the queue is closed.
	// In that case the []byte is dropped.
	Add([]byte) bool

	// Remove will remove a []byte from the queue.
	// If false is returned, it either means 1) there were no items on the queue
	// or 2) the queue is closed.
	Remove() ([]byte, bool)

	// Close the queue and discard all entries in the queue
	// all goroutines in wait() will return
	Close()

	// CloseRemaining will close the queue and return all entries in the queue.
	// All goroutines in wait() will return
	CloseRemaining() [][]byte

	// Closed returns true if the queue has been closed
	// The call cannot guarantee that the queue hasn't been
	// closed while the function returns, so only "true" has a definite meaning.
	Closed() bool

	// Wait for a []byte to be added or queue to be closed.
	// If there is items on the queue the first will
	// be returned immediately.
	// Will return "", false if the queue is closed.
	// Otherwise the return value of "remove" is returned.
	Wait() bool

	// Cap returns the capacity (without allocations).
	Cap() int

	// Len returns the current length of the queue.
	Len() int

	// Size returns the current size of the queue in bytes.
	Size() int
}

type byteQueue struct {
	mu      sync.RWMutex
	cond    *sync.Cond
	nodes   [][]byte
	head    int
	tail    int
	cnt     int
	size    int
	closed  bool
	initCap int
}

var initialCapacity = 2

// New ByteQueue returns a new []byte queue with initial capacity.
func New() Queue {
	sq := &byteQueue{
		initCap: initialCapacity,
		nodes:   make([][]byte, initialCapacity),
	}
	sq.cond = sync.NewCond(&sq.mu)
	return sq
}

// Write mutex must be held when calling
func (q *byteQueue) resize(n int) {
	nodes := make([][]byte, n)
	if q.head < q.tail {
		copy(nodes, q.nodes[q.head:q.tail])
	} else {
		copy(nodes, q.nodes[q.head:])
		copy(nodes[len(q.nodes)-q.head:], q.nodes[:q.tail])
	}

	q.tail = q.cnt % n
	q.head = 0
	q.nodes = nodes
}

// Add a []byte to the back of the queue
// will return false if the queue is closed.
// In that case the []byte is dropped.
func (q *byteQueue) Add(i []byte) bool {
	q.mu.Lock()
	if q.closed {
		q.mu.Unlock()
		return false
	}
	if q.cnt == len(q.nodes) {
		// Also tested a grow rate of 1.5, see: http://stackoverflow.com/questions/2269063/buffer-growth-strategy
		// In Go this resulted in a higher memory usage.
		q.resize(q.cnt * 2)
	}
	q.nodes[q.tail] = i
	q.tail = (q.tail + 1) % len(q.nodes)
	q.size += len(i)
	q.cnt++
	q.cond.Signal()
	q.mu.Unlock()
	return true
}

// Close the queue and discard all entries in the queue
// all goroutines in wait() will return
func (q *byteQueue) Close() {
	q.mu.Lock()
	defer q.mu.Unlock()
	q.closed = true
	q.cnt = 0
	q.nodes = nil
	q.size = 0
	q.cond.Broadcast()
}

// CloseRemaining will close the queue and return all entries in the queue.
// All goroutines in wait() will return.
func (q *byteQueue) CloseRemaining() [][]byte {
	q.mu.Lock()
	defer q.mu.Unlock()
	if q.closed {
		return [][]byte{}
	}
	rem := make([][]byte, 0, q.cnt)
	for q.cnt > 0 {
		i := q.nodes[q.head]
		q.head = (q.head + 1) % len(q.nodes)
		q.cnt--
		rem = append(rem, i)
	}
	q.closed = true
	q.cnt = 0
	q.nodes = nil
	q.size = 0
	q.cond.Broadcast()
	return rem
}

// Closed returns true if the queue has been closed
// The call cannot guarantee that the queue hasn't been
// closed while the function returns, so only "true" has a definite meaning.
func (q *byteQueue) Closed() bool {
	q.mu.RLock()
	c := q.closed
	q.mu.RUnlock()
	return c
}

// Wait for a message to be added.
// If there are items on the queue will return immediately.
// Will return false if the queue is closed.
// Otherwise returns true.
func (q *byteQueue) Wait() bool {
	q.mu.Lock()
	if q.closed {
		q.mu.Unlock()
		return false
	}
	if q.cnt != 0 {
		q.mu.Unlock()
		return true
	}
	q.cond.Wait()
	q.mu.Unlock()
	return true
}

// Remove will remove a []byte from the queue.
// If false is returned, it either means 1) there were no items on the queue
// or 2) the queue is closed.
func (q *byteQueue) Remove() ([]byte, bool) {
	q.mu.Lock()
	if q.cnt == 0 {
		q.mu.Unlock()
		return nil, false
	}
	i := q.nodes[q.head]
	q.head = (q.head + 1) % len(q.nodes)
	q.cnt--
	q.size -= len(i)

	if n := len(q.nodes) / 2; n >= q.initCap && q.cnt <= n {
		q.resize(n)
	}

	q.mu.Unlock()
	return i, true
}

// Cap returns the capacity (without allocations)
func (q *byteQueue) Cap() int {
	q.mu.RLock()
	c := cap(q.nodes)
	q.mu.RUnlock()
	return c
}

// Len returns the current length of the queue.
func (q *byteQueue) Len() int {
	q.mu.RLock()
	l := q.cnt
	q.mu.RUnlock()
	return l
}

// Size returns the current size of the queue.
func (q *byteQueue) Size() int {
	q.mu.RLock()
	s := q.size
	q.mu.RUnlock()
	return s
}
