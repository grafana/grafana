//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

package pageblob

import "github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/internal/generated"

const (
	// PageBytes indicates the number of bytes in a page (512).
	PageBytes = 512
)

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

// PremiumPageBlobAccessTier defines values for Premium PageBlob's AccessTier.
type PremiumPageBlobAccessTier = generated.PremiumPageBlobAccessTier

const (
	PremiumPageBlobAccessTierP10 PremiumPageBlobAccessTier = generated.PremiumPageBlobAccessTierP10
	PremiumPageBlobAccessTierP15 PremiumPageBlobAccessTier = generated.PremiumPageBlobAccessTierP15
	PremiumPageBlobAccessTierP20 PremiumPageBlobAccessTier = generated.PremiumPageBlobAccessTierP20
	PremiumPageBlobAccessTierP30 PremiumPageBlobAccessTier = generated.PremiumPageBlobAccessTierP30
	PremiumPageBlobAccessTierP4  PremiumPageBlobAccessTier = generated.PremiumPageBlobAccessTierP4
	PremiumPageBlobAccessTierP40 PremiumPageBlobAccessTier = generated.PremiumPageBlobAccessTierP40
	PremiumPageBlobAccessTierP50 PremiumPageBlobAccessTier = generated.PremiumPageBlobAccessTierP50
	PremiumPageBlobAccessTierP6  PremiumPageBlobAccessTier = generated.PremiumPageBlobAccessTierP6
	PremiumPageBlobAccessTierP60 PremiumPageBlobAccessTier = generated.PremiumPageBlobAccessTierP60
	PremiumPageBlobAccessTierP70 PremiumPageBlobAccessTier = generated.PremiumPageBlobAccessTierP70
	PremiumPageBlobAccessTierP80 PremiumPageBlobAccessTier = generated.PremiumPageBlobAccessTierP80
)

// PossiblePremiumPageBlobAccessTierValues returns the possible values for the PremiumPageBlobAccessTier const type.
func PossiblePremiumPageBlobAccessTierValues() []PremiumPageBlobAccessTier {
	return generated.PossiblePremiumPageBlobAccessTierValues()
}

// SequenceNumberActionType defines values for SequenceNumberActionType.
type SequenceNumberActionType = generated.SequenceNumberActionType

const (
	SequenceNumberActionTypeMax       SequenceNumberActionType = generated.SequenceNumberActionTypeMax
	SequenceNumberActionTypeUpdate    SequenceNumberActionType = generated.SequenceNumberActionTypeUpdate
	SequenceNumberActionTypeIncrement SequenceNumberActionType = generated.SequenceNumberActionTypeIncrement
)

// PossibleSequenceNumberActionTypeValues returns the possible values for the SequenceNumberActionType const type.
func PossibleSequenceNumberActionTypeValues() []SequenceNumberActionType {
	return generated.PossibleSequenceNumberActionTypeValues()
}
