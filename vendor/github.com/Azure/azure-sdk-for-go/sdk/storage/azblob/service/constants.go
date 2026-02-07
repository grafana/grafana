//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

package service

import (
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/internal/generated"
)

const (
	// ContainerNameRoot is the special Azure Storage name used to identify a storage account's root container.
	ContainerNameRoot = "$root"

	// ContainerNameLogs is the special Azure Storage name used to identify a storage account's logs container.
	ContainerNameLogs = "$logs"
)

// SKUName defines values for SkuName - LRS, GRS, RAGRS, ZRS, Premium LRS
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

// ListContainersIncludeType defines values for ListContainersIncludeType
type ListContainersIncludeType = generated.ListContainersIncludeType

const (
	ListContainersIncludeTypeMetadata ListContainersIncludeType = generated.ListContainersIncludeTypeMetadata
	ListContainersIncludeTypeDeleted  ListContainersIncludeType = generated.ListContainersIncludeTypeDeleted
	ListContainersIncludeTypeSystem   ListContainersIncludeType = generated.ListContainersIncludeTypeSystem
)

// PossibleListContainersIncludeTypeValues returns the possible values for the ListContainersIncludeType const type.
func PossibleListContainersIncludeTypeValues() []ListContainersIncludeType {
	return generated.PossibleListContainersIncludeTypeValues()
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

// BlobGeoReplicationStatus - The status of the secondary location
type BlobGeoReplicationStatus = generated.BlobGeoReplicationStatus

const (
	BlobGeoReplicationStatusLive        BlobGeoReplicationStatus = generated.BlobGeoReplicationStatusLive
	BlobGeoReplicationStatusBootstrap   BlobGeoReplicationStatus = generated.BlobGeoReplicationStatusBootstrap
	BlobGeoReplicationStatusUnavailable BlobGeoReplicationStatus = generated.BlobGeoReplicationStatusUnavailable
)

// PossibleBlobGeoReplicationStatusValues returns the possible values for the BlobGeoReplicationStatus const type.
func PossibleBlobGeoReplicationStatusValues() []BlobGeoReplicationStatus {
	return generated.PossibleBlobGeoReplicationStatusValues()
}

// PublicAccessType defines values for AccessType - private (default) or blob or container
type PublicAccessType = generated.PublicAccessType

const (
	PublicAccessTypeBlob      PublicAccessType = generated.PublicAccessTypeBlob
	PublicAccessTypeContainer PublicAccessType = generated.PublicAccessTypeContainer
)

// PossiblePublicAccessTypeValues returns the possible values for the PublicAccessType const type.
func PossiblePublicAccessTypeValues() []PublicAccessType {
	return generated.PossiblePublicAccessTypeValues()
}
