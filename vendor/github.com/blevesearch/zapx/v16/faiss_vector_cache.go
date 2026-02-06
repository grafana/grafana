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

//go:build vectors
// +build vectors

package zap

import (
	"encoding/binary"
	"sync"
	"sync/atomic"
	"time"

	"github.com/RoaringBitmap/roaring/v2"
	faiss "github.com/blevesearch/go-faiss"
)

func newVectorIndexCache() *vectorIndexCache {
	return &vectorIndexCache{
		cache:   make(map[uint16]*cacheEntry),
		closeCh: make(chan struct{}),
	}
}

type vectorIndexCache struct {
	closeCh chan struct{}
	m       sync.RWMutex
	cache   map[uint16]*cacheEntry
}

func (vc *vectorIndexCache) Clear() {
	vc.m.Lock()
	close(vc.closeCh)

	// forcing a close on all indexes to avoid memory leaks.
	for _, entry := range vc.cache {
		entry.close()
	}
	vc.cache = nil
	vc.m.Unlock()
}

// loadOrCreate obtains the vector index from the cache or creates it if it's not
// present. It also returns the batch executor for the field if it's present in the
// cache.
func (vc *vectorIndexCache) loadOrCreate(fieldID uint16, mem []byte,
	loadDocVecIDMap bool, except *roaring.Bitmap) (
	index *faiss.IndexImpl, vecDocIDMap map[int64]uint32, docVecIDMap map[uint32][]int64,
	vecIDsToExclude []int64, err error) {
	vc.m.RLock()
	entry, ok := vc.cache[fieldID]
	if ok {
		index, vecDocIDMap, docVecIDMap = entry.load()
		vecIDsToExclude = getVecIDsToExclude(vecDocIDMap, except)
		if !loadDocVecIDMap || len(entry.docVecIDMap) > 0 {
			vc.m.RUnlock()
			return index, vecDocIDMap, docVecIDMap, vecIDsToExclude, nil
		}

		vc.m.RUnlock()
		vc.m.Lock()
		// in cases where only the docVecID isn't part of the cache, build it and
		// add it to the cache, while holding a lock to avoid concurrent modifications.
		// typically seen for the first filtered query.
		docVecIDMap = vc.addDocVecIDMapToCacheLOCKED(entry)
		vc.m.Unlock()
		return index, vecDocIDMap, docVecIDMap, vecIDsToExclude, nil
	}

	vc.m.RUnlock()
	// acquiring a lock since this is modifying the cache.
	vc.m.Lock()
	defer vc.m.Unlock()
	return vc.createAndCacheLOCKED(fieldID, mem, loadDocVecIDMap, except)
}

func (vc *vectorIndexCache) addDocVecIDMapToCacheLOCKED(ce *cacheEntry) map[uint32][]int64 {
	// Handle concurrent accesses (to avoid unnecessary work) by adding a
	// check within the write lock here.
	if ce.docVecIDMap != nil {
		return ce.docVecIDMap
	}

	docVecIDMap := make(map[uint32][]int64, len(ce.vecDocIDMap))
	for vecID, docID := range ce.vecDocIDMap {
		docVecIDMap[docID] = append(docVecIDMap[docID], vecID)
	}

	ce.docVecIDMap = docVecIDMap
	return docVecIDMap
}

