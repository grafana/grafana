//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

package exported

import (
	"github.com/Azure/azure-sdk-for-go/sdk/internal/log"
)

// NOTE: these are publicly exported via type-aliasing in azblob/log.go
const (
	// EventUpload is used when we compute number of blocks to upload and size of each block.
	EventUpload log.Event = "azblob.Upload"

	// EventSubmitBatch is used for logging events related to submit blob batch operation.
	EventSubmitBatch log.Event = "azblob.SubmitBatch"
)
