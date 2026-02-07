// Copyright 2022 PerimeterX. All rights reserved.
// Use of this source code is governed by a MIT style
// license that can be found in the LICENSE file.

package marshmallow

import (
	"reflect"
	"sync"
)

// Cache allows unmarshalling to use a cached version of refection information about types.
// Cache interface follows the implementation of sync.Map, but you may wrap any cache implementation
// to match it. This allows you to control max cache size, eviction policies and any other caching aspect.
type Cache interface {
	// Load returns the value stored in the map for a key, or nil if no value is present.
	// The ok result indicates whether value was found in the map.
	Load(key interface{}) (interface{}, bool)
	// Store sets the value for a key.
	Store(key, value interface{})
}

// EnableCustomCache enables unmarshalling cache. It allows reuse of refection information about types needed
// to perform the unmarshalling. A use of such cache can boost up unmarshalling by x1.4.
// Check out benchmark_test.go for an example.
//
// EnableCustomCache is not thread safe! Do not use it while performing unmarshalling, or it will
// cause an unsafe race condition. Typically, EnableCustomCache should be called once when the process boots.
//
// Caching is disabled by default. The use of this function allows enabling it and controlling the
// behavior of the cache. Typically, the use of sync.Map should be good enough. The caching mechanism
// stores a single map per struct type. If you plan to unmarshal a huge amount of distinct
// struct it may get to consume a lot of resources, in which case you have the control to choose
// the caching implementation you like and its setup.
func EnableCustomCache(c Cache) {
	cache = c
}

// EnableCache enables unmarshalling cache with default implementation. More info at EnableCustomCache.
func EnableCache() {
	EnableCustomCache(&sync.Map{})
}

var cache Cache

func cacheLookup(t reflect.Type) map[string]reflectionInfo {
	if cache == nil {
		return nil
	}
	value, exists := cache.Load(t)
	if !exists {
		return nil
	}
	result, _ := value.(map[string]reflectionInfo)
	return result
}

func cacheStore(t reflect.Type, fields map[string]reflectionInfo) {
	if cache == nil {
		return
	}
	cache.Store(t, fields)
}
