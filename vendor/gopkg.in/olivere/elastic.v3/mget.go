// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"fmt"
	"net/url"

	"golang.org/x/net/context"
)

// MgetService allows to get multiple documents based on an index,
// type (optional) and id (possibly routing). The response includes
// a docs array with all the fetched documents, each element similar
// in structure to a document provided by the Get API.
//
// See https://www.elastic.co/guide/en/elasticsearch/reference/current/docs-multi-get.html
// for details.
type MgetService struct {
	client     *Client
	pretty     bool
	preference string
	realtime   *bool
	refresh    *bool
	items      []*MultiGetItem
}

func NewMgetService(client *Client) *MgetService {
	builder := &MgetService{
		client: client,
		items:  make([]*MultiGetItem, 0),
	}
	return builder
}

func (b *MgetService) Preference(preference string) *MgetService {
	b.preference = preference
	return b
}

func (b *MgetService) Refresh(refresh bool) *MgetService {
	b.refresh = &refresh
	return b
}

func (b *MgetService) Realtime(realtime bool) *MgetService {
	b.realtime = &realtime
	return b
}

// Pretty indicates that the JSON response be indented and human readable.
func (s *MgetService) Pretty(pretty bool) *MgetService {
	s.pretty = pretty
	return s
}

func (b *MgetService) Add(items ...*MultiGetItem) *MgetService {
	b.items = append(b.items, items...)
	return b
}

func (b *MgetService) Source() (interface{}, error) {
	source := make(map[string]interface{})
	items := make([]interface{}, len(b.items))
	for i, item := range b.items {
		src, err := item.Source()
		if err != nil {
			return nil, err
		}
		items[i] = src
	}
	source["docs"] = items
	return source, nil
}

func (b *MgetService) Do() (*MgetResponse, error) {
	return b.DoC(nil)
}

func (b *MgetService) DoC(ctx context.Context) (*MgetResponse, error) {
	// Build url
	path := "/_mget"

	params := make(url.Values)
	if b.realtime != nil {
		params.Add("realtime", fmt.Sprintf("%v", *b.realtime))
	}
	if b.preference != "" {
		params.Add("preference", b.preference)
	}
	if b.refresh != nil {
		params.Add("refresh", fmt.Sprintf("%v", *b.refresh))
	}

	// Set body
	body, err := b.Source()
	if err != nil {
		return nil, err
	}

	// Get response
	res, err := b.client.PerformRequestC(ctx, "GET", path, params, body)
	if err != nil {
		return nil, err
	}

	// Return result
	ret := new(MgetResponse)
	if err := b.client.decoder.Decode(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// -- Multi Get Item --

// MultiGetItem is a single document to retrieve via the MgetService.
type MultiGetItem struct {
	index       string
	typ         string
	id          string
	routing     string
	fields      []string
	version     *int64 // see org.elasticsearch.common.lucene.uid.Versions
	versionType string // see org.elasticsearch.index.VersionType
	fsc         *FetchSourceContext
}

func NewMultiGetItem() *MultiGetItem {
	return &MultiGetItem{}
}

func (item *MultiGetItem) Index(index string) *MultiGetItem {
	item.index = index
	return item
}

func (item *MultiGetItem) Type(typ string) *MultiGetItem {
	item.typ = typ
	return item
}

func (item *MultiGetItem) Id(id string) *MultiGetItem {
	item.id = id
	return item
}

func (item *MultiGetItem) Routing(routing string) *MultiGetItem {
	item.routing = routing
	return item
}

func (item *MultiGetItem) Fields(fields ...string) *MultiGetItem {
	if item.fields == nil {
		item.fields = make([]string, 0)
	}
	item.fields = append(item.fields, fields...)
	return item
}

// Version can be MatchAny (-3), MatchAnyPre120 (0), NotFound (-1),
// or NotSet (-2). These are specified in org.elasticsearch.common.lucene.uid.Versions.
// The default in Elasticsearch is MatchAny (-3).
func (item *MultiGetItem) Version(version int64) *MultiGetItem {
	item.version = &version
	return item
}

// VersionType can be "internal", "external", "external_gt", "external_gte",
// or "force". See org.elasticsearch.index.VersionType in Elasticsearch source.
// It is "internal" by default.
func (item *MultiGetItem) VersionType(versionType string) *MultiGetItem {
	item.versionType = versionType
	return item
}

func (item *MultiGetItem) FetchSource(fetchSourceContext *FetchSourceContext) *MultiGetItem {
	item.fsc = fetchSourceContext
	return item
}

// Source returns the serialized JSON to be sent to Elasticsearch as
// part of a MultiGet search.
func (item *MultiGetItem) Source() (interface{}, error) {
	source := make(map[string]interface{})

	source["_id"] = item.id

	if item.index != "" {
		source["_index"] = item.index
	}
	if item.typ != "" {
		source["_type"] = item.typ
	}
	if item.fsc != nil {
		src, err := item.fsc.Source()
		if err != nil {
			return nil, err
		}
		source["_source"] = src
	}
	if item.fields != nil {
		source["fields"] = item.fields
	}
	if item.routing != "" {
		source["_routing"] = item.routing
	}
	if item.version != nil {
		source["version"] = fmt.Sprintf("%d", *item.version)
	}
	if item.versionType != "" {
		source["version_type"] = item.versionType
	}

	return source, nil
}

// -- Result of a Multi Get request.

type MgetResponse struct {
	Docs []*GetResult `json:"docs,omitempty"`
}
