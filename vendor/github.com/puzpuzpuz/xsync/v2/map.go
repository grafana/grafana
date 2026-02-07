package xsync

import (
	"fmt"
	"hash/maphash"
	"math"
	"runtime"
	"strings"
	"sync"
	"sync/atomic"
	"unsafe"
)

type mapResizeHint int

const (
	mapGrowHint   mapResizeHint = 0
	mapShrinkHint mapResizeHint = 1
	mapClearHint  mapResizeHint = 2
)

const (
	// number of entries per bucket; 3 entries lead to size of 64B
	// (one cache line) on 64-bit machines
	entriesPerMapBucket = 3
	// threshold fraction of table occupation to start a table shrinking
	// when deleting the last entry in a bucket chain
	mapShrinkFraction = 128
	// map load factor to trigger a table resize during insertion;
	// a map holds up to mapLoadFactor*entriesPerMapBucket*mapTableLen
	// key-value pairs (this is a soft limit)
	mapLoadFactor = 0.75
	// minimal table size, i.e. number of buckets; thus, minimal map
	// capacity can be calculated as entriesPerMapBucket*minMapTableLen
	minMapTableLen = 32
	// minimal table capacity
	minMapTableCap = minMapTableLen * entriesPerMapBucket
	// minimum counter stripes to use
	minMapCounterLen = 8
	// maximum counter stripes to use; stands for around 4KB of memory
	maxMapCounterLen = 32
)

var (
	topHashMask       = uint64((1<<20)-1) << 44
	topHashEntryMasks = [3]uint64{
		topHashMask,
		topHashMask >> 20,
		topHashMask >> 40,
	}
)

// Map is like a Go map[string]interface{} but is safe for concurrent
// use by multiple goroutines without additional locking or
// coordination. It follows the interface of sync.Map with
// a number of valuable extensions like Compute or Size.
//
// A Map must not be copied after first use.
//
// Map uses a modified version of Cache-Line Hash Table (CLHT)
// data structure: https://github.com/LPD-EPFL/CLHT
//
// CLHT is built around idea to organize the hash table in
// cache-line-sized buckets, so that on all modern CPUs update
// operations complete with at most one cache-line transfer.
// Also, Get operations involve no write to memory, as well as no
// mutexes or any other sort of locks. Due to this design, in all
// considered scenarios Map outperforms sync.Map.
//
// One important difference with sync.Map is that only string keys
// are supported. That's because Golang standard library does not
// expose the built-in hash functions for interface{} values.
type Map struct {
	totalGrowths int64
	totalShrinks int64
	resizing     int64          // resize in progress flag; updated atomically
	resizeMu     sync.Mutex     // only used along with resizeCond
	resizeCond   sync.Cond      // used to wake up resize waiters (concurrent modifications)
	table        unsafe.Pointer // *mapTable
}

type mapTable struct {
	buckets []bucketPadded
	// striped counter for number of table entries;
	// used to determine if a table shrinking is needed
	// occupies min(buckets_memory/1024, 64KB) of memory
	size []counterStripe
	seed maphash.Seed
}

type counterStripe struct {
	c int64
	//lint:ignore U1000 prevents false sharing
	pad [cacheLineSize - 8]byte
}

type bucketPadded struct {
	//lint:ignore U1000 ensure each bucket takes two cache lines on both 32 and 64-bit archs
	pad [cacheLineSize - unsafe.Sizeof(bucket{})]byte
	bucket
}

type bucket struct {
	next   unsafe.Pointer // *bucketPadded
	keys   [entriesPerMapBucket]unsafe.Pointer
	values [entriesPerMapBucket]unsafe.Pointer
	// topHashMutex is a 2-in-1 value.
	//
	// It contains packed top 20 bits (20 MSBs) of hash codes for keys
	// stored in the bucket:
	// | key 0's top hash | key 1's top hash | key 2's top hash | bitmap for keys | mutex |
	// |      20 bits     |      20 bits     |      20 bits     |     3 bits      | 1 bit |
	//
	// The least significant bit is used for the mutex (TTAS spinlock).
	topHashMutex uint64
}

type rangeEntry struct {
	key   unsafe.Pointer
	value unsafe.Pointer
}

// NewMap creates a new Map instance.
func NewMap() *Map {
	return NewMapPresized(minMapTableCap)
}

