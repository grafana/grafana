// SPDX-FileCopyrightText: Copyright 2015-2025 go-swagger maintainers
// SPDX-License-Identifier: Apache-2.0

package spec

import (
	"maps"
	"sync"
)

// ResolutionCache a cache for resolving urls
type ResolutionCache interface {
	Get(string) (any, bool)
	Set(string, any)
}

type simpleCache struct {
	lock  sync.RWMutex
	store map[string]any
}

func (s *simpleCache) ShallowClone() ResolutionCache {
	store := make(map[string]any, len(s.store))
	s.lock.RLock()
	maps.Copy(store, s.store)
	s.lock.RUnlock()

	return &simpleCache{
		store: store,
	}
}

// Get retrieves a cached URI
func (s *simpleCache) Get(uri string) (any, bool) {
	s.lock.RLock()
	v, ok := s.store[uri]

	s.lock.RUnlock()
	return v, ok
}

// Set caches a URI
func (s *simpleCache) Set(uri string, data any) {
	s.lock.Lock()
	s.store[uri] = data
	s.lock.Unlock()
}

var (
	// resCache is a package level cache for $ref resolution and expansion.
	// It is initialized lazily by methods that have the need for it: no
	// memory is allocated unless some expander methods are called.
	//
	// It is initialized with JSON schema and swagger schema,
	// which do not mutate during normal operations.
	//
	// All subsequent utilizations of this cache are produced from a shallow
	// clone of this initial version.
	resCache  *simpleCache
	onceCache sync.Once

	_ ResolutionCache = &simpleCache{}
)

// initResolutionCache initializes the URI resolution cache. To be wrapped in a sync.Once.Do call.
func initResolutionCache() {
	resCache = defaultResolutionCache()
}

func defaultResolutionCache() *simpleCache {
	return &simpleCache{store: map[string]any{
		"http://swagger.io/v2/schema.json":       MustLoadSwagger20Schema(),
		"http://json-schema.org/draft-04/schema": MustLoadJSONSchemaDraft04(),
	}}
}

func cacheOrDefault(cache ResolutionCache) ResolutionCache {
	onceCache.Do(initResolutionCache)

	if cache != nil {
		return cache
	}

	// get a shallow clone of the base cache with swagger and json schema
	return resCache.ShallowClone()
}
