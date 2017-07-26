// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// ConstantScoreQuery is a query that wraps a filter and simply returns
// a constant score equal to the query boost for every document in the filter.
//
// For more details, see:
// https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-constant-score-query.html
type ConstantScoreQuery struct {
	filter Query
	boost  *float64
}

// ConstantScoreQuery creates and initializes a new constant score query.
func NewConstantScoreQuery(filter Query) *ConstantScoreQuery {
	return &ConstantScoreQuery{
		filter: filter,
	}
}

// Boost sets the boost for this query. Documents matching this query
// will (in addition to the normal weightings) have their score multiplied
// by the boost provided.
func (q *ConstantScoreQuery) Boost(boost float64) *ConstantScoreQuery {
	q.boost = &boost
	return q
}

// Source returns the query source.
func (q *ConstantScoreQuery) Source() (interface{}, error) {
	// "constant_score" : {
	//     "filter" : {
	//         ....
	//     },
	//     "boost" : 1.5
	// }

	query := make(map[string]interface{})

	params := make(map[string]interface{})
	query["constant_score"] = params

	// filter
	src, err := q.filter.Source()
	if err != nil {
		return nil, err
	}
	params["filter"] = src

	// boost
	if q.boost != nil {
		params["boost"] = *q.boost
	}

	return query, nil
}
