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

package datatransfer

import (
	"math"
	"time"

	"cloud.google.com/go/internal/version"
	gax "github.com/googleapis/gax-go"
	"golang.org/x/net/context"
	"google.golang.org/api/iterator"
	"google.golang.org/api/option"
	"google.golang.org/api/transport"
	datatransferpb "google.golang.org/genproto/googleapis/cloud/bigquery/datatransfer/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
)

// CallOptions contains the retry settings for each method of Client.
type CallOptions struct {
	GetDataSource        []gax.CallOption
	ListDataSources      []gax.CallOption
	CreateTransferConfig []gax.CallOption
	UpdateTransferConfig []gax.CallOption
	DeleteTransferConfig []gax.CallOption
	GetTransferConfig    []gax.CallOption
	ListTransferConfigs  []gax.CallOption
	ScheduleTransferRuns []gax.CallOption
	GetTransferRun       []gax.CallOption
	DeleteTransferRun    []gax.CallOption
	ListTransferRuns     []gax.CallOption
	ListTransferLogs     []gax.CallOption
	CheckValidCreds      []gax.CallOption
}

func defaultClientOptions() []option.ClientOption {
	return []option.ClientOption{
		option.WithEndpoint("bigquerydatatransfer.googleapis.com:443"),
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
	}
	return &CallOptions{
		GetDataSource:        retry[[2]string{"default", "idempotent"}],
		ListDataSources:      retry[[2]string{"default", "idempotent"}],
		CreateTransferConfig: retry[[2]string{"default", "non_idempotent"}],
		UpdateTransferConfig: retry[[2]string{"default", "non_idempotent"}],
		DeleteTransferConfig: retry[[2]string{"default", "idempotent"}],
		GetTransferConfig:    retry[[2]string{"default", "idempotent"}],
		ListTransferConfigs:  retry[[2]string{"default", "idempotent"}],
		ScheduleTransferRuns: retry[[2]string{"default", "non_idempotent"}],
		GetTransferRun:       retry[[2]string{"default", "idempotent"}],
		DeleteTransferRun:    retry[[2]string{"default", "idempotent"}],
		ListTransferRuns:     retry[[2]string{"default", "idempotent"}],
		ListTransferLogs:     retry[[2]string{"default", "idempotent"}],
		CheckValidCreds:      retry[[2]string{"default", "idempotent"}],
	}
}

// Client is a client for interacting with BigQuery Data Transfer API.
type Client struct {
	// The connection to the service.
	conn *grpc.ClientConn

	// The gRPC API client.
	client datatransferpb.DataTransferServiceClient

	// The call options for this service.
	CallOptions *CallOptions

	// The x-goog-* metadata to be sent with each request.
	xGoogMetadata metadata.MD
}

