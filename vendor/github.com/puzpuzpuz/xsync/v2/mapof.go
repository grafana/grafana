//go:build go1.18
// +build go1.18

package xsync

import (
	"fmt"
	"hash/maphash"
	"math"
	"sync"
	"sync/atomic"
	"unsafe"
)

// MapOf is like a Go map[string]V but is safe for concurrent
// use by multiple goroutines without additional locking or
// coordination. It follows the interface of sync.Map with
// a number of valuable extensions like Compute or Size.
//
// A MapOf must not be copied after first use.
//
// MapOf uses a modified version of Cache-Line Hash Table (CLHT)
// data structure: https://github.com/LPD-EPFL/CLHT
//
// CLHT is built around idea to organize the hash table in
// cache-line-sized buckets, so that on all modern CPUs update
// operations complete with at most one cache-line transfer.
// Also, Get operations involve no write to memory, as well as no
// mutexes or any other sort of locks. Due to this design, in all
// considered scenarios MapOf outperforms sync.Map.
type MapOf[K comparable, V any] struct {
	totalGrowths int64
	totalShrinks int64
	resizing     int64          // resize in progress flag; updated atomically
	resizeMu     sync.Mutex     // only used along with resizeCond
	resizeCond   sync.Cond      // used to wake up resize waiters (concurrent modifications)
	table        unsafe.Pointer // *mapOfTable
	hasher       func(maphash.Seed, K) uint64
}

type mapOfTable[K comparable, V any] struct {
	buckets []bucketOfPadded
	// striped counter for number of table entries;
	// used to determine if a table shrinking is needed
	// occupies min(buckets_memory/1024, 64KB) of memory
	size []counterStripe
	seed maphash.Seed
}

// bucketOfPadded is a CL-sized map bucket holding up to
// entriesPerMapBucket entries.
type bucketOfPadded struct {
	//lint:ignore U1000 ensure each bucket takes two cache lines on both 32 and 64-bit archs
	pad [cacheLineSize - unsafe.Sizeof(bucketOf{})]byte
	bucketOf
}

type bucketOf struct {
	hashes  [entriesPerMapBucket]uint64
	entries [entriesPerMapBucket]unsafe.Pointer // *entryOf
	next    unsafe.Pointer                      // *bucketOfPadded
	mu      sync.Mutex
}

// entryOf is an immutable map entry.
type entryOf[K comparable, V any] struct {
	key   K
	value V
}

// NewMapOf creates a new MapOf instance with string keys.
func NewMapOf[V any]() *MapOf[string, V] {
	return NewTypedMapOfPresized[string, V](hashString, minMapTableCap)
}

// NewMapOfPresized creates a new MapOf instance with string keys and capacity
// enough to hold sizeHint entries. If sizeHint is zero or negative, the value
// is ignored.
func NewMapOfPresized[V any](sizeHint int) *MapOf[string, V] {
	return NewTypedMapOfPresized[string, V](hashString, sizeHint)
}

// IntegerConstraint represents any integer type.
type IntegerConstraint interface {
	// Recreation of golang.org/x/exp/constraints.Integer to avoid taking a dependency on an
	// experimental package.
	~int | ~int8 | ~int16 | ~int32 | ~int64 | ~uint | ~uint8 | ~uint16 | ~uint32 | ~uint64 | ~uintptr
}

// NewIntegerMapOf creates a new MapOf instance with integer typed keys.
func NewIntegerMapOf[K IntegerConstraint, V any]() *MapOf[K, V] {
	return NewTypedMapOfPresized[K, V](hashUint64[K], minMapTableCap)
}

// NewIntegerMapOfPresized creates a new MapOf instance with integer typed keys
// and capacity enough to hold sizeHint entries. If sizeHint is zero or
// negative, the value is ignored.
func NewIntegerMapOfPresized[K IntegerConstraint, V any](sizeHint int) *MapOf[K, V] {
	return NewTypedMapOfPresized[K, V](hashUint64[K], sizeHint)
}

