//  Copyright (c) 2014 Couchbase, Inc.
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

package bleve

import (
	"fmt"
	"reflect"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/blevesearch/bleve/v2/analysis"
	"github.com/blevesearch/bleve/v2/analysis/datetime/optional"
	"github.com/blevesearch/bleve/v2/document"
	"github.com/blevesearch/bleve/v2/registry"
	"github.com/blevesearch/bleve/v2/search"
	"github.com/blevesearch/bleve/v2/search/collector"
	"github.com/blevesearch/bleve/v2/search/query"
	"github.com/blevesearch/bleve/v2/size"
	"github.com/blevesearch/bleve/v2/util"
)

var (
	reflectStaticSizeSearchResult int
	reflectStaticSizeSearchStatus int
)

func init() {
	var sr SearchResult
	reflectStaticSizeSearchResult = int(reflect.TypeOf(sr).Size())
	var ss SearchStatus
	reflectStaticSizeSearchStatus = int(reflect.TypeOf(ss).Size())
}

var cache = registry.NewCache()

const defaultDateTimeParser = optional.Name

const (
	ScoreDefault = ""
	ScoreNone    = "none"
	ScoreRRF     = "rrf"
	ScoreRSF     = "rsf"
)

var AllowedFusionSort = search.SortOrder{&search.SortScore{Desc: true}}

type dateTimeRange struct {
	Name           string    `json:"name,omitempty"`
	Start          time.Time `json:"start,omitempty"`
	End            time.Time `json:"end,omitempty"`
	DateTimeParser string    `json:"datetime_parser,omitempty"`
	startString    *string
	endString      *string
}

func (dr *dateTimeRange) ParseDates(dateTimeParser analysis.DateTimeParser) (start, end time.Time, err error) {
	start = dr.Start
	if dr.Start.IsZero() && dr.startString != nil {
		s, _, parseError := dateTimeParser.ParseDateTime(*dr.startString)
		if parseError != nil {
			return start, end, fmt.Errorf("error parsing start date '%s' for date range name '%s': %v", *dr.startString, dr.Name, parseError)
		}
		start = s
	}
	end = dr.End
	if dr.End.IsZero() && dr.endString != nil {
		e, _, parseError := dateTimeParser.ParseDateTime(*dr.endString)
		if parseError != nil {
			return start, end, fmt.Errorf("error parsing end date '%s' for date range name '%s': %v", *dr.endString, dr.Name, parseError)
		}
		end = e
	}
	return start, end, err
}

func (dr *dateTimeRange) UnmarshalJSON(input []byte) error {
	var temp struct {
		Name           string  `json:"name,omitempty"`
		Start          *string `json:"start,omitempty"`
		End            *string `json:"end,omitempty"`
		DateTimeParser string  `json:"datetime_parser,omitempty"`
	}

	if err := util.UnmarshalJSON(input, &temp); err != nil {
		return err
	}

	dr.Name = temp.Name
	if temp.Start != nil {
		dr.startString = temp.Start
	}
	if temp.End != nil {
		dr.endString = temp.End
	}
	if temp.DateTimeParser != "" {
		dr.DateTimeParser = temp.DateTimeParser
	}

	return nil
}

func (dr *dateTimeRange) MarshalJSON() ([]byte, error) {
	rv := map[string]interface{}{
		"name": dr.Name,
	}

	if !dr.Start.IsZero() {
		rv["start"] = dr.Start
	} else if dr.startString != nil {
		rv["start"] = dr.startString
	}

	if !dr.End.IsZero() {
		rv["end"] = dr.End
	} else if dr.endString != nil {
		rv["end"] = dr.endString
	}

	if dr.DateTimeParser != "" {
		rv["datetime_parser"] = dr.DateTimeParser
	}
	return util.MarshalJSON(rv)
}

type numericRange struct {
	Name string   `json:"name,omitempty"`
	Min  *float64 `json:"min,omitempty"`
	Max  *float64 `json:"max,omitempty"`
}

// A FacetRequest describes a facet or aggregation
// of the result document set you would like to be
// built.
type FacetRequest struct {
	Size           int              `json:"size"`
	Field          string           `json:"field"`
	TermPrefix     string           `json:"term_prefix,omitempty"`
	TermPattern    string           `json:"term_pattern,omitempty"`
	NumericRanges  []*numericRange  `json:"numeric_ranges,omitempty"`
	DateTimeRanges []*dateTimeRange `json:"date_ranges,omitempty"`

	// Compiled regex pattern (cached during validation)
	compiledPattern *regexp.Regexp
}

