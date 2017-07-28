// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"strings"

	"gopkg.in/olivere/elastic.v5/uritemplates"
)

// SuggestService returns suggestions for text.
// See https://www.elastic.co/guide/en/elasticsearch/reference/5.2/search-suggesters.html.
type SuggestService struct {
	client     *Client
	pretty     bool
	routing    string
	preference string
	index      []string
	suggesters []Suggester
}

// NewSuggestService creates a new instance of SuggestService.
func NewSuggestService(client *Client) *SuggestService {
	builder := &SuggestService{
		client: client,
	}
	return builder
}

// Index adds one or more indices to use for the suggestion request.
func (s *SuggestService) Index(index ...string) *SuggestService {
	s.index = append(s.index, index...)
	return s
}

// Pretty asks Elasticsearch to return indented JSON.
func (s *SuggestService) Pretty(pretty bool) *SuggestService {
	s.pretty = pretty
	return s
}

// Routing specifies the routing value.
func (s *SuggestService) Routing(routing string) *SuggestService {
	s.routing = routing
	return s
}

// Preference specifies the node or shard the operation should be
// performed on (default: random).
func (s *SuggestService) Preference(preference string) *SuggestService {
	s.preference = preference
	return s
}

// Suggester adds a suggester to the request.
func (s *SuggestService) Suggester(suggester Suggester) *SuggestService {
	s.suggesters = append(s.suggesters, suggester)
	return s
}

// buildURL builds the URL for the operation.
func (s *SuggestService) buildURL() (string, url.Values, error) {
	var err error
	var path string

	if len(s.index) > 0 {
		path, err = uritemplates.Expand("/{index}/_suggest", map[string]string{
			"index": strings.Join(s.index, ","),
		})
	} else {
		path = "/_suggest"
	}
	if err != nil {
		return "", url.Values{}, err
	}

	// Add query string parameters
	params := url.Values{}
	if s.pretty {
		params.Set("pretty", fmt.Sprintf("%v", s.pretty))
	}
	if s.routing != "" {
		params.Set("routing", s.routing)
	}
	if s.preference != "" {
		params.Set("preference", s.preference)
	}
	return path, params, nil
}

// Do executes the request.
func (s *SuggestService) Do(ctx context.Context) (SuggestResult, error) {
	path, params, err := s.buildURL()
	if err != nil {
		return nil, err
	}

	// Set body
	body := make(map[string]interface{})
	for _, s := range s.suggesters {
		src, err := s.Source(false)
		if err != nil {
			return nil, err
		}
		body[s.Name()] = src
	}

	// Get response
	res, err := s.client.PerformRequest(ctx, "POST", path, params, body)
	if err != nil {
		return nil, err
	}

	// There is a _shard object that cannot be deserialized.
	// So we use json.RawMessage instead.
	var suggestions map[string]*json.RawMessage
	if err := s.client.decoder.Decode(res.Body, &suggestions); err != nil {
		return nil, err
	}

	ret := make(SuggestResult)
	for name, result := range suggestions {
		if name != "_shards" {
			var sug []Suggestion
			if err := s.client.decoder.Decode(*result, &sug); err != nil {
				return nil, err
			}
			ret[name] = sug
		}
	}

	return ret, nil
}

// SuggestResult is the outcome of SuggestService.Do.
type SuggestResult map[string][]Suggestion

// Suggestion is a single suggester outcome.
type Suggestion struct {
	Text    string             `json:"text"`
	Offset  int                `json:"offset"`
	Length  int                `json:"length"`
	Options []suggestionOption `json:"options"`
}

type suggestionOption struct {
	Text         string      `json:"text"`
	Score        float64     `json:"score"`
	Freq         int         `json:"freq"`
	Payload      interface{} `json:"payload"`
	CollateMatch bool        `json:"collate_match"`
}
