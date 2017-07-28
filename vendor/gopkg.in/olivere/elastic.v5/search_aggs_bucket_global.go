// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// GlobalAggregation defines a single bucket of all the documents within
// the search execution context. This context is defined by the indices
// and the document types you’re searching on, but is not influenced
// by the search query itself.
// See: https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-aggregations-bucket-global-aggregation.html
type GlobalAggregation struct {
	subAggregations map[string]Aggregation
	meta            map[string]interface{}
}

func NewGlobalAggregation() *GlobalAggregation {
	return &GlobalAggregation{
		subAggregations: make(map[string]Aggregation),
	}
}

func (a *GlobalAggregation) SubAggregation(name string, subAggregation Aggregation) *GlobalAggregation {
	a.subAggregations[name] = subAggregation
	return a
}

// Meta sets the meta data to be included in the aggregation response.
func (a *GlobalAggregation) Meta(metaData map[string]interface{}) *GlobalAggregation {
	a.meta = metaData
	return a
}

func (a *GlobalAggregation) Source() (interface{}, error) {
	// Example:
	//	{
	//    "aggs" : {
	//         "all_products" : {
	//             "global" : {},
	//             "aggs" : {
	//                 "avg_price" : { "avg" : { "field" : "price" } }
	//             }
	//         }
	//    }
	//	}
	// This method returns only the { "global" : {} } part.

	source := make(map[string]interface{})
	opts := make(map[string]interface{})
	source["global"] = opts

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
