//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

package blockblob

import "github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/internal/generated"

const (
	// CountToEnd specifies the end of the file.
	CountToEnd = 0

	_1MiB = 1024 * 1024

	// MaxUploadBlobBytes indicates the maximum number of bytes that can be sent in a call to Upload.
	MaxUploadBlobBytes = 256 * 1024 * 1024 // 256MB

	// MaxStageBlockBytes indicates the maximum number of bytes that can be sent in a call to StageBlock.
	MaxStageBlockBytes = 4000 * 1024 * 1024 // 4GB

	// MaxBlocks indicates the maximum number of blocks allowed in a block blob.
	MaxBlocks = 50000
)

// BlockListType defines values for BlockListType
type BlockListType = generated.BlockListType

const (
	BlockListTypeCommitted   BlockListType = generated.BlockListTypeCommitted
	BlockListTypeUncommitted BlockListType = generated.BlockListTypeUncommitted
	BlockListTypeAll         BlockListType = generated.BlockListTypeAll
)

// PossibleBlockListTypeValues returns the possible values for the BlockListType const type.
func PossibleBlockListTypeValues() []BlockListType {
	return generated.PossibleBlockListTypeValues()
}

// BlobCopySourceTags - can be 'COPY' or 'REPLACE'
type BlobCopySourceTags = generated.BlobCopySourceTags

const (
	BlobCopySourceTagsCopy    = generated.BlobCopySourceTagsCOPY
	BlobCopySourceTagsReplace = generated.BlobCopySourceTagsREPLACE
)

// PossibleBlobCopySourceTagsValues returns the possible values for the BlobCopySourceTags const type.
func PossibleBlobCopySourceTagsValues() []BlobCopySourceTags {
	return generated.PossibleBlobCopySourceTagsValues()
}