// NewFacetRequest creates a facet on the specified
// field that limits the number of entries to the
// specified size.
func NewFacetRequest(field string, size int) *FacetRequest {
	return &FacetRequest{
		Field: field,
		Size:  size,
	}
}

// SetPrefixFilter sets the prefix filter for term facets.
func (fr *FacetRequest) SetPrefixFilter(prefix string) {
	fr.TermPrefix = prefix
}

// SetRegexFilter sets the regex pattern filter for term facets.
func (fr *FacetRequest) SetRegexFilter(pattern string) {
	fr.TermPattern = pattern
}

func (fr *FacetRequest) Validate() error {
	// Validate regex pattern if provided and cache the compiled regex
	if fr.TermPattern != "" {
		compiled, err := regexp.Compile(fr.TermPattern)
		if err != nil {
			return fmt.Errorf("invalid term pattern: %v", err)
		}
		fr.compiledPattern = compiled
	}

	nrCount := len(fr.NumericRanges)
	drCount := len(fr.DateTimeRanges)
	if nrCount > 0 && drCount > 0 {
		return fmt.Errorf("facet can only contain numeric ranges or date ranges, not both")
	}

	if nrCount > 0 {
		nrNames := map[string]interface{}{}
		for _, nr := range fr.NumericRanges {
			if _, ok := nrNames[nr.Name]; ok {
				return fmt.Errorf("numeric ranges contains duplicate name '%s'", nr.Name)
			}
			nrNames[nr.Name] = struct{}{}
			if nr.Min == nil && nr.Max == nil {
				return fmt.Errorf("numeric range query must specify either min, max or both for range name '%s'", nr.Name)
			}
		}

	} else {
		dateTimeParser, err := cache.DateTimeParserNamed(defaultDateTimeParser)
		if err != nil {
			return err
		}
		drNames := map[string]interface{}{}
		for _, dr := range fr.DateTimeRanges {
			if _, ok := drNames[dr.Name]; ok {
				return fmt.Errorf("date ranges contains duplicate name '%s'", dr.Name)
			}
			drNames[dr.Name] = struct{}{}
			if dr.DateTimeParser == "" {
				// cannot parse the date range dates as the defaultDateTimeParser is overridden
				// so perform this validation at query time
				start, end, err := dr.ParseDates(dateTimeParser)
				if err != nil {
					return fmt.Errorf("ParseDates err: %v, using date time parser named %s", err, defaultDateTimeParser)
				}
				if start.IsZero() && end.IsZero() {
					return fmt.Errorf("date range query must specify either start, end or both for range name '%s'", dr.Name)
				}
			}
		}
	}

	return nil
}

// AddDateTimeRange adds a bucket to a field
// containing date values.  Documents with a
// date value falling into this range are tabulated
// as part of this bucket/range.
func (fr *FacetRequest) AddDateTimeRange(name string, start, end time.Time) {
	if fr.DateTimeRanges == nil {
		fr.DateTimeRanges = make([]*dateTimeRange, 0, 1)
	}
	fr.DateTimeRanges = append(fr.DateTimeRanges, &dateTimeRange{Name: name, Start: start, End: end})
}

// AddDateTimeRangeString adds a bucket to a field
// containing date values. Uses defaultDateTimeParser to parse the date strings.
func (fr *FacetRequest) AddDateTimeRangeString(name string, start, end *string) {
	if fr.DateTimeRanges == nil {
		fr.DateTimeRanges = make([]*dateTimeRange, 0, 1)
	}
	fr.DateTimeRanges = append(fr.DateTimeRanges,
		&dateTimeRange{Name: name, startString: start, endString: end})
}

// AddDateTimeRangeString adds a bucket to a field
// containing date values. Uses the specified parser to parse the date strings.
// provided the parser is registered in the index mapping.
func (fr *FacetRequest) AddDateTimeRangeStringWithParser(name string, start, end *string, parser string) {
	if fr.DateTimeRanges == nil {
		fr.DateTimeRanges = make([]*dateTimeRange, 0, 1)
	}
	fr.DateTimeRanges = append(fr.DateTimeRanges,
		&dateTimeRange{Name: name, startString: start, endString: end, DateTimeParser: parser})
}

