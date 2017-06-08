// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// HistogramAggregation is a multi-bucket values source based aggregation
// that can be applied on numeric values extracted from the documents.
// It dynamically builds fixed size (a.k.a. interval) buckets over the
// values.
// See: http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-aggregations-bucket-histogram-aggregation.html
type HistogramAggregation struct {
	field           string
	script          *Script
	missing         interface{}
	subAggregations map[string]Aggregation
	meta            map[string]interface{}

	interval          int64
	order             string
	orderAsc          bool
	minDocCount       *int64
	extendedBoundsMin *int64
	extendedBoundsMax *int64
	offset            *int64
}

func NewHistogramAggregation() *HistogramAggregation {
	return &HistogramAggregation{
		subAggregations: make(map[string]Aggregation),
	}
}

func (a *HistogramAggregation) Field(field string) *HistogramAggregation {
	a.field = field
	return a
}

func (a *HistogramAggregation) Script(script *Script) *HistogramAggregation {
	a.script = script
	return a
}

// Missing configures the value to use when documents miss a value.
func (a *HistogramAggregation) Missing(missing interface{}) *HistogramAggregation {
	a.missing = missing
	return a
}

func (a *HistogramAggregation) SubAggregation(name string, subAggregation Aggregation) *HistogramAggregation {
	a.subAggregations[name] = subAggregation
	return a
}

// Meta sets the meta data to be included in the aggregation response.
func (a *HistogramAggregation) Meta(metaData map[string]interface{}) *HistogramAggregation {
	a.meta = metaData
	return a
}

func (a *HistogramAggregation) Interval(interval int64) *HistogramAggregation {
	a.interval = interval
	return a
}

// Order specifies the sort order. Valid values for order are:
// "_key", "_count", a sub-aggregation name, or a sub-aggregation name
// with a metric.
func (a *HistogramAggregation) Order(order string, asc bool) *HistogramAggregation {
	a.order = order
	a.orderAsc = asc
	return a
}

func (a *HistogramAggregation) OrderByCount(asc bool) *HistogramAggregation {
	// "order" : { "_count" : "asc" }
	a.order = "_count"
	a.orderAsc = asc
	return a
}

func (a *HistogramAggregation) OrderByCountAsc() *HistogramAggregation {
	return a.OrderByCount(true)
}

func (a *HistogramAggregation) OrderByCountDesc() *HistogramAggregation {
	return a.OrderByCount(false)
}

func (a *HistogramAggregation) OrderByKey(asc bool) *HistogramAggregation {
	// "order" : { "_key" : "asc" }
	a.order = "_key"
	a.orderAsc = asc
	return a
}

func (a *HistogramAggregation) OrderByKeyAsc() *HistogramAggregation {
	return a.OrderByKey(true)
}

func (a *HistogramAggregation) OrderByKeyDesc() *HistogramAggregation {
	return a.OrderByKey(false)
}

// OrderByAggregation creates a bucket ordering strategy which sorts buckets
// based on a single-valued calc get.
func (a *HistogramAggregation) OrderByAggregation(aggName string, asc bool) *HistogramAggregation {
	// {
	//     "aggs" : {
	//         "genders" : {
	//             "terms" : {
	//                 "field" : "gender",
	//                 "order" : { "avg_height" : "desc" }
	//             },
	//             "aggs" : {
	//                 "avg_height" : { "avg" : { "field" : "height" } }
	//             }
	//         }
	//     }
	// }
	a.order = aggName
	a.orderAsc = asc
	return a
}

// OrderByAggregationAndMetric creates a bucket ordering strategy which
// sorts buckets based on a multi-valued calc get.
func (a *HistogramAggregation) OrderByAggregationAndMetric(aggName, metric string, asc bool) *HistogramAggregation {
	// {
	//     "aggs" : {
	//         "genders" : {
	//             "terms" : {
	//                 "field" : "gender",
	//                 "order" : { "height_stats.avg" : "desc" }
	//             },
	//             "aggs" : {
	//                 "height_stats" : { "stats" : { "field" : "height" } }
	//             }
	//         }
	//     }
	// }
	a.order = aggName + "." + metric
	a.orderAsc = asc
	return a
}

func (a *HistogramAggregation) MinDocCount(minDocCount int64) *HistogramAggregation {
	a.minDocCount = &minDocCount
	return a
}

func (a *HistogramAggregation) ExtendedBounds(min, max int64) *HistogramAggregation {
	a.extendedBoundsMin = &min
	a.extendedBoundsMax = &max
	return a
}

func (a *HistogramAggregation) ExtendedBoundsMin(min int64) *HistogramAggregation {
	a.extendedBoundsMin = &min
	return a
}

func (a *HistogramAggregation) ExtendedBoundsMax(max int64) *HistogramAggregation {
	a.extendedBoundsMax = &max
	return a
}

func (a *HistogramAggregation) Offset(offset int64) *HistogramAggregation {
	a.offset = &offset
	return a
}

func (a *HistogramAggregation) Source() (interface{}, error) {
	// Example:
	// {
	//     "aggs" : {
	//         "prices" : {
	//             "histogram" : {
	//                 "field" : "price",
	//                 "interval" : 50
	//             }
	//         }
	//     }
	// }
	//
	// This method returns only the { "histogram" : { ... } } part.

	source := make(map[string]interface{})
	opts := make(map[string]interface{})
	source["histogram"] = opts

	// ValuesSourceAggregationBuilder
	if a.field != "" {
		opts["field"] = a.field
	}
	if a.script != nil {
		src, err := a.script.Source()
		if err != nil {
			return nil, err
		}
		opts["script"] = src
	}
	if a.missing != nil {
		opts["missing"] = a.missing
	}

	opts["interval"] = a.interval
	if a.order != "" {
		o := make(map[string]interface{})
		if a.orderAsc {
			o[a.order] = "asc"
		} else {
			o[a.order] = "desc"
		}
		opts["order"] = o
	}
	if a.offset != nil {
		opts["offset"] = *a.offset
	}
	if a.minDocCount != nil {
		opts["min_doc_count"] = *a.minDocCount
	}
	if a.extendedBoundsMin != nil || a.extendedBoundsMax != nil {
		bounds := make(map[string]interface{})
		if a.extendedBoundsMin != nil {
			bounds["min"] = a.extendedBoundsMin
		}
		if a.extendedBoundsMax != nil {
			bounds["max"] = a.extendedBoundsMax
		}
		opts["extended_bounds"] = bounds
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

	// Add Meta data if available
	if len(a.meta) > 0 {
		source["meta"] = a.meta
	}

	return source, nil
}
