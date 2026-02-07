// Copyright (c) 2021, Aryan Ahadinia. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Package arrayqueue implements a queue backed by array list.
//
// Structure is not thread safe.
//
// Reference: https://en.wikipedia.org/wiki/Queue_(abstract_data_type)
package arrayqueue

import (
	"fmt"
	"strings"

	"github.com/emirpasic/gods/lists/arraylist"
	"github.com/emirpasic/gods/queues"
)

// Assert Queue implementation
var _ queues.Queue = (*Queue)(nil)

// Queue holds elements in an array-list
type Queue struct {
	list *arraylist.List
}

// New instantiates a new empty queue
func New() *Queue {
	return &Queue{list: arraylist.New()}
}

// Enqueue adds a value to the end of the queue
func (queue *Queue) Enqueue(value interface{}) {
	queue.list.Add(value)
}

// Dequeue removes first element of the queue and returns it, or nil if queue is empty.
// Second return parameter is true, unless the queue was empty and there was nothing to dequeue.
func (queue *Queue) Dequeue() (value interface{}, ok bool) {
	value, ok = queue.list.Get(0)
	if ok {
		queue.list.Remove(0)
	}
	return
}

// Peek returns first element of the queue without removing it, or nil if queue is empty.
// Second return parameter is true, unless the queue was empty and there was nothing to peek.
func (queue *Queue) Peek() (value interface{}, ok bool) {
	return queue.list.Get(0)
}

// Empty returns true if queue does not contain any elements.
func (queue *Queue) Empty() bool {
	return queue.list.Empty()
}

// Size returns number of elements within the queue.
func (queue *Queue) Size() int {
	return queue.list.Size()
}

// Clear removes all elements from the queue.
func (queue *Queue) Clear() {
	queue.list.Clear()
}

// Values returns all elements in the queue (FIFO order).
func (queue *Queue) Values() []interface{} {
	return queue.list.Values()
}

// String returns a string representation of container
func (queue *Queue) String() string {
	str := "ArrayQueue\n"
	values := []string{}
	for _, value := range queue.list.Values() {
		values = append(values, fmt.Sprintf("%v", value))
	}
	str += strings.Join(values, ", ")
	return str
}

// Check that the index is within bounds of the list
func (queue *Queue) withinRange(index int) bool {
	return index >= 0 && index < queue.list.Size()
}
