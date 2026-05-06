//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

package service

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/policy"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/runtime"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/streaming"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/blob"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/bloberror"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/container"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/internal/base"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/internal/exported"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/internal/generated"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/internal/shared"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/sas"
)

// ClientOptions contains the optional parameters when creating a Client.
type ClientOptions base.ClientOptions

// Client represents a URL to the Azure Blob Storage service allowing you to manipulate blob containers.
type Client base.Client[generated.ServiceClient]

// NewClient creates an instance of Client with the specified values.
//   - serviceURL - the URL of the storage account e.g. https://<account>.blob.core.windows.net/
//   - cred - an Azure AD credential, typically obtained via the azidentity module
//   - options - client options; pass nil to accept the default values
func NewClient(serviceURL string, cred azcore.TokenCredential, options *ClientOptions) (*Client, error) {
	audience := base.GetAudience((*base.ClientOptions)(options))
	conOptions := shared.GetClientOptions(options)
	authPolicy := shared.NewStorageChallengePolicy(cred, audience, conOptions.InsecureAllowCredentialWithHTTP)
	plOpts := runtime.PipelineOptions{PerRetry: []policy.Policy{authPolicy}}

	azClient, err := azcore.NewClient(exported.ModuleName, exported.ModuleVersion, plOpts, &conOptions.ClientOptions)
	if err != nil {
		return nil, err
	}
	return (*Client)(base.NewServiceClient(serviceURL, azClient, &cred, (*base.ClientOptions)(conOptions))), nil
}

// NewClientWithNoCredential creates an instance of Client with the specified values.
// This is used to anonymously access a storage account or with a shared access signature (SAS) token.
//   - serviceURL - the URL of the storage account e.g. https://<account>.blob.core.windows.net/?<sas token>
//   - options - client options; pass nil to accept the default values
func NewClientWithNoCredential(serviceURL string, options *ClientOptions) (*Client, error) {
	conOptions := shared.GetClientOptions(options)

	azClient, err := azcore.NewClient(exported.ModuleName, exported.ModuleVersion, runtime.PipelineOptions{}, &conOptions.ClientOptions)
	if err != nil {
		return nil, err
	}
	return (*Client)(base.NewServiceClient(serviceURL, azClient, nil, (*base.ClientOptions)(conOptions))), nil
}

// NewClientWithSharedKeyCredential creates an instance of Client with the specified values.
//   - serviceURL - the URL of the storage account e.g. https://<account>.blob.core.windows.net/
//   - cred - a SharedKeyCredential created with the matching storage account and access key
//   - options - client options; pass nil to accept the default values
func NewClientWithSharedKeyCredential(serviceURL string, cred *SharedKeyCredential, options *ClientOptions) (*Client, error) {
	authPolicy := exported.NewSharedKeyCredPolicy(cred)
	conOptions := shared.GetClientOptions(options)
	plOpts := runtime.PipelineOptions{PerRetry: []policy.Policy{authPolicy}}

	azClient, err := azcore.NewClient(exported.ModuleName, exported.ModuleVersion, plOpts, &conOptions.ClientOptions)
	if err != nil {
		return nil, err
	}

	return (*Client)(base.NewServiceClient(serviceURL, azClient, cred, (*base.ClientOptions)(conOptions))), nil
}

// NewClientFromConnectionString creates an instance of Client with the specified values.
//   - connectionString - a connection string for the desired storage account
//   - options - client options; pass nil to accept the default values
func NewClientFromConnectionString(connectionString string, options *ClientOptions) (*Client, error) {
	parsed, err := shared.ParseConnectionString(connectionString)
	if err != nil {
		return nil, err
	}

	if parsed.AccountKey != "" && parsed.AccountName != "" {
		credential, err := exported.NewSharedKeyCredential(parsed.AccountName, parsed.AccountKey)
		if err != nil {
			return nil, err
		}
		return NewClientWithSharedKeyCredential(parsed.ServiceURL, credential, options)
	}

	return NewClientWithNoCredential(parsed.ServiceURL, options)
}

