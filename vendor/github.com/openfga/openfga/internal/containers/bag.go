package containers

import (
	"iter"
	"sync/atomic"
)

// node facilitates a basic link-list data type.
type node[T any] struct {
	value T
	next  *node[T]
}

// Bag is a type that holds values of T. Values can be added
// to the Bag and enumerated. However values can not be indexed
// or removed from the bag. The methods on Bag are thread safe.
// A zero value Bag can be used without initialization.
type Bag[T any] struct {
	head atomic.Pointer[node[T]]
}

// Add adds the provided values to the Bag.
func (b *Bag[T]) Add(v ...T) {
	if len(v) == 0 {
		return
	}

	var newHead *node[T]
	var tail *node[T]

	for _, i := range v {
		n := &node[T]{
			value: i,
		}
		if newHead == nil {
			newHead = n
			tail = n
			continue
		}
		n.next = newHead
		newHead = n
	}

	for {
		oldHead := b.head.Load()
		tail.next = oldHead
		if b.head.CompareAndSwap(oldHead, newHead) {
			break
		}
	}
}

// Seq returns an iter.Seq[T] containing all of the values
// currently in the Bag in LIFO order. All values will
// be removed from the bag.
func (b *Bag[T]) Seq() iter.Seq[T] {
	head := b.head.Swap(nil)
	return func(yield func(T) bool) {
		for head != nil {
			if !yield(head.value) {
				break
			}
			head = head.next
		}
	}
}
