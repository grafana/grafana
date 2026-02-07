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

package query

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"strings"

	"github.com/blevesearch/bleve/v2/analysis"
	"github.com/blevesearch/bleve/v2/mapping"
	"github.com/blevesearch/bleve/v2/search"
	"github.com/blevesearch/bleve/v2/search/searcher"
	"github.com/blevesearch/bleve/v2/util"
	index "github.com/blevesearch/bleve_index_api"
)

var logger = log.New(io.Discard, "bleve mapping ", log.LstdFlags)

// SetLog sets the logger used for logging
// by default log messages are sent to io.Discard
func SetLog(l *log.Logger) {
	logger = l
}

// A Query represents a description of the type
// and parameters for a query into the index.
type Query interface {
	Searcher(ctx context.Context, i index.IndexReader, m mapping.IndexMapping,
		options search.SearcherOptions) (search.Searcher, error)
}

// A BoostableQuery represents a Query which can be boosted
// relative to other queries.
type BoostableQuery interface {
	Query
	SetBoost(b float64)
	Boost() float64
}

// A FieldableQuery represents a Query which can be restricted
// to a single field.
type FieldableQuery interface {
	Query
	SetField(f string)
	Field() string
}

// A ValidatableQuery represents a Query which can be validated
// prior to execution.
type ValidatableQuery interface {
	Query
	Validate() error
}

// ParsePreSearchData deserializes a JSON representation of
// a PreSearchData object.
func ParsePreSearchData(input []byte) (map[string]interface{}, error) {
	var rv map[string]interface{}

	var tmp map[string]json.RawMessage
	err := util.UnmarshalJSON(input, &tmp)
	if err != nil {
		return nil, err
	}

	for k, v := range tmp {
		switch k {
		case search.KnnPreSearchDataKey:
			var value []*search.DocumentMatch
			if v != nil {
				err := util.UnmarshalJSON(v, &value)
				if err != nil {
					return nil, err
				}
			}
			if rv == nil {
				rv = make(map[string]interface{})
			}
			rv[search.KnnPreSearchDataKey] = value
		case search.SynonymPreSearchDataKey:
			var value search.FieldTermSynonymMap
			if v != nil {
				err := util.UnmarshalJSON(v, &value)
				if err != nil {
					return nil, err
				}
			}
			if rv == nil {
				rv = make(map[string]interface{})
			}
			rv[search.SynonymPreSearchDataKey] = value
		case search.BM25PreSearchDataKey:
			var value *search.BM25Stats
			if v != nil {
				err := util.UnmarshalJSON(v, &value)
				if err != nil {
					return nil, err
				}
			}
			if rv == nil {
				rv = make(map[string]interface{})
			}
			rv[search.BM25PreSearchDataKey] = value

		}
	}
	return rv, nil
}

