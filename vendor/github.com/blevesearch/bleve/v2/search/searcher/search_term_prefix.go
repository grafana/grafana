//  Copyright (c) 2014 Couchbase, Inc.
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
	"strings"

	"github.com/blevesearch/bleve/v2/search"
	index "github.com/blevesearch/bleve_index_api"
)

func NewTermPrefixSearcher(ctx context.Context, indexReader index.IndexReader, prefix string,
	field string, boost float64, options search.SearcherOptions) (
	search.Searcher, error) {
	// find the terms with this prefix
	fieldDict, err := indexReader.FieldDictPrefix(field, []byte(prefix))
	if err != nil {
		return nil, err
	}
	defer func() {
		if cerr := fieldDict.Close(); cerr != nil && err == nil {
			err = cerr
		}
	}()

	var terms []string
	var termSet = make(map[string]struct{})
	tfd, err := fieldDict.Next()
	for err == nil && tfd != nil {
		if _, exists := termSet[tfd.Term]; !exists {
			termSet[tfd.Term] = struct{}{}
			terms = append(terms, tfd.Term)
			if tooManyClauses(len(terms)) {
				return nil, tooManyClausesErr(field, len(terms))
			}
			tfd, err = fieldDict.Next()
		}
	}
	if err != nil {
		return nil, err
	}

	if ctx != nil {
		reportIOStats(ctx, fieldDict.BytesRead())
		search.RecordSearchCost(ctx, search.AddM, fieldDict.BytesRead())
	}

	if ctx != nil {
		if fts, ok := ctx.Value(search.FieldTermSynonymMapKey).(search.FieldTermSynonymMap); ok {
			if ts, exists := fts[field]; exists {
				for term := range ts {
					if _, exists := termSet[term]; exists {
						continue
					}
					if strings.HasPrefix(term, prefix) {
						termSet[term] = struct{}{}
						terms = append(terms, term)
						if tooManyClauses(len(terms)) {
							return nil, tooManyClausesErr(field, len(terms))
						}
					}
				}
			}
		}
	}

	// check if the terms are empty or have one term which is the prefix itself
	if len(terms) == 0 || (len(terms) == 1 && terms[0] == prefix) {
		return NewTermSearcher(ctx, indexReader, prefix, field, boost, options)
	}

	return NewMultiTermSearcher(ctx, indexReader, terms, field, boost, options, true)
}
