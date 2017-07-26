// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// TermsLookup encapsulates the parameters needed to fetch terms.
//
// For more details, see
// https://www.elastic.co/guide/en/elasticsearch/reference/5.3/query-dsl-terms-query.html#query-dsl-terms-lookup.
type TermsLookup struct {
	index   string
	typ     string
	id      string
	path    string
	routing string
}

// NewTermsLookup creates and initializes a new TermsLookup.
func NewTermsLookup() *TermsLookup {
	t := &TermsLookup{}
	return t
}

// Index name.
func (t *TermsLookup) Index(index string) *TermsLookup {
	t.index = index
	return t
}

// Type name.
func (t *TermsLookup) Type(typ string) *TermsLookup {
	t.typ = typ
	return t
}

// Id to look up.
func (t *TermsLookup) Id(id string) *TermsLookup {
	t.id = id
	return t
}

// Path to use for lookup.
func (t *TermsLookup) Path(path string) *TermsLookup {
	t.path = path
	return t
}

// Routing value.
func (t *TermsLookup) Routing(routing string) *TermsLookup {
	t.routing = routing
	return t
}

// Source creates the JSON source of the builder.
func (t *TermsLookup) Source() (interface{}, error) {
	src := make(map[string]interface{})
	if t.index != "" {
		src["index"] = t.index
	}
	if t.typ != "" {
		src["type"] = t.typ
	}
	if t.id != "" {
		src["id"] = t.id
	}
	if t.path != "" {
		src["path"] = t.path
	}
	if t.routing != "" {
		src["routing"] = t.routing
	}
	return src, nil
}
