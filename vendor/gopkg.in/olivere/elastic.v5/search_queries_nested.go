// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// NestedQuery allows to query nested objects / docs.
// The query is executed against the nested objects / docs as if they were
// indexed as separate docs (they are, internally) and resulting in the
// root parent doc (or parent nested mapping).
//
// For more details, see
// https://www.elastic.co/guide/en/elasticsearch/reference/5.2/query-dsl-nested-query.html
type NestedQuery struct {
	query          Query
	path           string
	scoreMode      string
	boost          *float64
	queryName      string
	innerHit       *InnerHit
	ignoreUnmapped *bool
}

// NewNestedQuery creates and initializes a new NestedQuery.
func NewNestedQuery(path string, query Query) *NestedQuery {
	return &NestedQuery{path: path, query: query}
}

// ScoreMode specifies the score mode.
func (q *NestedQuery) ScoreMode(scoreMode string) *NestedQuery {
	q.scoreMode = scoreMode
	return q
}

// Boost sets the boost for this query.
func (q *NestedQuery) Boost(boost float64) *NestedQuery {
	q.boost = &boost
	return q
}

// QueryName sets the query name for the filter that can be used
// when searching for matched_filters per hit
func (q *NestedQuery) QueryName(queryName string) *NestedQuery {
	q.queryName = queryName
	return q
}

// InnerHit sets the inner hit definition in the scope of this nested query
// and reusing the defined path and query.
func (q *NestedQuery) InnerHit(innerHit *InnerHit) *NestedQuery {
	q.innerHit = innerHit
	return q
}

// IgnoreUnmapped sets the ignore_unmapped option for the filter that ignores
// unmapped nested fields
func (q *NestedQuery) IgnoreUnmapped(value bool) *NestedQuery {
	q.ignoreUnmapped = &value
	return q
}

// Source returns JSON for the query.
func (q *NestedQuery) Source() (interface{}, error) {
	query := make(map[string]interface{})
	nq := make(map[string]interface{})
	query["nested"] = nq

	src, err := q.query.Source()
	if err != nil {
		return nil, err
	}
	nq["query"] = src

	nq["path"] = q.path

	if q.scoreMode != "" {
		nq["score_mode"] = q.scoreMode
	}
	if q.boost != nil {
		nq["boost"] = *q.boost
	}
	if q.queryName != "" {
		nq["_name"] = q.queryName
	}
	if q.ignoreUnmapped != nil {
		nq["ignore_unmapped"] = *q.ignoreUnmapped
	}
	if q.innerHit != nil {
		src, err := q.innerHit.Source()
		if err != nil {
			return nil, err
		}
		nq["inner_hits"] = src
	}
	return query, nil
}
