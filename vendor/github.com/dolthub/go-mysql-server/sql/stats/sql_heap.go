// Copyright 2024 Dolthub, Inc.
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

package stats

import (
	"container/heap"

	"github.com/dolthub/go-mysql-server/sql"
)

// An SqlHeap is a min-heap of ints.
type SqlHeap struct {
	vals []sql.Row
	cnts []uint64
	k    int
}

type HeapRow struct {
	Row   sql.Row
	Count int
}

func NewHeapRow(r sql.Row, cnt int) HeapRow {
	return HeapRow{Row: r, Count: cnt}
}

func NewSqlHeap(k int) *SqlHeap {
	return &SqlHeap{vals: make([]sql.Row, 0), cnts: make([]uint64, 0), k: k}
}

func (h SqlHeap) Array() []sql.Row {
	return h.vals
}

func (h SqlHeap) Counts() []uint64 {
	return h.cnts
}

func (h SqlHeap) Len() int { return len(h.vals) }
func (h SqlHeap) Less(i, j int) bool {
	return h.cnts[i] < h.cnts[j]
}
func (h SqlHeap) Swap(i, j int) {
	h.vals[i], h.vals[j] = h.vals[j], h.vals[i]
	h.cnts[i], h.cnts[j] = h.cnts[j], h.cnts[i]
}

func (h *SqlHeap) Push(x any) {
	// Push and Pop use pointer receivers because they modify the slice's length,
	// not just its contents.
	hr := x.(HeapRow)
	h.vals = append(h.vals, hr.Row)
	h.cnts = append(h.cnts, uint64(hr.Count))
	if len(h.vals) > h.k {
		heap.Pop(h)
	}
}

func (h *SqlHeap) Pop() any {
	n := len(h.vals)
	r := h.vals[n-1]
	h.vals = h.vals[0 : n-1]
	c := h.cnts[n-1]
	h.cnts = h.cnts[0 : n-1]
	return HeapRow{Row: r, Count: int(c)}
}
