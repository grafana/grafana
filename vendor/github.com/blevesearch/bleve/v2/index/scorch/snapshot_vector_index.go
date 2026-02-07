//  Copyright (c) 2023 Couchbase, Inc.
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

//go:build vectors
// +build vectors

package scorch

import (
	"context"
	"encoding/json"
	"fmt"

	index "github.com/blevesearch/bleve_index_api"
	segment_api "github.com/blevesearch/scorch_segment_api/v2"
)

func (is *IndexSnapshot) VectorReader(ctx context.Context, vector []float32,
	field string, k int64, searchParams json.RawMessage,
	eligibleSelector index.EligibleDocumentSelector) (
	index.VectorReader, error) {
	rv := &IndexSnapshotVectorReader{
		vector:           vector,
		field:            field,
		k:                k,
		snapshot:         is,
		searchParams:     searchParams,
		eligibleSelector: eligibleSelector,
		postings:         make([]segment_api.VecPostingsList, len(is.segment)),
		iterators:        make([]segment_api.VecPostingsIterator, len(is.segment)),
	}

	// initialize postings and iterators within the OptimizeVR's Finish()
	return rv, nil
}

// eligibleDocumentSelector is used to filter out documents that are eligible for
// the KNN search from a pre-filter query.
type eligibleDocumentSelector struct {
	// segment ID -> segment local doc nums
	eligibleDocNums map[int][]uint64
	is              *IndexSnapshot
}

// SegmentEligibleDocs returns the list of eligible local doc numbers for the given segment.
func (eds *eligibleDocumentSelector) SegmentEligibleDocs(segmentID int) []uint64 {
	return eds.eligibleDocNums[segmentID]
}

// AddEligibleDocumentMatch adds a document match to the list of eligible documents.
func (eds *eligibleDocumentSelector) AddEligibleDocumentMatch(id index.IndexInternalID) error {
	if eds.is == nil {
		return fmt.Errorf("eligibleDocumentSelector is not initialized with IndexSnapshot")
	}
	// Get the segment number and the local doc number for this document.
	segIdx, docNum, err := eds.is.segmentIndexAndLocalDocNum(id)
	if err != nil {
		return err
	}
	// Add the local doc number to the list of eligible doc numbers for this segment.
	eds.eligibleDocNums[segIdx] = append(eds.eligibleDocNums[segIdx], docNum)
	return nil
}

func (is *IndexSnapshot) NewEligibleDocumentSelector() index.EligibleDocumentSelector {
	return &eligibleDocumentSelector{
		eligibleDocNums: map[int][]uint64{},
		is:              is,
	}
}
