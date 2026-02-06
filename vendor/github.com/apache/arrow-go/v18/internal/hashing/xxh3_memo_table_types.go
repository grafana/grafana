// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package hashing

import (
	"cmp"
	"unsafe"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/bitutil"
	"github.com/apache/arrow-go/v18/internal/utils"
)

type fixedLenMemoTypes interface {
	int8 | uint8 | int16 | uint16 | int32 |
		uint32 | int64 | uint64 | float32 | float64
}

type payload[T fixedLenMemoTypes] struct {
	val     T
	memoIdx int32
}

type entry[T fixedLenMemoTypes] struct {
	h       uint64
	payload payload[T]
}

func (e entry[T]) Valid() bool { return e.h != sentinel }

type HashTable[T fixedLenMemoTypes] struct {
	cap     uint64
	capMask uint64
	size    uint64

	entries []entry[T]
}

func NewHashTable[T fixedLenMemoTypes](cap uint64) *HashTable[T] {
	initCap := uint64(bitutil.NextPowerOf2(int(max(cap, 32))))
	return &HashTable[T]{
		cap:     initCap,
		capMask: initCap - 1,
		size:    0,
		entries: make([]entry[T], initCap),
	}
}

func (h *HashTable[T]) Reset(cap uint64) {
	h.cap = uint64(bitutil.NextPowerOf2(int(max(cap, 32))))
	h.capMask = h.cap - 1
	h.size = 0
	h.entries = make([]entry[T], h.cap)
}

func (h *HashTable[T]) CopyValues(out []T) {
	h.CopyValuesSubset(0, out)
}

func (h *HashTable[T]) CopyValuesSubset(start int, out []T) {
	h.VisitEntries(func(e *entry[T]) {
		idx := e.payload.memoIdx - int32(start)
		if idx >= 0 {
			out[idx] = e.payload.val
		}
	})
}

func (h *HashTable[T]) WriteOut(out []byte) {
	h.WriteOutSubset(0, out)
}

func (h *HashTable[T]) WriteOutSubset(start int, out []byte) {
	data := arrow.GetData[T](out)
	h.VisitEntries(func(e *entry[T]) {
		idx := e.payload.memoIdx - int32(start)
		if idx >= 0 {
			data[idx] = utils.ToLE(e.payload.val)
		}
	})
}

func (h *HashTable[T]) needUpsize() bool { return h.size*uint64(loadFactor) >= h.cap }

func (HashTable[T]) fixHash(v uint64) uint64 {
	if v == sentinel {
		return 42
	}
	return v
}

func (h *HashTable[T]) Lookup(v uint64, cmp func(T) bool) (*entry[T], bool) {
	idx, ok := h.lookup(v, h.capMask, cmp)
	return &h.entries[idx], ok
}

func (h *HashTable[T]) lookup(v uint64, szMask uint64, cmp func(T) bool) (uint64, bool) {
	const perturbShift uint8 = 5

	var (
		idx     uint64
		perturb uint64
		e       *entry[T]
	)

	v = h.fixHash(v)
	idx = v & szMask
	perturb = (v >> uint64(perturbShift)) + 1

	for {
		e = &h.entries[idx]
		if e.h == v && cmp(e.payload.val) {
			return idx, true
		}

		if e.h == sentinel {
			return idx, false
		}

		// perturbation logic inspired from CPython's set/dict object
		// the goal is that all 64 bits of unmasked hash value eventually
		// participate int he probing sequence, to minimize clustering
		idx = (idx + perturb) & szMask
		perturb = (perturb >> uint64(perturbShift)) + 1
	}
}

func (h *HashTable[T]) upsize(newcap uint64) error {
	newMask := newcap - 1

	oldEntries := h.entries
	h.entries = make([]entry[T], newcap)
	for _, e := range oldEntries {
		if e.Valid() {
			idx, _ := h.lookup(e.h, newMask, func(T) bool { return false })
			h.entries[idx] = e
		}
	}
	h.cap, h.capMask = newcap, newMask
	return nil
}