// NewMapPresized creates a new Map instance with capacity enough to hold
// sizeHint entries. If sizeHint is zero or negative, the value is ignored.
func NewMapPresized(sizeHint int) *Map {
	m := &Map{}
	m.resizeCond = *sync.NewCond(&m.resizeMu)
	var table *mapTable
	if sizeHint <= minMapTableCap {
		table = newMapTable(minMapTableLen)
	} else {
		tableLen := nextPowOf2(uint32(sizeHint / entriesPerMapBucket))
		table = newMapTable(int(tableLen))
	}
	atomic.StorePointer(&m.table, unsafe.Pointer(table))
	return m
}

func newMapTable(tableLen int) *mapTable {
	buckets := make([]bucketPadded, tableLen)
	counterLen := tableLen >> 10
	if counterLen < minMapCounterLen {
		counterLen = minMapCounterLen
	} else if counterLen > maxMapCounterLen {
		counterLen = maxMapCounterLen
	}
	counter := make([]counterStripe, counterLen)
	t := &mapTable{
		buckets: buckets,
		size:    counter,
		seed:    maphash.MakeSeed(),
	}
	return t
}

// Load returns the value stored in the map for a key, or nil if no
// value is present.
// The ok result indicates whether value was found in the map.
func (m *Map) Load(key string) (value interface{}, ok bool) {
	table := (*mapTable)(atomic.LoadPointer(&m.table))
	hash := hashString(table.seed, key)
	bidx := uint64(len(table.buckets)-1) & hash
	b := &table.buckets[bidx]
	for {
		topHashes := atomic.LoadUint64(&b.topHashMutex)
		for i := 0; i < entriesPerMapBucket; i++ {
			if !topHashMatch(hash, topHashes, i) {
				continue
			}
		atomic_snapshot:
			// Start atomic snapshot.
			vp := atomic.LoadPointer(&b.values[i])
			kp := atomic.LoadPointer(&b.keys[i])
			if kp != nil && vp != nil {
				if key == derefKey(kp) {
					if uintptr(vp) == uintptr(atomic.LoadPointer(&b.values[i])) {
						// Atomic snapshot succeeded.
						return derefValue(vp), true
					}
					// Concurrent update/remove. Go for another spin.
					goto atomic_snapshot
				}
			}
		}
		bptr := atomic.LoadPointer(&b.next)
		if bptr == nil {
			return
		}
		b = (*bucketPadded)(bptr)
	}
}

// Store sets the value for a key.
func (m *Map) Store(key string, value interface{}) {
	m.doCompute(
		key,
		func(interface{}, bool) (interface{}, bool) {
			return value, false
		},
		false,
		false,
	)
}

