// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// -- SuggesterCategoryMapping --

// SuggesterCategoryMapping provides a mapping for a category context in a suggester.
// See https://www.elastic.co/guide/en/elasticsearch/reference/5.2/suggester-context.html#_category_mapping.
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
// See https://www.elastic.co/guide/en/elasticsearch/reference/5.2/suggester-context.html#_category_query.
type SuggesterCategoryQuery struct {
	name   string
	values map[string]*int
}

// NewSuggesterCategoryQuery creates a new SuggesterCategoryQuery.
func NewSuggesterCategoryQuery(name string, values ...string) *SuggesterCategoryQuery {
	q := &SuggesterCategoryQuery{
		name:   name,
		values: make(map[string]*int),
	}

	if len(values) > 0 {
		q.Values(values...)
	}
	return q
}

func (q *SuggesterCategoryQuery) Value(val string) *SuggesterCategoryQuery {
	q.values[val] = nil
	return q
}

func (q *SuggesterCategoryQuery) ValueWithBoost(val string, boost int) *SuggesterCategoryQuery {
	q.values[val] = &boost
	return q
}

func (q *SuggesterCategoryQuery) Values(values ...string) *SuggesterCategoryQuery {
	for _, val := range values {
		q.values[val] = nil
	}
	return q
}

// Source returns a map that will be used to serialize the context query as JSON.
func (q *SuggesterCategoryQuery) Source() (interface{}, error) {
	source := make(map[string]interface{})

	switch len(q.values) {
	case 0:
		source[q.name] = make([]string, 0)
	default:
		contexts := make([]interface{}, 0)
		for val, boost := range q.values {
			context := make(map[string]interface{})
			context["context"] = val
			if boost != nil {
				context["boost"] = *boost
			}
			contexts = append(contexts, context)
		}
		source[q.name] = contexts
	}

	return source, nil
}
