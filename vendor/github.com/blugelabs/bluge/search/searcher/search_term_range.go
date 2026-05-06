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
	"github.com/blugelabs/bluge/search"
)

func NewTermRangeSearcher(indexReader search.Reader,
	min, max []byte, inclusiveMin, inclusiveMax bool, field string,
	boost float64, scorer search.Scorer, compScorer search.CompositeScorer,
	options search.SearcherOptions) (search.Searcher, error) {
	if min == nil {
		min = []byte{}
	}

	if max != nil && inclusiveMax {
		max = append(max, 0)
	}

	fieldDict, err := indexReader.DictionaryIterator(field, nil, min, max)
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
		terms = append(terms, tfd.Term())
		tfd, err = fieldDict.Next()
	}
	if err != nil {
		return nil, err
	}

	if len(terms) < 1 {
		return NewMatchNoneSearcher(indexReader, options)
	}

	if !inclusiveMin && min != nil && string(min) == terms[0] {
		terms = terms[1:]
		// check again, as we might have removed only entry
		if len(terms) < 1 {
			return NewMatchNoneSearcher(indexReader, options)
		}
	}

	return NewMultiTermSearcher(indexReader, terms, field, boost, scorer, compScorer, options, true)
}
