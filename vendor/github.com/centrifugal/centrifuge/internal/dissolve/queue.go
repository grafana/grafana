package dissolve

import (
	"sync"
)

// Job to do.
type Job func() error

// queue is an unbounded queue of Job.
// The queue is goroutine safe.
// Inspired by http://blog.dubbelboer.com/2015/04/25/go-faster-queue.html (MIT)
type queue interface {
	// Add an Job to the back of the queue
	// will return false if the queue is closed.
	// In that case the Job is dropped.
	Add(Job) bool

	// Remove will remove a Job from the queue.
	// If false is returned, it either means 1) there were no items on the queue
	// or 2) the queue is closed.
	Remove() (Job, bool)

	// Close the queue and discard all entries in the queue
	// all goroutines in wait() will return
	Close()

	// Closed returns true if the queue has been closed
	// The call cannot guarantee that the queue hasn't been
	// closed while the function returns, so only "true" has a definite meaning.
	Closed() bool

	// Wait for a Job to be added or queue to be closed.
	// If there is items on the queue the first will
	// be returned immediately.
	// Will return "", false if the queue is closed.
	// Otherwise the return value of "remove" is returned.
	Wait() (Job, bool)
}

type queueImpl struct {
	mu      sync.RWMutex
	cond    *sync.Cond
	nodes   []Job
	head    int
	tail    int
	cnt     int
	size    int
	closed  bool
	initCap int
}

var initialCapacity = 2

// newQueue returns a new Job queue with initial capacity.
func newQueue() queue {
	sq := &queueImpl{
		initCap: initialCapacity,
		nodes:   make([]Job, initialCapacity),
	}
	sq.cond = sync.NewCond(&sq.mu)
	return sq
}

// Write mutex must be held when calling
func (q *queueImpl) resize(n int) {
	nodes := make([]Job, n)
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

// Add a Job to the back of the queue
// will return false if the queue is closed.
// In that case the Job is dropped.
func (q *queueImpl) Add(i Job) bool {
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
	q.cnt++
	q.cond.Signal()
	q.mu.Unlock()
	return true
}

// Close the queue and discard all entries in the queue
// all goroutines in wait() will return
func (q *queueImpl) Close() {
	q.mu.Lock()
	defer q.mu.Unlock()
	q.closed = true
	q.cnt = 0
	q.nodes = nil
	q.size = 0
	q.cond.Broadcast()
}

// Closed returns true if the queue has been closed
// The call cannot guarantee that the queue hasn't been
// closed while the function returns, so only "true" has a definite meaning.
func (q *queueImpl) Closed() bool {
	q.mu.RLock()
	c := q.closed
	q.mu.RUnlock()
	return c
}

// Wait for a Job to be added.
// If there is items on the queue the first will
// be returned immediately.
// Will return nil, false if the queue is closed.
// Otherwise the return value of "remove" is returned.
func (q *queueImpl) Wait() (Job, bool) {
	q.mu.Lock()
	if q.closed {
		q.mu.Unlock()
		return nil, false
	}
	if q.cnt != 0 {
		q.mu.Unlock()
		return q.Remove()
	}
	q.cond.Wait()
	q.mu.Unlock()
	return q.Remove()
}

// Remove will remove a Job from the queue.
// If false is returned, it either means 1) there were no items on the queue
// or 2) the queue is closed.
func (q *queueImpl) Remove() (Job, bool) {
	q.mu.Lock()
	if q.cnt == 0 {
		q.mu.Unlock()
		return nil, false
	}
	i := q.nodes[q.head]
	q.head = (q.head + 1) % len(q.nodes)
	q.cnt--

	if n := len(q.nodes) / 2; n >= q.initCap && q.cnt <= n {
		q.resize(n)
	}

	q.mu.Unlock()
	return i, true
}
