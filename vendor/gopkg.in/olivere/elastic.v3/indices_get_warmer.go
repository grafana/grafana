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

// IndicesGetWarmerService allows to get the definition of a warmer for a
// specific index (or alias, or several indices) based on its name.
// The provided name can be a simple wildcard expression or omitted to get
// all warmers.
//
// See https://www.elastic.co/guide/en/elasticsearch/reference/current/indices-warmers.html
// for more information.
type IndicesGetWarmerService struct {
	client            *Client
	pretty            bool
	index             []string
	name              []string
	typ               []string
	allowNoIndices    *bool
	expandWildcards   string
	ignoreUnavailable *bool
	local             *bool
}

// NewIndicesGetWarmerService creates a new IndicesGetWarmerService.
func NewIndicesGetWarmerService(client *Client) *IndicesGetWarmerService {
	return &IndicesGetWarmerService{
		client: client,
		typ:    make([]string, 0),
		index:  make([]string, 0),
		name:   make([]string, 0),
	}
}

// Index is a list of index names to restrict the operation; use `_all` to perform the operation on all indices.
func (s *IndicesGetWarmerService) Index(indices ...string) *IndicesGetWarmerService {
	s.index = append(s.index, indices...)
	return s
}

// Name is the name of the warmer (supports wildcards); leave empty to get all warmers.
func (s *IndicesGetWarmerService) Name(name ...string) *IndicesGetWarmerService {
	s.name = append(s.name, name...)
	return s
}

// Type is a list of type names the mapping should be added to
// (supports wildcards); use `_all` or omit to add the mapping on all types.
func (s *IndicesGetWarmerService) Type(typ ...string) *IndicesGetWarmerService {
	s.typ = append(s.typ, typ...)
	return s
}

// AllowNoIndices indicates whether to ignore if a wildcard indices
// expression resolves into no concrete indices.
// This includes `_all` string or when no indices have been specified.
func (s *IndicesGetWarmerService) AllowNoIndices(allowNoIndices bool) *IndicesGetWarmerService {
	s.allowNoIndices = &allowNoIndices
	return s
}

// ExpandWildcards indicates whether to expand wildcard expression to
// concrete indices that are open, closed or both.
func (s *IndicesGetWarmerService) ExpandWildcards(expandWildcards string) *IndicesGetWarmerService {
	s.expandWildcards = expandWildcards
	return s
}

// IgnoreUnavailable indicates whether specified concrete indices should be
// ignored when unavailable (missing or closed).
func (s *IndicesGetWarmerService) IgnoreUnavailable(ignoreUnavailable bool) *IndicesGetWarmerService {
	s.ignoreUnavailable = &ignoreUnavailable
	return s
}

// Local indicates wether or not to return local information,
// do not retrieve the state from master node (default: false).
func (s *IndicesGetWarmerService) Local(local bool) *IndicesGetWarmerService {
	s.local = &local
	return s
}

// Pretty indicates that the JSON response be indented and human readable.
func (s *IndicesGetWarmerService) Pretty(pretty bool) *IndicesGetWarmerService {
	s.pretty = pretty
	return s
}

// buildURL builds the URL for the operation.
func (s *IndicesGetWarmerService) buildURL() (string, url.Values, error) {
	var err error
	var path string

	if len(s.index) == 0 && len(s.typ) == 0 && len(s.name) == 0 {
		path = "/_warmer"
	} else if len(s.index) == 0 && len(s.typ) == 0 && len(s.name) > 0 {
		path, err = uritemplates.Expand("/_warmer/{name}", map[string]string{
			"name": strings.Join(s.name, ","),
		})
	} else if len(s.index) == 0 && len(s.typ) > 0 && len(s.name) == 0 {
		path, err = uritemplates.Expand("/_all/{type}/_warmer", map[string]string{
			"type": strings.Join(s.typ, ","),
		})
	} else if len(s.index) == 0 && len(s.typ) > 0 && len(s.name) > 0 {
		path, err = uritemplates.Expand("/_all/{type}/_warmer/{name}", map[string]string{
			"type": strings.Join(s.typ, ","),
			"name": strings.Join(s.name, ","),
		})
	} else if len(s.index) > 0 && len(s.typ) == 0 && len(s.name) == 0 {
		path, err = uritemplates.Expand("/{index}/_warmer", map[string]string{
			"index": strings.Join(s.index, ","),
		})
	} else if len(s.index) > 0 && len(s.typ) == 0 && len(s.name) > 0 {
		path, err = uritemplates.Expand("/{index}/_warmer/{name}", map[string]string{
			"index": strings.Join(s.index, ","),
			"name":  strings.Join(s.name, ","),
		})
	} else if len(s.index) > 0 && len(s.typ) > 0 && len(s.name) == 0 {
		path, err = uritemplates.Expand("/{index}/{type}/_warmer", map[string]string{
			"index": strings.Join(s.index, ","),
			"type":  strings.Join(s.typ, ","),
		})
	} else if len(s.index) > 0 && len(s.typ) > 0 && len(s.name) > 0 {
		path, err = uritemplates.Expand("/{index}/{type}/_warmer/{name}", map[string]string{
			"index": strings.Join(s.index, ","),
			"type":  strings.Join(s.typ, ","),
			"name":  strings.Join(s.name, ","),
		})
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
	if s.ignoreUnavailable != nil {
		params.Set("ignore_unavailable", fmt.Sprintf("%v", *s.ignoreUnavailable))
	}
	if s.local != nil {
		params.Set("local", fmt.Sprintf("%v", *s.local))
	}
	return path, params, nil
}

// Validate checks if the operation is valid.
func (s *IndicesGetWarmerService) Validate() error {
	return nil
}

// Do executes the operation.
func (s *IndicesGetWarmerService) Do() (map[string]interface{}, error) {
	return s.DoC(nil)
}

// DoC executes the operation.
func (s *IndicesGetWarmerService) DoC(ctx context.Context) (map[string]interface{}, error) {
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
	res, err := s.client.PerformRequestC(ctx, "GET", path, params, nil)
	if err != nil {
		return nil, err
	}

	// Return operation response
	var ret map[string]interface{}
	if err := s.client.decoder.Decode(res.Body, &ret); err != nil {
		return nil, err
	}
	return ret, nil
}
