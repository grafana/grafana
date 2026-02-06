//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

package exported

import "github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/internal/generated"

const SnapshotTimeFormat = "2006-01-02T15:04:05.0000000Z07:00"

// ContainerAccessConditions identifies container-specific access conditions which you optionally set.
type ContainerAccessConditions struct {
	ModifiedAccessConditions *ModifiedAccessConditions
	LeaseAccessConditions    *LeaseAccessConditions
}

func FormatContainerAccessConditions(b *ContainerAccessConditions) (*LeaseAccessConditions, *ModifiedAccessConditions) {
	if b == nil {
		return nil, nil
	}
	return b.LeaseAccessConditions, b.ModifiedAccessConditions
}

// BlobAccessConditions identifies blob-specific access conditions which you optionally set.
type BlobAccessConditions struct {
	LeaseAccessConditions    *LeaseAccessConditions
	ModifiedAccessConditions *ModifiedAccessConditions
}

func FormatBlobAccessConditions(b *BlobAccessConditions) (*LeaseAccessConditions, *ModifiedAccessConditions) {
	if b == nil {
		return nil, nil
	}
	return b.LeaseAccessConditions, b.ModifiedAccessConditions
}

// LeaseAccessConditions contains optional parameters to access leased entity.
type LeaseAccessConditions = generated.LeaseAccessConditions

// ModifiedAccessConditions contains a group of parameters for specifying access conditions.
type ModifiedAccessConditions = generated.ModifiedAccessConditions
