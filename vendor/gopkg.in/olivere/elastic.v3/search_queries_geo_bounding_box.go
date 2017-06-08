// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import "errors"

// GeoBoundingBoxQuery allows to filter hits based on a point location using
// a bounding box.
//
// For more details, see:
// https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-geo-bounding-box-query.html
type GeoBoundingBoxQuery struct {
	name      string
	top       *float64
	left      *float64
	bottom    *float64
	right     *float64
	typ       string
	queryName string
}

// NewGeoBoundingBoxQuery creates and initializes a new GeoBoundingBoxQuery.
func NewGeoBoundingBoxQuery(name string) *GeoBoundingBoxQuery {
	return &GeoBoundingBoxQuery{
		name: name,
	}
}

func (q *GeoBoundingBoxQuery) TopLeft(top, left float64) *GeoBoundingBoxQuery {
	q.top = &top
	q.left = &left
	return q
}

func (q *GeoBoundingBoxQuery) TopLeftFromGeoPoint(point *GeoPoint) *GeoBoundingBoxQuery {
	return q.TopLeft(point.Lat, point.Lon)
}

func (q *GeoBoundingBoxQuery) BottomRight(bottom, right float64) *GeoBoundingBoxQuery {
	q.bottom = &bottom
	q.right = &right
	return q
}

func (q *GeoBoundingBoxQuery) BottomRightFromGeoPoint(point *GeoPoint) *GeoBoundingBoxQuery {
	return q.BottomRight(point.Lat, point.Lon)
}

func (q *GeoBoundingBoxQuery) BottomLeft(bottom, left float64) *GeoBoundingBoxQuery {
	q.bottom = &bottom
	q.left = &left
	return q
}

func (q *GeoBoundingBoxQuery) BottomLeftFromGeoPoint(point *GeoPoint) *GeoBoundingBoxQuery {
	return q.BottomLeft(point.Lat, point.Lon)
}

func (q *GeoBoundingBoxQuery) TopRight(top, right float64) *GeoBoundingBoxQuery {
	q.top = &top
	q.right = &right
	return q
}

func (q *GeoBoundingBoxQuery) TopRightFromGeoPoint(point *GeoPoint) *GeoBoundingBoxQuery {
	return q.TopRight(point.Lat, point.Lon)
}

// Type sets the type of executing the geo bounding box. It can be either
// memory or indexed. It defaults to memory.
func (q *GeoBoundingBoxQuery) Type(typ string) *GeoBoundingBoxQuery {
	q.typ = typ
	return q
}

func (q *GeoBoundingBoxQuery) QueryName(queryName string) *GeoBoundingBoxQuery {
	q.queryName = queryName
	return q
}

// Source returns JSON for the function score query.
func (q *GeoBoundingBoxQuery) Source() (interface{}, error) {
	// {
	//   "geo_bbox" : {
	//     ...
	//   }
	// }

	if q.top == nil {
		return nil, errors.New("geo_bounding_box requires top latitude to be set")
	}
	if q.bottom == nil {
		return nil, errors.New("geo_bounding_box requires bottom latitude to be set")
	}
	if q.right == nil {
		return nil, errors.New("geo_bounding_box requires right longitude to be set")
	}
	if q.left == nil {
		return nil, errors.New("geo_bounding_box requires left longitude to be set")
	}

	source := make(map[string]interface{})
	params := make(map[string]interface{})
	source["geo_bbox"] = params

	box := make(map[string]interface{})
	box["top_left"] = []float64{*q.left, *q.top}
	box["bottom_right"] = []float64{*q.right, *q.bottom}
	params[q.name] = box

	if q.typ != "" {
		params["type"] = q.typ
	}
	if q.queryName != "" {
		params["_name"] = q.queryName
	}

	return source, nil
}