// ParseQuery deserializes a JSON representation of
// a Query object.
func ParseQuery(input []byte) (Query, error) {
	if len(input) == 0 {
		// interpret as a match_none query
		return NewMatchNoneQuery(), nil
	}

	var tmp map[string]interface{}
	err := util.UnmarshalJSON(input, &tmp)
	if err != nil {
		return nil, err
	}

	if len(tmp) == 0 {
		// interpret as a match_none query
		return NewMatchNoneQuery(), nil
	}

	_, hasFuzziness := tmp["fuzziness"]
	_, isMatchQuery := tmp["match"]
	_, isMatchPhraseQuery := tmp["match_phrase"]
	_, hasTerms := tmp["terms"]
	if hasFuzziness && !isMatchQuery && !isMatchPhraseQuery && !hasTerms {
		var rv FuzzyQuery
		err := util.UnmarshalJSON(input, &rv)
		if err != nil {
			return nil, err
		}
		return &rv, nil
	}
	if isMatchQuery {
		var rv MatchQuery
		err := util.UnmarshalJSON(input, &rv)
		if err != nil {
			return nil, err
		}
		return &rv, nil
	}
	if isMatchPhraseQuery {
		var rv MatchPhraseQuery
		err := util.UnmarshalJSON(input, &rv)
		if err != nil {
			return nil, err
		}
		return &rv, nil
	}
	if hasTerms {
		var rv PhraseQuery
		err := util.UnmarshalJSON(input, &rv)
		if err != nil {
			// now try multi-phrase
			var rv2 MultiPhraseQuery
			err = util.UnmarshalJSON(input, &rv2)
			if err != nil {
				return nil, err
			}
			return &rv2, nil
		}
		return &rv, nil
	}
	_, isTermQuery := tmp["term"]
	if isTermQuery {
		var rv TermQuery
		err := util.UnmarshalJSON(input, &rv)
		if err != nil {
			return nil, err
		}
		return &rv, nil
	}
	_, hasMust := tmp["must"]
	_, hasShould := tmp["should"]
	_, hasMustNot := tmp["must_not"]
	_, hasFilter := tmp["filter"]
	if hasMust || hasShould || hasMustNot || hasFilter {
		var rv BooleanQuery
		err := util.UnmarshalJSON(input, &rv)
		if err != nil {
			return nil, err
		}
		return &rv, nil
	}
	_, hasConjuncts := tmp["conjuncts"]
	if hasConjuncts {
		var rv ConjunctionQuery
		err := util.UnmarshalJSON(input, &rv)
		if err != nil {
			return nil, err
		}
		return &rv, nil
	}
	_, hasDisjuncts := tmp["disjuncts"]
	if hasDisjuncts {
		var rv DisjunctionQuery
		err := util.UnmarshalJSON(input, &rv)
		if err != nil {
			return nil, err
		}
		return &rv, nil
	}

	_, hasSyntaxQuery := tmp["query"]
	if hasSyntaxQuery {
		var rv QueryStringQuery
		err := util.UnmarshalJSON(input, &rv)
		if err != nil {
			return nil, err
		}
		return &rv, nil
	}
	_, hasMin := tmp["min"].(float64)
	_, hasMax := tmp["max"].(float64)
	if hasMin || hasMax {
		var rv NumericRangeQuery
		err := util.UnmarshalJSON(input, &rv)
		if err != nil {
			return nil, err
		}
		return &rv, nil
	}
	_, hasMinStr := tmp["min"].(string)
	_, hasMaxStr := tmp["max"].(string)
	if hasMinStr || hasMaxStr {
		var rv TermRangeQuery
		err := util.UnmarshalJSON(input, &rv)
		if err != nil {
			return nil, err
		}
		return &rv, nil
	}
	_, hasStart := tmp["start"]
	_, hasEnd := tmp["end"]
	if hasStart || hasEnd {
		var rv DateRangeStringQuery
		err := util.UnmarshalJSON(input, &rv)
		if err != nil {
			return nil, err
		}
		return &rv, nil
	}
	_, hasPrefix := tmp["prefix"]
	if hasPrefix {
		var rv PrefixQuery
		err := util.UnmarshalJSON(input, &rv)
		if err != nil {
			return nil, err
		}
		return &rv, nil
	}
	_, hasRegexp := tmp["regexp"]
	if hasRegexp {
		var rv RegexpQuery
		err := util.UnmarshalJSON(input, &rv)
		if err != nil {
			return nil, err
		}
		return &rv, nil
	}
	_, hasWildcard := tmp["wildcard"]
	if hasWildcard {
		var rv WildcardQuery
		err := util.UnmarshalJSON(input, &rv)
		if err != nil {
			return nil, err
		}
		return &rv, nil
	}
	_, hasMatchAll := tmp["match_all"]
	if hasMatchAll {
		var rv MatchAllQuery
		err := util.UnmarshalJSON(input, &rv)
		if err != nil {
			return nil, err
		}
		return &rv, nil
	}
	_, hasMatchNone := tmp["match_none"]
	if hasMatchNone {
		var rv MatchNoneQuery
		err := util.UnmarshalJSON(input, &rv)
		if err != nil {
			return nil, err
		}
		return &rv, nil
	}
	_, hasDocIds := tmp["ids"]
	if hasDocIds {
		var rv DocIDQuery
		err := util.UnmarshalJSON(input, &rv)
		if err != nil {
			return nil, err
		}
		return &rv, nil
	}
	_, hasBool := tmp["bool"]
	if hasBool {
		var rv BoolFieldQuery
		err := util.UnmarshalJSON(input, &rv)
		if err != nil {
			return nil, err
		}
		return &rv, nil
	}
	_, hasTopLeft := tmp["top_left"]
	_, hasBottomRight := tmp["bottom_right"]
	if hasTopLeft && hasBottomRight {
		var rv GeoBoundingBoxQuery
		err := util.UnmarshalJSON(input, &rv)
		if err != nil {
			return nil, err
		}
		return &rv, nil
	}
	_, hasDistance := tmp["distance"]
	if hasDistance {
		var rv GeoDistanceQuery
		err := util.UnmarshalJSON(input, &rv)
		if err != nil {
			return nil, err
		}
		return &rv, nil
	}
	_, hasPoints := tmp["polygon_points"]
	if hasPoints {
		var rv GeoBoundingPolygonQuery
		err := util.UnmarshalJSON(input, &rv)
		if err != nil {
			return nil, err
		}
		return &rv, nil
	}

	_, hasGeo := tmp["geometry"]
	if hasGeo {
		var rv GeoShapeQuery
		err := util.UnmarshalJSON(input, &rv)
		if err != nil {
			return nil, err
		}
		return &rv, nil
	}

	_, hasCIDR := tmp["cidr"]
	if hasCIDR {
		var rv IPRangeQuery
		err := util.UnmarshalJSON(input, &rv)
		if err != nil {
			return nil, err
		}
		return &rv, nil
	}

	return nil, fmt.Errorf("unknown query type")
}

