// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// TermsAggregation is a multi-bucket value source based aggregation
// where buckets are dynamically built - one per unique value.
// See: http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-aggregations-bucket-terms-aggregation.html
type TermsAggregation struct {
	field           string
	script          *Script
	missing         interface{}
	subAggregations map[string]Aggregation
	meta            map[string]interface{}

	size                  *int
	shardSize             *int
	requiredSize          *int
	minDocCount           *int
	shardMinDocCount      *int
	valueType             string
	order                 string
	orderAsc              bool
	includePattern        string
	includeFlags          *int
	excludePattern        string
	excludeFlags          *int
	executionHint         string
	collectionMode        string
	showTermDocCountError *bool
	includeTerms          []string
	excludeTerms          []string
}

func NewTermsAggregation() *TermsAggregation {
	return &TermsAggregation{
		subAggregations: make(map[string]Aggregation, 0),
		includeTerms:    make([]string, 0),
		excludeTerms:    make([]string, 0),
	}
}

func (a *TermsAggregation) Field(field string) *TermsAggregation {
	a.field = field
	return a
}

func (a *TermsAggregation) Script(script *Script) *TermsAggregation {
	a.script = script
	return a
}

// Missing configures the value to use when documents miss a value.
func (a *TermsAggregation) Missing(missing interface{}) *TermsAggregation {
	a.missing = missing
	return a
}

func (a *TermsAggregation) SubAggregation(name string, subAggregation Aggregation) *TermsAggregation {
	a.subAggregations[name] = subAggregation
	return a
}

// Meta sets the meta data to be included in the aggregation response.
func (a *TermsAggregation) Meta(metaData map[string]interface{}) *TermsAggregation {
	a.meta = metaData
	return a
}

func (a *TermsAggregation) Size(size int) *TermsAggregation {
	a.size = &size
	return a
}

func (a *TermsAggregation) RequiredSize(requiredSize int) *TermsAggregation {
	a.requiredSize = &requiredSize
	return a
}

func (a *TermsAggregation) ShardSize(shardSize int) *TermsAggregation {
	a.shardSize = &shardSize
	return a
}

func (a *TermsAggregation) MinDocCount(minDocCount int) *TermsAggregation {
	a.minDocCount = &minDocCount
	return a
}

func (a *TermsAggregation) ShardMinDocCount(shardMinDocCount int) *TermsAggregation {
	a.shardMinDocCount = &shardMinDocCount
	return a
}

func (a *TermsAggregation) Include(regexp string) *TermsAggregation {
	a.includePattern = regexp
	return a
}

func (a *TermsAggregation) IncludeWithFlags(regexp string, flags int) *TermsAggregation {
	a.includePattern = regexp
	a.includeFlags = &flags
	return a
}

func (a *TermsAggregation) Exclude(regexp string) *TermsAggregation {
	a.excludePattern = regexp
	return a
}

func (a *TermsAggregation) ExcludeWithFlags(regexp string, flags int) *TermsAggregation {
	a.excludePattern = regexp
	a.excludeFlags = &flags
	return a
}

// ValueType can be string, long, or double.
func (a *TermsAggregation) ValueType(valueType string) *TermsAggregation {
	a.valueType = valueType
	return a
}

func (a *TermsAggregation) Order(order string, asc bool) *TermsAggregation {
	a.order = order
	a.orderAsc = asc
	return a
}

func (a *TermsAggregation) OrderByCount(asc bool) *TermsAggregation {
	// "order" : { "_count" : "asc" }
	a.order = "_count"
	a.orderAsc = asc
	return a
}

func (a *TermsAggregation) OrderByCountAsc() *TermsAggregation {
	return a.OrderByCount(true)
}

func (a *TermsAggregation) OrderByCountDesc() *TermsAggregation {
	return a.OrderByCount(false)
}

func (a *TermsAggregation) OrderByTerm(asc bool) *TermsAggregation {
	// "order" : { "_term" : "asc" }
	a.order = "_term"
	a.orderAsc = asc
	return a
}

func (a *TermsAggregation) OrderByTermAsc() *TermsAggregation {
	return a.OrderByTerm(true)
}

func (a *TermsAggregation) OrderByTermDesc() *TermsAggregation {
	return a.OrderByTerm(false)
}

