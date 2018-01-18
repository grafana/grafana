// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"fmt"
	"strings"
)

// BulkUpdateRequest is a request to update a document in Elasticsearch.
//
// See https://www.elastic.co/guide/en/elasticsearch/reference/5.2/docs-bulk.html
// for details.
type BulkUpdateRequest struct {
	BulkableRequest
	index string
	typ   string
	id    string

	routing         string
	parent          string
	script          *Script
	scriptedUpsert  *bool
	version         int64  // default is MATCH_ANY
	versionType     string // default is "internal"
	retryOnConflict *int
	upsert          interface{}
	docAsUpsert     *bool
	detectNoop      *bool
	doc             interface{}

	source []string
}

// NewBulkUpdateRequest returns a new BulkUpdateRequest.
func NewBulkUpdateRequest() *BulkUpdateRequest {
	return &BulkUpdateRequest{}
}

// Index specifies the Elasticsearch index to use for this update request.
// If unspecified, the index set on the BulkService will be used.
func (r *BulkUpdateRequest) Index(index string) *BulkUpdateRequest {
	r.index = index
	r.source = nil
	return r
}

// Type specifies the Elasticsearch type to use for this update request.
// If unspecified, the type set on the BulkService will be used.
func (r *BulkUpdateRequest) Type(typ string) *BulkUpdateRequest {
	r.typ = typ
	r.source = nil
	return r
}

// Id specifies the identifier of the document to update.
func (r *BulkUpdateRequest) Id(id string) *BulkUpdateRequest {
	r.id = id
	r.source = nil
	return r
}

// Routing specifies a routing value for the request.
func (r *BulkUpdateRequest) Routing(routing string) *BulkUpdateRequest {
	r.routing = routing
	r.source = nil
	return r
}

// Parent specifies the identifier of the parent document (if available).
func (r *BulkUpdateRequest) Parent(parent string) *BulkUpdateRequest {
	r.parent = parent
	r.source = nil
	return r
}

// Script specifies an update script.
// See https://www.elastic.co/guide/en/elasticsearch/reference/5.2/docs-bulk.html#bulk-update
// and https://www.elastic.co/guide/en/elasticsearch/reference/5.2/modules-scripting.html
// for details.
func (r *BulkUpdateRequest) Script(script *Script) *BulkUpdateRequest {
	r.script = script
	r.source = nil
	return r
}

// ScripedUpsert specifies if your script will run regardless of
// whether the document exists or not.
//
// See https://www.elastic.co/guide/en/elasticsearch/reference/5.2/docs-update.html#_literal_scripted_upsert_literal
func (r *BulkUpdateRequest) ScriptedUpsert(upsert bool) *BulkUpdateRequest {
	r.scriptedUpsert = &upsert
	r.source = nil
	return r
}

// RetryOnConflict specifies how often to retry in case of a version conflict.
func (r *BulkUpdateRequest) RetryOnConflict(retryOnConflict int) *BulkUpdateRequest {
	r.retryOnConflict = &retryOnConflict
	r.source = nil
	return r
}

// Version indicates the version of the document as part of an optimistic
// concurrency model.
func (r *BulkUpdateRequest) Version(version int64) *BulkUpdateRequest {
	r.version = version
	r.source = nil
	return r
}

// VersionType can be "internal" (default), "external", "external_gte",
// "external_gt", or "force".
func (r *BulkUpdateRequest) VersionType(versionType string) *BulkUpdateRequest {
	r.versionType = versionType
	r.source = nil
	return r
}

// Doc specifies the updated document.
func (r *BulkUpdateRequest) Doc(doc interface{}) *BulkUpdateRequest {
	r.doc = doc
	r.source = nil
	return r
}

// DocAsUpsert indicates whether the contents of Doc should be used as
// the Upsert value.
//
// See https://www.elastic.co/guide/en/elasticsearch/reference/5.2/docs-update.html#_literal_doc_as_upsert_literal
// for details.
func (r *BulkUpdateRequest) DocAsUpsert(docAsUpsert bool) *BulkUpdateRequest {
	r.docAsUpsert = &docAsUpsert
	r.source = nil
	return r
}

