// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// MissingQuery returns documents that have only null values or no value
// in the original field.
//
// For details, see:
// https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-missing-query.html
type MissingQuery struct {
	name      string
	queryName string
	nullValue *bool
	existence *bool
}

// NewMissingQuery creates and initializes a new MissingQuery.
func NewMissingQuery(name string) *MissingQuery {
	return &MissingQuery{name: name}
}

// QueryName sets the query name for the query that can be used when
// searching for matched filters hit.
func (q *MissingQuery) QueryName(queryName string) *MissingQuery {
	q.queryName = queryName
	return q
}

// NullValue indicates whether the missing filter automatically includes
// fields with null value configured in the mappings. Defaults to false.
func (q *MissingQuery) NullValue(nullValue bool) *MissingQuery {
	q.nullValue = &nullValue
	return q
}

// Existence indicates whether the missing filter includes documents where
// the field doesn't exist in the docs.
func (q *MissingQuery) Existence(existence bool) *MissingQuery {
	q.existence = &existence
	return q
}

// Source returns JSON for the query.
func (q *MissingQuery) Source() (interface{}, error) {
	// {
	//   "missing" : {
	//     "field" : "..."
	//   }
	// }

	source := make(map[string]interface{})
	params := make(map[string]interface{})
	source["missing"] = params
	params["field"] = q.name
	if q.nullValue != nil {
		params["null_value"] = *q.nullValue
	}
	if q.existence != nil {
		params["existence"] = *q.existence
	}
	if q.queryName != "" {
		params["_name"] = q.queryName
	}
	return source, nil
}
