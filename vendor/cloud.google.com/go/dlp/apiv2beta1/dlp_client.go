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

package dlp

import (
	"time"

	"cloud.google.com/go/internal/version"
	"cloud.google.com/go/longrunning"
	lroauto "cloud.google.com/go/longrunning/autogen"
	gax "github.com/googleapis/gax-go"
	"golang.org/x/net/context"
	"google.golang.org/api/option"
	"google.golang.org/api/transport"
	longrunningpb "google.golang.org/genproto/googleapis/longrunning"
	dlppb "google.golang.org/genproto/googleapis/privacy/dlp/v2beta1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
)

// CallOptions contains the retry settings for each method of Client.
type CallOptions struct {
	InspectContent         []gax.CallOption
	RedactContent          []gax.CallOption
	DeidentifyContent      []gax.CallOption
	AnalyzeDataSourceRisk  []gax.CallOption
	CreateInspectOperation []gax.CallOption
	ListInspectFindings    []gax.CallOption
	ListInfoTypes          []gax.CallOption
	ListRootCategories     []gax.CallOption
}

func defaultClientOptions() []option.ClientOption {
	return []option.ClientOption{
		option.WithEndpoint("dlp.googleapis.com:443"),
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
		InspectContent:         retry[[2]string{"default", "non_idempotent"}],
		RedactContent:          retry[[2]string{"default", "non_idempotent"}],
		DeidentifyContent:      retry[[2]string{"default", "idempotent"}],
		AnalyzeDataSourceRisk:  retry[[2]string{"default", "idempotent"}],
		CreateInspectOperation: retry[[2]string{"default", "non_idempotent"}],
		ListInspectFindings:    retry[[2]string{"default", "idempotent"}],
		ListInfoTypes:          retry[[2]string{"default", "idempotent"}],
		ListRootCategories:     retry[[2]string{"default", "idempotent"}],
	}
}

// Client is a client for interacting with DLP API.
type Client struct {
	// The connection to the service.
	conn *grpc.ClientConn

	// The gRPC API client.
	client dlppb.DlpServiceClient

	// LROClient is used internally to handle longrunning operations.
	// It is exposed so that its CallOptions can be modified if required.
	// Users should not Close this client.
	LROClient *lroauto.OperationsClient

	// The call options for this service.
	CallOptions *CallOptions

	// The x-goog-* metadata to be sent with each request.
	xGoogMetadata metadata.MD
}

