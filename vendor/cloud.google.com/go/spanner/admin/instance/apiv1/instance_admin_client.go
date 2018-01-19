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

package instance

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
	instancepb "google.golang.org/genproto/googleapis/spanner/admin/instance/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
)

// InstanceAdminCallOptions contains the retry settings for each method of InstanceAdminClient.
type InstanceAdminCallOptions struct {
	ListInstanceConfigs []gax.CallOption
	GetInstanceConfig   []gax.CallOption
	ListInstances       []gax.CallOption
	GetInstance         []gax.CallOption
	CreateInstance      []gax.CallOption
	UpdateInstance      []gax.CallOption
	DeleteInstance      []gax.CallOption
	SetIamPolicy        []gax.CallOption
	GetIamPolicy        []gax.CallOption
	TestIamPermissions  []gax.CallOption
}

func defaultInstanceAdminClientOptions() []option.ClientOption {
	return []option.ClientOption{
		option.WithEndpoint("spanner.googleapis.com:443"),
		option.WithScopes(DefaultAuthScopes()...),
	}
}

func defaultInstanceAdminCallOptions() *InstanceAdminCallOptions {
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
	return &InstanceAdminCallOptions{
		ListInstanceConfigs: retry[[2]string{"default", "idempotent"}],
		GetInstanceConfig:   retry[[2]string{"default", "idempotent"}],
		ListInstances:       retry[[2]string{"default", "idempotent"}],
		GetInstance:         retry[[2]string{"default", "idempotent"}],
		CreateInstance:      retry[[2]string{"default", "non_idempotent"}],
		UpdateInstance:      retry[[2]string{"default", "non_idempotent"}],
		DeleteInstance:      retry[[2]string{"default", "idempotent"}],
		SetIamPolicy:        retry[[2]string{"default", "non_idempotent"}],
		GetIamPolicy:        retry[[2]string{"default", "idempotent"}],
		TestIamPermissions:  retry[[2]string{"default", "non_idempotent"}],
	}
}

// InstanceAdminClient is a client for interacting with Cloud Spanner Instance Admin API.
type InstanceAdminClient struct {
	// The connection to the service.
	conn *grpc.ClientConn

	// The gRPC API client.
	instanceAdminClient instancepb.InstanceAdminClient

	// LROClient is used internally to handle longrunning operations.
	// It is exposed so that its CallOptions can be modified if required.
	// Users should not Close this client.
	LROClient *lroauto.OperationsClient

	// The call options for this service.
	CallOptions *InstanceAdminCallOptions

	// The x-goog-* metadata to be sent with each request.
	xGoogMetadata metadata.MD
}