// expandQuery traverses the input query tree and returns a new tree where
// query string queries have been expanded into base queries. Returned tree may
// reference queries from the input tree or new queries.
func expandQuery(m mapping.IndexMapping, query Query) (Query, error) {
	var expand func(query Query) (Query, error)
	var expandSlice func(queries []Query) ([]Query, error) = func(queries []Query) ([]Query, error) {
		expanded := []Query{}
		for _, q := range queries {
			exp, err := expand(q)
			if err != nil {
				return nil, err
			}
			expanded = append(expanded, exp)
		}
		return expanded, nil
	}

	expand = func(query Query) (Query, error) {
		switch q := query.(type) {
		case *QueryStringQuery:
			parsed, err := parseQuerySyntax(q.Query)
			if err != nil {
				return nil, fmt.Errorf("could not parse '%s': %s", q.Query, err)
			}
			return expand(parsed)
		case *ConjunctionQuery:
			children, err := expandSlice(q.Conjuncts)
			if err != nil {
				return nil, err
			}
			q.Conjuncts = children
			return q, nil
		case *DisjunctionQuery:
			children, err := expandSlice(q.Disjuncts)
			if err != nil {
				return nil, err
			}
			q.Disjuncts = children
			return q, nil
		case *BooleanQuery:
			var err error
			q.Must, err = expand(q.Must)
			if err != nil {
				return nil, err
			}
			q.Should, err = expand(q.Should)
			if err != nil {
				return nil, err
			}
			q.MustNot, err = expand(q.MustNot)
			if err != nil {
				return nil, err
			}
			q.Filter, err = expand(q.Filter)
			if err != nil {
				return nil, err
			}
			return q, nil
		default:
			return query, nil
		}
	}
	return expand(query)
}

// DumpQuery returns a string representation of the query tree, where query
// string queries have been expanded into base queries. The output format is
// meant for debugging purpose and may change in the future.
func DumpQuery(m mapping.IndexMapping, query Query) (string, error) {
	q, err := expandQuery(m, query)
	if err != nil {
		return "", err
	}
	data, err := json.MarshalIndent(q, "", "  ")
	return string(data), err
}

