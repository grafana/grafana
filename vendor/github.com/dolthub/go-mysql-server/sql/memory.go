// Copyright 2020-2021 Dolthub, Inc.
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

package sql

import (
	"os"
	"runtime"
	"strconv"
	"sync"

	errors "gopkg.in/src-d/go-errors.v1"
)

// Disposable objects can erase all their content when they're no longer in use.
// Expressions and Nodes that implement Disposable will have Dispose called on them as a final stage of query
// execution. This can be used to clean up cached memory that wouldn't get caught via the normal garbage collection
// process.
type Disposable interface {
	// Dispose the contents.
	Dispose()
}

func Dispose(i interface{}) {
	if d, ok := i.(Disposable); ok {
		d.Dispose()
	}
}

// Freeable objects can free their memory.
type Freeable interface {
	// Free the memory.
	Free()
}

// KeyValueCache is a cache of key value pairs.
type KeyValueCache interface {
	// Put a new value in the cache.
	Put(uint64, interface{}) error
	// Get the value with the given key. An error is returned if the specified key does not exist.
	Get(uint64) (interface{}, error)
	// Size returns the number of elements in the cache.
	Size() int
}

// RowsCache is a cache of rows.
type RowsCache interface {
	// Add a new row to the cache. If there is no memory available, it will try to
	// free some memory. If after that there is still no memory available, it
	// will return an error and erase all the content of the cache.
	Add(Row) error
	// Get returns all rows.
	Get() []Row
}

// Rows2Cache is a cache of Row2s.
type Rows2Cache interface {
	RowsCache
	// Add2 a new row to the cache. If there is no memory available, it will try to
	// free some memory. If after that there is still no memory available, it
	// will return an error and erase all the content of the cache.
	Add2(Row2) error
	// Get2 gets all rows.
	Get2() []Row2
}

// ErrNoMemoryAvailable is returned when there is no more available memory.
var ErrNoMemoryAvailable = errors.NewKind("no memory available")

const maxMemoryKey = "MAX_MEMORY"

const (
	b   = 1
	kib = 1024 * b
	mib = 1024 * kib
)

var maxMemory = func() uint64 {
	val := os.Getenv(maxMemoryKey)
	var v uint64
	if val != "" {
		var err error
		v, err = strconv.ParseUint(val, 10, 64)
		if err != nil {
			panic("MAX_MEMORY environment variable must be a number, but got: " + val)
		}
	}

	return v * uint64(mib)
}()

// Reporter is a component that gives information about the memory usage.
type Reporter interface {
	// MaxMemory returns the maximum number of memory allowed in bytes.
	MaxMemory() uint64
	// UsedMemory returns the memory in use in bytes.
	UsedMemory() uint64
}

// ProcessMemory is a reporter for the memory used by the process and the
// maximum amount of memory allowed controlled by the MAX_MEMORY environment
// variable.
var ProcessMemory Reporter = new(processReporter)

type processReporter struct{}

func (processReporter) UsedMemory() uint64 {
	var s runtime.MemStats
	runtime.ReadMemStats(&s)
	return s.HeapInuse + s.StackInuse
}

func (processReporter) MaxMemory() uint64 { return maxMemory }

// HasAvailableMemory reports whether more memory is available to the program if
// it hasn't reached the max memory limit.
func HasAvailableMemory(r Reporter) bool {
	maxMemory := r.MaxMemory()
	if maxMemory == 0 {
		return true
	}

	return r.UsedMemory() < maxMemory
}

// MemoryManager is in charge of keeping track and managing all the components that operate
// in memory. There should only be one instance of a memory manager running at the
// same time in each process.
type MemoryManager struct {
	reporter Reporter
	caches   map[uint64]Disposable
	token    uint64
	mu       sync.RWMutex
}

// NewMemoryManager creates a new manager with the given memory reporter. If nil is given,
// then the Process reporter will be used by default.
func NewMemoryManager(r Reporter) *MemoryManager {
	if r == nil {
		r = ProcessMemory
	}

	return &MemoryManager{
		reporter: r,
		caches:   make(map[uint64]Disposable),
	}
}

// HasAvailable reports whether the memory manager has any available memory.
func (m *MemoryManager) HasAvailable() bool {
	return HasAvailableMemory(m.reporter)
}

// DisposeFunc is a function to completely erase a cache and remove it from the manager.
type DisposeFunc func()

// NewLRUCache returns an empty LRU cache and a function to dispose it when it's
// no longer needed.
func (m *MemoryManager) NewLRUCache(size uint) (KeyValueCache, DisposeFunc) {
	c := newLRUCache(m, m.reporter, size)
	pos := m.addCache(c)
	return c, func() {
		c.Dispose()
		m.removeCache(pos)
	}
}

// NewHistoryCache returns an empty history cache and a function to dispose it when it's
// no longer needed.
func (m *MemoryManager) NewHistoryCache() (KeyValueCache, DisposeFunc) {
	c := newHistoryCache(m, m.reporter)
	pos := m.addCache(c)
	return c, func() {
		c.Dispose()
		m.removeCache(pos)
	}
}

// NewRowsCache returns an empty rows cache and a function to dispose it when it's
// no longer needed.
func (m *MemoryManager) NewRowsCache() (RowsCache, DisposeFunc) {
	c := newRowsCache(m, m.reporter)
	pos := m.addCache(c)
	return c, func() {
		c.Dispose()
		m.removeCache(pos)
	}
}

// NewRowsCache returns an empty rows cache and a function to dispose it when it's
// no longer needed.
func (m *MemoryManager) NewRows2Cache() (Rows2Cache, DisposeFunc) {
	c := newRowsCache(m, m.reporter)
	pos := m.addCache(c)
	return c, func() {
		c.Dispose()
		m.removeCache(pos)
	}
}

func (m *MemoryManager) addCache(c Disposable) (pos uint64) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.token++
	m.caches[m.token] = c
	return m.token
}

func (m *MemoryManager) removeCache(pos uint64) {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.caches, pos)

	if len(m.caches) == 0 {
		m.token = 0
	}
}

// Free the memory of all freeable caches.
func (m *MemoryManager) Free() {
	m.mu.RLock()
	defer m.mu.RUnlock()

	for _, c := range m.caches {
		if f, ok := c.(Freeable); ok {
			f.Free()
		}
	}
}

func (m *MemoryManager) NumCaches() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return len(m.caches)
}
