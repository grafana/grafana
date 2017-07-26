// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"fmt"
	"strings"
)

// MultiMatchQuery builds on the MatchQuery to allow multi-field queries.
//
// For more details, see
// https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-multi-match-query.html
type MultiMatchQuery struct {
	text               interface{}
	fields             []string
	fieldBoosts        map[string]*float64
	typ                string // best_fields, boolean, most_fields, cross_fields, phrase, phrase_prefix
	operator           string // AND or OR
	analyzer           string
	boost              *float64
	slop               *int
	fuzziness          string
	prefixLength       *int
	maxExpansions      *int
	minimumShouldMatch string
	rewrite            string
	fuzzyRewrite       string
	tieBreaker         *float64
	lenient            *bool
	cutoffFrequency    *float64
	zeroTermsQuery     string
	queryName          string
}

// MultiMatchQuery creates and initializes a new MultiMatchQuery.
func NewMultiMatchQuery(text interface{}, fields ...string) *MultiMatchQuery {
	q := &MultiMatchQuery{
		text:        text,
		fields:      make([]string, 0),
		fieldBoosts: make(map[string]*float64),
	}
	q.fields = append(q.fields, fields...)
	return q
}

// Field adds a field to run the multi match against.
func (q *MultiMatchQuery) Field(field string) *MultiMatchQuery {
	q.fields = append(q.fields, field)
	return q
}

// FieldWithBoost adds a field to run the multi match against with a specific boost.
func (q *MultiMatchQuery) FieldWithBoost(field string, boost float64) *MultiMatchQuery {
	q.fields = append(q.fields, field)
	q.fieldBoosts[field] = &boost
	return q
}

// Type can be "best_fields", "boolean", "most_fields", "cross_fields",
// "phrase", or "phrase_prefix".
func (q *MultiMatchQuery) Type(typ string) *MultiMatchQuery {
	var zero = float64(0.0)
	var one = float64(1.0)

	switch strings.ToLower(typ) {
	default: // best_fields / boolean
		q.typ = "best_fields"
		q.tieBreaker = &zero
	case "most_fields":
		q.typ = "most_fields"
		q.tieBreaker = &one
	case "cross_fields":
		q.typ = "cross_fields"
		q.tieBreaker = &zero
	case "phrase":
		q.typ = "phrase"
		q.tieBreaker = &zero
	case "phrase_prefix":
		q.typ = "phrase_prefix"
		q.tieBreaker = &zero
	}
	return q
}

// Operator sets the operator to use when using boolean query.
// It can be either AND or OR (default).
func (q *MultiMatchQuery) Operator(operator string) *MultiMatchQuery {
	q.operator = operator
	return q
}

// Analyzer sets the analyzer to use explicitly. It defaults to use explicit
// mapping config for the field, or, if not set, the default search analyzer.
func (q *MultiMatchQuery) Analyzer(analyzer string) *MultiMatchQuery {
	q.analyzer = analyzer
	return q
}

// Boost sets the boost for this query.
func (q *MultiMatchQuery) Boost(boost float64) *MultiMatchQuery {
	q.boost = &boost
	return q
}

// Slop sets the phrase slop if evaluated to a phrase query type.
func (q *MultiMatchQuery) Slop(slop int) *MultiMatchQuery {
	q.slop = &slop
	return q
}

// Fuzziness sets the fuzziness used when evaluated to a fuzzy query type.
// It defaults to "AUTO".
func (q *MultiMatchQuery) Fuzziness(fuzziness string) *MultiMatchQuery {
	q.fuzziness = fuzziness
	return q
}

// PrefixLength for the fuzzy process.
func (q *MultiMatchQuery) PrefixLength(prefixLength int) *MultiMatchQuery {
	q.prefixLength = &prefixLength
	return q
}

// MaxExpansions is the number of term expansions to use when using fuzzy
// or prefix type query. It defaults to unbounded so it's recommended
// to set it to a reasonable value for faster execution.
func (q *MultiMatchQuery) MaxExpansions(maxExpansions int) *MultiMatchQuery {
	q.maxExpansions = &maxExpansions
	return q
}

// MinimumShouldMatch represents the minimum number of optional should clauses
// to match.
func (q *MultiMatchQuery) MinimumShouldMatch(minimumShouldMatch string) *MultiMatchQuery {
	q.minimumShouldMatch = minimumShouldMatch
	return q
}

