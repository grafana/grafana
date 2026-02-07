//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

package pageblob

import (
	"time"

	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/blob"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/internal/shared"

	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/internal/exported"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/internal/generated"
)

// Type Declarations ---------------------------------------------------------------------

// PageList - the list of pages.
type PageList = generated.PageList

// ClearRange defines a range of pages.
type ClearRange = generated.ClearRange

// PageRange defines a range of pages.
type PageRange = generated.PageRange

// SequenceNumberAccessConditions contains a group of parameters for the Client.UploadPages method.
type SequenceNumberAccessConditions = generated.SequenceNumberAccessConditions

// Request Model Declaration -------------------------------------------------------------------------------------------

// CreateOptions contains the optional parameters for the Client.Create method.
type CreateOptions struct {
	// Set for page blobs only. The sequence number is a user-controlled value that you can use to track requests. The value of
	// the sequence number must be between 0 and 2^63 - 1.
	SequenceNumber *int64

	// Optional. Used to set blob tags in various blob operations.
	Tags map[string]string

	// Optional. Specifies a user-defined name-value pair associated with the blob. If no name-value pairs are specified, the
	// operation will copy the metadata from the source blob or file to the destination blob. If one or more name-value pairs
	// are specified, the destination blob is created with the specified metadata, and metadata is not copied from the source
	// blob or file. Note that beginning with version 2009-09-19, metadata names must adhere to the naming rules for C# identifiers.
	// See Naming and Referencing Containers, Blobs, and Metadata for more information.
	Metadata map[string]*string

	// Optional. Indicates the tier to be set on the page blob.
	Tier *PremiumPageBlobAccessTier

	HTTPHeaders *blob.HTTPHeaders

	CPKInfo *blob.CPKInfo

	CPKScopeInfo *blob.CPKScopeInfo

	AccessConditions *blob.AccessConditions
	// Specifies the date time when the blobs immutability policy is set to expire.
	ImmutabilityPolicyExpiry *time.Time
	// Specifies the immutability policy mode to set on the blob.
	ImmutabilityPolicyMode *blob.ImmutabilityPolicyMode
	// Specified if a legal hold should be set on the blob.
	LegalHold *bool
}

func (o *CreateOptions) format() (*generated.PageBlobClientCreateOptions, *generated.BlobHTTPHeaders,
	*generated.LeaseAccessConditions, *generated.CPKInfo, *generated.CPKScopeInfo, *generated.ModifiedAccessConditions) {
	if o == nil {
		return nil, nil, nil, nil, nil, nil
	}

	options := &generated.PageBlobClientCreateOptions{
		BlobSequenceNumber: o.SequenceNumber,
		BlobTagsString:     shared.SerializeBlobTagsToStrPtr(o.Tags),
		Metadata:           o.Metadata,
		Tier:               o.Tier,
	}
	leaseAccessConditions, modifiedAccessConditions := exported.FormatBlobAccessConditions(o.AccessConditions)
	return options, o.HTTPHeaders, leaseAccessConditions, o.CPKInfo, o.CPKScopeInfo, modifiedAccessConditions
}

// ---------------------------------------------------------------------------------------------------------------------

// UploadPagesOptions contains the optional parameters for the Client.UploadPages method.
type UploadPagesOptions struct {
	// TransactionalValidation specifies the transfer validation type to use.
	// The default is nil (no transfer validation).
	TransactionalValidation blob.TransferValidationType

	CPKInfo                        *blob.CPKInfo
	CPKScopeInfo                   *blob.CPKScopeInfo
	SequenceNumberAccessConditions *SequenceNumberAccessConditions
	AccessConditions               *blob.AccessConditions
}

func (o *UploadPagesOptions) format() (*generated.LeaseAccessConditions,
	*generated.CPKInfo, *generated.CPKScopeInfo, *generated.SequenceNumberAccessConditions, *generated.ModifiedAccessConditions) {
	if o == nil {
		return nil, nil, nil, nil, nil
	}

	leaseAccessConditions, modifiedAccessConditions := exported.FormatBlobAccessConditions(o.AccessConditions)
	return leaseAccessConditions, o.CPKInfo, o.CPKScopeInfo, o.SequenceNumberAccessConditions, modifiedAccessConditions
}

// ---------------------------------------------------------------------------------------------------------------------

// UploadPagesFromURLOptions contains the optional parameters for the Client.UploadPagesFromURL method.
type UploadPagesFromURLOptions struct {
	// Only Bearer type is supported. Credentials should be a valid OAuth access token to copy source.
	CopySourceAuthorization *string

	// SourceContentValidation contains the validation mechanism used on the range of bytes read from the source.
	SourceContentValidation blob.SourceContentValidationType

	CPKInfo *blob.CPKInfo

	CPKScopeInfo *blob.CPKScopeInfo

	SequenceNumberAccessConditions *SequenceNumberAccessConditions

	SourceModifiedAccessConditions *blob.SourceModifiedAccessConditions

	AccessConditions *blob.AccessConditions
}

