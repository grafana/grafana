// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// SliceQuery allows to partition the documents into several slices.
// It is used e.g. to slice scroll operations in Elasticsearch 5.0 or later.
// See https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-request-scroll.html#sliced-scroll
// for details.
type SliceQuery struct {
	field string
	id    *int
	max   *int
}

// NewSliceQuery creates a new SliceQuery.
func NewSliceQuery() *SliceQuery {
	return &SliceQuery{}
}

// Field is the name of the field to slice against (_uid by default).
func (s *SliceQuery) Field(field string) *SliceQuery {
	s.field = field
	return s
}

// Id is the id of the slice.
func (s *SliceQuery) Id(id int) *SliceQuery {
	s.id = &id
	return s
}

// Max is the maximum number of slices.
func (s *SliceQuery) Max(max int) *SliceQuery {
	s.max = &max
	return s
}

// Source returns the JSON body.
func (s *SliceQuery) Source() (interface{}, error) {
	m := make(map[string]interface{})
	if s.field != "" {
		m["field"] = s.field
	}
	if s.id != nil {
		m["id"] = *s.id
	}
	if s.max != nil {
		m["max"] = *s.max
	}
	return m, nil
}
