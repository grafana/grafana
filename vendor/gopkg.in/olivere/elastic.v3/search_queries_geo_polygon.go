// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// GeoPolygonQuery allows to include hits that only fall within a polygon of points.
//
// For more details, see:
// https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-geo-polygon-query.html
type GeoPolygonQuery struct {
	name      string
	points    []*GeoPoint
	queryName string
}

// NewGeoPolygonQuery creates and initializes a new GeoPolygonQuery.
func NewGeoPolygonQuery(name string) *GeoPolygonQuery {
	return &GeoPolygonQuery{
		name:   name,
		points: make([]*GeoPoint, 0),
	}
}

// AddPoint adds a point from latitude and longitude.
func (q *GeoPolygonQuery) AddPoint(lat, lon float64) *GeoPolygonQuery {
	q.points = append(q.points, GeoPointFromLatLon(lat, lon))
	return q
}

// AddGeoPoint adds a GeoPoint.
func (q *GeoPolygonQuery) AddGeoPoint(point *GeoPoint) *GeoPolygonQuery {
	q.points = append(q.points, point)
	return q
}

func (q *GeoPolygonQuery) QueryName(queryName string) *GeoPolygonQuery {
	q.queryName = queryName
	return q
}

// Source returns JSON for the function score query.
func (q *GeoPolygonQuery) Source() (interface{}, error) {
	// "geo_polygon" : {
	//  	"person.location" : {
	//         "points" : [
	//             {"lat" : 40, "lon" : -70},
	//             {"lat" : 30, "lon" : -80},
	//             {"lat" : 20, "lon" : -90}
	//         ]
	//     }
	// }
	source := make(map[string]interface{})

	params := make(map[string]interface{})
	source["geo_polygon"] = params

	polygon := make(map[string]interface{})
	params[q.name] = polygon

	var points []interface{}
	for _, point := range q.points {
		points = append(points, point.Source())
	}
	polygon["points"] = points

	if q.queryName != "" {
		params["_name"] = q.queryName
	}

	return source, nil
}
