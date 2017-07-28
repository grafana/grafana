package elastic

type GeoHashGridAggregation struct {
	field           string
	precision       int
	size            int
	shardSize       int
	subAggregations map[string]Aggregation
	meta            map[string]interface{}
}

func NewGeoHashGridAggregation() *GeoHashGridAggregation {
	return &GeoHashGridAggregation{
		subAggregations: make(map[string]Aggregation),
		precision:       -1,
		size:            -1,
		shardSize:       -1,
	}
}

func (a *GeoHashGridAggregation) Field(field string) *GeoHashGridAggregation {
	a.field = field
	return a
}

func (a *GeoHashGridAggregation) Precision(precision int) *GeoHashGridAggregation {
	a.precision = precision
	return a
}

func (a *GeoHashGridAggregation) Size(size int) *GeoHashGridAggregation {
	a.size = size
	return a
}

func (a *GeoHashGridAggregation) ShardSize(shardSize int) *GeoHashGridAggregation {
	a.shardSize = shardSize
	return a
}

func (a *GeoHashGridAggregation) SubAggregation(name string, subAggregation Aggregation) *GeoHashGridAggregation {
	a.subAggregations[name] = subAggregation
	return a
}

func (a *GeoHashGridAggregation) Meta(metaData map[string]interface{}) *GeoHashGridAggregation {
	a.meta = metaData
	return a
}

func (a *GeoHashGridAggregation) Source() (interface{}, error) {
	// Example:
	// {
	//     "aggs": {
	//         "new_york": {
	//             "geohash_grid": {
	//                 "field": "location",
	//                 "precision": 5
	//             }
	//         }
	//     }
	// }

	source := make(map[string]interface{})
	opts := make(map[string]interface{})
	source["geohash_grid"] = opts

	if a.field != "" {
		opts["field"] = a.field
	}

	if a.precision != -1 {
		opts["precision"] = a.precision
	}

	if a.size != -1 {
		opts["size"] = a.size
	}

	if a.shardSize != -1 {
		opts["shard_size"] = a.shardSize
	}

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

	if len(a.meta) > 0 {
		source["meta"] = a.meta
	}

	return source, nil
}
