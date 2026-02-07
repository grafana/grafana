// Copyright (c) 2023 Alexey Mayshev. All rights reserved.
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

package core

import (
	"sync"
	"time"

	"github.com/maypok86/otter/internal/expiry"
	"github.com/maypok86/otter/internal/generated/node"
	"github.com/maypok86/otter/internal/hashtable"
	"github.com/maypok86/otter/internal/lossy"
	"github.com/maypok86/otter/internal/queue"
	"github.com/maypok86/otter/internal/s3fifo"
	"github.com/maypok86/otter/internal/stats"
	"github.com/maypok86/otter/internal/unixtime"
	"github.com/maypok86/otter/internal/xmath"
	"github.com/maypok86/otter/internal/xruntime"
)

// DeletionCause the cause why a cached entry was deleted.
type DeletionCause uint8

const (
	// Explicit the entry was manually deleted by the user.
	Explicit DeletionCause = iota
	// Replaced the entry itself was not actually deleted, but its value was replaced by the user.
	Replaced
	// Size the entry was evicted due to size constraints.
	Size
	// Expired the entry's expiration timestamp has passed.
	Expired
)

func (dc DeletionCause) String() string {
	switch dc {
	case Explicit:
		return "Explicit"
	case Replaced:
		return "Replaced"
	case Size:
		return "Size"
	case Expired:
		return "Expired"
	default:
		panic("unknown deletion cause")
	}
}

const (
	minWriteBufferSize uint32 = 4
)

var (
	maxWriteBufferSize   uint32
	maxStripedBufferSize int
)

func init() {
	parallelism := xruntime.Parallelism()
	roundedParallelism := int(xmath.RoundUpPowerOf2(parallelism))
	//nolint:gosec // there will never be an overflow
	maxWriteBufferSize = uint32(128 * roundedParallelism)
	maxStripedBufferSize = 4 * roundedParallelism
}

func zeroValue[V any]() V {
	var zero V
	return zero
}

func getTTL(ttl time.Duration) uint32 {
	//nolint:gosec // there will never be an overflow
	return uint32((ttl + time.Second - 1) / time.Second)
}

func getExpiration(ttl time.Duration) uint32 {
	return unixtime.Now() + getTTL(ttl)
}

// Config is a set of cache settings.
type Config[K comparable, V any] struct {
	Capacity         int
	InitialCapacity  *int
	StatsEnabled     bool
	TTL              *time.Duration
	WithVariableTTL  bool
	CostFunc         func(key K, value V) uint32
	WithCost         bool
	DeletionListener func(key K, value V, cause DeletionCause)
}

type expiryPolicy[K comparable, V any] interface {
	Add(n node.Node[K, V])
	Delete(n node.Node[K, V])
	DeleteExpired()
	Clear()
}

// Cache is a structure performs a best-effort bounding of a hash table using eviction algorithm
// to determine which entries to evict when the capacity is exceeded.
type Cache[K comparable, V any] struct {
	nodeManager      *node.Manager[K, V]
	hashmap          *hashtable.Map[K, V]
	policy           *s3fifo.Policy[K, V]
	expiryPolicy     expiryPolicy[K, V]
	stats            *stats.Stats
	stripedBuffer    []*lossy.Buffer[K, V]
	writeBuffer      *queue.Growable[task[K, V]]
	evictionMutex    sync.Mutex
	closeOnce        sync.Once
	doneClear        chan struct{}
	costFunc         func(key K, value V) uint32
	deletionListener func(key K, value V, cause DeletionCause)
	capacity         int
	mask             uint32
	ttl              uint32
	withExpiration   bool
	isClosed         bool
}

