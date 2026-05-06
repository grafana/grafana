// Copyright 2020-2021 InfluxData, Inc. All rights reserved.
// Use of this source code is governed by MIT
// license that can be found in the LICENSE file.

package write

import (
	"container/list"
)

type queue struct {
	list  *list.List
	limit int
}

func newQueue(limit int) *queue {
	return &queue{list: list.New(), limit: limit}
}
func (q *queue) push(batch *Batch) bool {
	overWrite := false
	if q.list.Len() == q.limit {
		q.pop()
		overWrite = true
	}
	q.list.PushBack(batch)
	return overWrite
}

func (q *queue) pop() *Batch {
	el := q.list.Front()
	if el != nil {
		q.list.Remove(el)
		batch := el.Value.(*Batch)
		batch.Evicted = true
		return batch
	}
	return nil
}

func (q *queue) first() *Batch {
	el := q.list.Front()
	if el != nil {
		return el.Value.(*Batch)
	}
	return nil
}

func (q *queue) isEmpty() bool {
	return q.list.Len() == 0
}
