// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"context"
	"fmt"
	"net/url"

	"gopkg.in/olivere/elastic.v5/uritemplates"
)

// IndicesAnalyzeService performs the analysis process on a text and returns
// the tokens breakdown of the text.
//
// See https://www.elastic.co/guide/en/elasticsearch/reference/5.2/indices-analyze.html
// for detail.
type IndicesAnalyzeService struct {
	client      *Client
	pretty      bool
	index       string
	request     *IndicesAnalyzeRequest
	format      string
	preferLocal *bool
	bodyJson    interface{}
	bodyString  string
}

// NewIndicesAnalyzeService creates a new IndicesAnalyzeService.
func NewIndicesAnalyzeService(client *Client) *IndicesAnalyzeService {
	return &IndicesAnalyzeService{
		client:  client,
		request: new(IndicesAnalyzeRequest),
	}
}

// Index is the name of the index to scope the operation.
func (s *IndicesAnalyzeService) Index(index string) *IndicesAnalyzeService {
	s.index = index
	return s
}

// Format of the output.
func (s *IndicesAnalyzeService) Format(format string) *IndicesAnalyzeService {
	s.format = format
	return s
}

// PreferLocal, when true, specifies that a local shard should be used
// if available. When false, a random shard is used (default: true).
func (s *IndicesAnalyzeService) PreferLocal(preferLocal bool) *IndicesAnalyzeService {
	s.preferLocal = &preferLocal
	return s
}

// Request passes the analyze request to use.
func (s *IndicesAnalyzeService) Request(request *IndicesAnalyzeRequest) *IndicesAnalyzeService {
	if request == nil {
		s.request = new(IndicesAnalyzeRequest)
	} else {
		s.request = request
	}
	return s
}

// Analyzer is the name of the analyzer to use.
func (s *IndicesAnalyzeService) Analyzer(analyzer string) *IndicesAnalyzeService {
	s.request.Analyzer = analyzer
	return s
}

// Attributes is a list of token attributes to output; this parameter works
// only with explain=true.
func (s *IndicesAnalyzeService) Attributes(attributes ...string) *IndicesAnalyzeService {
	s.request.Attributes = attributes
	return s
}

// CharFilter is a list of character filters to use for the analysis.
func (s *IndicesAnalyzeService) CharFilter(charFilter ...string) *IndicesAnalyzeService {
	s.request.CharFilter = charFilter
	return s
}

// Explain, when true, outputs more advanced details (default: false).
func (s *IndicesAnalyzeService) Explain(explain bool) *IndicesAnalyzeService {
	s.request.Explain = explain
	return s
}

// Field specifies to use a specific analyzer configured for this field (instead of passing the analyzer name).
func (s *IndicesAnalyzeService) Field(field string) *IndicesAnalyzeService {
	s.request.Field = field
	return s
}

// Filter is a list of filters to use for the analysis.
func (s *IndicesAnalyzeService) Filter(filter ...string) *IndicesAnalyzeService {
	s.request.Filter = filter
	return s
}

// Text is the text on which the analysis should be performed (when request body is not used).
func (s *IndicesAnalyzeService) Text(text ...string) *IndicesAnalyzeService {
	s.request.Text = text
	return s
}

// Tokenizer is the name of the tokenizer to use for the analysis.
func (s *IndicesAnalyzeService) Tokenizer(tokenizer string) *IndicesAnalyzeService {
	s.request.Tokenizer = tokenizer
	return s
}

// Pretty indicates that the JSON response be indented and human readable.
func (s *IndicesAnalyzeService) Pretty(pretty bool) *IndicesAnalyzeService {
	s.pretty = pretty
	return s
}

// BodyJson is the text on which the analysis should be performed.
func (s *IndicesAnalyzeService) BodyJson(body interface{}) *IndicesAnalyzeService {
	s.bodyJson = body
	return s
}

// BodyString is the text on which the analysis should be performed.
func (s *IndicesAnalyzeService) BodyString(body string) *IndicesAnalyzeService {
	s.bodyString = body
	return s
}

