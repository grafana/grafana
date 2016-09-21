// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// GeoDistanceAggregation is a multi-bucket aggregation that works on geo_point fields
// and conceptually works very similar to the range aggregation.
// The user can define a point of origin and a set of distance range buckets.
// The aggregation evaluate the distance of each document value from
// the origin point and determines the buckets it belongs to based on
// the ranges (a document belongs to a bucket if the distance between the
// document and the origin falls within the distance range of the bucket).
// See: http://www.elasticsearch.org/guide/en/elasticsearch/reference/master/search-aggregations-bucket-geodistance-aggregation.html
type GeoDistanceAggregation struct {
	field           string
	unit            string
	distanceType    string
	point           string
	ranges          []geoDistAggRange
	subAggregations map[string]Aggregation
	meta            map[string]interface{}
}

type geoDistAggRange struct {
	Key  string
	From interface{}
	To   interface{}
}

func NewGeoDistanceAggregation() *GeoDistanceAggregation {
	return &GeoDistanceAggregation{
		subAggregations: make(map[string]Aggregation),
		ranges:          make([]geoDistAggRange, 0),
	}
}

func (a *GeoDistanceAggregation) Field(field string) *GeoDistanceAggregation {
	a.field = field
	return a
}

func (a *GeoDistanceAggregation) Unit(unit string) *GeoDistanceAggregation {
	a.unit = unit
	return a
}

func (a *GeoDistanceAggregation) DistanceType(distanceType string) *GeoDistanceAggregation {
	a.distanceType = distanceType
	return a
}

func (a *GeoDistanceAggregation) Point(latLon string) *GeoDistanceAggregation {
	a.point = latLon
	return a
}

func (a *GeoDistanceAggregation) SubAggregation(name string, subAggregation Aggregation) *GeoDistanceAggregation {
	a.subAggregations[name] = subAggregation
	return a
}

// Meta sets the meta data to be included in the aggregation response.
func (a *GeoDistanceAggregation) Meta(metaData map[string]interface{}) *GeoDistanceAggregation {
	a.meta = metaData
	return a
}
func (a *GeoDistanceAggregation) AddRange(from, to interface{}) *GeoDistanceAggregation {
	a.ranges = append(a.ranges, geoDistAggRange{From: from, To: to})
	return a
}

func (a *GeoDistanceAggregation) AddRangeWithKey(key string, from, to interface{}) *GeoDistanceAggregation {
	a.ranges = append(a.ranges, geoDistAggRange{Key: key, From: from, To: to})
	return a
}

func (a *GeoDistanceAggregation) AddUnboundedTo(from float64) *GeoDistanceAggregation {
	a.ranges = append(a.ranges, geoDistAggRange{From: from, To: nil})
	return a
}

func (a *GeoDistanceAggregation) AddUnboundedToWithKey(key string, from float64) *GeoDistanceAggregation {
	a.ranges = append(a.ranges, geoDistAggRange{Key: key, From: from, To: nil})
	return a
}

func (a *GeoDistanceAggregation) AddUnboundedFrom(to float64) *GeoDistanceAggregation {
	a.ranges = append(a.ranges, geoDistAggRange{From: nil, To: to})
	return a
}

func (a *GeoDistanceAggregation) AddUnboundedFromWithKey(key string, to float64) *GeoDistanceAggregation {
	a.ranges = append(a.ranges, geoDistAggRange{Key: key, From: nil, To: to})
	return a
}

func (a *GeoDistanceAggregation) Between(from, to interface{}) *GeoDistanceAggregation {
	a.ranges = append(a.ranges, geoDistAggRange{From: from, To: to})
	return a
}

func (a *GeoDistanceAggregation) BetweenWithKey(key string, from, to interface{}) *GeoDistanceAggregation {
	a.ranges = append(a.ranges, geoDistAggRange{Key: key, From: from, To: to})
	return a
}

func (a *GeoDistanceAggregation) Source() (interface{}, error) {
	// Example:
	// {
	//    "aggs" : {
	//        "rings_around_amsterdam" : {
	//            "geo_distance" : {
	//                "field" : "location",
	//                "origin" : "52.3760, 4.894",
	//                "ranges" : [
	//                    { "to" : 100 },
	//                    { "from" : 100, "to" : 300 },
	//                    { "from" : 300 }
	//                ]
	//            }
	//        }
	//    }
	// }
	//
	// This method returns only the { "range" : { ... } } part.

	source := make(map[string]interface{})
	opts := make(map[string]interface{})
	source["geo_distance"] = opts

	if a.field != "" {
		opts["field"] = a.field
	}
	if a.unit != "" {
		opts["unit"] = a.unit
	}
	if a.distanceType != "" {
		opts["distance_type"] = a.distanceType
	}
	if a.point != "" {
		opts["origin"] = a.point
	}

	var ranges []interface{}
	for _, ent := range a.ranges {
		r := make(map[string]interface{})
		if ent.Key != "" {
			r["key"] = ent.Key
		}
		if ent.From != nil {
			switch from := ent.From.(type) {
			case int, int16, int32, int64, float32, float64:
				r["from"] = from
			case *int, *int16, *int32, *int64, *float32, *float64:
				r["from"] = from
			case string:
				r["from"] = from
			}
		}
		if ent.To != nil {
			switch to := ent.To.(type) {
			case int, int16, int32, int64, float32, float64:
				r["to"] = to
			case *int, *int16, *int32, *int64, *float32, *float64:
				r["to"] = to
			case string:
				r["to"] = to
			}
		}
		ranges = append(ranges, r)
	}
	opts["ranges"] = ranges

	// AggregationBuilder (SubAggregations)
	if len(a.subAggregations) > 0 {
		aggsMap := make(map[string]interface{})
		source["aggregations"] = aggsMap
		for name, aggregate := range a.subAggregations {
			src, err := aggregate.Source()
			if err != nil {
				return nil, err
			}
			aggsMap[name] = src
		}
	}

	// Add Meta data if available
	if len(a.meta) > 0 {
		source["meta"] = a.meta
	}

	return source, nil
}
