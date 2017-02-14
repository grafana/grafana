// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// HasChildQuery accepts a query and the child type to run against, and results
// in parent documents that have child docs matching the query.
//
// For more details, see
// https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-has-child-query.html
type HasChildQuery struct {
	query              Query
	childType          string
	boost              *float64
	scoreType          string
	minChildren        *int
	maxChildren        *int
	shortCircuitCutoff *int
	queryName          string
	innerHit           *InnerHit
}

// NewHasChildQuery creates and initializes a new has_child query.
func NewHasChildQuery(childType string, query Query) *HasChildQuery {
	return &HasChildQuery{
		query:     query,
		childType: childType,
	}
}

// Boost sets the boost for this query.
func (q *HasChildQuery) Boost(boost float64) *HasChildQuery {
	q.boost = &boost
	return q
}

// ScoreType defines how the scores from the matching child documents
// are mapped into the parent document.
func (q *HasChildQuery) ScoreType(scoreType string) *HasChildQuery {
	q.scoreType = scoreType
	return q
}

// MinChildren defines the minimum number of children that are required
// to match for the parent to be considered a match.
func (q *HasChildQuery) MinChildren(minChildren int) *HasChildQuery {
	q.minChildren = &minChildren
	return q
}

// MaxChildren defines the maximum number of children that are required
// to match for the parent to be considered a match.
func (q *HasChildQuery) MaxChildren(maxChildren int) *HasChildQuery {
	q.maxChildren = &maxChildren
	return q
}

// ShortCircuitCutoff configures what cut off point only to evaluate
// parent documents that contain the matching parent id terms instead
// of evaluating all parent docs.
func (q *HasChildQuery) ShortCircuitCutoff(shortCircuitCutoff int) *HasChildQuery {
	q.shortCircuitCutoff = &shortCircuitCutoff
	return q
}

// QueryName specifies the query name for the filter that can be used when
// searching for matched filters per hit.
func (q *HasChildQuery) QueryName(queryName string) *HasChildQuery {
	q.queryName = queryName
	return q
}

// InnerHit sets the inner hit definition in the scope of this query and
// reusing the defined type and query.
func (q *HasChildQuery) InnerHit(innerHit *InnerHit) *HasChildQuery {
	q.innerHit = innerHit
	return q
}

// Source returns JSON for the function score query.
func (q *HasChildQuery) Source() (interface{}, error) {
	// {
	//   "has_child" : {
	//       "type" : "blog_tag",
	//       "query" : {
	//           "term" : {
	//               "tag" : "something"
	//           }
	//       }
	//   }
	// }
	source := make(map[string]interface{})
	query := make(map[string]interface{})
	source["has_child"] = query

	src, err := q.query.Source()
	if err != nil {
		return nil, err
	}
	query["query"] = src
	query["type"] = q.childType
	if q.boost != nil {
		query["boost"] = *q.boost
	}
	if q.scoreType != "" {
		query["score_type"] = q.scoreType
	}
	if q.minChildren != nil {
		query["min_children"] = *q.minChildren
	}
	if q.maxChildren != nil {
		query["max_children"] = *q.maxChildren
	}
	if q.shortCircuitCutoff != nil {
		query["short_circuit_cutoff"] = *q.shortCircuitCutoff
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