// NewCache returns a new cache instance based on the settings from Config.
func NewCache[K comparable, V any](c Config[K, V]) *Cache[K, V] {
	nodeManager := node.NewManager[K, V](node.Config{
		WithExpiration: c.TTL != nil || c.WithVariableTTL,
		WithCost:       c.WithCost,
	})

	stripedBuffer := make([]*lossy.Buffer[K, V], 0, maxStripedBufferSize)
	for i := 0; i < maxStripedBufferSize; i++ {
		stripedBuffer = append(stripedBuffer, lossy.New[K, V](nodeManager))
	}

	var hashmap *hashtable.Map[K, V]
	if c.InitialCapacity == nil {
		hashmap = hashtable.New[K, V](nodeManager)
	} else {
		hashmap = hashtable.NewWithSize[K, V](nodeManager, *c.InitialCapacity)
	}

	cache := &Cache[K, V]{
		nodeManager:   nodeManager,
		hashmap:       hashmap,
		stripedBuffer: stripedBuffer,
		writeBuffer:   queue.NewGrowable[task[K, V]](minWriteBufferSize, maxWriteBufferSize),
		doneClear:     make(chan struct{}),
		//nolint:gosec // there will never be an overflow
		mask:             uint32(maxStripedBufferSize - 1),
		costFunc:         c.CostFunc,
		deletionListener: c.DeletionListener,
		capacity:         c.Capacity,
	}

	cache.policy = s3fifo.NewPolicy(c.Capacity, cache.evictNode)

	switch {
	case c.TTL != nil:
		cache.expiryPolicy = expiry.NewFixed[K, V](cache.deleteExpiredNode)
	case c.WithVariableTTL:
		cache.expiryPolicy = expiry.NewVariable[K, V](nodeManager, cache.deleteExpiredNode)
	default:
		cache.expiryPolicy = expiry.NewDisabled[K, V]()
	}

	if c.StatsEnabled {
		cache.stats = stats.New()
	}
	if c.TTL != nil {
		cache.ttl = getTTL(*c.TTL)
	}

	cache.withExpiration = c.TTL != nil || c.WithVariableTTL

	if cache.withExpiration {
		unixtime.Start()
		go cache.cleanup()
	}

	go cache.process()

	return cache
}

func (c *Cache[K, V]) getReadBufferIdx() int {
	return int(xruntime.Fastrand() & c.mask)
}

// Has checks if there is an item with the given key in the cache.
func (c *Cache[K, V]) Has(key K) bool {
	_, ok := c.Get(key)
	return ok
}

// Get returns the value associated with the key in this cache.
func (c *Cache[K, V]) Get(key K) (V, bool) {
	n, ok := c.GetNode(key)
	if !ok {
		return zeroValue[V](), false
	}

	return n.Value(), true
}

// GetNode returns the node associated with the key in this cache.
func (c *Cache[K, V]) GetNode(key K) (node.Node[K, V], bool) {
	n, ok := c.hashmap.Get(key)
	if !ok || !n.IsAlive() {
		c.stats.IncMisses()
		return nil, false
	}

	if n.HasExpired() {
		// avoid duplicate push
		deleted := c.hashmap.DeleteNode(n)
		if deleted != nil {
			n.Die()
			c.writeBuffer.Push(newExpiredTask(n))
		}
		c.stats.IncMisses()
		return nil, false
	}

	c.afterGet(n)
	c.stats.IncHits()

	return n, true
}

// GetNodeQuietly returns the node associated with the key in this cache.
//
// Unlike GetNode, this function does not produce any side effects
// such as updating statistics or the eviction policy.
func (c *Cache[K, V]) GetNodeQuietly(key K) (node.Node[K, V], bool) {
	n, ok := c.hashmap.Get(key)
	if !ok || !n.IsAlive() || n.HasExpired() {
		return nil, false
	}

	return n, true
}

func (c *Cache[K, V]) afterGet(got node.Node[K, V]) {
	idx := c.getReadBufferIdx()
	pb := c.stripedBuffer[idx].Add(got)
	if pb != nil {
		c.evictionMutex.Lock()
		c.policy.Read(pb.Returned)
		c.evictionMutex.Unlock()

		c.stripedBuffer[idx].Free()
	}
}