// OrderByAggregation creates a bucket ordering strategy which sorts buckets
// based on a single-valued calc get.
func (a *TermsAggregation) OrderByAggregation(aggName string, asc bool) *TermsAggregation {
	// {
	//     "aggs" : {
	//         "genders" : {
	//             "terms" : {
	//                 "field" : "gender",
	//                 "order" : { "avg_height" : "desc" }
	//             },
	//             "aggs" : {
	//                 "avg_height" : { "avg" : { "field" : "height" } }
	//             }
	//         }
	//     }
	// }
	a.order = aggName
	a.orderAsc = asc
	return a
}

// OrderByAggregationAndMetric creates a bucket ordering strategy which
// sorts buckets based on a multi-valued calc get.
func (a *TermsAggregation) OrderByAggregationAndMetric(aggName, metric string, asc bool) *TermsAggregation {
	// {
	//     "aggs" : {
	//         "genders" : {
	//             "terms" : {
	//                 "field" : "gender",
	//                 "order" : { "height_stats.avg" : "desc" }
	//             },
	//             "aggs" : {
	//                 "height_stats" : { "stats" : { "field" : "height" } }
	//             }
	//         }
	//     }
	// }
	a.order = aggName + "." + metric
	a.orderAsc = asc
	return a
}

func (a *TermsAggregation) ExecutionHint(hint string) *TermsAggregation {
	a.executionHint = hint
	return a
}

// Collection mode can be depth_first or breadth_first as of 1.4.0.
func (a *TermsAggregation) CollectionMode(collectionMode string) *TermsAggregation {
	a.collectionMode = collectionMode
	return a
}

func (a *TermsAggregation) ShowTermDocCountError(showTermDocCountError bool) *TermsAggregation {
	a.showTermDocCountError = &showTermDocCountError
	return a
}

func (a *TermsAggregation) IncludeTerms(terms ...string) *TermsAggregation {
	a.includeTerms = append(a.includeTerms, terms...)
	return a
}

func (a *TermsAggregation) ExcludeTerms(terms ...string) *TermsAggregation {
	a.excludeTerms = append(a.excludeTerms, terms...)
	return a
}

func (a *TermsAggregation) Source() (interface{}, error) {
	// Example:
	//	{
	//    "aggs" : {
	//      "genders" : {
	//        "terms" : { "field" : "gender" }
	//      }
	//    }
	//	}
	// This method returns only the { "terms" : { "field" : "gender" } } part.

	source := make(map[string]interface{})
	opts := make(map[string]interface{})
	source["terms"] = opts

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

	// TermsBuilder
	if a.size != nil && *a.size >= 0 {
		opts["size"] = *a.size
	}
	if a.shardSize != nil && *a.shardSize >= 0 {
		opts["shard_size"] = *a.shardSize
	}
	if a.requiredSize != nil && *a.requiredSize >= 0 {
		opts["required_size"] = *a.requiredSize
	}
	if a.minDocCount != nil && *a.minDocCount >= 0 {
		opts["min_doc_count"] = *a.minDocCount
	}
	if a.shardMinDocCount != nil && *a.shardMinDocCount >= 0 {
		opts["shard_min_doc_count"] = *a.shardMinDocCount
	}
	if a.showTermDocCountError != nil {
		opts["show_term_doc_count_error"] = *a.showTermDocCountError
	}
	if a.collectionMode != "" {
		opts["collect_mode"] = a.collectionMode
	}
	if a.valueType != "" {
		opts["value_type"] = a.valueType
	}
	if a.order != "" {
		o := make(map[string]interface{})
		if a.orderAsc {
			o[a.order] = "asc"
		} else {
			o[a.order] = "desc"
		}
		opts["order"] = o
	}
	if len(a.includeTerms) > 0 {
		opts["include"] = a.includeTerms
	}
	if a.includePattern != "" {
		if a.includeFlags == nil || *a.includeFlags == 0 {
			opts["include"] = a.includePattern
		} else {
			p := make(map[string]interface{})
			p["pattern"] = a.includePattern
			p["flags"] = *a.includeFlags
			opts["include"] = p
		}
	}
	if len(a.excludeTerms) > 0 {
		opts["exclude"] = a.excludeTerms
	}
	if a.excludePattern != "" {
		if a.excludeFlags == nil || *a.excludeFlags == 0 {
			opts["exclude"] = a.excludePattern
		} else {
			p := make(map[string]interface{})
			p["pattern"] = a.excludePattern
			p["flags"] = *a.excludeFlags
			opts["exclude"] = p
		}
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
