//  Copyright (c) 2024 Couchbase, Inc.
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

package collector

import (
	"context"
	"fmt"
	"time"

	"github.com/blevesearch/bleve/v2/search"
	index "github.com/blevesearch/bleve_index_api"
)

type EligibleCollector struct {
	size             int
	total            uint64
	took             time.Duration
	eligibleSelector index.EligibleDocumentSelector
}

func NewEligibleCollector(size int) *EligibleCollector {
	return newEligibleCollector(size)
}

func newEligibleCollector(size int) *EligibleCollector {
	// No sort order & skip always 0 since this is only to filter eligible docs.
	ec := &EligibleCollector{
		size: size,
	}
	return ec
}

func makeEligibleDocumentMatchHandler(ctx *search.SearchContext, reader index.IndexReader) (search.DocumentMatchHandler, error) {
	if ec, ok := ctx.Collector.(*EligibleCollector); ok {
		if vr, ok := reader.(index.VectorIndexReader); ok {
			// create a new eligible document selector to add eligible document matches
			ec.eligibleSelector = vr.NewEligibleDocumentSelector()
			// return a document match handler that adds eligible document matches
			// to the eligible document selector
			return func(d *search.DocumentMatch) error {
				if d == nil {
					return nil
				}
				err := ec.eligibleSelector.AddEligibleDocumentMatch(d.IndexInternalID)
				if err != nil {
					return err
				}
				// recycle the DocumentMatch
				ctx.DocumentMatchPool.Put(d)
				return nil
			}, nil
		}
		return nil, fmt.Errorf("reader is not a VectorIndexReader")
	}

	return nil, fmt.Errorf("eligiblity collector not available")
}

func (ec *EligibleCollector) Collect(ctx context.Context, searcher search.Searcher, reader index.IndexReader) error {
	startTime := time.Now()
	var err error
	var next *search.DocumentMatch

	backingSize := ec.size
	if backingSize > PreAllocSizeSkipCap {
		backingSize = PreAllocSizeSkipCap + 1
	}
	searchContext := &search.SearchContext{
		DocumentMatchPool: search.NewDocumentMatchPool(backingSize+searcher.DocumentMatchPoolSize(), 0),
		Collector:         ec,
		IndexReader:       reader,
	}

	dmHandler, err := makeEligibleDocumentMatchHandler(searchContext, reader)
	if err != nil {
		return err
	}
	select {
	case <-ctx.Done():
		search.RecordSearchCost(ctx, search.AbortM, 0)
		return ctx.Err()
	default:
		next, err = searcher.Next(searchContext)
	}
	for err == nil && next != nil {
		if ec.total%CheckDoneEvery == 0 {
			select {
			case <-ctx.Done():
				search.RecordSearchCost(ctx, search.AbortM, 0)
				return ctx.Err()
			default:
			}
		}
		ec.total++

		err = dmHandler(next)
		if err != nil {
			break
		}

		next, err = searcher.Next(searchContext)
	}
	if err != nil {
		return err
	}

	// help finalize/flush the results in case
	// of custom document match handlers.
	err = dmHandler(nil)
	if err != nil {
		return err
	}

	// compute search duration
	ec.took = time.Since(startTime)

	return nil
}

// The eligible collector does not return any document matches and hence
// this method is a dummy method returning nil, to conform to the
// search.Collector interface.
func (ec *EligibleCollector) Results() search.DocumentMatchCollection {
	return nil
}

// EligibleSelector returns the eligible document selector, which can be used
// to retrieve the list of eligible documents from this collector.
// If the collector has no results, it returns nil.
func (ec *EligibleCollector) EligibleSelector() index.EligibleDocumentSelector {
	if ec.total == 0 {
		return nil
	}
	return ec.eligibleSelector
}

func (ec *EligibleCollector) Total() uint64 {
	return ec.total
}

// No concept of scoring in the eligible collector.
func (ec *EligibleCollector) MaxScore() float64 {
	return 0
}

func (ec *EligibleCollector) Took() time.Duration {
	return ec.took
}

func (ec *EligibleCollector) SetFacetsBuilder(facetsBuilder *search.FacetsBuilder) {
	// facet unsupported for pre-filtering in KNN search
}

func (ec *EligibleCollector) FacetResults() search.FacetResults {
	// facet unsupported for pre-filtering in KNN search
	return nil
}
