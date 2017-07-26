// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"fmt"
	"net/url"
	"strings"

	"golang.org/x/net/context"
)

// -- Actions --

// AliasAction is an action to apply to an alias, e.g. "add" or "remove".
type AliasAction interface {
	Source() (interface{}, error)
}

// AliasAddAction is an action to add to an alias.
type AliasAddAction struct {
	index         []string // index name(s)
	alias         string   // alias name
	filter        Query
	routing       string
	searchRouting string
	indexRouting  string
}

// NewAliasAddAction returns an action to add an alias.
func NewAliasAddAction(alias string) *AliasAddAction {
	return &AliasAddAction{
		alias: alias,
	}
}

// Index associates one or more indices to the alias.
func (a *AliasAddAction) Index(index ...string) *AliasAddAction {
	a.index = append(a.index, index...)
	return a
}

func (a *AliasAddAction) removeBlankIndexNames() {
	var indices []string
	for _, index := range a.index {
		if len(index) > 0 {
			indices = append(indices, index)
		}
	}
	a.index = indices
}

// Filter associates a filter to the alias.
func (a *AliasAddAction) Filter(filter Query) *AliasAddAction {
	a.filter = filter
	return a
}

// Routing associates a routing value to the alias.
// This basically sets index and search routing to the same value.
func (a *AliasAddAction) Routing(routing string) *AliasAddAction {
	a.routing = routing
	return a
}

// IndexRouting associates an index routing value to the alias.
func (a *AliasAddAction) IndexRouting(routing string) *AliasAddAction {
	a.indexRouting = routing
	return a
}

// SearchRouting associates a search routing value to the alias.
func (a *AliasAddAction) SearchRouting(routing ...string) *AliasAddAction {
	a.searchRouting = strings.Join(routing, ",")
	return a
}

// Validate checks if the operation is valid.
func (a *AliasAddAction) Validate() error {
	var invalid []string
	if len(a.alias) == 0 {
		invalid = append(invalid, "Alias")
	}
	if len(a.index) == 0 {
		invalid = append(invalid, "Index")
	}
	if len(invalid) > 0 {
		return fmt.Errorf("missing required fields: %v", invalid)
	}
	return nil
}

// Source returns the JSON-serializable data.
func (a *AliasAddAction) Source() (interface{}, error) {
	a.removeBlankIndexNames()
	if err := a.Validate(); err != nil {
		return nil, err
	}
	src := make(map[string]interface{})
	act := make(map[string]interface{})
	src["add"] = act
	act["alias"] = a.alias
	switch len(a.index) {
	case 1:
		act["index"] = a.index[0]
	default:
		act["indices"] = a.index
	}
	if a.filter != nil {
		f, err := a.filter.Source()
		if err != nil {
			return nil, err
		}
		act["filter"] = f
	}
	if len(a.routing) > 0 {
		act["routing"] = a.routing
	}
	if len(a.indexRouting) > 0 {
		act["index_routing"] = a.indexRouting
	}
	if len(a.searchRouting) > 0 {
		act["search_routing"] = a.searchRouting
	}
	return src, nil
}

// AliasRemoveAction is an action to remove an alias.
type AliasRemoveAction struct {
	index []string // index name(s)
	alias string   // alias name
}

// NewAliasRemoveAction returns an action to remove an alias.
func NewAliasRemoveAction(alias string) *AliasRemoveAction {
	return &AliasRemoveAction{
		alias: alias,
	}
}

// Index associates one or more indices to the alias.
func (a *AliasRemoveAction) Index(index ...string) *AliasRemoveAction {
	a.index = append(a.index, index...)
	return a
}

func (a *AliasRemoveAction) removeBlankIndexNames() {
	var indices []string
	for _, index := range a.index {
		if len(index) > 0 {
			indices = append(indices, index)
		}
	}
	a.index = indices
}

// Validate checks if the operation is valid.
func (a *AliasRemoveAction) Validate() error {
	var invalid []string
	if len(a.alias) == 0 {
		invalid = append(invalid, "Alias")
	}
	if len(a.index) == 0 {
		invalid = append(invalid, "Index")
	}
	if len(invalid) > 0 {
		return fmt.Errorf("missing required fields: %v", invalid)
	}
	return nil
}

// Source returns the JSON-serializable data.
func (a *AliasRemoveAction) Source() (interface{}, error) {
	a.removeBlankIndexNames()
	if err := a.Validate(); err != nil {
		return nil, err
	}
	src := make(map[string]interface{})
	act := make(map[string]interface{})
	src["remove"] = act
	act["alias"] = a.alias
	switch len(a.index) {
	case 1:
		act["index"] = a.index[0]
	default:
		act["indices"] = a.index
	}
	return src, nil
}

// -- Service --

// AliasService enables users to add or remove an alias.
// See https://www.elastic.co/guide/en/elasticsearch/reference/2.3/indices-aliases.html
// for details.
type AliasService struct {
	client  *Client
	actions []AliasAction
	pretty  bool
}

// NewAliasService implements a service to manage aliases.
func NewAliasService(client *Client) *AliasService {
	builder := &AliasService{
		client: client,
	}
	return builder
}

// Pretty asks Elasticsearch to indent the HTTP response.
func (s *AliasService) Pretty(pretty bool) *AliasService {
	s.pretty = pretty
	return s
}

// Add adds an alias to an index.
func (s *AliasService) Add(indexName string, aliasName string) *AliasService {
	action := NewAliasAddAction(aliasName).Index(indexName)
	s.actions = append(s.actions, action)
	return s
}

// Add adds an alias to an index and associates a filter to the alias.
func (s *AliasService) AddWithFilter(indexName string, aliasName string, filter Query) *AliasService {
	action := NewAliasAddAction(aliasName).Index(indexName).Filter(filter)
	s.actions = append(s.actions, action)
	return s
}

// Remove removes an alias.
func (s *AliasService) Remove(indexName string, aliasName string) *AliasService {
	action := NewAliasRemoveAction(aliasName).Index(indexName)
	s.actions = append(s.actions, action)
	return s
}

// Action accepts one or more AliasAction instances which can be
// of type AliasAddAction or AliasRemoveAction.
func (s *AliasService) Action(action ...AliasAction) *AliasService {
	s.actions = append(s.actions, action...)
	return s
}

// buildURL builds the URL for the operation.
func (s *AliasService) buildURL() (string, url.Values, error) {
	path := "/_aliases"

	// Add query string parameters
	params := url.Values{}
	if s.pretty {
		params.Set("pretty", fmt.Sprintf("%v", s.pretty))
	}
	return path, params, nil
}

// Do executes the command.
func (s *AliasService) Do() (*AliasResult, error) {
	return s.DoC(nil)
}

// DoC executes the command.
func (s *AliasService) DoC(ctx context.Context) (*AliasResult, error) {
	path, params, err := s.buildURL()
	if err != nil {
		return nil, err
	}

	// Body with actions
	body := make(map[string]interface{})
	var actions []interface{}
	for _, action := range s.actions {
		src, err := action.Source()
		if err != nil {
			return nil, err
		}
		actions = append(actions, src)
	}
	body["actions"] = actions

	// Get response
	res, err := s.client.PerformRequestC(ctx, "POST", path, params, body)
	if err != nil {
		return nil, err
	}

	// Return results
	ret := new(AliasResult)
	if err := s.client.decoder.Decode(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// -- Result of an alias request.

// AliasResult is the outcome of calling Do on AliasService.
type AliasResult struct {
	Acknowledged bool `json:"acknowledged"`
}
