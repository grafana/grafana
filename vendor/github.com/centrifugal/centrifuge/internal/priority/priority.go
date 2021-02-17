// Package priority provides priority queue.
package priority

import (
	"container/heap"
)

// An Item is something we manage in a priority queue.
type Item struct {
	Value    string // The value of the item; arbitrary.
	Priority int64  // The priority of the item in the queue.
	// The index is needed by update and is maintained by the heap.Interface methods.
	index int // The index of the item in the heap.
}

// A Queue implements heap.Interface and holds Items.
type Queue []*Item

// Len ...
func (pq Queue) Len() int {
	return len(pq)
}

// Less ...
func (pq Queue) Less(i, j int) bool {
	return pq[i].Priority < pq[j].Priority
}

// Swap ...
func (pq Queue) Swap(i, j int) {
	pq[i], pq[j] = pq[j], pq[i]
	pq[i].index = i
	pq[j].index = j
}

// Push value into queue.
func (pq *Queue) Push(x interface{}) {
	n := len(*pq)
	item := x.(*Item)
	item.index = n
	*pq = append(*pq, item)
}

// Pop value from queue.
func (pq *Queue) Pop() interface{} {
	old := *pq
	n := len(old)
	item := old[n-1]
	item.index = -1 // for safety
	*pq = old[0 : n-1]
	return item
}

// MakeQueue allows to create priority queue.
func MakeQueue() Queue {
	pq := make(Queue, 0)
	heap.Init(&pq)
	return pq
}