// AddNumericRange adds a bucket to a field
// containing numeric values.  Documents with a
// numeric value falling into this range are
// tabulated as part of this bucket/range.
func (fr *FacetRequest) AddNumericRange(name string, min, max *float64) {
	if fr.NumericRanges == nil {
		fr.NumericRanges = make([]*numericRange, 0, 1)
	}
	fr.NumericRanges = append(fr.NumericRanges, &numericRange{Name: name, Min: min, Max: max})
}

// FacetsRequest groups together all the
// FacetRequest objects for a single query.
type FacetsRequest map[string]*FacetRequest

func (fr FacetsRequest) Validate() error {
	for _, v := range fr {
		if err := v.Validate(); err != nil {
			return err
		}
	}
	return nil
}

// HighlightRequest describes how field matches
// should be highlighted.
type HighlightRequest struct {
	Style  *string  `json:"style"`
	Fields []string `json:"fields"`
}

// NewHighlight creates a default
// HighlightRequest.
func NewHighlight() *HighlightRequest {
	return &HighlightRequest{}
}

// NewHighlightWithStyle creates a HighlightRequest
// with an alternate style.
func NewHighlightWithStyle(style string) *HighlightRequest {
	return &HighlightRequest{
		Style: &style,
	}
}

func (h *HighlightRequest) AddField(field string) {
	if h.Fields == nil {
		h.Fields = make([]string, 0, 1)
	}
	h.Fields = append(h.Fields, field)
}

func (r *SearchRequest) Validate() error {
	if srq, ok := r.Query.(query.ValidatableQuery); ok {
		err := srq.Validate()
		if err != nil {
			return err
		}
	}

	if r.SearchAfter != nil && r.SearchBefore != nil {
		return fmt.Errorf("cannot use search after and search before together")
	}

	if r.SearchAfter != nil {
		if r.From != 0 {
			return fmt.Errorf("cannot use search after with from !=0")
		}
		if len(r.SearchAfter) != len(r.Sort) {
			return fmt.Errorf("search after must have same size as sort order")
		}
	}
	if r.SearchBefore != nil {
		if r.From != 0 {
			return fmt.Errorf("cannot use search before with from !=0")
		}
		if len(r.SearchBefore) != len(r.Sort) {
			return fmt.Errorf("search before must have same size as sort order")
		}
	}

	err := r.validatePagination()
	if err != nil {
		return err
	}

	if IsScoreFusionRequested(r) {
		if r.SearchAfter != nil || r.SearchBefore != nil {
			return fmt.Errorf("cannot use search after or search before with score fusion")
		}

		if r.Sort != nil {
			if !reflect.DeepEqual(r.Sort, AllowedFusionSort) {
				return fmt.Errorf("sort must be empty or descending order of score for score fusion")
			}
		}
	}

	err = validateKNN(r)
	if err != nil {
		return err
	}
	return r.Facets.Validate()
}

// Validates SearchAfter/SearchBefore
func (r *SearchRequest) validatePagination() error {
	var pagination []string
	var afterOrBefore string

	if r.SearchAfter != nil {
		pagination = r.SearchAfter
		afterOrBefore = "search after"
	} else if r.SearchBefore != nil {
		pagination = r.SearchBefore
		afterOrBefore = "search before"
	} else {
		return nil
	}

	for i := range pagination {
		switch ss := r.Sort[i].(type) {
		case *search.SortGeoDistance:
			_, err := strconv.ParseFloat(pagination[i], 64)
			if err != nil {
				return fmt.Errorf("invalid %s value for sort field '%s': '%s'. %s", afterOrBefore, ss.Field, pagination[i], err)
			}
		case *search.SortField:
			switch ss.Type {
			case search.SortFieldAsNumber:
				_, err := strconv.ParseFloat(pagination[i], 64)
				if err != nil {
					return fmt.Errorf("invalid %s value for sort field '%s': '%s'. %s", afterOrBefore, ss.Field, pagination[i], err)
				}
			case search.SortFieldAsDate:
				_, err := time.Parse(time.RFC3339Nano, pagination[i])
				if err != nil {
					return fmt.Errorf("invalid %s value for sort field '%s': '%s'. %s", afterOrBefore, ss.Field, pagination[i], err)
				}
			}
		}
	}

	return nil
}

