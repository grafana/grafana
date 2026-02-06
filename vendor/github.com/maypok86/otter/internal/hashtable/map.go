// Copyright (c) 2023 Alexey Mayshev. All rights reserved.
// Copyright (c) 2021 Andrey Pechkurov
//
// Copyright notice. This code is a fork of xsync.MapOf from this file with some changes:
// https://github.com/puzpuzpuz/xsync/blob/main/mapof.go
//
// Use of this source code is governed by a MIT license that can be found
// at https://github.com/puzpuzpuz/xsync/blob/main/LICENSE

package hashtable

import (
	"fmt"
	"sync"
	"sync/atomic"
	"unsafe"

	"github.com/dolthub/maphash"

	"github.com/maypok86/otter/internal/generated/node"
	"github.com/maypok86/otter/internal/xmath"
	"github.com/maypok86/otter/internal/xruntime"
)

type resizeHint int

const (
	growHint   resizeHint = 0
	shrinkHint resizeHint = 1
	clearHint  resizeHint = 2
)

const (
	// number of entries per bucket
	// 3 because we need to fit them into 1 cache line (64 bytes).
	bucketSize = 3
	// percentage at which the map will be expanded.
	loadFactor = 0.75
	// threshold fraction of table occupation to start a table shrinking
	// when deleting the last entry in a bucket chain.
	shrinkFraction   = 128
	minBucketCount   = 32
	minNodeCount     = bucketSize * minBucketCount
	minCounterLength = 8
	maxCounterLength = 32
)

// Map is like a Go map[K]V but is safe for concurrent
// use by multiple goroutines without additional locking or
// coordination.
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
type Map[K comparable, V any] struct {
	table unsafe.Pointer

	nodeManager *node.Manager[K, V]
	// only used along with resizeCond
	resizeMutex sync.Mutex
	// used to wake up resize waiters (concurrent modifications)
	resizeCond sync.Cond
	// resize in progress flag; updated atomically
	resizing atomic.Int64
}

type table[K comparable] struct {
	buckets []paddedBucket
	// sharded counter for number of table entries;
	// used to determine if a table shrinking is needed
	// occupies min(buckets_memory/1024, 64KB) of memory
	size   []paddedCounter
	mask   uint64
	hasher maphash.Hasher[K]
}

func (t *table[K]) addSize(bucketIdx uint64, delta int) {
	//nolint:gosec // there will never be an overflow
	counterIdx := uint64(len(t.size)-1) & bucketIdx
	atomic.AddInt64(&t.size[counterIdx].c, int64(delta))
}

func (t *table[K]) addSizePlain(bucketIdx uint64, delta int) {
	//nolint:gosec // there will never be an overflow
	counterIdx := uint64(len(t.size)-1) & bucketIdx
	t.size[counterIdx].c += int64(delta)
}

func (t *table[K]) sumSize() int64 {
	sum := int64(0)
	for i := range t.size {
		sum += atomic.LoadInt64(&t.size[i].c)
	}
	return sum
}

func (t *table[K]) calcShiftHash(key K) uint64 {
	// uint64(0) is a reserved value which stands for an empty slot.
	h := t.hasher.Hash(key)
	if h == uint64(0) {
		return 1
	}

	return h
}

type counter struct {
	c int64
}

type paddedCounter struct {
	// padding prevents false sharing.
	padding [xruntime.CacheLineSize - unsafe.Sizeof(counter{})]byte

	counter
}

// NewWithSize creates a new Map instance with capacity enough
// to hold size nodes. If size is zero or negative, the value
// is ignored.
func NewWithSize[K comparable, V any](nodeManager *node.Manager[K, V], size int) *Map[K, V] {
	return newMap[K, V](nodeManager, size)
}

// New creates a new Map instance.
func New[K comparable, V any](nodeManager *node.Manager[K, V]) *Map[K, V] {
	return newMap[K, V](nodeManager, minNodeCount)
}

func newMap[K comparable, V any](nodeManager *node.Manager[K, V], size int) *Map[K, V] {
	m := &Map[K, V]{
		nodeManager: nodeManager,
	}
	m.resizeCond = *sync.NewCond(&m.resizeMutex)
	var t *table[K]
	if size <= minNodeCount {
		t = newTable(minBucketCount, maphash.NewHasher[K]())
	} else {
		//nolint:gosec // there will never be an overflow
		bucketCount := xmath.RoundUpPowerOf2(uint32(size / bucketSize))
		t = newTable(int(bucketCount), maphash.NewHasher[K]())
	}
	atomic.StorePointer(&m.table, unsafe.Pointer(t))
	return m
}