// LoadOrStore returns the existing value for the key if present.
// Otherwise, it stores and returns the given value.
// The loaded result is true if the value was loaded, false if stored.
func (m *Map) LoadOrStore(key string, value interface{}) (actual interface{}, loaded bool) {
	return m.doCompute(
		key,
		func(interface{}, bool) (interface{}, bool) {
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
func (m *Map) LoadAndStore(key string, value interface{}) (actual interface{}, loaded bool) {
	return m.doCompute(
		key,
		func(interface{}, bool) (interface{}, bool) {
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
func (m *Map) LoadOrCompute(key string, valueFn func() interface{}) (actual interface{}, loaded bool) {
	return m.doCompute(
		key,
		func(interface{}, bool) (interface{}, bool) {
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
func (m *Map) Compute(
	key string,
	valueFn func(oldValue interface{}, loaded bool) (newValue interface{}, delete bool),
) (actual interface{}, ok bool) {
	return m.doCompute(key, valueFn, false, true)
}

// LoadAndDelete deletes the value for a key, returning the previous
// value if any. The loaded result reports whether the key was
// present.
func (m *Map) LoadAndDelete(key string) (value interface{}, loaded bool) {
	return m.doCompute(
		key,
		func(value interface{}, loaded bool) (interface{}, bool) {
			return value, true
		},
		false,
		false,
	)
}

// Delete deletes the value for a key.
func (m *Map) Delete(key string) {
	m.doCompute(
		key,
		func(value interface{}, loaded bool) (interface{}, bool) {
			return value, true
		},
		false,
		false,
	)
}

func (m *Map) doCompute(
	key string,
	valueFn func(oldValue interface{}, loaded bool) (interface{}, bool),
	loadIfExists, computeOnly bool,
) (interface{}, bool) {
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
			emptyb       *bucketPadded
			emptyidx     int
			hintNonEmpty int
		)
		table := (*mapTable)(atomic.LoadPointer(&m.table))
		tableLen := len(table.buckets)
		hash := hashString(table.seed, key)
		bidx := uint64(len(table.buckets)-1) & hash
		rootb := &table.buckets[bidx]
		lockBucket(&rootb.topHashMutex)
		if m.newerTableExists(table) {
			// Someone resized the table. Go for another attempt.
			unlockBucket(&rootb.topHashMutex)
			goto compute_attempt
		}
		if m.resizeInProgress() {
			// Resize is in progress. Wait, then go for another attempt.
			unlockBucket(&rootb.topHashMutex)
			m.waitForResize()
			goto compute_attempt
		}
		b := rootb
		for {
			topHashes := atomic.LoadUint64(&b.topHashMutex)
			for i := 0; i < entriesPerMapBucket; i++ {
				if b.keys[i] == nil {
					if emptyb == nil {
						emptyb = b
						emptyidx = i
					}
					continue
				}
				if !topHashMatch(hash, topHashes, i) {
					hintNonEmpty++
					continue
				}
				if key == derefKey(b.keys[i]) {
					vp := b.values[i]
					if loadIfExists {
						unlockBucket(&rootb.topHashMutex)
						return derefValue(vp), !computeOnly
					}
					// In-place update/delete.
					// We get a copy of the value via an interface{} on each call,
					// thus the live value pointers are unique. Otherwise atomic
					// snapshot won't be correct in case of multiple Store calls
					// using the same value.
					oldValue := derefValue(vp)
					newValue, del := valueFn(oldValue, true)
					if del {
						// Deletion.
						// First we update the value, then the key.
						// This is important for atomic snapshot states.
						atomic.StoreUint64(&b.topHashMutex, eraseTopHash(topHashes, i))
						atomic.StorePointer(&b.values[i], nil)
						atomic.StorePointer(&b.keys[i], nil)
						leftEmpty := false
						if hintNonEmpty == 0 {
							leftEmpty = isEmptyBucket(b)
						}
						unlockBucket(&rootb.topHashMutex)
						table.addSize(bidx, -1)
						// Might need to shrink the table.
						if leftEmpty {
							m.resize(table, mapShrinkHint)
						}
						return oldValue, !computeOnly
					}
					nvp := unsafe.Pointer(&newValue)
					if assertionsEnabled && vp == nvp {
						panic("non-unique value pointer")
					}
					atomic.StorePointer(&b.values[i], nvp)
					unlockBucket(&rootb.topHashMutex)
					if computeOnly {
						// Compute expects the new value to be returned.
						return newValue, true
					}
					// LoadAndStore expects the old value to be returned.
					return oldValue, true
				}
				hintNonEmpty++
			}
			if b.next == nil {
				if emptyb != nil {
					// Insertion into an existing bucket.
					var zeroedV interface{}
					newValue, del := valueFn(zeroedV, false)
					if del {
						unlockBucket(&rootb.topHashMutex)
						return zeroedV, false
					}
					// First we update the value, then the key.
					// This is important for atomic snapshot states.
					topHashes = atomic.LoadUint64(&emptyb.topHashMutex)
					atomic.StoreUint64(&emptyb.topHashMutex, storeTopHash(hash, topHashes, emptyidx))
					atomic.StorePointer(&emptyb.values[emptyidx], unsafe.Pointer(&newValue))
					atomic.StorePointer(&emptyb.keys[emptyidx], unsafe.Pointer(&key))
					unlockBucket(&rootb.topHashMutex)
					table.addSize(bidx, 1)
					return newValue, computeOnly
				}
				growThreshold := float64(tableLen) * entriesPerMapBucket * mapLoadFactor
				if table.sumSize() > int64(growThreshold) {
					// Need to grow the table. Then go for another attempt.
					unlockBucket(&rootb.topHashMutex)
					m.resize(table, mapGrowHint)
					goto compute_attempt
				}
				// Insertion into a new bucket.
				var zeroedV interface{}
				newValue, del := valueFn(zeroedV, false)
				if del {
					unlockBucket(&rootb.topHashMutex)
					return newValue, false
				}
				// Create and append the bucket.
				newb := new(bucketPadded)
				newb.keys[0] = unsafe.Pointer(&key)
				newb.values[0] = unsafe.Pointer(&newValue)
				newb.topHashMutex = storeTopHash(hash, newb.topHashMutex, 0)
				atomic.StorePointer(&b.next, unsafe.Pointer(newb))
				unlockBucket(&rootb.topHashMutex)
				table.addSize(bidx, 1)
				return newValue, computeOnly
			}
			b = (*bucketPadded)(b.next)
		}
	}
}

func (m *Map) newerTableExists(table *mapTable) bool {
	curTablePtr := atomic.LoadPointer(&m.table)
	return uintptr(curTablePtr) != uintptr(unsafe.Pointer(table))
}

func (m *Map) resizeInProgress() bool {
	return atomic.LoadInt64(&m.resizing) == 1
}

func (m *Map) waitForResize() {
	m.resizeMu.Lock()
	for m.resizeInProgress() {
		m.resizeCond.Wait()
	}
	m.resizeMu.Unlock()
}

func (m *Map) resize(table *mapTable, hint mapResizeHint) {
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
	var newTable *mapTable
	switch hint {
	case mapGrowHint:
		// Grow the table with factor of 2.
		atomic.AddInt64(&m.totalGrowths, 1)
		newTable = newMapTable(tableLen << 1)
	case mapShrinkHint:
		if table.sumSize() <= shrinkThreshold {
			// Shrink the table with factor of 2.
			atomic.AddInt64(&m.totalShrinks, 1)
			newTable = newMapTable(tableLen >> 1)
		} else {
			// No need to shrink. Wake up all waiters and give up.
			m.resizeMu.Lock()
			atomic.StoreInt64(&m.resizing, 0)
			m.resizeCond.Broadcast()
			m.resizeMu.Unlock()
			return
		}
	case mapClearHint:
		newTable = newMapTable(minMapTableLen)
	default:
		panic(fmt.Sprintf("unexpected resize hint: %d", hint))
	}
	// Copy the data only if we're not clearing the map.
	if hint != mapClearHint {
		for i := 0; i < tableLen; i++ {
			copied := copyBucket(&table.buckets[i], newTable)
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

func copyBucket(b *bucketPadded, destTable *mapTable) (copied int) {
	rootb := b
	lockBucket(&rootb.topHashMutex)
	for {
		for i := 0; i < entriesPerMapBucket; i++ {
			if b.keys[i] != nil {
				k := derefKey(b.keys[i])
				hash := hashString(destTable.seed, k)
				bidx := uint64(len(destTable.buckets)-1) & hash
				destb := &destTable.buckets[bidx]
				appendToBucket(hash, b.keys[i], b.values[i], destb)
				copied++
			}
		}
		if b.next == nil {
			unlockBucket(&rootb.topHashMutex)
			return
		}
		b = (*bucketPadded)(b.next)
	}
}

func appendToBucket(hash uint64, keyPtr, valPtr unsafe.Pointer, b *bucketPadded) {
	for {
		for i := 0; i < entriesPerMapBucket; i++ {
			if b.keys[i] == nil {
				b.keys[i] = keyPtr
				b.values[i] = valPtr
				b.topHashMutex = storeTopHash(hash, b.topHashMutex, i)
				return
			}
		}
		if b.next == nil {
			newb := new(bucketPadded)
			newb.keys[0] = keyPtr
			newb.values[0] = valPtr
			newb.topHashMutex = storeTopHash(hash, newb.topHashMutex, 0)
			b.next = unsafe.Pointer(newb)
			return
		}
		b = (*bucketPadded)(b.next)
	}
}

func isEmptyBucket(rootb *bucketPadded) bool {
	b := rootb
	for {
		for i := 0; i < entriesPerMapBucket; i++ {
			if b.keys[i] != nil {
				return false
			}
		}
		if b.next == nil {
			return true
		}
		b = (*bucketPadded)(b.next)
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
func (m *Map) Range(f func(key string, value interface{}) bool) {
	var zeroEntry rangeEntry
	// Pre-allocate array big enough to fit entries for most hash tables.
	bentries := make([]rangeEntry, 0, 16*entriesPerMapBucket)
	tablep := atomic.LoadPointer(&m.table)
	table := *(*mapTable)(tablep)
	for i := range table.buckets {
		rootb := &table.buckets[i]
		b := rootb
		// Prevent concurrent modifications and copy all entries into
		// the intermediate slice.
		lockBucket(&rootb.topHashMutex)
		for {
			for i := 0; i < entriesPerMapBucket; i++ {
				if b.keys[i] != nil {
					bentries = append(bentries, rangeEntry{
						key:   b.keys[i],
						value: b.values[i],
					})
				}
			}
			if b.next == nil {
				unlockBucket(&rootb.topHashMutex)
				break
			}
			b = (*bucketPadded)(b.next)
		}
		// Call the function for all copied entries.
		for j := range bentries {
			k := derefKey(bentries[j].key)
			v := derefValue(bentries[j].value)
			if !f(k, v) {
				return
			}
			// Remove the reference to avoid preventing the copied
			// entries from being GCed until this method finishes.
			bentries[j] = zeroEntry
		}
		bentries = bentries[:0]
	}
}

// Clear deletes all keys and values currently stored in the map.
func (m *Map) Clear() {
	table := (*mapTable)(atomic.LoadPointer(&m.table))
	m.resize(table, mapClearHint)
}

// Size returns current size of the map.
func (m *Map) Size() int {
	table := (*mapTable)(atomic.LoadPointer(&m.table))
	return int(table.sumSize())
}

func derefKey(keyPtr unsafe.Pointer) string {
	return *(*string)(keyPtr)
}

func derefValue(valuePtr unsafe.Pointer) interface{} {
	return *(*interface{})(valuePtr)
}

func lockBucket(mu *uint64) {
	for {
		var v uint64
		for {
			v = atomic.LoadUint64(mu)
			if v&1 != 1 {
				break
			}
			runtime.Gosched()
		}
		if atomic.CompareAndSwapUint64(mu, v, v|1) {
			return
		}
		runtime.Gosched()
	}
}

func unlockBucket(mu *uint64) {
	v := atomic.LoadUint64(mu)
	atomic.StoreUint64(mu, v&^1)
}

func topHashMatch(hash, topHashes uint64, idx int) bool {
	if topHashes&(1<<(idx+1)) == 0 {
		// Entry is not present.
		return false
	}
	hash = hash & topHashMask
	topHashes = (topHashes & topHashEntryMasks[idx]) << (20 * idx)
	return hash == topHashes
}

func storeTopHash(hash, topHashes uint64, idx int) uint64 {
	// Zero out top hash at idx.
	topHashes = topHashes &^ topHashEntryMasks[idx]
	// Chop top 20 MSBs of the given hash and position them at idx.
	hash = (hash & topHashMask) >> (20 * idx)
	// Store the MSBs.
	topHashes = topHashes | hash
	// Mark the entry as present.
	return topHashes | (1 << (idx + 1))
}

func eraseTopHash(topHashes uint64, idx int) uint64 {
	return topHashes &^ (1 << (idx + 1))
}

func (table *mapTable) addSize(bucketIdx uint64, delta int) {
	cidx := uint64(len(table.size)-1) & bucketIdx
	atomic.AddInt64(&table.size[cidx].c, int64(delta))
}

func (table *mapTable) addSizePlain(bucketIdx uint64, delta int) {
	cidx := uint64(len(table.size)-1) & bucketIdx
	table.size[cidx].c += int64(delta)
}

func (table *mapTable) sumSize() int64 {
	sum := int64(0)
	for i := range table.size {
		sum += atomic.LoadInt64(&table.size[i].c)
	}
	return sum
}

type mapStats struct {
	RootBuckets  int
	TotalBuckets int
	EmptyBuckets int
	Capacity     int
	Size         int // calculated number of entries
	Counter      int // number of entries according to table counter
	CounterLen   int // number of counter stripes
	MinEntries   int // min entries per chain of buckets
	MaxEntries   int // max entries per chain of buckets
	TotalGrowths int64
	TotalShrinks int64
}

func (s *mapStats) ToString() string {
	var sb strings.Builder
	sb.WriteString("\n---\n")
	sb.WriteString(fmt.Sprintf("RootBuckets:  %d\n", s.RootBuckets))
	sb.WriteString(fmt.Sprintf("TotalBuckets: %d\n", s.TotalBuckets))
	sb.WriteString(fmt.Sprintf("EmptyBuckets: %d\n", s.EmptyBuckets))
	sb.WriteString(fmt.Sprintf("Capacity:     %d\n", s.Capacity))
	sb.WriteString(fmt.Sprintf("Size:         %d\n", s.Size))
	sb.WriteString(fmt.Sprintf("Counter:      %d\n", s.Counter))
	sb.WriteString(fmt.Sprintf("CounterLen:   %d\n", s.CounterLen))
	sb.WriteString(fmt.Sprintf("MinEntries:   %d\n", s.MinEntries))
	sb.WriteString(fmt.Sprintf("MaxEntries:   %d\n", s.MaxEntries))
	sb.WriteString(fmt.Sprintf("TotalGrowths: %d\n", s.TotalGrowths))
	sb.WriteString(fmt.Sprintf("TotalShrinks: %d\n", s.TotalShrinks))
	sb.WriteString("---\n")
	return sb.String()
}

// O(N) operation; use for debug purposes only
func (m *Map) stats() mapStats {
	stats := mapStats{
		TotalGrowths: atomic.LoadInt64(&m.totalGrowths),
		TotalShrinks: atomic.LoadInt64(&m.totalShrinks),
		MinEntries:   math.MaxInt32,
	}
	table := (*mapTable)(atomic.LoadPointer(&m.table))
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
				if atomic.LoadPointer(&b.keys[i]) != nil {
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
			b = (*bucketPadded)(b.next)
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
