// SPDX-FileCopyrightText: Copyright 2015-2025 go-swagger maintainers
// SPDX-License-Identifier: Apache-2.0

package validate

import (
	"maps"
	re "regexp"
	"sync"
	"sync/atomic"
)

// Cache for compiled regular expressions
var (
	cacheMutex = &sync.Mutex{}
	reDict     = atomic.Value{} // map[string]*re.Regexp
)

func compileRegexp(pattern string) (*re.Regexp, error) {
	if cache, ok := reDict.Load().(map[string]*re.Regexp); ok {
		if r := cache[pattern]; r != nil {
			return r, nil
		}
	}

	r, err := re.Compile(pattern)
	if err != nil {
		return nil, err
	}
	cacheRegexp(r)
	return r, nil
}

func mustCompileRegexp(pattern string) *re.Regexp {
	if cache, ok := reDict.Load().(map[string]*re.Regexp); ok {
		if r := cache[pattern]; r != nil {
			return r
		}
	}

	r := re.MustCompile(pattern)
	cacheRegexp(r)
	return r
}

func cacheRegexp(r *re.Regexp) {
	cacheMutex.Lock()
	defer cacheMutex.Unlock()

	if cache, ok := reDict.Load().(map[string]*re.Regexp); !ok || cache[r.String()] == nil {
		newCache := map[string]*re.Regexp{
			r.String(): r,
		}

		maps.Copy(newCache, cache)

		reDict.Store(newCache)
	}
}
