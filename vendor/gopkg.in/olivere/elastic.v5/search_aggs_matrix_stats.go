// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// MatrixMatrixStatsAggregation ...
// See https://www.elastic.co/guide/en/elasticsearch/reference/5.3/search-aggregations-metrics-stats-aggregation.html
// for details.
type MatrixStatsAggregation struct {
	fields          []string
	missing         interface{}
	format          string
	valueType       interface{}
	mode            string
	subAggregations map[string]Aggregation
	meta            map[string]interface{}
}

// NewMatrixStatsAggregation initializes a new MatrixStatsAggregation.
func NewMatrixStatsAggregation() *MatrixStatsAggregation {
	return &MatrixStatsAggregation{
		subAggregations: make(map[string]Aggregation),
	}
}

func (a *MatrixStatsAggregation) Fields(fields ...string) *MatrixStatsAggregation {
	a.fields = append(a.fields, fields...)
	return a
}

// Missing configures the value to use when documents miss a value.
func (a *MatrixStatsAggregation) Missing(missing interface{}) *MatrixStatsAggregation {
	a.missing = missing
	return a
}

// Mode specifies how to operate. Valid values are: sum, avg, median, min, or max.
func (a *MatrixStatsAggregation) Mode(mode string) *MatrixStatsAggregation {
	a.mode = mode
	return a
}

func (a *MatrixStatsAggregation) Format(format string) *MatrixStatsAggregation {
	a.format = format
	return a
}

func (a *MatrixStatsAggregation) ValueType(valueType interface{}) *MatrixStatsAggregation {
	a.valueType = valueType
	return a
}

func (a *MatrixStatsAggregation) SubAggregation(name string, subAggregation Aggregation) *MatrixStatsAggregation {
	a.subAggregations[name] = subAggregation
	return a
}

// Meta sets the meta data to be included in the aggregation response.
func (a *MatrixStatsAggregation) Meta(metaData map[string]interface{}) *MatrixStatsAggregation {
	a.meta = metaData
	return a
}

// Source returns the JSON to serialize into the request, or an error.
func (a *MatrixStatsAggregation) Source() (interface{}, error) {
	// Example:
	//	{
	//    "aggs" : {
	//      "matrixstats" : {
	//        "matrix_stats" : {
	//          "fields" : ["poverty", "income"],
	//          "missing": {"income": 50000},
	//          "mode": "avg",
	//          ...
	//        }
	//      }
	//    }
	//	}
	// This method returns only the { "matrix_stats" : { ... } } part.

	source := make(map[string]interface{})
	opts := make(map[string]interface{})
	source["matrix_stats"] = opts

	// MatrixStatsAggregationBuilder
	opts["fields"] = a.fields
	if a.missing != nil {
		opts["missing"] = a.missing
	}
	if a.format != "" {
		opts["format"] = a.format
	}
	if a.valueType != nil {
		opts["value_type"] = a.valueType
	}
	if a.mode != "" {
		opts["mode"] = a.mode
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
