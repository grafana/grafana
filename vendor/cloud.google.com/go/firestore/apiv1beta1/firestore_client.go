// Copyright 2017, Google LLC All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// AUTO-GENERATED CODE. DO NOT EDIT.

package firestore

import (
	"math"
	"time"

	"cloud.google.com/go/internal/version"
	gax "github.com/googleapis/gax-go"
	"golang.org/x/net/context"
	"google.golang.org/api/iterator"
	"google.golang.org/api/option"
	"google.golang.org/api/transport"
	firestorepb "google.golang.org/genproto/googleapis/firestore/v1beta1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
)

// CallOptions contains the retry settings for each method of Client.
type CallOptions struct {
	GetDocument       []gax.CallOption
	ListDocuments     []gax.CallOption
	CreateDocument    []gax.CallOption
	UpdateDocument    []gax.CallOption
	DeleteDocument    []gax.CallOption
	BatchGetDocuments []gax.CallOption
	BeginTransaction  []gax.CallOption
	Commit            []gax.CallOption
	Rollback          []gax.CallOption
	RunQuery          []gax.CallOption
	Write             []gax.CallOption
	Listen            []gax.CallOption
	ListCollectionIds []gax.CallOption
}

func defaultClientOptions() []option.ClientOption {
	return []option.ClientOption{
		option.WithEndpoint("firestore.googleapis.com:443"),
		option.WithScopes(DefaultAuthScopes()...),
	}
}

func defaultCallOptions() *CallOptions {
	retry := map[[2]string][]gax.CallOption{
		{"default", "idempotent"}: {
			gax.WithRetry(func() gax.Retryer {
				return gax.OnCodes([]codes.Code{
					codes.DeadlineExceeded,
					codes.Unavailable,
				}, gax.Backoff{
					Initial:    100 * time.Millisecond,
					Max:        60000 * time.Millisecond,
					Multiplier: 1.3,
				})
			}),
		},
		{"streaming", "idempotent"}: {
			gax.WithRetry(func() gax.Retryer {
				return gax.OnCodes([]codes.Code{
					codes.DeadlineExceeded,
					codes.Unavailable,
				}, gax.Backoff{
					Initial:    100 * time.Millisecond,
					Max:        60000 * time.Millisecond,
					Multiplier: 1.3,
				})
			}),
		},
	}
	return &CallOptions{
		GetDocument:       retry[[2]string{"default", "idempotent"}],
		ListDocuments:     retry[[2]string{"default", "idempotent"}],
		CreateDocument:    retry[[2]string{"default", "non_idempotent"}],
		UpdateDocument:    retry[[2]string{"default", "non_idempotent"}],
		DeleteDocument:    retry[[2]string{"default", "idempotent"}],
		BatchGetDocuments: retry[[2]string{"streaming", "idempotent"}],
		BeginTransaction:  retry[[2]string{"default", "idempotent"}],
		Commit:            retry[[2]string{"default", "non_idempotent"}],
		Rollback:          retry[[2]string{"default", "idempotent"}],
		RunQuery:          retry[[2]string{"default", "idempotent"}],
		Write:             retry[[2]string{"streaming", "non_idempotent"}],
		Listen:            retry[[2]string{"streaming", "idempotent"}],
		ListCollectionIds: retry[[2]string{"default", "idempotent"}],
	}
}

// Client is a client for interacting with Google Cloud Firestore API.
type Client struct {
	// The connection to the service.
	conn *grpc.ClientConn

	// The gRPC API client.
	client firestorepb.FirestoreClient

	// The call options for this service.
	CallOptions *CallOptions

	// The x-goog-* metadata to be sent with each request.
	xGoogMetadata metadata.MD
}