// NewTypedMapOf creates a new MapOf instance with arbitrarily typed keys.
//
// Keys are hashed to uint64 using the hasher function. It is strongly
// recommended to use the hash/maphash package to implement hasher. See the
// example for how to do that.
func NewTypedMapOf[K comparable, V any](hasher func(maphash.Seed, K) uint64) *MapOf[K, V] {
	return NewTypedMapOfPresized[K, V](hasher, minMapTableCap)
}

// NewTypedMapOfPresized creates a new MapOf instance with arbitrarily typed
// keys and capacity enough to hold sizeHint entries. If sizeHint is zero or
// negative, the value is ignored.
//
// Keys are hashed to uint64 using the hasher function. It is strongly
// recommended to use the hash/maphash package to implement hasher. See the
// example for how to do that.
func NewTypedMapOfPresized[K comparable, V any](hasher func(maphash.Seed, K) uint64, sizeHint int) *MapOf[K, V] {
	m := &MapOf[K, V]{}
	m.resizeCond = *sync.NewCond(&m.resizeMu)
	m.hasher = hasher
	var table *mapOfTable[K, V]
	if sizeHint <= minMapTableCap {
		table = newMapOfTable[K, V](minMapTableLen)
	} else {
		tableLen := nextPowOf2(uint32(sizeHint / entriesPerMapBucket))
		table = newMapOfTable[K, V](int(tableLen))
	}
	atomic.StorePointer(&m.table, unsafe.Pointer(table))
	return m
}

func newMapOfTable[K comparable, V any](tableLen int) *mapOfTable[K, V] {
	buckets := make([]bucketOfPadded, tableLen)
	counterLen := tableLen >> 10
	if counterLen < minMapCounterLen {
		counterLen = minMapCounterLen
	} else if counterLen > maxMapCounterLen {
		counterLen = maxMapCounterLen
	}
	counter := make([]counterStripe, counterLen)
	t := &mapOfTable[K, V]{
		buckets: buckets,
		size:    counter,
		seed:    maphash.MakeSeed(),
	}
	return t
}

// Load returns the value stored in the map for a key, or nil if no
// value is present.
// The ok result indicates whether value was found in the map.
func (m *MapOf[K, V]) Load(key K) (value V, ok bool) {
	table := (*mapOfTable[K, V])(atomic.LoadPointer(&m.table))
	hash := shiftHash(m.hasher(table.seed, key))
	bidx := uint64(len(table.buckets)-1) & hash
	b := &table.buckets[bidx]
	for {
		for i := 0; i < entriesPerMapBucket; i++ {
			// We treat the hash code only as a hint, so there is no
			// need to get an atomic snapshot.
			h := atomic.LoadUint64(&b.hashes[i])
			if h == uint64(0) || h != hash {
				continue
			}
			eptr := atomic.LoadPointer(&b.entries[i])
			if eptr == nil {
				continue
			}
			e := (*entryOf[K, V])(eptr)
			if e.key == key {
				return e.value, true
			}
		}
		bptr := atomic.LoadPointer(&b.next)
		if bptr == nil {
			return
		}
		b = (*bucketOfPadded)(bptr)
	}
}

// Store sets the value for a key.
func (m *MapOf[K, V]) Store(key K, value V) {
	m.doCompute(
		key,
		func(V, bool) (V, bool) {
			return value, false
		},
		false,
		false,
	)
}

// LoadOrStore returns the existing value for the key if present.
// Otherwise, it stores and returns the given value.
// The loaded result is true if the value was loaded, false if stored.
func (m *MapOf[K, V]) LoadOrStore(key K, value V) (actual V, loaded bool) {
	return m.doCompute(
		key,
		func(V, bool) (V, bool) {
			return value, false
		},
		true,
		false,
	)
}

