// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import "errors"

// PercolatorQuery can be used to match queries stored in an index.
//
// For more details, see
// https://www.elastic.co/guide/en/elasticsearch/reference/5.x/query-dsl-percolate-query.html
type PercolatorQuery struct {
	field                     string
	documentType              string
	document                  interface{}
	indexedDocumentIndex      string
	indexedDocumentType       string
	indexedDocumentId         string
	indexedDocumentRouting    string
	indexedDocumentPreference string
	indexedDocumentVersion    *int64
}

// NewPercolatorQuery creates and initializes a new Percolator query.
func NewPercolatorQuery() *PercolatorQuery {
	return &PercolatorQuery{}
}

func (q *PercolatorQuery) Field(field string) *PercolatorQuery {
	q.field = field
	return q
}

func (q *PercolatorQuery) DocumentType(typ string) *PercolatorQuery {
	q.documentType = typ
	return q
}

func (q *PercolatorQuery) Document(doc interface{}) *PercolatorQuery {
	q.document = doc
	return q
}

func (q *PercolatorQuery) IndexedDocumentIndex(index string) *PercolatorQuery {
	q.indexedDocumentIndex = index
	return q
}

func (q *PercolatorQuery) IndexedDocumentType(typ string) *PercolatorQuery {
	q.indexedDocumentType = typ
	return q
}

func (q *PercolatorQuery) IndexedDocumentId(id string) *PercolatorQuery {
	q.indexedDocumentId = id
	return q
}

func (q *PercolatorQuery) IndexedDocumentRouting(routing string) *PercolatorQuery {
	q.indexedDocumentRouting = routing
	return q
}

func (q *PercolatorQuery) IndexedDocumentPreference(preference string) *PercolatorQuery {
	q.indexedDocumentPreference = preference
	return q
}

func (q *PercolatorQuery) IndexedDocumentVersion(version int64) *PercolatorQuery {
	q.indexedDocumentVersion = &version
	return q
}

// Source returns JSON for the percolate query.
func (q *PercolatorQuery) Source() (interface{}, error) {
	if len(q.field) == 0 {
		return nil, errors.New("elastic: Field is required in PercolatorQuery")
	}
	if len(q.documentType) == 0 {
		return nil, errors.New("elastic: DocumentType is required in PercolatorQuery")
	}
	if q.document == nil {
		return nil, errors.New("elastic: Document is required in PercolatorQuery")
	}

	// {
	//   "percolate" : { ... }
	// }
	source := make(map[string]interface{})
	params := make(map[string]interface{})
	source["percolate"] = params
	params["field"] = q.field
	params["document_type"] = q.documentType
	params["document"] = q.document
	if len(q.indexedDocumentIndex) > 0 {
		params["index"] = q.indexedDocumentIndex
	}
	if len(q.indexedDocumentType) > 0 {
		params["type"] = q.indexedDocumentType
	}
	if len(q.indexedDocumentId) > 0 {
		params["id"] = q.indexedDocumentId
	}
	if len(q.indexedDocumentRouting) > 0 {
		params["routing"] = q.indexedDocumentRouting
	}
	if len(q.indexedDocumentPreference) > 0 {
		params["preference"] = q.indexedDocumentPreference
	}
	if q.indexedDocumentVersion != nil {
		params["version"] = *q.indexedDocumentVersion
	}
	return source, nil
}
