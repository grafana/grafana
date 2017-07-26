// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// NestedAggregation is a special single bucket aggregation that enables
// aggregating nested documents.
// See: http://www.elasticsearch.org/guide/en/elasticsearch/reference/master/search-aggregations-bucket-nested-aggregation.html
type NestedAggregation struct {
	path            string
	subAggregations map[string]Aggregation
	meta            map[string]interface{}
}

func NewNestedAggregation() *NestedAggregation {
	return &NestedAggregation{
		subAggregations: make(map[string]Aggregation),
	}
}

func (a *NestedAggregation) SubAggregation(name string, subAggregation Aggregation) *NestedAggregation {
	a.subAggregations[name] = subAggregation
	return a
}

// Meta sets the meta data to be included in the aggregation response.
func (a *NestedAggregation) Meta(metaData map[string]interface{}) *NestedAggregation {
	a.meta = metaData
	return a
}

func (a *NestedAggregation) Path(path string) *NestedAggregation {
	a.path = path
	return a
}

func (a *NestedAggregation) Source() (interface{}, error) {
	// Example:
	//	{
	//     "query" : {
	//         "match" : { "name" : "led tv" }
	//     }
	//     "aggs" : {
	//         "resellers" : {
	//             "nested" : {
	//                 "path" : "resellers"
	//             },
	//             "aggs" : {
	//                 "min_price" : { "min" : { "field" : "resellers.price" } }
	//             }
	//         }
	//     }
	//	}
	// This method returns only the { "nested" : {} } part.

	source := make(map[string]interface{})
	opts := make(map[string]interface{})
	source["nested"] = opts

	opts["path"] = a.path

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
