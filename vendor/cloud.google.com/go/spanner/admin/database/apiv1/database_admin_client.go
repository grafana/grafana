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

package database

import (
	"math"
	"time"

	"cloud.google.com/go/internal/version"
	"cloud.google.com/go/longrunning"
	lroauto "cloud.google.com/go/longrunning/autogen"
	gax "github.com/googleapis/gax-go"
	"golang.org/x/net/context"
	"google.golang.org/api/iterator"
	"google.golang.org/api/option"
	"google.golang.org/api/transport"
	iampb "google.golang.org/genproto/googleapis/iam/v1"
	longrunningpb "google.golang.org/genproto/googleapis/longrunning"
	databasepb "google.golang.org/genproto/googleapis/spanner/admin/database/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
)

// DatabaseAdminCallOptions contains the retry settings for each method of DatabaseAdminClient.
type DatabaseAdminCallOptions struct {
	ListDatabases      []gax.CallOption
	CreateDatabase     []gax.CallOption
	GetDatabase        []gax.CallOption
	UpdateDatabaseDdl  []gax.CallOption
	DropDatabase       []gax.CallOption
	GetDatabaseDdl     []gax.CallOption
	SetIamPolicy       []gax.CallOption
	GetIamPolicy       []gax.CallOption
	TestIamPermissions []gax.CallOption
}

func defaultDatabaseAdminClientOptions() []option.ClientOption {
	return []option.ClientOption{
		option.WithEndpoint("spanner.googleapis.com:443"),
		option.WithScopes(DefaultAuthScopes()...),
	}
}

func defaultDatabaseAdminCallOptions() *DatabaseAdminCallOptions {
	retry := map[[2]string][]gax.CallOption{
		{"default", "idempotent"}: {
			gax.WithRetry(func() gax.Retryer {
				return gax.OnCodes([]codes.Code{
					codes.DeadlineExceeded,
					codes.Unavailable,
				}, gax.Backoff{
					Initial:    1000 * time.Millisecond,
					Max:        32000 * time.Millisecond,
					Multiplier: 1.3,
				})
			}),
		},
	}
	return &DatabaseAdminCallOptions{
		ListDatabases:      retry[[2]string{"default", "idempotent"}],
		CreateDatabase:     retry[[2]string{"default", "non_idempotent"}],
		GetDatabase:        retry[[2]string{"default", "idempotent"}],
		UpdateDatabaseDdl:  retry[[2]string{"default", "idempotent"}],
		DropDatabase:       retry[[2]string{"default", "idempotent"}],
		GetDatabaseDdl:     retry[[2]string{"default", "idempotent"}],
		SetIamPolicy:       retry[[2]string{"default", "non_idempotent"}],
		GetIamPolicy:       retry[[2]string{"default", "idempotent"}],
		TestIamPermissions: retry[[2]string{"default", "non_idempotent"}],
	}
}

// DatabaseAdminClient is a client for interacting with Cloud Spanner Database Admin API.
type DatabaseAdminClient struct {
	// The connection to the service.
	conn *grpc.ClientConn

	// The gRPC API client.
	databaseAdminClient databasepb.DatabaseAdminClient

	// LROClient is used internally to handle longrunning operations.
	// It is exposed so that its CallOptions can be modified if required.
	// Users should not Close this client.
	LROClient *lroauto.OperationsClient

	// The call options for this service.
	CallOptions *DatabaseAdminCallOptions

	// The x-goog-* metadata to be sent with each request.
	xGoogMetadata metadata.MD
}

