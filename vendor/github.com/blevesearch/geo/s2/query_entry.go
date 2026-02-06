// Copyright 2020 Google Inc. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package s2

import "container/heap"

// A queryQueueEntry stores CellIDs and distance from a target. It is used by the
// different S2 Query types to efficiently build their internal priority queue
// in the optimized algorithm implementations.
type queryQueueEntry struct {
	// A lower bound on the distance from the target to ID. This is the key
	// of the priority queue.
	distance distance

	// The cell being queued.
	id CellID

	// If the CellID belongs to a ShapeIndex, this field stores the
	// corresponding ShapeIndexCell. Otherwise ID is a proper ancestor of
	// one or more ShapeIndexCells and this field stores is nil.
	indexCell *ShapeIndexCell
}

// queryQueue is used by the optimized algorithm to maintain a priority queue of
// unprocessed CellIDs, sorted in increasing order of distance from the target.
type queryQueue struct {
	queue queryPQ
}

// newQueryQueue returns a new initialized queryQueue.
func newQueryQueue() *queryQueue {
	q := &queryQueue{
		queue: make(queryPQ, 0),
	}
	heap.Init(&q.queue)
	return q
}

// push adds the given entry to the top of this queue.
func (q *queryQueue) push(e *queryQueueEntry) {
	heap.Push(&q.queue, e)
}

// pop returns the top element of this queue.
func (q *queryQueue) pop() *queryQueueEntry {
	return heap.Pop(&q.queue).(*queryQueueEntry)
}

func (q *queryQueue) size() int {
	return q.queue.Len()
}

func (q *queryQueue) reset() {
	q.queue = q.queue[:0]
}

// queryPQ is a priority queue that implements the heap interface.
type queryPQ []*queryQueueEntry

func (q queryPQ) Len() int { return len(q) }
func (q queryPQ) Less(i, j int) bool {
	return q[i].distance.less(q[j].distance)
}

// Swap swaps the two entries.
func (q queryPQ) Swap(i, j int) {
	q[i], q[j] = q[j], q[i]
}

// Push adds the given entry to the queue.
func (q *queryPQ) Push(x any) {
	item := x.(*queryQueueEntry)
	*q = append(*q, item)
}

// Pop returns the top element of the queue.
func (q *queryPQ) Pop() any {
	item := (*q)[len(*q)-1]
	*q = (*q)[:len(*q)-1]
	return item
}
