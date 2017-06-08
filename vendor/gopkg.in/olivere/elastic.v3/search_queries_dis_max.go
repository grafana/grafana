// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// DisMaxQuery is a query that generates the union of documents produced by
// its subqueries, and that scores each document with the maximum score
// for that document as produced by any subquery, plus a tie breaking
// increment for any additional matching subqueries.
//
// For more details, see:
// https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-dis-max-query.html
type DisMaxQuery struct {
	queries    []Query
	boost      *float64
	tieBreaker *float64
	queryName  string
}

// NewDisMaxQuery creates and initializes a new dis max query.
func NewDisMaxQuery() *DisMaxQuery {
	return &DisMaxQuery{
		queries: make([]Query, 0),
	}
}

// Query adds one or more queries to the dis max query.
func (q *DisMaxQuery) Query(queries ...Query) *DisMaxQuery {
	q.queries = append(q.queries, queries...)
	return q
}

// Boost sets the boost for this query. Documents matching this query will
// (in addition to the normal weightings) have their score multiplied by
// the boost provided.
func (q *DisMaxQuery) Boost(boost float64) *DisMaxQuery {
	q.boost = &boost
	return q
}

// TieBreaker is the factor by which the score of each non-maximum disjunct
// for a document is multiplied with and added into the final score.
//
// If non-zero, the value should be small, on the order of 0.1, which says
// that 10 occurrences of word in a lower-scored field that is also in a
// higher scored field is just as good as a unique word in the lower scored
// field (i.e., one that is not in any higher scored field).
func (q *DisMaxQuery) TieBreaker(tieBreaker float64) *DisMaxQuery {
	q.tieBreaker = &tieBreaker
	return q
}

// QueryName sets the query name for the filter that can be used
// when searching for matched filters per hit.
func (q *DisMaxQuery) QueryName(queryName string) *DisMaxQuery {
	q.queryName = queryName
	return q
}

// Source returns the JSON serializable content for this query.
func (q *DisMaxQuery) Source() (interface{}, error) {
	// {
	//  "dis_max" : {
	//    "tie_breaker" : 0.7,
	//    "boost" : 1.2,
	//    "queries" : {
	//      {
	//        "term" : { "age" : 34 }
	//      },
	//      {
	//        "term" : { "age" : 35 }
	//      }
	//    ]
	//  }
	// }

	query := make(map[string]interface{})
	params := make(map[string]interface{})
	query["dis_max"] = params

	if q.tieBreaker != nil {
		params["tie_breaker"] = *q.tieBreaker
	}
	if q.boost != nil {
		params["boost"] = *q.boost
	}
	if q.queryName != "" {
		params["_name"] = q.queryName
	}

	// queries
	var clauses []interface{}
	for _, subQuery := range q.queries {
		src, err := subQuery.Source()
		if err != nil {
			return nil, err
		}
		clauses = append(clauses, src)
	}
	params["queries"] = clauses

	return query, nil
}
