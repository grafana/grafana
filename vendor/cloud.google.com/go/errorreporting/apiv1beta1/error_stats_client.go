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

package errorreporting

import (
	"math"
	"time"

	"cloud.google.com/go/internal/version"
	gax "github.com/googleapis/gax-go"
	"golang.org/x/net/context"
	"google.golang.org/api/iterator"
	"google.golang.org/api/option"
	"google.golang.org/api/transport"
	clouderrorreportingpb "google.golang.org/genproto/googleapis/devtools/clouderrorreporting/v1beta1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
)

// ErrorStatsCallOptions contains the retry settings for each method of ErrorStatsClient.
type ErrorStatsCallOptions struct {
	ListGroupStats []gax.CallOption
	ListEvents     []gax.CallOption
	DeleteEvents   []gax.CallOption
}

func defaultErrorStatsClientOptions() []option.ClientOption {
	return []option.ClientOption{
		option.WithEndpoint("clouderrorreporting.googleapis.com:443"),
		option.WithScopes(DefaultAuthScopes()...),
	}
}

func defaultErrorStatsCallOptions() *ErrorStatsCallOptions {
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
	return &ErrorStatsCallOptions{
		ListGroupStats: retry[[2]string{"default", "idempotent"}],
		ListEvents:     retry[[2]string{"default", "idempotent"}],
		DeleteEvents:   retry[[2]string{"default", "idempotent"}],
	}
}

// ErrorStatsClient is a client for interacting with Stackdriver Error Reporting API.
type ErrorStatsClient struct {
	// The connection to the service.
	conn *grpc.ClientConn

	// The gRPC API client.
	errorStatsClient clouderrorreportingpb.ErrorStatsServiceClient

	// The call options for this service.
	CallOptions *ErrorStatsCallOptions

	// The x-goog-* metadata to be sent with each request.
	xGoogMetadata metadata.MD
}

// NewErrorStatsClient creates a new error stats service client.
//
// An API for retrieving and managing error statistics as well as data for
// individual events.
func NewErrorStatsClient(ctx context.Context, opts ...option.ClientOption) (*ErrorStatsClient, error) {
	conn, err := transport.DialGRPC(ctx, append(defaultErrorStatsClientOptions(), opts...)...)
	if err != nil {
		return nil, err
	}
	c := &ErrorStatsClient{
		conn:        conn,
		CallOptions: defaultErrorStatsCallOptions(),

		errorStatsClient: clouderrorreportingpb.NewErrorStatsServiceClient(conn),
	}
	c.SetGoogleClientInfo()
	return c, nil
}

// Connection returns the client's connection to the API service.
func (c *ErrorStatsClient) Connection() *grpc.ClientConn {
	return c.conn
}

// Close closes the connection to the API service. The user should invoke this when
// the client is no longer required.
func (c *ErrorStatsClient) Close() error {
	return c.conn.Close()
}

// SetGoogleClientInfo sets the name and version of the application in
// the `x-goog-api-client` header passed on each request. Intended for
// use by Google-written clients.
func (c *ErrorStatsClient) SetGoogleClientInfo(keyval ...string) {
	kv := append([]string{"gl-go", version.Go()}, keyval...)
	kv = append(kv, "gapic", version.Repo, "gax", gax.Version, "grpc", grpc.Version)
	c.xGoogMetadata = metadata.Pairs("x-goog-api-client", gax.XGoogHeader(kv...))
}

// ErrorStatsProjectPath returns the path for the project resource.
func ErrorStatsProjectPath(project string) string {
	return "" +
		"projects/" +
		project +
		""
}

// ListGroupStats lists the specified groups.
func (c *ErrorStatsClient) ListGroupStats(ctx context.Context, req *clouderrorreportingpb.ListGroupStatsRequest, opts ...gax.CallOption) *ErrorGroupStatsIterator {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.ListGroupStats[0:len(c.CallOptions.ListGroupStats):len(c.CallOptions.ListGroupStats)], opts...)
	it := &ErrorGroupStatsIterator{}
	it.InternalFetch = func(pageSize int, pageToken string) ([]*clouderrorreportingpb.ErrorGroupStats, string, error) {
		var resp *clouderrorreportingpb.ListGroupStatsResponse
		req.PageToken = pageToken
		if pageSize > math.MaxInt32 {
			req.PageSize = math.MaxInt32
		} else {
			req.PageSize = int32(pageSize)
		}
		err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
			var err error
			resp, err = c.errorStatsClient.ListGroupStats(ctx, req, settings.GRPC...)
			return err
		}, opts...)
		if err != nil {
			return nil, "", err
		}
		return resp.ErrorGroupStats, resp.NextPageToken, nil
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

