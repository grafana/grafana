// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// TermsQuery filters documents that have fields that match any
// of the provided terms (not analyzed).
//
// For more details, see
// https://www.elastic.co/guide/en/elasticsearch/reference/5.2/query-dsl-terms-query.html
type TermsQuery struct {
	name        string
	values      []interface{}
	termsLookup *TermsLookup
	queryName   string
	boost       *float64
}

// NewTermsQuery creates and initializes a new TermsQuery.
func NewTermsQuery(name string, values ...interface{}) *TermsQuery {
	q := &TermsQuery{
		name:   name,
		values: make([]interface{}, 0),
	}
	if len(values) > 0 {
		q.values = append(q.values, values...)
	}
	return q
}

// TermsLookup adds terms lookup details to the query.
func (q *TermsQuery) TermsLookup(lookup *TermsLookup) *TermsQuery {
	q.termsLookup = lookup
	return q
}

// Boost sets the boost for this query.
func (q *TermsQuery) Boost(boost float64) *TermsQuery {
	q.boost = &boost
	return q
}

// QueryName sets the query name for the filter that can be used
// when searching for matched_filters per hit
func (q *TermsQuery) QueryName(queryName string) *TermsQuery {
	q.queryName = queryName
	return q
}

// Creates the query source for the term query.
func (q *TermsQuery) Source() (interface{}, error) {
	// {"terms":{"name":["value1","value2"]}}
	source := make(map[string]interface{})
	params := make(map[string]interface{})
	source["terms"] = params

	if q.termsLookup != nil {
		src, err := q.termsLookup.Source()
		if err != nil {
			return nil, err
		}
		params[q.name] = src
	} else {
		params[q.name] = q.values
		if q.boost != nil {
			params["boost"] = *q.boost
		}
		if q.queryName != "" {
			params["_name"] = q.queryName
		}
	}

	return source, nil
}
