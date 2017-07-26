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

// MultiTermvectorService returns information and statistics on terms in the
// fields of a particular document. The document could be stored in the
// index or artificially provided by the user.
//
// See https://www.elastic.co/guide/en/elasticsearch/reference/5.2/docs-multi-termvectors.html
// for documentation.
type MultiTermvectorService struct {
	client          *Client
	pretty          bool
	index           string
	typ             string
	fieldStatistics *bool
	fields          []string
	ids             []string
	offsets         *bool
	parent          string
	payloads        *bool
	positions       *bool
	preference      string
	realtime        *bool
	routing         string
	termStatistics  *bool
	version         interface{}
	versionType     string
	bodyJson        interface{}
	bodyString      string
	docs            []*MultiTermvectorItem
}

// NewMultiTermvectorService creates a new MultiTermvectorService.
func NewMultiTermvectorService(client *Client) *MultiTermvectorService {
	return &MultiTermvectorService{
		client: client,
	}
}

// Pretty indicates that the JSON response be indented and human readable.
func (s *MultiTermvectorService) Pretty(pretty bool) *MultiTermvectorService {
	s.pretty = pretty
	return s
}

// Add adds documents to MultiTermvectors service.
func (s *MultiTermvectorService) Add(docs ...*MultiTermvectorItem) *MultiTermvectorService {
	s.docs = append(s.docs, docs...)
	return s
}

// Index in which the document resides.
func (s *MultiTermvectorService) Index(index string) *MultiTermvectorService {
	s.index = index
	return s
}

// Type of the document.
func (s *MultiTermvectorService) Type(typ string) *MultiTermvectorService {
	s.typ = typ
	return s
}

// FieldStatistics specifies if document count, sum of document frequencies and sum of total term frequencies should be returned. Applies to all returned documents unless otherwise specified in body "params" or "docs".
func (s *MultiTermvectorService) FieldStatistics(fieldStatistics bool) *MultiTermvectorService {
	s.fieldStatistics = &fieldStatistics
	return s
}

// Fields is a comma-separated list of fields to return. Applies to all returned documents unless otherwise specified in body "params" or "docs".
func (s *MultiTermvectorService) Fields(fields []string) *MultiTermvectorService {
	s.fields = fields
	return s
}

// Ids is a comma-separated list of documents ids. You must define ids as parameter or set "ids" or "docs" in the request body.
func (s *MultiTermvectorService) Ids(ids []string) *MultiTermvectorService {
	s.ids = ids
	return s
}

// Offsets specifies if term offsets should be returned. Applies to all returned documents unless otherwise specified in body "params" or "docs".
func (s *MultiTermvectorService) Offsets(offsets bool) *MultiTermvectorService {
	s.offsets = &offsets
	return s
}

// Parent id of documents. Applies to all returned documents unless otherwise specified in body "params" or "docs".
func (s *MultiTermvectorService) Parent(parent string) *MultiTermvectorService {
	s.parent = parent
	return s
}

// Payloads specifies if term payloads should be returned. Applies to all returned documents unless otherwise specified in body "params" or "docs".
func (s *MultiTermvectorService) Payloads(payloads bool) *MultiTermvectorService {
	s.payloads = &payloads
	return s
}

// Positions specifies if term positions should be returned. Applies to all returned documents unless otherwise specified in body "params" or "docs".
func (s *MultiTermvectorService) Positions(positions bool) *MultiTermvectorService {
	s.positions = &positions
	return s
}

// Preference specifies the node or shard the operation should be performed on (default: random). Applies to all returned documents unless otherwise specified in body "params" or "docs".
func (s *MultiTermvectorService) Preference(preference string) *MultiTermvectorService {
	s.preference = preference
	return s
}

// Realtime specifies if requests are real-time as opposed to near-real-time (default: true).
func (s *MultiTermvectorService) Realtime(realtime bool) *MultiTermvectorService {
	s.realtime = &realtime
	return s
}

// Routing specific routing value. Applies to all returned documents unless otherwise specified in body "params" or "docs".
func (s *MultiTermvectorService) Routing(routing string) *MultiTermvectorService {
	s.routing = routing
	return s
}

// TermStatistics specifies if total term frequency and document frequency should be returned. Applies to all returned documents unless otherwise specified in body "params" or "docs".
func (s *MultiTermvectorService) TermStatistics(termStatistics bool) *MultiTermvectorService {
	s.termStatistics = &termStatistics
	return s
}

// Version is explicit version number for concurrency control.
func (s *MultiTermvectorService) Version(version interface{}) *MultiTermvectorService {
	s.version = version
	return s
}

