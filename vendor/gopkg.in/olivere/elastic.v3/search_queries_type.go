// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// TypeQuery filters documents matching the provided document / mapping type.
//
// For details, see:
// https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-type-query.html
type TypeQuery struct {
	typ string
}

func NewTypeQuery(typ string) *TypeQuery {
	return &TypeQuery{typ: typ}
}

// Source returns JSON for the query.
func (q *TypeQuery) Source() (interface{}, error) {
	source := make(map[string]interface{})
	params := make(map[string]interface{})
	source["type"] = params
	params["value"] = q.typ
	return source, nil
}