// Rebuilding the cache on a miss.
func (vc *vectorIndexCache) createAndCacheLOCKED(fieldID uint16, mem []byte,
	loadDocVecIDMap bool, except *roaring.Bitmap) (
	index *faiss.IndexImpl, vecDocIDMap map[int64]uint32,
	docVecIDMap map[uint32][]int64, vecIDsToExclude []int64, err error) {

	// Handle concurrent accesses (to avoid unnecessary work) by adding a
	// check within the write lock here.
	entry := vc.cache[fieldID]
	if entry != nil {
		index, vecDocIDMap, docVecIDMap = entry.load()
		vecIDsToExclude = getVecIDsToExclude(vecDocIDMap, except)
		if !loadDocVecIDMap || len(entry.docVecIDMap) > 0 {
			return index, vecDocIDMap, docVecIDMap, vecIDsToExclude, nil
		}
		docVecIDMap = vc.addDocVecIDMapToCacheLOCKED(entry)
		return index, vecDocIDMap, docVecIDMap, vecIDsToExclude, nil
	}

	// if the cache doesn't have the entry, construct the vector to doc id map and
	// the vector index out of the mem bytes and update the cache under lock.
	pos := 0
	numVecs, n := binary.Uvarint(mem[pos : pos+binary.MaxVarintLen64])
	pos += n

	vecDocIDMap = make(map[int64]uint32, numVecs)
	if loadDocVecIDMap {
		docVecIDMap = make(map[uint32][]int64, numVecs)
	}
	isExceptNotEmpty := except != nil && !except.IsEmpty()
	for i := 0; i < int(numVecs); i++ {
		vecID, n := binary.Varint(mem[pos : pos+binary.MaxVarintLen64])
		pos += n
		docID, n := binary.Uvarint(mem[pos : pos+binary.MaxVarintLen64])
		pos += n

		docIDUint32 := uint32(docID)
		if isExceptNotEmpty && except.Contains(docIDUint32) {
			vecIDsToExclude = append(vecIDsToExclude, vecID)
			continue
		}
		vecDocIDMap[vecID] = docIDUint32
		if loadDocVecIDMap {
			docVecIDMap[docIDUint32] = append(docVecIDMap[docIDUint32], vecID)
		}
	}

	indexSize, n := binary.Uvarint(mem[pos : pos+binary.MaxVarintLen64])
	pos += n

	index, err = faiss.ReadIndexFromBuffer(mem[pos:pos+int(indexSize)], faissIOFlags)
	if err != nil {
		return nil, nil, nil, nil, err
	}

	vc.insertLOCKED(fieldID, index, vecDocIDMap, loadDocVecIDMap, docVecIDMap)
	return index, vecDocIDMap, docVecIDMap, vecIDsToExclude, nil
}

func (vc *vectorIndexCache) insertLOCKED(fieldIDPlus1 uint16,
	index *faiss.IndexImpl, vecDocIDMap map[int64]uint32, loadDocVecIDMap bool,
	docVecIDMap map[uint32][]int64) {
	// the first time we've hit the cache, try to spawn a monitoring routine
	// which will reconcile the moving averages for all the fields being hit
	if len(vc.cache) == 0 {
		go vc.monitor()
	}

	_, ok := vc.cache[fieldIDPlus1]
	if !ok {
		// initializing the alpha with 0.4 essentially means that we are favoring
		// the history a little bit more relative to the current sample value.
		// this makes the average to be kept above the threshold value for a
		// longer time and thereby the index to be resident in the cache
		// for longer time.
		vc.cache[fieldIDPlus1] = createCacheEntry(index, vecDocIDMap,
			loadDocVecIDMap, docVecIDMap, 0.4)
	}
}

func (vc *vectorIndexCache) incHit(fieldIDPlus1 uint16) {
	vc.m.RLock()
	entry, ok := vc.cache[fieldIDPlus1]
	if ok {
		entry.incHit()
	}
	vc.m.RUnlock()
}

func (vc *vectorIndexCache) decRef(fieldIDPlus1 uint16) {
	vc.m.RLock()
	entry, ok := vc.cache[fieldIDPlus1]
	if ok {
		entry.decRef()
	}
	vc.m.RUnlock()
}

