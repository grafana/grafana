//  Copyright (c) 2018 Couchbase, Inc.
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

package zap

import (
	"bytes"

	"github.com/blevesearch/vellum"
)

// enumerator provides an ordered traversal of multiple vellum
// iterators.  Like JOIN of iterators, the enumerator produces a
// sequence of (key, iteratorIndex, value) tuples, sorted by key ASC,
// then iteratorIndex ASC, where the same key might be seen or
// repeated across multiple child iterators.
type enumerator struct {
	itrs   []vellum.Iterator
	currKs [][]byte
	currVs []uint64

	lowK    []byte
	lowIdxs []int
	lowCurr int
}

// newEnumerator returns a new enumerator over the vellum Iterators
func newEnumerator(itrs []vellum.Iterator) (*enumerator, error) {
	rv := &enumerator{
		itrs:    itrs,
		currKs:  make([][]byte, len(itrs)),
		currVs:  make([]uint64, len(itrs)),
		lowIdxs: make([]int, 0, len(itrs)),
	}
	for i, itr := range rv.itrs {
		rv.currKs[i], rv.currVs[i] = itr.Current()
	}
	rv.updateMatches(false)
	if rv.lowK == nil && len(rv.lowIdxs) == 0 {
		return rv, vellum.ErrIteratorDone
	}
	return rv, nil
}

// updateMatches maintains the low key matches based on the currKs
func (m *enumerator) updateMatches(skipEmptyKey bool) {
	m.lowK = nil
	m.lowIdxs = m.lowIdxs[:0]
	m.lowCurr = 0

	for i, key := range m.currKs {
		if (key == nil && m.currVs[i] == 0) || // in case of empty iterator
			(len(key) == 0 && skipEmptyKey) { // skip empty keys
			continue
		}

		cmp := bytes.Compare(key, m.lowK)
		if cmp < 0 || len(m.lowIdxs) == 0 {
			// reached a new low
			m.lowK = key
			m.lowIdxs = m.lowIdxs[:0]
			m.lowIdxs = append(m.lowIdxs, i)
		} else if cmp == 0 {
			m.lowIdxs = append(m.lowIdxs, i)
		}
	}
}

// Current returns the enumerator's current key, iterator-index, and
// value.  If the enumerator is not pointing at a valid value (because
// Next returned an error previously), Current will return nil,0,0.
func (m *enumerator) Current() ([]byte, int, uint64) {
	var i int
	var v uint64
	if m.lowCurr < len(m.lowIdxs) {
		i = m.lowIdxs[m.lowCurr]
		v = m.currVs[i]
	}
	return m.lowK, i, v
}

// GetLowIdxsAndValues will return all of the iterator indices
// which point to the current key, and their corresponding
// values.  This can be used by advanced caller which may need
// to peek into these other sets of data before processing.
func (m *enumerator) GetLowIdxsAndValues() ([]int, []uint64) {
	values := make([]uint64, 0, len(m.lowIdxs))
	for _, idx := range m.lowIdxs {
		values = append(values, m.currVs[idx])
	}
	return m.lowIdxs, values
}

// Next advances the enumerator to the next key/iterator/value result,
// else vellum.ErrIteratorDone is returned.
func (m *enumerator) Next() error {
	m.lowCurr += 1
	if m.lowCurr >= len(m.lowIdxs) {
		// move all the current low iterators forwards
		for _, vi := range m.lowIdxs {
			err := m.itrs[vi].Next()
			if err != nil && err != vellum.ErrIteratorDone {
				return err
			}
			m.currKs[vi], m.currVs[vi] = m.itrs[vi].Current()
		}
		// can skip any empty keys encountered at this point
		m.updateMatches(true)
	}
	if m.lowK == nil && len(m.lowIdxs) == 0 {
		return vellum.ErrIteratorDone
	}
	return nil
}

// Close all the underlying Iterators.  The first error, if any, will
// be returned.
func (m *enumerator) Close() error {
	var rv error
	for _, itr := range m.itrs {
		err := itr.Close()
		if rv == nil {
			rv = err
		}
	}
	return rv
}
