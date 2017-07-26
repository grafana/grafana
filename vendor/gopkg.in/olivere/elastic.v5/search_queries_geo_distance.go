// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// GeoDistanceQuery filters documents that include only hits that exists
// within a specific distance from a geo point.
//
// For more details, see:
// https://www.elastic.co/guide/en/elasticsearch/reference/5.2/query-dsl-geo-distance-query.html
type GeoDistanceQuery struct {
	name         string
	distance     string
	lat          float64
	lon          float64
	geohash      string
	distanceType string
	optimizeBbox string
	queryName    string
}

// NewGeoDistanceQuery creates and initializes a new GeoDistanceQuery.
func NewGeoDistanceQuery(name string) *GeoDistanceQuery {
	return &GeoDistanceQuery{name: name}
}

func (q *GeoDistanceQuery) GeoPoint(point *GeoPoint) *GeoDistanceQuery {
	q.lat = point.Lat
	q.lon = point.Lon
	return q
}

func (q *GeoDistanceQuery) Point(lat, lon float64) *GeoDistanceQuery {
	q.lat = lat
	q.lon = lon
	return q
}

func (q *GeoDistanceQuery) Lat(lat float64) *GeoDistanceQuery {
	q.lat = lat
	return q
}

func (q *GeoDistanceQuery) Lon(lon float64) *GeoDistanceQuery {
	q.lon = lon
	return q
}

func (q *GeoDistanceQuery) GeoHash(geohash string) *GeoDistanceQuery {
	q.geohash = geohash
	return q
}

func (q *GeoDistanceQuery) Distance(distance string) *GeoDistanceQuery {
	q.distance = distance
	return q
}

func (q *GeoDistanceQuery) DistanceType(distanceType string) *GeoDistanceQuery {
	q.distanceType = distanceType
	return q
}

func (q *GeoDistanceQuery) OptimizeBbox(optimizeBbox string) *GeoDistanceQuery {
	q.optimizeBbox = optimizeBbox
	return q
}

func (q *GeoDistanceQuery) QueryName(queryName string) *GeoDistanceQuery {
	q.queryName = queryName
	return q
}

// Source returns JSON for the function score query.
func (q *GeoDistanceQuery) Source() (interface{}, error) {
	// {
	//   "geo_distance" : {
	//       "distance" : "200km",
	//       "pin.location" : {
	//           "lat" : 40,
	//           "lon" : -70
	//       }
	//   }
	// }

	source := make(map[string]interface{})

	params := make(map[string]interface{})

	if q.geohash != "" {
		params[q.name] = q.geohash
	} else {
		location := make(map[string]interface{})
		location["lat"] = q.lat
		location["lon"] = q.lon
		params[q.name] = location
	}

	if q.distance != "" {
		params["distance"] = q.distance
	}
	if q.distanceType != "" {
		params["distance_type"] = q.distanceType
	}
	if q.optimizeBbox != "" {
		params["optimize_bbox"] = q.optimizeBbox
	}
	if q.queryName != "" {
		params["_name"] = q.queryName
	}

	source["geo_distance"] = params

	return source, nil
}
