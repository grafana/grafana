// Package cache defines the interface for a key-based data store.
//
// This package is designated as private and is intended for use only by the
// smithy client runtime. The exported API therein is not considered stable and
// is subject to breaking changes without notice.
package cache

// Cache defines the interface for an opaquely-typed, key-based data store.
//
// The thread-safety of this interface is undefined and is dictated by
// implementations.
type Cache interface {
	// Retrieve the value associated with the given key. The returned boolean
	// indicates whether the cache held a value for the given key.
	Get(k interface{}) (interface{}, bool)

	// Store a value under the given key.
	Put(k interface{}, v interface{})
}
