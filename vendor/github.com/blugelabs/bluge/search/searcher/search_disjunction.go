//  Copyright (c) 2020 Couchbase, Inc.
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

package searcher

import (
	"fmt"

	"github.com/blugelabs/bluge/search/similarity"

	segment "github.com/blugelabs/bluge_segment_api"

	"github.com/blugelabs/bluge/search"
)

// DisjunctionMaxClauseCount is a compile time setting that applications can
// adjust to non-zero value to cause the DisjunctionSearcher to return an
// error instead of exeucting searches when the size exceeds this value.
var DisjunctionMaxClauseCount = 0

// DisjunctionHeapTakeover is a compile time setting that applications can
// adjust to control when the DisjunctionSearcher will switch from a simple
// slice implementation to a heap implementation.
var DisjunctionHeapTakeover = 10

func NewDisjunctionSearcher(indexReader search.Reader,
	qsearchers []search.Searcher, min int, scorer search.CompositeScorer, options search.SearcherOptions) (
	search.Searcher, error) {
	return newDisjunctionSearcher(indexReader, qsearchers, min, scorer, options, true)
}

func optionsDisjunctionOptimizable(options search.SearcherOptions) bool {
	rv := options.Score == optionScoringNone && !options.IncludeTermVectors
	return rv
}

func newDisjunctionSearcher(indexReader search.Reader,
	qsearchers []search.Searcher, min int, scorer search.CompositeScorer, options search.SearcherOptions,
	limit bool) (search.Searcher, error) {
	// attempt the "unadorned" disjunction optimization only when we
	// do not need extra information like freq-norm's or term vectors
	// and the requested min is simple
	if len(qsearchers) > 1 && min <= 1 &&
		optionsDisjunctionOptimizable(options) {
		rv, err := optimizeCompositeSearcher("disjunction:unadorned",
			indexReader, qsearchers, options)
		if err != nil || rv != nil {
			return rv, err
		}
	}

	if len(qsearchers) > DisjunctionHeapTakeover {
		return newDisjunctionHeapSearcher(qsearchers, min, scorer, options,
			limit)
	}
	return newDisjunctionSliceSearcher(qsearchers, min, scorer, options,
		limit)
}

const optionScoringNone = "none"

func optimizeCompositeSearcher(optimizationKind string,
	indexReader search.Reader, qsearchers []search.Searcher,
	options search.SearcherOptions) (search.Searcher, error) {
	var octx segment.OptimizableContext
	for _, searcher := range qsearchers {
		o, ok := searcher.(segment.Optimizable)
		if !ok {
			return nil, nil
		}

		var err error
		octx, err = o.Optimize(optimizationKind, octx)
		if err != nil {
			return nil, err
		}

		if octx == nil {
			return nil, nil
		}
	}

	optimized, err := octx.Finish()
	if err != nil || optimized == nil {
		return nil, err
	}

	return newTermSearcherFromReader(indexReader, optimized,
		[]byte(optimizationKind), "*", 1.0, similarity.ConstantScorer(1), options)
}

func tooManyClauses(count int) bool {
	if DisjunctionMaxClauseCount != 0 && count > DisjunctionMaxClauseCount {
		return true
	}
	return false
}

func tooManyClausesErr(field string, count int) error {
	return fmt.Errorf("tooManyClauses %d over field: `%s` > maxClauseCount, which is set to %d",
		count, field, DisjunctionMaxClauseCount)
}
