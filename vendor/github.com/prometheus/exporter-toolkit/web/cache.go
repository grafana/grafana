// Copyright 2021 The Prometheus Authors
// This code is partly borrowed from Caddy:
//    Copyright 2015 Matthew Holt and The Caddy Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package web

import (
	weakrand "math/rand"
	"sync"
)

var cacheSize = 100

type cache struct {
	cache map[string]bool
	mtx   sync.Mutex
}

// newCache returns a cache that contains a mapping of plaintext passwords
// to their hashes (with random eviction). This can greatly improve the
// performance of traffic-heavy servers that use secure password hashing
// algorithms, with the downside that plaintext passwords will be stored in
// memory for a longer time (this should not be a problem as long as your
// machine is not compromised, at which point all bets are off, since basicauth
// necessitates plaintext passwords being received over the wire anyway).
func newCache() *cache {
	return &cache{
		cache: make(map[string]bool),
	}
}

func (c *cache) get(key string) (bool, bool) {
	c.mtx.Lock()
	defer c.mtx.Unlock()
	v, ok := c.cache[key]
	return v, ok
}

func (c *cache) set(key string, value bool) {
	c.mtx.Lock()
	defer c.mtx.Unlock()
	c.makeRoom()
	c.cache[key] = value
}

func (c *cache) makeRoom() {
	if len(c.cache) < cacheSize {
		return
	}
	// We delete more than just 1 entry so that we don't have
	// to do this on every request; assuming the capacity of
	// the cache is on a long tail, we can save a lot of CPU
	// time by doing a whole bunch of deletions now and then
	// we won't have to do them again for a while.
	numToDelete := len(c.cache) / 10
	if numToDelete < 1 {
		numToDelete = 1
	}
	for deleted := 0; deleted <= numToDelete; deleted++ {
		// Go maps are "nondeterministic" not actually random,
		// so although we could just chop off the "front" of the
		// map with less code, this is a heavily skewed eviction
		// strategy; generating random numbers is cheap and
		// ensures a much better distribution.
		rnd := weakrand.Intn(len(c.cache))
		i := 0
		for key := range c.cache {
			if i == rnd {
				delete(c.cache, key)
				break
			}
			i++
		}
	}
}