// AddFacet adds a FacetRequest to this SearchRequest
func (r *SearchRequest) AddFacet(facetName string, f *FacetRequest) {
	if r.Facets == nil {
		r.Facets = make(FacetsRequest, 1)
	}
	r.Facets[facetName] = f
}

// SortBy changes the request to use the requested sort order
// this form uses the simplified syntax with an array of strings
// each string can either be a field name
// or the magic value _id and _score which refer to the doc id and search score
// any of these values can optionally be prefixed with - to reverse the order
func (r *SearchRequest) SortBy(order []string) {
	so := search.ParseSortOrderStrings(order)
	r.Sort = so
}

// SortByCustom changes the request to use the requested sort order
func (r *SearchRequest) SortByCustom(order search.SortOrder) {
	r.Sort = order
}

// SetSearchAfter sets the request to skip over hits with a sort
// value less than the provided sort after key
func (r *SearchRequest) SetSearchAfter(after []string) {
	r.SearchAfter = after
}

// SetSearchBefore sets the request to skip over hits with a sort
// value greater than the provided sort before key
func (r *SearchRequest) SetSearchBefore(before []string) {
	r.SearchBefore = before
}

// AddParams adds a RequestParams field to the search request
func (r *SearchRequest) AddParams(params RequestParams) {
	r.Params = &params
}

// NewSearchRequest creates a new SearchRequest
// for the Query, using default values for all
// other search parameters.
func NewSearchRequest(q query.Query) *SearchRequest {
	return NewSearchRequestOptions(q, 10, 0, false)
}

// NewSearchRequestOptions creates a new SearchRequest
// for the Query, with the requested size, from
// and explanation search parameters.
// By default results are ordered by score, descending.
func NewSearchRequestOptions(q query.Query, size, from int, explain bool) *SearchRequest {
	return &SearchRequest{
		Query:   q,
		Size:    size,
		From:    from,
		Explain: explain,
		Sort:    search.SortOrder{&search.SortScore{Desc: true}},
	}
}

// IndexErrMap tracks errors with the name of the index where it occurred
type IndexErrMap map[string]error

// MarshalJSON serializes the error into a string for JSON consumption
func (iem IndexErrMap) MarshalJSON() ([]byte, error) {
	tmp := make(map[string]string, len(iem))
	for k, v := range iem {
		tmp[k] = v.Error()
	}
	return util.MarshalJSON(tmp)
}

func (iem IndexErrMap) UnmarshalJSON(data []byte) error {
	var tmp map[string]string
	err := util.UnmarshalJSON(data, &tmp)
	if err != nil {
		return err
	}
	for k, v := range tmp {
		iem[k] = fmt.Errorf("%s", v)
	}
	return nil
}

// SearchStatus is a section in the SearchResult reporting how many
// underlying indexes were queried, how many were successful/failed
// and a map of any errors that were encountered
type SearchStatus struct {
	Total      int         `json:"total"`
	Failed     int         `json:"failed"`
	Successful int         `json:"successful"`
	Errors     IndexErrMap `json:"errors,omitempty"`
}

// Merge will merge together multiple SearchStatuses during a MultiSearch
func (ss *SearchStatus) Merge(other *SearchStatus) {
	ss.Total += other.Total
	ss.Failed += other.Failed
	ss.Successful += other.Successful
	if len(other.Errors) > 0 {
		if ss.Errors == nil {
			ss.Errors = make(map[string]error)
		}
		for otherIndex, otherError := range other.Errors {
			ss.Errors[otherIndex] = otherError
		}
	}
}

// A SearchResult describes the results of executing
// a SearchRequest.
//
// Status - Whether the search was executed on the underlying indexes successfully
// or failed, and the corresponding errors.
// Request - The SearchRequest that was executed.
// Hits - The list of documents that matched the query and their corresponding
// scores, score explanation, location info and so on.
// Total - The total number of documents that matched the query.
// Cost - indicates how expensive was the query with respect to bytes read
// from the mapped index files.
// MaxScore - The maximum score seen across all document hits seen for this query.
// Took - The time taken to execute the search.
// Facets - The facet results for the search.
type SearchResult struct {
	Status   *SearchStatus                  `json:"status"`
	Request  *SearchRequest                 `json:"request,omitempty"`
	Hits     search.DocumentMatchCollection `json:"hits"`
	Total    uint64                         `json:"total_hits"`
	Cost     uint64                         `json:"cost"`
	MaxScore float64                        `json:"max_score"`
	Took     time.Duration                  `json:"took"`
	Facets   search.FacetResults            `json:"facets"`
	// special fields that are applicable only for search
	// results that are obtained from a presearch
	SynonymResult search.FieldTermSynonymMap `json:"synonym_result,omitempty"`

	// The following fields are applicable to BM25 preSearch
	BM25Stats *search.BM25Stats `json:"bm25_stats,omitempty"`
}

