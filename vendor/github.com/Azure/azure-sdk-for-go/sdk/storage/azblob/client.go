//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

package azblob

import (
	"context"
	"io"
	"os"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/runtime"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/internal/base"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/internal/shared"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/service"
)

// ClientOptions contains the optional parameters when creating a Client.
type ClientOptions base.ClientOptions

// Client represents a URL to an Azure Storage blob; the blob may be a block blob, append blob, or page blob.
type Client struct {
	svc *service.Client
}

// NewClient creates an instance of Client with the specified values.
//   - serviceURL - the URL of the storage account e.g. https://<account>.blob.core.windows.net/
//   - cred - an Azure AD credential, typically obtained via the azidentity module
//   - options - client options; pass nil to accept the default values
func NewClient(serviceURL string, cred azcore.TokenCredential, options *ClientOptions) (*Client, error) {
	svcClient, err := service.NewClient(serviceURL, cred, (*service.ClientOptions)(options))
	if err != nil {
		return nil, err
	}

	return &Client{
		svc: svcClient,
	}, nil
}

// NewClientWithNoCredential creates an instance of Client with the specified values.
// This is used to anonymously access a storage account or with a shared access signature (SAS) token.
//   - serviceURL - the URL of the storage account e.g. https://<account>.blob.core.windows.net/?<sas token>
//   - options - client options; pass nil to accept the default values
func NewClientWithNoCredential(serviceURL string, options *ClientOptions) (*Client, error) {
	svcClient, err := service.NewClientWithNoCredential(serviceURL, (*service.ClientOptions)(options))
	if err != nil {
		return nil, err
	}

	return &Client{
		svc: svcClient,
	}, nil
}

// NewClientWithSharedKeyCredential creates an instance of Client with the specified values.
//   - serviceURL - the URL of the storage account e.g. https://<account>.blob.core.windows.net/
//   - cred - a SharedKeyCredential created with the matching storage account and access key
//   - options - client options; pass nil to accept the default values
func NewClientWithSharedKeyCredential(serviceURL string, cred *SharedKeyCredential, options *ClientOptions) (*Client, error) {
	svcClient, err := service.NewClientWithSharedKeyCredential(serviceURL, cred, (*service.ClientOptions)(options))
	if err != nil {
		return nil, err
	}

	return &Client{
		svc: svcClient,
	}, nil
}

// NewClientFromConnectionString creates an instance of Client with the specified values.
//   - connectionString - a connection string for the desired storage account
//   - options - client options; pass nil to accept the default values
func NewClientFromConnectionString(connectionString string, options *ClientOptions) (*Client, error) {
	svcClient, err := service.NewClientFromConnectionString(connectionString, (*service.ClientOptions)(options))
	if err != nil {
		return nil, err
	}
	return &Client{
		svc: svcClient,
	}, nil
}

// URL returns the URL endpoint used by the BlobClient object.
func (c *Client) URL() string {
	return c.svc.URL()
}

// ServiceClient returns the embedded service client for this client.
func (c *Client) ServiceClient() *service.Client {
	return c.svc
}

// CreateContainer is a lifecycle method to creates a new container under the specified account.
// If the container with the same name already exists, a ContainerAlreadyExists Error will be raised.
// This method returns a client with which to interact with the newly created container.
func (c *Client) CreateContainer(ctx context.Context, containerName string, o *CreateContainerOptions) (CreateContainerResponse, error) {
	return c.svc.CreateContainer(ctx, containerName, o)
}

// DeleteContainer is a lifecycle method that marks the specified container for deletion.
// The container and any blobs contained within it are later deleted during garbage collection.
// If the container is not found, a ResourceNotFoundError will be raised.
func (c *Client) DeleteContainer(ctx context.Context, containerName string, o *DeleteContainerOptions) (DeleteContainerResponse, error) {
	return c.svc.DeleteContainer(ctx, containerName, o)
}

// DeleteBlob marks the specified blob or snapshot for deletion. The blob is later deleted during garbage collection.
// Note that deleting a blob also deletes all its snapshots.
// For more information, see https://docs.microsoft.com/rest/api/storageservices/delete-blob.
func (c *Client) DeleteBlob(ctx context.Context, containerName string, blobName string, o *DeleteBlobOptions) (DeleteBlobResponse, error) {
	return c.svc.NewContainerClient(containerName).NewBlobClient(blobName).Delete(ctx, o)
}

// NewListBlobsFlatPager returns a pager for blobs starting from the specified Marker. Use an empty
// Marker to start enumeration from the beginning. Blob names are returned in lexicographic order.
// For more information, see https://docs.microsoft.com/rest/api/storageservices/list-blobs.
func (c *Client) NewListBlobsFlatPager(containerName string, o *ListBlobsFlatOptions) *runtime.Pager[ListBlobsFlatResponse] {
	return c.svc.NewContainerClient(containerName).NewListBlobsFlatPager(o)
}

// NewListContainersPager operation returns a pager of the containers under the specified account.
// Use an empty Marker to start enumeration from the beginning. Container names are returned in lexicographic order.
// For more information, see https://docs.microsoft.com/rest/api/storageservices/list-containers2.
func (c *Client) NewListContainersPager(o *ListContainersOptions) *runtime.Pager[ListContainersResponse] {
	return c.svc.NewListContainersPager(o)
}

// UploadBuffer uploads a buffer in blocks to a block blob.
func (c *Client) UploadBuffer(ctx context.Context, containerName string, blobName string, buffer []byte, o *UploadBufferOptions) (UploadBufferResponse, error) {
	return c.svc.NewContainerClient(containerName).NewBlockBlobClient(blobName).UploadBuffer(ctx, buffer, o)
}

// UploadFile uploads a file in blocks to a block blob.
func (c *Client) UploadFile(ctx context.Context, containerName string, blobName string, file *os.File, o *UploadFileOptions) (UploadFileResponse, error) {
	return c.svc.NewContainerClient(containerName).NewBlockBlobClient(blobName).UploadFile(ctx, file, o)
}

// UploadStream copies the file held in io.Reader to the Blob at blockBlobClient.
// A Context deadline or cancellation will cause this to error.
func (c *Client) UploadStream(ctx context.Context, containerName string, blobName string, body io.Reader, o *UploadStreamOptions) (UploadStreamResponse, error) {
	return c.svc.NewContainerClient(containerName).NewBlockBlobClient(blobName).UploadStream(ctx, body, o)
}

// DownloadBuffer downloads an Azure blob to a buffer with parallel.
func (c *Client) DownloadBuffer(ctx context.Context, containerName string, blobName string, buffer []byte, o *DownloadBufferOptions) (int64, error) {
	return c.svc.NewContainerClient(containerName).NewBlobClient(blobName).DownloadBuffer(ctx, shared.NewBytesWriter(buffer), o)
}

// DownloadFile downloads an Azure blob to a local file.
// The file would be truncated if the size doesn't match.
func (c *Client) DownloadFile(ctx context.Context, containerName string, blobName string, file *os.File, o *DownloadFileOptions) (int64, error) {
	return c.svc.NewContainerClient(containerName).NewBlobClient(blobName).DownloadFile(ctx, file, o)
}

// DownloadStream reads a range of bytes from a blob. The response also includes the blob's properties and metadata.
// For more information, see https://docs.microsoft.com/rest/api/storageservices/get-blob.
func (c *Client) DownloadStream(ctx context.Context, containerName string, blobName string, o *DownloadStreamOptions) (DownloadStreamResponse, error) {
	o = shared.CopyOptions(o)
	return c.svc.NewContainerClient(containerName).NewBlobClient(blobName).DownloadStream(ctx, o)
}
