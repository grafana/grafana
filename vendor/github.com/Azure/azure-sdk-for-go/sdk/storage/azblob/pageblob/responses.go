//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

package pageblob

import (
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/internal/generated"
)

// CreateResponse contains the response from method Client.Create.
type CreateResponse = generated.PageBlobClientCreateResponse

// UploadPagesResponse contains the response from method Client.UploadPages.
type UploadPagesResponse = generated.PageBlobClientUploadPagesResponse

// UploadPagesFromURLResponse contains the response from method Client.UploadPagesFromURL.
type UploadPagesFromURLResponse = generated.PageBlobClientUploadPagesFromURLResponse

// ClearPagesResponse contains the response from method Client.ClearPages.
type ClearPagesResponse = generated.PageBlobClientClearPagesResponse

// GetPageRangesResponse contains the response from method Client.NewGetPageRangesPager.
type GetPageRangesResponse = generated.PageBlobClientGetPageRangesResponse

// GetPageRangesDiffResponse contains the response from method Client.NewGetPageRangesDiffPager.
type GetPageRangesDiffResponse = generated.PageBlobClientGetPageRangesDiffResponse

// ResizeResponse contains the response from method Client.Resize.
type ResizeResponse = generated.PageBlobClientResizeResponse

// UpdateSequenceNumberResponse contains the response from method Client.UpdateSequenceNumber.
type UpdateSequenceNumberResponse = generated.PageBlobClientUpdateSequenceNumberResponse

// CopyIncrementalResponse contains the response from method Client.StartCopyIncremental.
type CopyIncrementalResponse = generated.PageBlobClientCopyIncrementalResponse
