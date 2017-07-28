// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"fmt"
	"net/url"
	"strings"

	"golang.org/x/net/context"

	"gopkg.in/olivere/elastic.v3/uritemplates"
)

// IndicesForcemergeService allows to force merging of one or more indices.
// The merge relates to the number of segments a Lucene index holds
// within each shard. The force merge operation allows to reduce the number
// of segments by merging them.
//
// See http://www.elastic.co/guide/en/elasticsearch/reference/2.1/indices-forcemerge.html
// for more information.
type IndicesForcemergeService struct {
	client             *Client
	pretty             bool
	index              []string
	allowNoIndices     *bool
	expandWildcards    string
	flush              *bool
	ignoreUnavailable  *bool
	maxNumSegments     interface{}
	onlyExpungeDeletes *bool
	operationThreading interface{}
	waitForMerge       *bool
}

// NewIndicesForcemergeService creates a new IndicesForcemergeService.
func NewIndicesForcemergeService(client *Client) *IndicesForcemergeService {
	return &IndicesForcemergeService{
		client: client,
		index:  make([]string, 0),
	}
}

// Index is a list of index names; use `_all` or empty string to perform
// the operation on all indices.
func (s *IndicesForcemergeService) Index(index ...string) *IndicesForcemergeService {
	if s.index == nil {
		s.index = make([]string, 0)
	}
	s.index = append(s.index, index...)
	return s
}

// AllowNoIndices indicates whether to ignore if a wildcard indices
// expression resolves into no concrete indices.
// (This includes `_all` string or when no indices have been specified).
func (s *IndicesForcemergeService) AllowNoIndices(allowNoIndices bool) *IndicesForcemergeService {
	s.allowNoIndices = &allowNoIndices
	return s
}

// ExpandWildcards indicates whether to expand wildcard expression to
// concrete indices that are open, closed or both..
func (s *IndicesForcemergeService) ExpandWildcards(expandWildcards string) *IndicesForcemergeService {
	s.expandWildcards = expandWildcards
	return s
}

// Flush specifies whether the index should be flushed after performing
// the operation (default: true).
func (s *IndicesForcemergeService) Flush(flush bool) *IndicesForcemergeService {
	s.flush = &flush
	return s
}

// IgnoreUnavailable indicates whether specified concrete indices should
// be ignored when unavailable (missing or closed).
func (s *IndicesForcemergeService) IgnoreUnavailable(ignoreUnavailable bool) *IndicesForcemergeService {
	s.ignoreUnavailable = &ignoreUnavailable
	return s
}

// MaxNumSegments specifies the number of segments the index should be
// merged into (default: dynamic).
func (s *IndicesForcemergeService) MaxNumSegments(maxNumSegments interface{}) *IndicesForcemergeService {
	s.maxNumSegments = maxNumSegments
	return s
}

// OnlyExpungeDeletes specifies whether the operation should only expunge
// deleted documents.
func (s *IndicesForcemergeService) OnlyExpungeDeletes(onlyExpungeDeletes bool) *IndicesForcemergeService {
	s.onlyExpungeDeletes = &onlyExpungeDeletes
	return s
}

func (s *IndicesForcemergeService) OperationThreading(operationThreading interface{}) *IndicesForcemergeService {
	s.operationThreading = operationThreading
	return s
}

// WaitForMerge specifies whether the request should block until the
// merge process is finished (default: true).
func (s *IndicesForcemergeService) WaitForMerge(waitForMerge bool) *IndicesForcemergeService {
	s.waitForMerge = &waitForMerge
	return s
}

// Pretty indicates that the JSON response be indented and human readable.
func (s *IndicesForcemergeService) Pretty(pretty bool) *IndicesForcemergeService {
	s.pretty = pretty
	return s
}

// buildURL builds the URL for the operation.
func (s *IndicesForcemergeService) buildURL() (string, url.Values, error) {
	var err error
	var path string

	// Build URL
	if len(s.index) > 0 {
		path, err = uritemplates.Expand("/{index}/_forcemerge", map[string]string{
			"index": strings.Join(s.index, ","),
		})
	} else {
		path = "/_forcemerge"
	}
	if err != nil {
		return "", url.Values{}, err
	}

	// Add query string parameters
	params := url.Values{}
	if s.pretty {
		params.Set("pretty", "1")
	}
	if s.allowNoIndices != nil {
		params.Set("allow_no_indices", fmt.Sprintf("%v", *s.allowNoIndices))
	}
	if s.expandWildcards != "" {
		params.Set("expand_wildcards", s.expandWildcards)
	}
	if s.flush != nil {
		params.Set("flush", fmt.Sprintf("%v", *s.flush))
	}
	if s.ignoreUnavailable != nil {
		params.Set("ignore_unavailable", fmt.Sprintf("%v", *s.ignoreUnavailable))
	}
	if s.maxNumSegments != nil {
		params.Set("max_num_segments", fmt.Sprintf("%v", s.maxNumSegments))
	}
	if s.onlyExpungeDeletes != nil {
		params.Set("only_expunge_deletes", fmt.Sprintf("%v", *s.onlyExpungeDeletes))
	}
	if s.operationThreading != nil {
		params.Set("operation_threading", fmt.Sprintf("%v", s.operationThreading))
	}
	if s.waitForMerge != nil {
		params.Set("wait_for_merge", fmt.Sprintf("%v", *s.waitForMerge))
	}
	return path, params, nil
}

// Validate checks if the operation is valid.
func (s *IndicesForcemergeService) Validate() error {
	return nil
}

// Do executes the operation.
func (s *IndicesForcemergeService) Do() (*IndicesForcemergeResponse, error) {
	return s.DoC(nil)
}

// DoC executes the operation.
func (s *IndicesForcemergeService) DoC(ctx context.Context) (*IndicesForcemergeResponse, error) {
	// Check pre-conditions
	if err := s.Validate(); err != nil {
		return nil, err
	}

	// Get URL for request
	path, params, err := s.buildURL()
	if err != nil {
		return nil, err
	}

	// Get HTTP response
	res, err := s.client.PerformRequestC(ctx, "POST", path, params, nil)
	if err != nil {
		return nil, err
	}

	// Return operation response
	ret := new(IndicesForcemergeResponse)
	if err := s.client.decoder.Decode(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// IndicesForcemergeResponse is the response of IndicesForcemergeService.Do.
type IndicesForcemergeResponse struct {
	Shards shardsInfo `json:"_shards"`
}
