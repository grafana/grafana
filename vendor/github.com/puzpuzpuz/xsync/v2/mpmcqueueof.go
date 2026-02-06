//go:build go1.19
// +build go1.19

package xsync

import (
	"runtime"
	"sync/atomic"
	"unsafe"
)

// A MPMCQueueOf is a bounded multi-producer multi-consumer concurrent
// queue. It's a generic version of MPMCQueue.
//
// MPMCQueue instances must be created with NewMPMCQueueOf function.
// A MPMCQueueOf must not be copied after first use.
//
// Based on the data structure from the following C++ library:
// https://github.com/rigtorp/MPMCQueue
type MPMCQueueOf[I any] struct {
	cap  uint64
	head uint64
	//lint:ignore U1000 prevents false sharing
	hpad [cacheLineSize - 8]byte
	tail uint64
	//lint:ignore U1000 prevents false sharing
	tpad  [cacheLineSize - 8]byte
	slots []slotOfPadded[I]
}

type slotOfPadded[I any] struct {
	slotOf[I]
	// Unfortunately, proper padding like the below one:
	//
	// pad [cacheLineSize - (unsafe.Sizeof(slotOf[I]{}) % cacheLineSize)]byte
	//
	// won't compile, so here we add a best-effort padding for items up to
	// 56 bytes size.
	//lint:ignore U1000 prevents false sharing
	pad [cacheLineSize - unsafe.Sizeof(atomic.Uint64{})]byte
}

type slotOf[I any] struct {
	// atomic.Uint64 is used here to get proper 8 byte alignment on
	// 32-bit archs.
	turn atomic.Uint64
	item I
}

// NewMPMCQueueOf creates a new MPMCQueueOf instance with the given
// capacity.
func NewMPMCQueueOf[I any](capacity int) *MPMCQueueOf[I] {
	if capacity < 1 {
		panic("capacity must be positive number")
	}
	return &MPMCQueueOf[I]{
		cap:   uint64(capacity),
		slots: make([]slotOfPadded[I], capacity),
	}
}

// Enqueue inserts the given item into the queue.
// Blocks, if the queue is full.
func (q *MPMCQueueOf[I]) Enqueue(item I) {
	head := atomic.AddUint64(&q.head, 1) - 1
	slot := &q.slots[q.idx(head)]
	turn := q.turn(head) * 2
	for slot.turn.Load() != turn {
		runtime.Gosched()
	}
	slot.item = item
	slot.turn.Store(turn + 1)
}

// Dequeue retrieves and removes the item from the head of the queue.
// Blocks, if the queue is empty.
func (q *MPMCQueueOf[I]) Dequeue() I {
	var zeroedI I
	tail := atomic.AddUint64(&q.tail, 1) - 1
	slot := &q.slots[q.idx(tail)]
	turn := q.turn(tail)*2 + 1
	for slot.turn.Load() != turn {
		runtime.Gosched()
	}
	item := slot.item
	slot.item = zeroedI
	slot.turn.Store(turn + 1)
	return item
}

// TryEnqueue inserts the given item into the queue. Does not block
// and returns immediately. The result indicates that the queue isn't
// full and the item was inserted.
func (q *MPMCQueueOf[I]) TryEnqueue(item I) bool {
	head := atomic.LoadUint64(&q.head)
	for {
		slot := &q.slots[q.idx(head)]
		turn := q.turn(head) * 2
		if slot.turn.Load() == turn {
			if atomic.CompareAndSwapUint64(&q.head, head, head+1) {
				slot.item = item
				slot.turn.Store(turn + 1)
				return true
			}
		} else {
			prevHead := head
			head = atomic.LoadUint64(&q.head)
			if head == prevHead {
				return false
			}
		}
		runtime.Gosched()
	}
}

// TryDequeue retrieves and removes the item from the head of the
// queue. Does not block and returns immediately. The ok result
// indicates that the queue isn't empty and an item was retrieved.
func (q *MPMCQueueOf[I]) TryDequeue() (item I, ok bool) {
	tail := atomic.LoadUint64(&q.tail)
	for {
		slot := &q.slots[q.idx(tail)]
		turn := q.turn(tail)*2 + 1
		if slot.turn.Load() == turn {
			if atomic.CompareAndSwapUint64(&q.tail, tail, tail+1) {
				var zeroedI I
				item = slot.item
				ok = true
				slot.item = zeroedI
				slot.turn.Store(turn + 1)
				return
			}
		} else {
			prevTail := tail
			tail = atomic.LoadUint64(&q.tail)
			if tail == prevTail {
				return
			}
		}
		runtime.Gosched()
	}
}

func (q *MPMCQueueOf[I]) idx(i uint64) uint64 {
	return i % q.cap
}

func (q *MPMCQueueOf[I]) turn(i uint64) uint64 {
	return i / q.cap
}