// ListEvents lists the specified events.
func (c *ErrorStatsClient) ListEvents(ctx context.Context, req *clouderrorreportingpb.ListEventsRequest, opts ...gax.CallOption) *ErrorEventIterator {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.ListEvents[0:len(c.CallOptions.ListEvents):len(c.CallOptions.ListEvents)], opts...)
	it := &ErrorEventIterator{}
	it.InternalFetch = func(pageSize int, pageToken string) ([]*clouderrorreportingpb.ErrorEvent, string, error) {
		var resp *clouderrorreportingpb.ListEventsResponse
		req.PageToken = pageToken
		if pageSize > math.MaxInt32 {
			req.PageSize = math.MaxInt32
		} else {
			req.PageSize = int32(pageSize)
		}
		err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
			var err error
			resp, err = c.errorStatsClient.ListEvents(ctx, req, settings.GRPC...)
			return err
		}, opts...)
		if err != nil {
			return nil, "", err
		}
		return resp.ErrorEvents, resp.NextPageToken, nil
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

// DeleteEvents deletes all error events of a given project.
func (c *ErrorStatsClient) DeleteEvents(ctx context.Context, req *clouderrorreportingpb.DeleteEventsRequest, opts ...gax.CallOption) (*clouderrorreportingpb.DeleteEventsResponse, error) {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.DeleteEvents[0:len(c.CallOptions.DeleteEvents):len(c.CallOptions.DeleteEvents)], opts...)
	var resp *clouderrorreportingpb.DeleteEventsResponse
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.errorStatsClient.DeleteEvents(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// ErrorEventIterator manages a stream of *clouderrorreportingpb.ErrorEvent.
type ErrorEventIterator struct {
	items    []*clouderrorreportingpb.ErrorEvent
	pageInfo *iterator.PageInfo
	nextFunc func() error

	// InternalFetch is for use by the Google Cloud Libraries only.
	// It is not part of the stable interface of this package.
	//
	// InternalFetch returns results from a single call to the underlying RPC.
	// The number of results is no greater than pageSize.
	// If there are no more results, nextPageToken is empty and err is nil.
	InternalFetch func(pageSize int, pageToken string) (results []*clouderrorreportingpb.ErrorEvent, nextPageToken string, err error)
}

// PageInfo supports pagination. See the google.golang.org/api/iterator package for details.
func (it *ErrorEventIterator) PageInfo() *iterator.PageInfo {
	return it.pageInfo
}

// Next returns the next result. Its second return value is iterator.Done if there are no more
// results. Once Next returns Done, all subsequent calls will return Done.
func (it *ErrorEventIterator) Next() (*clouderrorreportingpb.ErrorEvent, error) {
	var item *clouderrorreportingpb.ErrorEvent
	if err := it.nextFunc(); err != nil {
		return item, err
	}
	item = it.items[0]
	it.items = it.items[1:]
	return item, nil
}

func (it *ErrorEventIterator) bufLen() int {
	return len(it.items)
}

func (it *ErrorEventIterator) takeBuf() interface{} {
	b := it.items
	it.items = nil
	return b
}

// ErrorGroupStatsIterator manages a stream of *clouderrorreportingpb.ErrorGroupStats.
type ErrorGroupStatsIterator struct {
	items    []*clouderrorreportingpb.ErrorGroupStats
	pageInfo *iterator.PageInfo
	nextFunc func() error

	// InternalFetch is for use by the Google Cloud Libraries only.
	// It is not part of the stable interface of this package.
	//
	// InternalFetch returns results from a single call to the underlying RPC.
	// The number of results is no greater than pageSize.
	// If there are no more results, nextPageToken is empty and err is nil.
	InternalFetch func(pageSize int, pageToken string) (results []*clouderrorreportingpb.ErrorGroupStats, nextPageToken string, err error)
}

// PageInfo supports pagination. See the google.golang.org/api/iterator package for details.
func (it *ErrorGroupStatsIterator) PageInfo() *iterator.PageInfo {
	return it.pageInfo
}

// Next returns the next result. Its second return value is iterator.Done if there are no more
// results. Once Next returns Done, all subsequent calls will return Done.
func (it *ErrorGroupStatsIterator) Next() (*clouderrorreportingpb.ErrorGroupStats, error) {
	var item *clouderrorreportingpb.ErrorGroupStats
	if err := it.nextFunc(); err != nil {
		return item, err
	}
	item = it.items[0]
	it.items = it.items[1:]
	return item, nil
}

func (it *ErrorGroupStatsIterator) bufLen() int {
	return len(it.items)
}

func (it *ErrorGroupStatsIterator) takeBuf() interface{} {
	b := it.items
	it.items = nil
	return b
}