func newTable[K comparable](bucketCount int, prevHasher maphash.Hasher[K]) *table[K] {
	buckets := make([]paddedBucket, bucketCount)
	counterLength := bucketCount >> 10
	if counterLength < minCounterLength {
		counterLength = minCounterLength
	} else if counterLength > maxCounterLength {
		counterLength = maxCounterLength
	}
	counter := make([]paddedCounter, counterLength)
	//nolint:gosec // there will never be an overflow
	mask := uint64(len(buckets) - 1)
	t := &table[K]{
		buckets: buckets,
		size:    counter,
		mask:    mask,
		hasher:  maphash.NewSeed[K](prevHasher),
	}
	return t
}

// Get returns the node.Node stored in the map for a key, or nil if no node is present.
//
// The ok result indicates whether node was found in the map.
func (m *Map[K, V]) Get(key K) (got node.Node[K, V], ok bool) {
	t := (*table[K])(atomic.LoadPointer(&m.table))
	hash := t.calcShiftHash(key)
	bucketIdx := hash & t.mask
	b := &t.buckets[bucketIdx]
	for {
		for i := 0; i < bucketSize; i++ {
			// we treat the hash code only as a hint, so there is no
			// need to get an atomic snapshot.
			h := atomic.LoadUint64(&b.hashes[i])
			if h == uint64(0) || h != hash {
				continue
			}
			// we found a matching hash code
			nodePtr := atomic.LoadPointer(&b.nodes[i])
			if nodePtr == nil {
				// concurrent write in this node
				continue
			}
			n := m.nodeManager.FromPointer(nodePtr)
			if key != n.Key() {
				continue
			}

			return n, true
		}
		bucketPtr := atomic.LoadPointer(&b.next)
		if bucketPtr == nil {
			return nil, false
		}
		b = (*paddedBucket)(bucketPtr)
	}
}

// Set sets the node.Node for the key.
//
// Returns the evicted node or nil if the node was inserted.
func (m *Map[K, V]) Set(n node.Node[K, V]) node.Node[K, V] {
	return m.set(n, false)
}

// SetIfAbsent sets the node.Node if the specified key is not already associated with a value (or is mapped to null)
// associates it with the given value and returns null, else returns the current node.
func (m *Map[K, V]) SetIfAbsent(n node.Node[K, V]) node.Node[K, V] {
	return m.set(n, true)
}

func (m *Map[K, V]) set(n node.Node[K, V], onlyIfAbsent bool) node.Node[K, V] {
	for {
	RETRY:
		var (
			emptyBucket *paddedBucket
			emptyIdx    int
		)
		t := (*table[K])(atomic.LoadPointer(&m.table))
		tableLen := len(t.buckets)
		hash := t.calcShiftHash(n.Key())
		bucketIdx := hash & t.mask
		rootBucket := &t.buckets[bucketIdx]
		rootBucket.mutex.Lock()
		// the following two checks must go in reverse to what's
		// in the resize method.
		if m.resizeInProgress() {
			// resize is in progress. wait, then go for another attempt.
			rootBucket.mutex.Unlock()
			m.waitForResize()
			goto RETRY
		}
		if m.newerTableExists(t) {
			// someone resized the table, go for another attempt.
			rootBucket.mutex.Unlock()
			goto RETRY
		}
		b := rootBucket
		for {
			for i := 0; i < bucketSize; i++ {
				h := b.hashes[i]
				if h == uint64(0) {
					if emptyBucket == nil {
						emptyBucket = b
						emptyIdx = i
					}
					continue
				}
				if h != hash {
					continue
				}
				prev := m.nodeManager.FromPointer(b.nodes[i])
				if n.Key() != prev.Key() {
					continue
				}
				if onlyIfAbsent {
					// found node, drop set
					rootBucket.mutex.Unlock()
					return n
				}
				// in-place update.
				// We get a copy of the value via an interface{} on each call,
				// thus the live value pointers are unique. Otherwise atomic
				// snapshot won't be correct in case of multiple Store calls
				// using the same value.
				atomic.StorePointer(&b.nodes[i], n.AsPointer())
				rootBucket.mutex.Unlock()
				return prev
			}
			if b.next == nil {
				if emptyBucket != nil {
					// insertion into an existing bucket.
					// first we update the hash, then the entry.
					atomic.StoreUint64(&emptyBucket.hashes[emptyIdx], hash)
					atomic.StorePointer(&emptyBucket.nodes[emptyIdx], n.AsPointer())
					rootBucket.mutex.Unlock()
					t.addSize(bucketIdx, 1)
					return nil
				}
				growThreshold := float64(tableLen) * bucketSize * loadFactor
				if t.sumSize() > int64(growThreshold) {
					// need to grow the table then go for another attempt.
					rootBucket.mutex.Unlock()
					m.resize(t, growHint)
					goto RETRY
				}
				// insertion into a new bucket.
				// create and append the bucket.
				newBucket := &paddedBucket{}
				newBucket.hashes[0] = hash
				newBucket.nodes[0] = n.AsPointer()
				atomic.StorePointer(&b.next, unsafe.Pointer(newBucket))
				rootBucket.mutex.Unlock()
				t.addSize(bucketIdx, 1)
				return nil
			}
			b = (*paddedBucket)(b.next)
		}
	}
}

