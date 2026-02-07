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
	"gopkg.in/src-d/go-errors.v1"
)

// IndexBatchSize is the number of rows to save at a time when creating indexes.
const IndexBatchSize = uint64(10000)

// ChecksumKey is the key in an index config to store the checksum.
const ChecksumKey = "checksum"

// IndexDriver manages the coordination between the indexes and their
// representation on disk.
type IndexDriver interface {
	// ID returns the unique name of the driver.
	ID() string
	// Create a new index. If exprs is more than one expression, it means the
	// index has multiple columns indexed. If it's just one, it means it may
	// be an expression or a column.
	Create(db, table, id string, expressions []Expression, config map[string]string) (DriverIndex, error)
	// LoadAll loads all indexes for given db and table.
	LoadAll(ctx *Context, db, table string) ([]DriverIndex, error)
	// Save the given index for all partitions.
	Save(*Context, DriverIndex, PartitionIndexKeyValueIter) error
	// Delete the given index for all partitions in the iterator.
	Delete(DriverIndex, PartitionIter) error
}

// DriverIndexableTable represents a table that supports being indexed and receiving indexes to be able to speed up its
// execution.
// Deprecated. DriverIndexableTable support is currently incomplete. The engine will pass CREATE INDEX with a custom
// driver through to |IndexKeyValues|, but will not apply DriverIndexes via |WithDriverIndexLookup|. There are
// currently no plans to revive this interface.
type DriverIndexableTable interface {
	IndexAddressableTable
	// WithDriverIndexLookup returns a version of this table with the given lookup applied.
	// This method is currently unused in the engine.
	WithDriverIndexLookup(DriverIndexLookup) Table
	// IndexKeyValues returns an iterator over partitions and ultimately the rows of the table to compute the value of an
	// index for every row in this table. Used when creating an index for access through an IndexDriver.
	IndexKeyValues(*Context, []string) (PartitionIndexKeyValueIter, error)
}

// DriverIndex is an index managed by a driver, as opposed to natively by a DB table.
// Deprecated. This interface is incompletely supported and may be removed.
type DriverIndex interface {
	Index
	// Driver ID of the index.
	Driver() string
}

// DriverIndexLookup is a subset of an index. More specific interfaces can be
// implemented to grant more capabilities to the index lookup.
// Deprecated. This interface is incompletely supported and may be removed.
type DriverIndexLookup interface {
	Lookup() IndexLookup

	// Values returns the values in the subset of the index. These are used to populate the index via the driver.
	Values(Partition) (IndexValueIter, error)

	// Indexes returns the IDs of all indexes involved in this lookup.
	Indexes() []string
}

// Checksumable provides the checksum of some data.
type Checksumable interface {
	// Checksum returns a checksum and an error if there was any problem
	// computing or obtaining the checksum.
	Checksum() (string, error)
}

// PartitionIndexKeyValueIter is an iterator of partitions that will return
// the partition and the IndexKeyValueIter of that partition.
type PartitionIndexKeyValueIter interface {
	// Next returns the next partition and the IndexKeyValueIter for that
	// partition.
	Next(*Context) (Partition, IndexKeyValueIter, error)
	Closer
}

// IndexKeyValueIter is an iterator of index key values, that is, a tuple of
// the values that will be index keys.
type IndexKeyValueIter interface {
	// Next returns the next tuple of index key values. The length of the
	// returned slice will be the same as the number of columns used to
	// create this iterator. The second returned parameter is a repo's location.
	Next(*Context) ([]interface{}, []byte, error)
	Closer
}

// IndexValueIter is an iterator of index values.
type IndexValueIter interface {
	// Next returns the next value (repo's location) - see IndexKeyValueIter.
	Next(*Context) ([]byte, error)
	Closer
}

var (
	// ErrIndexIDAlreadyRegistered is the error returned when there is already
	// an index with the same ID.
	ErrIndexIDAlreadyRegistered = errors.NewKind("an index with id %q has already been registered")

	// ErrIndexExpressionAlreadyRegistered is the error returned when there is
	// already an index with the same expression.
	ErrIndexExpressionAlreadyRegistered = errors.NewKind("there is already an index registered for the expressions: %s")

	// ErrIndexNotFound is returned when the index could not be found.
	ErrIndexNotFound = errors.NewKind("index %q was not found")

	// ErrIndexDeleteInvalidStatus is returned when the index trying to delete
	// does not have a ready or outdated state.
	ErrIndexDeleteInvalidStatus = errors.NewKind("can't delete index %q because it's not ready for removal")
)