// NewClient creates a new data transfer service client.
//
// The Google BigQuery Data Transfer Service API enables BigQuery users to
// configure the transfer of their data from other Google Products into BigQuery.
// This service contains methods that are end user exposed. It backs up the
// frontend.
func NewClient(ctx context.Context, opts ...option.ClientOption) (*Client, error) {
	conn, err := transport.DialGRPC(ctx, append(defaultClientOptions(), opts...)...)
	if err != nil {
		return nil, err
	}
	c := &Client{
		conn:        conn,
		CallOptions: defaultCallOptions(),

		client: datatransferpb.NewDataTransferServiceClient(conn),
	}
	c.setGoogleClientInfo()
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

// setGoogleClientInfo sets the name and version of the application in
// the `x-goog-api-client` header passed on each request. Intended for
// use by Google-written clients.
func (c *Client) setGoogleClientInfo(keyval ...string) {
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

// LocationPath returns the path for the location resource.
func LocationPath(project, location string) string {
	return "" +
		"projects/" +
		project +
		"/locations/" +
		location +
		""
}

// LocationDataSourcePath returns the path for the location data source resource.
func LocationDataSourcePath(project, location, dataSource string) string {
	return "" +
		"projects/" +
		project +
		"/locations/" +
		location +
		"/dataSources/" +
		dataSource +
		""
}

// LocationTransferConfigPath returns the path for the location transfer config resource.
func LocationTransferConfigPath(project, location, transferConfig string) string {
	return "" +
		"projects/" +
		project +
		"/locations/" +
		location +
		"/transferConfigs/" +
		transferConfig +
		""
}

// LocationRunPath returns the path for the location run resource.
func LocationRunPath(project, location, transferConfig, run string) string {
	return "" +
		"projects/" +
		project +
		"/locations/" +
		location +
		"/transferConfigs/" +
		transferConfig +
		"/runs/" +
		run +
		""
}

// DataSourcePath returns the path for the data source resource.
func DataSourcePath(project, dataSource string) string {
	return "" +
		"projects/" +
		project +
		"/dataSources/" +
		dataSource +
		""
}

// TransferConfigPath returns the path for the transfer config resource.
func TransferConfigPath(project, transferConfig string) string {
	return "" +
		"projects/" +
		project +
		"/transferConfigs/" +
		transferConfig +
		""
}

// RunPath returns the path for the run resource.
func RunPath(project, transferConfig, run string) string {
	return "" +
		"projects/" +
		project +
		"/transferConfigs/" +
		transferConfig +
		"/runs/" +
		run +
		""
}

// GetDataSource retrieves a supported data source and returns its settings,
// which can be used for UI rendering.
func (c *Client) GetDataSource(ctx context.Context, req *datatransferpb.GetDataSourceRequest, opts ...gax.CallOption) (*datatransferpb.DataSource, error) {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.GetDataSource[0:len(c.CallOptions.GetDataSource):len(c.CallOptions.GetDataSource)], opts...)
	var resp *datatransferpb.DataSource
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.client.GetDataSource(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// ListDataSources lists supported data sources and returns their settings,
// which can be used for UI rendering.
func (c *Client) ListDataSources(ctx context.Context, req *datatransferpb.ListDataSourcesRequest, opts ...gax.CallOption) *DataSourceIterator {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.ListDataSources[0:len(c.CallOptions.ListDataSources):len(c.CallOptions.ListDataSources)], opts...)
	it := &DataSourceIterator{}
	it.InternalFetch = func(pageSize int, pageToken string) ([]*datatransferpb.DataSource, string, error) {
		var resp *datatransferpb.ListDataSourcesResponse
		req.PageToken = pageToken
		if pageSize > math.MaxInt32 {
			req.PageSize = math.MaxInt32
		} else {
			req.PageSize = int32(pageSize)
		}
		err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
			var err error
			resp, err = c.client.ListDataSources(ctx, req, settings.GRPC...)
			return err
		}, opts...)
		if err != nil {
			return nil, "", err
		}
		return resp.DataSources, resp.NextPageToken, nil
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

// CreateTransferConfig creates a new data transfer configuration.
func (c *Client) CreateTransferConfig(ctx context.Context, req *datatransferpb.CreateTransferConfigRequest, opts ...gax.CallOption) (*datatransferpb.TransferConfig, error) {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.CreateTransferConfig[0:len(c.CallOptions.CreateTransferConfig):len(c.CallOptions.CreateTransferConfig)], opts...)
	var resp *datatransferpb.TransferConfig
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.client.CreateTransferConfig(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// UpdateTransferConfig updates a data transfer configuration.
// All fields must be set, even if they are not updated.
func (c *Client) UpdateTransferConfig(ctx context.Context, req *datatransferpb.UpdateTransferConfigRequest, opts ...gax.CallOption) (*datatransferpb.TransferConfig, error) {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.UpdateTransferConfig[0:len(c.CallOptions.UpdateTransferConfig):len(c.CallOptions.UpdateTransferConfig)], opts...)
	var resp *datatransferpb.TransferConfig
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.client.UpdateTransferConfig(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// DeleteTransferConfig deletes a data transfer configuration,
// including any associated transfer runs and logs.
func (c *Client) DeleteTransferConfig(ctx context.Context, req *datatransferpb.DeleteTransferConfigRequest, opts ...gax.CallOption) error {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.DeleteTransferConfig[0:len(c.CallOptions.DeleteTransferConfig):len(c.CallOptions.DeleteTransferConfig)], opts...)
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		_, err = c.client.DeleteTransferConfig(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	return err
}

// GetTransferConfig returns information about a data transfer config.
func (c *Client) GetTransferConfig(ctx context.Context, req *datatransferpb.GetTransferConfigRequest, opts ...gax.CallOption) (*datatransferpb.TransferConfig, error) {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.GetTransferConfig[0:len(c.CallOptions.GetTransferConfig):len(c.CallOptions.GetTransferConfig)], opts...)
	var resp *datatransferpb.TransferConfig
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.client.GetTransferConfig(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// ListTransferConfigs returns information about all data transfers in the project.
func (c *Client) ListTransferConfigs(ctx context.Context, req *datatransferpb.ListTransferConfigsRequest, opts ...gax.CallOption) *TransferConfigIterator {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.ListTransferConfigs[0:len(c.CallOptions.ListTransferConfigs):len(c.CallOptions.ListTransferConfigs)], opts...)
	it := &TransferConfigIterator{}
	it.InternalFetch = func(pageSize int, pageToken string) ([]*datatransferpb.TransferConfig, string, error) {
		var resp *datatransferpb.ListTransferConfigsResponse
		req.PageToken = pageToken
		if pageSize > math.MaxInt32 {
			req.PageSize = math.MaxInt32
		} else {
			req.PageSize = int32(pageSize)
		}
		err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
			var err error
			resp, err = c.client.ListTransferConfigs(ctx, req, settings.GRPC...)
			return err
		}, opts...)
		if err != nil {
			return nil, "", err
		}
		return resp.TransferConfigs, resp.NextPageToken, nil
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

// ScheduleTransferRuns creates transfer runs for a time range [range_start_time, range_end_time].
// For each date - or whatever granularity the data source supports - in the
// range, one transfer run is created.
// Note that runs are created per UTC time in the time range.
func (c *Client) ScheduleTransferRuns(ctx context.Context, req *datatransferpb.ScheduleTransferRunsRequest, opts ...gax.CallOption) (*datatransferpb.ScheduleTransferRunsResponse, error) {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.ScheduleTransferRuns[0:len(c.CallOptions.ScheduleTransferRuns):len(c.CallOptions.ScheduleTransferRuns)], opts...)
	var resp *datatransferpb.ScheduleTransferRunsResponse
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.client.ScheduleTransferRuns(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// GetTransferRun returns information about the particular transfer run.
func (c *Client) GetTransferRun(ctx context.Context, req *datatransferpb.GetTransferRunRequest, opts ...gax.CallOption) (*datatransferpb.TransferRun, error) {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.GetTransferRun[0:len(c.CallOptions.GetTransferRun):len(c.CallOptions.GetTransferRun)], opts...)
	var resp *datatransferpb.TransferRun
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.client.GetTransferRun(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// DeleteTransferRun deletes the specified transfer run.
func (c *Client) DeleteTransferRun(ctx context.Context, req *datatransferpb.DeleteTransferRunRequest, opts ...gax.CallOption) error {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.DeleteTransferRun[0:len(c.CallOptions.DeleteTransferRun):len(c.CallOptions.DeleteTransferRun)], opts...)
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		_, err = c.client.DeleteTransferRun(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	return err
}

// ListTransferRuns returns information about running and completed jobs.
func (c *Client) ListTransferRuns(ctx context.Context, req *datatransferpb.ListTransferRunsRequest, opts ...gax.CallOption) *TransferRunIterator {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.ListTransferRuns[0:len(c.CallOptions.ListTransferRuns):len(c.CallOptions.ListTransferRuns)], opts...)
	it := &TransferRunIterator{}
	it.InternalFetch = func(pageSize int, pageToken string) ([]*datatransferpb.TransferRun, string, error) {
		var resp *datatransferpb.ListTransferRunsResponse
		req.PageToken = pageToken
		if pageSize > math.MaxInt32 {
			req.PageSize = math.MaxInt32
		} else {
			req.PageSize = int32(pageSize)
		}
		err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
			var err error
			resp, err = c.client.ListTransferRuns(ctx, req, settings.GRPC...)
			return err
		}, opts...)
		if err != nil {
			return nil, "", err
		}
		return resp.TransferRuns, resp.NextPageToken, nil
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

// ListTransferLogs returns user facing log messages for the data transfer run.
func (c *Client) ListTransferLogs(ctx context.Context, req *datatransferpb.ListTransferLogsRequest, opts ...gax.CallOption) *TransferMessageIterator {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.ListTransferLogs[0:len(c.CallOptions.ListTransferLogs):len(c.CallOptions.ListTransferLogs)], opts...)
	it := &TransferMessageIterator{}
	it.InternalFetch = func(pageSize int, pageToken string) ([]*datatransferpb.TransferMessage, string, error) {
		var resp *datatransferpb.ListTransferLogsResponse
		req.PageToken = pageToken
		if pageSize > math.MaxInt32 {
			req.PageSize = math.MaxInt32
		} else {
			req.PageSize = int32(pageSize)
		}
		err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
			var err error
			resp, err = c.client.ListTransferLogs(ctx, req, settings.GRPC...)
			return err
		}, opts...)
		if err != nil {
			return nil, "", err
		}
		return resp.TransferMessages, resp.NextPageToken, nil
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

// CheckValidCreds returns true if valid credentials exist for the given data source and
// requesting user.
// Some data sources doesn't support service account, so we need to talk to
// them on behalf of the end user. This API just checks whether we have OAuth
// token for the particular user, which is a pre-requisite before user can
// create a transfer config.
func (c *Client) CheckValidCreds(ctx context.Context, req *datatransferpb.CheckValidCredsRequest, opts ...gax.CallOption) (*datatransferpb.CheckValidCredsResponse, error) {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.CheckValidCreds[0:len(c.CallOptions.CheckValidCreds):len(c.CallOptions.CheckValidCreds)], opts...)
	var resp *datatransferpb.CheckValidCredsResponse
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.client.CheckValidCreds(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// DataSourceIterator manages a stream of *datatransferpb.DataSource.
type DataSourceIterator struct {
	items    []*datatransferpb.DataSource
	pageInfo *iterator.PageInfo
	nextFunc func() error

	// InternalFetch is for use by the Google Cloud Libraries only.
	// It is not part of the stable interface of this package.
	//
	// InternalFetch returns results from a single call to the underlying RPC.
	// The number of results is no greater than pageSize.
	// If there are no more results, nextPageToken is empty and err is nil.
	InternalFetch func(pageSize int, pageToken string) (results []*datatransferpb.DataSource, nextPageToken string, err error)
}

// PageInfo supports pagination. See the google.golang.org/api/iterator package for details.
func (it *DataSourceIterator) PageInfo() *iterator.PageInfo {
	return it.pageInfo
}

// Next returns the next result. Its second return value is iterator.Done if there are no more
// results. Once Next returns Done, all subsequent calls will return Done.
func (it *DataSourceIterator) Next() (*datatransferpb.DataSource, error) {
	var item *datatransferpb.DataSource
	if err := it.nextFunc(); err != nil {
		return item, err
	}
	item = it.items[0]
	it.items = it.items[1:]
	return item, nil
}

func (it *DataSourceIterator) bufLen() int {
	return len(it.items)
}

func (it *DataSourceIterator) takeBuf() interface{} {
	b := it.items
	it.items = nil
	return b
}

// TransferConfigIterator manages a stream of *datatransferpb.TransferConfig.
type TransferConfigIterator struct {
	items    []*datatransferpb.TransferConfig
	pageInfo *iterator.PageInfo
	nextFunc func() error

	// InternalFetch is for use by the Google Cloud Libraries only.
	// It is not part of the stable interface of this package.
	//
	// InternalFetch returns results from a single call to the underlying RPC.
	// The number of results is no greater than pageSize.
	// If there are no more results, nextPageToken is empty and err is nil.
	InternalFetch func(pageSize int, pageToken string) (results []*datatransferpb.TransferConfig, nextPageToken string, err error)
}

// PageInfo supports pagination. See the google.golang.org/api/iterator package for details.
func (it *TransferConfigIterator) PageInfo() *iterator.PageInfo {
	return it.pageInfo
}

// Next returns the next result. Its second return value is iterator.Done if there are no more
// results. Once Next returns Done, all subsequent calls will return Done.
func (it *TransferConfigIterator) Next() (*datatransferpb.TransferConfig, error) {
	var item *datatransferpb.TransferConfig
	if err := it.nextFunc(); err != nil {
		return item, err
	}
	item = it.items[0]
	it.items = it.items[1:]
	return item, nil
}

func (it *TransferConfigIterator) bufLen() int {
	return len(it.items)
}

func (it *TransferConfigIterator) takeBuf() interface{} {
	b := it.items
	it.items = nil
	return b
}

// TransferMessageIterator manages a stream of *datatransferpb.TransferMessage.
type TransferMessageIterator struct {
	items    []*datatransferpb.TransferMessage
	pageInfo *iterator.PageInfo
	nextFunc func() error

	// InternalFetch is for use by the Google Cloud Libraries only.
	// It is not part of the stable interface of this package.
	//
	// InternalFetch returns results from a single call to the underlying RPC.
	// The number of results is no greater than pageSize.
	// If there are no more results, nextPageToken is empty and err is nil.
	InternalFetch func(pageSize int, pageToken string) (results []*datatransferpb.TransferMessage, nextPageToken string, err error)
}

// PageInfo supports pagination. See the google.golang.org/api/iterator package for details.
func (it *TransferMessageIterator) PageInfo() *iterator.PageInfo {
	return it.pageInfo
}

// Next returns the next result. Its second return value is iterator.Done if there are no more
// results. Once Next returns Done, all subsequent calls will return Done.
func (it *TransferMessageIterator) Next() (*datatransferpb.TransferMessage, error) {
	var item *datatransferpb.TransferMessage
	if err := it.nextFunc(); err != nil {
		return item, err
	}
	item = it.items[0]
	it.items = it.items[1:]
	return item, nil
}

func (it *TransferMessageIterator) bufLen() int {
	return len(it.items)
}

func (it *TransferMessageIterator) takeBuf() interface{} {
	b := it.items
	it.items = nil
	return b
}

// TransferRunIterator manages a stream of *datatransferpb.TransferRun.
type TransferRunIterator struct {
	items    []*datatransferpb.TransferRun
	pageInfo *iterator.PageInfo
	nextFunc func() error

	// InternalFetch is for use by the Google Cloud Libraries only.
	// It is not part of the stable interface of this package.
	//
	// InternalFetch returns results from a single call to the underlying RPC.
	// The number of results is no greater than pageSize.
	// If there are no more results, nextPageToken is empty and err is nil.
	InternalFetch func(pageSize int, pageToken string) (results []*datatransferpb.TransferRun, nextPageToken string, err error)
}

// PageInfo supports pagination. See the google.golang.org/api/iterator package for details.
func (it *TransferRunIterator) PageInfo() *iterator.PageInfo {
	return it.pageInfo
}

// Next returns the next result. Its second return value is iterator.Done if there are no more
// results. Once Next returns Done, all subsequent calls will return Done.
func (it *TransferRunIterator) Next() (*datatransferpb.TransferRun, error) {
	var item *datatransferpb.TransferRun
	if err := it.nextFunc(); err != nil {
		return item, err
	}
	item = it.items[0]
	it.items = it.items[1:]
	return item, nil
}

func (it *TransferRunIterator) bufLen() int {
	return len(it.items)
}

func (it *TransferRunIterator) takeBuf() interface{} {
	b := it.items
	it.items = nil
	return b
}
