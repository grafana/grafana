//  Copyright (c) 2014 Couchbase, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// 		http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package store

import "encoding/json"

// KVStore is an abstraction for working with KV stores.  Note that
// in order to be used with the bleve.registry, it must also implement
// a constructor function of the registry.KVStoreConstructor type.
type KVStore interface {

	// Writer returns a KVWriter which can be used to
	// make changes to the KVStore.  If a writer cannot
	// be obtained a non-nil error is returned.
	Writer() (KVWriter, error)

	// Reader returns a KVReader which can be used to
	// read data from the KVStore.  If a reader cannot
	// be obtained a non-nil error is returned.
	Reader() (KVReader, error)

	// Close closes the KVStore
	Close() error
}

// KVReader is an abstraction of an **ISOLATED** reader
// In this context isolated is defined to mean that
// writes/deletes made after the KVReader is opened
// are not observed.
// Because there is usually a cost associated with
// keeping isolated readers active, users should
// close them as soon as they are no longer needed.
type KVReader interface {

	// Get returns the value associated with the key
	// If the key does not exist, nil is returned.
	// The caller owns the bytes returned.
	Get(key []byte) ([]byte, error)

	// MultiGet retrieves multiple values in one call.
	MultiGet(keys [][]byte) ([][]byte, error)

	// PrefixIterator returns a KVIterator that will
	// visit all K/V pairs with the provided prefix
	PrefixIterator(prefix []byte) KVIterator

	// RangeIterator returns a KVIterator that will
	// visit all K/V pairs >= start AND < end
	RangeIterator(start, end []byte) KVIterator

	// Close closes the iterator
	Close() error
}

// KVIterator is an abstraction around key iteration
type KVIterator interface {

	// Seek will advance the iterator to the specified key
	Seek(key []byte)

	// Next will advance the iterator to the next key
	Next()

	// Key returns the key pointed to by the iterator
	// The bytes returned are **ONLY** valid until the next call to Seek/Next/Close
	// Continued use after that requires that they be copied.
	Key() []byte

	// Value returns the value pointed to by the iterator
	// The bytes returned are **ONLY** valid until the next call to Seek/Next/Close
	// Continued use after that requires that they be copied.
	Value() []byte

	// Valid returns whether or not the iterator is in a valid state
	Valid() bool

	// Current returns Key(),Value(),Valid() in a single operation
	Current() ([]byte, []byte, bool)

	// Close closes the iterator
	Close() error
}

// KVWriter is an abstraction for mutating the KVStore
// KVWriter does **NOT** enforce restrictions of a single writer
// if the underlying KVStore allows concurrent writes, the
// KVWriter interface should also do so, it is up to the caller
// to do this in a way that is safe and makes sense
type KVWriter interface {

	// NewBatch returns a KVBatch for performing batch operations on this kvstore
	NewBatch() KVBatch

	// NewBatchEx returns a KVBatch and an associated byte array
	// that's pre-sized based on the KVBatchOptions.  The caller can
	// use the returned byte array for keys and values associated with
	// the batch.  Once the batch is either executed or closed, the
	// associated byte array should no longer be accessed by the
	// caller.
	NewBatchEx(KVBatchOptions) ([]byte, KVBatch, error)

	// ExecuteBatch will execute the KVBatch, the provided KVBatch **MUST** have
	// been created by the same KVStore (though not necessarily the same KVWriter)
	// Batch execution is atomic, either all the operations or none will be performed
	ExecuteBatch(batch KVBatch) error

	// Close closes the writer
	Close() error
}

// KVBatchOptions provides the KVWriter.NewBatchEx() method with batch
// preparation and preallocation information.
type KVBatchOptions struct {
	// TotalBytes is the sum of key and value bytes needed by the
	// caller for the entire batch.  It affects the size of the
	// returned byte array of KVWrite.NewBatchEx().
	TotalBytes int

	// NumSets is the number of Set() calls the caller will invoke on
	// the KVBatch.
	NumSets int

	// NumDeletes is the number of Delete() calls the caller will invoke
	// on the KVBatch.
	NumDeletes int

	// NumMerges is the number of Merge() calls the caller will invoke
	// on the KVBatch.
	NumMerges int
}

// KVBatch is an abstraction for making multiple KV mutations at once
type KVBatch interface {

	// Set updates the key with the specified value
	// both key and value []byte may be reused as soon as this call returns
	Set(key, val []byte)

	// Delete removes the specified key
	// the key []byte may be reused as soon as this call returns
	Delete(key []byte)

	// Merge merges old value with the new value at the specified key
	// as prescribed by the KVStores merge operator
	// both key and value []byte may be reused as soon as this call returns
	Merge(key, val []byte)

	// Reset frees resources for this batch and allows reuse
	Reset()

	// Close frees resources
	Close() error
}

// KVStoreStats is an optional interface that KVStores can implement
// if they're able to report any useful stats
type KVStoreStats interface {
	// Stats returns a JSON serializable object representing stats for this KVStore
	Stats() json.Marshaler

	StatsMap() map[string]interface{}
}