// GetUserDelegationCredential obtains a UserDelegationKey object using the base ServiceURL object.
// OAuth is required for this call, as well as any role that can delegate access to the storage account.
func (s *Client) GetUserDelegationCredential(ctx context.Context, info KeyInfo, o *GetUserDelegationCredentialOptions) (*UserDelegationCredential, error) {
	url, err := blob.ParseURL(s.URL())
	if err != nil {
		return nil, err
	}

	getUserDelegationKeyOptions := o.format()
	udk, err := s.generated().GetUserDelegationKey(ctx, info, getUserDelegationKeyOptions)
	if err != nil {
		return nil, err
	}

	return exported.NewUserDelegationCredential(strings.Split(url.Host, ".")[0], udk.UserDelegationKey), nil
}

func (s *Client) generated() *generated.ServiceClient {
	return base.InnerClient((*base.Client[generated.ServiceClient])(s))
}

func (s *Client) sharedKey() *SharedKeyCredential {
	return base.SharedKey((*base.Client[generated.ServiceClient])(s))
}

func (s *Client) credential() any {
	return base.Credential((*base.Client[generated.ServiceClient])(s))
}

// helper method to return the generated.BlobClient which is used for creating the sub-requests
func getGeneratedBlobClient(b *blob.Client) *generated.BlobClient {
	return base.InnerClient((*base.Client[generated.BlobClient])(b))
}

func (s *Client) getClientOptions() *base.ClientOptions {
	return base.GetClientOptions((*base.Client[generated.ServiceClient])(s))
}

// URL returns the URL endpoint used by the Client object.
func (s *Client) URL() string {
	return s.generated().Endpoint()
}

// NewContainerClient creates a new container.Client object by concatenating containerName to the end of
// this Client's URL. The new container.Client uses the same request policy pipeline as the Client.
func (s *Client) NewContainerClient(containerName string) *container.Client {
	containerURL := runtime.JoinPaths(s.generated().Endpoint(), containerName)
	return (*container.Client)(base.NewContainerClient(containerURL, s.generated().InternalClient().WithClientName(exported.ModuleName), s.credential(), s.getClientOptions()))
}

// CreateContainer is a lifecycle method to creates a new container under the specified account.
// If the container with the same name already exists, a ResourceExistsError will be raised.
// This method returns a client with which to interact with the newly created container.
func (s *Client) CreateContainer(ctx context.Context, containerName string, options *CreateContainerOptions) (CreateContainerResponse, error) {
	containerClient := s.NewContainerClient(containerName)
	containerCreateResp, err := containerClient.Create(ctx, options)
	return containerCreateResp, err
}

// DeleteContainer is a lifecycle method that marks the specified container for deletion.
// The container and any blobs contained within it are later deleted during garbage collection.
// If the container is not found, a ResourceNotFoundError will be raised.
func (s *Client) DeleteContainer(ctx context.Context, containerName string, options *DeleteContainerOptions) (DeleteContainerResponse, error) {
	containerClient := s.NewContainerClient(containerName)
	containerDeleteResp, err := containerClient.Delete(ctx, options)
	return containerDeleteResp, err
}

// RestoreContainer restores soft-deleted container
// Operation will only be successful if used within the specified number of days set in the delete retention policy
func (s *Client) RestoreContainer(ctx context.Context, deletedContainerName string, deletedContainerVersion string, options *RestoreContainerOptions) (RestoreContainerResponse, error) {
	containerClient := s.NewContainerClient(deletedContainerName)
	containerRestoreResp, err := containerClient.Restore(ctx, deletedContainerVersion, options)
	return containerRestoreResp, err
}

// GetAccountInfo provides account level information
// For more information, see https://learn.microsoft.com/en-us/rest/api/storageservices/get-account-information?tabs=shared-access-signatures.
func (s *Client) GetAccountInfo(ctx context.Context, o *GetAccountInfoOptions) (GetAccountInfoResponse, error) {
	getAccountInfoOptions := o.format()
	resp, err := s.generated().GetAccountInfo(ctx, getAccountInfoOptions)
	return resp, err
}

