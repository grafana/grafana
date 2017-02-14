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

// UpdateService updates a document in Elasticsearch.
// See http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/docs-update.html
// for details.
type UpdateService struct {
	client           *Client
	index            string
	typ              string
	id               string
	routing          string
	parent           string
	script           *Script
	fields           []string
	version          *int64
	versionType      string
	retryOnConflict  *int
	refresh          *bool
	replicationType  string
	consistencyLevel string
	upsert           interface{}
	scriptedUpsert   *bool
	docAsUpsert      *bool
	detectNoop       *bool
	doc              interface{}
	timeout          string
	pretty           bool
}

// NewUpdateService creates the service to update documents in Elasticsearch.
func NewUpdateService(client *Client) *UpdateService {
	builder := &UpdateService{
		client: client,
		fields: make([]string, 0),
	}
	return builder
}

// Index is the name of the Elasticsearch index (required).
func (b *UpdateService) Index(name string) *UpdateService {
	b.index = name
	return b
}

// Type is the type of the document (required).
func (b *UpdateService) Type(typ string) *UpdateService {
	b.typ = typ
	return b
}

// Id is the identifier of the document to update (required).
func (b *UpdateService) Id(id string) *UpdateService {
	b.id = id
	return b
}

// Routing specifies a specific routing value.
func (b *UpdateService) Routing(routing string) *UpdateService {
	b.routing = routing
	return b
}

// Parent sets the id of the parent document.
func (b *UpdateService) Parent(parent string) *UpdateService {
	b.parent = parent
	return b
}

// Script is the script definition.
func (b *UpdateService) Script(script *Script) *UpdateService {
	b.script = script
	return b
}

// RetryOnConflict specifies how many times the operation should be retried
// when a conflict occurs (default: 0).
func (b *UpdateService) RetryOnConflict(retryOnConflict int) *UpdateService {
	b.retryOnConflict = &retryOnConflict
	return b
}

// Fields is a list of fields to return in the response.
func (b *UpdateService) Fields(fields ...string) *UpdateService {
	b.fields = make([]string, 0, len(fields))
	b.fields = append(b.fields, fields...)
	return b
}

// Version defines the explicit version number for concurrency control.
func (b *UpdateService) Version(version int64) *UpdateService {
	b.version = &version
	return b
}

// VersionType is one of "internal" or "force".
func (b *UpdateService) VersionType(versionType string) *UpdateService {
	b.versionType = versionType
	return b
}

// Refresh the index after performing the update.
func (b *UpdateService) Refresh(refresh bool) *UpdateService {
	b.refresh = &refresh
	return b
}

// ReplicationType is one of "sync" or "async".
func (b *UpdateService) ReplicationType(replicationType string) *UpdateService {
	b.replicationType = replicationType
	return b
}

// ConsistencyLevel is one of "one", "quorum", or "all".
// It sets the write consistency setting for the update operation.
func (b *UpdateService) ConsistencyLevel(consistencyLevel string) *UpdateService {
	b.consistencyLevel = consistencyLevel
	return b
}

// Doc allows for updating a partial document.
func (b *UpdateService) Doc(doc interface{}) *UpdateService {
	b.doc = doc
	return b
}

// Upsert can be used to index the document when it doesn't exist yet.
// Use this e.g. to initialize a document with a default value.
func (b *UpdateService) Upsert(doc interface{}) *UpdateService {
	b.upsert = doc
	return b
}

// DocAsUpsert can be used to insert the document if it doesn't already exist.
func (b *UpdateService) DocAsUpsert(docAsUpsert bool) *UpdateService {
	b.docAsUpsert = &docAsUpsert
	return b
}

// DetectNoop will instruct Elasticsearch to check if changes will occur
// when updating via Doc. It there aren't any changes, the request will
// turn into a no-op.
func (b *UpdateService) DetectNoop(detectNoop bool) *UpdateService {
	b.detectNoop = &detectNoop
	return b
}

