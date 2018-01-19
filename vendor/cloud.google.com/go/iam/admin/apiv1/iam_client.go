// Copyright 2017, Google Inc. All rights reserved.
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

package admin

import (
	"math"
	"time"

	"cloud.google.com/go/internal/version"
	gax "github.com/googleapis/gax-go"
	"golang.org/x/net/context"
	"google.golang.org/api/iterator"
	"google.golang.org/api/option"
	"google.golang.org/api/transport"
	adminpb "google.golang.org/genproto/googleapis/iam/admin/v1"
	iampb "google.golang.org/genproto/googleapis/iam/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
)

// IamCallOptions contains the retry settings for each method of IamClient.
type IamCallOptions struct {
	ListServiceAccounts     []gax.CallOption
	GetServiceAccount       []gax.CallOption
	CreateServiceAccount    []gax.CallOption
	UpdateServiceAccount    []gax.CallOption
	DeleteServiceAccount    []gax.CallOption
	ListServiceAccountKeys  []gax.CallOption
	GetServiceAccountKey    []gax.CallOption
	CreateServiceAccountKey []gax.CallOption
	DeleteServiceAccountKey []gax.CallOption
	SignBlob                []gax.CallOption
	GetIamPolicy            []gax.CallOption
	SetIamPolicy            []gax.CallOption
	TestIamPermissions      []gax.CallOption
	QueryGrantableRoles     []gax.CallOption
}

func defaultIamClientOptions() []option.ClientOption {
	return []option.ClientOption{
		option.WithEndpoint("iam.googleapis.com:443"),
		option.WithScopes(DefaultAuthScopes()...),
	}
}

func defaultIamCallOptions() *IamCallOptions {
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
	return &IamCallOptions{
		ListServiceAccounts:     retry[[2]string{"default", "idempotent"}],
		GetServiceAccount:       retry[[2]string{"default", "idempotent"}],
		CreateServiceAccount:    retry[[2]string{"default", "non_idempotent"}],
		UpdateServiceAccount:    retry[[2]string{"default", "idempotent"}],
		DeleteServiceAccount:    retry[[2]string{"default", "idempotent"}],
		ListServiceAccountKeys:  retry[[2]string{"default", "idempotent"}],
		GetServiceAccountKey:    retry[[2]string{"default", "idempotent"}],
		CreateServiceAccountKey: retry[[2]string{"default", "non_idempotent"}],
		DeleteServiceAccountKey: retry[[2]string{"default", "idempotent"}],
		SignBlob:                retry[[2]string{"default", "non_idempotent"}],
		GetIamPolicy:            retry[[2]string{"default", "non_idempotent"}],
		SetIamPolicy:            retry[[2]string{"default", "non_idempotent"}],
		TestIamPermissions:      retry[[2]string{"default", "non_idempotent"}],
		QueryGrantableRoles:     retry[[2]string{"default", "non_idempotent"}],
	}
}

// IamClient is a client for interacting with Google Identity and Access Management (IAM) API.
type IamClient struct {
	// The connection to the service.
	conn *grpc.ClientConn

	// The gRPC API client.
	iamClient adminpb.IAMClient

	// The call options for this service.
	CallOptions *IamCallOptions

	// The metadata to be sent with each request.
	xGoogHeader []string
}

// NewIamClient creates a new iam client.
//
// Creates and manages service account objects.
//
// Service account is an account that belongs to your project instead
// of to an individual end user. It is used to authenticate calls
// to a Google API.
//
// To create a service account, specify the project_id and account_id
// for the account.  The account_id is unique within the project, and used
// to generate the service account email address and a stable
// unique_id.
//
// All other methods can identify accounts using the format
// projects/{project}/serviceAccounts/{account}.
// Using - as a wildcard for the project will infer the project from
// the account. The account value can be the email address or the
// unique_id of the service account.
func NewIamClient(ctx context.Context, opts ...option.ClientOption) (*IamClient, error) {
	conn, err := transport.DialGRPC(ctx, append(defaultIamClientOptions(), opts...)...)
	if err != nil {
		return nil, err
	}
	c := &IamClient{
		conn:        conn,
		CallOptions: defaultIamCallOptions(),

		iamClient: adminpb.NewIAMClient(conn),
	}
	c.setGoogleClientInfo()
	return c, nil
}

