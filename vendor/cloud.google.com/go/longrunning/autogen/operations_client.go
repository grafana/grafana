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

package longrunning

import (
	"math"
	"time"

	"cloud.google.com/go/internal/version"
	gax "github.com/googleapis/gax-go"
	"golang.org/x/net/context"
	"google.golang.org/api/iterator"
	"google.golang.org/api/option"
	"google.golang.org/api/transport"
	longrunningpb "google.golang.org/genproto/googleapis/longrunning"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
)

// OperationsCallOptions contains the retry settings for each method of OperationsClient.
type OperationsCallOptions struct {
	GetOperation    []gax.CallOption
	ListOperations  []gax.CallOption
	CancelOperation []gax.CallOption
	DeleteOperation []gax.CallOption
}

func defaultOperationsClientOptions() []option.ClientOption {
	return []option.ClientOption{
		option.WithEndpoint("longrunning.googleapis.com:443"),
		option.WithScopes(DefaultAuthScopes()...),
	}
}

func defaultOperationsCallOptions() *OperationsCallOptions {
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
	}
	return &OperationsCallOptions{
		GetOperation:    retry[[2]string{"default", "idempotent"}],
		ListOperations:  retry[[2]string{"default", "idempotent"}],
		CancelOperation: retry[[2]string{"default", "idempotent"}],
		DeleteOperation: retry[[2]string{"default", "idempotent"}],
	}
}

// OperationsClient is a client for interacting with Google Long Running Operations API.
type OperationsClient struct {
	// The connection to the service.
	conn *grpc.ClientConn

	// The gRPC API client.
	operationsClient longrunningpb.OperationsClient

	// The call options for this service.
	CallOptions *OperationsCallOptions

	// The x-goog-* metadata to be sent with each request.
	xGoogMetadata metadata.MD
}

// NewOperationsClient creates a new operations client.
//
// Manages long-running operations with an API service.
//
// When an API method normally takes long time to complete, it can be designed
// to return [Operation][google.longrunning.Operation] to the client, and the client can use this
// interface to receive the real response asynchronously by polling the
// operation resource, or pass the operation resource to another API (such as
// Google Cloud Pub/Sub API) to receive the response.  Any API service that
// returns long-running operations should implement the Operations interface
// so developers can have a consistent client experience.
func NewOperationsClient(ctx context.Context, opts ...option.ClientOption) (*OperationsClient, error) {
	conn, err := transport.DialGRPC(ctx, append(defaultOperationsClientOptions(), opts...)...)
	if err != nil {
		return nil, err
	}
	c := &OperationsClient{
		conn:        conn,
		CallOptions: defaultOperationsCallOptions(),

		operationsClient: longrunningpb.NewOperationsClient(conn),
	}
	c.SetGoogleClientInfo()
	return c, nil
}

// Connection returns the client's connection to the API service.
func (c *OperationsClient) Connection() *grpc.ClientConn {
	return c.conn
}

// Close closes the connection to the API service. The user should invoke this when
// the client is no longer required.
func (c *OperationsClient) Close() error {
	return c.conn.Close()
}

// SetGoogleClientInfo sets the name and version of the application in
// the `x-goog-api-client` header passed on each request. Intended for
// use by Google-written clients.
func (c *OperationsClient) SetGoogleClientInfo(keyval ...string) {
	kv := append([]string{"gl-go", version.Go()}, keyval...)
	kv = append(kv, "gapic", version.Repo, "gax", gax.Version, "grpc", grpc.Version)
	c.xGoogMetadata = metadata.Pairs("x-goog-api-client", gax.XGoogHeader(kv...))
}

