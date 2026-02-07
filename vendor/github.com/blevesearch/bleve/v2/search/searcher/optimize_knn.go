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

package searcher

import (
	"context"

	"github.com/blevesearch/bleve/v2/search"
	index "github.com/blevesearch/bleve_index_api"
)

func optimizeKNN(ctx context.Context, indexReader index.IndexReader,
	qsearchers []search.Searcher) error {
	var octx index.VectorOptimizableContext
	var err error

	for _, searcher := range qsearchers {
		// Only applicable to KNN Searchers.
		o, ok := searcher.(index.VectorOptimizable)
		if !ok {
			continue
		}

		octx, err = o.VectorOptimize(ctx, octx)
		if err != nil {
			return err
		}
	}

	// No KNN searchers.
	if octx == nil {
		return nil
	}

	// Postings lists and iterators replaced in the pointer to the
	// vector reader
	return octx.Finish()
}
