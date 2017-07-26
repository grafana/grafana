// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// SamplerAggregation is a filtering aggregation used to limit any
// sub aggregations' processing to a sample of the top-scoring documents.
// Optionally, diversity settings can be used to limit the number of matches
// that share a common value such as an "author".
//
// See: https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-aggregations-bucket-sampler-aggregation.html
type SamplerAggregation struct {
	subAggregations map[string]Aggregation
	meta            map[string]interface{}

	shardSize       int
	maxDocsPerValue int
	executionHint   string
}

func NewSamplerAggregation() *SamplerAggregation {
	return &SamplerAggregation{
		shardSize:       -1,
		maxDocsPerValue: -1,
		subAggregations: make(map[string]Aggregation),
	}
}

func (a *SamplerAggregation) SubAggregation(name string, subAggregation Aggregation) *SamplerAggregation {
	a.subAggregations[name] = subAggregation
	return a
}

// Meta sets the meta data to be included in the aggregation response.
func (a *SamplerAggregation) Meta(metaData map[string]interface{}) *SamplerAggregation {
	a.meta = metaData
	return a
}

// ShardSize sets the maximum number of docs returned from each shard.
func (a *SamplerAggregation) ShardSize(shardSize int) *SamplerAggregation {
	a.shardSize = shardSize
	return a
}

func (a *SamplerAggregation) MaxDocsPerValue(maxDocsPerValue int) *SamplerAggregation {
	a.maxDocsPerValue = maxDocsPerValue
	return a
}

func (a *SamplerAggregation) ExecutionHint(hint string) *SamplerAggregation {
	a.executionHint = hint
	return a
}

func (a *SamplerAggregation) Source() (interface{}, error) {
	// Example:
	// {
	//     "aggs" : {
	//         "sample" : {
	//             "sampler" : {
	//                 "shard_size" : 200
	//             },
	// 						 "aggs": {
	//                 "keywords": {
	//                     "significant_terms": {
	//                         "field": "text"
	//                      }
	//                 }
	//             }
	//         }
	//     }
	// }
	//
	// This method returns only the { "sampler" : { ... } } part.

	source := make(map[string]interface{})
	opts := make(map[string]interface{})
	source["sampler"] = opts

	if a.shardSize >= 0 {
		opts["shard_size"] = a.shardSize
	}
	if a.maxDocsPerValue >= 0 {
		opts["max_docs_per_value"] = a.maxDocsPerValue
	}
	if a.executionHint != "" {
		opts["execution_hint"] = a.executionHint
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
