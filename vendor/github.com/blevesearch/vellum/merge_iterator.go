//  Copyright (c) 2017 Couchbase, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// 		http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package vellum

import (
	"bytes"
)

// MergeFunc is used to choose the new value for a key when merging a slice
// of iterators, and the same key is observed with multiple values.
// Values presented to the MergeFunc will be in the same order as the
// original slice creating the MergeIterator.  This allows some MergeFunc
// implementations to prioritize one iterator over another.
type MergeFunc func([]uint64) uint64

// MergeIterator implements the Iterator interface by traversing a slice
// of iterators and merging the contents of them.  If the same key exists
// in mulitipe underlying iterators, a user-provided MergeFunc will be
// invoked to choose the new value.
type MergeIterator struct {
	itrs   []Iterator
	f      MergeFunc
	currKs [][]byte
	currVs []uint64

	lowK    []byte
	lowV    uint64
	lowIdxs []int

	mergeV []uint64
}

// NewMergeIterator creates a new MergeIterator over the provided slice of
// Iterators and with the specified MergeFunc to resolve duplicate keys.
func NewMergeIterator(itrs []Iterator, f MergeFunc) (*MergeIterator, error) {
	rv := &MergeIterator{
		itrs:    itrs,
		f:       f,
		currKs:  make([][]byte, len(itrs)),
		currVs:  make([]uint64, len(itrs)),
		lowIdxs: make([]int, 0, len(itrs)),
		mergeV:  make([]uint64, 0, len(itrs)),
	}
	rv.init()
	if rv.lowK == nil {
		return rv, ErrIteratorDone
	}
	return rv, nil
}

func (m *MergeIterator) init() {
	for i, itr := range m.itrs {
		m.currKs[i], m.currVs[i] = itr.Current()
	}
	m.updateMatches()
}

func (m *MergeIterator) updateMatches() {
	if len(m.itrs) < 1 {
		return
	}
	m.lowK = m.currKs[0]
	m.lowIdxs = m.lowIdxs[:0]
	m.lowIdxs = append(m.lowIdxs, 0)
	for i := 1; i < len(m.itrs); i++ {
		if m.currKs[i] == nil {
			continue
		}
		cmp := bytes.Compare(m.currKs[i], m.lowK)
		if m.lowK == nil || cmp < 0 {
			// reached a new low
			m.lowK = m.currKs[i]
			m.lowIdxs = m.lowIdxs[:0]
			m.lowIdxs = append(m.lowIdxs, i)
		} else if cmp == 0 {
			m.lowIdxs = append(m.lowIdxs, i)
		}
	}
	if len(m.lowIdxs) > 1 {
		// merge multiple values
		m.mergeV = m.mergeV[:0]
		for _, vi := range m.lowIdxs {
			m.mergeV = append(m.mergeV, m.currVs[vi])
		}
		m.lowV = m.f(m.mergeV)
	} else if len(m.lowIdxs) == 1 {
		m.lowV = m.currVs[m.lowIdxs[0]]
	}
}

// Current returns the key and value currently pointed to by this iterator.
// If the iterator is not pointing at a valid value (because Iterator/Next/Seek)
// returned an error previously, it may return nil,0.
func (m *MergeIterator) Current() ([]byte, uint64) {
	return m.lowK, m.lowV
}

// Next advances this iterator to the next key/value pair.  If there is none,
// then ErrIteratorDone is returned.
func (m *MergeIterator) Next() error {
	// move all the current low iterators to next
	for _, vi := range m.lowIdxs {
		err := m.itrs[vi].Next()
		if err != nil && err != ErrIteratorDone {
			return err
		}
		m.currKs[vi], m.currVs[vi] = m.itrs[vi].Current()
	}
	m.updateMatches()
	if m.lowK == nil {
		return ErrIteratorDone
	}
	return nil
}

// Seek advances this iterator to the specified key/value pair.  If this key
// is not in the FST, Current() will return the next largest key.  If this
// seek operation would go past the last key, then ErrIteratorDone is returned.
func (m *MergeIterator) Seek(key []byte) error {
	for i := range m.itrs {
		err := m.itrs[i].Seek(key)
		if err != nil && err != ErrIteratorDone {
			return err
		}
	}
	m.updateMatches()
	if m.lowK == nil {
		return ErrIteratorDone
	}
	return nil
}

// Close will attempt to close all the underlying Iterators.  If any errors
// are encountered, the first will be returned.
func (m *MergeIterator) Close() error {
	var rv error
	for i := range m.itrs {
		// close all iterators, return first error if any
		err := m.itrs[i].Close()
		if rv == nil {
			rv = err
		}
	}
	return rv
}

// MergeMin chooses the minimum value
func MergeMin(vals []uint64) uint64 {
	rv := vals[0]
	for _, v := range vals[1:] {
		if v < rv {
			rv = v
		}
	}
	return rv
}

// MergeMax chooses the maximum value
func MergeMax(vals []uint64) uint64 {
	rv := vals[0]
	for _, v := range vals[1:] {
		if v > rv {
			rv = v
		}
	}
	return rv
}

// MergeSum sums the values
func MergeSum(vals []uint64) uint64 {
	rv := vals[0]
	for _, v := range vals[1:] {
		rv += v
	}
	return rv
}