// Delete deletes the value for a key.
//
// Returns the deleted node or nil if the node wasn't deleted.
func (m *Map[K, V]) Delete(key K) node.Node[K, V] {
	return m.delete(key, func(n node.Node[K, V]) bool {
		return key == n.Key()
	})
}

// DeleteNode evicts the node for a key.
//
// Returns the evicted node or nil if the node wasn't evicted.
func (m *Map[K, V]) DeleteNode(n node.Node[K, V]) node.Node[K, V] {
	return m.delete(n.Key(), func(current node.Node[K, V]) bool {
		return node.Equals(n, current)
	})
}

func (m *Map[K, V]) delete(key K, cmp func(node.Node[K, V]) bool) node.Node[K, V] {
	for {
	RETRY:
		hintNonEmpty := 0
		t := (*table[K])(atomic.LoadPointer(&m.table))
		hash := t.calcShiftHash(key)
		bucketIdx := hash & t.mask
		rootBucket := &t.buckets[bucketIdx]
		rootBucket.mutex.Lock()
		// the following two checks must go in reverse to what's
		// in the resize method.
		if m.resizeInProgress() {
			// resize is in progress. Wait, then go for another attempt.
			rootBucket.mutex.Unlock()
			m.waitForResize()
			goto RETRY
		}
		if m.newerTableExists(t) {
			// someone resized the table. Go for another attempt.
			rootBucket.mutex.Unlock()
			goto RETRY
		}
		b := rootBucket
		for {
			for i := 0; i < bucketSize; i++ {
				h := b.hashes[i]
				if h == uint64(0) {
					continue
				}
				if h != hash {
					hintNonEmpty++
					continue
				}
				current := m.nodeManager.FromPointer(b.nodes[i])
				if !cmp(current) {
					hintNonEmpty++
					continue
				}
				// Deletion.
				// First we update the hash, then the node.
				atomic.StoreUint64(&b.hashes[i], uint64(0))
				atomic.StorePointer(&b.nodes[i], nil)
				leftEmpty := false
				if hintNonEmpty == 0 {
					leftEmpty = b.isEmpty()
				}
				rootBucket.mutex.Unlock()
				t.addSize(bucketIdx, -1)
				// Might need to shrink the table.
				if leftEmpty {
					m.resize(t, shrinkHint)
				}
				return current
			}
			if b.next == nil {
				// not found
				rootBucket.mutex.Unlock()
				return nil
			}
			b = (*paddedBucket)(b.next)
		}
	}
}

