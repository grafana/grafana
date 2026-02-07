//  Copyright (c) 2023 Couchbase, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// 		http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

//go:build !vectors
// +build !vectors

package bleve

import (
	"context"
	"encoding/json"
	"sort"

	"github.com/blevesearch/bleve/v2/search"
	"github.com/blevesearch/bleve/v2/search/collector"
	"github.com/blevesearch/bleve/v2/search/query"
	index "github.com/blevesearch/bleve_index_api"
)

const supportForVectorSearch = false

// A SearchRequest describes all the parameters
// needed to search the index.
// Query is required.
// Size/From describe how much and which part of the
// result set to return.
// Highlight describes optional search result
// highlighting.
// Fields describes a list of field values which
// should be retrieved for result documents, provided they
// were stored while indexing.
// Facets describe the set of facets to be computed.
// Explain triggers inclusion of additional search
// result score explanations.
// Sort describes the desired order for the results to be returned.
// Score controls the kind of scoring performed
// SearchAfter supports deep paging by providing a minimum sort key
// SearchBefore supports deep paging by providing a maximum sort key
// sortFunc specifies the sort implementation to use for sorting results.
//
// A special field named "*" can be used to return all fields.
type SearchRequest struct {
	ClientContextID  string            `json:"client_context_id,omitempty"`
	Query            query.Query       `json:"query"`
	Size             int               `json:"size"`
	From             int               `json:"from"`
	Highlight        *HighlightRequest `json:"highlight"`
	Fields           []string          `json:"fields"`
	Facets           FacetsRequest     `json:"facets"`
	Explain          bool              `json:"explain"`
	Sort             search.SortOrder  `json:"sort"`
	IncludeLocations bool              `json:"includeLocations"`
	Score            string            `json:"score,omitempty"`
	SearchAfter      []string          `json:"search_after"`
	SearchBefore     []string          `json:"search_before"`

	// PreSearchData will be a  map that will be used
	// in the second phase of any 2-phase search, to provide additional
	// context to the second phase. This is useful in the case of index
	// aliases where the first phase will gather the PreSearchData from all
	// the indexes in the alias, and the second phase will use that
	// PreSearchData to perform the actual search.
	// The currently accepted map configuration is:
	//
	// "_knn_pre_search_data_key": []*search.DocumentMatch

	PreSearchData map[string]interface{} `json:"pre_search_data,omitempty"`

	Params *RequestParams `json:"params,omitempty"`

	sortFunc func(sort.Interface)
}

// UnmarshalJSON deserializes a JSON representation of
// a SearchRequest
func (r *SearchRequest) UnmarshalJSON(input []byte) error {
	var temp struct {
		Q                json.RawMessage   `json:"query"`
		Size             *int              `json:"size"`
		From             int               `json:"from"`
		Highlight        *HighlightRequest `json:"highlight"`
		Fields           []string          `json:"fields"`
		Facets           FacetsRequest     `json:"facets"`
		Explain          bool              `json:"explain"`
		Sort             []json.RawMessage `json:"sort"`
		IncludeLocations bool              `json:"includeLocations"`
		Score            string            `json:"score"`
		SearchAfter      []string          `json:"search_after"`
		SearchBefore     []string          `json:"search_before"`
		PreSearchData    json.RawMessage   `json:"pre_search_data"`
		Params           json.RawMessage   `json:"params"`
	}

	err := json.Unmarshal(input, &temp)
	if err != nil {
		return err
	}

	if temp.Size == nil {
		r.Size = 10
	} else {
		r.Size = *temp.Size
	}
	if temp.Sort == nil {
		r.Sort = search.SortOrder{&search.SortScore{Desc: true}}
	} else {
		r.Sort, err = search.ParseSortOrderJSON(temp.Sort)
		if err != nil {
			return err
		}
	}
	r.From = temp.From
	r.Explain = temp.Explain
	r.Highlight = temp.Highlight
	r.Fields = temp.Fields
	r.Facets = temp.Facets
	r.IncludeLocations = temp.IncludeLocations
	r.Score = temp.Score
	r.SearchAfter = temp.SearchAfter
	r.SearchBefore = temp.SearchBefore
	r.Query, err = query.ParseQuery(temp.Q)
	if err != nil {
		return err
	}

	if r.Size < 0 {
		r.Size = 10
	}
	if r.From < 0 {
		r.From = 0
	}

	if IsScoreFusionRequested(r) {
		if temp.Params == nil {
			// If params is not present and it is requires rescoring, assign
			// default values
			r.Params = NewDefaultParams(r.From, r.Size)
		} else {
			// if it is a request that requires rescoring, parse the rescoring
			// parameters.
			params, err := ParseParams(r, temp.Params)
			if err != nil {
				return err
			}
			r.Params = params
		}
	}

	if temp.PreSearchData != nil {
		r.PreSearchData, err = query.ParsePreSearchData(temp.PreSearchData)
		if err != nil {
			return err
		}
	}

	return nil

}

// -----------------------------------------------------------------------------

func copySearchRequest(req *SearchRequest, preSearchData map[string]interface{}) *SearchRequest {
	rv := SearchRequest{
		Query:            req.Query,
		Size:             req.Size + req.From,
		From:             0,
		Highlight:        req.Highlight,
		Fields:           req.Fields,
		Facets:           req.Facets,
		Explain:          req.Explain,
		Sort:             req.Sort.Copy(),
		IncludeLocations: req.IncludeLocations,
		Score:            req.Score,
		SearchAfter:      req.SearchAfter,
		SearchBefore:     req.SearchBefore,
		PreSearchData:    preSearchData,
	}
	return &rv
}

func validateKNN(req *SearchRequest) error {
	return nil
}

func (i *indexImpl) runKnnCollector(ctx context.Context, req *SearchRequest, reader index.IndexReader, preSearch bool) ([]*search.DocumentMatch, error) {
	return nil, nil
}

func setKnnHitsInCollector(knnHits []*search.DocumentMatch, req *SearchRequest, coll *collector.TopNCollector) {
}

func requestHasKNN(req *SearchRequest) bool {
	return false
}

func numKNNQueries(req *SearchRequest) int {
	return 0
}

func addKnnToDummyRequest(dummyReq *SearchRequest, realReq *SearchRequest) {
}

func validateAndDistributeKNNHits(knnHits []*search.DocumentMatch, indexes []Index) (map[string][]*search.DocumentMatch, error) {
	return nil, nil
}

func isKNNrequestSatisfiedByPreSearch(req *SearchRequest) bool {
	return false
}

func constructKnnPreSearchData(mergedOut map[string]map[string]interface{}, preSearchResult *SearchResult,
	indexes []Index) (map[string]map[string]interface{}, error) {
	return mergedOut, nil
}

func finalizeKNNResults(req *SearchRequest, knnHits []*search.DocumentMatch) []*search.DocumentMatch {
	return knnHits
}

func newKnnPreSearchResultProcessor(req *SearchRequest) *knnPreSearchResultProcessor {
	return &knnPreSearchResultProcessor{} // equivalent to nil
}

func (r *rescorer) prepareKnnRequest() {
}

func (r *rescorer) restoreKnnRequest() {
}
