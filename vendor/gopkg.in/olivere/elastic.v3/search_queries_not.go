// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// NotQuery filters out matched documents using a query.
//
// For details, see
// https://www.elastic.co/guide/en/elasticsearch/reference/master/query-dsl-not-query.html
type NotQuery struct {
	filter    Query
	queryName string
}

// NewNotQuery creates and initializes a new NotQuery.
func NewNotQuery(filter Query) *NotQuery {
	return &NotQuery{
		filter: filter,
	}
}

// QueryName sets the query name for the filter that can be used
// when searching for matched_filters per hit
func (q *NotQuery) QueryName(queryName string) *NotQuery {
	q.queryName = queryName
	return q
}

// Source returns JSON for the query.
func (q *NotQuery) Source() (interface{}, error) {
	source := make(map[string]interface{})
	params := make(map[string]interface{})
	source["not"] = params

	src, err := q.filter.Source()
	if err != nil {
		return nil, err
	}
	params["query"] = src
	if q.queryName != "" {
		params["_name"] = q.queryName
	}
	return source, nil
}
