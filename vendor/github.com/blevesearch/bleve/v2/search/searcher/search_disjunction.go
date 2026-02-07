//  Copyright (c) 2018 Couchbase, Inc.
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
	"context"
	"fmt"

	"github.com/blevesearch/bleve/v2/search"
	index "github.com/blevesearch/bleve_index_api"
)

// DisjunctionMaxClauseCount is a compile time setting that applications can
// adjust to non-zero value to cause the DisjunctionSearcher to return an
// error instead of executing searches when the size exceeds this value.
var DisjunctionMaxClauseCount = 0

// DisjunctionHeapTakeover is a compile time setting that applications can
// adjust to control when the DisjunctionSearcher will switch from a simple
// slice implementation to a heap implementation.
var DisjunctionHeapTakeover = 10

func NewDisjunctionSearcher(ctx context.Context, indexReader index.IndexReader,
	qsearchers []search.Searcher, min float64, options search.SearcherOptions) (
	search.Searcher, error) {
	return newDisjunctionSearcher(ctx, indexReader, qsearchers, min, options, true)
}

func optionsDisjunctionOptimizable(options search.SearcherOptions) bool {
	rv := options.Score == "none" && !options.IncludeTermVectors
	return rv
}

func newDisjunctionSearcher(ctx context.Context, indexReader index.IndexReader,
	qsearchers []search.Searcher, min float64, options search.SearcherOptions,
	limit bool) (search.Searcher, error) {

	var disjOverKNN bool
	if ctx != nil {
		disjOverKNN, _ = ctx.Value(search.IncludeScoreBreakdownKey).(bool)
	}
	if disjOverKNN {
		// The KNN Searcher optimization is a necessary pre-req for the KNN Searchers,
		// not an optional optimization like for, say term searchers.
		// It's an optimization to repeat search an open vector index when applicable,
		// rather than individually opening and searching a vector index.
		err := optimizeKNN(ctx, indexReader, qsearchers)
		if err != nil {
			return nil, err
		}
	} else {
		// attempt the "unadorned" disjunction optimization only when we
		// do not need extra information like freq-norm's or term vectors
		// and the requested min is simple
		if len(qsearchers) > 1 && min <= 1 &&
			optionsDisjunctionOptimizable(options) {
			rv, err := optimizeCompositeSearcher(ctx, "disjunction:unadorned",
				indexReader, qsearchers, options)
			if err != nil || rv != nil {
				return rv, err
			}
		}
	}

	if len(qsearchers) > DisjunctionHeapTakeover {
		return newDisjunctionHeapSearcher(ctx, indexReader, qsearchers, min, options,
			limit)
	}
	return newDisjunctionSliceSearcher(ctx, indexReader, qsearchers, min, options,
		limit)
}

func optimizeCompositeSearcher(ctx context.Context, optimizationKind string,
	indexReader index.IndexReader, qsearchers []search.Searcher,
	options search.SearcherOptions) (search.Searcher, error) {
	var octx index.OptimizableContext

	for _, searcher := range qsearchers {
		o, ok := searcher.(index.Optimizable)
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

	tfr, ok := optimized.(index.TermFieldReader)
	if !ok {
		return nil, nil
	}

	return newTermSearcherFromReader(ctx, indexReader, tfr,
		[]byte(optimizationKind), "*", 1.0, options)
}

func tooManyClauses(count int) bool {
	if DisjunctionMaxClauseCount != 0 && count > DisjunctionMaxClauseCount {
		return true
	}
	return false
}

func tooManyClausesErr(field string, count int) error {
	return fmt.Errorf("TooManyClauses over field: `%s` [%d > maxClauseCount,"+
		" which is set to %d]", field, count, DisjunctionMaxClauseCount)
}
