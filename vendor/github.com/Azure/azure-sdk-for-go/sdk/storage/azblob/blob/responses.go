//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

package blob

import (
	"context"
	"io"

	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/internal/generated"
)

// DownloadResponse contains the response from method BlobClient.Download.
type DownloadResponse = generated.BlobClientDownloadResponse

// DownloadStreamResponse contains the response from the DownloadStream method.
// To read from the stream, read from the Body field, or call the NewRetryReader method.
type DownloadStreamResponse struct {
	DownloadResponse
	ObjectReplicationRules []ObjectReplicationPolicy

	client   *Client
	getInfo  httpGetterInfo
	cpkInfo  *CPKInfo
	cpkScope *CPKScopeInfo
}

// NewRetryReader constructs new RetryReader stream for reading data. If a connection fails while
// reading, it will make additional requests to reestablish a connection and continue reading.
// Pass nil for options to accept the default options.
// Callers of this method should not access the DownloadStreamResponse.Body field.
func (r *DownloadStreamResponse) NewRetryReader(ctx context.Context, options *RetryReaderOptions) *RetryReader {
	if options == nil {
		options = &RetryReaderOptions{}
	}

	return newRetryReader(ctx, r.Body, r.getInfo, func(ctx context.Context, getInfo httpGetterInfo) (io.ReadCloser, error) {
		accessConditions := &AccessConditions{
			ModifiedAccessConditions: &ModifiedAccessConditions{IfMatch: getInfo.ETag},
		}
		options := DownloadStreamOptions{
			Range:            getInfo.Range,
			AccessConditions: accessConditions,
			CPKInfo:          r.cpkInfo,
			CPKScopeInfo:     r.cpkScope,
		}
		resp, err := r.client.DownloadStream(ctx, &options)
		if err != nil {
			return nil, err
		}
		return resp.Body, err
	}, *options)
}

// DeleteResponse contains the response from method BlobClient.Delete.
type DeleteResponse = generated.BlobClientDeleteResponse

// UndeleteResponse contains the response from method BlobClient.Undelete.
type UndeleteResponse = generated.BlobClientUndeleteResponse

// SetTierResponse contains the response from method BlobClient.SetTier.
type SetTierResponse = generated.BlobClientSetTierResponse

// GetPropertiesResponse contains the response from method BlobClient.GetProperties.
type GetPropertiesResponse = generated.BlobClientGetPropertiesResponse

// SetHTTPHeadersResponse contains the response from method BlobClient.SetHTTPHeaders.
type SetHTTPHeadersResponse = generated.BlobClientSetHTTPHeadersResponse

// SetMetadataResponse contains the response from method BlobClient.SetMetadata.
type SetMetadataResponse = generated.BlobClientSetMetadataResponse

// CreateSnapshotResponse contains the response from method BlobClient.CreateSnapshot.
type CreateSnapshotResponse = generated.BlobClientCreateSnapshotResponse

// StartCopyFromURLResponse contains the response from method BlobClient.StartCopyFromURL.
type StartCopyFromURLResponse = generated.BlobClientStartCopyFromURLResponse

// AbortCopyFromURLResponse contains the response from method BlobClient.AbortCopyFromURL.
type AbortCopyFromURLResponse = generated.BlobClientAbortCopyFromURLResponse

// SetTagsResponse contains the response from method BlobClient.SetTags.
type SetTagsResponse = generated.BlobClientSetTagsResponse

// GetTagsResponse contains the response from method BlobClient.GetTags.
type GetTagsResponse = generated.BlobClientGetTagsResponse

// SetImmutabilityPolicyResponse contains the response from method BlobClient.SetImmutabilityPolicy.
type SetImmutabilityPolicyResponse = generated.BlobClientSetImmutabilityPolicyResponse

// DeleteImmutabilityPolicyResponse contains the response from method BlobClient.DeleteImmutabilityPolicyResponse.
type DeleteImmutabilityPolicyResponse = generated.BlobClientDeleteImmutabilityPolicyResponse

// SetLegalHoldResponse contains the response from method BlobClient.SetLegalHold.
type SetLegalHoldResponse = generated.BlobClientSetLegalHoldResponse

// CopyFromURLResponse contains the response from method BlobClient.CopyFromURL.
type CopyFromURLResponse = generated.BlobClientCopyFromURLResponse

// GetAccountInfoResponse contains the response from method BlobClient.GetAccountInfo.
type GetAccountInfoResponse = generated.BlobClientGetAccountInfoResponse

// AcquireLeaseResponse contains the response from method BlobClient.AcquireLease.
type AcquireLeaseResponse = generated.BlobClientAcquireLeaseResponse

// BreakLeaseResponse contains the response from method BlobClient.BreakLease.
type BreakLeaseResponse = generated.BlobClientBreakLeaseResponse

// ChangeLeaseResponse contains the response from method BlobClient.ChangeLease.
type ChangeLeaseResponse = generated.BlobClientChangeLeaseResponse

// ReleaseLeaseResponse contains the response from method BlobClient.ReleaseLease.
type ReleaseLeaseResponse = generated.BlobClientReleaseLeaseResponse

// RenewLeaseResponse contains the response from method BlobClient.RenewLease.
type RenewLeaseResponse = generated.BlobClientRenewLeaseResponse
