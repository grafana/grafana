// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// ChildrenAggregation is a special single bucket aggregation that enables
// aggregating from buckets on parent document types to buckets on child documents.
// It is available from 1.4.0.Beta1 upwards.
// See: http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-aggregations-bucket-children-aggregation.html
type ChildrenAggregation struct {
	typ             string
	subAggregations map[string]Aggregation
	meta            map[string]interface{}
}

func NewChildrenAggregation() *ChildrenAggregation {
	return &ChildrenAggregation{
		subAggregations: make(map[string]Aggregation),
	}
}

func (a *ChildrenAggregation) Type(typ string) *ChildrenAggregation {
	a.typ = typ
	return a
}

func (a *ChildrenAggregation) SubAggregation(name string, subAggregation Aggregation) *ChildrenAggregation {
	a.subAggregations[name] = subAggregation
	return a
}

// Meta sets the meta data to be included in the aggregation response.
func (a *ChildrenAggregation) Meta(metaData map[string]interface{}) *ChildrenAggregation {
	a.meta = metaData
	return a
}

func (a *ChildrenAggregation) Source() (interface{}, error) {
	// Example:
	//	{
	//    "aggs" : {
	//      "to-answers" : {
	//        "children": {
	//          "type" : "answer"
	//        }
	//      }
	//    }
	//	}
	// This method returns only the { "type" : ... } part.

	source := make(map[string]interface{})
	opts := make(map[string]interface{})
	source["children"] = opts
	opts["type"] = a.typ

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
