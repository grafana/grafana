//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

package appendblob

import (
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/internal/generated"
)

// CreateResponse contains the response from method Client.Create.
type CreateResponse = generated.AppendBlobClientCreateResponse

// AppendBlockResponse contains the response from method Client.AppendBlock.
type AppendBlockResponse = generated.AppendBlobClientAppendBlockResponse

// AppendBlockFromURLResponse contains the response from method Client.AppendBlockFromURL.
type AppendBlockFromURLResponse = generated.AppendBlobClientAppendBlockFromURLResponse

// SealResponse contains the response from method Client.Seal.
type SealResponse = generated.AppendBlobClientSealResponse

// SetExpiryResponse contains the response from method Client.SetExpiry.
type SetExpiryResponse = generated.BlobClientSetExpiryResponse
