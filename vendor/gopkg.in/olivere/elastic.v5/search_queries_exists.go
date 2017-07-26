// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// ExistsQuery is a query that only matches on documents that the field
// has a value in them.
//
// For more details, see:
// https://www.elastic.co/guide/en/elasticsearch/reference/5.2/query-dsl-exists-query.html
type ExistsQuery struct {
	name      string
	queryName string
}

// NewExistsQuery creates and initializes a new dis max query.
func NewExistsQuery(name string) *ExistsQuery {
	return &ExistsQuery{
		name: name,
	}
}

// QueryName sets the query name for the filter that can be used
// when searching for matched queries per hit.
func (q *ExistsQuery) QueryName(queryName string) *ExistsQuery {
	q.queryName = queryName
	return q
}

// Source returns the JSON serializable content for this query.
func (q *ExistsQuery) Source() (interface{}, error) {
	// {
	//   "exists" : {
	//     "field" : "user"
	//   }
	// }

	query := make(map[string]interface{})
	params := make(map[string]interface{})
	query["exists"] = params

	params["field"] = q.name
	if q.queryName != "" {
		params["_name"] = q.queryName
	}

	return query, nil
}