// NewInstanceAdminClient creates a new instance admin client.
//
// Cloud Spanner Instance Admin API
//
// The Cloud Spanner Instance Admin API can be used to create, delete,
// modify and list instances. Instances are dedicated Cloud Spanner serving
// and storage resources to be used by Cloud Spanner databases.
//
// Each instance has a "configuration", which dictates where the
// serving resources for the Cloud Spanner instance are located (e.g.,
// US-central, Europe). Configurations are created by Google based on
// resource availability.
//
// Cloud Spanner billing is based on the instances that exist and their
// sizes. After an instance exists, there are no additional
// per-database or per-operation charges for use of the instance
// (though there may be additional network bandwidth charges).
// Instances offer isolation: problems with databases in one instance
// will not affect other instances. However, within an instance
// databases can affect each other. For example, if one database in an
// instance receives a lot of requests and consumes most of the
// instance resources, fewer resources are available for other
// databases in that instance, and their performance may suffer.
func NewInstanceAdminClient(ctx context.Context, opts ...option.ClientOption) (*InstanceAdminClient, error) {
	conn, err := transport.DialGRPC(ctx, append(defaultInstanceAdminClientOptions(), opts...)...)
	if err != nil {
		return nil, err
	}
	c := &InstanceAdminClient{
		conn:        conn,
		CallOptions: defaultInstanceAdminCallOptions(),

		instanceAdminClient: instancepb.NewInstanceAdminClient(conn),
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
func (c *InstanceAdminClient) Connection() *grpc.ClientConn {
	return c.conn
}

// Close closes the connection to the API service. The user should invoke this when
// the client is no longer required.
func (c *InstanceAdminClient) Close() error {
	return c.conn.Close()
}

// setGoogleClientInfo sets the name and version of the application in
// the `x-goog-api-client` header passed on each request. Intended for
// use by Google-written clients.
func (c *InstanceAdminClient) setGoogleClientInfo(keyval ...string) {
	kv := append([]string{"gl-go", version.Go()}, keyval...)
	kv = append(kv, "gapic", version.Repo, "gax", gax.Version, "grpc", grpc.Version)
	c.xGoogMetadata = metadata.Pairs("x-goog-api-client", gax.XGoogHeader(kv...))
}

// InstanceAdminProjectPath returns the path for the project resource.
func InstanceAdminProjectPath(project string) string {
	return "" +
		"projects/" +
		project +
		""
}

// InstanceAdminInstanceConfigPath returns the path for the instance config resource.
func InstanceAdminInstanceConfigPath(project, instanceConfig string) string {
	return "" +
		"projects/" +
		project +
		"/instanceConfigs/" +
		instanceConfig +
		""
}

// InstanceAdminInstancePath returns the path for the instance resource.
func InstanceAdminInstancePath(project, instance string) string {
	return "" +
		"projects/" +
		project +
		"/instances/" +
		instance +
		""
}

// ListInstanceConfigs lists the supported instance configurations for a given project.
func (c *InstanceAdminClient) ListInstanceConfigs(ctx context.Context, req *instancepb.ListInstanceConfigsRequest, opts ...gax.CallOption) *InstanceConfigIterator {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.ListInstanceConfigs[0:len(c.CallOptions.ListInstanceConfigs):len(c.CallOptions.ListInstanceConfigs)], opts...)
	it := &InstanceConfigIterator{}
	it.InternalFetch = func(pageSize int, pageToken string) ([]*instancepb.InstanceConfig, string, error) {
		var resp *instancepb.ListInstanceConfigsResponse
		req.PageToken = pageToken
		if pageSize > math.MaxInt32 {
			req.PageSize = math.MaxInt32
		} else {
			req.PageSize = int32(pageSize)
		}
		err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
			var err error
			resp, err = c.instanceAdminClient.ListInstanceConfigs(ctx, req, settings.GRPC...)
			return err
		}, opts...)
		if err != nil {
			return nil, "", err
		}
		return resp.InstanceConfigs, resp.NextPageToken, nil
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

// GetInstanceConfig gets information about a particular instance configuration.
func (c *InstanceAdminClient) GetInstanceConfig(ctx context.Context, req *instancepb.GetInstanceConfigRequest, opts ...gax.CallOption) (*instancepb.InstanceConfig, error) {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.GetInstanceConfig[0:len(c.CallOptions.GetInstanceConfig):len(c.CallOptions.GetInstanceConfig)], opts...)
	var resp *instancepb.InstanceConfig
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.instanceAdminClient.GetInstanceConfig(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// ListInstances lists all instances in the given project.
func (c *InstanceAdminClient) ListInstances(ctx context.Context, req *instancepb.ListInstancesRequest, opts ...gax.CallOption) *InstanceIterator {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.ListInstances[0:len(c.CallOptions.ListInstances):len(c.CallOptions.ListInstances)], opts...)
	it := &InstanceIterator{}
	it.InternalFetch = func(pageSize int, pageToken string) ([]*instancepb.Instance, string, error) {
		var resp *instancepb.ListInstancesResponse
		req.PageToken = pageToken
		if pageSize > math.MaxInt32 {
			req.PageSize = math.MaxInt32
		} else {
			req.PageSize = int32(pageSize)
		}
		err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
			var err error
			resp, err = c.instanceAdminClient.ListInstances(ctx, req, settings.GRPC...)
			return err
		}, opts...)
		if err != nil {
			return nil, "", err
		}
		return resp.Instances, resp.NextPageToken, nil
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

// GetInstance gets information about a particular instance.
func (c *InstanceAdminClient) GetInstance(ctx context.Context, req *instancepb.GetInstanceRequest, opts ...gax.CallOption) (*instancepb.Instance, error) {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.GetInstance[0:len(c.CallOptions.GetInstance):len(c.CallOptions.GetInstance)], opts...)
	var resp *instancepb.Instance
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.instanceAdminClient.GetInstance(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// CreateInstance creates an instance and begins preparing it to begin serving. The
// returned [long-running operation][google.longrunning.Operation]
// can be used to track the progress of preparing the new
// instance. The instance name is assigned by the caller. If the
// named instance already exists, CreateInstance returns
// ALREADY_EXISTS.
//
// Immediately upon completion of this request:
//
//   The instance is readable via the API, with all requested attributes
//   but no allocated resources. Its state is CREATING.
//
// Until completion of the returned operation:
//
//   Cancelling the operation renders the instance immediately unreadable
//   via the API.
//
//   The instance can be deleted.
//
//   All other attempts to modify the instance are rejected.
//
// Upon completion of the returned operation:
//
//   Billing for all successfully-allocated resources begins (some types
//   may have lower than the requested levels).
//
//   Databases can be created in the instance.
//
//   The instance's allocated resource levels are readable via the API.
//
//   The instance's state becomes READY.
//
// The returned [long-running operation][google.longrunning.Operation] will
// have a name of the format <instance_name>/operations/<operation_id> and
// can be used to track creation of the instance.  The
// [metadata][google.longrunning.Operation.metadata] field type is
// [CreateInstanceMetadata][google.spanner.admin.instance.v1.CreateInstanceMetadata].
// The [response][google.longrunning.Operation.response] field type is
// [Instance][google.spanner.admin.instance.v1.Instance], if successful.
func (c *InstanceAdminClient) CreateInstance(ctx context.Context, req *instancepb.CreateInstanceRequest, opts ...gax.CallOption) (*CreateInstanceOperation, error) {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.CreateInstance[0:len(c.CallOptions.CreateInstance):len(c.CallOptions.CreateInstance)], opts...)
	var resp *longrunningpb.Operation
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.instanceAdminClient.CreateInstance(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return &CreateInstanceOperation{
		lro: longrunning.InternalNewOperation(c.LROClient, resp),
	}, nil
}

// UpdateInstance updates an instance, and begins allocating or releasing resources
// as requested. The returned [long-running
// operation][google.longrunning.Operation] can be used to track the
// progress of updating the instance. If the named instance does not
// exist, returns NOT_FOUND.
//
// Immediately upon completion of this request:
//
//   For resource types for which a decrease in the instance's allocation
//   has been requested, billing is based on the newly-requested level.
//
// Until completion of the returned operation:
//
//   Cancelling the operation sets its metadata's
//   [cancel_time][google.spanner.admin.instance.v1.UpdateInstanceMetadata.cancel_time], and begins
//   restoring resources to their pre-request values. The operation
//   is guaranteed to succeed at undoing all resource changes,
//   after which point it terminates with a CANCELLED status.
//
//   All other attempts to modify the instance are rejected.
//
//   Reading the instance via the API continues to give the pre-request
//   resource levels.
//
// Upon completion of the returned operation:
//
//   Billing begins for all successfully-allocated resources (some types
//   may have lower than the requested levels).
//
//   All newly-reserved resources are available for serving the instance's
//   tables.
//
//   The instance's new resource levels are readable via the API.
//
// The returned [long-running operation][google.longrunning.Operation] will
// have a name of the format <instance_name>/operations/<operation_id> and
// can be used to track the instance modification.  The
// [metadata][google.longrunning.Operation.metadata] field type is
// [UpdateInstanceMetadata][google.spanner.admin.instance.v1.UpdateInstanceMetadata].
// The [response][google.longrunning.Operation.response] field type is
// [Instance][google.spanner.admin.instance.v1.Instance], if successful.
//
// Authorization requires spanner.instances.update permission on
// resource [name][google.spanner.admin.instance.v1.Instance.name].
func (c *InstanceAdminClient) UpdateInstance(ctx context.Context, req *instancepb.UpdateInstanceRequest, opts ...gax.CallOption) (*UpdateInstanceOperation, error) {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.UpdateInstance[0:len(c.CallOptions.UpdateInstance):len(c.CallOptions.UpdateInstance)], opts...)
	var resp *longrunningpb.Operation
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.instanceAdminClient.UpdateInstance(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return &UpdateInstanceOperation{
		lro: longrunning.InternalNewOperation(c.LROClient, resp),
	}, nil
}

// DeleteInstance deletes an instance.
//
// Immediately upon completion of the request:
//
//   Billing ceases for all of the instance's reserved resources.
//
// Soon afterward:
//
//   The instance and all of its databases immediately and
//   irrevocably disappear from the API. All data in the databases
//   is permanently deleted.
func (c *InstanceAdminClient) DeleteInstance(ctx context.Context, req *instancepb.DeleteInstanceRequest, opts ...gax.CallOption) error {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.DeleteInstance[0:len(c.CallOptions.DeleteInstance):len(c.CallOptions.DeleteInstance)], opts...)
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		_, err = c.instanceAdminClient.DeleteInstance(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	return err
}

// SetIamPolicy sets the access control policy on an instance resource. Replaces any
// existing policy.
//
// Authorization requires spanner.instances.setIamPolicy on
// [resource][google.iam.v1.SetIamPolicyRequest.resource].
func (c *InstanceAdminClient) SetIamPolicy(ctx context.Context, req *iampb.SetIamPolicyRequest, opts ...gax.CallOption) (*iampb.Policy, error) {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.SetIamPolicy[0:len(c.CallOptions.SetIamPolicy):len(c.CallOptions.SetIamPolicy)], opts...)
	var resp *iampb.Policy
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.instanceAdminClient.SetIamPolicy(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// GetIamPolicy gets the access control policy for an instance resource. Returns an empty
// policy if an instance exists but does not have a policy set.
//
// Authorization requires spanner.instances.getIamPolicy on
// [resource][google.iam.v1.GetIamPolicyRequest.resource].
func (c *InstanceAdminClient) GetIamPolicy(ctx context.Context, req *iampb.GetIamPolicyRequest, opts ...gax.CallOption) (*iampb.Policy, error) {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.GetIamPolicy[0:len(c.CallOptions.GetIamPolicy):len(c.CallOptions.GetIamPolicy)], opts...)
	var resp *iampb.Policy
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.instanceAdminClient.GetIamPolicy(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// TestIamPermissions returns permissions that the caller has on the specified instance resource.
//
// Attempting this RPC on a non-existent Cloud Spanner instance resource will
// result in a NOT_FOUND error if the user has spanner.instances.list
// permission on the containing Google Cloud Project. Otherwise returns an
// empty set of permissions.
func (c *InstanceAdminClient) TestIamPermissions(ctx context.Context, req *iampb.TestIamPermissionsRequest, opts ...gax.CallOption) (*iampb.TestIamPermissionsResponse, error) {
	ctx = insertMetadata(ctx, c.xGoogMetadata)
	opts = append(c.CallOptions.TestIamPermissions[0:len(c.CallOptions.TestIamPermissions):len(c.CallOptions.TestIamPermissions)], opts...)
	var resp *iampb.TestIamPermissionsResponse
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.instanceAdminClient.TestIamPermissions(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// InstanceConfigIterator manages a stream of *instancepb.InstanceConfig.
type InstanceConfigIterator struct {
	items    []*instancepb.InstanceConfig
	pageInfo *iterator.PageInfo
	nextFunc func() error

	// InternalFetch is for use by the Google Cloud Libraries only.
	// It is not part of the stable interface of this package.
	//
	// InternalFetch returns results from a single call to the underlying RPC.
	// The number of results is no greater than pageSize.
	// If there are no more results, nextPageToken is empty and err is nil.
	InternalFetch func(pageSize int, pageToken string) (results []*instancepb.InstanceConfig, nextPageToken string, err error)
}

// PageInfo supports pagination. See the google.golang.org/api/iterator package for details.
func (it *InstanceConfigIterator) PageInfo() *iterator.PageInfo {
	return it.pageInfo
}

// Next returns the next result. Its second return value is iterator.Done if there are no more
// results. Once Next returns Done, all subsequent calls will return Done.
func (it *InstanceConfigIterator) Next() (*instancepb.InstanceConfig, error) {
	var item *instancepb.InstanceConfig
	if err := it.nextFunc(); err != nil {
		return item, err
	}
	item = it.items[0]
	it.items = it.items[1:]
	return item, nil
}

func (it *InstanceConfigIterator) bufLen() int {
	return len(it.items)
}

func (it *InstanceConfigIterator) takeBuf() interface{} {
	b := it.items
	it.items = nil
	return b
}

// InstanceIterator manages a stream of *instancepb.Instance.
type InstanceIterator struct {
	items    []*instancepb.Instance
	pageInfo *iterator.PageInfo
	nextFunc func() error

	// InternalFetch is for use by the Google Cloud Libraries only.
	// It is not part of the stable interface of this package.
	//
	// InternalFetch returns results from a single call to the underlying RPC.
	// The number of results is no greater than pageSize.
	// If there are no more results, nextPageToken is empty and err is nil.
	InternalFetch func(pageSize int, pageToken string) (results []*instancepb.Instance, nextPageToken string, err error)
}

// PageInfo supports pagination. See the google.golang.org/api/iterator package for details.
func (it *InstanceIterator) PageInfo() *iterator.PageInfo {
	return it.pageInfo
}

// Next returns the next result. Its second return value is iterator.Done if there are no more
// results. Once Next returns Done, all subsequent calls will return Done.
func (it *InstanceIterator) Next() (*instancepb.Instance, error) {
	var item *instancepb.Instance
	if err := it.nextFunc(); err != nil {
		return item, err
	}
	item = it.items[0]
	it.items = it.items[1:]
	return item, nil
}

func (it *InstanceIterator) bufLen() int {
	return len(it.items)
}

func (it *InstanceIterator) takeBuf() interface{} {
	b := it.items
	it.items = nil
	return b
}

// CreateInstanceOperation manages a long-running operation from CreateInstance.
type CreateInstanceOperation struct {
	lro *longrunning.Operation
}

// CreateInstanceOperation returns a new CreateInstanceOperation from a given name.
// The name must be that of a previously created CreateInstanceOperation, possibly from a different process.
func (c *InstanceAdminClient) CreateInstanceOperation(name string) *CreateInstanceOperation {
	return &CreateInstanceOperation{
		lro: longrunning.InternalNewOperation(c.LROClient, &longrunningpb.Operation{Name: name}),
	}
}

// Wait blocks until the long-running operation is completed, returning the response and any errors encountered.
//
// See documentation of Poll for error-handling information.
func (op *CreateInstanceOperation) Wait(ctx context.Context, opts ...gax.CallOption) (*instancepb.Instance, error) {
	var resp instancepb.Instance
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
func (op *CreateInstanceOperation) Poll(ctx context.Context, opts ...gax.CallOption) (*instancepb.Instance, error) {
	var resp instancepb.Instance
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
func (op *CreateInstanceOperation) Metadata() (*instancepb.CreateInstanceMetadata, error) {
	var meta instancepb.CreateInstanceMetadata
	if err := op.lro.Metadata(&meta); err == longrunning.ErrNoMetadata {
		return nil, nil
	} else if err != nil {
		return nil, err
	}
	return &meta, nil
}

// Done reports whether the long-running operation has completed.
func (op *CreateInstanceOperation) Done() bool {
	return op.lro.Done()
}

// Name returns the name of the long-running operation.
// The name is assigned by the server and is unique within the service from which the operation is created.
func (op *CreateInstanceOperation) Name() string {
	return op.lro.Name()
}

// UpdateInstanceOperation manages a long-running operation from UpdateInstance.
type UpdateInstanceOperation struct {
	lro *longrunning.Operation
}

// UpdateInstanceOperation returns a new UpdateInstanceOperation from a given name.
// The name must be that of a previously created UpdateInstanceOperation, possibly from a different process.
func (c *InstanceAdminClient) UpdateInstanceOperation(name string) *UpdateInstanceOperation {
	return &UpdateInstanceOperation{
		lro: longrunning.InternalNewOperation(c.LROClient, &longrunningpb.Operation{Name: name}),
	}
}

// Wait blocks until the long-running operation is completed, returning the response and any errors encountered.
//
// See documentation of Poll for error-handling information.
func (op *UpdateInstanceOperation) Wait(ctx context.Context, opts ...gax.CallOption) (*instancepb.Instance, error) {
	var resp instancepb.Instance
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
func (op *UpdateInstanceOperation) Poll(ctx context.Context, opts ...gax.CallOption) (*instancepb.Instance, error) {
	var resp instancepb.Instance
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
func (op *UpdateInstanceOperation) Metadata() (*instancepb.UpdateInstanceMetadata, error) {
	var meta instancepb.UpdateInstanceMetadata
	if err := op.lro.Metadata(&meta); err == longrunning.ErrNoMetadata {
		return nil, nil
	} else if err != nil {
		return nil, err
	}
	return &meta, nil
}

// Done reports whether the long-running operation has completed.
func (op *UpdateInstanceOperation) Done() bool {
	return op.lro.Done()
}

// Name returns the name of the long-running operation.
// The name is assigned by the server and is unique within the service from which the operation is created.
func (op *UpdateInstanceOperation) Name() string {
	return op.lro.Name()
}