// NewDatabaseAdminClient creates a new database admin client.
//
// Cloud Spanner Database Admin API
//
// The Cloud Spanner Database Admin API can be used to create, drop, and
// list databases. It also enables updating the schema of pre-existing
// databases.
func NewDatabaseAdminClient(ctx context.Context, opts ...option.ClientOption) (*DatabaseAdminClient, error) {
	conn, err := transport.DialGRPC(ctx, append(defaultDatabaseAdminClientOptions(), opts...)...)
	if err != nil {
		return nil, err
	}
	c := &DatabaseAdminClient{
		conn:        conn,
		CallOptions: defaultDatabaseAdminCallOptions(),

		databaseAdminClient: databasepb.NewDatabaseAdminClient(conn),
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
func (c *DatabaseAdminClient) Connection() *grpc.ClientConn {
	return c.conn
}

// Close closes the connection to the API service. The user should invoke this when
// the client is no longer required.
func (c *DatabaseAdminClient) Close() error {
	return c.conn.Close()
}

// setGoogleClientInfo sets the name and version of the application in
// the `x-goog-api-client` header passed on each request. Intended for
// use by Google-written clients.
func (c *DatabaseAdminClient) setGoogleClientInfo(keyval ...string) {
	kv := append([]string{"gl-go", version.Go()}, keyval...)
	kv = append(kv, "gapic", version.Repo, "gax", gax.Version, "grpc", grpc.Version)
	c.xGoogMetadata = metadata.Pairs("x-goog-api-client", gax.XGoogHeader(kv...))
}

// DatabaseAdminInstancePath returns the path for the instance resource.
func DatabaseAdminInstancePath(project, instance string) string {
	return "" +
		"projects/" +
		project +
		"/instances/" +
		instance +
		""
}

// DatabaseAdminDatabasePath returns the path for the database resource.
func DatabaseAdminDatabasePath(project, instance, database string) string {
	return "" +
		"projects/" +
		project +
		"/instances/" +
		instance +
		"/databases/" +
		database +
		""
}

// ListDatabases lists Cloud Spanner databases.
func (c *DatabaseAdminClient) ListDatabases(ctx context.Context, req *databasepb.ListDatabasesRequest, opts ...gax.CallOption) *DatabaseIterator {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.ListDatabases[0:len(c.CallOptions.ListDatabases):len(c.CallOptions.ListDatabases)], opts...)
	it := &DatabaseIterator{}
	it.InternalFetch = func(pageSize int, pageToken string) ([]*databasepb.Database, string, error) {
		var resp *databasepb.ListDatabasesResponse
		req.PageToken = pageToken
		if pageSize > math.MaxInt32 {
			req.PageSize = math.MaxInt32
		} else {
			req.PageSize = int32(pageSize)
		}
		err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
			var err error
			resp, err = c.databaseAdminClient.ListDatabases(ctx, req, settings.GRPC...)
			return err
		}, opts...)
		if err != nil {
			return nil, "", err
		}
		return resp.Databases, resp.NextPageToken, nil
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

// CreateDatabase creates a new Cloud Spanner database and starts to prepare it for serving.
// The returned [long-running operation][google.longrunning.Operation] will
// have a name of the format <database_name>/operations/<operation_id> and
// can be used to track preparation of the database. The
// [metadata][google.longrunning.Operation.metadata] field type is
// [CreateDatabaseMetadata][google.spanner.admin.database.v1.CreateDatabaseMetadata]. The
// [response][google.longrunning.Operation.response] field type is
// [Database][google.spanner.admin.database.v1.Database], if successful.
func (c *DatabaseAdminClient) CreateDatabase(ctx context.Context, req *databasepb.CreateDatabaseRequest, opts ...gax.CallOption) (*CreateDatabaseOperation, error) {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.CreateDatabase[0:len(c.CallOptions.CreateDatabase):len(c.CallOptions.CreateDatabase)], opts...)
	var resp *longrunningpb.Operation
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.databaseAdminClient.CreateDatabase(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return &CreateDatabaseOperation{
		lro: longrunning.InternalNewOperation(c.LROClient, resp),
	}, nil
}

// GetDatabase gets the state of a Cloud Spanner database.
func (c *DatabaseAdminClient) GetDatabase(ctx context.Context, req *databasepb.GetDatabaseRequest, opts ...gax.CallOption) (*databasepb.Database, error) {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.GetDatabase[0:len(c.CallOptions.GetDatabase):len(c.CallOptions.GetDatabase)], opts...)
	var resp *databasepb.Database
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.databaseAdminClient.GetDatabase(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// UpdateDatabaseDdl updates the schema of a Cloud Spanner database by
// creating/altering/dropping tables, columns, indexes, etc. The returned
// [long-running operation][google.longrunning.Operation] will have a name of
// the format <database_name>/operations/<operation_id> and can be used to
// track execution of the schema change(s). The
// [metadata][google.longrunning.Operation.metadata] field type is
// [UpdateDatabaseDdlMetadata][google.spanner.admin.database.v1.UpdateDatabaseDdlMetadata].  The operation has no response.
func (c *DatabaseAdminClient) UpdateDatabaseDdl(ctx context.Context, req *databasepb.UpdateDatabaseDdlRequest, opts ...gax.CallOption) (*UpdateDatabaseDdlOperation, error) {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.UpdateDatabaseDdl[0:len(c.CallOptions.UpdateDatabaseDdl):len(c.CallOptions.UpdateDatabaseDdl)], opts...)
	var resp *longrunningpb.Operation
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.databaseAdminClient.UpdateDatabaseDdl(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return &UpdateDatabaseDdlOperation{
		lro: longrunning.InternalNewOperation(c.LROClient, resp),
	}, nil
}

// DropDatabase drops (aka deletes) a Cloud Spanner database.
func (c *DatabaseAdminClient) DropDatabase(ctx context.Context, req *databasepb.DropDatabaseRequest, opts ...gax.CallOption) error {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.DropDatabase[0:len(c.CallOptions.DropDatabase):len(c.CallOptions.DropDatabase)], opts...)
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		_, err = c.databaseAdminClient.DropDatabase(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	return err
}

// GetDatabaseDdl returns the schema of a Cloud Spanner database as a list of formatted
// DDL statements. This method does not show pending schema updates, those may
// be queried using the [Operations][google.longrunning.Operations] API.
func (c *DatabaseAdminClient) GetDatabaseDdl(ctx context.Context, req *databasepb.GetDatabaseDdlRequest, opts ...gax.CallOption) (*databasepb.GetDatabaseDdlResponse, error) {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.GetDatabaseDdl[0:len(c.CallOptions.GetDatabaseDdl):len(c.CallOptions.GetDatabaseDdl)], opts...)
	var resp *databasepb.GetDatabaseDdlResponse
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.databaseAdminClient.GetDatabaseDdl(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// SetIamPolicy sets the access control policy on a database resource. Replaces any
// existing policy.
//
// Authorization requires spanner.databases.setIamPolicy permission on
// [resource][google.iam.v1.SetIamPolicyRequest.resource].
func (c *DatabaseAdminClient) SetIamPolicy(ctx context.Context, req *iampb.SetIamPolicyRequest, opts ...gax.CallOption) (*iampb.Policy, error) {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.SetIamPolicy[0:len(c.CallOptions.SetIamPolicy):len(c.CallOptions.SetIamPolicy)], opts...)
	var resp *iampb.Policy
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.databaseAdminClient.SetIamPolicy(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// GetIamPolicy gets the access control policy for a database resource. Returns an empty
// policy if a database exists but does not have a policy set.
//
// Authorization requires spanner.databases.getIamPolicy permission on
// [resource][google.iam.v1.GetIamPolicyRequest.resource].
func (c *DatabaseAdminClient) GetIamPolicy(ctx context.Context, req *iampb.GetIamPolicyRequest, opts ...gax.CallOption) (*iampb.Policy, error) {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.GetIamPolicy[0:len(c.CallOptions.GetIamPolicy):len(c.CallOptions.GetIamPolicy)], opts...)
	var resp *iampb.Policy
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.databaseAdminClient.GetIamPolicy(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// TestIamPermissions returns permissions that the caller has on the specified database resource.
//
// Attempting this RPC on a non-existent Cloud Spanner database will result in
// a NOT_FOUND error if the user has spanner.databases.list permission on
// the containing Cloud Spanner instance. Otherwise returns an empty set of
// permissions.
func (c *DatabaseAdminClient) TestIamPermissions(ctx context.Context, req *iampb.TestIamPermissionsRequest, opts ...gax.CallOption) (*iampb.TestIamPermissionsResponse, error) {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.TestIamPermissions[0:len(c.CallOptions.TestIamPermissions):len(c.CallOptions.TestIamPermissions)], opts...)
	var resp *iampb.TestIamPermissionsResponse
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.databaseAdminClient.TestIamPermissions(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// DatabaseIterator manages a stream of *databasepb.Database.
type DatabaseIterator struct {
	items    []*databasepb.Database
	pageInfo *iterator.PageInfo
	nextFunc func() error

	// InternalFetch is for use by the Google Cloud Libraries only.
	// It is not part of the stable interface of this package.
	//
	// InternalFetch returns results from a single call to the underlying RPC.
	// The number of results is no greater than pageSize.
	// If there are no more results, nextPageToken is empty and err is nil.
	InternalFetch func(pageSize int, pageToken string) (results []*databasepb.Database, nextPageToken string, err error)
}

// PageInfo supports pagination. See the google.golang.org/api/iterator package for details.
func (it *DatabaseIterator) PageInfo() *iterator.PageInfo {
	return it.pageInfo
}

// Next returns the next result. Its second return value is iterator.Done if there are no more
// results. Once Next returns Done, all subsequent calls will return Done.
func (it *DatabaseIterator) Next() (*databasepb.Database, error) {
	var item *databasepb.Database
	if err := it.nextFunc(); err != nil {
		return item, err
	}
	item = it.items[0]
	it.items = it.items[1:]
	return item, nil
}

func (it *DatabaseIterator) bufLen() int {
	return len(it.items)
}

func (it *DatabaseIterator) takeBuf() interface{} {
	b := it.items
	it.items = nil
	return b
}

// CreateDatabaseOperation manages a long-running operation from CreateDatabase.
type CreateDatabaseOperation struct {
	lro *longrunning.Operation
}

// CreateDatabaseOperation returns a new CreateDatabaseOperation from a given name.
// The name must be that of a previously created CreateDatabaseOperation, possibly from a different process.
func (c *DatabaseAdminClient) CreateDatabaseOperation(name string) *CreateDatabaseOperation {
	return &CreateDatabaseOperation{
		lro: longrunning.InternalNewOperation(c.LROClient, &longrunningpb.Operation{Name: name}),
	}
}

// Wait blocks until the long-running operation is completed, returning the response and any errors encountered.
//
// See documentation of Poll for error-handling information.
func (op *CreateDatabaseOperation) Wait(ctx context.Context, opts ...gax.CallOption) (*databasepb.Database, error) {
	var resp databasepb.Database
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
func (op *CreateDatabaseOperation) Poll(ctx context.Context, opts ...gax.CallOption) (*databasepb.Database, error) {
	var resp databasepb.Database
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
func (op *CreateDatabaseOperation) Metadata() (*databasepb.CreateDatabaseMetadata, error) {
	var meta databasepb.CreateDatabaseMetadata
	if err := op.lro.Metadata(&meta); err == longrunning.ErrNoMetadata {
		return nil, nil
	} else if err != nil {
		return nil, err
	}
	return &meta, nil
}

// Done reports whether the long-running operation has completed.
func (op *CreateDatabaseOperation) Done() bool {
	return op.lro.Done()
}

// Name returns the name of the long-running operation.
// The name is assigned by the server and is unique within the service from which the operation is created.
func (op *CreateDatabaseOperation) Name() string {
	return op.lro.Name()
}

// UpdateDatabaseDdlOperation manages a long-running operation from UpdateDatabaseDdl.
type UpdateDatabaseDdlOperation struct {
	lro *longrunning.Operation
}

// UpdateDatabaseDdlOperation returns a new UpdateDatabaseDdlOperation from a given name.
// The name must be that of a previously created UpdateDatabaseDdlOperation, possibly from a different process.
func (c *DatabaseAdminClient) UpdateDatabaseDdlOperation(name string) *UpdateDatabaseDdlOperation {
	return &UpdateDatabaseDdlOperation{
		lro: longrunning.InternalNewOperation(c.LROClient, &longrunningpb.Operation{Name: name}),
	}
}

// Wait blocks until the long-running operation is completed, returning any error encountered.
//
// See documentation of Poll for error-handling information.
func (op *UpdateDatabaseDdlOperation) Wait(ctx context.Context, opts ...gax.CallOption) error {
	return op.lro.WaitWithInterval(ctx, nil, 45000*time.Millisecond, opts...)
}

// Poll fetches the latest state of the long-running operation.
//
// Poll also fetches the latest metadata, which can be retrieved by Metadata.
//
// If Poll fails, the error is returned and op is unmodified. If Poll succeeds and
// the operation has completed with failure, the error is returned and op.Done will return true.
// If Poll succeeds and the operation has completed successfully, op.Done will return true.
func (op *UpdateDatabaseDdlOperation) Poll(ctx context.Context, opts ...gax.CallOption) error {
	return op.lro.Poll(ctx, nil, opts...)
}

// Metadata returns metadata associated with the long-running operation.
// Metadata itself does not contact the server, but Poll does.
// To get the latest metadata, call this method after a successful call to Poll.
// If the metadata is not available, the returned metadata and error are both nil.
func (op *UpdateDatabaseDdlOperation) Metadata() (*databasepb.UpdateDatabaseDdlMetadata, error) {
	var meta databasepb.UpdateDatabaseDdlMetadata
	if err := op.lro.Metadata(&meta); err == longrunning.ErrNoMetadata {
		return nil, nil
	} else if err != nil {
		return nil, err
	}
	return &meta, nil
}

// Done reports whether the long-running operation has completed.
func (op *UpdateDatabaseDdlOperation) Done() bool {
	return op.lro.Done()
}

// Name returns the name of the long-running operation.
// The name is assigned by the server and is unique within the service from which the operation is created.
func (op *UpdateDatabaseDdlOperation) Name() string {
	return op.lro.Name()
}
