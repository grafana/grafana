package util

import (
	"container/heap"
	"sync"

	"github.com/prometheus/client_golang/prometheus"
)

// PriorityQueue is a priority queue.
type PriorityQueue struct {
	lock        sync.Mutex
	cond        *sync.Cond
	closing     bool
	closed      bool
	hit         map[string]struct{}
	queue       queue
	lengthGauge prometheus.Gauge
}

// Op is an operation on the priority queue.
type Op interface {
	Key() string
	Priority() int64 // The larger the number the higher the priority.
}

type queue []Op

func (q queue) Len() int           { return len(q) }
func (q queue) Less(i, j int) bool { return q[i].Priority() > q[j].Priority() }
func (q queue) Swap(i, j int)      { q[i], q[j] = q[j], q[i] }

// Push and Pop use pointer receivers because they modify the slice's length,
// not just its contents.
func (q *queue) Push(x interface{}) {
	*q = append(*q, x.(Op))
}

func (q *queue) Pop() interface{} {
	old := *q
	n := len(old)
	x := old[n-1]
	*q = old[0 : n-1]
	return x
}

// NewPriorityQueue makes a new priority queue.
func NewPriorityQueue(lengthGauge prometheus.Gauge) *PriorityQueue {
	pq := &PriorityQueue{
		hit:         map[string]struct{}{},
		lengthGauge: lengthGauge,
	}
	pq.cond = sync.NewCond(&pq.lock)
	heap.Init(&pq.queue)
	return pq
}

// Length returns the length of the queue.
func (pq *PriorityQueue) Length() int {
	pq.lock.Lock()
	defer pq.lock.Unlock()
	return len(pq.queue)
}

// Close signals that the queue should be closed when it is empty.
// A closed queue will not accept new items.
func (pq *PriorityQueue) Close() {
	pq.lock.Lock()
	defer pq.lock.Unlock()
	pq.closing = true
	pq.cond.Broadcast()
}

// DiscardAndClose closes the queue and removes all the items from it.
func (pq *PriorityQueue) DiscardAndClose() {
	pq.lock.Lock()
	defer pq.lock.Unlock()
	pq.closed = true
	pq.queue = nil
	pq.hit = map[string]struct{}{}
	pq.cond.Broadcast()
}

// Enqueue adds an operation to the queue in priority order. Returns
// true if added; false if the operation was already on the queue.
func (pq *PriorityQueue) Enqueue(op Op) bool {
	pq.lock.Lock()
	defer pq.lock.Unlock()

	if pq.closed {
		panic("enqueue on closed queue")
	}

	_, enqueued := pq.hit[op.Key()]
	if enqueued {
		return false
	}

	pq.hit[op.Key()] = struct{}{}
	heap.Push(&pq.queue, op)
	pq.cond.Broadcast()
	if pq.lengthGauge != nil {
		pq.lengthGauge.Inc()
	}
	return true
}

// Dequeue will return the op with the highest priority; block if queue is
// empty; returns nil if queue is closed.
func (pq *PriorityQueue) Dequeue() Op {
	pq.lock.Lock()
	defer pq.lock.Unlock()

	for len(pq.queue) == 0 && !(pq.closing || pq.closed) {
		pq.cond.Wait()
	}

	if len(pq.queue) == 0 && (pq.closing || pq.closed) {
		pq.closed = true
		return nil
	}

	op := heap.Pop(&pq.queue).(Op)
	delete(pq.hit, op.Key())
	if pq.lengthGauge != nil {
		pq.lengthGauge.Dec()
	}
	return op
}
