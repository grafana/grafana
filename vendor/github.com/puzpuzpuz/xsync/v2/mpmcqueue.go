package xsync

import (
	"runtime"
	"sync/atomic"
	"unsafe"
)

// A MPMCQueue is a bounded multi-producer multi-consumer concurrent
// queue.
//
// MPMCQueue instances must be created with NewMPMCQueue function.
// A MPMCQueue must not be copied after first use.
//
// Based on the data structure from the following C++ library:
// https://github.com/rigtorp/MPMCQueue
type MPMCQueue struct {
	cap  uint64
	head uint64
	//lint:ignore U1000 prevents false sharing
	hpad [cacheLineSize - 8]byte
	tail uint64
	//lint:ignore U1000 prevents false sharing
	tpad  [cacheLineSize - 8]byte
	slots []slotPadded
}

type slotPadded struct {
	slot
	//lint:ignore U1000 prevents false sharing
	pad [cacheLineSize - unsafe.Sizeof(slot{})]byte
}

type slot struct {
	turn uint64
	item interface{}
}

// NewMPMCQueue creates a new MPMCQueue instance with the given
// capacity.
func NewMPMCQueue(capacity int) *MPMCQueue {
	if capacity < 1 {
		panic("capacity must be positive number")
	}
	return &MPMCQueue{
		cap:   uint64(capacity),
		slots: make([]slotPadded, capacity),
	}
}

// Enqueue inserts the given item into the queue.
// Blocks, if the queue is full.
func (q *MPMCQueue) Enqueue(item interface{}) {
	head := atomic.AddUint64(&q.head, 1) - 1
	slot := &q.slots[q.idx(head)]
	turn := q.turn(head) * 2
	for atomic.LoadUint64(&slot.turn) != turn {
		runtime.Gosched()
	}
	slot.item = item
	atomic.StoreUint64(&slot.turn, turn+1)
}

// Dequeue retrieves and removes the item from the head of the queue.
// Blocks, if the queue is empty.
func (q *MPMCQueue) Dequeue() interface{} {
	tail := atomic.AddUint64(&q.tail, 1) - 1
	slot := &q.slots[q.idx(tail)]
	turn := q.turn(tail)*2 + 1
	for atomic.LoadUint64(&slot.turn) != turn {
		runtime.Gosched()
	}
	item := slot.item
	slot.item = nil
	atomic.StoreUint64(&slot.turn, turn+1)
	return item
}

// TryEnqueue inserts the given item into the queue. Does not block
// and returns immediately. The result indicates that the queue isn't
// full and the item was inserted.
func (q *MPMCQueue) TryEnqueue(item interface{}) bool {
	head := atomic.LoadUint64(&q.head)
	for {
		slot := &q.slots[q.idx(head)]
		turn := q.turn(head) * 2
		if atomic.LoadUint64(&slot.turn) == turn {
			if atomic.CompareAndSwapUint64(&q.head, head, head+1) {
				slot.item = item
				atomic.StoreUint64(&slot.turn, turn+1)
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
func (q *MPMCQueue) TryDequeue() (item interface{}, ok bool) {
	tail := atomic.LoadUint64(&q.tail)
	for {
		slot := &q.slots[q.idx(tail)]
		turn := q.turn(tail)*2 + 1
		if atomic.LoadUint64(&slot.turn) == turn {
			if atomic.CompareAndSwapUint64(&q.tail, tail, tail+1) {
				item = slot.item
				ok = true
				slot.item = nil
				atomic.StoreUint64(&slot.turn, turn+1)
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

func (q *MPMCQueue) idx(i uint64) uint64 {
	return i % q.cap
}

func (q *MPMCQueue) turn(i uint64) uint64 {
	return i / q.cap
}
