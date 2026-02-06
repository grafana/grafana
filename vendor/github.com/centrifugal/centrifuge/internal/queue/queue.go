package queue

import (
	"sync"

	"github.com/centrifugal/protocol"
)

type Item struct {
	Data      []byte
	Channel   string
	FrameType protocol.FrameType
}

// Queue is an unbounded queue of Item.
// The queue is goroutine safe.
// Inspired by http://blog.dubbelboer.com/2015/04/25/go-faster-queue.html (MIT).
type Queue struct {
	mu      sync.RWMutex
	cond    *sync.Cond
	nodes   []Item
	head    int
	tail    int
	cnt     int
	size    int
	closed  bool
	initCap int
}

// New Queue returns a new Item queue with initial capacity.
func New(initialCapacity int) *Queue {
	sq := &Queue{
		initCap: initialCapacity,
		nodes:   make([]Item, initialCapacity),
	}
	sq.cond = sync.NewCond(&sq.mu)
	return sq
}

func (q *Queue) resize(n int) {
	nodes := make([]Item, n)
	// Handle empty queue case.
	if q.cnt == 0 {
		q.head = 0
		q.tail = 0
		q.nodes = nodes
		return
	}
	// Normal case: copy the items from the old slice.
	if q.head < q.tail {
		copy(nodes, q.nodes[q.head:q.tail])
	} else {
		// Copy the segment from head to end.
		copied := copy(nodes, q.nodes[q.head:])
		// Copy the segment from beginning to tail.
		copy(nodes[copied:], q.nodes[:q.tail])
	}
	q.tail = q.cnt % n
	q.head = 0
	q.nodes = nodes
}

// Add an Item to the back of the queue
// will return false if the queue is closed.
// In that case the Item is dropped.
func (q *Queue) Add(i Item) bool {
	q.mu.Lock()
	if q.closed {
		q.mu.Unlock()
		return false
	}
	if q.cnt == len(q.nodes) {
		// Also tested a growth rate of 1.5, see: http://stackoverflow.com/questions/2269063/buffer-growth-strategy
		// In Go this resulted in a higher memory usage.
		q.resize(q.cnt * 2)
	}
	q.nodes[q.tail] = i
	q.tail = (q.tail + 1) % len(q.nodes)
	q.size += len(i.Data)
	q.cnt++
	q.cond.Signal()
	q.mu.Unlock()
	return true
}

// AddMany items.
func (q *Queue) AddMany(items ...Item) bool {
	q.mu.Lock()
	if q.closed {
		q.mu.Unlock()
		return false
	}
	for _, i := range items {
		if q.cnt == len(q.nodes) {
			q.resize(q.cnt * 2)
		}
		q.nodes[q.tail] = i
		q.tail = (q.tail + 1) % len(q.nodes)
		q.size += len(i.Data)
		q.cnt++
	}
	q.cond.Signal()
	q.mu.Unlock()
	return true
}

// Close the queue and discard all entries in the queue
// all goroutines in wait() will return
func (q *Queue) Close() {
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
func (q *Queue) CloseRemaining() []Item {
	q.mu.Lock()
	defer q.mu.Unlock()
	if q.closed {
		return []Item{}
	}
	rem := make([]Item, 0, q.cnt)
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
func (q *Queue) Closed() bool {
	q.mu.RLock()
	c := q.closed
	q.mu.RUnlock()
	return c
}

// Wait for a message to be added.
// If there are items on the queue will return immediately.
// Will return false if the queue is closed.
// Otherwise, returns true.
func (q *Queue) Wait() bool {
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

// Remove will remove an Item from the queue.
// If false is returned, it either means 1) there were no items on the queue
// or 2) the queue is closed.
func (q *Queue) Remove() (Item, bool) {
	q.mu.Lock()
	if q.cnt == 0 {
		q.mu.Unlock()
		return Item{}, false
	}
	i := q.nodes[q.head]
	q.head = (q.head + 1) % len(q.nodes)
	q.cnt--
	q.size -= len(i.Data)

	if n := len(q.nodes) / 2; n >= q.initCap && q.cnt <= n {
		q.resize(n)
	}

	q.mu.Unlock()
	return i, true
}

// RemoveMany removes up to maxItems items from the queue.
// If maxItems is -1, it removes all available items.
// It returns the slice of removed items and a boolean indicating whether
// at least one item was removed (false means no messages were available).
func (q *Queue) RemoveMany(maxItems int) ([]Item, bool) {
	q.mu.Lock()

	// Return false if there are no messages.
	if q.cnt == 0 {
		q.mu.Unlock()
		return nil, false
	}

	// Determine how many messages to remove.
	var count int
	if maxItems == -1 || q.cnt < maxItems {
		count = q.cnt
	} else {
		count = maxItems
	}

	messages := make([]Item, 0, count)

	for i := 0; i < count; i++ {
		msg := q.nodes[q.head]
		q.head = (q.head + 1) % len(q.nodes)
		messages = append(messages, msg)
		q.cnt--
		q.size -= len(msg.Data)
	}

	// Find n to resize to.
	n := -1
	k := len(q.nodes) / 2
	for {
		if k >= q.initCap && q.cnt <= k {
			n = k
		} else {
			break
		}
		k /= 2
	}
	if n != -1 {
		q.resize(n)
	}

	q.mu.Unlock()
	return messages, true
}

// Cap returns the capacity (without allocations)
func (q *Queue) Cap() int {
	q.mu.RLock()
	c := cap(q.nodes)
	q.mu.RUnlock()
	return c
}

// Len returns the current length of the queue.
func (q *Queue) Len() int {
	q.mu.RLock()
	l := q.cnt
	q.mu.RUnlock()
	return l
}

// Size returns the current size of the queue.
func (q *Queue) Size() int {
	q.mu.RLock()
	s := q.size
	q.mu.RUnlock()
	return s
}
