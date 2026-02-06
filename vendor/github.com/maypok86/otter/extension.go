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
	"github.com/maypok86/otter/internal/core"
	"github.com/maypok86/otter/internal/generated/node"
	"github.com/maypok86/otter/internal/unixtime"
)

func zeroValue[V any]() V {
	var zero V
	return zero
}

// Extension is an access point for inspecting and performing low-level operations based on the cache's runtime
// characteristics. These operations are optional and dependent on how the cache was constructed
// and what abilities the implementation exposes.
type Extension[K comparable, V any] struct {
	cache *core.Cache[K, V]
}

func newExtension[K comparable, V any](cache *core.Cache[K, V]) Extension[K, V] {
	return Extension[K, V]{
		cache: cache,
	}
}

func (e Extension[K, V]) createEntry(n node.Node[K, V]) Entry[K, V] {
	var expiration int64
	if e.cache.WithExpiration() {
		expiration = unixtime.StartTime() + int64(n.Expiration())
	}

	return Entry[K, V]{
		key:        n.Key(),
		value:      n.Value(),
		expiration: expiration,
		cost:       n.Cost(),
	}
}

// GetQuietly returns the value associated with the key in this cache.
//
// Unlike Get in the cache, this function does not produce any side effects
// such as updating statistics or the eviction policy.
func (e Extension[K, V]) GetQuietly(key K) (V, bool) {
	n, ok := e.cache.GetNodeQuietly(key)
	if !ok {
		return zeroValue[V](), false
	}

	return n.Value(), true
}

// GetEntry returns the cache entry associated with the key in this cache.
func (e Extension[K, V]) GetEntry(key K) (Entry[K, V], bool) {
	n, ok := e.cache.GetNode(key)
	if !ok {
		return Entry[K, V]{}, false
	}

	return e.createEntry(n), true
}

// GetEntryQuietly returns the cache entry associated with the key in this cache.
//
// Unlike GetEntry, this function does not produce any side effects
// such as updating statistics or the eviction policy.
func (e Extension[K, V]) GetEntryQuietly(key K) (Entry[K, V], bool) {
	n, ok := e.cache.GetNodeQuietly(key)
	if !ok {
		return Entry[K, V]{}, false
	}

	return e.createEntry(n), true
}
