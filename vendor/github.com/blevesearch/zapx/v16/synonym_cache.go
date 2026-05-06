//  Copyright (c) 2024 Couchbase, Inc.
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
	"encoding/binary"
	"fmt"
	"sync"

	"github.com/blevesearch/vellum"
)

func newSynonymIndexCache() *synonymIndexCache {
	return &synonymIndexCache{
		cache: make(map[uint16]*synonymCacheEntry),
	}
}

type synonymIndexCache struct {
	m sync.RWMutex

	cache map[uint16]*synonymCacheEntry
}

// Clear clears the synonym cache which would mean tha the termID to term map would no longer be available.
func (sc *synonymIndexCache) Clear() {
	sc.m.Lock()
	sc.cache = nil
	sc.m.Unlock()
}

// loadOrCreate loads the synonym index cache for the specified fieldID if it is already present,
// or creates it if not. The synonym index cache for a fieldID consists of a tuple:
// - A Vellum FST (Finite State Transducer) representing the thesaurus.
// - A map associating synonym IDs to their corresponding terms.
// This function returns the loaded or newly created tuple (FST and map).
func (sc *synonymIndexCache) loadOrCreate(fieldID uint16, mem []byte) (*vellum.FST, map[uint32][]byte, error) {
	sc.m.RLock()
	entry, ok := sc.cache[fieldID]
	if ok {
		sc.m.RUnlock()
		return entry.load()
	}

	sc.m.RUnlock()

	sc.m.Lock()
	defer sc.m.Unlock()

	entry, ok = sc.cache[fieldID]
	if ok {
		return entry.load()
	}

	return sc.createAndCacheLOCKED(fieldID, mem)
}

// createAndCacheLOCKED creates the synonym index cache for the specified fieldID and caches it.
func (sc *synonymIndexCache) createAndCacheLOCKED(fieldID uint16, mem []byte) (*vellum.FST, map[uint32][]byte, error) {
	var pos uint64
	vellumLen, read := binary.Uvarint(mem[pos : pos+binary.MaxVarintLen64])
	if vellumLen == 0 || read <= 0 {
		return nil, nil, fmt.Errorf("vellum length is 0")
	}
	pos += uint64(read)
	fstBytes := mem[pos : pos+vellumLen]
	fst, err := vellum.Load(fstBytes)
	if err != nil {
		return nil, nil, fmt.Errorf("vellum err: %v", err)
	}
	pos += vellumLen
	numSyns, n := binary.Uvarint(mem[pos : pos+binary.MaxVarintLen64])
	pos += uint64(n)
	if numSyns == 0 {
		return nil, nil, fmt.Errorf("no synonyms found")
	}
	synTermMap := make(map[uint32][]byte, numSyns)
	for i := 0; i < int(numSyns); i++ {
		synID, n := binary.Uvarint(mem[pos : pos+binary.MaxVarintLen64])
		pos += uint64(n)
		termLen, n := binary.Uvarint(mem[pos : pos+binary.MaxVarintLen64])
		pos += uint64(n)
		if termLen == 0 {
			return nil, nil, fmt.Errorf("term length is 0")
		}
		term := mem[pos : pos+uint64(termLen)]
		pos += uint64(termLen)
		synTermMap[uint32(synID)] = term
	}
	sc.insertLOCKED(fieldID, fst, synTermMap)
	return fst, synTermMap, nil
}

// insertLOCKED inserts the vellum FST and the map of synonymID to term into the cache for the specified fieldID.
func (sc *synonymIndexCache) insertLOCKED(fieldID uint16, fst *vellum.FST, synTermMap map[uint32][]byte) {
	_, ok := sc.cache[fieldID]
	if !ok {
		sc.cache[fieldID] = &synonymCacheEntry{
			fst:        fst,
			synTermMap: synTermMap,
		}
	}
}

// synonymCacheEntry is a tuple of the vellum FST and the map of synonymID to term,
// and is the value stored in the synonym cache, for a given fieldID.
type synonymCacheEntry struct {
	fst        *vellum.FST
	synTermMap map[uint32][]byte
}

func (ce *synonymCacheEntry) load() (*vellum.FST, map[uint32][]byte, error) {
	return ce.fst, ce.synTermMap, nil
}