func (sr *SearchResult) Size() int {
	sizeInBytes := reflectStaticSizeSearchResult + size.SizeOfPtr +
		reflectStaticSizeSearchStatus

	for _, entry := range sr.Hits {
		if entry != nil {
			sizeInBytes += entry.Size()
		}
	}

	for k, v := range sr.Facets {
		sizeInBytes += size.SizeOfString + len(k) +
			v.Size()
	}

	return sizeInBytes
}

func (sr *SearchResult) String() string {
	rv := &strings.Builder{}
	if sr.Total > 0 {
		switch {
		case sr.Request != nil && sr.Request.Size > 0:
			start := sr.Request.From + 1
			end := sr.Request.From + len(sr.Hits)
			fmt.Fprintf(rv, "%d matches, showing %d through %d, took %s\n", sr.Total, start, end, sr.Took)
			for i, hit := range sr.Hits {
				rv = formatHit(rv, hit, start+i)
			}
		case sr.Request == nil:
			fmt.Fprintf(rv, "%d matches, took %s\n", sr.Total, sr.Took)
			for i, hit := range sr.Hits {
				rv = formatHit(rv, hit, i+1)
			}
		default:
			fmt.Fprintf(rv, "%d matches, took %s\n", sr.Total, sr.Took)
		}
	} else {
		fmt.Fprintf(rv, "No matches\n")
	}
	if len(sr.Facets) > 0 {
		fmt.Fprintf(rv, "Facets:\n")
		for fn, f := range sr.Facets {
			fmt.Fprintf(rv, "%s(%d)\n", fn, f.Total)
			for _, t := range f.Terms.Terms() {
				fmt.Fprintf(rv, "\t%s(%d)\n", t.Term, t.Count)
			}
			for _, n := range f.NumericRanges {
				fmt.Fprintf(rv, "\t%s(%d)\n", n.Name, n.Count)
			}
			for _, d := range f.DateRanges {
				fmt.Fprintf(rv, "\t%s(%d)\n", d.Name, d.Count)
			}
			if f.Other != 0 {
				fmt.Fprintf(rv, "\tOther(%d)\n", f.Other)
			}
		}
	}
	return rv.String()
}

// formatHit is a helper function to format a single hit in the search result for
// the String() method of SearchResult
func formatHit(rv *strings.Builder, hit *search.DocumentMatch, hitNumber int) *strings.Builder {
	fmt.Fprintf(rv, "%5d. %s (%f)\n", hitNumber, hit.ID, hit.Score)
	for fragmentField, fragments := range hit.Fragments {
		fmt.Fprintf(rv, "\t%s\n", fragmentField)
		for _, fragment := range fragments {
			fmt.Fprintf(rv, "\t\t%s\n", fragment)
		}
	}
	for otherFieldName, otherFieldValue := range hit.Fields {
		if _, ok := hit.Fragments[otherFieldName]; !ok {
			fmt.Fprintf(rv, "\t%s\n", otherFieldName)
			fmt.Fprintf(rv, "\t\t%v\n", otherFieldValue)
		}
	}
	if len(hit.DecodedSort) > 0 {
		fmt.Fprintf(rv, "\t_sort: [")
		for k, v := range hit.DecodedSort {
			if k > 0 {
				fmt.Fprintf(rv, ", ")
			}
			fmt.Fprintf(rv, "%v", v)
		}
		fmt.Fprintf(rv, "]\n")
	}
	return rv
}

// Merge will merge together multiple SearchResults during a MultiSearch
func (sr *SearchResult) Merge(other *SearchResult) {
	sr.Status.Merge(other.Status)
	sr.Hits = append(sr.Hits, other.Hits...)
	sr.Total += other.Total
	sr.Cost += other.Cost
	if other.MaxScore > sr.MaxScore {
		sr.MaxScore = other.MaxScore
	}
	if sr.Facets == nil && len(other.Facets) != 0 {
		sr.Facets = other.Facets
		return
	}

	sr.Facets.Merge(other.Facets)
}