func (m *Map[K, V]) resize(known *table[K], hint resizeHint) {
	knownTableLen := len(known.buckets)
	// fast path for shrink attempts.
	if hint == shrinkHint {
		shrinkThreshold := int64((knownTableLen * bucketSize) / shrinkFraction)
		if knownTableLen == minBucketCount || known.sumSize() > shrinkThreshold {
			return
		}
	}
	// slow path.
	if !m.resizing.CompareAndSwap(0, 1) {
		// someone else started resize. Wait for it to finish.
		m.waitForResize()
		return
	}
	var nt *table[K]
	t := (*table[K])(atomic.LoadPointer(&m.table))
	tableLen := len(t.buckets)
	switch hint {
	case growHint:
		// grow the table with factor of 2.
		nt = newTable(tableLen<<1, t.hasher)
	case shrinkHint:
		shrinkThreshold := int64((tableLen * bucketSize) / shrinkFraction)
		if tableLen > minBucketCount && t.sumSize() <= shrinkThreshold {
			// shrink the table with factor of 2.
			nt = newTable(tableLen>>1, t.hasher)
		} else {
			// no need to shrink, wake up all waiters and give up.
			m.resizeMutex.Lock()
			m.resizing.Store(0)
			m.resizeCond.Broadcast()
			m.resizeMutex.Unlock()
			return
		}
	case clearHint:
		nt = newTable(minBucketCount, t.hasher)
	default:
		panic(fmt.Sprintf("unexpected resize hint: %d", hint))
	}
	// copy the data only if we're not clearing the hashtable.
	if hint != clearHint {
		for i := 0; i < tableLen; i++ {
			copied := m.copyBuckets(&t.buckets[i], nt)
			//nolint:gosec // there will never be an overflow
			nt.addSizePlain(uint64(i), copied)
		}
	}
	// publish the new table and wake up all waiters.
	atomic.StorePointer(&m.table, unsafe.Pointer(nt))
	m.resizeMutex.Lock()
	m.resizing.Store(0)
	m.resizeCond.Broadcast()
	m.resizeMutex.Unlock()
}

func (m *Map[K, V]) copyBuckets(b *paddedBucket, dest *table[K]) (copied int) {
	rootBucket := b
	rootBucket.mutex.Lock()
	for {
		for i := 0; i < bucketSize; i++ {
			if b.nodes[i] == nil {
				continue
			}
			n := m.nodeManager.FromPointer(b.nodes[i])
			hash := dest.calcShiftHash(n.Key())
			bucketIdx := hash & dest.mask
			dest.buckets[bucketIdx].add(hash, b.nodes[i])
			copied++
		}
		if b.next == nil {
			rootBucket.mutex.Unlock()
			return copied
		}
		b = (*paddedBucket)(b.next)
	}
}

func (m *Map[K, V]) newerTableExists(table *table[K]) bool {
	currentTable := atomic.LoadPointer(&m.table)
	return uintptr(currentTable) != uintptr(unsafe.Pointer(table))
}

func (m *Map[K, V]) resizeInProgress() bool {
	return m.resizing.Load() == 1
}

func (m *Map[K, V]) waitForResize() {
	m.resizeMutex.Lock()
	for m.resizeInProgress() {
		m.resizeCond.Wait()
	}
	m.resizeMutex.Unlock()
}

// Range calls f sequentially for each node present in the
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
// reflected in the subsequently iterated nodes.
func (m *Map[K, V]) Range(f func(node.Node[K, V]) bool) {
	var zeroPtr unsafe.Pointer
	// Pre-allocate array big enough to fit nodes for most hash tables.
	buffer := make([]unsafe.Pointer, 0, 16*bucketSize)
	tp := atomic.LoadPointer(&m.table)
	t := *(*table[K])(tp)
	for i := range t.buckets {
		rootBucket := &t.buckets[i]
		b := rootBucket
		// Prevent concurrent modifications and copy all nodes into
		// the intermediate slice.
		rootBucket.mutex.Lock()
		for {
			for i := 0; i < bucketSize; i++ {
				if b.nodes[i] != nil {
					buffer = append(buffer, b.nodes[i])
				}
			}
			if b.next == nil {
				rootBucket.mutex.Unlock()
				break
			}
			b = (*paddedBucket)(b.next)
		}
		// Call the function for all copied nodes.
		for j := range buffer {
			n := m.nodeManager.FromPointer(buffer[j])
			if !f(n) {
				return
			}
			// Remove the reference to allow the copied nodes to be GCed before this method finishes.
			buffer[j] = zeroPtr
		}
		buffer = buffer[:0]
	}
}

// Clear deletes all keys and values currently stored in the map.
func (m *Map[K, V]) Clear() {
	table := (*table[K])(atomic.LoadPointer(&m.table))
	m.resize(table, clearHint)
}

// Size returns current size of the map.
func (m *Map[K, V]) Size() int {
	table := (*table[K])(atomic.LoadPointer(&m.table))
	return int(table.sumSize())
}