func (o *UploadPagesFromURLOptions) format() (*generated.PageBlobClientUploadPagesFromURLOptions, *generated.CPKInfo, *generated.CPKScopeInfo,
	*generated.LeaseAccessConditions, *generated.SequenceNumberAccessConditions, *generated.ModifiedAccessConditions, *generated.SourceModifiedAccessConditions) {
	if o == nil {
		return nil, nil, nil, nil, nil, nil, nil
	}

	options := &generated.PageBlobClientUploadPagesFromURLOptions{
		CopySourceAuthorization: o.CopySourceAuthorization,
	}

	if o.SourceContentValidation != nil {
		o.SourceContentValidation.Apply(options)
	}

	leaseAccessConditions, modifiedAccessConditions := exported.FormatBlobAccessConditions(o.AccessConditions)
	return options, o.CPKInfo, o.CPKScopeInfo, leaseAccessConditions, o.SequenceNumberAccessConditions, modifiedAccessConditions, o.SourceModifiedAccessConditions
}

// ---------------------------------------------------------------------------------------------------------------------

// ClearPagesOptions contains the optional parameters for the Client.ClearPages operation
type ClearPagesOptions struct {
	CPKInfo                        *blob.CPKInfo
	CPKScopeInfo                   *blob.CPKScopeInfo
	SequenceNumberAccessConditions *SequenceNumberAccessConditions
	AccessConditions               *blob.AccessConditions
}

func (o *ClearPagesOptions) format() (*generated.LeaseAccessConditions, *generated.CPKInfo,
	*generated.CPKScopeInfo, *generated.SequenceNumberAccessConditions, *generated.ModifiedAccessConditions) {
	if o == nil {
		return nil, nil, nil, nil, nil
	}

	leaseAccessConditions, modifiedAccessConditions := exported.FormatBlobAccessConditions(o.AccessConditions)
	return leaseAccessConditions, o.CPKInfo, o.CPKScopeInfo, o.SequenceNumberAccessConditions, modifiedAccessConditions
}

// ---------------------------------------------------------------------------------------------------------------------

// GetPageRangesOptions contains the optional parameters for the Client.NewGetPageRangesPager method.
type GetPageRangesOptions struct {
	Marker *string
	// Specifies the maximum number of containers to return. If the request does not specify MaxResults, or specifies a value
	// greater than 5000, the server will return up to 5000 items. Note that if the
	// listing operation crosses a partition boundary, then the service will return a continuation token for retrieving the remainder
	// of the results. For this reason, it is possible that the service will
	// return fewer results than specified by MaxResults, or than the default of 5000.
	MaxResults *int32
	// Optional. This header is only supported in service versions 2019-04-19 and after and specifies the URL of a previous snapshot
	// of the target blob. The response will only contain pages that were changed
	// between the target blob and its previous snapshot.
	PrevSnapshotURL *string
	// Optional in version 2015-07-08 and newer. The PrevSnapshot parameter is a DateTime value that specifies that the response
	// will contain only pages that were changed between target blob and previous
	// snapshot. Changed pages include both updated and cleared pages. The target blob may be a snapshot, as long as the snapshot
	// specified by PrevSnapshot is the older of the two. Note that incremental
	// snapshots are currently supported only for blobs created on or after January 1, 2016.
	PrevSnapshot *string
	// Range specifies a range of bytes.  The default value is all bytes.
	Range blob.HTTPRange
	// The snapshot parameter is an opaque DateTime value that, when present, specifies the blob snapshot to retrieve. For more
	// information on working with blob snapshots, see Creating a Snapshot of a Blob.
	// [https://docs.microsoft.com/en-us/rest/api/storageservices/fileservices/creating-a-snapshot-of-a-blob]
	Snapshot *string

	AccessConditions *blob.AccessConditions
}

func (o *GetPageRangesOptions) format() (*generated.PageBlobClientGetPageRangesOptions, *generated.LeaseAccessConditions, *generated.ModifiedAccessConditions) {
	if o == nil {
		return &generated.PageBlobClientGetPageRangesOptions{}, nil, nil
	}

	leaseAccessConditions, modifiedAccessConditions := exported.FormatBlobAccessConditions(o.AccessConditions)
	return &generated.PageBlobClientGetPageRangesOptions{
		Marker:     o.Marker,
		Maxresults: o.MaxResults,
		Range:      exported.FormatHTTPRange(o.Range),
		Snapshot:   o.Snapshot,
	}, leaseAccessConditions, modifiedAccessConditions
}

// ---------------------------------------------------------------------------------------------------------------------

