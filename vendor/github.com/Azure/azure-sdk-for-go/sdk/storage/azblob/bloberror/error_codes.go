//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

package bloberror

import (
	"errors"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/internal/generated"
)

// HasCode returns true if the provided error is an *azcore.ResponseError
// with its ErrorCode field equal to one of the specified Codes.
func HasCode(err error, codes ...Code) bool {
	var respErr *azcore.ResponseError
	if !errors.As(err, &respErr) {
		return false
	}

	for _, code := range codes {
		if respErr.ErrorCode == string(code) {
			return true
		}
	}

	return false
}

// Code - Error codes returned by the service
type Code = generated.StorageErrorCode

const (
	AccountAlreadyExists                              Code = "AccountAlreadyExists"
	AccountBeingCreated                               Code = "AccountBeingCreated"
	AccountIsDisabled                                 Code = "AccountIsDisabled"
	AppendPositionConditionNotMet                     Code = "AppendPositionConditionNotMet"
	AuthenticationFailed                              Code = "AuthenticationFailed"
	AuthorizationFailure                              Code = "AuthorizationFailure"
	AuthorizationPermissionMismatch                   Code = "AuthorizationPermissionMismatch"
	AuthorizationProtocolMismatch                     Code = "AuthorizationProtocolMismatch"
	AuthorizationResourceTypeMismatch                 Code = "AuthorizationResourceTypeMismatch"
	AuthorizationServiceMismatch                      Code = "AuthorizationServiceMismatch"
	AuthorizationSourceIPMismatch                     Code = "AuthorizationSourceIPMismatch"
	BlobAlreadyExists                                 Code = "BlobAlreadyExists"
	BlobArchived                                      Code = "BlobArchived"
	BlobBeingRehydrated                               Code = "BlobBeingRehydrated"
	BlobImmutableDueToPolicy                          Code = "BlobImmutableDueToPolicy"
	BlobNotArchived                                   Code = "BlobNotArchived"
	BlobNotFound                                      Code = "BlobNotFound"
	BlobOverwritten                                   Code = "BlobOverwritten"
	BlobTierInadequateForContentLength                Code = "BlobTierInadequateForContentLength"
	BlobUsesCustomerSpecifiedEncryption               Code = "BlobUsesCustomerSpecifiedEncryption"
	BlockCountExceedsLimit                            Code = "BlockCountExceedsLimit"
	BlockListTooLong                                  Code = "BlockListTooLong"
	CannotChangeToLowerTier                           Code = "CannotChangeToLowerTier"
	CannotVerifyCopySource                            Code = "CannotVerifyCopySource"
	ConditionHeadersNotSupported                      Code = "ConditionHeadersNotSupported"
	ConditionNotMet                                   Code = "ConditionNotMet"
	ContainerAlreadyExists                            Code = "ContainerAlreadyExists"
	ContainerBeingDeleted                             Code = "ContainerBeingDeleted"
	ContainerDisabled                                 Code = "ContainerDisabled"
	ContainerNotFound                                 Code = "ContainerNotFound"
	ContentLengthLargerThanTierLimit                  Code = "ContentLengthLargerThanTierLimit"
	CopyAcrossAccountsNotSupported                    Code = "CopyAcrossAccountsNotSupported"
	CopyIDMismatch                                    Code = "CopyIdMismatch"
	EmptyMetadataKey                                  Code = "EmptyMetadataKey"
	FeatureVersionMismatch                            Code = "FeatureVersionMismatch"
	ImmutabilityPolicyDeleteOnLockedPolicy            Code = "ImmutabilityPolicyDeleteOnLockedPolicy"
	IncrementalCopyBlobMismatch                       Code = "IncrementalCopyBlobMismatch"
	IncrementalCopyOfEralierVersionSnapshotNotAllowed Code = "IncrementalCopyOfEralierVersionSnapshotNotAllowed"
	IncrementalCopySourceMustBeSnapshot               Code = "IncrementalCopySourceMustBeSnapshot"
	InfiniteLeaseDurationRequired                     Code = "InfiniteLeaseDurationRequired"
	InsufficientAccountPermissions                    Code = "InsufficientAccountPermissions"
	InternalError                                     Code = "InternalError"
	InvalidAuthenticationInfo                         Code = "InvalidAuthenticationInfo"
	InvalidBlobOrBlock                                Code = "InvalidBlobOrBlock"
	InvalidBlobTier                                   Code = "InvalidBlobTier"
	InvalidBlobType                                   Code = "InvalidBlobType"
	InvalidBlockID                                    Code = "InvalidBlockId"
	InvalidBlockList                                  Code = "InvalidBlockList"
	InvalidHTTPVerb                                   Code = "InvalidHttpVerb"
	InvalidHeaderValue                                Code = "InvalidHeaderValue"
	InvalidInput                                      Code = "InvalidInput"
	InvalidMD5                                        Code = "InvalidMd5"
	InvalidMetadata                                   Code = "InvalidMetadata"
	InvalidOperation                                  Code = "InvalidOperation"
	InvalidPageRange                                  Code = "InvalidPageRange"
	InvalidQueryParameterValue                        Code = "InvalidQueryParameterValue"
	InvalidRange                                      Code = "InvalidRange"
	InvalidResourceName                               Code = "InvalidResourceName"
	InvalidSourceBlobType                             Code = "InvalidSourceBlobType"
	InvalidSourceBlobURL                              Code = "InvalidSourceBlobUrl"
	InvalidURI                                        Code = "InvalidUri"
	InvalidVersionForPageBlobOperation                Code = "InvalidVersionForPageBlobOperation"
	InvalidXMLDocument                                Code = "InvalidXmlDocument"
	InvalidXMLNodeValue                               Code = "InvalidXmlNodeValue"
	LeaseAlreadyBroken                                Code = "LeaseAlreadyBroken"
	LeaseAlreadyPresent                               Code = "LeaseAlreadyPresent"
	LeaseIDMismatchWithBlobOperation                  Code = "LeaseIdMismatchWithBlobOperation"
	LeaseIDMismatchWithContainerOperation             Code = "LeaseIdMismatchWithContainerOperation"
	LeaseIDMismatchWithLeaseOperation                 Code = "LeaseIdMismatchWithLeaseOperation"
	LeaseIDMissing                                    Code = "LeaseIdMissing"
	LeaseIsBreakingAndCannotBeAcquired                Code = "LeaseIsBreakingAndCannotBeAcquired"
	LeaseIsBreakingAndCannotBeChanged                 Code = "LeaseIsBreakingAndCannotBeChanged"
	LeaseIsBrokenAndCannotBeRenewed                   Code = "LeaseIsBrokenAndCannotBeRenewed"
	LeaseLost                                         Code = "LeaseLost"
	LeaseNotPresentWithBlobOperation                  Code = "LeaseNotPresentWithBlobOperation"
	LeaseNotPresentWithContainerOperation             Code = "LeaseNotPresentWithContainerOperation"
	LeaseNotPresentWithLeaseOperation                 Code = "LeaseNotPresentWithLeaseOperation"
	MD5Mismatch                                       Code = "Md5Mismatch"
	CRC64Mismatch                                     Code = "Crc64Mismatch"
	MaxBlobSizeConditionNotMet                        Code = "MaxBlobSizeConditionNotMet"
	MetadataTooLarge                                  Code = "MetadataTooLarge"
	MissingContentLengthHeader                        Code = "MissingContentLengthHeader"
	MissingRequiredHeader                             Code = "MissingRequiredHeader"
	MissingRequiredQueryParameter                     Code = "MissingRequiredQueryParameter"
	MissingRequiredXMLNode                            Code = "MissingRequiredXmlNode"
	MultipleConditionHeadersNotSupported              Code = "MultipleConditionHeadersNotSupported"
	NoAuthenticationInformation                       Code = "NoAuthenticationInformation"
	NoPendingCopyOperation                            Code = "NoPendingCopyOperation"
	OperationNotAllowedOnIncrementalCopyBlob          Code = "OperationNotAllowedOnIncrementalCopyBlob"
	OperationNotAllowedOnRootBlob                     Code = "OperationNotAllowedOnRootBlob"
	OperationTimedOut                                 Code = "OperationTimedOut"
	OutOfRangeInput                                   Code = "OutOfRangeInput"
	OutOfRangeQueryParameterValue                     Code = "OutOfRangeQueryParameterValue"
	PendingCopyOperation                              Code = "PendingCopyOperation"
	PreviousSnapshotCannotBeNewer                     Code = "PreviousSnapshotCannotBeNewer"
	PreviousSnapshotNotFound                          Code = "PreviousSnapshotNotFound"
	PreviousSnapshotOperationNotSupported             Code = "PreviousSnapshotOperationNotSupported"
	RequestBodyTooLarge                               Code = "RequestBodyTooLarge"
	RequestURLFailedToParse                           Code = "RequestUrlFailedToParse"
	ResourceAlreadyExists                             Code = "ResourceAlreadyExists"
	ResourceNotFound                                  Code = "ResourceNotFound"
	ResourceTypeMismatch                              Code = "ResourceTypeMismatch"
	SequenceNumberConditionNotMet                     Code = "SequenceNumberConditionNotMet"
	SequenceNumberIncrementTooLarge                   Code = "SequenceNumberIncrementTooLarge"
	ServerBusy                                        Code = "ServerBusy"
	SnapshotCountExceeded                             Code = "SnapshotCountExceeded"
	SnapshotOperationRateExceeded                     Code = "SnapshotOperationRateExceeded"
	SnapshotsPresent                                  Code = "SnapshotsPresent"
	SourceConditionNotMet                             Code = "SourceConditionNotMet"
	SystemInUse                                       Code = "SystemInUse"
	TargetConditionNotMet                             Code = "TargetConditionNotMet"
	UnauthorizedBlobOverwrite                         Code = "UnauthorizedBlobOverwrite"
	UnsupportedHTTPVerb                               Code = "UnsupportedHttpVerb"
	UnsupportedHeader                                 Code = "UnsupportedHeader"
	UnsupportedQueryParameter                         Code = "UnsupportedQueryParameter"
	UnsupportedXMLNode                                Code = "UnsupportedXmlNode"
)

var (
	// MissingSharedKeyCredential - Error is returned when SAS URL is being created without SharedKeyCredential.
	MissingSharedKeyCredential = errors.New("SAS can only be signed with a SharedKeyCredential")
	UnsupportedChecksum        = errors.New("for multi-part uploads, user generated checksums cannot be validated")
)