// Set associates the value with the key in this cache.
//
// If it returns false, then the key-value item had too much cost and the Set was dropped.
func (c *Cache[K, V]) Set(key K, value V) bool {
	return c.set(key, value, c.defaultExpiration(), false)
}

func (c *Cache[K, V]) defaultExpiration() uint32 {
	if c.ttl == 0 {
		return 0
	}

	return unixtime.Now() + c.ttl
}

// SetWithTTL associates the value with the key in this cache and sets the custom ttl for this key-value item.
//
// If it returns false, then the key-value item had too much cost and the SetWithTTL was dropped.
func (c *Cache[K, V]) SetWithTTL(key K, value V, ttl time.Duration) bool {
	return c.set(key, value, getExpiration(ttl), false)
}

// SetIfAbsent if the specified key is not already associated with a value associates it with the given value.
//
// If the specified key is not already associated with a value, then it returns false.
//
// Also, it returns false if the key-value item had too much cost and the SetIfAbsent was dropped.
func (c *Cache[K, V]) SetIfAbsent(key K, value V) bool {
	return c.set(key, value, c.defaultExpiration(), true)
}

// SetIfAbsentWithTTL if the specified key is not already associated with a value associates it with the given value
// and sets the custom ttl for this key-value item.
//
// If the specified key is not already associated with a value, then it returns false.
//
// Also, it returns false if the key-value item had too much cost and the SetIfAbsent was dropped.
func (c *Cache[K, V]) SetIfAbsentWithTTL(key K, value V, ttl time.Duration) bool {
	return c.set(key, value, getExpiration(ttl), true)
}

func (c *Cache[K, V]) set(key K, value V, expiration uint32, onlyIfAbsent bool) bool {
	cost := c.costFunc(key, value)
	if int(cost) > c.policy.MaxAvailableCost() {
		c.stats.IncRejectedSets()
		return false
	}

	n := c.nodeManager.Create(key, value, expiration, cost)
	if onlyIfAbsent {
		res := c.hashmap.SetIfAbsent(n)
		if res == nil {
			// insert
			c.writeBuffer.Push(newAddTask(n))
			return true
		}
		c.stats.IncRejectedSets()
		return false
	}

	evicted := c.hashmap.Set(n)
	if evicted != nil {
		// update
		evicted.Die()
		c.writeBuffer.Push(newUpdateTask(n, evicted))
	} else {
		// insert
		c.writeBuffer.Push(newAddTask(n))
	}

	return true
}

// Delete deletes the association for this key from the cache.
func (c *Cache[K, V]) Delete(key K) {
	c.afterDelete(c.hashmap.Delete(key))
}

func (c *Cache[K, V]) deleteNode(n node.Node[K, V]) {
	c.afterDelete(c.hashmap.DeleteNode(n))
}

func (c *Cache[K, V]) afterDelete(deleted node.Node[K, V]) {
	if deleted != nil {
		deleted.Die()
		c.writeBuffer.Push(newDeleteTask(deleted))
	}
}

// DeleteByFunc deletes the association for this key from the cache when the given function returns true.
func (c *Cache[K, V]) DeleteByFunc(f func(key K, value V) bool) {
	c.hashmap.Range(func(n node.Node[K, V]) bool {
		if !n.IsAlive() || n.HasExpired() {
			return true
		}

		if f(n.Key(), n.Value()) {
			c.deleteNode(n)
		}

		return true
	})
}

func (c *Cache[K, V]) notifyDeletion(key K, value V, cause DeletionCause) {
	if c.deletionListener == nil {
		return
	}

	c.deletionListener(key, value, cause)
}

func (c *Cache[K, V]) deleteExpiredNode(n node.Node[K, V]) {
	c.policy.Delete(n)
	deleted := c.hashmap.DeleteNode(n)
	if deleted != nil {
		n.Die()
		c.notifyDeletion(n.Key(), n.Value(), Expired)
		c.stats.IncEvictedCount()
		c.stats.AddEvictedCost(n.Cost())
	}
}

