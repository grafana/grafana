// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// RegexpQuery allows you to use regular expression term queries.
//
// For more details, see
// https://www.elastic.co/guide/en/elasticsearch/reference/5.2/query-dsl-regexp-query.html
type RegexpQuery struct {
	name                  string
	regexp                string
	flags                 string
	boost                 *float64
	rewrite               string
	queryName             string
	maxDeterminizedStates *int
}

// NewRegexpQuery creates and initializes a new RegexpQuery.
func NewRegexpQuery(name string, regexp string) *RegexpQuery {
	return &RegexpQuery{name: name, regexp: regexp}
}

// Flags sets the regexp flags.
func (q *RegexpQuery) Flags(flags string) *RegexpQuery {
	q.flags = flags
	return q
}

// MaxDeterminizedStates protects against complex regular expressions.
func (q *RegexpQuery) MaxDeterminizedStates(maxDeterminizedStates int) *RegexpQuery {
	q.maxDeterminizedStates = &maxDeterminizedStates
	return q
}

// Boost sets the boost for this query.
func (q *RegexpQuery) Boost(boost float64) *RegexpQuery {
	q.boost = &boost
	return q
}

func (q *RegexpQuery) Rewrite(rewrite string) *RegexpQuery {
	q.rewrite = rewrite
	return q
}

// QueryName sets the query name for the filter that can be used
// when searching for matched_filters per hit
func (q *RegexpQuery) QueryName(queryName string) *RegexpQuery {
	q.queryName = queryName
	return q
}

// Source returns the JSON-serializable query data.
func (q *RegexpQuery) Source() (interface{}, error) {
	source := make(map[string]interface{})
	query := make(map[string]interface{})
	source["regexp"] = query

	x := make(map[string]interface{})
	x["value"] = q.regexp
	if q.flags != "" {
		x["flags"] = q.flags
	}
	if q.maxDeterminizedStates != nil {
		x["max_determinized_states"] = *q.maxDeterminizedStates
	}
	if q.boost != nil {
		x["boost"] = *q.boost
	}
	if q.rewrite != "" {
		x["rewrite"] = q.rewrite
	}
	if q.queryName != "" {
		x["name"] = q.queryName
	}
	query[q.name] = x

	return source, nil
}