// NewListContainersPager operation returns a pager of the containers under the specified account.
// Use an empty Marker to start enumeration from the beginning. Container names are returned in lexicographic order.
// For more information, see https://docs.microsoft.com/rest/api/storageservices/list-containers2.
func (s *Client) NewListContainersPager(o *ListContainersOptions) *runtime.Pager[ListContainersResponse] {
	listOptions := generated.ServiceClientListContainersSegmentOptions{}
	if o != nil {
		if o.Include.Deleted {
			listOptions.Include = append(listOptions.Include, generated.ListContainersIncludeTypeDeleted)
		}
		if o.Include.Metadata {
			listOptions.Include = append(listOptions.Include, generated.ListContainersIncludeTypeMetadata)
		}
		if o.Include.System {
			listOptions.Include = append(listOptions.Include, generated.ListContainersIncludeTypeSystem)
		}
		listOptions.Marker = o.Marker
		listOptions.Maxresults = o.MaxResults
		listOptions.Prefix = o.Prefix
	}
	return runtime.NewPager(runtime.PagingHandler[ListContainersResponse]{
		More: func(page ListContainersResponse) bool {
			return page.NextMarker != nil && len(*page.NextMarker) > 0
		},
		Fetcher: func(ctx context.Context, page *ListContainersResponse) (ListContainersResponse, error) {
			var req *policy.Request
			var err error
			if page == nil {
				req, err = s.generated().ListContainersSegmentCreateRequest(ctx, &listOptions)
			} else {
				listOptions.Marker = page.NextMarker
				req, err = s.generated().ListContainersSegmentCreateRequest(ctx, &listOptions)
			}
			if err != nil {
				return ListContainersResponse{}, err
			}
			resp, err := s.generated().InternalClient().Pipeline().Do(req)
			if err != nil {
				return ListContainersResponse{}, err
			}
			if !runtime.HasStatusCode(resp, http.StatusOK) {
				return ListContainersResponse{}, runtime.NewResponseError(resp)
			}
			return s.generated().ListContainersSegmentHandleResponse(resp)
		},
	})
}

// GetProperties - gets the properties of a storage account's Blob service, including properties for Storage Analytics
// and CORS (Cross-Origin Resource Sharing) rules.
func (s *Client) GetProperties(ctx context.Context, o *GetPropertiesOptions) (GetPropertiesResponse, error) {
	getPropertiesOptions := o.format()
	resp, err := s.generated().GetProperties(ctx, getPropertiesOptions)
	return resp, err
}

// SetProperties Sets the properties of a storage account's Blob service, including Azure Storage Analytics.
// If an element (e.g. analytics_logging) is left as None, the existing settings on the service for that functionality are preserved.
func (s *Client) SetProperties(ctx context.Context, o *SetPropertiesOptions) (SetPropertiesResponse, error) {
	properties, setPropertiesOptions := o.format()
	resp, err := s.generated().SetProperties(ctx, properties, setPropertiesOptions)
	return resp, err
}

// GetStatistics Retrieves statistics related to replication for the Blob service.
// It is only available when read-access geo-redundant replication is enabled for  the storage account.
// With geo-redundant replication, Azure Storage maintains your data durable
// in two locations. In both locations, Azure Storage constantly maintains
// multiple healthy replicas of your data. The location where you read,
// create, update, or delete data is the primary storage account location.
// The primary location exists in the region you choose at the time you
// create an account via the Azure Management Azure classic portal, for
// example, North Central US. The location to which your data is replicated
// is the secondary location. The secondary location is automatically
// determined based on the location of the primary; it is in a second data
// center that resides in the same region as the primary location. Read-only
// access is available from the secondary location, if read-access geo-redundant
// replication is enabled for your storage account.
func (s *Client) GetStatistics(ctx context.Context, o *GetStatisticsOptions) (GetStatisticsResponse, error) {
	getStatisticsOptions := o.format()
	resp, err := s.generated().GetStatistics(ctx, getStatisticsOptions)

	return resp, err
}