func (c *Cache[K, V]) cleanup() {
	for {
		time.Sleep(time.Second)

		c.evictionMutex.Lock()
		if c.isClosed {
			c.evictionMutex.Unlock()
			return
		}

		c.expiryPolicy.DeleteExpired()

		c.evictionMutex.Unlock()
	}
}

func (c *Cache[K, V]) evictNode(n node.Node[K, V]) {
	c.expiryPolicy.Delete(n)
	deleted := c.hashmap.DeleteNode(n)
	if deleted != nil {
		n.Die()
		c.notifyDeletion(n.Key(), n.Value(), Size)
		c.stats.IncEvictedCount()
		c.stats.AddEvictedCost(n.Cost())
	}
}

func (c *Cache[K, V]) onWrite(t task[K, V]) {
	if t.isClear() || t.isClose() {
		c.writeBuffer.Clear()

		c.policy.Clear()
		c.expiryPolicy.Clear()
		if t.isClose() {
			c.isClosed = true
		}

		c.doneClear <- struct{}{}
		return
	}

	n := t.node()
	switch {
	case t.isAdd():
		if n.IsAlive() {
			c.expiryPolicy.Add(n)
			c.policy.Add(n)
		}
	case t.isUpdate():
		oldNode := t.oldNode()
		c.expiryPolicy.Delete(oldNode)
		c.policy.Delete(oldNode)
		if n.IsAlive() {
			c.expiryPolicy.Add(n)
			c.policy.Add(n)
		}
		c.notifyDeletion(oldNode.Key(), oldNode.Value(), Replaced)
	case t.isDelete():
		c.expiryPolicy.Delete(n)
		c.policy.Delete(n)
		c.notifyDeletion(n.Key(), n.Value(), Explicit)
	case t.isExpired():
		c.expiryPolicy.Delete(n)
		c.policy.Delete(n)
		c.notifyDeletion(n.Key(), n.Value(), Expired)
	}
}

func (c *Cache[K, V]) process() {
	for {
		t := c.writeBuffer.Pop()

		c.evictionMutex.Lock()
		c.onWrite(t)
		c.evictionMutex.Unlock()

		if t.isClose() {
			break
		}
	}
}

// Range iterates over all items in the cache.
//
// Iteration stops early when the given function returns false.
func (c *Cache[K, V]) Range(f func(key K, value V) bool) {
	c.hashmap.Range(func(n node.Node[K, V]) bool {
		if !n.IsAlive() || n.HasExpired() {
			return true
		}

		return f(n.Key(), n.Value())
	})
}

// Clear clears the hash table, all policies, buffers, etc.
//
// NOTE: this operation must be performed when no requests are made to the cache otherwise the behavior is undefined.
func (c *Cache[K, V]) Clear() {
	c.clear(newClearTask[K, V]())
}

func (c *Cache[K, V]) clear(t task[K, V]) {
	c.hashmap.Clear()
	for i := 0; i < len(c.stripedBuffer); i++ {
		c.stripedBuffer[i].Clear()
	}

	c.writeBuffer.Push(t)
	<-c.doneClear

	c.stats.Clear()
}

// Close clears the hash table, all policies, buffers, etc and stop all goroutines.
//
// NOTE: this operation must be performed when no requests are made to the cache otherwise the behavior is undefined.
func (c *Cache[K, V]) Close() {
	c.closeOnce.Do(func() {
		c.clear(newCloseTask[K, V]())
		if c.withExpiration {
			unixtime.Stop()
		}
	})
}

// Size returns the current number of items in the cache.
func (c *Cache[K, V]) Size() int {
	return c.hashmap.Size()
}

// Capacity returns the cache capacity.
func (c *Cache[K, V]) Capacity() int {
	return c.capacity
}

// Stats returns a current snapshot of this cache's cumulative statistics.
func (c *Cache[K, V]) Stats() *stats.Stats {
	return c.stats
}

// WithExpiration returns true if the cache was configured with the expiration policy enabled.
func (c *Cache[K, V]) WithExpiration() bool {
	return c.withExpiration
}
