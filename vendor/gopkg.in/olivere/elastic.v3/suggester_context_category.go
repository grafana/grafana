// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// -- SuggesterCategoryMapping --

// SuggesterCategoryMapping provides a mapping for a category context in a suggester.
// See http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/suggester-context.html#_category_mapping.
type SuggesterCategoryMapping struct {
	name          string
	fieldName     string
	defaultValues []string
}

// NewSuggesterCategoryMapping creates a new SuggesterCategoryMapping.
func NewSuggesterCategoryMapping(name string) *SuggesterCategoryMapping {
	return &SuggesterCategoryMapping{
		name:          name,
		defaultValues: make([]string, 0),
	}
}

func (q *SuggesterCategoryMapping) DefaultValues(values ...string) *SuggesterCategoryMapping {
	q.defaultValues = append(q.defaultValues, values...)
	return q
}

func (q *SuggesterCategoryMapping) FieldName(fieldName string) *SuggesterCategoryMapping {
	q.fieldName = fieldName
	return q
}

// Source returns a map that will be used to serialize the context query as JSON.
func (q *SuggesterCategoryMapping) Source() (interface{}, error) {
	source := make(map[string]interface{})

	x := make(map[string]interface{})
	source[q.name] = x

	x["type"] = "category"

	switch len(q.defaultValues) {
	case 0:
		x["default"] = q.defaultValues
	case 1:
		x["default"] = q.defaultValues[0]
	default:
		x["default"] = q.defaultValues
	}

	if q.fieldName != "" {
		x["path"] = q.fieldName
	}
	return source, nil
}

// -- SuggesterCategoryQuery --

// SuggesterCategoryQuery provides querying a category context in a suggester.
// See http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/suggester-context.html#_category_query.
type SuggesterCategoryQuery struct {
	name   string
	values []string
}

// NewSuggesterCategoryQuery creates a new SuggesterCategoryQuery.
func NewSuggesterCategoryQuery(name string, values ...string) *SuggesterCategoryQuery {
	q := &SuggesterCategoryQuery{
		name:   name,
		values: make([]string, 0),
	}
	if len(values) > 0 {
		q.values = append(q.values, values...)
	}
	return q
}

func (q *SuggesterCategoryQuery) Values(values ...string) *SuggesterCategoryQuery {
	q.values = append(q.values, values...)
	return q
}

// Source returns a map that will be used to serialize the context query as JSON.
func (q *SuggesterCategoryQuery) Source() (interface{}, error) {
	source := make(map[string]interface{})

	switch len(q.values) {
	case 0:
		source[q.name] = q.values
	case 1:
		source[q.name] = q.values[0]
	default:
		source[q.name] = q.values
	}

	return source, nil
}
