// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// ReverseNestedAggregation defines a special single bucket aggregation
// that enables aggregating on parent docs from nested documents.
// Effectively this aggregation can break out of the nested block
// structure and link to other nested structures or the root document,
// which allows nesting other aggregations that aren’t part of
// the nested object in a nested aggregation.
//
// See: https://www.elastic.co/guide/en/elasticsearch/reference/current/search-aggregations-bucket-reverse-nested-aggregation.html
type ReverseNestedAggregation struct {
	path            string
	subAggregations map[string]Aggregation
	meta            map[string]interface{}
}

// NewReverseNestedAggregation initializes a new ReverseNestedAggregation
// bucket aggregation.
func NewReverseNestedAggregation() *ReverseNestedAggregation {
	return &ReverseNestedAggregation{
		subAggregations: make(map[string]Aggregation),
	}
}

// Path set the path to use for this nested aggregation. The path must match
// the path to a nested object in the mappings. If it is not specified
// then this aggregation will go back to the root document.
func (a *ReverseNestedAggregation) Path(path string) *ReverseNestedAggregation {
	a.path = path
	return a
}

func (a *ReverseNestedAggregation) SubAggregation(name string, subAggregation Aggregation) *ReverseNestedAggregation {
	a.subAggregations[name] = subAggregation
	return a
}

// Meta sets the meta data to be included in the aggregation response.
func (a *ReverseNestedAggregation) Meta(metaData map[string]interface{}) *ReverseNestedAggregation {
	a.meta = metaData
	return a
}

func (a *ReverseNestedAggregation) Source() (interface{}, error) {
	// Example:
	//	{
	//    "aggs" : {
	//      "reverse_nested" : {
	//        "path": "..."
	//      }
	//    }
	//	}
	// This method returns only the { "reverse_nested" : {} } part.

	source := make(map[string]interface{})
	opts := make(map[string]interface{})
	source["reverse_nested"] = opts

	if a.path != "" {
		opts["path"] = a.path
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
