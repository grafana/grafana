//  Copyright (c) 2023 Couchbase, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//	http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

//go:build vectors
// +build vectors

package segment

import (
	"encoding/json"

	index "github.com/blevesearch/bleve_index_api"
	"github.com/RoaringBitmap/roaring/v2"
)

type VecPostingsList interface {
	DiskStatsReporter

	Iterator(prealloc VecPostingsIterator) VecPostingsIterator

	Size() int

	Count() uint64

	// NOTE deferred for future work

	// And(other PostingsList) PostingsList
	// Or(other PostingsList) PostingsList
}

type VecPostingsIterator interface {
	DiskStatsReporter

	// The caller is responsible for copying whatever it needs from
	// the returned Posting instance before calling Next(), as some
	// implementations may return a shared instance to reduce memory
	// allocations.
	Next() (VecPosting, error)

	// Advance will return the posting with the specified doc number
	// or if there is no such posting, the next posting.
	// Callers MUST NOT attempt to pass a docNum that is less than or
	// equal to the currently visited posting doc Num.
	Advance(docNum uint64) (VecPosting, error)

	Size() int
}

type VectorIndex interface {
	// @params: Search params for backing vector index (like IVF, HNSW, etc.)
	Search(qVector []float32, k int64, params json.RawMessage) (VecPostingsList, error)
	// @eligibleDocIDs: DocIDs in the segment eligible for the kNN query.
	SearchWithFilter(qVector []float32, k int64, eligibleDocIDs []uint64,
		params json.RawMessage) (VecPostingsList, error)
	Close()
	Size() uint64

	ObtainKCentroidCardinalitiesFromIVFIndex(limit int, descending bool) ([]index.CentroidCardinality, error)
}

type VectorSegment interface {
	Segment
	InterpretVectorIndex(field string, requiresFiltering bool, except *roaring.Bitmap) (
		VectorIndex, error)
}

type VecPosting interface {
	Number() uint64

	Score() float32

	Size() int
}
