// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// BucketScriptAggregation is a parent pipeline aggregation which executes
// a script which can perform per bucket computations on specified metrics
// in the parent multi-bucket aggregation. The specified metric must be
// numeric and the script must return a numeric value.
//
// For more details, see
// https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-aggregations-pipeline-bucket-script-aggregation.html
type BucketScriptAggregation struct {
	format    string
	gapPolicy string
	script    *Script

	subAggregations map[string]Aggregation
	meta            map[string]interface{}
	bucketsPathsMap map[string]string
}

// NewBucketScriptAggregation creates and initializes a new BucketScriptAggregation.
func NewBucketScriptAggregation() *BucketScriptAggregation {
	return &BucketScriptAggregation{
		subAggregations: make(map[string]Aggregation),
		bucketsPathsMap: make(map[string]string),
	}
}

func (a *BucketScriptAggregation) Format(format string) *BucketScriptAggregation {
	a.format = format
	return a
}

// GapPolicy defines what should be done when a gap in the series is discovered.
// Valid values include "insert_zeros" or "skip". Default is "insert_zeros".
func (a *BucketScriptAggregation) GapPolicy(gapPolicy string) *BucketScriptAggregation {
	a.gapPolicy = gapPolicy
	return a
}

// GapInsertZeros inserts zeros for gaps in the series.
func (a *BucketScriptAggregation) GapInsertZeros() *BucketScriptAggregation {
	a.gapPolicy = "insert_zeros"
	return a
}

// GapSkip skips gaps in the series.
func (a *BucketScriptAggregation) GapSkip() *BucketScriptAggregation {
	a.gapPolicy = "skip"
	return a
}

// Script is the script to run.
func (a *BucketScriptAggregation) Script(script *Script) *BucketScriptAggregation {
	a.script = script
	return a
}

// SubAggregation adds a sub-aggregation to this aggregation.
func (a *BucketScriptAggregation) SubAggregation(name string, subAggregation Aggregation) *BucketScriptAggregation {
	a.subAggregations[name] = subAggregation
	return a
}

// Meta sets the meta data to be included in the aggregation response.
func (a *BucketScriptAggregation) Meta(metaData map[string]interface{}) *BucketScriptAggregation {
	a.meta = metaData
	return a
}

// BucketsPathsMap sets the paths to the buckets to use for this pipeline aggregator.
func (a *BucketScriptAggregation) BucketsPathsMap(bucketsPathsMap map[string]string) *BucketScriptAggregation {
	a.bucketsPathsMap = bucketsPathsMap
	return a
}

// AddBucketsPath adds a bucket path to use for this pipeline aggregator.
func (a *BucketScriptAggregation) AddBucketsPath(name, path string) *BucketScriptAggregation {
	if a.bucketsPathsMap == nil {
		a.bucketsPathsMap = make(map[string]string)
	}
	a.bucketsPathsMap[name] = path
	return a
}

func (a *BucketScriptAggregation) Source() (interface{}, error) {
	source := make(map[string]interface{})
	params := make(map[string]interface{})
	source["bucket_script"] = params

	if a.format != "" {
		params["format"] = a.format
	}
	if a.gapPolicy != "" {
		params["gap_policy"] = a.gapPolicy
	}
	if a.script != nil {
		src, err := a.script.Source()
		if err != nil {
			return nil, err
		}
		params["script"] = src
	}

	// Add buckets paths
	if len(a.bucketsPathsMap) > 0 {
		params["buckets_path"] = a.bucketsPathsMap
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