// VersionType is specific version type.
func (s *MultiTermvectorService) VersionType(versionType string) *MultiTermvectorService {
	s.versionType = versionType
	return s
}

// BodyJson is documented as: Define ids, documents, parameters or a list of parameters per document here. You must at least provide a list of document ids. See documentation..
func (s *MultiTermvectorService) BodyJson(body interface{}) *MultiTermvectorService {
	s.bodyJson = body
	return s
}

// BodyString is documented as: Define ids, documents, parameters or a list of parameters per document here. You must at least provide a list of document ids. See documentation..
func (s *MultiTermvectorService) BodyString(body string) *MultiTermvectorService {
	s.bodyString = body
	return s
}

func (s *MultiTermvectorService) Source() interface{} {
	source := make(map[string]interface{})
	docs := make([]interface{}, len(s.docs))
	for i, doc := range s.docs {
		docs[i] = doc.Source()
	}
	source["docs"] = docs
	return source
}

// buildURL builds the URL for the operation.
func (s *MultiTermvectorService) buildURL() (string, url.Values, error) {
	var path string
	var err error

	if s.index != "" && s.typ != "" {
		path, err = uritemplates.Expand("/{index}/{type}/_mtermvectors", map[string]string{
			"index": s.index,
			"type":  s.typ,
		})
	} else if s.index != "" && s.typ == "" {
		path, err = uritemplates.Expand("/{index}/_mtermvectors", map[string]string{
			"index": s.index,
		})
	} else {
		path = "/_mtermvectors"
	}
	if err != nil {
		return "", url.Values{}, err
	}

	// Add query string parameters
	params := url.Values{}
	if s.pretty {
		params.Set("pretty", "1")
	}
	if s.fieldStatistics != nil {
		params.Set("field_statistics", fmt.Sprintf("%v", *s.fieldStatistics))
	}
	if len(s.fields) > 0 {
		params.Set("fields", strings.Join(s.fields, ","))
	}
	if len(s.ids) > 0 {
		params.Set("ids", strings.Join(s.ids, ","))
	}
	if s.offsets != nil {
		params.Set("offsets", fmt.Sprintf("%v", *s.offsets))
	}
	if s.parent != "" {
		params.Set("parent", s.parent)
	}
	if s.payloads != nil {
		params.Set("payloads", fmt.Sprintf("%v", *s.payloads))
	}
	if s.positions != nil {
		params.Set("positions", fmt.Sprintf("%v", *s.positions))
	}
	if s.preference != "" {
		params.Set("preference", s.preference)
	}
	if s.realtime != nil {
		params.Set("realtime", fmt.Sprintf("%v", *s.realtime))
	}
	if s.routing != "" {
		params.Set("routing", s.routing)
	}
	if s.termStatistics != nil {
		params.Set("term_statistics", fmt.Sprintf("%v", *s.termStatistics))
	}
	if s.version != nil {
		params.Set("version", fmt.Sprintf("%v", s.version))
	}
	if s.versionType != "" {
		params.Set("version_type", s.versionType)
	}
	return path, params, nil
}

// Validate checks if the operation is valid.
func (s *MultiTermvectorService) Validate() error {
	var invalid []string
	if s.index == "" && s.typ != "" {
		invalid = append(invalid, "Index")
	}
	if len(invalid) > 0 {
		return fmt.Errorf("missing required fields: %v", invalid)
	}
	return nil
}

