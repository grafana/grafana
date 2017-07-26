// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"fmt"
	"strings"
)

// -- Bulk delete request --

// BulkDeleteRequest is a bulk request to remove a document from Elasticsearch.
//
// See https://www.elastic.co/guide/en/elasticsearch/reference/current/docs-bulk.html
// for details.
type BulkDeleteRequest struct {
	BulkableRequest
	index       string
	typ         string
	id          string
	parent      string
	routing     string
	refresh     *bool
	version     int64  // default is MATCH_ANY
	versionType string // default is "internal"

	source []string
}

// NewBulkDeleteRequest returns a new BulkDeleteRequest.
func NewBulkDeleteRequest() *BulkDeleteRequest {
	return &BulkDeleteRequest{}
}

// Index specifies the Elasticsearch index to use for this delete request.
// If unspecified, the index set on the BulkService will be used.
func (r *BulkDeleteRequest) Index(index string) *BulkDeleteRequest {
	r.index = index
	r.source = nil
	return r
}

// Type specifies the Elasticsearch type to use for this delete request.
// If unspecified, the type set on the BulkService will be used.
func (r *BulkDeleteRequest) Type(typ string) *BulkDeleteRequest {
	r.typ = typ
	r.source = nil
	return r
}

// Id specifies the identifier of the document to delete.
func (r *BulkDeleteRequest) Id(id string) *BulkDeleteRequest {
	r.id = id
	r.source = nil
	return r
}

// Parent specifies the parent of the request, which is used in parent/child
// mappings.
func (r *BulkDeleteRequest) Parent(parent string) *BulkDeleteRequest {
	r.parent = parent
	r.source = nil
	return r
}

// Routing specifies a routing value for the request.
func (r *BulkDeleteRequest) Routing(routing string) *BulkDeleteRequest {
	r.routing = routing
	r.source = nil
	return r
}

// Refresh indicates whether to update the shards immediately after
// the delete has been processed. Deleted documents will disappear
// in search immediately at the cost of slower bulk performance.
func (r *BulkDeleteRequest) Refresh(refresh bool) *BulkDeleteRequest {
	r.refresh = &refresh
	r.source = nil
	return r
}

// Version indicates the version to be deleted as part of an optimistic
// concurrency model.
func (r *BulkDeleteRequest) Version(version int64) *BulkDeleteRequest {
	r.version = version
	r.source = nil
	return r
}

// VersionType can be "internal" (default), "external", "external_gte",
// "external_gt", or "force".
func (r *BulkDeleteRequest) VersionType(versionType string) *BulkDeleteRequest {
	r.versionType = versionType
	r.source = nil
	return r
}

// String returns the on-wire representation of the delete request,
// concatenated as a single string.
func (r *BulkDeleteRequest) String() string {
	lines, err := r.Source()
	if err != nil {
		return fmt.Sprintf("error: %v", err)
	}
	return strings.Join(lines, "\n")
}

// Source returns the on-wire representation of the delete request,
// split into an action-and-meta-data line and an (optional) source line.
// See https://www.elastic.co/guide/en/elasticsearch/reference/current/docs-bulk.html
// for details.
func (r *BulkDeleteRequest) Source() ([]string, error) {
	if r.source != nil {
		return r.source, nil
	}
	lines := make([]string, 1)

	source := make(map[string]interface{})
	deleteCommand := make(map[string]interface{})
	if r.index != "" {
		deleteCommand["_index"] = r.index
	}
	if r.typ != "" {
		deleteCommand["_type"] = r.typ
	}
	if r.id != "" {
		deleteCommand["_id"] = r.id
	}
	if r.parent != "" {
		deleteCommand["_parent"] = r.parent
	}
	if r.routing != "" {
		deleteCommand["_routing"] = r.routing
	}
	if r.version > 0 {
		deleteCommand["_version"] = r.version
	}
	if r.versionType != "" {
		deleteCommand["_version_type"] = r.versionType
	}
	if r.refresh != nil {
		deleteCommand["refresh"] = *r.refresh
	}
	source["delete"] = deleteCommand

	body, err := json.Marshal(source)
	if err != nil {
		return nil, err
	}

	lines[0] = string(body)
	r.source = lines

	return lines, nil
}
