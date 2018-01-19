// Copyright 2016 Google Inc. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Package atomiccache provides a map-based cache that supports very fast
// reads.
package atomiccache

import (
	"sync"
	"sync/atomic"
)

type mapType map[interface{}]interface{}

// Cache is a map-based cache that supports fast reads via use of atomics.
// Writes are slow, requiring a copy of the entire cache.
// The zero Cache is an empty cache, ready for use.
type Cache struct {
	val atomic.Value // mapType
	mu  sync.Mutex   // used only by writers
}

// Get returns the value of the cache at key. If there is no value,
// getter is called to provide one, and the cache is updated.
// The getter function may be called concurrently. It should be pure,
// returning the same value for every call.
func (c *Cache) Get(key interface{}, getter func() interface{}) interface{} {
	mp, _ := c.val.Load().(mapType)
	if v, ok := mp[key]; ok {
		return v
	}

	// Compute value without lock.
	// Might duplicate effort but won't hold other computations back.
	newV := getter()

	c.mu.Lock()
	mp, _ = c.val.Load().(mapType)
	newM := make(mapType, len(mp)+1)
	for k, v := range mp {
		newM[k] = v
	}
	newM[key] = newV
	c.val.Store(newM)
	c.mu.Unlock()
	return newV
}