// FieldSet represents a set of queried fields.
type FieldSet map[string]struct{}

// ExtractFields returns a set of fields referenced by the query.
// The returned set may be nil if the query does not explicitly reference any field
// and the DefaultSearchField is unset in the index mapping.
func ExtractFields(q Query, m mapping.IndexMapping, fs FieldSet) (FieldSet, error) {
	if q == nil || m == nil {
		return fs, nil
	}
	var err error
	switch q := q.(type) {
	case FieldableQuery:
		f := q.Field()
		if f == "" {
			f = m.DefaultSearchField()
		}
		if f != "" {
			if fs == nil {
				fs = make(FieldSet)
			}
			fs[f] = struct{}{}
		}
	case *QueryStringQuery:
		var expandedQuery Query
		expandedQuery, err = expandQuery(m, q)
		if err == nil {
			fs, err = ExtractFields(expandedQuery, m, fs)
		}
	case *BooleanQuery:
		for _, subq := range []Query{q.Must, q.Should, q.MustNot, q.Filter} {
			fs, err = ExtractFields(subq, m, fs)
			if err != nil {
				break
			}
		}
	case *ConjunctionQuery:
		for _, subq := range q.Conjuncts {
			fs, err = ExtractFields(subq, m, fs)
			if err != nil {
				break
			}
		}
	case *DisjunctionQuery:
		for _, subq := range q.Disjuncts {
			fs, err = ExtractFields(subq, m, fs)
			if err != nil {
				break
			}
		}
	}
	return fs, err
}

const (
	FuzzyMatchType = iota
	RegexpMatchType
	PrefixMatchType
)

