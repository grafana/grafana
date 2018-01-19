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
	"cloud.google.com/go/internal/version"
	gax "github.com/googleapis/gax-go"
	"golang.org/x/net/context"
	"google.golang.org/api/option"
	"google.golang.org/api/transport"
	clouderrorreportingpb "google.golang.org/genproto/googleapis/devtools/clouderrorreporting/v1beta1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"
)

// ReportErrorsCallOptions contains the retry settings for each method of ReportErrorsClient.
type ReportErrorsCallOptions struct {
	ReportErrorEvent []gax.CallOption
}

func defaultReportErrorsClientOptions() []option.ClientOption {
	return []option.ClientOption{
		option.WithEndpoint("clouderrorreporting.googleapis.com:443"),
		option.WithScopes(DefaultAuthScopes()...),
	}
}

func defaultReportErrorsCallOptions() *ReportErrorsCallOptions {
	retry := map[[2]string][]gax.CallOption{}
	return &ReportErrorsCallOptions{
		ReportErrorEvent: retry[[2]string{"default", "non_idempotent"}],
	}
}

// ReportErrorsClient is a client for interacting with Stackdriver Error Reporting API.
type ReportErrorsClient struct {
	// The connection to the service.
	conn *grpc.ClientConn

	// The gRPC API client.
	reportErrorsClient clouderrorreportingpb.ReportErrorsServiceClient

	// The call options for this service.
	CallOptions *ReportErrorsCallOptions

	// The x-goog-* metadata to be sent with each request.
	xGoogMetadata metadata.MD
}

// NewReportErrorsClient creates a new report errors service client.
//
// An API for reporting error events.
func NewReportErrorsClient(ctx context.Context, opts ...option.ClientOption) (*ReportErrorsClient, error) {
	conn, err := transport.DialGRPC(ctx, append(defaultReportErrorsClientOptions(), opts...)...)
	if err != nil {
		return nil, err
	}
	c := &ReportErrorsClient{
		conn:        conn,
		CallOptions: defaultReportErrorsCallOptions(),

		reportErrorsClient: clouderrorreportingpb.NewReportErrorsServiceClient(conn),
	}
	c.SetGoogleClientInfo()
	return c, nil
}

// Connection returns the client's connection to the API service.
func (c *ReportErrorsClient) Connection() *grpc.ClientConn {
	return c.conn
}

// Close closes the connection to the API service. The user should invoke this when
// the client is no longer required.
func (c *ReportErrorsClient) Close() error {
	return c.conn.Close()
}

// SetGoogleClientInfo sets the name and version of the application in
// the `x-goog-api-client` header passed on each request. Intended for
// use by Google-written clients.
func (c *ReportErrorsClient) SetGoogleClientInfo(keyval ...string) {
	kv := append([]string{"gl-go", version.Go()}, keyval...)
	kv = append(kv, "gapic", version.Repo, "gax", gax.Version, "grpc", grpc.Version)
	c.xGoogMetadata = metadata.Pairs("x-goog-api-client", gax.XGoogHeader(kv...))
}

// ReportErrorsProjectPath returns the path for the project resource.
func ReportErrorsProjectPath(project string) string {
	return "" +
		"projects/" +
		project +
		""
}

// ReportErrorEvent report an individual error event.
//
// This endpoint accepts <strong>either</strong> an OAuth token,
// <strong>or</strong> an
// <a href="https://support.google.com/cloud/answer/6158862">API key</a>
// for authentication. To use an API key, append it to the URL as the value of
// a key parameter. For example:<pre>POST https://clouderrorreporting.googleapis.com/v1beta1/projects/example-project/events:report?key=123ABC456</pre>
func (c *ReportErrorsClient) ReportErrorEvent(ctx context.Context, req *clouderrorreportingpb.ReportErrorEventRequest, opts ...gax.CallOption) (*clouderrorreportingpb.ReportErrorEventResponse, error) {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.ReportErrorEvent[0:len(c.CallOptions.ReportErrorEvent):len(c.CallOptions.ReportErrorEvent)], opts...)
	var resp *clouderrorreportingpb.ReportErrorEventResponse
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.reportErrorsClient.ReportErrorEvent(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}
