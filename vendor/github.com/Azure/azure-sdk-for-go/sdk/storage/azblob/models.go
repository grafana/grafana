//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

package azblob

import (
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/blob"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/blockblob"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/container"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/internal/exported"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/service"
)

// CreateContainerOptions contains the optional parameters for the ContainerClient.Create method.
type CreateContainerOptions = service.CreateContainerOptions

// DeleteContainerOptions contains the optional parameters for the container.Client.Delete method.
type DeleteContainerOptions = service.DeleteContainerOptions

// DeleteBlobOptions contains the optional parameters for the Client.Delete method.
type DeleteBlobOptions = blob.DeleteOptions

// DownloadStreamOptions contains the optional parameters for the Client.DownloadStream method.
type DownloadStreamOptions = blob.DownloadStreamOptions

// ListBlobsFlatOptions contains the optional parameters for the container.Client.ListBlobFlatSegment method.
type ListBlobsFlatOptions = container.ListBlobsFlatOptions

// ListBlobsInclude indicates what additional information the service should return with each blob.
type ListBlobsInclude = container.ListBlobsInclude

// ListContainersOptions contains the optional parameters for the container.Client.ListContainers operation
type ListContainersOptions = service.ListContainersOptions

// UploadBufferOptions provides set of configurations for UploadBuffer operation
type UploadBufferOptions = blockblob.UploadBufferOptions

// UploadFileOptions provides set of configurations for UploadFile operation
type UploadFileOptions = blockblob.UploadFileOptions

// UploadStreamOptions provides set of configurations for UploadStream operation
type UploadStreamOptions = blockblob.UploadStreamOptions

// DownloadBufferOptions identifies options used by the DownloadBuffer and DownloadFile functions.
type DownloadBufferOptions = blob.DownloadBufferOptions

// DownloadFileOptions identifies options used by the DownloadBuffer and DownloadFile functions.
type DownloadFileOptions = blob.DownloadFileOptions

// CPKInfo contains a group of parameters for client provided encryption key.
type CPKInfo = blob.CPKInfo

// CPKScopeInfo contains a group of parameters for the ContainerClient.Create method.
type CPKScopeInfo = container.CPKScopeInfo

// AccessConditions identifies blob-specific access conditions which you optionally set.
type AccessConditions = exported.BlobAccessConditions

// ListContainersInclude indicates what additional information the service should return with each container.
type ListContainersInclude = service.ListContainersInclude

// ObjectReplicationPolicy are deserialized attributes
type ObjectReplicationPolicy = blob.ObjectReplicationPolicy

// RetryReaderOptions contains properties which can help to decide when to do retry.
type RetryReaderOptions = blob.RetryReaderOptions
