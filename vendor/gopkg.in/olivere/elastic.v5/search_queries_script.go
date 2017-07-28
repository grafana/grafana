// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import "errors"

// ScriptQuery allows to define scripts as filters.
//
// For details, see
// https://www.elastic.co/guide/en/elasticsearch/reference/5.2/query-dsl-script-query.html
type ScriptQuery struct {
	script    *Script
	queryName string
}

// NewScriptQuery creates and initializes a new ScriptQuery.
func NewScriptQuery(script *Script) *ScriptQuery {
	return &ScriptQuery{
		script: script,
	}
}

// QueryName sets the query name for the filter that can be used
// when searching for matched_filters per hit
func (q *ScriptQuery) QueryName(queryName string) *ScriptQuery {
	q.queryName = queryName
	return q
}

// Source returns JSON for the query.
func (q *ScriptQuery) Source() (interface{}, error) {
	if q.script == nil {
		return nil, errors.New("ScriptQuery expected a script")
	}
	source := make(map[string]interface{})
	params := make(map[string]interface{})
	source["script"] = params

	src, err := q.script.Source()
	if err != nil {
		return nil, err
	}
	params["script"] = src

	if q.queryName != "" {
		params["_name"] = q.queryName
	}
	return source, nil
}
