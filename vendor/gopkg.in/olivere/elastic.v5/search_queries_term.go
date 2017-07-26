// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// TermQuery finds documents that contain the exact term specified
// in the inverted index.
//
// For details, see
// https://www.elastic.co/guide/en/elasticsearch/reference/5.2/query-dsl-term-query.html
type TermQuery struct {
	name      string
	value     interface{}
	boost     *float64
	queryName string
}

// NewTermQuery creates and initializes a new TermQuery.
func NewTermQuery(name string, value interface{}) *TermQuery {
	return &TermQuery{name: name, value: value}
}

// Boost sets the boost for this query.
func (q *TermQuery) Boost(boost float64) *TermQuery {
	q.boost = &boost
	return q
}

// QueryName sets the query name for the filter that can be used
// when searching for matched_filters per hit
func (q *TermQuery) QueryName(queryName string) *TermQuery {
	q.queryName = queryName
	return q
}

// Source returns JSON for the query.
func (q *TermQuery) Source() (interface{}, error) {
	// {"term":{"name":"value"}}
	source := make(map[string]interface{})
	tq := make(map[string]interface{})
	source["term"] = tq

	if q.boost == nil && q.queryName == "" {
		tq[q.name] = q.value
	} else {
		subQ := make(map[string]interface{})
		subQ["value"] = q.value
		if q.boost != nil {
			subQ["boost"] = *q.boost
		}
		if q.queryName != "" {
			subQ["_name"] = q.queryName
		}
		tq[q.name] = subQ
	}
	return source, nil
}