// GetPageRangesDiffOptions contains the optional parameters for the Client.NewGetPageRangesDiffPager method.
type GetPageRangesDiffOptions struct {
	// A string value that identifies the portion of the list of containers to be returned with the next listing operation. The
	// operation returns the NextMarker value within the response body if the listing
	// operation did not return all containers remaining to be listed with the current page. The NextMarker value can be used
	// as the value for the marker parameter in a subsequent call to request the next
	// page of list items. The marker value is opaque to the client.
	Marker *string
	// Specifies the maximum number of containers to return. If the request does not specify MaxResults, or specifies a value
	// greater than 5000, the server will return up to 5000 items. Note that if the
	// listing operation crosses a partition boundary, then the service will return a continuation token for retrieving the remainder
	// of the results. For this reason, it is possible that the service will
	// return fewer results than specified by MaxResults, or than the default of 5000.
	MaxResults *int32
	// Optional. This header is only supported in service versions 2019-04-19 and after and specifies the URL of a previous snapshot
	// of the target blob. The response will only contain pages that were changed
	// between the target blob and its previous snapshot.
	PrevSnapshotURL *string
	// Optional in version 2015-07-08 and newer. The PrevSnapshot parameter is a DateTime value that specifies that the response
	// will contain only pages that were changed between target blob and previous
	// snapshot. Changed pages include both updated and cleared pages. The target blob may be a snapshot, as long as the snapshot
	// specified by PrevSnapshot is the older of the two. Note that incremental
	// snapshots are currently supported only for blobs created on or after January 1, 2016.
	PrevSnapshot *string
	// Range specifies a range of bytes.  The default value is all bytes.
	Range blob.HTTPRange

	// The snapshot parameter is an opaque DateTime value that, when present, specifies the blob snapshot to retrieve. For more
	// information on working with blob snapshots, see Creating a Snapshot of a Blob.
	// [https://docs.microsoft.com/en-us/rest/api/storageservices/fileservices/creating-a-snapshot-of-a-blob]
	Snapshot *string

	AccessConditions *blob.AccessConditions
}

func (o *GetPageRangesDiffOptions) format() (*generated.PageBlobClientGetPageRangesDiffOptions, *generated.LeaseAccessConditions, *generated.ModifiedAccessConditions) {
	if o == nil {
		return nil, nil, nil
	}

	leaseAccessConditions, modifiedAccessConditions := exported.FormatBlobAccessConditions(o.AccessConditions)
	return &generated.PageBlobClientGetPageRangesDiffOptions{
		Marker:          o.Marker,
		Maxresults:      o.MaxResults,
		PrevSnapshotURL: o.PrevSnapshotURL,
		Prevsnapshot:    o.PrevSnapshot,
		Range:           exported.FormatHTTPRange(o.Range),
		Snapshot:        o.Snapshot,
	}, leaseAccessConditions, modifiedAccessConditions

}

// ---------------------------------------------------------------------------------------------------------------------

// ResizeOptions contains the optional parameters for the Client.Resize method.
type ResizeOptions struct {
	CPKInfo          *blob.CPKInfo
	CPKScopeInfo     *blob.CPKScopeInfo
	AccessConditions *blob.AccessConditions
}

func (o *ResizeOptions) format() (*generated.PageBlobClientResizeOptions, *generated.LeaseAccessConditions,
	*generated.CPKInfo, *generated.CPKScopeInfo, *generated.ModifiedAccessConditions) {
	if o == nil {
		return nil, nil, nil, nil, nil
	}

	leaseAccessConditions, modifiedAccessConditions := exported.FormatBlobAccessConditions(o.AccessConditions)
	return nil, leaseAccessConditions, o.CPKInfo, o.CPKScopeInfo, modifiedAccessConditions
}

// ---------------------------------------------------------------------------------------------------------------------

// UpdateSequenceNumberOptions contains the optional parameters for the Client.UpdateSequenceNumber method.
type UpdateSequenceNumberOptions struct {
	ActionType *SequenceNumberActionType

	SequenceNumber *int64

	AccessConditions *blob.AccessConditions
}

func (o *UpdateSequenceNumberOptions) format() (*generated.SequenceNumberActionType, *generated.PageBlobClientUpdateSequenceNumberOptions,
	*generated.LeaseAccessConditions, *generated.ModifiedAccessConditions) {
	if o == nil {
		return nil, nil, nil, nil
	}

	options := &generated.PageBlobClientUpdateSequenceNumberOptions{
		BlobSequenceNumber: o.SequenceNumber,
	}

	if *o.ActionType == SequenceNumberActionTypeIncrement {
		options.BlobSequenceNumber = nil
	}

	leaseAccessConditions, modifiedAccessConditions := exported.FormatBlobAccessConditions(o.AccessConditions)
	return o.ActionType, options, leaseAccessConditions, modifiedAccessConditions
}

// ---------------------------------------------------------------------------------------------------------------------

// CopyIncrementalOptions contains the optional parameters for the Client.StartCopyIncremental method.
type CopyIncrementalOptions struct {
	ModifiedAccessConditions *blob.ModifiedAccessConditions
}

func (o *CopyIncrementalOptions) format() (*generated.PageBlobClientCopyIncrementalOptions, *generated.ModifiedAccessConditions) {
	if o == nil {
		return nil, nil
	}

	return nil, o.ModifiedAccessConditions
}

// ---------------------------------------------------------------------------------------------------------------------
