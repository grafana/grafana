// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// PercentileRanksAggregation
// See: https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-aggregations-metrics-percentile-rank-aggregation.html
type PercentileRanksAggregation struct {
	field           string
	script          *Script
	format          string
	subAggregations map[string]Aggregation
	meta            map[string]interface{}
	values          []float64
	compression     *float64
	estimator       string
}

func NewPercentileRanksAggregation() *PercentileRanksAggregation {
	return &PercentileRanksAggregation{
		subAggregations: make(map[string]Aggregation),
		values:          make([]float64, 0),
	}
}

func (a *PercentileRanksAggregation) Field(field string) *PercentileRanksAggregation {
	a.field = field
	return a
}

func (a *PercentileRanksAggregation) Script(script *Script) *PercentileRanksAggregation {
	a.script = script
	return a
}

func (a *PercentileRanksAggregation) Format(format string) *PercentileRanksAggregation {
	a.format = format
	return a
}

func (a *PercentileRanksAggregation) SubAggregation(name string, subAggregation Aggregation) *PercentileRanksAggregation {
	a.subAggregations[name] = subAggregation
	return a
}

// Meta sets the meta data to be included in the aggregation response.
func (a *PercentileRanksAggregation) Meta(metaData map[string]interface{}) *PercentileRanksAggregation {
	a.meta = metaData
	return a
}

func (a *PercentileRanksAggregation) Values(values ...float64) *PercentileRanksAggregation {
	a.values = append(a.values, values...)
	return a
}

func (a *PercentileRanksAggregation) Compression(compression float64) *PercentileRanksAggregation {
	a.compression = &compression
	return a
}

func (a *PercentileRanksAggregation) Estimator(estimator string) *PercentileRanksAggregation {
	a.estimator = estimator
	return a
}

func (a *PercentileRanksAggregation) Source() (interface{}, error) {
	// Example:
	//	{
	//    "aggs" : {
	//      "load_time_outlier" : {
	//         "percentile_ranks" : {
	//           "field" : "load_time"
	//           "values" : [15, 30]
	//         }
	//       }
	//    }
	//	}
	// This method returns only the
	//   { "percentile_ranks" : { "field" : "load_time", "values" : [15, 30] } }
	// part.

	source := make(map[string]interface{})
	opts := make(map[string]interface{})
	source["percentile_ranks"] = opts

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
	if len(a.values) > 0 {
		opts["values"] = a.values
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