// GetSASURL is a convenience method for generating a SAS token for the currently pointed at account.
// It can only be used if the credential supplied during creation was a SharedKeyCredential.
func (s *Client) GetSASURL(resources sas.AccountResourceTypes, permissions sas.AccountPermissions, expiry time.Time, o *GetSASURLOptions) (string, error) {
	if s.sharedKey() == nil {
		return "", bloberror.MissingSharedKeyCredential
	}
	st := o.format()
	qps, err := sas.AccountSignatureValues{
		Version:       sas.Version,
		Permissions:   permissions.String(),
		ResourceTypes: resources.String(),
		StartTime:     st,
		ExpiryTime:    expiry.UTC(),
	}.SignWithSharedKey(s.sharedKey())
	if err != nil {
		return "", err
	}

	endpoint := s.URL()
	if !strings.HasSuffix(endpoint, "/") {
		// add a trailing slash to be consistent with the portal
		endpoint += "/"
	}
	endpoint += "?" + qps.Encode()

	return endpoint, nil
}

// FilterBlobs operation finds all blobs in the storage account whose tags match a given search expression.
// Filter blobs searches across all containers within a storage account but can be scoped within the expression to a single container.
// https://docs.microsoft.com/en-us/rest/api/storageservices/find-blobs-by-tags
// eg. "dog='germanshepherd' and penguin='emperorpenguin'"
// To specify a container, eg. "@container=’containerName’ and Name = ‘C’"
func (s *Client) FilterBlobs(ctx context.Context, where string, o *FilterBlobsOptions) (FilterBlobsResponse, error) {
	serviceFilterBlobsOptions := o.format()
	resp, err := s.generated().FilterBlobs(ctx, where, serviceFilterBlobsOptions)
	return resp, err
}

// NewBatchBuilder creates an instance of BatchBuilder using the same auth policy as the client.
// BatchBuilder is used to build the batch consisting of either delete or set tier sub-requests.
// All sub-requests in the batch must be of the same type, either delete or set tier.
// NOTE: Service level Blob Batch operation is supported only when the Client was created using SharedKeyCredential and Account SAS.
func (s *Client) NewBatchBuilder() (*BatchBuilder, error) {
	var authPolicy policy.Policy

	switch cred := s.credential().(type) {
	case *azcore.TokenCredential:
		conOptions := s.getClientOptions()
		authPolicy = shared.NewStorageChallengePolicy(*cred, base.GetAudience(conOptions), conOptions.InsecureAllowCredentialWithHTTP)
	case *SharedKeyCredential:
		authPolicy = exported.NewSharedKeyCredPolicy(cred)
	case nil:
		// for authentication using SAS
		authPolicy = nil
	default:
		return nil, fmt.Errorf("unrecognised authentication type %T", cred)
	}

	return &BatchBuilder{
		endpoint:   s.URL(),
		authPolicy: authPolicy,
	}, nil
}

// SubmitBatch operation allows multiple API calls to be embedded into a single HTTP request.
// It builds the request body using the BatchBuilder object passed.
// BatchBuilder contains the list of operations to be submitted. It supports up to 256 sub-requests in a single batch.
// For more information, see https://docs.microsoft.com/rest/api/storageservices/blob-batch.
func (s *Client) SubmitBatch(ctx context.Context, bb *BatchBuilder, options *SubmitBatchOptions) (SubmitBatchResponse, error) {
	if bb == nil || len(bb.subRequests) == 0 {
		return SubmitBatchResponse{}, errors.New("batch builder is empty")
	}

	// create the request body
	batchReq, batchID, err := exported.CreateBatchRequest(&exported.BlobBatchBuilder{
		AuthPolicy:  bb.authPolicy,
		SubRequests: bb.subRequests,
	})
	if err != nil {
		return SubmitBatchResponse{}, err
	}

	reader := bytes.NewReader(batchReq)
	rsc := streaming.NopCloser(reader)
	multipartContentType := "multipart/mixed; boundary=" + batchID

	resp, err := s.generated().SubmitBatch(ctx, int64(len(batchReq)), multipartContentType, rsc, options.format())
	if err != nil {
		return SubmitBatchResponse{}, err
	}

	batchResponses, err := exported.ParseBlobBatchResponse(resp.Body, resp.ContentType, bb.subRequests)
	if err != nil {
		return SubmitBatchResponse{}, err
	}

	return SubmitBatchResponse{
		Responses:   batchResponses,
		ContentType: resp.ContentType,
		RequestID:   resp.RequestID,
		Version:     resp.Version,
	}, nil
}