func (h *HashTable[T]) Insert(e *entry[T], v uint64, val T, memoIdx int32) error {
	e.h = h.fixHash(v)
	e.payload.val = val
	e.payload.memoIdx = memoIdx
	h.size++

	if h.needUpsize() {
		h.upsize(h.cap * uint64(loadFactor) * 2)
	}
	return nil
}

func (h *HashTable[T]) VisitEntries(visit func(*entry[T])) {
	for _, e := range h.entries {
		if e.Valid() {
			visit(&e)
		}
	}
}

type Table[T fixedLenMemoTypes] struct {
	tbl     *HashTable[T]
	nullIdx int32
}

func NewMemoTable[T fixedLenMemoTypes](num int64) *Table[T] {
	return &Table[T]{tbl: NewHashTable[T](uint64(num)), nullIdx: KeyNotFound}
}

func (t *Table[T]) TypeTraits() TypeTraits { return typeTraits[T]{} }

func (t *Table[T]) Reset() {
	t.tbl.Reset(32)
	t.nullIdx = KeyNotFound
}

func (t *Table[T]) Size() int {
	sz := int(t.tbl.size)
	if _, ok := t.GetNull(); ok {
		sz++
	}

	return sz
}

func (t *Table[T]) GetNull() (int, bool) {
	return int(t.nullIdx), t.nullIdx != KeyNotFound
}

func (t *Table[T]) GetOrInsertNull() (idx int, found bool) {
	idx, found = t.GetNull()
	if !found {
		idx = t.Size()
		t.nullIdx = int32(idx)
	}
	return
}

func (t *Table[T]) CopyValues(out any) {
	t.CopyValuesSubset(0, out)
}

func (t *Table[T]) CopyValuesSubset(start int, out any) {
	t.tbl.CopyValuesSubset(start, out.([]T))
}

func (t *Table[T]) WriteOut(out []byte) {
	t.tbl.CopyValues(arrow.GetData[T](out))
}

func (t *Table[T]) WriteOutSubset(start int, out []byte) {
	t.tbl.CopyValuesSubset(start, arrow.GetData[T](out))
}

func (t *Table[T]) WriteOutLE(out []byte) {
	t.tbl.WriteOut(out)
}

func (t *Table[T]) WriteOutSubsetLE(start int, out []byte) {
	t.tbl.WriteOutSubset(start, out)
}

func (t *Table[T]) Exists(val T) bool {
	_, ok := t.Get(val)
	return ok
}

func (t *Table[T]) Get(val any) (int, bool) {
	z := val.(T)

	h := hash(z, 0)
	if e, ok := t.tbl.Lookup(h, func(v T) bool { return cmp.Compare(z, v) == 0 }); ok {
		return int(e.payload.memoIdx), true
	}
	return KeyNotFound, false
}

func (t *Table[T]) GetOrInsert(val any) (idx int, found bool, err error) {
	return t.InsertOrGet(val.(T))
}

func (t *Table[T]) InsertOrGet(val T) (idx int, found bool, err error) {
	h := hash(val, 0)
	e, ok := t.tbl.Lookup(h, func(v T) bool { return cmp.Compare(val, v) == 0 })
	if ok {
		idx = int(e.payload.memoIdx)
		found = true
	} else {
		idx = t.Size()
		t.tbl.Insert(e, h, val, int32(idx))
	}
	return
}

func (t *Table[T]) GetOrInsertBytes(val []byte) (idx int, found bool, err error) {
	panic("unimplemented")
}

type Int8MemoTable = Table[int8]
type Uint8MemoTable = Table[uint8]
type Int16MemoTable = Table[int16]
type Uint16MemoTable = Table[uint16]
type Int32MemoTable = Table[int32]
type Uint32MemoTable = Table[uint32]
type Int64MemoTable = Table[int64]
type Uint64MemoTable = Table[uint64]
type Float32MemoTable = Table[float32]
type Float64MemoTable = Table[float64]

type typeTraits[T fixedLenMemoTypes] struct{}

func (typeTraits[T]) BytesRequired(n int) int {
	return n * int(unsafe.Sizeof(T(0)))
}
