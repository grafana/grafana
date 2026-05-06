//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

package blockblob

import (
	"time"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/internal/generated"
)

// UploadResponse contains the response from method Client.Upload.
type UploadResponse = generated.BlockBlobClientUploadResponse

// UploadBlobFromURLResponse contains the response from the method Client.UploadBlobFromURL
type UploadBlobFromURLResponse = generated.BlockBlobClientPutBlobFromURLResponse

// StageBlockResponse contains the response from method Client.StageBlock.
type StageBlockResponse = generated.BlockBlobClientStageBlockResponse

// CommitBlockListResponse contains the response from method Client.CommitBlockList.
type CommitBlockListResponse = generated.BlockBlobClientCommitBlockListResponse

// StageBlockFromURLResponse contains the response from method Client.StageBlockFromURL.
type StageBlockFromURLResponse = generated.BlockBlobClientStageBlockFromURLResponse

// GetBlockListResponse contains the response from method Client.GetBlockList.
type GetBlockListResponse = generated.BlockBlobClientGetBlockListResponse

// uploadFromReaderResponse contains the response from method Client.UploadBuffer/Client.UploadFile.
type uploadFromReaderResponse struct {
	// ClientRequestID contains the information returned from the x-ms-client-request-id header response.
	ClientRequestID *string

	// ContentMD5 contains the information returned from the Content-MD5 header response.
	ContentMD5 []byte

	// Date contains the information returned from the Date header response.
	Date *time.Time

	// ETag contains the information returned from the ETag header response.
	ETag *azcore.ETag

	// EncryptionKeySHA256 contains the information returned from the x-ms-encryption-key-sha256 header response.
	EncryptionKeySHA256 *string

	// EncryptionScope contains the information returned from the x-ms-encryption-scope header response.
	EncryptionScope *string

	// IsServerEncrypted contains the information returned from the x-ms-request-server-encrypted header response.
	IsServerEncrypted *bool

	// LastModified contains the information returned from the Last-Modified header response.
	LastModified *time.Time

	// RequestID contains the information returned from the x-ms-request-id header response.
	RequestID *string

	// Version contains the information returned from the x-ms-version header response.
	Version *string

	// VersionID contains the information returned from the x-ms-version-id header response.
	VersionID *string

	// ContentCRC64 contains the information returned from the x-ms-content-crc64 header response.
	// Will be a part of response only if uploading data >= internal.MaxUploadBlobBytes (= 256 * 1024 * 1024 // 256MB)
	ContentCRC64 []byte
}

func toUploadReaderAtResponseFromUploadResponse(resp UploadResponse) uploadFromReaderResponse {
	return uploadFromReaderResponse{
		ClientRequestID:     resp.ClientRequestID,
		ContentMD5:          resp.ContentMD5,
		Date:                resp.Date,
		ETag:                resp.ETag,
		EncryptionKeySHA256: resp.EncryptionKeySHA256,
		EncryptionScope:     resp.EncryptionScope,
		IsServerEncrypted:   resp.IsServerEncrypted,
		LastModified:        resp.LastModified,
		RequestID:           resp.RequestID,
		Version:             resp.Version,
		VersionID:           resp.VersionID,
	}
}

func toUploadReaderAtResponseFromCommitBlockListResponse(resp CommitBlockListResponse) uploadFromReaderResponse {
	return uploadFromReaderResponse{
		ClientRequestID:     resp.ClientRequestID,
		ContentMD5:          resp.ContentMD5,
		Date:                resp.Date,
		ETag:                resp.ETag,
		EncryptionKeySHA256: resp.EncryptionKeySHA256,
		EncryptionScope:     resp.EncryptionScope,
		IsServerEncrypted:   resp.IsServerEncrypted,
		LastModified:        resp.LastModified,
		RequestID:           resp.RequestID,
		Version:             resp.Version,
		VersionID:           resp.VersionID,
		ContentCRC64:        resp.ContentCRC64,
	}
}

// UploadFileResponse contains the response from method Client.UploadBuffer/Client.UploadFile.
type UploadFileResponse = uploadFromReaderResponse

// UploadBufferResponse contains the response from method Client.UploadBuffer/Client.UploadFile.
type UploadBufferResponse = uploadFromReaderResponse

// UploadStreamResponse contains the response from method Client.CommitBlockList.
type UploadStreamResponse = CommitBlockListResponse

// SetExpiryResponse contains the response from method Client.SetExpiry.
type SetExpiryResponse = generated.BlobClientSetExpiryResponse
