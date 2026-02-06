//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

package appendblob

import (
	"time"

	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/blob"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/internal/exported"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/internal/generated"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/internal/shared"
)

// Type Declarations ---------------------------------------------------------------------

// AppendPositionAccessConditions contains a group of parameters for the Client.AppendBlock method.
type AppendPositionAccessConditions = generated.AppendPositionAccessConditions

// Request Model Declaration -------------------------------------------------------------------------------------------

// CreateOptions provides set of configurations for Create Append Blob operation
type CreateOptions struct {
	// Specifies the date time when the blobs immutability policy is set to expire.
	ImmutabilityPolicyExpiry *time.Time

	// Specifies the immutability policy mode to set on the blob.
	ImmutabilityPolicyMode *blob.ImmutabilityPolicySetting

	// Specified if a legal hold should be set on the blob.
	LegalHold *bool

	AccessConditions *blob.AccessConditions

	HTTPHeaders *blob.HTTPHeaders

	CPKInfo *blob.CPKInfo

	CPKScopeInfo *blob.CPKScopeInfo

	// Optional. Used to set blob tags in various blob operations.
	Tags map[string]string

	// Optional. Specifies a user-defined name-value pair associated with the blob. If no name-value pairs are specified, the
	// operation will copy the metadata from the source blob or file to the destination blob. If one or more name-value pairs
	// are specified, the destination blob is created with the specified metadata, and metadata is not copied from the source
	// blob or file. Note that beginning with version 2009-09-19, metadata names must adhere to the naming rules for C# identifiers.
	// See Naming and Referencing Containers, Blobs, and Metadata for more information.
	Metadata map[string]*string
}

func (o *CreateOptions) format() (*generated.AppendBlobClientCreateOptions, *generated.BlobHTTPHeaders, *generated.LeaseAccessConditions, *generated.CPKInfo, *generated.CPKScopeInfo, *generated.ModifiedAccessConditions) {
	if o == nil {
		return nil, nil, nil, nil, nil, nil
	}

	options := generated.AppendBlobClientCreateOptions{
		BlobTagsString:           shared.SerializeBlobTagsToStrPtr(o.Tags),
		Metadata:                 o.Metadata,
		ImmutabilityPolicyExpiry: o.ImmutabilityPolicyExpiry,
		ImmutabilityPolicyMode:   o.ImmutabilityPolicyMode,
		LegalHold:                o.LegalHold,
	}

	leaseAccessConditions, modifiedAccessConditions := exported.FormatBlobAccessConditions(o.AccessConditions)
	return &options, o.HTTPHeaders, leaseAccessConditions, o.CPKInfo, o.CPKScopeInfo, modifiedAccessConditions
}

// ---------------------------------------------------------------------------------------------------------------------

// AppendBlockOptions contains the optional parameters for the Client.AppendBlock method.
type AppendBlockOptions struct {
	// TransactionalValidation specifies the transfer validation type to use.
	// The default is nil (no transfer validation).
	TransactionalValidation blob.TransferValidationType

	AppendPositionAccessConditions *AppendPositionAccessConditions

	CPKInfo *blob.CPKInfo

	CPKScopeInfo *blob.CPKScopeInfo

	AccessConditions *blob.AccessConditions
}

func (o *AppendBlockOptions) format() (*generated.AppendBlobClientAppendBlockOptions, *generated.AppendPositionAccessConditions,
	*generated.CPKInfo, *generated.CPKScopeInfo, *generated.ModifiedAccessConditions, *generated.LeaseAccessConditions) {
	if o == nil {
		return nil, nil, nil, nil, nil, nil
	}

	leaseAccessConditions, modifiedAccessConditions := exported.FormatBlobAccessConditions(o.AccessConditions)
	return &generated.AppendBlobClientAppendBlockOptions{}, o.AppendPositionAccessConditions, o.CPKInfo, o.CPKScopeInfo, modifiedAccessConditions, leaseAccessConditions
}

// ---------------------------------------------------------------------------------------------------------------------

// AppendBlockFromURLOptions contains the optional parameters for the Client.AppendBlockFromURL method.
type AppendBlockFromURLOptions struct {
	// Only Bearer type is supported. Credentials should be a valid OAuth access token to copy source.
	CopySourceAuthorization *string

	// SourceContentValidation contains the validation mechanism used on the range of bytes read from the source.
	SourceContentValidation blob.SourceContentValidationType

	AppendPositionAccessConditions *AppendPositionAccessConditions

	CPKInfo *blob.CPKInfo

	CPKScopeInfo *blob.CPKScopeInfo

	SourceModifiedAccessConditions *blob.SourceModifiedAccessConditions

	AccessConditions *blob.AccessConditions

	// Range specifies a range of bytes.  The default value is all bytes.
	Range blob.HTTPRange
}

func (o *AppendBlockFromURLOptions) format() (*generated.AppendBlobClientAppendBlockFromURLOptions, *generated.CPKInfo,
	*generated.CPKScopeInfo, *generated.LeaseAccessConditions, *generated.AppendPositionAccessConditions,
	*generated.ModifiedAccessConditions, *generated.SourceModifiedAccessConditions) {
	if o == nil {
		return nil, nil, nil, nil, nil, nil, nil
	}

	options := &generated.AppendBlobClientAppendBlockFromURLOptions{
		SourceRange:             exported.FormatHTTPRange(o.Range),
		CopySourceAuthorization: o.CopySourceAuthorization,
	}

	if o.SourceContentValidation != nil {
		o.SourceContentValidation.Apply(options)
	}

	leaseAccessConditions, modifiedAccessConditions := exported.FormatBlobAccessConditions(o.AccessConditions)
	return options, o.CPKInfo, o.CPKScopeInfo, leaseAccessConditions, o.AppendPositionAccessConditions, modifiedAccessConditions, o.SourceModifiedAccessConditions
}

// ---------------------------------------------------------------------------------------------------------------------

// SealOptions provides set of configurations for SealAppendBlob operation
type SealOptions struct {
	AccessConditions               *blob.AccessConditions
	AppendPositionAccessConditions *AppendPositionAccessConditions
}

func (o *SealOptions) format() (*generated.LeaseAccessConditions,
	*generated.ModifiedAccessConditions, *generated.AppendPositionAccessConditions) {
	if o == nil {
		return nil, nil, nil
	}

	leaseAccessConditions, modifiedAccessConditions := exported.FormatBlobAccessConditions(o.AccessConditions)
	return leaseAccessConditions, modifiedAccessConditions, o.AppendPositionAccessConditions

}

// ---------------------------------------------------------------------------------------------------------------------

// ExpiryType defines values for ExpiryType
type ExpiryType = exported.ExpiryType

// ExpiryTypeAbsolute defines the absolute time for the blob expiry
type ExpiryTypeAbsolute = exported.ExpiryTypeAbsolute

// ExpiryTypeRelativeToNow defines the duration relative to now for the blob expiry
type ExpiryTypeRelativeToNow = exported.ExpiryTypeRelativeToNow

// ExpiryTypeRelativeToCreation defines the duration relative to creation for the blob expiry
type ExpiryTypeRelativeToCreation = exported.ExpiryTypeRelativeToCreation

// ExpiryTypeNever defines that the blob will be set to never expire
type ExpiryTypeNever = exported.ExpiryTypeNever

// SetExpiryOptions contains the optional parameters for the Client.SetExpiry method.
type SetExpiryOptions = exported.SetExpiryOptions