// ScriptedUpsert should be set to true if the referenced script
// (defined in Script or ScriptId) should be called to perform an insert.
// The default is false.
func (b *UpdateService) ScriptedUpsert(scriptedUpsert bool) *UpdateService {
	b.scriptedUpsert = &scriptedUpsert
	return b
}

// Timeout is an explicit timeout for the operation, e.g. "1000", "1s" or "500ms".
func (b *UpdateService) Timeout(timeout string) *UpdateService {
	b.timeout = timeout
	return b
}

// Pretty instructs to return human readable, prettified JSON.
func (b *UpdateService) Pretty(pretty bool) *UpdateService {
	b.pretty = pretty
	return b
}

// url returns the URL part of the document request.
func (b *UpdateService) url() (string, url.Values, error) {
	// Build url
	path := "/{index}/{type}/{id}/_update"
	path, err := uritemplates.Expand(path, map[string]string{
		"index": b.index,
		"type":  b.typ,
		"id":    b.id,
	})
	if err != nil {
		return "", url.Values{}, err
	}

	// Parameters
	params := make(url.Values)
	if b.pretty {
		params.Set("pretty", "true")
	}
	if b.routing != "" {
		params.Set("routing", b.routing)
	}
	if b.parent != "" {
		params.Set("parent", b.parent)
	}
	if b.timeout != "" {
		params.Set("timeout", b.timeout)
	}
	if b.refresh != nil {
		params.Set("refresh", fmt.Sprintf("%v", *b.refresh))
	}
	if b.replicationType != "" {
		params.Set("replication", b.replicationType)
	}
	if b.consistencyLevel != "" {
		params.Set("consistency", b.consistencyLevel)
	}
	if len(b.fields) > 0 {
		params.Set("fields", strings.Join(b.fields, ","))
	}
	if b.version != nil {
		params.Set("version", fmt.Sprintf("%d", *b.version))
	}
	if b.versionType != "" {
		params.Set("version_type", b.versionType)
	}
	if b.retryOnConflict != nil {
		params.Set("retry_on_conflict", fmt.Sprintf("%v", *b.retryOnConflict))
	}

	return path, params, nil
}

// body returns the body part of the document request.
func (b *UpdateService) body() (interface{}, error) {
	source := make(map[string]interface{})

	if b.script != nil {
		src, err := b.script.Source()
		if err != nil {
			return nil, err
		}
		source["script"] = src
	}

	if b.scriptedUpsert != nil {
		source["scripted_upsert"] = *b.scriptedUpsert
	}

	if b.upsert != nil {
		source["upsert"] = b.upsert
	}

	if b.doc != nil {
		source["doc"] = b.doc
	}
	if b.docAsUpsert != nil {
		source["doc_as_upsert"] = *b.docAsUpsert
	}
	if b.detectNoop != nil {
		source["detect_noop"] = *b.detectNoop
	}

	return source, nil
}

// Do executes the update operation.
func (b *UpdateService) Do() (*UpdateResponse, error) {
	return b.DoC(nil)
}

// DoC executes the update operation.
func (b *UpdateService) DoC(ctx context.Context) (*UpdateResponse, error) {
	path, params, err := b.url()
	if err != nil {
		return nil, err
	}

	// Get body of the request
	body, err := b.body()
	if err != nil {
		return nil, err
	}

	// Get response
	res, err := b.client.PerformRequestC(ctx, "POST", path, params, body)
	if err != nil {
		return nil, err
	}

	// Return result
	ret := new(UpdateResponse)
	if err := b.client.decoder.Decode(res.Body, ret); err != nil {
		return nil, err
	}
	return ret, nil
}

// UpdateResponse is the result of updating a document in Elasticsearch.
type UpdateResponse struct {
	Index     string     `json:"_index"`
	Type      string     `json:"_type"`
	Id        string     `json:"_id"`
	Version   int        `json:"_version"`
	Created   bool       `json:"created"`
	GetResult *GetResult `json:"get"`
}
