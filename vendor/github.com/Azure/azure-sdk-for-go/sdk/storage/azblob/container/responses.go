//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

package container

import (
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/internal/exported"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/internal/generated"
)

// CreateResponse contains the response from method Client.Create.
type CreateResponse = generated.ContainerClientCreateResponse

// DeleteResponse contains the response from method Client.Delete.
type DeleteResponse = generated.ContainerClientDeleteResponse

// RestoreResponse contains the response from method Client.Restore.
type RestoreResponse = generated.ContainerClientRestoreResponse

// GetPropertiesResponse contains the response from method Client.GetProperties.
type GetPropertiesResponse = generated.ContainerClientGetPropertiesResponse

// ListBlobsFlatResponse contains the response from method Client.ListBlobFlatSegment.
type ListBlobsFlatResponse = generated.ContainerClientListBlobFlatSegmentResponse

// ListBlobsFlatSegmentResponse - An enumeration of blobs
type ListBlobsFlatSegmentResponse = generated.ListBlobsFlatSegmentResponse

// ListBlobsHierarchyResponse contains the response from method Client.ListBlobHierarchySegment.
type ListBlobsHierarchyResponse = generated.ContainerClientListBlobHierarchySegmentResponse

// ListBlobsHierarchySegmentResponse - An enumeration of blobs
type ListBlobsHierarchySegmentResponse = generated.ListBlobsHierarchySegmentResponse

// SetMetadataResponse contains the response from method Client.SetMetadata.
type SetMetadataResponse = generated.ContainerClientSetMetadataResponse

// GetAccessPolicyResponse contains the response from method Client.GetAccessPolicy.
type GetAccessPolicyResponse = generated.ContainerClientGetAccessPolicyResponse

// SetAccessPolicyResponse contains the response from method Client.SetAccessPolicy.
type SetAccessPolicyResponse = generated.ContainerClientSetAccessPolicyResponse

// GetAccountInfoResponse contains the response from method Client.GetAccountInfo.
type GetAccountInfoResponse = generated.ContainerClientGetAccountInfoResponse

// SubmitBatchResponse contains the response from method Client.SubmitBatch.
type SubmitBatchResponse struct {
	// Responses contains the responses of the sub-requests in the batch
	Responses []*BatchResponseItem

	// ContentType contains the information returned from the Content-Type header response.
	ContentType *string

	// RequestID contains the information returned from the x-ms-request-id header response.
	RequestID *string

	// Version contains the information returned from the x-ms-version header response.
	Version *string
}

// BatchResponseItem contains the response for the individual sub-requests.
type BatchResponseItem = exported.BatchResponseItem

// FilterBlobsResponse contains the response from method Client.FilterBlobs.
type FilterBlobsResponse = generated.ContainerClientFilterBlobsResponse
