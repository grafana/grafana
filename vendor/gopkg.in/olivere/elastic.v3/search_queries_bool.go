// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import "fmt"

// A bool query matches documents matching boolean
// combinations of other queries.
// For more details, see:
// http://www.elasticsearch.org/guide/reference/query-dsl/bool-query.html
type BoolQuery struct {
	Query
	mustClauses        []Query
	mustNotClauses     []Query
	filterClauses      []Query
	shouldClauses      []Query
	boost              *float64
	disableCoord       *bool
	minimumShouldMatch string
	adjustPureNegative *bool
	queryName          string
}

// Creates a new bool query.
func NewBoolQuery() *BoolQuery {
	return &BoolQuery{
		mustClauses:    make([]Query, 0),
		mustNotClauses: make([]Query, 0),
		filterClauses:  make([]Query, 0),
		shouldClauses:  make([]Query, 0),
	}
}

func (q *BoolQuery) Must(queries ...Query) *BoolQuery {
	q.mustClauses = append(q.mustClauses, queries...)
	return q
}

func (q *BoolQuery) MustNot(queries ...Query) *BoolQuery {
	q.mustNotClauses = append(q.mustNotClauses, queries...)
	return q
}

func (q *BoolQuery) Filter(filters ...Query) *BoolQuery {
	q.filterClauses = append(q.filterClauses, filters...)
	return q
}

func (q *BoolQuery) Should(queries ...Query) *BoolQuery {
	q.shouldClauses = append(q.shouldClauses, queries...)
	return q
}

func (q *BoolQuery) Boost(boost float64) *BoolQuery {
	q.boost = &boost
	return q
}

func (q *BoolQuery) DisableCoord(disableCoord bool) *BoolQuery {
	q.disableCoord = &disableCoord
	return q
}

func (q *BoolQuery) MinimumShouldMatch(minimumShouldMatch string) *BoolQuery {
	q.minimumShouldMatch = minimumShouldMatch
	return q
}

func (q *BoolQuery) MinimumNumberShouldMatch(minimumNumberShouldMatch int) *BoolQuery {
	q.minimumShouldMatch = fmt.Sprintf("%d", minimumNumberShouldMatch)
	return q
}

func (q *BoolQuery) AdjustPureNegative(adjustPureNegative bool) *BoolQuery {
	q.adjustPureNegative = &adjustPureNegative
	return q
}

func (q *BoolQuery) QueryName(queryName string) *BoolQuery {
	q.queryName = queryName
	return q
}

// Creates the query source for the bool query.
func (q *BoolQuery) Source() (interface{}, error) {
	// {
	//	"bool" : {
	//		"must" : {
	//			"term" : { "user" : "kimchy" }
	//		},
	//		"must_not" : {
	//			"range" : {
	//				"age" : { "from" : 10, "to" : 20 }
	//			}
	//		},
	//    "filter" : [
	//      ...
	//    ]
	//		"should" : [
	//			{
	//				"term" : { "tag" : "wow" }
	//			},
	//			{
	//				"term" : { "tag" : "elasticsearch" }
	//			}
	//		],
	//		"minimum_number_should_match" : 1,
	//		"boost" : 1.0
	//	}
	// }

	query := make(map[string]interface{})

	boolClause := make(map[string]interface{})
	query["bool"] = boolClause

	// must
	if len(q.mustClauses) == 1 {
		src, err := q.mustClauses[0].Source()
		if err != nil {
			return nil, err
		}
		boolClause["must"] = src
	} else if len(q.mustClauses) > 1 {
		var clauses []interface{}
		for _, subQuery := range q.mustClauses {
			src, err := subQuery.Source()
			if err != nil {
				return nil, err
			}
			clauses = append(clauses, src)
		}
		boolClause["must"] = clauses
	}

	// must_not
	if len(q.mustNotClauses) == 1 {
		src, err := q.mustNotClauses[0].Source()
		if err != nil {
			return nil, err
		}
		boolClause["must_not"] = src
	} else if len(q.mustNotClauses) > 1 {
		var clauses []interface{}
		for _, subQuery := range q.mustNotClauses {
			src, err := subQuery.Source()
			if err != nil {
				return nil, err
			}
			clauses = append(clauses, src)
		}
		boolClause["must_not"] = clauses
	}

	// filter
	if len(q.filterClauses) == 1 {
		src, err := q.filterClauses[0].Source()
		if err != nil {
			return nil, err
		}
		boolClause["filter"] = src
	} else if len(q.filterClauses) > 1 {
		var clauses []interface{}
		for _, subQuery := range q.filterClauses {
			src, err := subQuery.Source()
			if err != nil {
				return nil, err
			}
			clauses = append(clauses, src)
		}
		boolClause["filter"] = clauses
	}

	// should
	if len(q.shouldClauses) == 1 {
		src, err := q.shouldClauses[0].Source()
		if err != nil {
			return nil, err
		}
		boolClause["should"] = src
	} else if len(q.shouldClauses) > 1 {
		var clauses []interface{}
		for _, subQuery := range q.shouldClauses {
			src, err := subQuery.Source()
			if err != nil {
				return nil, err
			}
			clauses = append(clauses, src)
		}
		boolClause["should"] = clauses
	}

	if q.boost != nil {
		boolClause["boost"] = *q.boost
	}
	if q.disableCoord != nil {
		boolClause["disable_coord"] = *q.disableCoord
	}
	if q.minimumShouldMatch != "" {
		boolClause["minimum_should_match"] = q.minimumShouldMatch
	}
	if q.adjustPureNegative != nil {
		boolClause["adjust_pure_negative"] = *q.adjustPureNegative
	}
	if q.queryName != "" {
		boolClause["_name"] = q.queryName
	}

	return query, nil
}
