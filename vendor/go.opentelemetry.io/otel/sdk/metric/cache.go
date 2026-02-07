// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package metric // import "go.opentelemetry.io/otel/sdk/metric"

import (
	"sync"
)

// cache is a locking storage used to quickly return already computed values.
//
// The zero value of a cache is empty and ready to use.
//
// A cache must not be copied after first use.
//
// All methods of a cache are safe to call concurrently.
type cache[K comparable, V any] struct {
	sync.Mutex
	data map[K]V
}

// Lookup returns the value stored in the cache with the associated key if it
// exists. Otherwise, f is called and its returned value is set in the cache
// for key and returned.
//
// Lookup is safe to call concurrently. It will hold the cache lock, so f
// should not block excessively.
func (c *cache[K, V]) Lookup(key K, f func() V) V {
	c.Lock()
	defer c.Unlock()

	if c.data == nil {
		val := f()
		c.data = map[K]V{key: val}
		return val
	}
	if v, ok := c.data[key]; ok {
		return v
	}
	val := f()
	c.data[key] = val
	return val
}

// HasKey returns true if Lookup has previously been called with that key
//
// HasKey is safe to call concurrently.
func (c *cache[K, V]) HasKey(key K) bool {
	c.Lock()
	defer c.Unlock()
	_, ok := c.data[key]
	return ok
}

// cacheWithErr is a locking storage used to quickly return already computed values and an error.
//
// The zero value of a cacheWithErr is empty and ready to use.
//
// A cacheWithErr must not be copied after first use.
//
// All methods of a cacheWithErr are safe to call concurrently.
type cacheWithErr[K comparable, V any] struct {
	cache[K, valAndErr[V]]
}

type valAndErr[V any] struct {
	val V
	err error
}

// Lookup returns the value stored in the cacheWithErr with the associated key
// if it exists. Otherwise, f is called and its returned value is set in the
// cacheWithErr for key and returned.
//
// Lookup is safe to call concurrently. It will hold the cacheWithErr lock, so f
// should not block excessively.
func (c *cacheWithErr[K, V]) Lookup(key K, f func() (V, error)) (V, error) {
	combined := c.cache.Lookup(key, func() valAndErr[V] {
		val, err := f()
		return valAndErr[V]{val: val, err: err}
	})
	return combined.val, combined.err
}
