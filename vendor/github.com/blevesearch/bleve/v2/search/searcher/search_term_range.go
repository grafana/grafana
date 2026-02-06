//  Copyright (c) 2017 Couchbase, Inc.
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

	"github.com/blevesearch/bleve/v2/search"
	index "github.com/blevesearch/bleve_index_api"
)

func NewTermRangeSearcher(ctx context.Context, indexReader index.IndexReader,
	min, max []byte, inclusiveMin, inclusiveMax *bool, field string,
	boost float64, options search.SearcherOptions) (search.Searcher, error) {

	if inclusiveMin == nil {
		defaultInclusiveMin := true
		inclusiveMin = &defaultInclusiveMin
	}
	if inclusiveMax == nil {
		defaultInclusiveMax := false
		inclusiveMax = &defaultInclusiveMax
	}

	if min == nil {
		min = []byte{}
	}

	rangeMax := max
	if rangeMax != nil {
		// the term dictionary range end has an unfortunate implementation
		rangeMax = append(rangeMax, 0)
	}

	// find the terms with this prefix
	fieldDict, err := indexReader.FieldDictRange(field, min, rangeMax)
	if err != nil {
		return nil, err
	}

	defer func() {
		if cerr := fieldDict.Close(); cerr != nil && err == nil {
			err = cerr
		}
	}()

	var terms []string
	tfd, err := fieldDict.Next()
	for err == nil && tfd != nil {
		terms = append(terms, tfd.Term)
		tfd, err = fieldDict.Next()
	}
	if err != nil {
		return nil, err
	}

	if len(terms) < 1 {
		return NewMatchNoneSearcher(indexReader)
	}

	if !*inclusiveMin && min != nil && string(min) == terms[0] {
		terms = terms[1:]
		// check again, as we might have removed only entry
		if len(terms) < 1 {
			return NewMatchNoneSearcher(indexReader)
		}
	}

	// if our term list included the max, it would be the last item
	if !*inclusiveMax && max != nil && string(max) == terms[len(terms)-1] {
		terms = terms[:len(terms)-1]
	}

	if ctx != nil {
		reportIOStats(ctx, fieldDict.BytesRead())
		search.RecordSearchCost(ctx, search.AddM, fieldDict.BytesRead())
	}

	return NewMultiTermSearcher(ctx, indexReader, terms, field, boost, options, true)
}