// NewClient creates a new dlp service client.
//
// The DLP API is a service that allows clients
// to detect the presence of Personally Identifiable Information (PII) and other
// privacy-sensitive data in user-supplied, unstructured data streams, like text
// blocks or images.
// The service also includes methods for sensitive data redaction and
// scheduling of data scans on Google Cloud Platform based data sets.
func NewClient(ctx context.Context, opts ...option.ClientOption) (*Client, error) {
	conn, err := transport.DialGRPC(ctx, append(defaultClientOptions(), opts...)...)
	if err != nil {
		return nil, err
	}
	c := &Client{
		conn:        conn,
		CallOptions: defaultCallOptions(),

		client: dlppb.NewDlpServiceClient(conn),
	}
	c.setGoogleClientInfo()

	c.LROClient, err = lroauto.NewOperationsClient(ctx, option.WithGRPCConn(conn))
	if err != nil {
		// This error "should not happen", since we are just reusing old connection
		// and never actually need to dial.
		// If this does happen, we could leak conn. However, we cannot close conn:
		// If the user invoked the function with option.WithGRPCConn,
		// we would close a connection that's still in use.
		// TODO(pongad): investigate error conditions.
		return nil, err
	}
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

// ResultPath returns the path for the result resource.
func ResultPath(result string) string {
	return "" +
		"inspect/results/" +
		result +
		""
}

// InspectContent finds potentially sensitive info in a list of strings.
// This method has limits on input size, processing time, and output size.
func (c *Client) InspectContent(ctx context.Context, req *dlppb.InspectContentRequest, opts ...gax.CallOption) (*dlppb.InspectContentResponse, error) {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.InspectContent[0:len(c.CallOptions.InspectContent):len(c.CallOptions.InspectContent)], opts...)
	var resp *dlppb.InspectContentResponse
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.client.InspectContent(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// RedactContent redacts potentially sensitive info from a list of strings.
// This method has limits on input size, processing time, and output size.
func (c *Client) RedactContent(ctx context.Context, req *dlppb.RedactContentRequest, opts ...gax.CallOption) (*dlppb.RedactContentResponse, error) {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.RedactContent[0:len(c.CallOptions.RedactContent):len(c.CallOptions.RedactContent)], opts...)
	var resp *dlppb.RedactContentResponse
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.client.RedactContent(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// DeidentifyContent de-identifies potentially sensitive info from a list of strings.
// This method has limits on input size and output size.
func (c *Client) DeidentifyContent(ctx context.Context, req *dlppb.DeidentifyContentRequest, opts ...gax.CallOption) (*dlppb.DeidentifyContentResponse, error) {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.DeidentifyContent[0:len(c.CallOptions.DeidentifyContent):len(c.CallOptions.DeidentifyContent)], opts...)
	var resp *dlppb.DeidentifyContentResponse
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.client.DeidentifyContent(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// AnalyzeDataSourceRisk schedules a job to compute risk analysis metrics over content in a Google
// Cloud Platform repository.
func (c *Client) AnalyzeDataSourceRisk(ctx context.Context, req *dlppb.AnalyzeDataSourceRiskRequest, opts ...gax.CallOption) (*AnalyzeDataSourceRiskOperation, error) {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.AnalyzeDataSourceRisk[0:len(c.CallOptions.AnalyzeDataSourceRisk):len(c.CallOptions.AnalyzeDataSourceRisk)], opts...)
	var resp *longrunningpb.Operation
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.client.AnalyzeDataSourceRisk(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return &AnalyzeDataSourceRiskOperation{
		lro: longrunning.InternalNewOperation(c.LROClient, resp),
	}, nil
}

// CreateInspectOperation schedules a job scanning content in a Google Cloud Platform data
// repository.
func (c *Client) CreateInspectOperation(ctx context.Context, req *dlppb.CreateInspectOperationRequest, opts ...gax.CallOption) (*CreateInspectOperationHandle, error) {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.CreateInspectOperation[0:len(c.CallOptions.CreateInspectOperation):len(c.CallOptions.CreateInspectOperation)], opts...)
	var resp *longrunningpb.Operation
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.client.CreateInspectOperation(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return &CreateInspectOperationHandle{
		lro: longrunning.InternalNewOperation(c.LROClient, resp),
	}, nil
}

// ListInspectFindings returns list of results for given inspect operation result set id.
func (c *Client) ListInspectFindings(ctx context.Context, req *dlppb.ListInspectFindingsRequest, opts ...gax.CallOption) (*dlppb.ListInspectFindingsResponse, error) {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.ListInspectFindings[0:len(c.CallOptions.ListInspectFindings):len(c.CallOptions.ListInspectFindings)], opts...)
	var resp *dlppb.ListInspectFindingsResponse
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.client.ListInspectFindings(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// ListInfoTypes returns sensitive information types for given category.
func (c *Client) ListInfoTypes(ctx context.Context, req *dlppb.ListInfoTypesRequest, opts ...gax.CallOption) (*dlppb.ListInfoTypesResponse, error) {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.ListInfoTypes[0:len(c.CallOptions.ListInfoTypes):len(c.CallOptions.ListInfoTypes)], opts...)
	var resp *dlppb.ListInfoTypesResponse
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.client.ListInfoTypes(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// ListRootCategories returns the list of root categories of sensitive information.
func (c *Client) ListRootCategories(ctx context.Context, req *dlppb.ListRootCategoriesRequest, opts ...gax.CallOption) (*dlppb.ListRootCategoriesResponse, error) {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.ListRootCategories[0:len(c.CallOptions.ListRootCategories):len(c.CallOptions.ListRootCategories)], opts...)
	var resp *dlppb.ListRootCategoriesResponse
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.client.ListRootCategories(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// AnalyzeDataSourceRiskOperation manages a long-running operation from AnalyzeDataSourceRisk.
type AnalyzeDataSourceRiskOperation struct {
	lro *longrunning.Operation
}

// AnalyzeDataSourceRiskOperation returns a new AnalyzeDataSourceRiskOperation from a given name.
// The name must be that of a previously created AnalyzeDataSourceRiskOperation, possibly from a different process.
func (c *Client) AnalyzeDataSourceRiskOperation(name string) *AnalyzeDataSourceRiskOperation {
	return &AnalyzeDataSourceRiskOperation{
		lro: longrunning.InternalNewOperation(c.LROClient, &longrunningpb.Operation{Name: name}),
	}
}

// Wait blocks until the long-running operation is completed, returning the response and any errors encountered.
//
// See documentation of Poll for error-handling information.
func (op *AnalyzeDataSourceRiskOperation) Wait(ctx context.Context, opts ...gax.CallOption) (*dlppb.RiskAnalysisOperationResult, error) {
	var resp dlppb.RiskAnalysisOperationResult
	if err := op.lro.WaitWithInterval(ctx, &resp, 45000*time.Millisecond, opts...); err != nil {
		return nil, err
	}
	return &resp, nil
}

// Poll fetches the latest state of the long-running operation.
//
// Poll also fetches the latest metadata, which can be retrieved by Metadata.
//
// If Poll fails, the error is returned and op is unmodified. If Poll succeeds and
// the operation has completed with failure, the error is returned and op.Done will return true.
// If Poll succeeds and the operation has completed successfully,
// op.Done will return true, and the response of the operation is returned.
// If Poll succeeds and the operation has not completed, the returned response and error are both nil.
func (op *AnalyzeDataSourceRiskOperation) Poll(ctx context.Context, opts ...gax.CallOption) (*dlppb.RiskAnalysisOperationResult, error) {
	var resp dlppb.RiskAnalysisOperationResult
	if err := op.lro.Poll(ctx, &resp, opts...); err != nil {
		return nil, err
	}
	if !op.Done() {
		return nil, nil
	}
	return &resp, nil
}

// Metadata returns metadata associated with the long-running operation.
// Metadata itself does not contact the server, but Poll does.
// To get the latest metadata, call this method after a successful call to Poll.
// If the metadata is not available, the returned metadata and error are both nil.
func (op *AnalyzeDataSourceRiskOperation) Metadata() (*dlppb.RiskAnalysisOperationMetadata, error) {
	var meta dlppb.RiskAnalysisOperationMetadata
	if err := op.lro.Metadata(&meta); err == longrunning.ErrNoMetadata {
		return nil, nil
	} else if err != nil {
		return nil, err
	}
	return &meta, nil
}

// Done reports whether the long-running operation has completed.
func (op *AnalyzeDataSourceRiskOperation) Done() bool {
	return op.lro.Done()
}

// Name returns the name of the long-running operation.
// The name is assigned by the server and is unique within the service from which the operation is created.
func (op *AnalyzeDataSourceRiskOperation) Name() string {
	return op.lro.Name()
}

// CreateInspectOperationHandle manages a long-running operation from CreateInspectOperation.
type CreateInspectOperationHandle struct {
	lro *longrunning.Operation
}

// CreateInspectOperationHandle returns a new CreateInspectOperationHandle from a given name.
// The name must be that of a previously created CreateInspectOperationHandle, possibly from a different process.
func (c *Client) CreateInspectOperationHandle(name string) *CreateInspectOperationHandle {
	return &CreateInspectOperationHandle{
		lro: longrunning.InternalNewOperation(c.LROClient, &longrunningpb.Operation{Name: name}),
	}
}

// Wait blocks until the long-running operation is completed, returning the response and any errors encountered.
//
// See documentation of Poll for error-handling information.
func (op *CreateInspectOperationHandle) Wait(ctx context.Context, opts ...gax.CallOption) (*dlppb.InspectOperationResult, error) {
	var resp dlppb.InspectOperationResult
	if err := op.lro.WaitWithInterval(ctx, &resp, 45000*time.Millisecond, opts...); err != nil {
		return nil, err
	}
	return &resp, nil
}

// Poll fetches the latest state of the long-running operation.
//
// Poll also fetches the latest metadata, which can be retrieved by Metadata.
//
// If Poll fails, the error is returned and op is unmodified. If Poll succeeds and
// the operation has completed with failure, the error is returned and op.Done will return true.
// If Poll succeeds and the operation has completed successfully,
// op.Done will return true, and the response of the operation is returned.
// If Poll succeeds and the operation has not completed, the returned response and error are both nil.
func (op *CreateInspectOperationHandle) Poll(ctx context.Context, opts ...gax.CallOption) (*dlppb.InspectOperationResult, error) {
	var resp dlppb.InspectOperationResult
	if err := op.lro.Poll(ctx, &resp, opts...); err != nil {
		return nil, err
	}
	if !op.Done() {
		return nil, nil
	}
	return &resp, nil
}

// Metadata returns metadata associated with the long-running operation.
// Metadata itself does not contact the server, but Poll does.
// To get the latest metadata, call this method after a successful call to Poll.
// If the metadata is not available, the returned metadata and error are both nil.
func (op *CreateInspectOperationHandle) Metadata() (*dlppb.InspectOperationMetadata, error) {
	var meta dlppb.InspectOperationMetadata
	if err := op.lro.Metadata(&meta); err == longrunning.ErrNoMetadata {
		return nil, nil
	} else if err != nil {
		return nil, err
	}
	return &meta, nil
}

// Done reports whether the long-running operation has completed.
func (op *CreateInspectOperationHandle) Done() bool {
	return op.lro.Done()
}

// Name returns the name of the long-running operation.
// The name is assigned by the server and is unique within the service from which the operation is created.
func (op *CreateInspectOperationHandle) Name() string {
	return op.lro.Name()
}
