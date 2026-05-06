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
	"regexp/syntax"

	"github.com/blevesearch/vellum/regexp"
	"github.com/blugelabs/bluge/search"
)

// NewRegexpStringSearcher is similar to NewRegexpSearcher, but
// additionally optimizes for index readers that handle regexp's.
func NewRegexpStringSearcher(indexReader search.Reader, pattern, field string,
	boost float64, scorer search.Scorer, compScorer search.CompositeScorer,
	options search.SearcherOptions) (search.Searcher, error) {
	a, prefixBeg, prefixEnd, err := parseRegexp(pattern)
	if err != nil {
		return nil, err
	}

	fieldDict, err := indexReader.DictionaryIterator(field, a, prefixBeg, prefixEnd)
	if err != nil {
		return nil, err
	}
	defer func() {
		if cerr := fieldDict.Close(); cerr != nil && err == nil {
			err = cerr
		}
	}()

	var candidateTerms []string

	tfd, err := fieldDict.Next()
	for err == nil && tfd != nil {
		candidateTerms = append(candidateTerms, tfd.Term())
		tfd, err = fieldDict.Next()
	}
	if err != nil {
		return nil, err
	}

	return NewMultiTermSearcher(indexReader, candidateTerms, field, boost, scorer,
		compScorer, options, true)
}

func parseRegexp(pattern string) (a *regexp.Regexp, prefixBeg, prefixEnd []byte, err error) {
	// TODO: potential optimization where syntax.Regexp supports a Simplify() API?

	parsed, err := syntax.Parse(pattern, syntax.Perl)
	if err != nil {
		return nil, nil, nil, err
	}

	re, err := regexp.NewParsedWithLimit(pattern, parsed, regexp.DefaultLimit)
	if err != nil {
		return nil, nil, nil, err
	}

	prefix := literalPrefix(parsed)
	if prefix != "" {
		prefixBeg := []byte(prefix)
		prefixEnd := incrementBytes(prefixBeg)
		return re, prefixBeg, prefixEnd, nil
	}

	return re, nil, nil, nil
}

// Returns the literal prefix given the parse tree for a regexp
func literalPrefix(s *syntax.Regexp) string {
	// traverse the left-most branch in the parse tree as long as the
	// node represents a concatenation
	for s != nil && s.Op == syntax.OpConcat {
		if len(s.Sub) < 1 {
			return ""
		}

		s = s.Sub[0]
	}

	if s.Op == syntax.OpLiteral && (s.Flags&syntax.FoldCase == 0) {
		return string(s.Rune)
	}

	return "" // no literal prefix
}
