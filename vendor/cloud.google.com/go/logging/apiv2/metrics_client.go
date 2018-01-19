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
	loggingpb "google.golang.org/genproto/googleapis/logging/v2"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
)

// MetricsCallOptions contains the retry settings for each method of MetricsClient.
type MetricsCallOptions struct {
	ListLogMetrics  []gax.CallOption
	GetLogMetric    []gax.CallOption
	CreateLogMetric []gax.CallOption
	UpdateLogMetric []gax.CallOption
	DeleteLogMetric []gax.CallOption
}

func defaultMetricsClientOptions() []option.ClientOption {
	return []option.ClientOption{
		option.WithEndpoint("logging.googleapis.com:443"),
		option.WithScopes(DefaultAuthScopes()...),
	}
}

func defaultMetricsCallOptions() *MetricsCallOptions {
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
	}
	return &MetricsCallOptions{
		ListLogMetrics:  retry[[2]string{"default", "idempotent"}],
		GetLogMetric:    retry[[2]string{"default", "idempotent"}],
		CreateLogMetric: retry[[2]string{"default", "non_idempotent"}],
		UpdateLogMetric: retry[[2]string{"default", "non_idempotent"}],
		DeleteLogMetric: retry[[2]string{"default", "idempotent"}],
	}
}

// MetricsClient is a client for interacting with Stackdriver Logging API.
type MetricsClient struct {
	// The connection to the service.
	conn *grpc.ClientConn

	// The gRPC API client.
	metricsClient loggingpb.MetricsServiceV2Client

	// The call options for this service.
	CallOptions *MetricsCallOptions

	// The x-goog-* metadata to be sent with each request.
	xGoogMetadata metadata.MD
}

// NewMetricsClient creates a new metrics service v2 client.
//
// Service for configuring logs-based metrics.
func NewMetricsClient(ctx context.Context, opts ...option.ClientOption) (*MetricsClient, error) {
	conn, err := transport.DialGRPC(ctx, append(defaultMetricsClientOptions(), opts...)...)
	if err != nil {
		return nil, err
	}
	c := &MetricsClient{
		conn:        conn,
		CallOptions: defaultMetricsCallOptions(),

		metricsClient: loggingpb.NewMetricsServiceV2Client(conn),
	}
	c.SetGoogleClientInfo()
	return c, nil
}

// Connection returns the client's connection to the API service.
func (c *MetricsClient) Connection() *grpc.ClientConn {
	return c.conn
}

// Close closes the connection to the API service. The user should invoke this when
// the client is no longer required.
func (c *MetricsClient) Close() error {
	return c.conn.Close()
}

// SetGoogleClientInfo sets the name and version of the application in
// the `x-goog-api-client` header passed on each request. Intended for
// use by Google-written clients.
func (c *MetricsClient) SetGoogleClientInfo(keyval ...string) {
	kv := append([]string{"gl-go", version.Go()}, keyval...)
	kv = append(kv, "gapic", version.Repo, "gax", gax.Version, "grpc", grpc.Version)
	c.xGoogMetadata = metadata.Pairs("x-goog-api-client", gax.XGoogHeader(kv...))
}

// MetricsProjectPath returns the path for the project resource.
func MetricsProjectPath(project string) string {
	return "" +
		"projects/" +
		project +
		""
}

// MetricsMetricPath returns the path for the metric resource.
func MetricsMetricPath(project, metric string) string {
	return "" +
		"projects/" +
		project +
		"/metrics/" +
		metric +
		""
}