// MemoryNeededForSearchResult is an exported helper function to determine the RAM
// needed to accommodate the results for a given search request.
func MemoryNeededForSearchResult(req *SearchRequest) uint64 {
	if req == nil {
		return 0
	}

	numDocMatches := req.Size + req.From
	if req.Size+req.From > collector.PreAllocSizeSkipCap {
		numDocMatches = collector.PreAllocSizeSkipCap
	}

	estimate := 0

	// overhead from the SearchResult structure
	var sr SearchResult
	estimate += sr.Size()

	var dm search.DocumentMatch
	sizeOfDocumentMatch := dm.Size()

	// overhead from results
	estimate += numDocMatches * sizeOfDocumentMatch

	// overhead from facet results
	if req.Facets != nil {
		var fr search.FacetResult
		estimate += len(req.Facets) * fr.Size()
	}

	// overhead from fields, highlighting
	var d document.Document
	if len(req.Fields) > 0 || req.Highlight != nil {
		numDocsApplicable := req.Size
		if numDocsApplicable > collector.PreAllocSizeSkipCap {
			numDocsApplicable = collector.PreAllocSizeSkipCap
		}
		estimate += numDocsApplicable * d.Size()
	}

	return uint64(estimate)
}

// SetSortFunc sets the sort implementation to use when sorting hits.
//
// SearchRequests can specify a custom sort implementation to meet
// their needs. For instance, by specifying a parallel sort
// that uses all available cores.
func (r *SearchRequest) SetSortFunc(s func(sort.Interface)) {
	r.sortFunc = s
}

// SortFunc returns the sort implementation to use when sorting hits.
// Defaults to sort.Sort.
func (r *SearchRequest) SortFunc() func(data sort.Interface) {
	if r.sortFunc != nil {
		return r.sortFunc
	}

	return sort.Sort
}

func isMatchNoneQuery(q query.Query) bool {
	_, ok := q.(*query.MatchNoneQuery)
	return ok
}

func isMatchAllQuery(q query.Query) bool {
	_, ok := q.(*query.MatchAllQuery)
	return ok
}

// Checks if the request is hybrid search. Currently supports: RRF, RSF.
func IsScoreFusionRequested(req *SearchRequest) bool {
	switch req.Score {
	case ScoreRRF, ScoreRSF:
		return true
	default:
		return false
	}
}

// Additional parameters in the search request. Currently only being
// used for score fusion parameters.
type RequestParams struct {
	ScoreRankConstant int `json:"score_rank_constant,omitempty"`
	ScoreWindowSize   int `json:"score_window_size,omitempty"`
}

func NewDefaultParams(from, size int) *RequestParams {
	return &RequestParams{
		ScoreRankConstant: DefaultScoreRankConstant,
		ScoreWindowSize:   from + size,
	}
}

func (p *RequestParams) UnmarshalJSON(input []byte) error {
	var temp struct {
		ScoreRankConstant *int `json:"score_rank_constant,omitempty"`
		ScoreWindowSize   *int `json:"score_window_size,omitempty"`
	}

	if err := util.UnmarshalJSON(input, &temp); err != nil {
		return err
	}

	if temp.ScoreRankConstant != nil {
		p.ScoreRankConstant = *temp.ScoreRankConstant
	}

	if temp.ScoreWindowSize != nil {
		p.ScoreWindowSize = *temp.ScoreWindowSize
	}

	return nil
}

func (p *RequestParams) Validate(size int) error {
	if p.ScoreWindowSize < 1 {
		return fmt.Errorf("score window size must be greater than 0")
	} else if p.ScoreWindowSize < size {
		return fmt.Errorf("score window size must be greater than or equal to Size (%d)", size)
	}

	return nil
}

func ParseParams(r *SearchRequest, input []byte) (*RequestParams, error) {
	params := NewDefaultParams(r.From, r.Size)
	if len(input) == 0 {
		return params, nil
	}

	err := util.UnmarshalJSON(input, params)
	if err != nil {
		return nil, err
	}

	// validate params
	err = params.Validate(r.Size)
	if err != nil {
		return nil, err
	}

	return params, nil
}