func (q *MultiMatchQuery) Rewrite(rewrite string) *MultiMatchQuery {
	q.rewrite = rewrite
	return q
}

func (q *MultiMatchQuery) FuzzyRewrite(fuzzyRewrite string) *MultiMatchQuery {
	q.fuzzyRewrite = fuzzyRewrite
	return q
}

// TieBreaker for "best-match" disjunction queries (OR queries).
// The tie breaker capability allows documents that match more than one
// query clause (in this case on more than one field) to be scored better
// than documents that match only the best of the fields, without confusing
// this with the better case of two distinct matches in the multiple fields.
//
// A tie-breaker value of 1.0 is interpreted as a signal to score queries as
// "most-match" queries where all matching query clauses are considered for scoring.
func (q *MultiMatchQuery) TieBreaker(tieBreaker float64) *MultiMatchQuery {
	q.tieBreaker = &tieBreaker
	return q
}

// Lenient indicates whether format based failures will be ignored.
func (q *MultiMatchQuery) Lenient(lenient bool) *MultiMatchQuery {
	q.lenient = &lenient
	return q
}

// CutoffFrequency sets a cutoff value in [0..1] (or absolute number >=1)
// representing the maximum threshold of a terms document frequency to be
// considered a low frequency term.
func (q *MultiMatchQuery) CutoffFrequency(cutoff float64) *MultiMatchQuery {
	q.cutoffFrequency = &cutoff
	return q
}

// ZeroTermsQuery can be "all" or "none".
func (q *MultiMatchQuery) ZeroTermsQuery(zeroTermsQuery string) *MultiMatchQuery {
	q.zeroTermsQuery = zeroTermsQuery
	return q
}

// QueryName sets the query name for the filter that can be used when
// searching for matched filters per hit.
func (q *MultiMatchQuery) QueryName(queryName string) *MultiMatchQuery {
	q.queryName = queryName
	return q
}

// Source returns JSON for the query.
func (q *MultiMatchQuery) Source() (interface{}, error) {
	//
	// {
	//   "multi_match" : {
	//     "query" : "this is a test",
	//     "fields" : [ "subject", "message" ]
	//   }
	// }

	source := make(map[string]interface{})

	multiMatch := make(map[string]interface{})
	source["multi_match"] = multiMatch

	multiMatch["query"] = q.text

	if len(q.fields) > 0 {
		var fields []string
		for _, field := range q.fields {
			if boost, found := q.fieldBoosts[field]; found {
				if boost != nil {
					fields = append(fields, fmt.Sprintf("%s^%f", field, *boost))
				} else {
					fields = append(fields, field)
				}
			} else {
				fields = append(fields, field)
			}
		}
		multiMatch["fields"] = fields
	}

	if q.typ != "" {
		multiMatch["type"] = q.typ
	}

	if q.operator != "" {
		multiMatch["operator"] = q.operator
	}
	if q.analyzer != "" {
		multiMatch["analyzer"] = q.analyzer
	}
	if q.boost != nil {
		multiMatch["boost"] = *q.boost
	}
	if q.slop != nil {
		multiMatch["slop"] = *q.slop
	}
	if q.fuzziness != "" {
		multiMatch["fuzziness"] = q.fuzziness
	}
	if q.prefixLength != nil {
		multiMatch["prefix_length"] = *q.prefixLength
	}
	if q.maxExpansions != nil {
		multiMatch["max_expansions"] = *q.maxExpansions
	}
	if q.minimumShouldMatch != "" {
		multiMatch["minimum_should_match"] = q.minimumShouldMatch
	}
	if q.rewrite != "" {
		multiMatch["rewrite"] = q.rewrite
	}
	if q.fuzzyRewrite != "" {
		multiMatch["fuzzy_rewrite"] = q.fuzzyRewrite
	}
	if q.tieBreaker != nil {
		multiMatch["tie_breaker"] = *q.tieBreaker
	}
	if q.lenient != nil {
		multiMatch["lenient"] = *q.lenient
	}
	if q.cutoffFrequency != nil {
		multiMatch["cutoff_frequency"] = *q.cutoffFrequency
	}
	if q.zeroTermsQuery != "" {
		multiMatch["zero_terms_query"] = q.zeroTermsQuery
	}
	if q.queryName != "" {
		multiMatch["_name"] = q.queryName
	}
	return source, nil
}