// NewClient creates a new firestore client.
//
// The Cloud Firestore service.
//
// This service exposes several types of comparable timestamps:
//
//   create_time - The time at which a document was created. Changes only
//   when a document is deleted, then re-created. Increases in a strict
//   monotonic fashion.
//
//   update_time - The time at which a document was last updated. Changes
//   every time a document is modified. Does not change when a write results
//   in no modifications. Increases in a strict monotonic fashion.
//
//   read_time - The time at which a particular state was observed. Used
//   to denote a consistent snapshot of the database or the time at which a
//   Document was observed to not exist.
//
//   commit_time - The time at which the writes in a transaction were
//   committed. Any read with an equal or greater read_time is guaranteed
//   to see the effects of the transaction.
func NewClient(ctx context.Context, opts ...option.ClientOption) (*Client, error) {
	conn, err := transport.DialGRPC(ctx, append(defaultClientOptions(), opts...)...)
	if err != nil {
		return nil, err
	}
	c := &Client{
		conn:        conn,
		CallOptions: defaultCallOptions(),

		client: firestorepb.NewFirestoreClient(conn),
	}
	c.SetGoogleClientInfo()
	return c, nil
}

// Connection returns the client's connection to the API service.
func (c *Client) Connection() *grpc.ClientConn {
	return c.conn
}

// Close closes the connection to the API service. The user should invoke this when
// the client is no longer required.
func (c *Client) Close() error {
	return c.conn.Close()
}

// SetGoogleClientInfo sets the name and version of the application in
// the `x-goog-api-client` header passed on each request. Intended for
// use by Google-written clients.
func (c *Client) SetGoogleClientInfo(keyval ...string) {
	kv := append([]string{"gl-go", version.Go()}, keyval...)
	kv = append(kv, "gapic", version.Repo, "gax", gax.Version, "grpc", grpc.Version)
	c.xGoogMetadata = metadata.Pairs("x-goog-api-client", gax.XGoogHeader(kv...))
}

// DatabaseRootPath returns the path for the database root resource.
func DatabaseRootPath(project, database string) string {
	return "" +
		"projects/" +
		project +
		"/databases/" +
		database +
		""
}

// DocumentRootPath returns the path for the document root resource.
func DocumentRootPath(project, database string) string {
	return "" +
		"projects/" +
		project +
		"/databases/" +
		database +
		"/documents" +
		""
}

// DocumentPathPath returns the path for the document path resource.
func DocumentPathPath(project, database, documentPath string) string {
	return "" +
		"projects/" +
		project +
		"/databases/" +
		database +
		"/documents/" +
		documentPath +
		""
}

// AnyPathPath returns the path for the any path resource.
func AnyPathPath(project, database, document, anyPath string) string {
	return "" +
		"projects/" +
		project +
		"/databases/" +
		database +
		"/documents/" +
		document +
		"/" +
		anyPath +
		""
}

// GetDocument gets a single document.
func (c *Client) GetDocument(ctx context.Context, req *firestorepb.GetDocumentRequest, opts ...gax.CallOption) (*firestorepb.Document, error) {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.GetDocument[0:len(c.CallOptions.GetDocument):len(c.CallOptions.GetDocument)], opts...)
	var resp *firestorepb.Document
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.client.GetDocument(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// ListDocuments lists documents.
func (c *Client) ListDocuments(ctx context.Context, req *firestorepb.ListDocumentsRequest, opts ...gax.CallOption) *DocumentIterator {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.ListDocuments[0:len(c.CallOptions.ListDocuments):len(c.CallOptions.ListDocuments)], opts...)
	it := &DocumentIterator{}
	it.InternalFetch = func(pageSize int, pageToken string) ([]*firestorepb.Document, string, error) {
		var resp *firestorepb.ListDocumentsResponse
		req.PageToken = pageToken
		if pageSize > math.MaxInt32 {
			req.PageSize = math.MaxInt32
		} else {
			req.PageSize = int32(pageSize)
		}
		err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
			var err error
			resp, err = c.client.ListDocuments(ctx, req, settings.GRPC...)
			return err
		}, opts...)
		if err != nil {
			return nil, "", err
		}
		return resp.Documents, resp.NextPageToken, nil
	}
	fetch := func(pageSize int, pageToken string) (string, error) {
		items, nextPageToken, err := it.InternalFetch(pageSize, pageToken)
		if err != nil {
			return "", err
		}
		it.items = append(it.items, items...)
		return nextPageToken, nil
	}
	it.pageInfo, it.nextFunc = iterator.NewPageInfo(fetch, it.bufLen, it.takeBuf)
	return it
}

