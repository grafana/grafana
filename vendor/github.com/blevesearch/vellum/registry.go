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

type registryCell struct {
	addr int
	node *builderNode
}

type registry struct {
	builderNodePool *builderNodePool
	table           []registryCell
	tableSize       uint
	mruSize         uint
}

func newRegistry(p *builderNodePool, tableSize, mruSize int) *registry {
	nsize := tableSize * mruSize
	rv := &registry{
		builderNodePool: p,
		table:           make([]registryCell, nsize),
		tableSize:       uint(tableSize),
		mruSize:         uint(mruSize),
	}
	return rv
}

func (r *registry) Reset() {
	var empty registryCell
	for i := range r.table {
		r.builderNodePool.Put(r.table[i].node)
		r.table[i] = empty
	}
}

func (r *registry) entry(node *builderNode) (bool, int, *registryCell) {
	if len(r.table) == 0 {
		return false, 0, nil
	}
	bucket := r.hash(node)
	start := r.mruSize * uint(bucket)
	end := start + r.mruSize
	rc := registryCache(r.table[start:end])
	return rc.entry(node, r.builderNodePool)
}

const fnvPrime = 1099511628211

func (r *registry) hash(b *builderNode) int {
	var final uint64
	if b.final {
		final = 1
	}

	var h uint64 = 14695981039346656037
	h = (h ^ final) * fnvPrime
	h = (h ^ b.finalOutput) * fnvPrime
	for _, t := range b.trans {
		h = (h ^ uint64(t.in)) * fnvPrime
		h = (h ^ t.out) * fnvPrime
		h = (h ^ uint64(t.addr)) * fnvPrime
	}
	return int(h % uint64(r.tableSize))
}

type registryCache []registryCell

func (r registryCache) entry(node *builderNode, pool *builderNodePool) (bool, int, *registryCell) {
	if len(r) == 1 {
		if r[0].node != nil && r[0].node.equiv(node) {
			return true, r[0].addr, nil
		}
		pool.Put(r[0].node)
		r[0].node = node
		return false, 0, &r[0]
	}
	for i := range r {
		if r[i].node != nil && r[i].node.equiv(node) {
			addr := r[i].addr
			r.promote(i)
			return true, addr, nil
		}
	}
	// no match
	last := len(r) - 1
	pool.Put(r[last].node)
	r[last].node = node // discard LRU
	r.promote(last)
	return false, 0, &r[0]

}

func (r registryCache) promote(i int) {
	for i > 0 {
		r.swap(i-1, i)
		i--
	}
}

func (r registryCache) swap(i, j int) {
	r[i], r[j] = r[j], r[i]
}