// LoadAndStore returns the existing value for the key if present,
// while setting the new value for the key.
// It stores the new value and returns the existing one, if present.
// The loaded result is true if the existing value was loaded,
// false otherwise.
func (m *MapOf[K, V]) LoadAndStore(key K, value V) (actual V, loaded bool) {
	return m.doCompute(
		key,
		func(V, bool) (V, bool) {
			return value, false
		},
		false,
		false,
	)
}

// LoadOrCompute returns the existing value for the key if present.
// Otherwise, it computes the value using the provided function and
// returns the computed value. The loaded result is true if the value
// was loaded, false if stored.
func (m *MapOf[K, V]) LoadOrCompute(key K, valueFn func() V) (actual V, loaded bool) {
	return m.doCompute(
		key,
		func(V, bool) (V, bool) {
			return valueFn(), false
		},
		true,
		false,
	)
}

// Compute either sets the computed new value for the key or deletes
// the value for the key. When the delete result of the valueFn function
// is set to true, the value will be deleted, if it exists. When delete
// is set to false, the value is updated to the newValue.
// The ok result indicates whether value was computed and stored, thus, is
// present in the map. The actual result contains the new value in cases where
// the value was computed and stored. See the example for a few use cases.
func (m *MapOf[K, V]) Compute(
	key K,
	valueFn func(oldValue V, loaded bool) (newValue V, delete bool),
) (actual V, ok bool) {
	return m.doCompute(key, valueFn, false, true)
}

// LoadAndDelete deletes the value for a key, returning the previous
// value if any. The loaded result reports whether the key was
// present.
func (m *MapOf[K, V]) LoadAndDelete(key K) (value V, loaded bool) {
	return m.doCompute(
		key,
		func(value V, loaded bool) (V, bool) {
			return value, true
		},
		false,
		false,
	)
}

// Delete deletes the value for a key.
func (m *MapOf[K, V]) Delete(key K) {
	m.doCompute(
		key,
		func(value V, loaded bool) (V, bool) {
			return value, true
		},
		false,
		false,
	)
}

