// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"errors"
	"fmt"
	"io"
	"net/url"
	"strings"

	"gopkg.in/olivere/elastic.v3/uritemplates"
)

const (
	defaultKeepAlive = "5m"
)

var (
	// End of stream (or scan)
	EOS = io.EOF

	// No ScrollId
	ErrNoScrollId = errors.New("no scrollId")
)

// ScanService manages a cursor through documents in Elasticsearch.
type ScanService struct {
	client       *Client
	indices      []string
	types        []string
	keepAlive    string
	body         interface{}
	searchSource *SearchSource
	pretty       bool
	routing      string
	preference   string
	size         *int
}

// NewScanService creates a new service to iterate through the results
// of a query.
func NewScanService(client *Client) *ScanService {
	builder := &ScanService{
		client:       client,
		searchSource: NewSearchSource().Query(NewMatchAllQuery()),
	}
	return builder
}

// Index sets the name(s) of the index to use for scan.
func (s *ScanService) Index(indices ...string) *ScanService {
	if s.indices == nil {
		s.indices = make([]string, 0)
	}
	s.indices = append(s.indices, indices...)
	return s
}

// Types allows to restrict the scan to a list of types.
func (s *ScanService) Type(types ...string) *ScanService {
	if s.types == nil {
		s.types = make([]string, 0)
	}
	s.types = append(s.types, types...)
	return s
}

// Scroll is an alias for KeepAlive, the time to keep
// the cursor alive (e.g. "5m" for 5 minutes).
func (s *ScanService) Scroll(keepAlive string) *ScanService {
	s.keepAlive = keepAlive
	return s
}

// KeepAlive sets the maximum time the cursor will be
// available before expiration (e.g. "5m" for 5 minutes).
func (s *ScanService) KeepAlive(keepAlive string) *ScanService {
	s.keepAlive = keepAlive
	return s
}

// Fields tells Elasticsearch to only load specific fields from a search hit.
// See http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-request-fields.html.
func (s *ScanService) Fields(fields ...string) *ScanService {
	s.searchSource = s.searchSource.Fields(fields...)
	return s
}

// Body sets the raw body to send to Elasticsearch. This can be e.g. a string,
// a map[string]interface{} or anything that can be serialized into JSON.
// Notice that setting the body disables the use of SearchSource and many
// other properties of the ScanService.
func (s *ScanService) Body(body interface{}) *ScanService {
	s.body = body
	return s
}

// SearchSource sets the search source builder to use with this service.
func (s *ScanService) SearchSource(searchSource *SearchSource) *ScanService {
	s.searchSource = searchSource
	if s.searchSource == nil {
		s.searchSource = NewSearchSource().Query(NewMatchAllQuery())
	}
	return s
}

// Routing allows for (a comma-separated) list of specific routing values.
func (s *ScanService) Routing(routings ...string) *ScanService {
	s.routing = strings.Join(routings, ",")
	return s
}

// Preference specifies the node or shard the operation should be
// performed on (default: "random").
func (s *ScanService) Preference(preference string) *ScanService {
	s.preference = preference
	return s
}

// Query sets the query to perform, e.g. MatchAllQuery.
func (s *ScanService) Query(query Query) *ScanService {
	s.searchSource = s.searchSource.Query(query)
	return s
}

// PostFilter is executed as the last filter. It only affects the
// search hits but not facets. See
// http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-request-post-filter.html
// for details.
func (s *ScanService) PostFilter(postFilter Query) *ScanService {
	s.searchSource = s.searchSource.PostFilter(postFilter)
	return s
}

// FetchSource indicates whether the response should contain the stored
// _source for every hit.
func (s *ScanService) FetchSource(fetchSource bool) *ScanService {
	s.searchSource = s.searchSource.FetchSource(fetchSource)
	return s
}

// FetchSourceContext indicates how the _source should be fetched.
func (s *ScanService) FetchSourceContext(fetchSourceContext *FetchSourceContext) *ScanService {
	s.searchSource = s.searchSource.FetchSourceContext(fetchSourceContext)
	return s
}

// Version can be set to true to return a version for each search hit.
// See http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-request-version.html.
func (s *ScanService) Version(version bool) *ScanService {
	s.searchSource = s.searchSource.Version(version)
	return s
}

// Sort the results by the given field, in the given order.
// Use the alternative SortWithInfo to use a struct to define the sorting.
// See http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-request-sort.html
// for detailed documentation of sorting.
func (s *ScanService) Sort(field string, ascending bool) *ScanService {
	s.searchSource = s.searchSource.Sort(field, ascending)
	return s
}

// SortWithInfo defines how to sort results.
// Use the Sort func for a shortcut.
// See http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-request-sort.html
// for detailed documentation of sorting.
func (s *ScanService) SortWithInfo(info SortInfo) *ScanService {
	s.searchSource = s.searchSource.SortWithInfo(info)
	return s
}

// SortBy defines how to sort results.
// Use the Sort func for a shortcut.
// See http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/search-request-sort.html
// for detailed documentation of sorting.
func (s *ScanService) SortBy(sorter ...Sorter) *ScanService {
	s.searchSource = s.searchSource.SortBy(sorter...)
	return s
}

