// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// HasParentQuery accepts a query and a parent type. The query is executed
// in the parent document space which is specified by the parent type.
// This query returns child documents which associated parents have matched.
// For the rest has_parent query has the same options and works in the
// same manner as has_child query.
//
// For more details, see
// https://www.elastic.co/guide/en/elasticsearch/reference/5.2/query-dsl-has-parent-query.html
type HasParentQuery struct {
	query      Query
	parentType string
	boost      *float64
	score      *bool
	queryName  string
	innerHit   *InnerHit
}

// NewHasParentQuery creates and initializes a new has_parent query.
func NewHasParentQuery(parentType string, query Query) *HasParentQuery {
	return &HasParentQuery{
		query:      query,
		parentType: parentType,
	}
}

// Boost sets the boost for this query.
func (q *HasParentQuery) Boost(boost float64) *HasParentQuery {
	q.boost = &boost
	return q
}

// Score defines if the parent score is mapped into the child documents.
func (q *HasParentQuery) Score(score bool) *HasParentQuery {
	q.score = &score
	return q
}

// QueryName specifies the query name for the filter that can be used when
// searching for matched filters per hit.
func (q *HasParentQuery) QueryName(queryName string) *HasParentQuery {
	q.queryName = queryName
	return q
}

// InnerHit sets the inner hit definition in the scope of this query and
// reusing the defined type and query.
func (q *HasParentQuery) InnerHit(innerHit *InnerHit) *HasParentQuery {
	q.innerHit = innerHit
	return q
}

// Source returns JSON for the function score query.
func (q *HasParentQuery) Source() (interface{}, error) {
	// {
	//   "has_parent" : {
	//       "parent_type" : "blog",
	//       "query" : {
	//           "term" : {
	//               "tag" : "something"
	//           }
	//       }
	//   }
	// }
	source := make(map[string]interface{})
	query := make(map[string]interface{})
	source["has_parent"] = query

	src, err := q.query.Source()
	if err != nil {
		return nil, err
	}
	query["query"] = src
	query["parent_type"] = q.parentType
	if q.boost != nil {
		query["boost"] = *q.boost
	}
	if q.score != nil {
		query["score"] = *q.score
	}
	if q.queryName != "" {
		query["_name"] = q.queryName
	}
	if q.innerHit != nil {
		src, err := q.innerHit.Source()
		if err != nil {
			return nil, err
		}
		query["inner_hits"] = src
	}
	return source, nil
}
