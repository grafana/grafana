// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// DerivativeAggregation is a parent pipeline aggregation which calculates
// the derivative of a specified metric in a parent histogram (or date_histogram)
// aggregation. The specified metric must be numeric and the enclosing
// histogram must have min_doc_count set to 0 (default for histogram aggregations).
//
// For more details, see
// https://www.elastic.co/guide/en/elasticsearch/reference/current/search-aggregations-pipeline-derivative-aggregation.html
type DerivativeAggregation struct {
	format    string
	gapPolicy string
	unit      string

	subAggregations map[string]Aggregation
	meta            map[string]interface{}
	bucketsPaths    []string
}

// NewDerivativeAggregation creates and initializes a new DerivativeAggregation.
func NewDerivativeAggregation() *DerivativeAggregation {
	return &DerivativeAggregation{
		subAggregations: make(map[string]Aggregation),
		bucketsPaths:    make([]string, 0),
	}
}

func (a *DerivativeAggregation) Format(format string) *DerivativeAggregation {
	a.format = format
	return a
}

// GapPolicy defines what should be done when a gap in the series is discovered.
// Valid values include "insert_zeros" or "skip". Default is "insert_zeros".
func (a *DerivativeAggregation) GapPolicy(gapPolicy string) *DerivativeAggregation {
	a.gapPolicy = gapPolicy
	return a
}

// GapInsertZeros inserts zeros for gaps in the series.
func (a *DerivativeAggregation) GapInsertZeros() *DerivativeAggregation {
	a.gapPolicy = "insert_zeros"
	return a
}

// GapSkip skips gaps in the series.
func (a *DerivativeAggregation) GapSkip() *DerivativeAggregation {
	a.gapPolicy = "skip"
	return a
}

// Unit sets the unit provided, e.g. "1d" or "1y".
// It is only useful when calculating the derivative using a date_histogram.
func (a *DerivativeAggregation) Unit(unit string) *DerivativeAggregation {
	a.unit = unit
	return a
}

// SubAggregation adds a sub-aggregation to this aggregation.
func (a *DerivativeAggregation) SubAggregation(name string, subAggregation Aggregation) *DerivativeAggregation {
	a.subAggregations[name] = subAggregation
	return a
}

// Meta sets the meta data to be included in the aggregation response.
func (a *DerivativeAggregation) Meta(metaData map[string]interface{}) *DerivativeAggregation {
	a.meta = metaData
	return a
}

// BucketsPath sets the paths to the buckets to use for this pipeline aggregator.
func (a *DerivativeAggregation) BucketsPath(bucketsPaths ...string) *DerivativeAggregation {
	a.bucketsPaths = append(a.bucketsPaths, bucketsPaths...)
	return a
}

func (a *DerivativeAggregation) Source() (interface{}, error) {
	source := make(map[string]interface{})
	params := make(map[string]interface{})
	source["derivative"] = params

	if a.format != "" {
		params["format"] = a.format
	}
	if a.gapPolicy != "" {
		params["gap_policy"] = a.gapPolicy
	}
	if a.unit != "" {
		params["unit"] = a.unit
	}

	// Add buckets paths
	switch len(a.bucketsPaths) {
	case 0:
	case 1:
		params["buckets_path"] = a.bucketsPaths[0]
	default:
		params["buckets_path"] = a.bucketsPaths
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