// CreateDocument creates a new document.
func (c *Client) CreateDocument(ctx context.Context, req *firestorepb.CreateDocumentRequest, opts ...gax.CallOption) (*firestorepb.Document, error) {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.CreateDocument[0:len(c.CallOptions.CreateDocument):len(c.CallOptions.CreateDocument)], opts...)
	var resp *firestorepb.Document
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.client.CreateDocument(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// UpdateDocument updates or inserts a document.
func (c *Client) UpdateDocument(ctx context.Context, req *firestorepb.UpdateDocumentRequest, opts ...gax.CallOption) (*firestorepb.Document, error) {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.UpdateDocument[0:len(c.CallOptions.UpdateDocument):len(c.CallOptions.UpdateDocument)], opts...)
	var resp *firestorepb.Document
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.client.UpdateDocument(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// DeleteDocument deletes a document.
func (c *Client) DeleteDocument(ctx context.Context, req *firestorepb.DeleteDocumentRequest, opts ...gax.CallOption) error {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.DeleteDocument[0:len(c.CallOptions.DeleteDocument):len(c.CallOptions.DeleteDocument)], opts...)
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		_, err = c.client.DeleteDocument(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	return err
}

// BatchGetDocuments gets multiple documents.
//
// Documents returned by this method are not guaranteed to be returned in the
// same order that they were requested.
func (c *Client) BatchGetDocuments(ctx context.Context, req *firestorepb.BatchGetDocumentsRequest, opts ...gax.CallOption) (firestorepb.Firestore_BatchGetDocumentsClient, error) {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.BatchGetDocuments[0:len(c.CallOptions.BatchGetDocuments):len(c.CallOptions.BatchGetDocuments)], opts...)
	var resp firestorepb.Firestore_BatchGetDocumentsClient
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.client.BatchGetDocuments(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// BeginTransaction starts a new transaction.
func (c *Client) BeginTransaction(ctx context.Context, req *firestorepb.BeginTransactionRequest, opts ...gax.CallOption) (*firestorepb.BeginTransactionResponse, error) {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.BeginTransaction[0:len(c.CallOptions.BeginTransaction):len(c.CallOptions.BeginTransaction)], opts...)
	var resp *firestorepb.BeginTransactionResponse
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.client.BeginTransaction(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// Commit commits a transaction, while optionally updating documents.
func (c *Client) Commit(ctx context.Context, req *firestorepb.CommitRequest, opts ...gax.CallOption) (*firestorepb.CommitResponse, error) {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.Commit[0:len(c.CallOptions.Commit):len(c.CallOptions.Commit)], opts...)
	var resp *firestorepb.CommitResponse
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.client.Commit(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// Rollback rolls back a transaction.
func (c *Client) Rollback(ctx context.Context, req *firestorepb.RollbackRequest, opts ...gax.CallOption) error {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.Rollback[0:len(c.CallOptions.Rollback):len(c.CallOptions.Rollback)], opts...)
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		_, err = c.client.Rollback(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	return err
}

// RunQuery runs a query.
func (c *Client) RunQuery(ctx context.Context, req *firestorepb.RunQueryRequest, opts ...gax.CallOption) (firestorepb.Firestore_RunQueryClient, error) {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.RunQuery[0:len(c.CallOptions.RunQuery):len(c.CallOptions.RunQuery)], opts...)
	var resp firestorepb.Firestore_RunQueryClient
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.client.RunQuery(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// Write streams batches of document updates and deletes, in order.
func (c *Client) Write(ctx context.Context, opts ...gax.CallOption) (firestorepb.Firestore_WriteClient, error) {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.Write[0:len(c.CallOptions.Write):len(c.CallOptions.Write)], opts...)
	var resp firestorepb.Firestore_WriteClient
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.client.Write(ctx, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// Listen listens to changes.
func (c *Client) Listen(ctx context.Context, opts ...gax.CallOption) (firestorepb.Firestore_ListenClient, error) {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.Listen[0:len(c.CallOptions.Listen):len(c.CallOptions.Listen)], opts...)
	var resp firestorepb.Firestore_ListenClient
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.client.Listen(ctx, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// ListCollectionIds lists all the collection IDs underneath a document.
func (c *Client) ListCollectionIds(ctx context.Context, req *firestorepb.ListCollectionIdsRequest, opts ...gax.CallOption) *StringIterator {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.ListCollectionIds[0:len(c.CallOptions.ListCollectionIds):len(c.CallOptions.ListCollectionIds)], opts...)
	it := &StringIterator{}
	it.InternalFetch = func(pageSize int, pageToken string) ([]string, string, error) {
		var resp *firestorepb.ListCollectionIdsResponse
		req.PageToken = pageToken
		if pageSize > math.MaxInt32 {
			req.PageSize = math.MaxInt32
		} else {
			req.PageSize = int32(pageSize)
		}
		err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
			var err error
			resp, err = c.client.ListCollectionIds(ctx, req, settings.GRPC...)
			return err
		}, opts...)
		if err != nil {
			return nil, "", err
		}
		return resp.CollectionIds, resp.NextPageToken, nil
	}
	fetch := func(pageSize int, pageToken string) (string, error) {
		items, nextPageToken, err := it.InternalFetch(pageSize, pageToken)
		if err != nil {
			return "", err
		}
		it.items = append(it.items, items...)
		return nextPageToken, nil
	}
	it.pageInfo, it.nextFunc = iterator.NewPageInfo(fetch, it.bufLen, it.takeBuf)
	return it
}

// DocumentIterator manages a stream of *firestorepb.Document.
type DocumentIterator struct {
	items    []*firestorepb.Document
	pageInfo *iterator.PageInfo
	nextFunc func() error

	// InternalFetch is for use by the Google Cloud Libraries only.
	// It is not part of the stable interface of this package.
	//
	// InternalFetch returns results from a single call to the underlying RPC.
	// The number of results is no greater than pageSize.
	// If there are no more results, nextPageToken is empty and err is nil.
	InternalFetch func(pageSize int, pageToken string) (results []*firestorepb.Document, nextPageToken string, err error)
}

// PageInfo supports pagination. See the google.golang.org/api/iterator package for details.
func (it *DocumentIterator) PageInfo() *iterator.PageInfo {
	return it.pageInfo
}

// Next returns the next result. Its second return value is iterator.Done if there are no more
// results. Once Next returns Done, all subsequent calls will return Done.
func (it *DocumentIterator) Next() (*firestorepb.Document, error) {
	var item *firestorepb.Document
	if err := it.nextFunc(); err != nil {
		return item, err
	}
	item = it.items[0]
	it.items = it.items[1:]
	return item, nil
}

func (it *DocumentIterator) bufLen() int {
	return len(it.items)
}

func (it *DocumentIterator) takeBuf() interface{} {
	b := it.items
	it.items = nil
	return b
}

// StringIterator manages a stream of string.
type StringIterator struct {
	items    []string
	pageInfo *iterator.PageInfo
	nextFunc func() error

	// InternalFetch is for use by the Google Cloud Libraries only.
	// It is not part of the stable interface of this package.
	//
	// InternalFetch returns results from a single call to the underlying RPC.
	// The number of results is no greater than pageSize.
	// If there are no more results, nextPageToken is empty and err is nil.
	InternalFetch func(pageSize int, pageToken string) (results []string, nextPageToken string, err error)
}

// PageInfo supports pagination. See the google.golang.org/api/iterator package for details.
func (it *StringIterator) PageInfo() *iterator.PageInfo {
	return it.pageInfo
}

// Next returns the next result. Its second return value is iterator.Done if there are no more
// results. Once Next returns Done, all subsequent calls will return Done.
func (it *StringIterator) Next() (string, error) {
	var item string
	if err := it.nextFunc(); err != nil {
		return item, err
	}
	item = it.items[0]
	it.items = it.items[1:]
	return item, nil
}

func (it *StringIterator) bufLen() int {
	return len(it.items)
}

func (it *StringIterator) takeBuf() interface{} {
	b := it.items
	it.items = nil
	return b
}
