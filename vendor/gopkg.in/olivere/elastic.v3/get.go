// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"fmt"
	"net/url"
	"strings"

	"golang.org/x/net/context"

	"gopkg.in/olivere/elastic.v3/uritemplates"
)

// GetService allows to get a typed JSON document from the index based
// on its id.
//
// See https://www.elastic.co/guide/en/elasticsearch/reference/current/docs-get.html
// for details.
type GetService struct {
	client                        *Client
	pretty                        bool
	index                         string
	typ                           string
	id                            string
	routing                       string
	preference                    string
	fields                        []string
	refresh                       *bool
	realtime                      *bool
	fsc                           *FetchSourceContext
	version                       interface{}
	versionType                   string
	parent                        string
	ignoreErrorsOnGeneratedFields *bool
}

// NewGetService creates a new GetService.
func NewGetService(client *Client) *GetService {
	return &GetService{
		client: client,
		typ:    "_all",
	}
}

/*
// String returns a string representation of the GetService request.
func (s *GetService) String() string {
	return fmt.Sprintf("[%v][%v][%v]: routing [%v]",
		s.index,
		s.typ,
		s.id,
		s.routing)
}
*/

// Index is the name of the index.
func (s *GetService) Index(index string) *GetService {
	s.index = index
	return s
}

// Type is the type of the document (use `_all` to fetch the first document
// matching the ID across all types).
func (s *GetService) Type(typ string) *GetService {
	s.typ = typ
	return s
}

// Id is the document ID.
func (s *GetService) Id(id string) *GetService {
	s.id = id
	return s
}

// Parent is the ID of the parent document.
func (s *GetService) Parent(parent string) *GetService {
	s.parent = parent
	return s
}

// Routing is the specific routing value.
func (s *GetService) Routing(routing string) *GetService {
	s.routing = routing
	return s
}

// Preference specifies the node or shard the operation should be performed on (default: random).
func (s *GetService) Preference(preference string) *GetService {
	s.preference = preference
	return s
}

// Fields is a list of fields to return in the response.
func (s *GetService) Fields(fields ...string) *GetService {
	if s.fields == nil {
		s.fields = make([]string, 0)
	}
	s.fields = append(s.fields, fields...)
	return s
}

func (s *GetService) FetchSource(fetchSource bool) *GetService {
	if s.fsc == nil {
		s.fsc = NewFetchSourceContext(fetchSource)
	} else {
		s.fsc.SetFetchSource(fetchSource)
	}
	return s
}

func (s *GetService) FetchSourceContext(fetchSourceContext *FetchSourceContext) *GetService {
	s.fsc = fetchSourceContext
	return s
}

// Refresh the shard containing the document before performing the operation.
func (s *GetService) Refresh(refresh bool) *GetService {
	s.refresh = &refresh
	return s
}

// Realtime specifies whether to perform the operation in realtime or search mode.
func (s *GetService) Realtime(realtime bool) *GetService {
	s.realtime = &realtime
	return s
}

// VersionType is the specific version type.
func (s *GetService) VersionType(versionType string) *GetService {
	s.versionType = versionType
	return s
}

// Version is an explicit version number for concurrency control.
func (s *GetService) Version(version interface{}) *GetService {
	s.version = version
	return s
}

// IgnoreErrorsOnGeneratedFields indicates whether to ignore fields that
// are generated if the transaction log is accessed.
func (s *GetService) IgnoreErrorsOnGeneratedFields(ignore bool) *GetService {
	s.ignoreErrorsOnGeneratedFields = &ignore
	return s
}

// Pretty indicates that the JSON response be indented and human readable.
func (s *GetService) Pretty(pretty bool) *GetService {
	s.pretty = pretty
	return s
}

// Validate checks if the operation is valid.
func (s *GetService) Validate() error {
	var invalid []string
	if s.id == "" {
		invalid = append(invalid, "Id")
	}
	if s.index == "" {
		invalid = append(invalid, "Index")
	}
	if s.typ == "" {
		invalid = append(invalid, "Type")
	}
	if len(invalid) > 0 {
		return fmt.Errorf("missing required fields: %v", invalid)
	}
	return nil
}

// buildURL builds the URL for the operation.
func (s *GetService) buildURL() (string, url.Values, error) {
	// Build URL
	path, err := uritemplates.Expand("/{index}/{type}/{id}", map[string]string{
		"id":    s.id,
		"index": s.index,
		"type":  s.typ,
	})
	if err != nil {
		return "", url.Values{}, err
	}

	// Add query string parameters
	params := url.Values{}
	if s.pretty {
		params.Set("pretty", "1")
	}
	if s.routing != "" {
		params.Set("routing", s.routing)
	}
	if s.parent != "" {
		params.Set("parent", s.parent)
	}
	if s.preference != "" {
		params.Set("preference", s.preference)
	}
	if len(s.fields) > 0 {
		params.Set("fields", strings.Join(s.fields, ","))
	}
	if s.refresh != nil {
		params.Set("refresh", fmt.Sprintf("%v", *s.refresh))
	}
	if s.version != nil {
		params.Set("version", fmt.Sprintf("%v", s.version))
	}
	if s.versionType != "" {
		params.Set("version_type", s.versionType)
	}
	if s.realtime != nil {
		params.Set("realtime", fmt.Sprintf("%v", *s.realtime))
	}
	if s.ignoreErrorsOnGeneratedFields != nil {
		params.Add("ignore_errors_on_generated_fields", fmt.Sprintf("%v", *s.ignoreErrorsOnGeneratedFields))
	}
	if s.fsc != nil {
		for k, values := range s.fsc.Query() {
			params.Add(k, strings.Join(values, ","))
		}
	}
	return path, params, nil
}

// Do executes the operation.
func (s *GetService) Do() (*GetResult, error) {
	return s.DoC(nil)
}

// Do executes the operation.
func (s *GetService) DoC(ctx context.Context) (*GetResult, error) {
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
	ret := new(GetResult)
	if err := s.client.decoder.Decode(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// -- Result of a get request.

// GetResult is the outcome of GetService.Do.
type GetResult struct {
	Index     string                 `json:"_index"`     // index meta field
	Type      string                 `json:"_type"`      // type meta field
	Id        string                 `json:"_id"`        // id meta field
	Uid       string                 `json:"_uid"`       // uid meta field (see MapperService.java for all meta fields)
	Timestamp int64                  `json:"_timestamp"` // timestamp meta field
	TTL       int64                  `json:"_ttl"`       // ttl meta field
	Routing   string                 `json:"_routing"`   // routing meta field
	Parent    string                 `json:"_parent"`    // parent meta field
	Version   *int64                 `json:"_version"`   // version number, when Version is set to true in SearchService
	Source    *json.RawMessage       `json:"_source,omitempty"`
	Found     bool                   `json:"found,omitempty"`
	Fields    map[string]interface{} `json:"fields,omitempty"`
	//Error     string                 `json:"error,omitempty"` // used only in MultiGet
	// TODO double-check that MultiGet now returns details error information
	Error *ErrorDetails `json:"error,omitempty"` // only used in MultiGet
}
