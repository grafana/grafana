// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"time"
)

// DateRangeAggregation is a range aggregation that is dedicated for
// date values. The main difference between this aggregation and the
// normal range aggregation is that the from and to values can be expressed
// in Date Math expressions, and it is also possible to specify a
// date format by which the from and to response fields will be returned.
// Note that this aggregration includes the from value and excludes the to
// value for each range.
// See: https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-aggregations-bucket-daterange-aggregation.html
type DateRangeAggregation struct {
	field           string
	script          *Script
	subAggregations map[string]Aggregation
	meta            map[string]interface{}
	keyed           *bool
	unmapped        *bool
	format          string
	entries         []DateRangeAggregationEntry
}

type DateRangeAggregationEntry struct {
	Key  string
	From interface{}
	To   interface{}
}

func NewDateRangeAggregation() *DateRangeAggregation {
	return &DateRangeAggregation{
		subAggregations: make(map[string]Aggregation),
		entries:         make([]DateRangeAggregationEntry, 0),
	}
}

func (a *DateRangeAggregation) Field(field string) *DateRangeAggregation {
	a.field = field
	return a
}

func (a *DateRangeAggregation) Script(script *Script) *DateRangeAggregation {
	a.script = script
	return a
}

func (a *DateRangeAggregation) SubAggregation(name string, subAggregation Aggregation) *DateRangeAggregation {
	a.subAggregations[name] = subAggregation
	return a
}

// Meta sets the meta data to be included in the aggregation response.
func (a *DateRangeAggregation) Meta(metaData map[string]interface{}) *DateRangeAggregation {
	a.meta = metaData
	return a
}

func (a *DateRangeAggregation) Keyed(keyed bool) *DateRangeAggregation {
	a.keyed = &keyed
	return a
}

func (a *DateRangeAggregation) Unmapped(unmapped bool) *DateRangeAggregation {
	a.unmapped = &unmapped
	return a
}

func (a *DateRangeAggregation) Format(format string) *DateRangeAggregation {
	a.format = format
	return a
}

func (a *DateRangeAggregation) AddRange(from, to interface{}) *DateRangeAggregation {
	a.entries = append(a.entries, DateRangeAggregationEntry{From: from, To: to})
	return a
}

func (a *DateRangeAggregation) AddRangeWithKey(key string, from, to interface{}) *DateRangeAggregation {
	a.entries = append(a.entries, DateRangeAggregationEntry{Key: key, From: from, To: to})
	return a
}

func (a *DateRangeAggregation) AddUnboundedTo(from interface{}) *DateRangeAggregation {
	a.entries = append(a.entries, DateRangeAggregationEntry{From: from, To: nil})
	return a
}

func (a *DateRangeAggregation) AddUnboundedToWithKey(key string, from interface{}) *DateRangeAggregation {
	a.entries = append(a.entries, DateRangeAggregationEntry{Key: key, From: from, To: nil})
	return a
}

func (a *DateRangeAggregation) AddUnboundedFrom(to interface{}) *DateRangeAggregation {
	a.entries = append(a.entries, DateRangeAggregationEntry{From: nil, To: to})
	return a
}

func (a *DateRangeAggregation) AddUnboundedFromWithKey(key string, to interface{}) *DateRangeAggregation {
	a.entries = append(a.entries, DateRangeAggregationEntry{Key: key, From: nil, To: to})
	return a
}

func (a *DateRangeAggregation) Lt(to interface{}) *DateRangeAggregation {
	a.entries = append(a.entries, DateRangeAggregationEntry{From: nil, To: to})
	return a
}

func (a *DateRangeAggregation) LtWithKey(key string, to interface{}) *DateRangeAggregation {
	a.entries = append(a.entries, DateRangeAggregationEntry{Key: key, From: nil, To: to})
	return a
}

func (a *DateRangeAggregation) Between(from, to interface{}) *DateRangeAggregation {
	a.entries = append(a.entries, DateRangeAggregationEntry{From: from, To: to})
	return a
}

func (a *DateRangeAggregation) BetweenWithKey(key string, from, to interface{}) *DateRangeAggregation {
	a.entries = append(a.entries, DateRangeAggregationEntry{Key: key, From: from, To: to})
	return a
}

func (a *DateRangeAggregation) Gt(from interface{}) *DateRangeAggregation {
	a.entries = append(a.entries, DateRangeAggregationEntry{From: from, To: nil})
	return a
}

func (a *DateRangeAggregation) GtWithKey(key string, from interface{}) *DateRangeAggregation {
	a.entries = append(a.entries, DateRangeAggregationEntry{Key: key, From: from, To: nil})
	return a
}

func (a *DateRangeAggregation) Source() (interface{}, error) {
	// Example:
	// {
	//     "aggs" : {
	//         "range" : {
	//             "date_range": {
	//                 "field": "date",
	//                 "format": "MM-yyy",
	//                 "ranges": [
	//                     { "to": "now-10M/M" },
	//                     { "from": "now-10M/M" }
	//                 ]
	//             }
	//         }
	//         }
	//     }
	// }
	//
	// This method returns only the { "date_range" : { ... } } part.

	source := make(map[string]interface{})
	opts := make(map[string]interface{})
	source["date_range"] = opts

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

	if a.keyed != nil {
		opts["keyed"] = *a.keyed
	}
	if a.unmapped != nil {
		opts["unmapped"] = *a.unmapped
	}
	if a.format != "" {
		opts["format"] = a.format
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
			case *int, *int16, *int32, *int64, *float32, *float64:
				r["from"] = from
			case time.Time:
				r["from"] = from.Format(time.RFC3339)
			case *time.Time:
				r["from"] = from.Format(time.RFC3339)
			case string:
				r["from"] = from
			case *string:
				r["from"] = from
			}
		}
		if ent.To != nil {
			switch to := ent.To.(type) {
			case int, int16, int32, int64, float32, float64:
				r["to"] = to
			case *int, *int16, *int32, *int64, *float32, *float64:
				r["to"] = to
			case time.Time:
				r["to"] = to.Format(time.RFC3339)
			case *time.Time:
				r["to"] = to.Format(time.RFC3339)
			case string:
				r["to"] = to
			case *string:
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