func (m *MapOf[K, V]) doCompute(
	key K,
	valueFn func(oldValue V, loaded bool) (V, bool),
	loadIfExists, computeOnly bool,
) (V, bool) {
	// Read-only path.
	if loadIfExists {
		if v, ok := m.Load(key); ok {
			return v, !computeOnly
		}
	}
	// Write path.
	for {
	compute_attempt:
		var (
			emptyb       *bucketOfPadded
			emptyidx     int
			hintNonEmpty int
		)
		table := (*mapOfTable[K, V])(atomic.LoadPointer(&m.table))
		tableLen := len(table.buckets)
		hash := shiftHash(m.hasher(table.seed, key))
		bidx := uint64(len(table.buckets)-1) & hash
		rootb := &table.buckets[bidx]
		rootb.mu.Lock()
		if m.newerTableExists(table) {
			// Someone resized the table. Go for another attempt.
			rootb.mu.Unlock()
			goto compute_attempt
		}
		if m.resizeInProgress() {
			// Resize is in progress. Wait, then go for another attempt.
			rootb.mu.Unlock()
			m.waitForResize()
			goto compute_attempt
		}
		b := rootb
		for {
			for i := 0; i < entriesPerMapBucket; i++ {
				h := atomic.LoadUint64(&b.hashes[i])
				if h == uint64(0) {
					if emptyb == nil {
						emptyb = b
						emptyidx = i
					}
					continue
				}
				if h != hash {
					hintNonEmpty++
					continue
				}
				e := (*entryOf[K, V])(b.entries[i])
				if e.key == key {
					if loadIfExists {
						rootb.mu.Unlock()
						return e.value, !computeOnly
					}
					// In-place update/delete.
					// We get a copy of the value via an interface{} on each call,
					// thus the live value pointers are unique. Otherwise atomic
					// snapshot won't be correct in case of multiple Store calls
					// using the same value.
					oldv := e.value
					newv, del := valueFn(oldv, true)
					if del {
						// Deletion.
						// First we update the hash, then the entry.
						atomic.StoreUint64(&b.hashes[i], uint64(0))
						atomic.StorePointer(&b.entries[i], nil)
						leftEmpty := false
						if hintNonEmpty == 0 {
							leftEmpty = isEmptyBucketOf(b)
						}
						rootb.mu.Unlock()
						table.addSize(bidx, -1)
						// Might need to shrink the table.
						if leftEmpty {
							m.resize(table, mapShrinkHint)
						}
						return oldv, !computeOnly
					}
					newe := new(entryOf[K, V])
					newe.key = key
					newe.value = newv
					atomic.StorePointer(&b.entries[i], unsafe.Pointer(newe))
					rootb.mu.Unlock()
					if computeOnly {
						// Compute expects the new value to be returned.
						return newv, true
					}
					// LoadAndStore expects the old value to be returned.
					return oldv, true
				}
				hintNonEmpty++
			}
			if b.next == nil {
				if emptyb != nil {
					// Insertion into an existing bucket.
					var zeroedV V
					newValue, del := valueFn(zeroedV, false)
					if del {
						rootb.mu.Unlock()
						return zeroedV, false
					}
					newe := new(entryOf[K, V])
					newe.key = key
					newe.value = newValue
					// First we update the hash, then the entry.
					atomic.StoreUint64(&emptyb.hashes[emptyidx], hash)
					atomic.StorePointer(&emptyb.entries[emptyidx], unsafe.Pointer(newe))
					rootb.mu.Unlock()
					table.addSize(bidx, 1)
					return newValue, computeOnly
				}
				growThreshold := float64(tableLen) * entriesPerMapBucket * mapLoadFactor
				if table.sumSize() > int64(growThreshold) {
					// Need to grow the table. Then go for another attempt.
					rootb.mu.Unlock()
					m.resize(table, mapGrowHint)
					goto compute_attempt
				}
				// Insertion into a new bucket.
				var zeroedV V
				newValue, del := valueFn(zeroedV, false)
				if del {
					rootb.mu.Unlock()
					return newValue, false
				}
				// Create and append the bucket.
				newb := new(bucketOfPadded)
				newb.hashes[0] = hash
				newe := new(entryOf[K, V])
				newe.key = key
				newe.value = newValue
				newb.entries[0] = unsafe.Pointer(newe)
				atomic.StorePointer(&b.next, unsafe.Pointer(newb))
				rootb.mu.Unlock()
				table.addSize(bidx, 1)
				return newValue, computeOnly
			}
			b = (*bucketOfPadded)(b.next)
		}
	}
}

func (m *MapOf[K, V]) newerTableExists(table *mapOfTable[K, V]) bool {
	curTablePtr := atomic.LoadPointer(&m.table)
	return uintptr(curTablePtr) != uintptr(unsafe.Pointer(table))
}

func (m *MapOf[K, V]) resizeInProgress() bool {
	return atomic.LoadInt64(&m.resizing) == 1
}

func (m *MapOf[K, V]) waitForResize() {
	m.resizeMu.Lock()
	for m.resizeInProgress() {
		m.resizeCond.Wait()
	}
	m.resizeMu.Unlock()
}

