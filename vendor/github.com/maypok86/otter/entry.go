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

import "time"

// Entry is a key-value pair that may include policy metadata for the cached entry.
//
// It is an immutable snapshot of the cached data at the time of this entry's creation, and it will not
// reflect changes afterward.
type Entry[K comparable, V any] struct {
	key        K
	value      V
	expiration int64
	cost       uint32
}

// Key returns the entry's key.
func (e Entry[K, V]) Key() K {
	return e.key
}

// Value returns the entry's value.
func (e Entry[K, V]) Value() V {
	return e.value
}

// Expiration returns the entry's expiration time as a unix time,
// the number of seconds elapsed since January 1, 1970 UTC.
//
// If the cache was not configured with an expiration policy then this value is always 0.
func (e Entry[K, V]) Expiration() int64 {
	return e.expiration
}

// TTL returns the entry's ttl.
//
// If the cache was not configured with an expiration policy then this value is always -1.
//
// If the entry is expired then this value is always 0.
func (e Entry[K, V]) TTL() time.Duration {
	expiration := e.Expiration()
	if expiration == 0 {
		return -1
	}

	now := time.Now().Unix()
	if expiration <= now {
		return 0
	}

	return time.Duration(expiration-now) * time.Second
}

// HasExpired returns true if the entry has expired.
func (e Entry[K, V]) HasExpired() bool {
	expiration := e.Expiration()
	if expiration == 0 {
		return false
	}

	return expiration <= time.Now().Unix()
}

// Cost returns the entry's cost.
//
// If the cache was not configured with a cost then this value is always 1.
func (e Entry[K, V]) Cost() uint32 {
	return e.cost
}