// Connection returns the client's connection to the API service.
func (c *IamClient) Connection() *grpc.ClientConn {
	return c.conn
}

// Close closes the connection to the API service. The user should invoke this when
// the client is no longer required.
func (c *IamClient) Close() error {
	return c.conn.Close()
}

// setGoogleClientInfo sets the name and version of the application in
// the `x-goog-api-client` header passed on each request. Intended for
// use by Google-written clients.
func (c *IamClient) setGoogleClientInfo(keyval ...string) {
	kv := append([]string{"gl-go", version.Go()}, keyval...)
	kv = append(kv, "gapic", version.Repo, "gax", gax.Version, "grpc", grpc.Version)
	c.xGoogHeader = []string{gax.XGoogHeader(kv...)}
}

// IamProjectPath returns the path for the project resource.
func IamProjectPath(project string) string {
	return "" +
		"projects/" +
		project +
		""
}

// IamServiceAccountPath returns the path for the service account resource.
func IamServiceAccountPath(project, serviceAccount string) string {
	return "" +
		"projects/" +
		project +
		"/serviceAccounts/" +
		serviceAccount +
		""
}

// IamKeyPath returns the path for the key resource.
func IamKeyPath(project, serviceAccount, key string) string {
	return "" +
		"projects/" +
		project +
		"/serviceAccounts/" +
		serviceAccount +
		"/keys/" +
		key +
		""
}

// ListServiceAccounts lists [ServiceAccounts][google.iam.admin.v1.ServiceAccount] for a project.
func (c *IamClient) ListServiceAccounts(ctx context.Context, req *adminpb.ListServiceAccountsRequest, opts ...gax.CallOption) *ServiceAccountIterator {
	ctx = insertXGoog(ctx, c.xGoogHeader)
	opts = append(c.CallOptions.ListServiceAccounts[0:len(c.CallOptions.ListServiceAccounts):len(c.CallOptions.ListServiceAccounts)], opts...)
	it := &ServiceAccountIterator{}
	it.InternalFetch = func(pageSize int, pageToken string) ([]*adminpb.ServiceAccount, string, error) {
		var resp *adminpb.ListServiceAccountsResponse
		req.PageToken = pageToken
		if pageSize > math.MaxInt32 {
			req.PageSize = math.MaxInt32
		} else {
			req.PageSize = int32(pageSize)
		}
		err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
			var err error
			resp, err = c.iamClient.ListServiceAccounts(ctx, req, settings.GRPC...)
			return err
		}, opts...)
		if err != nil {
			return nil, "", err
		}
		return resp.Accounts, resp.NextPageToken, nil
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

