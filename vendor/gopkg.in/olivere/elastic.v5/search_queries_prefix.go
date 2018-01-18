// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// PrefixQuery matches documents that have fields containing terms
// with a specified prefix (not analyzed).
//
// For more details, see
// https://www.elastic.co/guide/en/elasticsearch/reference/5.2/query-dsl-prefix-query.html
type PrefixQuery struct {
	name      string
	prefix    string
	boost     *float64
	rewrite   string
	queryName string
}

// NewPrefixQuery creates and initializes a new PrefixQuery.
func NewPrefixQuery(name string, prefix string) *PrefixQuery {
	return &PrefixQuery{name: name, prefix: prefix}
}

// Boost sets the boost for this query.
func (q *PrefixQuery) Boost(boost float64) *PrefixQuery {
	q.boost = &boost
	return q
}

func (q *PrefixQuery) Rewrite(rewrite string) *PrefixQuery {
	q.rewrite = rewrite
	return q
}

// QueryName sets the query name for the filter that can be used when
// searching for matched_filters per hit.
func (q *PrefixQuery) QueryName(queryName string) *PrefixQuery {
	q.queryName = queryName
	return q
}

// Source returns JSON for the query.
func (q *PrefixQuery) Source() (interface{}, error) {
	source := make(map[string]interface{})
	query := make(map[string]interface{})
	source["prefix"] = query

	if q.boost == nil && q.rewrite == "" && q.queryName == "" {
		query[q.name] = q.prefix
	} else {
		subQuery := make(map[string]interface{})
		subQuery["value"] = q.prefix
		if q.boost != nil {
			subQuery["boost"] = *q.boost
		}
		if q.rewrite != "" {
			subQuery["rewrite"] = q.rewrite
		}
		if q.queryName != "" {
			subQuery["_name"] = q.queryName
		}
		query[q.name] = subQuery
	}

	return source, nil
}
