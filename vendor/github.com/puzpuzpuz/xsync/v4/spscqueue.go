package xsync

import (
	"sync/atomic"
)

// Deprecated: use [SPSCQueue].
type SPSCQueueOf[I any] = SPSCQueue[I]

// A SPSCQueue is a bounded single-producer single-consumer concurrent
// queue. This means that not more than a single goroutine must be
// publishing items to the queue while not more than a single goroutine
// must be consuming those items.
//
// SPSCQueue instances must be created with NewSPSCQueue function.
// A SPSCQueue must not be copied after first use.
//
// Based on the data structure from the following article:
// https://rigtorp.se/ringbuffer/
type SPSCQueue[I any] struct {
	cap  uint64
	pidx uint64
	// Padding to prevent false sharing.
	_          [cacheLineSize - 8]byte
	pcachedIdx uint64
	_          [cacheLineSize - 8]byte
	cidx       uint64
	_          [cacheLineSize - 8]byte
	ccachedIdx uint64
	_          [cacheLineSize - 8]byte
	items      []I
}

// Deprecated: use [NewSPSCQueue].
func NewSPSCQueueOf[I any](capacity int) *SPSCQueue[I] {
	return NewSPSCQueue[I](capacity)
}

// NewSPSCQueue creates a new SPSCQueue instance with the given
// capacity.
func NewSPSCQueue[I any](capacity int) *SPSCQueue[I] {
	if capacity < 1 {
		panic("capacity must be positive number")
	}
	return &SPSCQueue[I]{
		cap:   uint64(capacity + 1),
		items: make([]I, capacity+1),
	}
}

// TryEnqueue inserts the given item into the queue. Does not block
// and returns immediately. The result indicates that the queue isn't
// full and the item was inserted.
func (q *SPSCQueue[I]) TryEnqueue(item I) bool {
	// relaxed memory order would be enough here
	idx := atomic.LoadUint64(&q.pidx)
	next_idx := idx + 1
	if next_idx == q.cap {
		next_idx = 0
	}
	cached_idx := q.ccachedIdx
	if next_idx == cached_idx {
		cached_idx = atomic.LoadUint64(&q.cidx)
		q.ccachedIdx = cached_idx
		if next_idx == cached_idx {
			return false
		}
	}
	q.items[idx] = item
	atomic.StoreUint64(&q.pidx, next_idx)
	return true
}

// TryDequeue retrieves and removes the item from the head of the
// queue. Does not block and returns immediately. The ok result
// indicates that the queue isn't empty and an item was retrieved.
func (q *SPSCQueue[I]) TryDequeue() (item I, ok bool) {
	// relaxed memory order would be enough here
	idx := atomic.LoadUint64(&q.cidx)
	cached_idx := q.pcachedIdx
	if idx == cached_idx {
		cached_idx = atomic.LoadUint64(&q.pidx)
		q.pcachedIdx = cached_idx
		if idx == cached_idx {
			return
		}
	}
	var zeroI I
	item = q.items[idx]
	q.items[idx] = zeroI
	ok = true
	next_idx := idx + 1
	if next_idx == q.cap {
		next_idx = 0
	}
	atomic.StoreUint64(&q.cidx, next_idx)
	return
}
