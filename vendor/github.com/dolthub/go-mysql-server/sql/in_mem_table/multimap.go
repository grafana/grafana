// Copyright 2023 Dolthub, Inc.
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

package in_mem_table

type MultiMap[V any] struct {
	Equals  func(v1, v2 V) bool
	entries map[any][]V
}

func NewMultiMap[V any](f func(v1, v2 V) bool) MultiMap[V] {
	return MultiMap[V]{
		f,
		make(map[any][]V),
	}
}

func (m MultiMap[V]) GetMany(k any) []V {
	if vs, ok := m.entries[k]; ok {
		vscopy := make([]V, len(vs))
		copy(vscopy, vs)
		return vscopy
	}
	return nil
}

func (m MultiMap[V]) Get(k any, v V) (res V, found bool) {
	if vs, ok := m.entries[k]; ok {
		for _, vp := range vs {
			if m.Equals(v, vp) {
				return vp, true
			}
		}
	}
	return
}

func (m MultiMap[V]) Put(k any, v V) {
	m.entries[k] = append(m.entries[k], v)
}

func (m MultiMap[V]) Clear() {
	for k := range m.entries {
		delete(m.entries, k)
	}
}

func (m MultiMap[V]) Remove(k any, v V) (res V, found bool) {
	if vs, ok := m.entries[k]; ok {
		var newvs []V
		for _, vp := range vs {
			if !m.Equals(v, vp) {
				newvs = append(newvs, vp)
			} else {
				res = v
				found = true
			}
		}
		if len(newvs) > 0 {
			m.entries[k] = newvs
		} else {
			delete(m.entries, k)
		}
	}
	return
}

func (m MultiMap[V]) VisitEntries(f func(v V)) {
	for _, es := range m.entries {
		for _, e := range es {
			f(e)
		}
	}
}

type Keyer[V any] interface {
	GetKey(V) any
}

type IndexedSet[V any] struct {
	Keyers  []Keyer[V]
	Indexes []MultiMap[V]
}

func NewIndexedSet[V any](eqf func(V, V) bool, keyers []Keyer[V]) IndexedSet[V] {
	cp := make([]Keyer[V], len(keyers))
	copy(cp, keyers)
	idxs := make([]MultiMap[V], len(keyers))
	for i := range idxs {
		idxs[i] = NewMultiMap[V](eqf)
	}
	return IndexedSet[V]{
		cp,
		idxs,
	}
}

func (is IndexedSet[V]) Put(v V) {
	for i, keyer := range is.Keyers {
		k := keyer.GetKey(v)
		is.Indexes[i].Put(k, v)
	}
}

func (is IndexedSet[V]) GetMany(keyer Keyer[V], k any) []V {
	for i, x := range is.Keyers {
		if x == keyer {
			return is.Indexes[i].GetMany(k)
		}
	}
	return nil
}

func (is IndexedSet[V]) Get(v V) (V, bool) {
	k := is.Keyers[0].GetKey(v)
	return is.Indexes[0].Get(k, v)
}

func (is IndexedSet[V]) Remove(v V) (res V, found bool) {
	for i, keyer := range is.Keyers {
		k := keyer.GetKey(v)
		if fv, ok := is.Indexes[i].Remove(k, v); ok {
			res = fv
			found = true
		}
	}
	return
}

func (is IndexedSet[V]) RemoveMany(keyer Keyer[V], k any) {
	for i, x := range is.Keyers {
		if x == keyer {
			vs := is.Indexes[i].GetMany(k)
			for _, v := range vs {
				is.Remove(v)
			}
		}
	}
}

func (is IndexedSet[V]) Count() int {
	var c int
	is.VisitEntries(func(V) {
		c += 1
	})
	return c
}

func (is IndexedSet[V]) Clear() {
	for _, i := range is.Indexes {
		i.Clear()
	}
}

func (is IndexedSet[V]) VisitEntries(f func(v V)) {
	// Every multimap has every entry, so you we just iterate over the entries of the first one.
	if len(is.Indexes) > 0 {
		is.Indexes[0].VisitEntries(f)
	}
}
