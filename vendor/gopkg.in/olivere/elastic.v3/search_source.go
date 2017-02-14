// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"fmt"
)

// SearchSource enables users to build the search source.
// It resembles the SearchSourceBuilder in Elasticsearch.
type SearchSource struct {
	query                    Query
	postQuery                Query
	from                     int
	size                     int
	explain                  *bool
	version                  *bool
	sorters                  []Sorter
	trackScores              bool
	minScore                 *float64
	timeout                  string
	terminateAfter           *int
	fieldNames               []string
	fieldDataFields          []string
	scriptFields             []*ScriptField
	fetchSourceContext       *FetchSourceContext
	aggregations             map[string]Aggregation
	highlight                *Highlight
	globalSuggestText        string
	suggesters               []Suggester
	rescores                 []*Rescore
	defaultRescoreWindowSize *int
	indexBoosts              map[string]float64
	stats                    []string
	innerHits                map[string]*InnerHit
}

// NewSearchSource initializes a new SearchSource.
func NewSearchSource() *SearchSource {
	return &SearchSource{
		from:            -1,
		size:            -1,
		trackScores:     false,
		sorters:         make([]Sorter, 0),
		fieldDataFields: make([]string, 0),
		scriptFields:    make([]*ScriptField, 0),
		aggregations:    make(map[string]Aggregation),
		rescores:        make([]*Rescore, 0),
		indexBoosts:     make(map[string]float64),
		stats:           make([]string, 0),
		innerHits:       make(map[string]*InnerHit),
	}
}

// Query sets the query to use with this search source.
func (s *SearchSource) Query(query Query) *SearchSource {
	s.query = query
	return s
}

// PostFilter will be executed after the query has been executed and
// only affects the search hits, not the aggregations.
// This filter is always executed as the last filtering mechanism.
func (s *SearchSource) PostFilter(postFilter Query) *SearchSource {
	s.postQuery = postFilter
	return s
}

// From index to start the search from. Defaults to 0.
func (s *SearchSource) From(from int) *SearchSource {
	s.from = from
	return s
}

// Size is the number of search hits to return. Defaults to 10.
func (s *SearchSource) Size(size int) *SearchSource {
	s.size = size
	return s
}

// MinScore sets the minimum score below which docs will be filtered out.
func (s *SearchSource) MinScore(minScore float64) *SearchSource {
	s.minScore = &minScore
	return s
}

// Explain indicates whether each search hit should be returned with
// an explanation of the hit (ranking).
func (s *SearchSource) Explain(explain bool) *SearchSource {
	s.explain = &explain
	return s
}

// Version indicates whether each search hit should be returned with
// a version associated to it.
func (s *SearchSource) Version(version bool) *SearchSource {
	s.version = &version
	return s
}

// Timeout controls how long a search is allowed to take, e.g. "1s" or "500ms".
func (s *SearchSource) Timeout(timeout string) *SearchSource {
	s.timeout = timeout
	return s
}

// TimeoutInMillis controls how many milliseconds a search is allowed
// to take before it is canceled.
func (s *SearchSource) TimeoutInMillis(timeoutInMillis int) *SearchSource {
	s.timeout = fmt.Sprintf("%dms", timeoutInMillis)
	return s
}

// TerminateAfter allows the request to stop after the given number
// of search hits are collected.
func (s *SearchSource) TerminateAfter(terminateAfter int) *SearchSource {
	s.terminateAfter = &terminateAfter
	return s
}

// Sort adds a sort order.
func (s *SearchSource) Sort(field string, ascending bool) *SearchSource {
	s.sorters = append(s.sorters, SortInfo{Field: field, Ascending: ascending})
	return s
}

// SortWithInfo adds a sort order.
func (s *SearchSource) SortWithInfo(info SortInfo) *SearchSource {
	s.sorters = append(s.sorters, info)
	return s
}

// SortBy	adds a sort order.
func (s *SearchSource) SortBy(sorter ...Sorter) *SearchSource {
	s.sorters = append(s.sorters, sorter...)
	return s
}

func (s *SearchSource) hasSort() bool {
	return len(s.sorters) > 0
}

// TrackScores is applied when sorting and controls if scores will be
// tracked as well. Defaults to false.
func (s *SearchSource) TrackScores(trackScores bool) *SearchSource {
	s.trackScores = trackScores
	return s
}

// Aggregation adds an aggreation to perform as part of the search.
func (s *SearchSource) Aggregation(name string, aggregation Aggregation) *SearchSource {
	s.aggregations[name] = aggregation
	return s
}

// DefaultRescoreWindowSize sets the rescore window size for rescores
// that don't specify their window.
func (s *SearchSource) DefaultRescoreWindowSize(defaultRescoreWindowSize int) *SearchSource {
	s.defaultRescoreWindowSize = &defaultRescoreWindowSize
	return s
}