func (m *MapOf[K, V]) resize(table *mapOfTable[K, V], hint mapResizeHint) {
	var shrinkThreshold int64
	tableLen := len(table.buckets)
	// Fast path for shrink attempts.
	if hint == mapShrinkHint {
		shrinkThreshold = int64((tableLen * entriesPerMapBucket) / mapShrinkFraction)
		if tableLen == minMapTableLen || table.sumSize() > shrinkThreshold {
			return
		}
	}
	// Slow path.
	if !atomic.CompareAndSwapInt64(&m.resizing, 0, 1) {
		// Someone else started resize. Wait for it to finish.
		m.waitForResize()
		return
	}
	var newTable *mapOfTable[K, V]
	switch hint {
	case mapGrowHint:
		// Grow the table with factor of 2.
		atomic.AddInt64(&m.totalGrowths, 1)
		newTable = newMapOfTable[K, V](tableLen << 1)
	case mapShrinkHint:
		if table.sumSize() <= shrinkThreshold {
			// Shrink the table with factor of 2.
			atomic.AddInt64(&m.totalShrinks, 1)
			newTable = newMapOfTable[K, V](tableLen >> 1)
		} else {
			// No need to shrink. Wake up all waiters and give up.
			m.resizeMu.Lock()
			atomic.StoreInt64(&m.resizing, 0)
			m.resizeCond.Broadcast()
			m.resizeMu.Unlock()
			return
		}
	case mapClearHint:
		newTable = newMapOfTable[K, V](minMapTableLen)
	default:
		panic(fmt.Sprintf("unexpected resize hint: %d", hint))
	}
	// Copy the data only if we're not clearing the map.
	if hint != mapClearHint {
		for i := 0; i < tableLen; i++ {
			copied := copyBucketOf(&table.buckets[i], newTable, m.hasher)
			newTable.addSizePlain(uint64(i), copied)
		}
	}
	// Publish the new table and wake up all waiters.
	atomic.StorePointer(&m.table, unsafe.Pointer(newTable))
	m.resizeMu.Lock()
	atomic.StoreInt64(&m.resizing, 0)
	m.resizeCond.Broadcast()
	m.resizeMu.Unlock()
}

func copyBucketOf[K comparable, V any](
	b *bucketOfPadded,
	destTable *mapOfTable[K, V],
	hasher func(maphash.Seed, K) uint64,
) (copied int) {
	rootb := b
	rootb.mu.Lock()
	for {
		for i := 0; i < entriesPerMapBucket; i++ {
			if b.entries[i] != nil {
				e := (*entryOf[K, V])(b.entries[i])
				hash := shiftHash(hasher(destTable.seed, e.key))
				bidx := uint64(len(destTable.buckets)-1) & hash
				destb := &destTable.buckets[bidx]
				appendToBucketOf(hash, b.entries[i], destb)
				copied++
			}
		}
		if b.next == nil {
			rootb.mu.Unlock()
			return
		}
		b = (*bucketOfPadded)(b.next)
	}
}

// Range calls f sequentially for each key and value present in the
// map. If f returns false, range stops the iteration.
//
// Range does not necessarily correspond to any consistent snapshot
// of the Map's contents: no key will be visited more than once, but
// if the value for any key is stored or deleted concurrently, Range
// may reflect any mapping for that key from any point during the
// Range call.
//
// It is safe to modify the map while iterating it. However, the
// concurrent modification rule apply, i.e. the changes may be not
// reflected in the subsequently iterated entries.
func (m *MapOf[K, V]) Range(f func(key K, value V) bool) {
	var zeroPtr unsafe.Pointer
	// Pre-allocate array big enough to fit entries for most hash tables.
	bentries := make([]unsafe.Pointer, 0, 16*entriesPerMapBucket)
	tablep := atomic.LoadPointer(&m.table)
	table := *(*mapOfTable[K, V])(tablep)
	for i := range table.buckets {
		rootb := &table.buckets[i]
		b := rootb
		// Prevent concurrent modifications and copy all entries into
		// the intermediate slice.
		rootb.mu.Lock()
		for {
			for i := 0; i < entriesPerMapBucket; i++ {
				if b.entries[i] != nil {
					bentries = append(bentries, b.entries[i])
				}
			}
			if b.next == nil {
				rootb.mu.Unlock()
				break
			}
			b = (*bucketOfPadded)(b.next)
		}
		// Call the function for all copied entries.
		for j := range bentries {
			entry := (*entryOf[K, V])(bentries[j])
			if !f(entry.key, entry.value) {
				return
			}
			// Remove the reference to avoid preventing the copied
			// entries from being GCed until this method finishes.
			bentries[j] = zeroPtr
		}
		bentries = bentries[:0]
	}
}

