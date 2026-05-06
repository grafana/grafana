// Copyright (c) 2024 Alexey Mayshev. All rights reserved.
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

package otter

import (
	"time"

	"github.com/maypok86/otter/internal/core"
)

// DeletionCause the cause why a cached entry was deleted.
type DeletionCause = core.DeletionCause

const (
	// Explicit the entry was manually deleted by the user.
	Explicit = core.Explicit
	// Replaced the entry itself was not actually deleted, but its value was replaced by the user.
	Replaced = core.Replaced
	// Size the entry was evicted due to size constraints.
	Size = core.Size
	// Expired the entry's expiration timestamp has passed.
	Expired = core.Expired
)

type baseCache[K comparable, V any] struct {
	cache *core.Cache[K, V]
}

func newBaseCache[K comparable, V any](c core.Config[K, V]) baseCache[K, V] {
	return baseCache[K, V]{
		cache: core.NewCache(c),
	}
}

// Has checks if there is an entry with the given key in the cache.
func (bs baseCache[K, V]) Has(key K) bool {
	return bs.cache.Has(key)
}

// Get returns the value associated with the key in this cache.
func (bs baseCache[K, V]) Get(key K) (V, bool) {
	return bs.cache.Get(key)
}

// Delete removes the association for this key from the cache.
func (bs baseCache[K, V]) Delete(key K) {
	bs.cache.Delete(key)
}

// DeleteByFunc removes the association for this key from the cache when the given function returns true.
func (bs baseCache[K, V]) DeleteByFunc(f func(key K, value V) bool) {
	bs.cache.DeleteByFunc(f)
}

// Range iterates over all entries in the cache.
//
// Iteration stops early when the given function returns false.
func (bs baseCache[K, V]) Range(f func(key K, value V) bool) {
	bs.cache.Range(f)
}

// Clear clears the hash table, all policies, buffers, etc.
//
// NOTE: this operation must be performed when no requests are made to the cache otherwise the behavior is undefined.
func (bs baseCache[K, V]) Clear() {
	bs.cache.Clear()
}

// Close clears the hash table, all policies, buffers, etc and stop all goroutines.
//
// NOTE: this operation must be performed when no requests are made to the cache otherwise the behavior is undefined.
func (bs baseCache[K, V]) Close() {
	bs.cache.Close()
}

// Size returns the current number of entries in the cache.
func (bs baseCache[K, V]) Size() int {
	return bs.cache.Size()
}

// Capacity returns the cache capacity.
func (bs baseCache[K, V]) Capacity() int {
	return bs.cache.Capacity()
}

// Stats returns a current snapshot of this cache's cumulative statistics.
func (bs baseCache[K, V]) Stats() Stats {
	return newStats(bs.cache.Stats())
}

// Extension returns access to inspect and perform low-level operations on this cache based on its runtime
// characteristics. These operations are optional and dependent on how the cache was constructed
// and what abilities the implementation exposes.
func (bs baseCache[K, V]) Extension() Extension[K, V] {
	return newExtension(bs.cache)
}

// Cache is a structure performs a best-effort bounding of a hash table using eviction algorithm
// to determine which entries to evict when the capacity is exceeded.
type Cache[K comparable, V any] struct {
	baseCache[K, V]
}

func newCache[K comparable, V any](c core.Config[K, V]) Cache[K, V] {
	return Cache[K, V]{
		baseCache: newBaseCache(c),
	}
}

// Set associates the value with the key in this cache.
//
// If it returns false, then the key-value pair had too much cost and the Set was dropped.
func (c Cache[K, V]) Set(key K, value V) bool {
	return c.cache.Set(key, value)
}

// SetIfAbsent if the specified key is not already associated with a value associates it with the given value.
//
// If the specified key is not already associated with a value, then it returns false.
//
// Also, it returns false if the key-value pair had too much cost and the SetIfAbsent was dropped.
func (c Cache[K, V]) SetIfAbsent(key K, value V) bool {
	return c.cache.SetIfAbsent(key, value)
}

// CacheWithVariableTTL is a structure performs a best-effort bounding of a hash table using eviction algorithm
// to determine which entries to evict when the capacity is exceeded.
type CacheWithVariableTTL[K comparable, V any] struct {
	baseCache[K, V]
}

func newCacheWithVariableTTL[K comparable, V any](c core.Config[K, V]) CacheWithVariableTTL[K, V] {
	return CacheWithVariableTTL[K, V]{
		baseCache: newBaseCache(c),
	}
}

// Set associates the value with the key in this cache and sets the custom ttl for this key-value pair.
//
// If it returns false, then the key-value pair had too much cost and the Set was dropped.
func (c CacheWithVariableTTL[K, V]) Set(key K, value V, ttl time.Duration) bool {
	return c.cache.SetWithTTL(key, value, ttl)
}

// SetIfAbsent if the specified key is not already associated with a value associates it with the given value
// and sets the custom ttl for this key-value pair.
//
// If the specified key is not already associated with a value, then it returns false.
//
// Also, it returns false if the key-value pair had too much cost and the SetIfAbsent was dropped.
func (c CacheWithVariableTTL[K, V]) SetIfAbsent(key K, value V, ttl time.Duration) bool {
	return c.cache.SetIfAbsentWithTTL(key, value, ttl)
}
