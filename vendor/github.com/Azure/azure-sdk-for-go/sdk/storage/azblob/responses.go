//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

package azblob

import (
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/blob"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/blockblob"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/container"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/internal/generated"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/service"
)

// CreateContainerResponse contains the response from method container.Client.Create.
type CreateContainerResponse = service.CreateContainerResponse

// DeleteContainerResponse contains the response from method container.Client.Delete
type DeleteContainerResponse = service.DeleteContainerResponse

// DeleteBlobResponse contains the response from method blob.Client.Delete.
type DeleteBlobResponse = blob.DeleteResponse

// UploadResponse contains the response from method blockblob.Client.CommitBlockList.
type UploadResponse = blockblob.CommitBlockListResponse

// DownloadStreamResponse wraps AutoRest generated BlobDownloadResponse and helps to provide info for retry.
type DownloadStreamResponse = blob.DownloadStreamResponse

// ListBlobsFlatResponse contains the response from method container.Client.ListBlobFlatSegment.
type ListBlobsFlatResponse = container.ListBlobsFlatResponse

// ListContainersResponse contains the response from method service.Client.ListContainersSegment.
type ListContainersResponse = service.ListContainersResponse

// UploadBufferResponse contains the response from method Client.UploadBuffer/Client.UploadFile.
type UploadBufferResponse = blockblob.UploadBufferResponse

// UploadFileResponse contains the response from method Client.UploadBuffer/Client.UploadFile.
type UploadFileResponse = blockblob.UploadFileResponse

// UploadStreamResponse contains the response from method Client.CommitBlockList.
type UploadStreamResponse = blockblob.CommitBlockListResponse

// ListContainersSegmentResponse - An enumeration of containers
type ListContainersSegmentResponse = generated.ListContainersSegmentResponse

// ListBlobsFlatSegmentResponse - An enumeration of blobs
type ListBlobsFlatSegmentResponse = generated.ListBlobsFlatSegmentResponse