// Do executes the operation.
func (s *MultiTermvectorService) Do(ctx context.Context) (*MultiTermvectorResponse, error) {
	// Check pre-conditions
	if err := s.Validate(); err != nil {
		return nil, err
	}

	// Get URL for request
	path, params, err := s.buildURL()
	if err != nil {
		return nil, err
	}

	// Setup HTTP request body
	var body interface{}
	if s.bodyJson != nil {
		body = s.bodyJson
	} else if len(s.bodyString) > 0 {
		body = s.bodyString
	} else {
		body = s.Source()
	}

	// Get HTTP response
	res, err := s.client.PerformRequest(ctx, "GET", path, params, body)
	if err != nil {
		return nil, err
	}

	// Return operation response
	ret := new(MultiTermvectorResponse)
	if err := json.Unmarshal(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// MultiTermvectorResponse is the response of MultiTermvectorService.Do.
type MultiTermvectorResponse struct {
	Docs []*TermvectorsResponse `json:"docs"`
}

// -- MultiTermvectorItem --

// MultiTermvectorItem is a single document to retrieve via MultiTermvectorService.
type MultiTermvectorItem struct {
	index            string
	typ              string
	id               string
	doc              interface{}
	fieldStatistics  *bool
	fields           []string
	perFieldAnalyzer map[string]string
	offsets          *bool
	parent           string
	payloads         *bool
	positions        *bool
	preference       string
	realtime         *bool
	routing          string
	termStatistics   *bool
}

func NewMultiTermvectorItem() *MultiTermvectorItem {
	return &MultiTermvectorItem{}
}

func (s *MultiTermvectorItem) Index(index string) *MultiTermvectorItem {
	s.index = index
	return s
}

func (s *MultiTermvectorItem) Type(typ string) *MultiTermvectorItem {
	s.typ = typ
	return s
}

func (s *MultiTermvectorItem) Id(id string) *MultiTermvectorItem {
	s.id = id
	return s
}

// Doc is the document to analyze.
func (s *MultiTermvectorItem) Doc(doc interface{}) *MultiTermvectorItem {
	s.doc = doc
	return s
}

// FieldStatistics specifies if document count, sum of document frequencies
// and sum of total term frequencies should be returned.
func (s *MultiTermvectorItem) FieldStatistics(fieldStatistics bool) *MultiTermvectorItem {
	s.fieldStatistics = &fieldStatistics
	return s
}

// Fields a list of fields to return.
func (s *MultiTermvectorItem) Fields(fields ...string) *MultiTermvectorItem {
	if s.fields == nil {
		s.fields = make([]string, 0)
	}
	s.fields = append(s.fields, fields...)
	return s
}

// PerFieldAnalyzer allows to specify a different analyzer than the one
// at the field.
func (s *MultiTermvectorItem) PerFieldAnalyzer(perFieldAnalyzer map[string]string) *MultiTermvectorItem {
	s.perFieldAnalyzer = perFieldAnalyzer
	return s
}

// Offsets specifies if term offsets should be returned.
func (s *MultiTermvectorItem) Offsets(offsets bool) *MultiTermvectorItem {
	s.offsets = &offsets
	return s
}

// Parent id of documents.
func (s *MultiTermvectorItem) Parent(parent string) *MultiTermvectorItem {
	s.parent = parent
	return s
}

// Payloads specifies if term payloads should be returned.
func (s *MultiTermvectorItem) Payloads(payloads bool) *MultiTermvectorItem {
	s.payloads = &payloads
	return s
}

// Positions specifies if term positions should be returned.
func (s *MultiTermvectorItem) Positions(positions bool) *MultiTermvectorItem {
	s.positions = &positions
	return s
}

// Preference specify the node or shard the operation
// should be performed on (default: random).
func (s *MultiTermvectorItem) Preference(preference string) *MultiTermvectorItem {
	s.preference = preference
	return s
}

// Realtime specifies if request is real-time as opposed to
// near-real-time (default: true).
func (s *MultiTermvectorItem) Realtime(realtime bool) *MultiTermvectorItem {
	s.realtime = &realtime
	return s
}

// Routing is a specific routing value.
func (s *MultiTermvectorItem) Routing(routing string) *MultiTermvectorItem {
	s.routing = routing
	return s
}

// TermStatistics specifies if total term frequency and document frequency
// should be returned.
func (s *MultiTermvectorItem) TermStatistics(termStatistics bool) *MultiTermvectorItem {
	s.termStatistics = &termStatistics
	return s
}

// Source returns the serialized JSON to be sent to Elasticsearch as
// part of a MultiTermvector.
func (s *MultiTermvectorItem) Source() interface{} {
	source := make(map[string]interface{})

	source["_id"] = s.id

	if s.index != "" {
		source["_index"] = s.index
	}
	if s.typ != "" {
		source["_type"] = s.typ
	}
	if s.fields != nil {
		source["fields"] = s.fields
	}
	if s.fieldStatistics != nil {
		source["field_statistics"] = fmt.Sprintf("%v", *s.fieldStatistics)
	}
	if s.offsets != nil {
		source["offsets"] = s.offsets
	}
	if s.parent != "" {
		source["parent"] = s.parent
	}
	if s.payloads != nil {
		source["payloads"] = fmt.Sprintf("%v", *s.payloads)
	}
	if s.positions != nil {
		source["positions"] = fmt.Sprintf("%v", *s.positions)
	}
	if s.preference != "" {
		source["preference"] = s.preference
	}
	if s.realtime != nil {
		source["realtime"] = fmt.Sprintf("%v", *s.realtime)
	}
	if s.routing != "" {
		source["routing"] = s.routing
	}
	if s.termStatistics != nil {
		source["term_statistics"] = fmt.Sprintf("%v", *s.termStatistics)
	}
	if s.doc != nil {
		source["doc"] = s.doc
	}
	if s.perFieldAnalyzer != nil && len(s.perFieldAnalyzer) > 0 {
		source["per_field_analyzer"] = s.perFieldAnalyzer
	}

	return source
}