// buildURL builds the URL for the operation.
func (s *IndicesAnalyzeService) buildURL() (string, url.Values, error) {
	// Build URL
	var err error
	var path string

	if s.index == "" {
		path = "/_analyze"
	} else {
		path, err = uritemplates.Expand("/{index}/_analyze", map[string]string{
			"index": s.index,
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
	if s.format != "" {
		params.Set("format", s.format)
	}
	if s.preferLocal != nil {
		params.Set("prefer_local", fmt.Sprintf("%v", *s.preferLocal))
	}

	return path, params, nil
}

// Do will execute the request with the given context.
func (s *IndicesAnalyzeService) Do(ctx context.Context) (*IndicesAnalyzeResponse, error) {
	// Check pre-conditions
	if err := s.Validate(); err != nil {
		return nil, err
	}

	path, params, err := s.buildURL()
	if err != nil {
		return nil, err
	}

	// Setup HTTP request body
	var body interface{}
	if s.bodyJson != nil {
		body = s.bodyJson
	} else if s.bodyString != "" {
		body = s.bodyString
	} else {
		// Request parameters are deprecated in 5.1.1, and we must use a JSON
		// structure in the body to pass the parameters.
		// See https://www.elastic.co/guide/en/elasticsearch/reference/5.2/indices-analyze.html
		body = s.request
	}

	res, err := s.client.PerformRequest(ctx, "POST", path, params, body)
	if err != nil {
		return nil, err
	}

	ret := new(IndicesAnalyzeResponse)
	if err = s.client.decoder.Decode(res.Body, ret); err != nil {
		return nil, err
	}

	return ret, nil
}

func (s *IndicesAnalyzeService) Validate() error {
	var invalid []string
	if s.bodyJson == nil && s.bodyString == "" {
		if len(s.request.Text) == 0 {
			invalid = append(invalid, "Text")
		}
	}
	if len(invalid) > 0 {
		return fmt.Errorf("missing required fields: %v", invalid)
	}
	return nil
}

// IndicesAnalyzeRequest specifies the parameters of the analyze request.
type IndicesAnalyzeRequest struct {
	Text       []string `json:"text,omitempty"`
	Analyzer   string   `json:"analyzer,omitempty"`
	Tokenizer  string   `json:"tokenizer,omitempty"`
	Filter     []string `json:"filter,omitempty"`
	CharFilter []string `json:"char_filter,omitempty"`
	Field      string   `json:"field,omitempty"`
	Explain    bool     `json:"explain,omitempty"`
	Attributes []string `json:"attributes,omitempty"`
}

type IndicesAnalyzeResponse struct {
	Tokens []IndicesAnalyzeResponseToken `json:"tokens"` // json part for normal message
	Detail IndicesAnalyzeResponseDetail  `json:"detail"` // json part for verbose message of explain request
}

type IndicesAnalyzeResponseToken struct {
	Token       string `json:"token"`
	StartOffset int    `json:"start_offset"`
	EndOffset   int    `json:"end_offset"`
	Type        string `json:"type"`
	Position    int    `json:"position"`
}

type IndicesAnalyzeResponseDetail struct {
	CustomAnalyzer bool          `json:"custom_analyzer"`
	Charfilters    []interface{} `json:"charfilters"`
	Analyzer       struct {
		Name   string `json:"name"`
		Tokens []struct {
			Token          string `json:"token"`
			StartOffset    int    `json:"start_offset"`
			EndOffset      int    `json:"end_offset"`
			Type           string `json:"type"`
			Position       int    `json:"position"`
			Bytes          string `json:"bytes"`
			PositionLength int    `json:"positionLength"`
		} `json:"tokens"`
	} `json:"analyzer"`
	Tokenizer struct {
		Name   string `json:"name"`
		Tokens []struct {
			Token       string `json:"token"`
			StartOffset int    `json:"start_offset"`
			EndOffset   int    `json:"end_offset"`
			Type        string `json:"type"`
			Position    int    `json:"position"`
		} `json:"tokens"`
	} `json:"tokenizer"`
	Tokenfilters []struct {
		Name   string `json:"name"`
		Tokens []struct {
			Token       string `json:"token"`
			StartOffset int    `json:"start_offset"`
			EndOffset   int    `json:"end_offset"`
			Type        string `json:"type"`
			Position    int    `json:"position"`
			Keyword     bool   `json:"keyword"`
		} `json:"tokens"`
	} `json:"tokenfilters"`
}