// GetOperation gets the latest state of a long-running operation.  Clients can use this
// method to poll the operation result at intervals as recommended by the API
// service.
func (c *OperationsClient) GetOperation(ctx context.Context, req *longrunningpb.GetOperationRequest, opts ...gax.CallOption) (*longrunningpb.Operation, error) {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.GetOperation[0:len(c.CallOptions.GetOperation):len(c.CallOptions.GetOperation)], opts...)
	var resp *longrunningpb.Operation
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.operationsClient.GetOperation(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// ListOperations lists operations that match the specified filter in the request. If the
// server doesn't support this method, it returns UNIMPLEMENTED.
//
// NOTE: the name binding below allows API services to override the binding
// to use different resource name schemes, such as users/*/operations.
func (c *OperationsClient) ListOperations(ctx context.Context, req *longrunningpb.ListOperationsRequest, opts ...gax.CallOption) *OperationIterator {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.ListOperations[0:len(c.CallOptions.ListOperations):len(c.CallOptions.ListOperations)], opts...)
	it := &OperationIterator{}
	it.InternalFetch = func(pageSize int, pageToken string) ([]*longrunningpb.Operation, string, error) {
		var resp *longrunningpb.ListOperationsResponse
		req.PageToken = pageToken
		if pageSize > math.MaxInt32 {
			req.PageSize = math.MaxInt32
		} else {
			req.PageSize = int32(pageSize)
		}
		err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
			var err error
			resp, err = c.operationsClient.ListOperations(ctx, req, settings.GRPC...)
			return err
		}, opts...)
		if err != nil {
			return nil, "", err
		}
		return resp.Operations, resp.NextPageToken, nil
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

// CancelOperation starts asynchronous cancellation on a long-running operation.  The server
// makes a best effort to cancel the operation, but success is not
// guaranteed.  If the server doesn't support this method, it returns
// google.rpc.Code.UNIMPLEMENTED.  Clients can use
// [Operations.GetOperation][google.longrunning.Operations.GetOperation] or
// other methods to check whether the cancellation succeeded or whether the
// operation completed despite cancellation. On successful cancellation,
// the operation is not deleted; instead, it becomes an operation with
// an [Operation.error][google.longrunning.Operation.error] value with a [google.rpc.Status.code][google.rpc.Status.code] of 1,
// corresponding to Code.CANCELLED.
func (c *OperationsClient) CancelOperation(ctx context.Context, req *longrunningpb.CancelOperationRequest, opts ...gax.CallOption) error {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.CancelOperation[0:len(c.CallOptions.CancelOperation):len(c.CallOptions.CancelOperation)], opts...)
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		_, err = c.operationsClient.CancelOperation(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	return err
}

// DeleteOperation deletes a long-running operation. This method indicates that the client is
// no longer interested in the operation result. It does not cancel the
// operation. If the server doesn't support this method, it returns
// google.rpc.Code.UNIMPLEMENTED.
func (c *OperationsClient) DeleteOperation(ctx context.Context, req *longrunningpb.DeleteOperationRequest, opts ...gax.CallOption) error {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.DeleteOperation[0:len(c.CallOptions.DeleteOperation):len(c.CallOptions.DeleteOperation)], opts...)
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		_, err = c.operationsClient.DeleteOperation(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	return err
}

// OperationIterator manages a stream of *longrunningpb.Operation.
type OperationIterator struct {
	items    []*longrunningpb.Operation
	pageInfo *iterator.PageInfo
	nextFunc func() error

	// InternalFetch is for use by the Google Cloud Libraries only.
	// It is not part of the stable interface of this package.
	//
	// InternalFetch returns results from a single call to the underlying RPC.
	// The number of results is no greater than pageSize.
	// If there are no more results, nextPageToken is empty and err is nil.
	InternalFetch func(pageSize int, pageToken string) (results []*longrunningpb.Operation, nextPageToken string, err error)
}

// PageInfo supports pagination. See the google.golang.org/api/iterator package for details.
func (it *OperationIterator) PageInfo() *iterator.PageInfo {
	return it.pageInfo
}

// Next returns the next result. Its second return value is iterator.Done if there are no more
// results. Once Next returns Done, all subsequent calls will return Done.
func (it *OperationIterator) Next() (*longrunningpb.Operation, error) {
	var item *longrunningpb.Operation
	if err := it.nextFunc(); err != nil {
		return item, err
	}
	item = it.items[0]
	it.items = it.items[1:]
	return item, nil
}

func (it *OperationIterator) bufLen() int {
	return len(it.items)
}

func (it *OperationIterator) takeBuf() interface{} {
	b := it.items
	it.items = nil
	return b
}
