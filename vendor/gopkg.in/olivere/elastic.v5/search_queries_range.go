// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// RangeQuery matches documents with fields that have terms within a certain range.
//
// For details, see
// https://www.elastic.co/guide/en/elasticsearch/reference/5.2/query-dsl-range-query.html
type RangeQuery struct {
	name         string
	from         interface{}
	to           interface{}
	timeZone     string
	includeLower bool
	includeUpper bool
	boost        *float64
	queryName    string
	format       string
}

// NewRangeQuery creates and initializes a new RangeQuery.
func NewRangeQuery(name string) *RangeQuery {
	return &RangeQuery{name: name, includeLower: true, includeUpper: true}
}

// From indicates the from part of the RangeQuery.
// Use nil to indicate an unbounded from part.
func (q *RangeQuery) From(from interface{}) *RangeQuery {
	q.from = from
	return q
}

// Gt indicates a greater-than value for the from part.
// Use nil to indicate an unbounded from part.
func (q *RangeQuery) Gt(from interface{}) *RangeQuery {
	q.from = from
	q.includeLower = false
	return q
}

// Gte indicates a greater-than-or-equal value for the from part.
// Use nil to indicate an unbounded from part.
func (q *RangeQuery) Gte(from interface{}) *RangeQuery {
	q.from = from
	q.includeLower = true
	return q
}

// To indicates the to part of the RangeQuery.
// Use nil to indicate an unbounded to part.
func (q *RangeQuery) To(to interface{}) *RangeQuery {
	q.to = to
	return q
}

// Lt indicates a less-than value for the to part.
// Use nil to indicate an unbounded to part.
func (q *RangeQuery) Lt(to interface{}) *RangeQuery {
	q.to = to
	q.includeUpper = false
	return q
}

// Lte indicates a less-than-or-equal value for the to part.
// Use nil to indicate an unbounded to part.
func (q *RangeQuery) Lte(to interface{}) *RangeQuery {
	q.to = to
	q.includeUpper = true
	return q
}

// IncludeLower indicates whether the lower bound should be included or not.
// Defaults to true.
func (q *RangeQuery) IncludeLower(includeLower bool) *RangeQuery {
	q.includeLower = includeLower
	return q
}

// IncludeUpper indicates whether the upper bound should be included or not.
// Defaults to true.
func (q *RangeQuery) IncludeUpper(includeUpper bool) *RangeQuery {
	q.includeUpper = includeUpper
	return q
}

// Boost sets the boost for this query.
func (q *RangeQuery) Boost(boost float64) *RangeQuery {
	q.boost = &boost
	return q
}

// QueryName sets the query name for the filter that can be used when
// searching for matched_filters per hit.
func (q *RangeQuery) QueryName(queryName string) *RangeQuery {
	q.queryName = queryName
	return q
}

// TimeZone is used for date fields. In that case, we can adjust the
// from/to fields using a timezone.
func (q *RangeQuery) TimeZone(timeZone string) *RangeQuery {
	q.timeZone = timeZone
	return q
}

// Format is used for date fields. In that case, we can set the format
// to be used instead of the mapper format.
func (q *RangeQuery) Format(format string) *RangeQuery {
	q.format = format
	return q
}

// Source returns JSON for the query.
func (q *RangeQuery) Source() (interface{}, error) {
	source := make(map[string]interface{})

	rangeQ := make(map[string]interface{})
	source["range"] = rangeQ

	params := make(map[string]interface{})
	rangeQ[q.name] = params

	params["from"] = q.from
	params["to"] = q.to
	if q.timeZone != "" {
		params["time_zone"] = q.timeZone
	}
	if q.format != "" {
		params["format"] = q.format
	}
	if q.boost != nil {
		params["boost"] = *q.boost
	}
	params["include_lower"] = q.includeLower
	params["include_upper"] = q.includeUpper

	if q.queryName != "" {
		rangeQ["_name"] = q.queryName
	}

	return source, nil
}
