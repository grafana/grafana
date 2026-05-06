//  Copyright (c) 2020 The Bluge Authors.
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

package index

import (
	"io"

	segment "github.com/blugelabs/bluge_segment_api"
)

// Kinds of items managed by a Directory
const (
	ItemKindSnapshot = ".snp"
	ItemKindSegment  = ".seg"
)

// WriterTo is like io.WriterTo only it can be canceled
// by closing the closeCh
type WriterTo interface {
	WriteTo(w io.Writer, closeCh chan struct{}) (n int64, err error)
}

// Directory abstracts over a collection of items
// An item has a kind (string) and an id (uint64)
type Directory interface {

	// Setup is called first, allowing a directory to
	// perform additional set up, or return an error
	// indicating this directory cannot be used
	Setup(readOnly bool) error

	// List the ids of all the items of the specified kind
	// Items are returned in descending order by id
	List(kind string) ([]uint64, error)

	// Load the specified item
	// Item data is accessible via the returned *segment.Data structure
	// A io.Closer is returned, which must be called to release
	// resources held by this open item.
	// NOTE: care must be taken to handle a possible nil io.Closer
	Load(kind string, id uint64) (*segment.Data, io.Closer, error)

	// Persist a new item with data from the provided WriterTo
	// Implementations should monitor the closeCh and return with error
	// in the event it is closed before completion.
	Persist(kind string, id uint64, w WriterTo, closeCh chan struct{}) error

	// Remove the specified item
	Remove(kind string, id uint64) error

	// Stats returns total number of items and their cumulative size
	Stats() (numItems uint64, numBytes uint64)

	// Sync ensures directory metadata itself has been committed
	Sync() error

	// Lock ensures this process has exclusive access to write in this directory
	Lock() error

	// Unlock releases the lock held on this directory
	Unlock() error
}
