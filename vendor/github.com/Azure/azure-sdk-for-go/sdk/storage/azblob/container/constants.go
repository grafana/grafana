//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

package container

import "github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/internal/generated"

// AccessTier defines values for blob access tiers.
type AccessTier = generated.AccessTier

const (
	AccessTierArchive AccessTier = generated.AccessTierArchive
	AccessTierCool    AccessTier = generated.AccessTierCool
	AccessTierHot     AccessTier = generated.AccessTierHot
	AccessTierP10     AccessTier = generated.AccessTierP10
	AccessTierP15     AccessTier = generated.AccessTierP15
	AccessTierP20     AccessTier = generated.AccessTierP20
	AccessTierP30     AccessTier = generated.AccessTierP30
	AccessTierP4      AccessTier = generated.AccessTierP4
	AccessTierP40     AccessTier = generated.AccessTierP40
	AccessTierP50     AccessTier = generated.AccessTierP50
	AccessTierP6      AccessTier = generated.AccessTierP6
	AccessTierP60     AccessTier = generated.AccessTierP60
	AccessTierP70     AccessTier = generated.AccessTierP70
	AccessTierP80     AccessTier = generated.AccessTierP80
	AccessTierPremium AccessTier = generated.AccessTierPremium
)

// PossibleAccessTierValues returns the possible values for the AccessTier const type.
func PossibleAccessTierValues() []AccessTier {
	return generated.PossibleAccessTierValues()
}

// PublicAccessType defines values for AccessType - private (default) or blob or container.
type PublicAccessType = generated.PublicAccessType

const (
	PublicAccessTypeBlob      PublicAccessType = generated.PublicAccessTypeBlob
	PublicAccessTypeContainer PublicAccessType = generated.PublicAccessTypeContainer
)

// PossiblePublicAccessTypeValues returns the possible values for the PublicAccessType const type.
func PossiblePublicAccessTypeValues() []PublicAccessType {
	return generated.PossiblePublicAccessTypeValues()
}

// SKUName defines values for SkuName - LRS, GRS, RAGRS, ZRS, Premium LRS.
type SKUName = generated.SKUName

const (
	SKUNameStandardLRS   SKUName = generated.SKUNameStandardLRS
	SKUNameStandardGRS   SKUName = generated.SKUNameStandardGRS
	SKUNameStandardRAGRS SKUName = generated.SKUNameStandardRAGRS
	SKUNameStandardZRS   SKUName = generated.SKUNameStandardZRS
	SKUNamePremiumLRS    SKUName = generated.SKUNamePremiumLRS
)

// PossibleSKUNameValues returns the possible values for the SKUName const type.
func PossibleSKUNameValues() []SKUName {
	return generated.PossibleSKUNameValues()
}

// AccountKind defines values for AccountKind
type AccountKind = generated.AccountKind

const (
	AccountKindStorage          AccountKind = generated.AccountKindStorage
	AccountKindBlobStorage      AccountKind = generated.AccountKindBlobStorage
	AccountKindStorageV2        AccountKind = generated.AccountKindStorageV2
	AccountKindFileStorage      AccountKind = generated.AccountKindFileStorage
	AccountKindBlockBlobStorage AccountKind = generated.AccountKindBlockBlobStorage
)

// PossibleAccountKindValues returns the possible values for the AccountKind const type.
func PossibleAccountKindValues() []AccountKind {
	return generated.PossibleAccountKindValues()
}

// BlobType defines values for BlobType
type BlobType = generated.BlobType

const (
	BlobTypeBlockBlob  BlobType = generated.BlobTypeBlockBlob
	BlobTypePageBlob   BlobType = generated.BlobTypePageBlob
	BlobTypeAppendBlob BlobType = generated.BlobTypeAppendBlob
)

// PossibleBlobTypeValues returns the possible values for the BlobType const type.
func PossibleBlobTypeValues() []BlobType {
	return generated.PossibleBlobTypeValues()
}

// ArchiveStatus defines values for ArchiveStatus
type ArchiveStatus = generated.ArchiveStatus

const (
	ArchiveStatusRehydratePendingToCool ArchiveStatus = generated.ArchiveStatusRehydratePendingToCool
	ArchiveStatusRehydratePendingToHot  ArchiveStatus = generated.ArchiveStatusRehydratePendingToHot
)

// PossibleArchiveStatusValues returns the possible values for the ArchiveStatus const type.
func PossibleArchiveStatusValues() []ArchiveStatus {
	return generated.PossibleArchiveStatusValues()
}

// CopyStatusType defines values for CopyStatusType
type CopyStatusType = generated.CopyStatusType

const (
	CopyStatusTypePending CopyStatusType = generated.CopyStatusTypePending
	CopyStatusTypeSuccess CopyStatusType = generated.CopyStatusTypeSuccess
	CopyStatusTypeAborted CopyStatusType = generated.CopyStatusTypeAborted
	CopyStatusTypeFailed  CopyStatusType = generated.CopyStatusTypeFailed
)

// PossibleCopyStatusTypeValues returns the possible values for the CopyStatusType const type.
func PossibleCopyStatusTypeValues() []CopyStatusType {
	return generated.PossibleCopyStatusTypeValues()
}

// ImmutabilityPolicyMode defines values for ImmutabilityPolicyMode
type ImmutabilityPolicyMode = generated.ImmutabilityPolicyMode

const (
	ImmutabilityPolicyModeMutable  ImmutabilityPolicyMode = generated.ImmutabilityPolicyModeMutable
	ImmutabilityPolicyModeUnlocked ImmutabilityPolicyMode = generated.ImmutabilityPolicyModeUnlocked
	ImmutabilityPolicyModeLocked   ImmutabilityPolicyMode = generated.ImmutabilityPolicyModeLocked
)

// PossibleImmutabilityPolicyModeValues returns the possible values for the ImmutabilityPolicyMode const type.
func PossibleImmutabilityPolicyModeValues() []ImmutabilityPolicyMode {
	return generated.PossibleImmutabilityPolicyModeValues()
}

// RehydratePriority - If an object is in rehydrate pending state then this header is returned with priority of rehydrate.
// Valid values are High and Standard.
type RehydratePriority = generated.RehydratePriority

const (
	RehydratePriorityHigh     RehydratePriority = generated.RehydratePriorityHigh
	RehydratePriorityStandard RehydratePriority = generated.RehydratePriorityStandard
)

// PossibleRehydratePriorityValues returns the possible values for the RehydratePriority const type.
func PossibleRehydratePriorityValues() []RehydratePriority {
	return generated.PossibleRehydratePriorityValues()
}