// Highlight adds highlighting to the search.
func (s *SearchSource) Highlight(highlight *Highlight) *SearchSource {
	s.highlight = highlight
	return s
}

// Highlighter returns the highlighter.
func (s *SearchSource) Highlighter() *Highlight {
	if s.highlight == nil {
		s.highlight = NewHighlight()
	}
	return s.highlight
}

// GlobalSuggestText defines the global text to use with all suggesters.
// This avoids repetition.
func (s *SearchSource) GlobalSuggestText(text string) *SearchSource {
	s.globalSuggestText = text
	return s
}

// Suggester adds a suggester to the search.
func (s *SearchSource) Suggester(suggester Suggester) *SearchSource {
	s.suggesters = append(s.suggesters, suggester)
	return s
}

// Rescorer adds a rescorer to the search.
func (s *SearchSource) Rescorer(rescore *Rescore) *SearchSource {
	s.rescores = append(s.rescores, rescore)
	return s
}

// ClearRescorers removes all rescorers from the search.
func (s *SearchSource) ClearRescorers() *SearchSource {
	s.rescores = make([]*Rescore, 0)
	return s
}

// FetchSource indicates whether the response should contain the stored
// _source for every hit.
func (s *SearchSource) FetchSource(fetchSource bool) *SearchSource {
	if s.fetchSourceContext == nil {
		s.fetchSourceContext = NewFetchSourceContext(fetchSource)
	} else {
		s.fetchSourceContext.SetFetchSource(fetchSource)
	}
	return s
}

// FetchSourceContext indicates how the _source should be fetched.
func (s *SearchSource) FetchSourceContext(fetchSourceContext *FetchSourceContext) *SearchSource {
	s.fetchSourceContext = fetchSourceContext
	return s
}

// NoFields indicates that no fields should be loaded, resulting in only
// id and type to be returned per field.
func (s *SearchSource) NoFields() *SearchSource {
	s.fieldNames = make([]string, 0)
	return s
}

// Field adds a single field to load and return (note, must be stored) as
// part of the search request. If none are specified, the source of the
// document will be returned.
func (s *SearchSource) Field(fieldName string) *SearchSource {
	if s.fieldNames == nil {
		s.fieldNames = make([]string, 0)
	}
	s.fieldNames = append(s.fieldNames, fieldName)
	return s
}

// Fields	sets the fields to load and return as part of the search request.
// If none are specified, the source of the document will be returned.
func (s *SearchSource) Fields(fieldNames ...string) *SearchSource {
	if s.fieldNames == nil {
		s.fieldNames = make([]string, 0)
	}
	s.fieldNames = append(s.fieldNames, fieldNames...)
	return s
}

// FieldDataField adds a single field to load from the field data cache
// and return as part of the search request.
func (s *SearchSource) FieldDataField(fieldDataField string) *SearchSource {
	s.fieldDataFields = append(s.fieldDataFields, fieldDataField)
	return s
}

// FieldDataFields adds one or more fields to load from the field data cache
// and return as part of the search request.
func (s *SearchSource) FieldDataFields(fieldDataFields ...string) *SearchSource {
	s.fieldDataFields = append(s.fieldDataFields, fieldDataFields...)
	return s
}

// ScriptField adds a single script field with the provided script.
func (s *SearchSource) ScriptField(scriptField *ScriptField) *SearchSource {
	s.scriptFields = append(s.scriptFields, scriptField)
	return s
}

// ScriptFields adds one or more script fields with the provided scripts.
func (s *SearchSource) ScriptFields(scriptFields ...*ScriptField) *SearchSource {
	s.scriptFields = append(s.scriptFields, scriptFields...)
	return s
}

// IndexBoost sets the boost that a specific index will receive when the
// query is executed against it.
func (s *SearchSource) IndexBoost(index string, boost float64) *SearchSource {
	s.indexBoosts[index] = boost
	return s
}

// Stats group this request will be aggregated under.
func (s *SearchSource) Stats(statsGroup ...string) *SearchSource {
	s.stats = append(s.stats, statsGroup...)
	return s
}

// InnerHit adds an inner hit to return with the result.
func (s *SearchSource) InnerHit(name string, innerHit *InnerHit) *SearchSource {
	s.innerHits[name] = innerHit
	return s
}

