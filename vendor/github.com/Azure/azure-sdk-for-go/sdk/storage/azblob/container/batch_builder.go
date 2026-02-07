//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

package container

import (
	"context"
	"fmt"
	"net/url"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore/policy"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/runtime"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/blob"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/internal/exported"
)

// BatchBuilder is used for creating the batch operations list. It contains the list of either delete or set tier sub-requests.
// NOTE: All sub-requests in the batch must be of the same type, either delete or set tier.
type BatchBuilder struct {
	endpoint      string
	authPolicy    policy.Policy
	subRequests   []*policy.Request
	operationType *exported.BlobBatchOperationType
}

func (bb *BatchBuilder) checkOperationType(operationType exported.BlobBatchOperationType) error {
	if bb.operationType == nil {
		bb.operationType = &operationType
		return nil
	}
	if *bb.operationType != operationType {
		return fmt.Errorf("BlobBatch only supports one operation type per batch and is already being used for %s operations", *bb.operationType)
	}
	return nil
}

// Delete operation is used to add delete sub-request to the batch builder.
func (bb *BatchBuilder) Delete(blobName string, options *BatchDeleteOptions) error {
	err := bb.checkOperationType(exported.BatchDeleteOperationType)
	if err != nil {
		return err
	}

	blobName = url.PathEscape(blobName)
	blobURL := runtime.JoinPaths(bb.endpoint, blobName)

	blobClient, err := blob.NewClientWithNoCredential(blobURL, nil)
	if err != nil {
		return err
	}

	deleteOptions, leaseInfo, accessConditions := options.format()
	req, err := getGeneratedBlobClient(blobClient).DeleteCreateRequest(context.TODO(), deleteOptions, leaseInfo, accessConditions)
	if err != nil {
		return err
	}

	// remove x-ms-version header
	exported.UpdateSubRequestHeaders(req)

	bb.subRequests = append(bb.subRequests, req)
	return nil
}

// SetTier operation is used to add set tier sub-request to the batch builder.
func (bb *BatchBuilder) SetTier(blobName string, accessTier blob.AccessTier, options *BatchSetTierOptions) error {
	err := bb.checkOperationType(exported.BatchSetTierOperationType)
	if err != nil {
		return err
	}

	blobName = url.PathEscape(blobName)
	blobURL := runtime.JoinPaths(bb.endpoint, blobName)

	blobClient, err := blob.NewClientWithNoCredential(blobURL, nil)
	if err != nil {
		return err
	}

	setTierOptions, leaseInfo, accessConditions := options.format()
	req, err := getGeneratedBlobClient(blobClient).SetTierCreateRequest(context.TODO(), accessTier, setTierOptions, leaseInfo, accessConditions)
	if err != nil {
		return err
	}

	// remove x-ms-version header
	exported.UpdateSubRequestHeaders(req)

	bb.subRequests = append(bb.subRequests, req)
	return nil
}
