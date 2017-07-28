// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// MatchQuery is a family of queries that accepts text/numerics/dates,
// analyzes them, and constructs a query.
//
// To create a new MatchQuery, use NewMatchQuery. To create specific types
// of queries, e.g. a match_phrase query, use NewMatchPhrQuery(...).Type("phrase"),
// or use one of the shortcuts e.g. NewMatchPhraseQuery(...).
//
// For more details, see
// https://www.elastic.co/guide/en/elasticsearch/reference/5.2/query-dsl-match-query.html
type MatchQuery struct {
	name                string
	text                interface{}
	typ                 string // boolean, phrase, phrase_prefix
	operator            string // or / and
	analyzer            string
	boost               *float64
	slop                *int
	fuzziness           string
	prefixLength        *int
	maxExpansions       *int
	minimumShouldMatch  string
	rewrite             string
	fuzzyRewrite        string
	lenient             *bool
	fuzzyTranspositions *bool
	zeroTermsQuery      string
	cutoffFrequency     *float64
	queryName           string
}

// NewMatchQuery creates and initializes a new MatchQuery.
func NewMatchQuery(name string, text interface{}) *MatchQuery {
	return &MatchQuery{name: name, text: text}
}

// NewMatchPhraseQuery creates and initializes a new MatchQuery of type phrase.
func NewMatchPhraseQuery(name string, text interface{}) *MatchQuery {
	return &MatchQuery{name: name, text: text, typ: "phrase"}
}

// NewMatchPhrasePrefixQuery creates and initializes a new MatchQuery of type phrase_prefix.
func NewMatchPhrasePrefixQuery(name string, text interface{}) *MatchQuery {
	return &MatchQuery{name: name, text: text, typ: "phrase_prefix"}
}

// Type can be "boolean", "phrase", or "phrase_prefix". Defaults to "boolean".
func (q *MatchQuery) Type(typ string) *MatchQuery {
	q.typ = typ
	return q
}

// Operator sets the operator to use when using a boolean query.
// Can be "AND" or "OR" (default).
func (q *MatchQuery) Operator(operator string) *MatchQuery {
	q.operator = operator
	return q
}

// Analyzer explicitly sets the analyzer to use. It defaults to use explicit
// mapping config for the field, or, if not set, the default search analyzer.
func (q *MatchQuery) Analyzer(analyzer string) *MatchQuery {
	q.analyzer = analyzer
	return q
}

// Boost sets the boost to apply to this query.
func (q *MatchQuery) Boost(boost float64) *MatchQuery {
	q.boost = &boost
	return q
}

// Slop sets the phrase slop if evaluated to a phrase query type.
func (q *MatchQuery) Slop(slop int) *MatchQuery {
	q.slop = &slop
	return q
}

// Fuzziness sets the fuzziness when evaluated to a fuzzy query type.
// Defaults to "AUTO".
func (q *MatchQuery) Fuzziness(fuzziness string) *MatchQuery {
	q.fuzziness = fuzziness
	return q
}

func (q *MatchQuery) PrefixLength(prefixLength int) *MatchQuery {
	q.prefixLength = &prefixLength
	return q
}

// MaxExpansions is used with fuzzy or prefix type queries. It specifies
// the number of term expansions to use. It defaults to unbounded so that
// its recommended to set it to a reasonable value for faster execution.
func (q *MatchQuery) MaxExpansions(maxExpansions int) *MatchQuery {
	q.maxExpansions = &maxExpansions
	return q
}

// CutoffFrequency can be a value in [0..1] (or an absolute number >=1).
// It represents the maximum treshold of a terms document frequency to be
// considered a low frequency term.
func (q *MatchQuery) CutoffFrequency(cutoff float64) *MatchQuery {
	q.cutoffFrequency = &cutoff
	return q
}

func (q *MatchQuery) MinimumShouldMatch(minimumShouldMatch string) *MatchQuery {
	q.minimumShouldMatch = minimumShouldMatch
	return q
}

func (q *MatchQuery) Rewrite(rewrite string) *MatchQuery {
	q.rewrite = rewrite
	return q
}

func (q *MatchQuery) FuzzyRewrite(fuzzyRewrite string) *MatchQuery {
	q.fuzzyRewrite = fuzzyRewrite
	return q
}

func (q *MatchQuery) FuzzyTranspositions(fuzzyTranspositions bool) *MatchQuery {
	q.fuzzyTranspositions = &fuzzyTranspositions
	return q
}

// Lenient specifies whether format based failures will be ignored.
func (q *MatchQuery) Lenient(lenient bool) *MatchQuery {
	q.lenient = &lenient
	return q
}

// ZeroTermsQuery can be "all" or "none".
func (q *MatchQuery) ZeroTermsQuery(zeroTermsQuery string) *MatchQuery {
	q.zeroTermsQuery = zeroTermsQuery
	return q
}

// QueryName sets the query name for the filter that can be used when
// searching for matched filters per hit.
func (q *MatchQuery) QueryName(queryName string) *MatchQuery {
	q.queryName = queryName
	return q
}

// Source returns JSON for the function score query.
func (q *MatchQuery) Source() (interface{}, error) {
	// {"match":{"name":{"query":"value","type":"boolean/phrase"}}}
	source := make(map[string]interface{})

	match := make(map[string]interface{})
	source["match"] = match

	query := make(map[string]interface{})
	match[q.name] = query

	query["query"] = q.text

	if q.typ != "" {
		query["type"] = q.typ
	}
	if q.operator != "" {
		query["operator"] = q.operator
	}
	if q.analyzer != "" {
		query["analyzer"] = q.analyzer
	}
	if q.boost != nil {
		query["boost"] = *q.boost
	}
	if q.slop != nil {
		query["slop"] = *q.slop
	}
	if q.fuzziness != "" {
		query["fuzziness"] = q.fuzziness
	}
	if q.prefixLength != nil {
		query["prefix_length"] = *q.prefixLength
	}
	if q.maxExpansions != nil {
		query["max_expansions"] = *q.maxExpansions
	}
	if q.minimumShouldMatch != "" {
		query["minimum_should_match"] = q.minimumShouldMatch
	}
	if q.rewrite != "" {
		query["rewrite"] = q.rewrite
	}
	if q.fuzzyRewrite != "" {
		query["fuzzy_rewrite"] = q.fuzzyRewrite
	}
	if q.lenient != nil {
		query["lenient"] = *q.lenient
	}
	if q.fuzzyTranspositions != nil {
		query["fuzzy_transpositions"] = *q.fuzzyTranspositions
	}
	if q.zeroTermsQuery != "" {
		query["zero_terms_query"] = q.zeroTermsQuery
	}
	if q.cutoffFrequency != nil {
		query["cutoff_frequency"] = q.cutoffFrequency
	}
	if q.queryName != "" {
		query["_name"] = q.queryName
	}

	return source, nil
}