// ListLogMetrics lists logs-based metrics.
func (c *MetricsClient) ListLogMetrics(ctx context.Context, req *loggingpb.ListLogMetricsRequest, opts ...gax.CallOption) *LogMetricIterator {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.ListLogMetrics[0:len(c.CallOptions.ListLogMetrics):len(c.CallOptions.ListLogMetrics)], opts...)
	it := &LogMetricIterator{}
	it.InternalFetch = func(pageSize int, pageToken string) ([]*loggingpb.LogMetric, string, error) {
		var resp *loggingpb.ListLogMetricsResponse
		req.PageToken = pageToken
		if pageSize > math.MaxInt32 {
			req.PageSize = math.MaxInt32
		} else {
			req.PageSize = int32(pageSize)
		}
		err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
			var err error
			resp, err = c.metricsClient.ListLogMetrics(ctx, req, settings.GRPC...)
			return err
		}, opts...)
		if err != nil {
			return nil, "", err
		}
		return resp.Metrics, resp.NextPageToken, nil
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

// GetLogMetric gets a logs-based metric.
func (c *MetricsClient) GetLogMetric(ctx context.Context, req *loggingpb.GetLogMetricRequest, opts ...gax.CallOption) (*loggingpb.LogMetric, error) {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.GetLogMetric[0:len(c.CallOptions.GetLogMetric):len(c.CallOptions.GetLogMetric)], opts...)
	var resp *loggingpb.LogMetric
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.metricsClient.GetLogMetric(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// CreateLogMetric creates a logs-based metric.
func (c *MetricsClient) CreateLogMetric(ctx context.Context, req *loggingpb.CreateLogMetricRequest, opts ...gax.CallOption) (*loggingpb.LogMetric, error) {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.CreateLogMetric[0:len(c.CallOptions.CreateLogMetric):len(c.CallOptions.CreateLogMetric)], opts...)
	var resp *loggingpb.LogMetric
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.metricsClient.CreateLogMetric(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// UpdateLogMetric creates or updates a logs-based metric.
func (c *MetricsClient) UpdateLogMetric(ctx context.Context, req *loggingpb.UpdateLogMetricRequest, opts ...gax.CallOption) (*loggingpb.LogMetric, error) {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.UpdateLogMetric[0:len(c.CallOptions.UpdateLogMetric):len(c.CallOptions.UpdateLogMetric)], opts...)
	var resp *loggingpb.LogMetric
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.metricsClient.UpdateLogMetric(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// DeleteLogMetric deletes a logs-based metric.
func (c *MetricsClient) DeleteLogMetric(ctx context.Context, req *loggingpb.DeleteLogMetricRequest, opts ...gax.CallOption) error {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.DeleteLogMetric[0:len(c.CallOptions.DeleteLogMetric):len(c.CallOptions.DeleteLogMetric)], opts...)
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		_, err = c.metricsClient.DeleteLogMetric(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	return err
}

// LogMetricIterator manages a stream of *loggingpb.LogMetric.
type LogMetricIterator struct {
	items    []*loggingpb.LogMetric
	pageInfo *iterator.PageInfo
	nextFunc func() error

	// InternalFetch is for use by the Google Cloud Libraries only.
	// It is not part of the stable interface of this package.
	//
	// InternalFetch returns results from a single call to the underlying RPC.
	// The number of results is no greater than pageSize.
	// If there are no more results, nextPageToken is empty and err is nil.
	InternalFetch func(pageSize int, pageToken string) (results []*loggingpb.LogMetric, nextPageToken string, err error)
}

// PageInfo supports pagination. See the google.golang.org/api/iterator package for details.
func (it *LogMetricIterator) PageInfo() *iterator.PageInfo {
	return it.pageInfo
}

// Next returns the next result. Its second return value is iterator.Done if there are no more
// results. Once Next returns Done, all subsequent calls will return Done.
func (it *LogMetricIterator) Next() (*loggingpb.LogMetric, error) {
	var item *loggingpb.LogMetric
	if err := it.nextFunc(); err != nil {
		return item, err
	}
	item = it.items[0]
	it.items = it.items[1:]
	return item, nil
}

func (it *LogMetricIterator) bufLen() int {
	return len(it.items)
}

func (it *LogMetricIterator) takeBuf() interface{} {
	b := it.items
	it.items = nil
	return b
}
