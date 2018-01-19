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

package logging

import (
	"math"
	"time"

	"cloud.google.com/go/internal/version"
	gax "github.com/googleapis/gax-go"
	"golang.org/x/net/context"
	"google.golang.org/api/iterator"
	"google.golang.org/api/option"
	"google.golang.org/api/transport"
	monitoredrespb "google.golang.org/genproto/googleapis/api/monitoredres"
	loggingpb "google.golang.org/genproto/googleapis/logging/v2"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
)

// CallOptions contains the retry settings for each method of Client.
type CallOptions struct {
	DeleteLog                        []gax.CallOption
	WriteLogEntries                  []gax.CallOption
	ListLogEntries                   []gax.CallOption
	ListMonitoredResourceDescriptors []gax.CallOption
	ListLogs                         []gax.CallOption
}

func defaultClientOptions() []option.ClientOption {
	return []option.ClientOption{
		option.WithEndpoint("logging.googleapis.com:443"),
		option.WithScopes(DefaultAuthScopes()...),
	}
}

func defaultCallOptions() *CallOptions {
	retry := map[[2]string][]gax.CallOption{
		{"default", "idempotent"}: {
			gax.WithRetry(func() gax.Retryer {
				return gax.OnCodes([]codes.Code{
					codes.DeadlineExceeded,
					codes.Internal,
					codes.Unavailable,
				}, gax.Backoff{
					Initial:    100 * time.Millisecond,
					Max:        1000 * time.Millisecond,
					Multiplier: 1.2,
				})
			}),
		},
		{"list", "idempotent"}: {
			gax.WithRetry(func() gax.Retryer {
				return gax.OnCodes([]codes.Code{
					codes.DeadlineExceeded,
					codes.Internal,
					codes.Unavailable,
				}, gax.Backoff{
					Initial:    100 * time.Millisecond,
					Max:        1000 * time.Millisecond,
					Multiplier: 1.2,
				})
			}),
		},
	}
	return &CallOptions{
		DeleteLog:                        retry[[2]string{"default", "idempotent"}],
		WriteLogEntries:                  retry[[2]string{"default", "non_idempotent"}],
		ListLogEntries:                   retry[[2]string{"list", "idempotent"}],
		ListMonitoredResourceDescriptors: retry[[2]string{"default", "idempotent"}],
		ListLogs: retry[[2]string{"default", "idempotent"}],
	}
}

// Client is a client for interacting with Stackdriver Logging API.
type Client struct {
	// The connection to the service.
	conn *grpc.ClientConn

	// The gRPC API client.
	client loggingpb.LoggingServiceV2Client

	// The call options for this service.
	CallOptions *CallOptions

	// The x-goog-* metadata to be sent with each request.
	xGoogMetadata metadata.MD
}

// NewClient creates a new logging service v2 client.
//
// Service for ingesting and querying logs.
func NewClient(ctx context.Context, opts ...option.ClientOption) (*Client, error) {
	conn, err := transport.DialGRPC(ctx, append(defaultClientOptions(), opts...)...)
	if err != nil {
		return nil, err
	}
	c := &Client{
		conn:        conn,
		CallOptions: defaultCallOptions(),

		client: loggingpb.NewLoggingServiceV2Client(conn),
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

// ProjectPath returns the path for the project resource.
func ProjectPath(project string) string {
	return "" +
		"projects/" +
		project +
		""
}

// LogPath returns the path for the log resource.
func LogPath(project, log string) string {
	return "" +
		"projects/" +
		project +
		"/logs/" +
		log +
		""
}

// DeleteLog deletes all the log entries in a log.
// The log reappears if it receives new entries.
// Log entries written shortly before the delete operation might not be
// deleted.
func (c *Client) DeleteLog(ctx context.Context, req *loggingpb.DeleteLogRequest, opts ...gax.CallOption) error {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.DeleteLog[0:len(c.CallOptions.DeleteLog):len(c.CallOptions.DeleteLog)], opts...)
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		_, err = c.client.DeleteLog(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	return err
}

// WriteLogEntries ## Log entry resources
//
// Writes log entries to Stackdriver Logging. This API method is the
// only way to send log entries to Stackdriver Logging. This method
// is used, directly or indirectly, by the Stackdriver Logging agent
// (fluentd) and all logging libraries configured to use Stackdriver
// Logging.
func (c *Client) WriteLogEntries(ctx context.Context, req *loggingpb.WriteLogEntriesRequest, opts ...gax.CallOption) (*loggingpb.WriteLogEntriesResponse, error) {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.WriteLogEntries[0:len(c.CallOptions.WriteLogEntries):len(c.CallOptions.WriteLogEntries)], opts...)
	var resp *loggingpb.WriteLogEntriesResponse
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.client.WriteLogEntries(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// ListLogEntries lists log entries.  Use this method to retrieve log entries from
// Stackdriver Logging.  For ways to export log entries, see
// Exporting Logs (at /logging/docs/export).
func (c *Client) ListLogEntries(ctx context.Context, req *loggingpb.ListLogEntriesRequest, opts ...gax.CallOption) *LogEntryIterator {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.ListLogEntries[0:len(c.CallOptions.ListLogEntries):len(c.CallOptions.ListLogEntries)], opts...)
	it := &LogEntryIterator{}
	it.InternalFetch = func(pageSize int, pageToken string) ([]*loggingpb.LogEntry, string, error) {
		var resp *loggingpb.ListLogEntriesResponse
		req.PageToken = pageToken
		if pageSize > math.MaxInt32 {
			req.PageSize = math.MaxInt32
		} else {
			req.PageSize = int32(pageSize)
		}
		err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
			var err error
			resp, err = c.client.ListLogEntries(ctx, req, settings.GRPC...)
			return err
		}, opts...)
		if err != nil {
			return nil, "", err
		}
		return resp.Entries, resp.NextPageToken, nil
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

// ListMonitoredResourceDescriptors lists the descriptors for monitored resource types used by Stackdriver
// Logging.
func (c *Client) ListMonitoredResourceDescriptors(ctx context.Context, req *loggingpb.ListMonitoredResourceDescriptorsRequest, opts ...gax.CallOption) *MonitoredResourceDescriptorIterator {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.ListMonitoredResourceDescriptors[0:len(c.CallOptions.ListMonitoredResourceDescriptors):len(c.CallOptions.ListMonitoredResourceDescriptors)], opts...)
	it := &MonitoredResourceDescriptorIterator{}
	it.InternalFetch = func(pageSize int, pageToken string) ([]*monitoredrespb.MonitoredResourceDescriptor, string, error) {
		var resp *loggingpb.ListMonitoredResourceDescriptorsResponse
		req.PageToken = pageToken
		if pageSize > math.MaxInt32 {
			req.PageSize = math.MaxInt32
		} else {
			req.PageSize = int32(pageSize)
		}
		err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
			var err error
			resp, err = c.client.ListMonitoredResourceDescriptors(ctx, req, settings.GRPC...)
			return err
		}, opts...)
		if err != nil {
			return nil, "", err
		}
		return resp.ResourceDescriptors, resp.NextPageToken, nil
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

// ListLogs lists the logs in projects, organizations, folders, or billing accounts.
// Only logs that have entries are listed.
func (c *Client) ListLogs(ctx context.Context, req *loggingpb.ListLogsRequest, opts ...gax.CallOption) *StringIterator {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.ListLogs[0:len(c.CallOptions.ListLogs):len(c.CallOptions.ListLogs)], opts...)
	it := &StringIterator{}
	it.InternalFetch = func(pageSize int, pageToken string) ([]string, string, error) {
		var resp *loggingpb.ListLogsResponse
		req.PageToken = pageToken
		if pageSize > math.MaxInt32 {
			req.PageSize = math.MaxInt32
		} else {
			req.PageSize = int32(pageSize)
		}
		err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
			var err error
			resp, err = c.client.ListLogs(ctx, req, settings.GRPC...)
			return err
		}, opts...)
		if err != nil {
			return nil, "", err
		}
		return resp.LogNames, resp.NextPageToken, nil
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