// GetServiceAccount gets a [ServiceAccount][google.iam.admin.v1.ServiceAccount].
func (c *IamClient) GetServiceAccount(ctx context.Context, req *adminpb.GetServiceAccountRequest, opts ...gax.CallOption) (*adminpb.ServiceAccount, error) {
	ctx = insertXGoog(ctx, c.xGoogHeader)
	opts = append(c.CallOptions.GetServiceAccount[0:len(c.CallOptions.GetServiceAccount):len(c.CallOptions.GetServiceAccount)], opts...)
	var resp *adminpb.ServiceAccount
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.iamClient.GetServiceAccount(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// CreateServiceAccount creates a [ServiceAccount][google.iam.admin.v1.ServiceAccount]
// and returns it.
func (c *IamClient) CreateServiceAccount(ctx context.Context, req *adminpb.CreateServiceAccountRequest, opts ...gax.CallOption) (*adminpb.ServiceAccount, error) {
	ctx = insertXGoog(ctx, c.xGoogHeader)
	opts = append(c.CallOptions.CreateServiceAccount[0:len(c.CallOptions.CreateServiceAccount):len(c.CallOptions.CreateServiceAccount)], opts...)
	var resp *adminpb.ServiceAccount
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.iamClient.CreateServiceAccount(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// UpdateServiceAccount updates a [ServiceAccount][google.iam.admin.v1.ServiceAccount].
//
// Currently, only the following fields are updatable:
// display_name .
// The etag is mandatory.
func (c *IamClient) UpdateServiceAccount(ctx context.Context, req *adminpb.ServiceAccount, opts ...gax.CallOption) (*adminpb.ServiceAccount, error) {
	ctx = insertXGoog(ctx, c.xGoogHeader)
	opts = append(c.CallOptions.UpdateServiceAccount[0:len(c.CallOptions.UpdateServiceAccount):len(c.CallOptions.UpdateServiceAccount)], opts...)
	var resp *adminpb.ServiceAccount
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.iamClient.UpdateServiceAccount(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// DeleteServiceAccount deletes a [ServiceAccount][google.iam.admin.v1.ServiceAccount].
func (c *IamClient) DeleteServiceAccount(ctx context.Context, req *adminpb.DeleteServiceAccountRequest, opts ...gax.CallOption) error {
	ctx = insertXGoog(ctx, c.xGoogHeader)
	opts = append(c.CallOptions.DeleteServiceAccount[0:len(c.CallOptions.DeleteServiceAccount):len(c.CallOptions.DeleteServiceAccount)], opts...)
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		_, err = c.iamClient.DeleteServiceAccount(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	return err
}

// ListServiceAccountKeys lists [ServiceAccountKeys][google.iam.admin.v1.ServiceAccountKey].
func (c *IamClient) ListServiceAccountKeys(ctx context.Context, req *adminpb.ListServiceAccountKeysRequest, opts ...gax.CallOption) (*adminpb.ListServiceAccountKeysResponse, error) {
	ctx = insertXGoog(ctx, c.xGoogHeader)
	opts = append(c.CallOptions.ListServiceAccountKeys[0:len(c.CallOptions.ListServiceAccountKeys):len(c.CallOptions.ListServiceAccountKeys)], opts...)
	var resp *adminpb.ListServiceAccountKeysResponse
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.iamClient.ListServiceAccountKeys(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// GetServiceAccountKey gets the [ServiceAccountKey][google.iam.admin.v1.ServiceAccountKey]
// by key id.
func (c *IamClient) GetServiceAccountKey(ctx context.Context, req *adminpb.GetServiceAccountKeyRequest, opts ...gax.CallOption) (*adminpb.ServiceAccountKey, error) {
	ctx = insertXGoog(ctx, c.xGoogHeader)
	opts = append(c.CallOptions.GetServiceAccountKey[0:len(c.CallOptions.GetServiceAccountKey):len(c.CallOptions.GetServiceAccountKey)], opts...)
	var resp *adminpb.ServiceAccountKey
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.iamClient.GetServiceAccountKey(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// CreateServiceAccountKey creates a [ServiceAccountKey][google.iam.admin.v1.ServiceAccountKey]
// and returns it.
func (c *IamClient) CreateServiceAccountKey(ctx context.Context, req *adminpb.CreateServiceAccountKeyRequest, opts ...gax.CallOption) (*adminpb.ServiceAccountKey, error) {
	ctx = insertXGoog(ctx, c.xGoogHeader)
	opts = append(c.CallOptions.CreateServiceAccountKey[0:len(c.CallOptions.CreateServiceAccountKey):len(c.CallOptions.CreateServiceAccountKey)], opts...)
	var resp *adminpb.ServiceAccountKey
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.iamClient.CreateServiceAccountKey(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// DeleteServiceAccountKey deletes a [ServiceAccountKey][google.iam.admin.v1.ServiceAccountKey].
func (c *IamClient) DeleteServiceAccountKey(ctx context.Context, req *adminpb.DeleteServiceAccountKeyRequest, opts ...gax.CallOption) error {
	ctx = insertXGoog(ctx, c.xGoogHeader)
	opts = append(c.CallOptions.DeleteServiceAccountKey[0:len(c.CallOptions.DeleteServiceAccountKey):len(c.CallOptions.DeleteServiceAccountKey)], opts...)
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		_, err = c.iamClient.DeleteServiceAccountKey(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	return err
}

// SignBlob signs a blob using a service account's system-managed private key.
func (c *IamClient) SignBlob(ctx context.Context, req *adminpb.SignBlobRequest, opts ...gax.CallOption) (*adminpb.SignBlobResponse, error) {
	ctx = insertXGoog(ctx, c.xGoogHeader)
	opts = append(c.CallOptions.SignBlob[0:len(c.CallOptions.SignBlob):len(c.CallOptions.SignBlob)], opts...)
	var resp *adminpb.SignBlobResponse
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.iamClient.SignBlob(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// getIamPolicy returns the IAM access control policy for a
// [ServiceAccount][google.iam.admin.v1.ServiceAccount].
func (c *IamClient) getIamPolicy(ctx context.Context, req *iampb.GetIamPolicyRequest, opts ...gax.CallOption) (*iampb.Policy, error) {
	ctx = insertXGoog(ctx, c.xGoogHeader)
	opts = append(c.CallOptions.GetIamPolicy[0:len(c.CallOptions.GetIamPolicy):len(c.CallOptions.GetIamPolicy)], opts...)
	var resp *iampb.Policy
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.iamClient.GetIamPolicy(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// setIamPolicy sets the IAM access control policy for a
// [ServiceAccount][google.iam.admin.v1.ServiceAccount].
func (c *IamClient) setIamPolicy(ctx context.Context, req *iampb.SetIamPolicyRequest, opts ...gax.CallOption) (*iampb.Policy, error) {
	ctx = insertXGoog(ctx, c.xGoogHeader)
	opts = append(c.CallOptions.SetIamPolicy[0:len(c.CallOptions.SetIamPolicy):len(c.CallOptions.SetIamPolicy)], opts...)
	var resp *iampb.Policy
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.iamClient.SetIamPolicy(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// TestIamPermissions tests the specified permissions against the IAM access control policy
// for a [ServiceAccount][google.iam.admin.v1.ServiceAccount].
func (c *IamClient) TestIamPermissions(ctx context.Context, req *iampb.TestIamPermissionsRequest, opts ...gax.CallOption) (*iampb.TestIamPermissionsResponse, error) {
	ctx = insertXGoog(ctx, c.xGoogHeader)
	opts = append(c.CallOptions.TestIamPermissions[0:len(c.CallOptions.TestIamPermissions):len(c.CallOptions.TestIamPermissions)], opts...)
	var resp *iampb.TestIamPermissionsResponse
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.iamClient.TestIamPermissions(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// QueryGrantableRoles queries roles that can be granted on a particular resource.
// A role is grantable if it can be used as the role in a binding for a policy
// for that resource.
func (c *IamClient) QueryGrantableRoles(ctx context.Context, req *adminpb.QueryGrantableRolesRequest, opts ...gax.CallOption) (*adminpb.QueryGrantableRolesResponse, error) {
	ctx = insertXGoog(ctx, c.xGoogHeader)
	opts = append(c.CallOptions.QueryGrantableRoles[0:len(c.CallOptions.QueryGrantableRoles):len(c.CallOptions.QueryGrantableRoles)], opts...)
	var resp *adminpb.QueryGrantableRolesResponse
	err := gax.Invoke(ctx, func(ctx context.Context, settings gax.CallSettings) error {
		var err error
		resp, err = c.iamClient.QueryGrantableRoles(ctx, req, settings.GRPC...)
		return err
	}, opts...)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// ServiceAccountIterator manages a stream of *adminpb.ServiceAccount.
type ServiceAccountIterator struct {
	items    []*adminpb.ServiceAccount
	pageInfo *iterator.PageInfo
	nextFunc func() error

	// InternalFetch is for use by the Google Cloud Libraries only.
	// It is not part of the stable interface of this package.
	//
	// InternalFetch returns results from a single call to the underlying RPC.
	// The number of results is no greater than pageSize.
	// If there are no more results, nextPageToken is empty and err is nil.
	InternalFetch func(pageSize int, pageToken string) (results []*adminpb.ServiceAccount, nextPageToken string, err error)
}

// PageInfo supports pagination. See the google.golang.org/api/iterator package for details.
func (it *ServiceAccountIterator) PageInfo() *iterator.PageInfo {
	return it.pageInfo
}

// Next returns the next result. Its second return value is iterator.Done if there are no more
// results. Once Next returns Done, all subsequent calls will return Done.
func (it *ServiceAccountIterator) Next() (*adminpb.ServiceAccount, error) {
	var item *adminpb.ServiceAccount
	if err := it.nextFunc(); err != nil {
		return item, err
	}
	item = it.items[0]
	it.items = it.items[1:]
	return item, nil
}

func (it *ServiceAccountIterator) bufLen() int {
	return len(it.items)
}

func (it *ServiceAccountIterator) takeBuf() interface{} {
	b := it.items
	it.items = nil
	return b
}
