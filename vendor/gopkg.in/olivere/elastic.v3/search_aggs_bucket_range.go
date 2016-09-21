// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"time"
)

// RangeAggregation is a multi-bucket value source based aggregation that
// enables the user to define a set of ranges - each representing a bucket.
// During the aggregation process, the values extracted from each document
// will be checked against each bucket range and "bucket" the
// relevant/matching document. Note that this aggregration includes the
// from value and excludes the to value for each range.
// See: http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-aggregations-bucket-range-aggregation.html
type RangeAggregation struct {
	field           string
	script          *Script
	missing         interface{}
	subAggregations map[string]Aggregation
	meta            map[string]interface{}
	keyed           *bool
	unmapped        *bool
	entries         []rangeAggregationEntry
}

type rangeAggregationEntry struct {
	Key  string
	From interface{}
	To   interface{}
}

func NewRangeAggregation() *RangeAggregation {
	return &RangeAggregation{
		subAggregations: make(map[string]Aggregation),
		entries:         make([]rangeAggregationEntry, 0),
	}
}

func (a *RangeAggregation) Field(field string) *RangeAggregation {
	a.field = field
	return a
}

func (a *RangeAggregation) Script(script *Script) *RangeAggregation {
	a.script = script
	return a
}

// Missing configures the value to use when documents miss a value.
func (a *RangeAggregation) Missing(missing interface{}) *RangeAggregation {
	a.missing = missing
	return a
}

func (a *RangeAggregation) SubAggregation(name string, subAggregation Aggregation) *RangeAggregation {
	a.subAggregations[name] = subAggregation
	return a
}

// Meta sets the meta data to be included in the aggregation response.
func (a *RangeAggregation) Meta(metaData map[string]interface{}) *RangeAggregation {
	a.meta = metaData
	return a
}

func (a *RangeAggregation) Keyed(keyed bool) *RangeAggregation {
	a.keyed = &keyed
	return a
}

func (a *RangeAggregation) Unmapped(unmapped bool) *RangeAggregation {
	a.unmapped = &unmapped
	return a
}

func (a *RangeAggregation) AddRange(from, to interface{}) *RangeAggregation {
	a.entries = append(a.entries, rangeAggregationEntry{From: from, To: to})
	return a
}

func (a *RangeAggregation) AddRangeWithKey(key string, from, to interface{}) *RangeAggregation {
	a.entries = append(a.entries, rangeAggregationEntry{Key: key, From: from, To: to})
	return a
}

func (a *RangeAggregation) AddUnboundedTo(from interface{}) *RangeAggregation {
	a.entries = append(a.entries, rangeAggregationEntry{From: from, To: nil})
	return a
}

func (a *RangeAggregation) AddUnboundedToWithKey(key string, from interface{}) *RangeAggregation {
	a.entries = append(a.entries, rangeAggregationEntry{Key: key, From: from, To: nil})
	return a
}

func (a *RangeAggregation) AddUnboundedFrom(to interface{}) *RangeAggregation {
	a.entries = append(a.entries, rangeAggregationEntry{From: nil, To: to})
	return a
}

func (a *RangeAggregation) AddUnboundedFromWithKey(key string, to interface{}) *RangeAggregation {
	a.entries = append(a.entries, rangeAggregationEntry{Key: key, From: nil, To: to})
	return a
}

func (a *RangeAggregation) Lt(to interface{}) *RangeAggregation {
	a.entries = append(a.entries, rangeAggregationEntry{From: nil, To: to})
	return a
}

func (a *RangeAggregation) LtWithKey(key string, to interface{}) *RangeAggregation {
	a.entries = append(a.entries, rangeAggregationEntry{Key: key, From: nil, To: to})
	return a
}

func (a *RangeAggregation) Between(from, to interface{}) *RangeAggregation {
	a.entries = append(a.entries, rangeAggregationEntry{From: from, To: to})
	return a
}

func (a *RangeAggregation) BetweenWithKey(key string, from, to interface{}) *RangeAggregation {
	a.entries = append(a.entries, rangeAggregationEntry{Key: key, From: from, To: to})
	return a
}

func (a *RangeAggregation) Gt(from interface{}) *RangeAggregation {
	a.entries = append(a.entries, rangeAggregationEntry{From: from, To: nil})
	return a
}

func (a *RangeAggregation) GtWithKey(key string, from interface{}) *RangeAggregation {
	a.entries = append(a.entries, rangeAggregationEntry{Key: key, From: from, To: nil})
	return a
}

func (a *RangeAggregation) Source() (interface{}, error) {
	// Example:
	// {
	//     "aggs" : {
	//         "price_ranges" : {
	//             "range" : {
	//                 "field" : "price",
	//                 "ranges" : [
	//                     { "to" : 50 },
	//                     { "from" : 50, "to" : 100 },
	//                     { "from" : 100 }
	//                 ]
	//             }
	//         }
	//     }
	// }
	//
	// This method returns only the { "range" : { ... } } part.

	source := make(map[string]interface{})
	opts := make(map[string]interface{})
	source["range"] = opts

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
	if a.missing != nil {
		opts["missing"] = a.missing
	}

	if a.keyed != nil {
		opts["keyed"] = *a.keyed
	}
	if a.unmapped != nil {
		opts["unmapped"] = *a.unmapped
	}

	var ranges []interface{}
	for _, ent := range a.entries {
		r := make(map[string]interface{})
		if ent.Key != "" {
			r["key"] = ent.Key
		}
		if ent.From != nil {
			switch from := ent.From.(type) {
			case int, int16, int32, int64, float32, float64:
				r["from"] = from
			case time.Time:
				r["from"] = from.Format(time.RFC3339)
			case string:
				r["from"] = from
			}
		}
		if ent.To != nil {
			switch to := ent.To.(type) {
			case int, int16, int32, int64, float32, float64:
				r["to"] = to
			case time.Time:
				r["to"] = to.Format(time.RFC3339)
			case string:
				r["to"] = to
			}
		}
		ranges = append(ranges, r)
	}
	opts["ranges"] = ranges

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