// LogEntryIterator manages a stream of *loggingpb.LogEntry.
type LogEntryIterator struct {
	items    []*loggingpb.LogEntry
	pageInfo *iterator.PageInfo
	nextFunc func() error

	// InternalFetch is for use by the Google Cloud Libraries only.
	// It is not part of the stable interface of this package.
	//
	// InternalFetch returns results from a single call to the underlying RPC.
	// The number of results is no greater than pageSize.
	// If there are no more results, nextPageToken is empty and err is nil.
	InternalFetch func(pageSize int, pageToken string) (results []*loggingpb.LogEntry, nextPageToken string, err error)
}

// PageInfo supports pagination. See the google.golang.org/api/iterator package for details.
func (it *LogEntryIterator) PageInfo() *iterator.PageInfo {
	return it.pageInfo
}

// Next returns the next result. Its second return value is iterator.Done if there are no more
// results. Once Next returns Done, all subsequent calls will return Done.
func (it *LogEntryIterator) Next() (*loggingpb.LogEntry, error) {
	var item *loggingpb.LogEntry
	if err := it.nextFunc(); err != nil {
		return item, err
	}
	item = it.items[0]
	it.items = it.items[1:]
	return item, nil
}

func (it *LogEntryIterator) bufLen() int {
	return len(it.items)
}

func (it *LogEntryIterator) takeBuf() interface{} {
	b := it.items
	it.items = nil
	return b
}

// MonitoredResourceDescriptorIterator manages a stream of *monitoredrespb.MonitoredResourceDescriptor.
type MonitoredResourceDescriptorIterator struct {
	items    []*monitoredrespb.MonitoredResourceDescriptor
	pageInfo *iterator.PageInfo
	nextFunc func() error

	// InternalFetch is for use by the Google Cloud Libraries only.
	// It is not part of the stable interface of this package.
	//
	// InternalFetch returns results from a single call to the underlying RPC.
	// The number of results is no greater than pageSize.
	// If there are no more results, nextPageToken is empty and err is nil.
	InternalFetch func(pageSize int, pageToken string) (results []*monitoredrespb.MonitoredResourceDescriptor, nextPageToken string, err error)
}

// PageInfo supports pagination. See the google.golang.org/api/iterator package for details.
func (it *MonitoredResourceDescriptorIterator) PageInfo() *iterator.PageInfo {
	return it.pageInfo
}

// Next returns the next result. Its second return value is iterator.Done if there are no more
// results. Once Next returns Done, all subsequent calls will return Done.
func (it *MonitoredResourceDescriptorIterator) Next() (*monitoredrespb.MonitoredResourceDescriptor, error) {
	var item *monitoredrespb.MonitoredResourceDescriptor
	if err := it.nextFunc(); err != nil {
		return item, err
	}
	item = it.items[0]
	it.items = it.items[1:]
	return item, nil
}

func (it *MonitoredResourceDescriptorIterator) bufLen() int {
	return len(it.items)
}

func (it *MonitoredResourceDescriptorIterator) takeBuf() interface{} {
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
