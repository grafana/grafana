// Copyright 2017 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package pprof

import "unsafe"

// A profMap is a map from (stack, tag) to mapEntry.
// It grows without bound, but that's assumed to be OK.
type profMap[PREV any, ACC any] struct {
	hash    map[uintptr]*profMapEntry[PREV, ACC]
	free    []profMapEntry[PREV, ACC]
	freeStk []uintptr
}

// A profMapEntry is a single entry in the profMap.
// todo use unsafe.Pointer + len for stk ?
type profMapEntry[PREV any, ACC any] struct {
	nextHash *profMapEntry[PREV, ACC] // next in hash list
	stk      []uintptr
	tag      uintptr
	prev     PREV
	acc      ACC
}

func (m *profMap[PREV, ACC]) Lookup(stk []uintptr, tag uintptr) *profMapEntry[PREV, ACC] {
	// Compute hash of (stk, tag).
	h := uintptr(0)
	for _, x := range stk {
		h = h<<8 | (h >> (8 * (unsafe.Sizeof(h) - 1)))
		h += uintptr(x) * 41
	}
	h = h<<8 | (h >> (8 * (unsafe.Sizeof(h) - 1)))
	h += uintptr(tag) * 41

	// Find entry if present.
	var last *profMapEntry[PREV, ACC]
Search:
	for e := m.hash[h]; e != nil; last, e = e, e.nextHash {
		if len(e.stk) != len(stk) || e.tag != tag {
			continue
		}
		for j := range stk {
			if e.stk[j] != uintptr(stk[j]) {
				continue Search
			}
		}
		// Move to front.
		if last != nil {
			last.nextHash = e.nextHash
			e.nextHash = m.hash[h]
			m.hash[h] = e
		}
		return e
	}

	// Add new entry.
	if len(m.free) < 1 {
		m.free = make([]profMapEntry[PREV, ACC], 128)
	}
	e := &m.free[0]
	m.free = m.free[1:]
	e.nextHash = m.hash[h]
	e.tag = tag

	if len(m.freeStk) < len(stk) {
		m.freeStk = make([]uintptr, 1024)
	}
	// Limit cap to prevent append from clobbering freeStk.
	e.stk = m.freeStk[:len(stk):len(stk)]
	m.freeStk = m.freeStk[len(stk):]

	for j := range stk {
		e.stk[j] = uintptr(stk[j])
	}
	if m.hash == nil {
		m.hash = make(map[uintptr]*profMapEntry[PREV, ACC])
	}
	m.hash[h] = e
	return e
}
