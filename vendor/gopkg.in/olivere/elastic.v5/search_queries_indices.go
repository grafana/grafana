// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// IndicesQuery can be used when executed across multiple indices, allowing
// to have a query that executes only when executed on an index that matches
// a specific list of indices, and another query that executes when it is
// executed on an index that does not match the listed indices.
//
// For more details, see
// https://www.elastic.co/guide/en/elasticsearch/reference/5.2/query-dsl-indices-query.html
type IndicesQuery struct {
	query            Query
	indices          []string
	noMatchQueryType string
	noMatchQuery     Query
	queryName        string
}

// NewIndicesQuery creates and initializes a new indices query.
func NewIndicesQuery(query Query, indices ...string) *IndicesQuery {
	return &IndicesQuery{
		query:   query,
		indices: indices,
	}
}

// NoMatchQuery sets the query to use when it executes on an index that
// does not match the indices provided.
func (q *IndicesQuery) NoMatchQuery(query Query) *IndicesQuery {
	q.noMatchQuery = query
	return q
}

// NoMatchQueryType sets the no match query which can be either all or none.
func (q *IndicesQuery) NoMatchQueryType(typ string) *IndicesQuery {
	q.noMatchQueryType = typ
	return q
}

// QueryName sets the query name for the filter.
func (q *IndicesQuery) QueryName(queryName string) *IndicesQuery {
	q.queryName = queryName
	return q
}

// Source returns JSON for the function score query.
func (q *IndicesQuery) Source() (interface{}, error) {
	// {
	//	 "indices" : {
	//		 "indices" : ["index1", "index2"],
	//     "query" : {
	//       "term" : { "tag" : "wow" }
	//     },
	//     "no_match_query" : {
	//       "term" : { "tag" : "kow" }
	//     }
	//	 }
	// }

	source := make(map[string]interface{})
	params := make(map[string]interface{})
	source["indices"] = params

	params["indices"] = q.indices

	src, err := q.query.Source()
	if err != nil {
		return nil, err
	}
	params["query"] = src

	if q.noMatchQuery != nil {
		src, err := q.noMatchQuery.Source()
		if err != nil {
			return nil, err
		}
		params["no_match_query"] = src
	} else if q.noMatchQueryType != "" {
		params["no_match_query"] = q.noMatchQueryType
	}
	if q.queryName != "" {
		params["_name"] = q.queryName
	}

	return source, nil
}
