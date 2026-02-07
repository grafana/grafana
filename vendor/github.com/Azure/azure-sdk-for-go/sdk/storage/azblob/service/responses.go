//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

package service

import (
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/internal/exported"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/internal/generated"
)

// CreateContainerResponse contains the response from method container.Client.Create.
type CreateContainerResponse = generated.ContainerClientCreateResponse

// DeleteContainerResponse contains the response from method container.Client.Delete
type DeleteContainerResponse = generated.ContainerClientDeleteResponse

// RestoreContainerResponse contains the response from method container.Client.Restore
type RestoreContainerResponse = generated.ContainerClientRestoreResponse

// GetAccountInfoResponse contains the response from method Client.GetAccountInfo.
type GetAccountInfoResponse = generated.ServiceClientGetAccountInfoResponse

// ListContainersResponse contains the response from method Client.ListContainersSegment.
type ListContainersResponse = generated.ServiceClientListContainersSegmentResponse

// ListContainersSegmentResponse - An enumeration of containers
type ListContainersSegmentResponse = generated.ListContainersSegmentResponse

// GetPropertiesResponse contains the response from method Client.GetProperties.
type GetPropertiesResponse = generated.ServiceClientGetPropertiesResponse

// SetPropertiesResponse contains the response from method Client.SetProperties.
type SetPropertiesResponse = generated.ServiceClientSetPropertiesResponse

// GetStatisticsResponse contains the response from method Client.GetStatistics.
type GetStatisticsResponse = generated.ServiceClientGetStatisticsResponse

// FilterBlobsResponse contains the response from method Client.FilterBlobs.
type FilterBlobsResponse = generated.ServiceClientFilterBlobsResponse

// GetUserDelegationKeyResponse contains the response from method ServiceClient.GetUserDelegationKey.
type GetUserDelegationKeyResponse = generated.ServiceClientGetUserDelegationKeyResponse

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
