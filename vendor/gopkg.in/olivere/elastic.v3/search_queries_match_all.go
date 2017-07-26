// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// MatchAllQuery is the most simple query, which matches all documents,
// giving them all a _score of 1.0.
//
// For more details, see
// https://www.elastic.co/guide/en/elasticsearch/reference/master/query-dsl-match-all-query.html
type MatchAllQuery struct {
	boost *float64
}

// NewMatchAllQuery creates and initializes a new match all query.
func NewMatchAllQuery() *MatchAllQuery {
	return &MatchAllQuery{}
}

// Boost sets the boost for this query. Documents matching this query will
// (in addition to the normal weightings) have their score multiplied by the
// boost provided.
func (q *MatchAllQuery) Boost(boost float64) *MatchAllQuery {
	q.boost = &boost
	return q
}

// Source returns JSON for the function score query.
func (q MatchAllQuery) Source() (interface{}, error) {
	// {
	//   "match_all" : { ... }
	// }
	source := make(map[string]interface{})
	params := make(map[string]interface{})
	source["match_all"] = params
	if q.boost != nil {
		params["boost"] = *q.boost
	}
	return source, nil
}