// Clear deletes all keys and values currently stored in the map.
func (m *MapOf[K, V]) Clear() {
	table := (*mapOfTable[K, V])(atomic.LoadPointer(&m.table))
	m.resize(table, mapClearHint)
}

// Size returns current size of the map.
func (m *MapOf[K, V]) Size() int {
	table := (*mapOfTable[K, V])(atomic.LoadPointer(&m.table))
	return int(table.sumSize())
}

func appendToBucketOf(hash uint64, entryPtr unsafe.Pointer, b *bucketOfPadded) {
	for {
		for i := 0; i < entriesPerMapBucket; i++ {
			if b.entries[i] == nil {
				b.hashes[i] = hash
				b.entries[i] = entryPtr
				return
			}
		}
		if b.next == nil {
			newb := new(bucketOfPadded)
			newb.hashes[0] = hash
			newb.entries[0] = entryPtr
			b.next = unsafe.Pointer(newb)
			return
		}
		b = (*bucketOfPadded)(b.next)
	}
}

func isEmptyBucketOf(rootb *bucketOfPadded) bool {
	b := rootb
	for {
		for i := 0; i < entriesPerMapBucket; i++ {
			if b.entries[i] != nil {
				return false
			}
		}
		if b.next == nil {
			return true
		}
		b = (*bucketOfPadded)(b.next)
	}
}

func (table *mapOfTable[K, V]) addSize(bucketIdx uint64, delta int) {
	cidx := uint64(len(table.size)-1) & bucketIdx
	atomic.AddInt64(&table.size[cidx].c, int64(delta))
}

func (table *mapOfTable[K, V]) addSizePlain(bucketIdx uint64, delta int) {
	cidx := uint64(len(table.size)-1) & bucketIdx
	table.size[cidx].c += int64(delta)
}

func (table *mapOfTable[K, V]) sumSize() int64 {
	sum := int64(0)
	for i := range table.size {
		sum += atomic.LoadInt64(&table.size[i].c)
	}
	return sum
}

func shiftHash(h uint64) uint64 {
	// uint64(0) is a reserved value which stands for an empty slot.
	if h == uint64(0) {
		return uint64(1)
	}
	return h
}

// O(N) operation; use for debug purposes only
func (m *MapOf[K, V]) stats() mapStats {
	stats := mapStats{
		TotalGrowths: atomic.LoadInt64(&m.totalGrowths),
		TotalShrinks: atomic.LoadInt64(&m.totalShrinks),
		MinEntries:   math.MaxInt32,
	}
	table := (*mapOfTable[K, V])(atomic.LoadPointer(&m.table))
	stats.RootBuckets = len(table.buckets)
	stats.Counter = int(table.sumSize())
	stats.CounterLen = len(table.size)
	for i := range table.buckets {
		nentries := 0
		b := &table.buckets[i]
		stats.TotalBuckets++
		for {
			nentriesLocal := 0
			stats.Capacity += entriesPerMapBucket
			for i := 0; i < entriesPerMapBucket; i++ {
				if atomic.LoadPointer(&b.entries[i]) != nil {
					stats.Size++
					nentriesLocal++
				}
			}
			nentries += nentriesLocal
			if nentriesLocal == 0 {
				stats.EmptyBuckets++
			}
			if b.next == nil {
				break
			}
			b = (*bucketOfPadded)(b.next)
			stats.TotalBuckets++
		}
		if nentries < stats.MinEntries {
			stats.MinEntries = nentries
		}
		if nentries > stats.MaxEntries {
			stats.MaxEntries = nentries
		}
	}
	return stats
}