// Source returns the serializable JSON for the source builder.
func (s *SearchSource) Source() (interface{}, error) {
	source := make(map[string]interface{})

	if s.from != -1 {
		source["from"] = s.from
	}
	if s.size != -1 {
		source["size"] = s.size
	}
	if s.timeout != "" {
		source["timeout"] = s.timeout
	}
	if s.terminateAfter != nil {
		source["terminate_after"] = *s.terminateAfter
	}
	if s.query != nil {
		src, err := s.query.Source()
		if err != nil {
			return nil, err
		}
		source["query"] = src
	}
	if s.postQuery != nil {
		src, err := s.postQuery.Source()
		if err != nil {
			return nil, err
		}
		source["post_filter"] = src
	}
	if s.minScore != nil {
		source["min_score"] = *s.minScore
	}
	if s.version != nil {
		source["version"] = *s.version
	}
	if s.explain != nil {
		source["explain"] = *s.explain
	}
	if s.fetchSourceContext != nil {
		src, err := s.fetchSourceContext.Source()
		if err != nil {
			return nil, err
		}
		source["_source"] = src
	}

	if s.fieldNames != nil {
		switch len(s.fieldNames) {
		case 1:
			source["fields"] = s.fieldNames[0]
		default:
			source["fields"] = s.fieldNames
		}
	}

	if len(s.fieldDataFields) > 0 {
		source["fielddata_fields"] = s.fieldDataFields
	}

	if len(s.scriptFields) > 0 {
		sfmap := make(map[string]interface{})
		for _, scriptField := range s.scriptFields {
			src, err := scriptField.Source()
			if err != nil {
				return nil, err
			}
			sfmap[scriptField.FieldName] = src
		}
		source["script_fields"] = sfmap
	}

	if len(s.sorters) > 0 {
		var sortarr []interface{}
		for _, sorter := range s.sorters {
			src, err := sorter.Source()
			if err != nil {
				return nil, err
			}
			sortarr = append(sortarr, src)
		}
		source["sort"] = sortarr
	}

	if s.trackScores {
		source["track_scores"] = s.trackScores
	}

	if len(s.indexBoosts) > 0 {
		source["indices_boost"] = s.indexBoosts
	}

	if len(s.aggregations) > 0 {
		aggsMap := make(map[string]interface{})
		for name, aggregate := range s.aggregations {
			src, err := aggregate.Source()
			if err != nil {
				return nil, err
			}
			aggsMap[name] = src
		}
		source["aggregations"] = aggsMap
	}

	if s.highlight != nil {
		src, err := s.highlight.Source()
		if err != nil {
			return nil, err
		}
		source["highlight"] = src
	}

	if len(s.suggesters) > 0 {
		suggesters := make(map[string]interface{})
		for _, s := range s.suggesters {
			src, err := s.Source(false)
			if err != nil {
				return nil, err
			}
			suggesters[s.Name()] = src
		}
		if s.globalSuggestText != "" {
			suggesters["text"] = s.globalSuggestText
		}
		source["suggest"] = suggesters
	}

	if len(s.rescores) > 0 {
		// Strip empty rescores from request
		var rescores []*Rescore
		for _, r := range s.rescores {
			if !r.IsEmpty() {
				rescores = append(rescores, r)
			}
		}

		if len(rescores) == 1 {
			rescores[0].defaultRescoreWindowSize = s.defaultRescoreWindowSize
			src, err := rescores[0].Source()
			if err != nil {
				return nil, err
			}
			source["rescore"] = src
		} else {
			var slice []interface{}
			for _, r := range rescores {
				r.defaultRescoreWindowSize = s.defaultRescoreWindowSize
				src, err := r.Source()
				if err != nil {
					return nil, err
				}
				slice = append(slice, src)
			}
			source["rescore"] = slice
		}
	}

	if len(s.stats) > 0 {
		source["stats"] = s.stats
	}

	if len(s.innerHits) > 0 {
		// Top-level inner hits
		// See http://www.elastic.co/guide/en/elasticsearch/reference/1.5/search-request-inner-hits.html#top-level-inner-hits
		// "inner_hits": {
		//   "<inner_hits_name>": {
		//     "<path|type>": {
		//       "<path-to-nested-object-field|child-or-parent-type>": {
		//         <inner_hits_body>,
		//         [,"inner_hits" : { [<sub_inner_hits>]+ } ]?
		//       }
		//     }
		//   },
		//   [,"<inner_hits_name_2>" : { ... } ]*
		// }
		m := make(map[string]interface{})
		for name, hit := range s.innerHits {
			if hit.path != "" {
				src, err := hit.Source()
				if err != nil {
					return nil, err
				}
				path := make(map[string]interface{})
				path[hit.path] = src
				m[name] = map[string]interface{}{
					"path": path,
				}
			} else if hit.typ != "" {
				src, err := hit.Source()
				if err != nil {
					return nil, err
				}
				typ := make(map[string]interface{})
				typ[hit.typ] = src
				m[name] = map[string]interface{}{
					"type": typ,
				}
			} else {
				// TODO the Java client throws here, because either path or typ must be specified
			}
		}
		source["inner_hits"] = m
	}

	return source, nil
}
