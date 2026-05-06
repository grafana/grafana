package containers

import "sync"

// mmap is a struct that protects a standard library map with a mutex. All functions of mmap are
// thead-safe map operations.
//
// Mmap exists as an alternative to sync.Map as a datastructure that does not necessarily require
// an allocation for each of its elements. Sync.Map always requires an allocation for each element
// inserted into it.
type AtomicMap[K comparable, V any] struct {
	mu sync.Mutex
	m  map[K]V
}

// LoadOrStore is a function that atomically checks for the existence of a givne key within the map
// and adds the given value if the key was not found. The existing value is returned in the case
// that the key was found in the map, or the new value is returned in the case that the key was not
// found within the map. The returned boolean is true when the given key was found within the map.
func (m *AtomicMap[K, V]) LoadOrStore(key K, value V) (V, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.m == nil {
		m.m = make(map[K]V)
	}

	v, ok := m.m[key]
	if !ok {
		m.m[key] = value
		return value, ok
	}
	return v, ok
}

// Clear is a function that removes all elements from the map.
func (m *AtomicMap[K, V]) Clear() {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.m = nil
}