// Pretty enables the caller to indent the JSON output.
func (s *ScanService) Pretty(pretty bool) *ScanService {
	s.pretty = pretty
	return s
}

// Size is the number of results to return per shard, not per request.
// So a size of 10 which hits 5 shards will return a maximum of 50 results
// per scan request.
func (s *ScanService) Size(size int) *ScanService {
	s.size = &size
	return s
}

// Do executes the query and returns a "server-side cursor".
func (s *ScanService) Do() (*ScanCursor, error) {
	// Build url
	path := "/"

	// Indices part
	indexPart := make([]string, 0)
	for _, index := range s.indices {
		index, err := uritemplates.Expand("{index}", map[string]string{
			"index": index,
		})
		if err != nil {
			return nil, err
		}
		indexPart = append(indexPart, index)
	}
	if len(indexPart) > 0 {
		path += strings.Join(indexPart, ",")
	}

	// Types
	typesPart := make([]string, 0)
	for _, typ := range s.types {
		typ, err := uritemplates.Expand("{type}", map[string]string{
			"type": typ,
		})
		if err != nil {
			return nil, err
		}
		typesPart = append(typesPart, typ)
	}
	if len(typesPart) > 0 {
		path += "/" + strings.Join(typesPart, ",")
	}

	// Search
	path += "/_search"

	// Parameters
	params := make(url.Values)
	if s.pretty {
		params.Set("pretty", fmt.Sprintf("%v", s.pretty))
	}
	if s.keepAlive != "" {
		params.Set("scroll", s.keepAlive)
	} else {
		params.Set("scroll", defaultKeepAlive)
	}
	if s.size != nil && *s.size > 0 {
		params.Set("size", fmt.Sprintf("%d", *s.size))
	}
	if s.routing != "" {
		params.Set("routing", s.routing)
	}

	// Get response
	var err error
	var body interface{}
	if s.body != nil {
		body = s.body
	} else {
		if !s.searchSource.hasSort() {
			// TODO: ES 2.1 deprecates search_type=scan. See https://www.elastic.co/guide/en/elasticsearch/reference/current/breaking_21_search_changes.html#_literal_search_type_scan_literal_deprecated.
			params.Set("search_type", "scan")
		}
		body, err = s.searchSource.Source()
		if err != nil {
			return nil, err
		}
	}
	res, err := s.client.PerformRequest("POST", path, params, body)
	if err != nil {
		return nil, err
	}

	// Return result
	searchResult := new(SearchResult)
	if err := s.client.decoder.Decode(res.Body, searchResult); err != nil {
		return nil, err
	}

	cursor := NewScanCursor(s.client, s.keepAlive, s.pretty, searchResult)

	return cursor, nil
}

// scanCursor represents a single page of results from
// an Elasticsearch Scan operation.
type ScanCursor struct {
	Results *SearchResult

	client      *Client
	keepAlive   string
	pretty      bool
	currentPage int
}

// newScanCursor returns a new initialized instance
// of scanCursor.
func NewScanCursor(client *Client, keepAlive string, pretty bool, searchResult *SearchResult) *ScanCursor {
	return &ScanCursor{
		client:    client,
		keepAlive: keepAlive,
		pretty:    pretty,
		Results:   searchResult,
	}
}

// TotalHits is a convenience method that returns the number
// of hits the cursor will iterate through.
func (c *ScanCursor) TotalHits() int64 {
	if c.Results.Hits == nil {
		return 0
	}
	return c.Results.Hits.TotalHits
}

// Next returns the next search result or nil when all
// documents have been scanned.
//
// Usage:
//
//   for {
//     res, err := cursor.Next()
//     if err == elastic.EOS {
//       // End of stream (or scan)
//       break
//     }
//     if err != nil {
//       // Handle error
//     }
//     // Work with res
//   }
//
func (c *ScanCursor) Next() (*SearchResult, error) {
	if c.currentPage > 0 {
		if c.Results.Hits == nil || len(c.Results.Hits.Hits) == 0 || c.Results.Hits.TotalHits == 0 {
			return nil, EOS
		}
	}
	if c.Results.ScrollId == "" {
		return nil, EOS
	}

	// Build url
	path := "/_search/scroll"

	// Parameters
	params := make(url.Values)
	if c.pretty {
		params.Set("pretty", fmt.Sprintf("%v", c.pretty))
	}
	if c.keepAlive != "" {
		params.Set("scroll", c.keepAlive)
	} else {
		params.Set("scroll", defaultKeepAlive)
	}

	// Set body
	body := c.Results.ScrollId

	// Get response
	res, err := c.client.PerformRequest("POST", path, params, body)
	if err != nil {
		return nil, err
	}

	// Return result
	c.Results = &SearchResult{ScrollId: body}
	if err := c.client.decoder.Decode(res.Body, c.Results); err != nil {
		return nil, err
	}

	c.currentPage += 1

	return c.Results, nil
}