// ExtractSynonyms extracts synonyms from the query tree and returns a map of
// field-term pairs to their synonyms. The input query tree is traversed and
// for each term query, the synonyms are extracted from the synonym source
// associated with the field. The synonyms are then added to the provided map.
// The map is returned and may be nil if no synonyms were found.
func ExtractSynonyms(ctx context.Context, m mapping.SynonymMapping, r index.ThesaurusReader,
	query Query, rv search.FieldTermSynonymMap,
) (search.FieldTermSynonymMap, error) {
	if r == nil || m == nil || query == nil {
		return rv, nil
	}
	var err error
	resolveFieldAndSource := func(field string) (string, string) {
		if field == "" {
			field = m.DefaultSearchField()
		}
		return field, m.SynonymSourceForPath(field)
	}
	handleAnalyzer := func(analyzerName, field string) (analysis.Analyzer, error) {
		if analyzerName == "" {
			analyzerName = m.AnalyzerNameForPath(field)
		}
		analyzer := m.AnalyzerNamed(analyzerName)
		if analyzer == nil {
			return nil, fmt.Errorf("no analyzer named '%s' registered", analyzerName)
		}
		return analyzer, nil
	}
	switch q := query.(type) {
	case *BooleanQuery:
		rv, err = ExtractSynonyms(ctx, m, r, q.Must, rv)
		if err != nil {
			return nil, err
		}
		rv, err = ExtractSynonyms(ctx, m, r, q.Should, rv)
		if err != nil {
			return nil, err
		}
		rv, err = ExtractSynonyms(ctx, m, r, q.MustNot, rv)
		if err != nil {
			return nil, err
		}
		rv, err = ExtractSynonyms(ctx, m, r, q.Filter, rv)
		if err != nil {
			return nil, err
		}
	case *ConjunctionQuery:
		for _, child := range q.Conjuncts {
			rv, err = ExtractSynonyms(ctx, m, r, child, rv)
			if err != nil {
				return nil, err
			}
		}
	case *DisjunctionQuery:
		for _, child := range q.Disjuncts {
			rv, err = ExtractSynonyms(ctx, m, r, child, rv)
			if err != nil {
				return nil, err
			}
		}
	case *FuzzyQuery:
		field, source := resolveFieldAndSource(q.FieldVal)
		if source != "" {
			fuzziness := q.Fuzziness
			if q.autoFuzzy {
				fuzziness = searcher.GetAutoFuzziness(q.Term)
			}
			rv, err = addSynonymsForTermWithMatchType(ctx, FuzzyMatchType, source, field, q.Term, fuzziness, q.Prefix, r, rv)
			if err != nil {
				return nil, err
			}
		}
	case *MatchQuery, *MatchPhraseQuery:
		var analyzerName, matchString, fieldVal string
		var fuzziness, prefix int
		var autoFuzzy bool
		if mq, ok := q.(*MatchQuery); ok {
			analyzerName, fieldVal, matchString, fuzziness, prefix, autoFuzzy = mq.Analyzer, mq.FieldVal, mq.Match, mq.Fuzziness, mq.Prefix, mq.autoFuzzy
		} else if mpq, ok := q.(*MatchPhraseQuery); ok {
			analyzerName, fieldVal, matchString, fuzziness, autoFuzzy = mpq.Analyzer, mpq.FieldVal, mpq.MatchPhrase, mpq.Fuzziness, mpq.autoFuzzy
		}
		field, source := resolveFieldAndSource(fieldVal)
		if source != "" {
			analyzer, err := handleAnalyzer(analyzerName, field)
			if err != nil {
				return nil, err
			}
			tokens := analyzer.Analyze([]byte(matchString))
			for _, token := range tokens {
				if autoFuzzy {
					fuzziness = searcher.GetAutoFuzziness(string(token.Term))
				}
				rv, err = addSynonymsForTermWithMatchType(ctx, FuzzyMatchType, source, field, string(token.Term), fuzziness, prefix, r, rv)
				if err != nil {
					return nil, err
				}
			}
		}
	case *MultiPhraseQuery, *PhraseQuery:
		var fieldVal string
		var fuzziness int
		var autoFuzzy bool
		if mpq, ok := q.(*MultiPhraseQuery); ok {
			fieldVal, fuzziness, autoFuzzy = mpq.FieldVal, mpq.Fuzziness, mpq.autoFuzzy
		} else if pq, ok := q.(*PhraseQuery); ok {
			fieldVal, fuzziness, autoFuzzy = pq.FieldVal, pq.Fuzziness, pq.autoFuzzy
		}
		field, source := resolveFieldAndSource(fieldVal)
		if source != "" {
			var terms []string
			if mpq, ok := q.(*MultiPhraseQuery); ok {
				for _, termGroup := range mpq.Terms {
					terms = append(terms, termGroup...)
				}
			} else if pq, ok := q.(*PhraseQuery); ok {
				terms = pq.Terms
			}
			for _, term := range terms {
				if autoFuzzy {
					fuzziness = searcher.GetAutoFuzziness(term)
				}
				rv, err = addSynonymsForTermWithMatchType(ctx, FuzzyMatchType, source, field, term, fuzziness, 0, r, rv)
				if err != nil {
					return nil, err
				}
			}
		}
	case *PrefixQuery:
		field, source := resolveFieldAndSource(q.FieldVal)
		if source != "" {
			rv, err = addSynonymsForTermWithMatchType(ctx, PrefixMatchType, source, field, q.Prefix, 0, 0, r, rv)
			if err != nil {
				return nil, err
			}
		}
	case *QueryStringQuery:
		expanded, err := expandQuery(m, q)
		if err != nil {
			return nil, err
		}
		rv, err = ExtractSynonyms(ctx, m, r, expanded, rv)
		if err != nil {
			return nil, err
		}
	case *TermQuery:
		field, source := resolveFieldAndSource(q.FieldVal)
		if source != "" {
			rv, err = addSynonymsForTerm(ctx, source, field, q.Term, r, rv)
			if err != nil {
				return nil, err
			}
		}
	case *RegexpQuery:
		field, source := resolveFieldAndSource(q.FieldVal)
		if source != "" {
			rv, err = addSynonymsForTermWithMatchType(ctx, RegexpMatchType, source, field, strings.TrimPrefix(q.Regexp, "^"), 0, 0, r, rv)
			if err != nil {
				return nil, err
			}
		}
	case *WildcardQuery:
		field, source := resolveFieldAndSource(q.FieldVal)
		if source != "" {
			rv, err = addSynonymsForTermWithMatchType(ctx, RegexpMatchType, source, field, wildcardRegexpReplacer.Replace(q.Wildcard), 0, 0, r, rv)
			if err != nil {
				return nil, err
			}
		}
	}
	return rv, nil
}

