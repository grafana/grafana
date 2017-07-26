// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// -- SuggesterGeoMapping --

// SuggesterGeoMapping provides a mapping for a geolocation context in a suggester.
// See http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/suggester-context.html#_geo_location_mapping.
type SuggesterGeoMapping struct {
	name             string
	defaultLocations []*GeoPoint
	precision        []string
	neighbors        *bool
	fieldName        string
}

// NewSuggesterGeoMapping creates a new SuggesterGeoMapping.
func NewSuggesterGeoMapping(name string) *SuggesterGeoMapping {
	return &SuggesterGeoMapping{
		name:             name,
		defaultLocations: make([]*GeoPoint, 0),
		precision:        make([]string, 0),
	}
}

func (q *SuggesterGeoMapping) DefaultLocations(locations ...*GeoPoint) *SuggesterGeoMapping {
	q.defaultLocations = append(q.defaultLocations, locations...)
	return q
}

func (q *SuggesterGeoMapping) Precision(precision ...string) *SuggesterGeoMapping {
	q.precision = append(q.precision, precision...)
	return q
}

func (q *SuggesterGeoMapping) Neighbors(neighbors bool) *SuggesterGeoMapping {
	q.neighbors = &neighbors
	return q
}

func (q *SuggesterGeoMapping) FieldName(fieldName string) *SuggesterGeoMapping {
	q.fieldName = fieldName
	return q
}

// Source returns a map that will be used to serialize the context query as JSON.
func (q *SuggesterGeoMapping) Source() (interface{}, error) {
	source := make(map[string]interface{})

	x := make(map[string]interface{})
	source[q.name] = x

	x["type"] = "geo"

	if len(q.precision) > 0 {
		x["precision"] = q.precision
	}
	if q.neighbors != nil {
		x["neighbors"] = *q.neighbors
	}

	switch len(q.defaultLocations) {
	case 0:
	case 1:
		x["default"] = q.defaultLocations[0].Source()
	default:
		var arr []interface{}
		for _, p := range q.defaultLocations {
			arr = append(arr, p.Source())
		}
		x["default"] = arr
	}

	if q.fieldName != "" {
		x["path"] = q.fieldName
	}
	return source, nil
}

// -- SuggesterGeoQuery --

// SuggesterGeoQuery provides querying a geolocation context in a suggester.
// See http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/suggester-context.html#_geo_location_query
type SuggesterGeoQuery struct {
	name      string
	location  *GeoPoint
	precision []string
}

// NewSuggesterGeoQuery creates a new SuggesterGeoQuery.
func NewSuggesterGeoQuery(name string, location *GeoPoint) *SuggesterGeoQuery {
	return &SuggesterGeoQuery{
		name:      name,
		location:  location,
		precision: make([]string, 0),
	}
}

func (q *SuggesterGeoQuery) Precision(precision ...string) *SuggesterGeoQuery {
	q.precision = append(q.precision, precision...)
	return q
}

// Source returns a map that will be used to serialize the context query as JSON.
func (q *SuggesterGeoQuery) Source() (interface{}, error) {
	source := make(map[string]interface{})

	if len(q.precision) == 0 {
		if q.location != nil {
			source[q.name] = q.location.Source()
		}
	} else {
		x := make(map[string]interface{})
		source[q.name] = x

		if q.location != nil {
			x["value"] = q.location.Source()
		}

		switch len(q.precision) {
		case 0:
		case 1:
			x["precision"] = q.precision[0]
		default:
			x["precision"] = q.precision
		}
	}

	return source, nil
}