func (vc *vectorIndexCache) cleanup() bool {
	vc.m.Lock()
	cache := vc.cache

	// for every field reconcile the average with the current sample values
	for fieldIDPlus1, entry := range cache {
		sample := atomic.LoadUint64(&entry.tracker.sample)
		entry.tracker.add(sample)

		refCount := atomic.LoadInt64(&entry.refs)
		// the comparison threshold as of now is (1 - a). mathematically it
		// means that there is only 1 query per second on average as per history.
		// and in the current second, there were no queries performed against
		// this index.
		if entry.tracker.avg <= (1-entry.tracker.alpha) && refCount <= 0 {
			atomic.StoreUint64(&entry.tracker.sample, 0)
			delete(vc.cache, fieldIDPlus1)
			entry.close()
			continue
		}
		atomic.StoreUint64(&entry.tracker.sample, 0)
	}

	rv := len(vc.cache) == 0
	vc.m.Unlock()
	return rv
}

var monitorFreq = 1 * time.Second

func (vc *vectorIndexCache) monitor() {
	ticker := time.NewTicker(monitorFreq)
	defer ticker.Stop()
	for {
		select {
		case <-vc.closeCh:
			return
		case <-ticker.C:
			exit := vc.cleanup()
			if exit {
				// no entries to be monitored, exit
				return
			}
		}
	}
}

// -----------------------------------------------------------------------------

type ewma struct {
	alpha float64
	avg   float64
	// every hit to the cache entry is recorded as part of a sample
	// which will be used to calculate the average in the next cycle of average
	// computation (which is average traffic for the field till now). this is
	// used to track the per second hits to the cache entries.
	sample uint64
}

func (e *ewma) add(val uint64) {
	if e.avg == 0.0 {
		e.avg = float64(val)
	} else {
		// the exponentially weighted moving average
		// X(t) = a.v + (1 - a).X(t-1)
		e.avg = e.alpha*float64(val) + (1-e.alpha)*e.avg
	}
}

// -----------------------------------------------------------------------------

func createCacheEntry(index *faiss.IndexImpl, vecDocIDMap map[int64]uint32,
	loadDocVecIDMap bool, docVecIDMap map[uint32][]int64, alpha float64) *cacheEntry {
	ce := &cacheEntry{
		index:       index,
		vecDocIDMap: vecDocIDMap,
		tracker: &ewma{
			alpha:  alpha,
			sample: 1,
		},
		refs: 1,
	}
	if loadDocVecIDMap {
		ce.docVecIDMap = docVecIDMap
	}
	return ce
}

type cacheEntry struct {
	tracker *ewma

	// this is used to track the live references to the cache entry,
	// such that while we do a cleanup() and we see that the avg is below a
	// threshold we close/cleanup only if the live refs to the cache entry is 0.
	refs int64

	index       *faiss.IndexImpl
	vecDocIDMap map[int64]uint32
	docVecIDMap map[uint32][]int64
}

func (ce *cacheEntry) incHit() {
	atomic.AddUint64(&ce.tracker.sample, 1)
}

func (ce *cacheEntry) addRef() {
	atomic.AddInt64(&ce.refs, 1)
}

func (ce *cacheEntry) decRef() {
	atomic.AddInt64(&ce.refs, -1)
}

func (ce *cacheEntry) load() (*faiss.IndexImpl, map[int64]uint32, map[uint32][]int64) {
	ce.incHit()
	ce.addRef()
	return ce.index, ce.vecDocIDMap, ce.docVecIDMap
}

func (ce *cacheEntry) close() {
	go func() {
		ce.index.Close()
		ce.index = nil
		ce.vecDocIDMap = nil
		ce.docVecIDMap = nil
	}()
}

// -----------------------------------------------------------------------------

func getVecIDsToExclude(vecDocIDMap map[int64]uint32, except *roaring.Bitmap) (vecIDsToExclude []int64) {
	if except != nil && !except.IsEmpty() {
		for vecID, docID := range vecDocIDMap {
			if except.Contains(docID) {
				vecIDsToExclude = append(vecIDsToExclude, vecID)
			}
		}
	}
	return vecIDsToExclude
}