// DetectNoop specifies whether changes that don't affect the document
// should be ignored (true) or unignored (false). This is enabled by default
// in Elasticsearch.
func (r *BulkUpdateRequest) DetectNoop(detectNoop bool) *BulkUpdateRequest {
	r.detectNoop = &detectNoop
	r.source = nil
	return r
}

// Upsert specifies the document to use for upserts. It will be used for
// create if the original document does not exist.
func (r *BulkUpdateRequest) Upsert(doc interface{}) *BulkUpdateRequest {
	r.upsert = doc
	r.source = nil
	return r
}

// String returns the on-wire representation of the update request,
// concatenated as a single string.
func (r *BulkUpdateRequest) String() string {
	lines, err := r.Source()
	if err != nil {
		return fmt.Sprintf("error: %v", err)
	}
	return strings.Join(lines, "\n")
}

func (r *BulkUpdateRequest) getSourceAsString(data interface{}) (string, error) {
	switch t := data.(type) {
	default:
		body, err := json.Marshal(data)
		if err != nil {
			return "", err
		}
		return string(body), nil
	case json.RawMessage:
		return string(t), nil
	case *json.RawMessage:
		return string(*t), nil
	case string:
		return t, nil
	case *string:
		return *t, nil
	}
}

// Source returns the on-wire representation of the update request,
// split into an action-and-meta-data line and an (optional) source line.
// See https://www.elastic.co/guide/en/elasticsearch/reference/5.2/docs-bulk.html
// for details.
func (r *BulkUpdateRequest) Source() ([]string, error) {
	// { "update" : { "_index" : "test", "_type" : "type1", "_id" : "1", ... } }
	// { "doc" : { "field1" : "value1", ... } }
	// or
	// { "update" : { "_index" : "test", "_type" : "type1", "_id" : "1", ... } }
	// { "script" : { ... } }

	if r.source != nil {
		return r.source, nil
	}

	lines := make([]string, 2)

	// "update" ...
	command := make(map[string]interface{})
	updateCommand := make(map[string]interface{})
	if r.index != "" {
		updateCommand["_index"] = r.index
	}
	if r.typ != "" {
		updateCommand["_type"] = r.typ
	}
	if r.id != "" {
		updateCommand["_id"] = r.id
	}
	if r.routing != "" {
		updateCommand["_routing"] = r.routing
	}
	if r.parent != "" {
		updateCommand["_parent"] = r.parent
	}
	if r.version > 0 {
		updateCommand["_version"] = r.version
	}
	if r.versionType != "" {
		updateCommand["_version_type"] = r.versionType
	}
	if r.retryOnConflict != nil {
		updateCommand["_retry_on_conflict"] = *r.retryOnConflict
	}
	command["update"] = updateCommand
	line, err := json.Marshal(command)
	if err != nil {
		return nil, err
	}
	lines[0] = string(line)

	// 2nd line: {"doc" : { ... }} or {"script": {...}}
	source := make(map[string]interface{})
	if r.docAsUpsert != nil {
		source["doc_as_upsert"] = *r.docAsUpsert
	}
	if r.detectNoop != nil {
		source["detect_noop"] = *r.detectNoop
	}
	if r.upsert != nil {
		source["upsert"] = r.upsert
	}
	if r.scriptedUpsert != nil {
		source["scripted_upsert"] = *r.scriptedUpsert
	}
	if r.doc != nil {
		// {"doc":{...}}
		source["doc"] = r.doc
	} else if r.script != nil {
		// {"script":...}
		src, err := r.script.Source()
		if err != nil {
			return nil, err
		}
		source["script"] = src
	}
	lines[1], err = r.getSourceAsString(source)
	if err != nil {
		return nil, err
	}

	r.source = lines
	return lines, nil
}
