// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// PercentilesAggregation
// See: http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-aggregations-metrics-percentile-aggregation.html
type PercentilesAggregation struct {
	field           string
	script          *Script
	format          string
	subAggregations map[string]Aggregation
	meta            map[string]interface{}
	percentiles     []float64
	compression     *float64
	estimator       string
}

func NewPercentilesAggregation() *PercentilesAggregation {
	return &PercentilesAggregation{
		subAggregations: make(map[string]Aggregation),
		percentiles:     make([]float64, 0),
	}
}

func (a *PercentilesAggregation) Field(field string) *PercentilesAggregation {
	a.field = field
	return a
}

func (a *PercentilesAggregation) Script(script *Script) *PercentilesAggregation {
	a.script = script
	return a
}

func (a *PercentilesAggregation) Format(format string) *PercentilesAggregation {
	a.format = format
	return a
}

func (a *PercentilesAggregation) SubAggregation(name string, subAggregation Aggregation) *PercentilesAggregation {
	a.subAggregations[name] = subAggregation
	return a
}

// Meta sets the meta data to be included in the aggregation response.
func (a *PercentilesAggregation) Meta(metaData map[string]interface{}) *PercentilesAggregation {
	a.meta = metaData
	return a
}

func (a *PercentilesAggregation) Percentiles(percentiles ...float64) *PercentilesAggregation {
	a.percentiles = append(a.percentiles, percentiles...)
	return a
}

func (a *PercentilesAggregation) Compression(compression float64) *PercentilesAggregation {
	a.compression = &compression
	return a
}

func (a *PercentilesAggregation) Estimator(estimator string) *PercentilesAggregation {
	a.estimator = estimator
	return a
}

func (a *PercentilesAggregation) Source() (interface{}, error) {
	// Example:
	//	{
	//    "aggs" : {
	//      "load_time_outlier" : {
	//           "percentiles" : {
	//               "field" : "load_time"
	//           }
	//       }
	//    }
	//	}
	// This method returns only the
	//   { "percentiles" : { "field" : "load_time" } }
	// part.

	source := make(map[string]interface{})
	opts := make(map[string]interface{})
	source["percentiles"] = opts

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
	if a.format != "" {
		opts["format"] = a.format
	}
	if len(a.percentiles) > 0 {
		opts["percents"] = a.percentiles
	}
	if a.compression != nil {
		opts["compression"] = *a.compression
	}
	if a.estimator != "" {
		opts["estimator"] = a.estimator
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
