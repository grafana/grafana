// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"net/url"
	"strings"
)

// FetchSourceContext enables source filtering, i.e. it allows control
// over how the _source field is returned with every hit. It is used
// with various endpoints, e.g. when searching for documents, retrieving
// individual documents, or even updating documents.
//
// See https://www.elastic.co/guide/en/elasticsearch/reference/5.5/search-request-source-filtering.html
// for details.
type FetchSourceContext struct {
	fetchSource bool
	includes    []string
	excludes    []string
}

// NewFetchSourceContext returns a new FetchSourceContext.
func NewFetchSourceContext(fetchSource bool) *FetchSourceContext {
	return &FetchSourceContext{
		fetchSource: fetchSource,
		includes:    make([]string, 0),
		excludes:    make([]string, 0),
	}
}

// FetchSource indicates whether to return the _source.
func (fsc *FetchSourceContext) FetchSource() bool {
	return fsc.fetchSource
}

// SetFetchSource specifies whether to return the _source.
func (fsc *FetchSourceContext) SetFetchSource(fetchSource bool) {
	fsc.fetchSource = fetchSource
}

// Include indicates to return specific parts of the _source.
// Wildcards are allowed here.
func (fsc *FetchSourceContext) Include(includes ...string) *FetchSourceContext {
	fsc.includes = append(fsc.includes, includes...)
	return fsc
}

// Exclude indicates to exclude specific parts of the _source.
// Wildcards are allowed here.
func (fsc *FetchSourceContext) Exclude(excludes ...string) *FetchSourceContext {
	fsc.excludes = append(fsc.excludes, excludes...)
	return fsc
}

// Source returns the JSON-serializable data to be used in a body.
func (fsc *FetchSourceContext) Source() (interface{}, error) {
	if !fsc.fetchSource {
		return false, nil
	}
	if len(fsc.includes) == 0 && len(fsc.excludes) == 0 {
		return true, nil
	}
	src := make(map[string]interface{})
	if len(fsc.includes) > 0 {
		src["includes"] = fsc.includes
	}
	if len(fsc.excludes) > 0 {
		src["excludes"] = fsc.excludes
	}
	return src, nil
}

// Query returns the parameters in a form suitable for a URL query string.
func (fsc *FetchSourceContext) Query() url.Values {
	params := url.Values{}
	if fsc.fetchSource {
		if len(fsc.includes) > 0 {
			params.Add("_source_include", strings.Join(fsc.includes, ","))
		}
		if len(fsc.excludes) > 0 {
			params.Add("_source_exclude", strings.Join(fsc.excludes, ","))
		}
	} else {
		params.Add("_source", "false")
	}
	return params
}