// addFuzzySynonymsForTerm finds all terms that match the given term with the
// given fuzziness and adds their synonyms to the provided map.
func addSynonymsForTermWithMatchType(ctx context.Context, matchType int, src, field, term string, fuzziness, prefix int,
	r index.ThesaurusReader, rv search.FieldTermSynonymMap,
) (search.FieldTermSynonymMap, error) {
	// Determine the terms based on the match type (fuzzy, prefix, or regexp)
	var thesKeys index.ThesaurusKeys
	var err error
	var terms []string
	switch matchType {
	case FuzzyMatchType:
		// Ensure valid fuzziness
		if fuzziness == 0 {
			rv, err = addSynonymsForTerm(ctx, src, field, term, r, rv)
			if err != nil {
				return nil, err
			}
			return rv, nil
		}
		if fuzziness > searcher.MaxFuzziness {
			return nil, fmt.Errorf("fuzziness exceeds max (%d)", searcher.MaxFuzziness)
		}
		if fuzziness < 0 {
			return nil, fmt.Errorf("invalid fuzziness, negative")
		}
		// Handle fuzzy match
		prefixTerm := ""
		for i, r := range term {
			if i < prefix {
				prefixTerm += string(r)
			} else {
				break
			}
		}
		thesKeys, err = r.ThesaurusKeysFuzzy(src, term, fuzziness, prefixTerm)
	case RegexpMatchType:
		// Handle regexp match
		thesKeys, err = r.ThesaurusKeysRegexp(src, term)
	case PrefixMatchType:
		// Handle prefix match
		thesKeys, err = r.ThesaurusKeysPrefix(src, []byte(term))
	default:
		return nil, fmt.Errorf("invalid match type: %d", matchType)
	}
	if err != nil {
		return nil, err
	}
	defer func() {
		if cerr := thesKeys.Close(); cerr != nil && err == nil {
			err = cerr
		}
	}()
	// Collect the matching terms
	terms = []string{}
	tfd, err := thesKeys.Next()
	for err == nil && tfd != nil {
		terms = append(terms, tfd.Term)
		tfd, err = thesKeys.Next()
	}
	if err != nil {
		return nil, err
	}
	for _, synTerm := range terms {
		rv, err = addSynonymsForTerm(ctx, src, field, synTerm, r, rv)
		if err != nil {
			return nil, err
		}
	}
	return rv, nil
}

func addSynonymsForTerm(ctx context.Context, src, field, term string,
	r index.ThesaurusReader, rv search.FieldTermSynonymMap,
) (search.FieldTermSynonymMap, error) {
	termReader, err := r.ThesaurusTermReader(ctx, src, []byte(term))
	if err != nil {
		return nil, err
	}
	defer func() {
		if cerr := termReader.Close(); cerr != nil && err == nil {
			err = cerr
		}
	}()
	var synonyms []string
	synonym, err := termReader.Next()
	for err == nil && synonym != "" {
		synonyms = append(synonyms, synonym)
		synonym, err = termReader.Next()
	}
	if err != nil {
		return nil, err
	}
	if len(synonyms) > 0 {
		if rv == nil {
			rv = make(search.FieldTermSynonymMap)
		}
		if _, exists := rv[field]; !exists {
			rv[field] = make(map[string][]string)
		}
		rv[field][term] = synonyms
	}
	return rv, nil
}
