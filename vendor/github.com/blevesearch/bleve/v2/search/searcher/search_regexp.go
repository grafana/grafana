//  Copyright (c) 2015 Couchbase, Inc.
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
	"regexp"

	"github.com/blevesearch/bleve/v2/search"
	index "github.com/blevesearch/bleve_index_api"
)

// The Regexp interface defines the subset of the regexp.Regexp API
// methods that are used by bleve indexes, allowing callers to pass in
// alternate implementations.
type Regexp interface {
	FindStringIndex(s string) (loc []int)

	LiteralPrefix() (prefix string, complete bool)

	String() string
}

// NewRegexpStringSearcher is similar to NewRegexpSearcher, but
// additionally optimizes for index readers that handle regexp's.
func NewRegexpStringSearcher(ctx context.Context, indexReader index.IndexReader, pattern string,
	field string, boost float64, options search.SearcherOptions) (
	search.Searcher, error) {
	ir, ok := indexReader.(index.IndexReaderRegexp)
	if !ok {
		r, err := regexp.Compile(pattern)
		if err != nil {
			return nil, err
		}

		return NewRegexpSearcher(ctx, indexReader, r, field, boost, options)
	}

	fieldDict, a, err := ir.FieldDictRegexpAutomaton(field, pattern)
	if err != nil {
		return nil, err
	}
	defer func() {
		if cerr := fieldDict.Close(); cerr != nil && err == nil {
			err = cerr
		}
	}()

	var termSet = make(map[string]struct{})
	var candidateTerms []string

	tfd, err := fieldDict.Next()
	for err == nil && tfd != nil {
		if _, exists := termSet[tfd.Term]; !exists {
			termSet[tfd.Term] = struct{}{}
			candidateTerms = append(candidateTerms, tfd.Term)
			tfd, err = fieldDict.Next()
		}
	}
	if err != nil {
		return nil, err
	}

	if ctx != nil {
		if fts, ok := ctx.Value(search.FieldTermSynonymMapKey).(search.FieldTermSynonymMap); ok {
			if ts, exists := fts[field]; exists {
				for term := range ts {
					if _, exists := termSet[term]; exists {
						continue
					}
					if a.MatchesRegex(term) {
						termSet[term] = struct{}{}
						candidateTerms = append(candidateTerms, term)
					}
				}
			}
		}
	}

	return NewMultiTermSearcher(ctx, indexReader, candidateTerms, field, boost,
		options, true)
}

// NewRegexpSearcher creates a searcher which will match documents that
// contain terms which match the pattern regexp.  The match must be EXACT
// matching the entire term.  The provided regexp SHOULD NOT start with ^
// or end with $ as this can interfere with the implementation.  Separately,
// matches will be checked to ensure they match the entire term.
func NewRegexpSearcher(ctx context.Context, indexReader index.IndexReader, pattern Regexp,
	field string, boost float64, options search.SearcherOptions) (
	search.Searcher, error) {
	var candidateTerms []string
	var regexpCandidates *regexpCandidates
	prefixTerm, complete := pattern.LiteralPrefix()
	if complete {
		// there is no pattern
		candidateTerms = []string{prefixTerm}
	} else {
		var err error
		regexpCandidates, err = findRegexpCandidateTerms(indexReader, pattern, field,
			prefixTerm)
		if err != nil {
			return nil, err
		}
	}
	var dictBytesRead uint64
	if regexpCandidates != nil {
		candidateTerms = regexpCandidates.candidates
		dictBytesRead = regexpCandidates.bytesRead
	}

	if ctx != nil {
		reportIOStats(ctx, dictBytesRead)
		search.RecordSearchCost(ctx, search.AddM, dictBytesRead)
	}

	return NewMultiTermSearcher(ctx, indexReader, candidateTerms, field, boost,
		options, true)
}

type regexpCandidates struct {
	candidates []string
	bytesRead  uint64
}

func findRegexpCandidateTerms(indexReader index.IndexReader,
	pattern Regexp, field, prefixTerm string) (rv *regexpCandidates, err error) {
	rv = &regexpCandidates{
		candidates: make([]string, 0),
	}
	var fieldDict index.FieldDict
	if len(prefixTerm) > 0 {
		fieldDict, err = indexReader.FieldDictPrefix(field, []byte(prefixTerm))
	} else {
		fieldDict, err = indexReader.FieldDict(field)
	}
	defer func() {
		if cerr := fieldDict.Close(); cerr != nil && err == nil {
			err = cerr
		}
	}()

	// enumerate the terms and check against regexp
	tfd, err := fieldDict.Next()
	for err == nil && tfd != nil {
		matchPos := pattern.FindStringIndex(tfd.Term)
		if matchPos != nil && matchPos[0] == 0 && matchPos[1] == len(tfd.Term) {
			rv.candidates = append(rv.candidates, tfd.Term)
			if tooManyClauses(len(rv.candidates)) {
				return rv, tooManyClausesErr(field, len(rv.candidates))
			}
		}
		tfd, err = fieldDict.Next()
	}
	rv.bytesRead = fieldDict.BytesRead()
	return rv, err
}
