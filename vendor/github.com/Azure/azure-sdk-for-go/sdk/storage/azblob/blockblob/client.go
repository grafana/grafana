//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

package blockblob

import (
	"bytes"
	"context"
	"encoding/base64"
	"errors"
	"io"
	"math"
	"os"
	"reflect"
	"sync"
	"time"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/policy"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/runtime"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/streaming"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/to"
	"github.com/Azure/azure-sdk-for-go/sdk/internal/log"
	"github.com/Azure/azure-sdk-for-go/sdk/internal/uuid"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/blob"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/bloberror"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/internal/base"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/internal/exported"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/internal/generated"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/internal/shared"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/sas"
)

// ClientOptions contains the optional parameters when creating a Client.
type ClientOptions base.ClientOptions

// Client defines a set of operations applicable to block blobs.
type Client base.CompositeClient[generated.BlobClient, generated.BlockBlobClient]

// NewClient creates an instance of Client with the specified values.
//   - blobURL - the URL of the blob e.g. https://<account>.blob.core.windows.net/container/blob.txt
//   - cred - an Azure AD credential, typically obtained via the azidentity module
//   - options - client options; pass nil to accept the default values
func NewClient(blobURL string, cred azcore.TokenCredential, options *ClientOptions) (*Client, error) {
	audience := base.GetAudience((*base.ClientOptions)(options))
	conOptions := shared.GetClientOptions(options)
	authPolicy := shared.NewStorageChallengePolicy(cred, audience, conOptions.InsecureAllowCredentialWithHTTP)
	plOpts := runtime.PipelineOptions{PerRetry: []policy.Policy{authPolicy}}

	azClient, err := azcore.NewClient(exported.ModuleName, exported.ModuleVersion, plOpts, &conOptions.ClientOptions)
	if err != nil {
		return nil, err
	}
	return (*Client)(base.NewBlockBlobClient(blobURL, azClient, nil)), nil
}

// NewClientWithNoCredential creates an instance of Client with the specified values.
// This is used to anonymously access a blob or with a shared access signature (SAS) token.
//   - blobURL - the URL of the blob e.g. https://<account>.blob.core.windows.net/container/blob.txt?<sas token>
//   - options - client options; pass nil to accept the default values
func NewClientWithNoCredential(blobURL string, options *ClientOptions) (*Client, error) {
	conOptions := shared.GetClientOptions(options)

	azClient, err := azcore.NewClient(exported.ModuleName, exported.ModuleVersion, runtime.PipelineOptions{}, &conOptions.ClientOptions)
	if err != nil {
		return nil, err
	}

	return (*Client)(base.NewBlockBlobClient(blobURL, azClient, nil)), nil
}

// NewClientWithSharedKeyCredential creates an instance of Client with the specified values.
//   - blobURL - the URL of the blob e.g. https://<account>.blob.core.windows.net/container/blob.txt
//   - cred - a SharedKeyCredential created with the matching blob's storage account and access key
//   - options - client options; pass nil to accept the default values
func NewClientWithSharedKeyCredential(blobURL string, cred *blob.SharedKeyCredential, options *ClientOptions) (*Client, error) {
	authPolicy := exported.NewSharedKeyCredPolicy(cred)
	conOptions := shared.GetClientOptions(options)
	plOpts := runtime.PipelineOptions{PerRetry: []policy.Policy{authPolicy}}

	azClient, err := azcore.NewClient(exported.ModuleName, exported.ModuleVersion, plOpts, &conOptions.ClientOptions)
	if err != nil {
		return nil, err
	}

	return (*Client)(base.NewBlockBlobClient(blobURL, azClient, cred)), nil
}

// NewClientFromConnectionString creates an instance of Client with the specified values.
//   - connectionString - a connection string for the desired storage account
//   - containerName - the name of the container within the storage account
//   - blobName - the name of the blob within the container
//   - options - client options; pass nil to accept the default values
func NewClientFromConnectionString(connectionString, containerName, blobName string, options *ClientOptions) (*Client, error) {
	parsed, err := shared.ParseConnectionString(connectionString)
	if err != nil {
		return nil, err
	}
	parsed.ServiceURL = runtime.JoinPaths(parsed.ServiceURL, containerName, blobName)

	if parsed.AccountKey != "" && parsed.AccountName != "" {
		credential, err := exported.NewSharedKeyCredential(parsed.AccountName, parsed.AccountKey)
		if err != nil {
			return nil, err
		}
		return NewClientWithSharedKeyCredential(parsed.ServiceURL, credential, options)
	}

	return NewClientWithNoCredential(parsed.ServiceURL, options)
}

func (bb *Client) sharedKey() *blob.SharedKeyCredential {
	return base.SharedKeyComposite((*base.CompositeClient[generated.BlobClient, generated.BlockBlobClient])(bb))
}

func (bb *Client) generated() *generated.BlockBlobClient {
	_, blockBlob := base.InnerClients((*base.CompositeClient[generated.BlobClient, generated.BlockBlobClient])(bb))
	return blockBlob
}

func (bb *Client) innerBlobGenerated() *generated.BlobClient {
	b := bb.BlobClient()
	return base.InnerClient((*base.Client[generated.BlobClient])(b))
}

// URL returns the URL endpoint used by the Client object.
func (bb *Client) URL() string {
	return bb.generated().Endpoint()
}

// BlobClient returns the embedded blob client for this BlockBlob client.
func (bb *Client) BlobClient() *blob.Client {
	blobClient, _ := base.InnerClients((*base.CompositeClient[generated.BlobClient, generated.BlockBlobClient])(bb))
	return (*blob.Client)(blobClient)
}

// WithSnapshot creates a new Client object identical to the source but with the specified snapshot timestamp.
// Pass "" to remove the snapshot returning a URL to the base blob.
func (bb *Client) WithSnapshot(snapshot string) (*Client, error) {
	p, err := blob.ParseURL(bb.URL())
	if err != nil {
		return nil, err
	}
	p.Snapshot = snapshot

	return (*Client)(base.NewBlockBlobClient(p.String(), bb.generated().Internal(), bb.sharedKey())), nil
}

// WithVersionID creates a new AppendBlobURL object identical to the source but with the specified version id.
// Pass "" to remove the versionID returning a URL to the base blob.
func (bb *Client) WithVersionID(versionID string) (*Client, error) {
	p, err := blob.ParseURL(bb.URL())
	if err != nil {
		return nil, err
	}
	p.VersionID = versionID

	return (*Client)(base.NewBlockBlobClient(p.String(), bb.generated().Internal(), bb.sharedKey())), nil
}

// Upload creates a new block blob or overwrites an existing block blob.
// Updating an existing block blob overwrites any existing metadata on the blob. Partial updates are not
// supported with Upload; the content of the existing blob is overwritten with the new content. To
// perform a partial update of a block blob, use StageBlock and CommitBlockList.
// This method panics if the stream is not at position 0.
// Note that the http client closes the body stream after the request is sent to the service.
// For more information, see https://docs.microsoft.com/rest/api/storageservices/put-blob.
func (bb *Client) Upload(ctx context.Context, body io.ReadSeekCloser, options *UploadOptions) (UploadResponse, error) {
	count, err := shared.ValidateSeekableStreamAt0AndGetCount(body)
	if err != nil {
		return UploadResponse{}, err
	}

	opts, httpHeaders, leaseInfo, cpkV, cpkN, accessConditions := options.format()

	if options != nil && options.TransactionalValidation != nil {
		body, err = options.TransactionalValidation.Apply(body, opts)
		if err != nil {
			return UploadResponse{}, err
		}
	}

	resp, err := bb.generated().Upload(ctx, count, body, opts, httpHeaders, leaseInfo, cpkV, cpkN, accessConditions)
	return resp, err
}

// UploadBlobFromURL - The Put Blob from URL operation creates a new Block Blob where the contents of the blob are read from
// a given URL. Partial updates are not supported with Put Blob from URL; the content of an existing blob is overwritten
// with the content of the new blob. To perform partial updates to a block blob’s contents using a source URL, use the Put
// Block from URL API in conjunction with Put Block List.
// For more information, see https://learn.microsoft.com/rest/api/storageservices/put-blob-from-url
func (bb *Client) UploadBlobFromURL(ctx context.Context, copySource string, options *UploadBlobFromURLOptions) (UploadBlobFromURLResponse, error) {
	opts, httpHeaders, leaseAccessConditions, cpkInfo, cpkSourceInfo, modifiedAccessConditions, sourceModifiedConditions := options.format()

	resp, err := bb.generated().PutBlobFromURL(ctx, int64(0), copySource, opts, httpHeaders, leaseAccessConditions, cpkInfo, cpkSourceInfo, modifiedAccessConditions, sourceModifiedConditions)

	return resp, err
}

// StageBlock uploads the specified block to the block blob's "staging area" to be later committed by a call to CommitBlockList.
// Note that the http client closes the body stream after the request is sent to the service.
// For more information, see https://docs.microsoft.com/rest/api/storageservices/put-block.
func (bb *Client) StageBlock(ctx context.Context, base64BlockID string, body io.ReadSeekCloser, options *StageBlockOptions) (StageBlockResponse, error) {
	count, err := shared.ValidateSeekableStreamAt0AndGetCount(body)
	if err != nil {
		return StageBlockResponse{}, err
	}

	opts, leaseAccessConditions, cpkInfo, cpkScopeInfo := options.format()

	if options != nil && options.TransactionalValidation != nil {
		body, err = options.TransactionalValidation.Apply(body, opts)
		if err != nil {
			return StageBlockResponse{}, nil
		}
	}

	resp, err := bb.generated().StageBlock(ctx, base64BlockID, count, body, opts, leaseAccessConditions, cpkInfo, cpkScopeInfo)
	return resp, err
}

// StageBlockFromURL copies the specified block from a source URL to the block blob's "staging area" to be later committed by a call to CommitBlockList.
// If count is CountToEnd (0), then data is read from specified offset to the end.
// For more information, see https://docs.microsoft.com/en-us/rest/api/storageservices/put-block-from-url.
func (bb *Client) StageBlockFromURL(ctx context.Context, base64BlockID string, sourceURL string, options *StageBlockFromURLOptions) (StageBlockFromURLResponse, error) {

	stageBlockFromURLOptions, cpkInfo, cpkScopeInfo, leaseAccessConditions, sourceModifiedAccessConditions := options.format()

	resp, err := bb.generated().StageBlockFromURL(ctx, base64BlockID, 0, sourceURL, stageBlockFromURLOptions,
		cpkInfo, cpkScopeInfo, leaseAccessConditions, sourceModifiedAccessConditions)

	return resp, err
}

// CommitBlockList writes a blob by specifying the list of block IDs that make up the blob.
// In order to be written as part of a blob, a block must have been successfully written
// to the server in a prior PutBlock operation. You can call PutBlockList to update a blob
// by uploading only those blocks that have changed, then committing the new and existing
// blocks together. Any blocks not specified in the block list and permanently deleted.
// For more information, see https://docs.microsoft.com/rest/api/storageservices/put-block-list.
func (bb *Client) CommitBlockList(ctx context.Context, base64BlockIDs []string, options *CommitBlockListOptions) (CommitBlockListResponse, error) {
	// this is a code smell in the generated code
	blockIds := make([]*string, len(base64BlockIDs))
	for k, v := range base64BlockIDs {
		blockIds[k] = to.Ptr(v)
	}

	blockLookupList := generated.BlockLookupList{Latest: blockIds}

	var commitOptions *generated.BlockBlobClientCommitBlockListOptions
	var headers *generated.BlobHTTPHeaders
	var leaseAccess *blob.LeaseAccessConditions
	var cpkInfo *generated.CPKInfo
	var cpkScope *generated.CPKScopeInfo
	var modifiedAccess *generated.ModifiedAccessConditions

	if options != nil {
		commitOptions = &generated.BlockBlobClientCommitBlockListOptions{
			BlobTagsString:            shared.SerializeBlobTagsToStrPtr(options.Tags),
			Metadata:                  options.Metadata,
			RequestID:                 options.RequestID,
			Tier:                      options.Tier,
			Timeout:                   options.Timeout,
			TransactionalContentCRC64: options.TransactionalContentCRC64,
			TransactionalContentMD5:   options.TransactionalContentMD5,
			LegalHold:                 options.LegalHold,
			ImmutabilityPolicyMode:    options.ImmutabilityPolicyMode,
			ImmutabilityPolicyExpiry:  options.ImmutabilityPolicyExpiryTime,
		}

		// If user attempts to pass in their own checksum, errors out.
		if options.TransactionalContentMD5 != nil || options.TransactionalContentCRC64 != nil {
			return CommitBlockListResponse{}, bloberror.UnsupportedChecksum
		}

		headers = options.HTTPHeaders
		leaseAccess, modifiedAccess = exported.FormatBlobAccessConditions(options.AccessConditions)
		cpkInfo = options.CPKInfo
		cpkScope = options.CPKScopeInfo
	}

	resp, err := bb.generated().CommitBlockList(ctx, blockLookupList, commitOptions, headers, leaseAccess, cpkInfo, cpkScope, modifiedAccess)
	return resp, err
}

// GetBlockList returns the list of blocks that have been uploaded as part of a block blob using the specified block list filter.
// For more information, see https://docs.microsoft.com/rest/api/storageservices/get-block-list.
func (bb *Client) GetBlockList(ctx context.Context, listType BlockListType, options *GetBlockListOptions) (GetBlockListResponse, error) {
	o, lac, mac := options.format()

	resp, err := bb.generated().GetBlockList(ctx, listType, o, lac, mac)

	return resp, err
}

// Redeclared APIs ----- Copy over to Append blob and Page blob as well.

// Delete marks the specified blob or snapshot for deletion. The blob is later deleted during garbage collection.
// Note that deleting a blob also deletes all its snapshots.
// For more information, see https://docs.microsoft.com/rest/api/storageservices/delete-blob.
func (bb *Client) Delete(ctx context.Context, o *blob.DeleteOptions) (blob.DeleteResponse, error) {
	return bb.BlobClient().Delete(ctx, o)
}

// Undelete restores the contents and metadata of a soft-deleted blob and any associated soft-deleted snapshots.
// For more information, see https://docs.microsoft.com/rest/api/storageservices/undelete-blob.
func (bb *Client) Undelete(ctx context.Context, o *blob.UndeleteOptions) (blob.UndeleteResponse, error) {
	return bb.BlobClient().Undelete(ctx, o)
}

// SetImmutabilityPolicy operation enables users to set the immutability policy on a blob.
// https://learn.microsoft.com/en-us/azure/storage/blobs/immutable-storage-overview
func (bb *Client) SetImmutabilityPolicy(ctx context.Context, expiryTime time.Time, options *blob.SetImmutabilityPolicyOptions) (blob.SetImmutabilityPolicyResponse, error) {
	return bb.BlobClient().SetImmutabilityPolicy(ctx, expiryTime, options)
}

// DeleteImmutabilityPolicy operation enables users to delete the immutability policy on a blob.
// https://learn.microsoft.com/en-us/azure/storage/blobs/immutable-storage-overview
func (bb *Client) DeleteImmutabilityPolicy(ctx context.Context, options *blob.DeleteImmutabilityPolicyOptions) (blob.DeleteImmutabilityPolicyResponse, error) {
	return bb.BlobClient().DeleteImmutabilityPolicy(ctx, options)
}

// SetLegalHold operation enables users to set legal hold on a blob.
// https://learn.microsoft.com/en-us/azure/storage/blobs/immutable-storage-overview
func (bb *Client) SetLegalHold(ctx context.Context, legalHold bool, options *blob.SetLegalHoldOptions) (blob.SetLegalHoldResponse, error) {
	return bb.BlobClient().SetLegalHold(ctx, legalHold, options)
}

// SetTier operation sets the tier on a blob. The operation is allowed on a page
// blob in a premium storage account and on a block blob in a blob storage account (locally
// redundant storage only). A premium page blob's tier determines the allowed size, IOPs, and
// bandwidth of the blob. A block blob's tier determines Hot/Cool/Archive storage type. This operation
// does not update the blob's ETag.
// For detailed information about block blob level tiering see https://docs.microsoft.com/en-us/azure/storage/blobs/storage-blob-storage-tiers.
func (bb *Client) SetTier(ctx context.Context, tier blob.AccessTier, o *blob.SetTierOptions) (blob.SetTierResponse, error) {
	return bb.BlobClient().SetTier(ctx, tier, o)
}

// SetExpiry operation sets an expiry time on an existing blob. This operation is only allowed on Hierarchical Namespace enabled accounts.
// For more information, see https://learn.microsoft.com/en-us/rest/api/storageservices/set-blob-expiry
func (bb *Client) SetExpiry(ctx context.Context, expiryType ExpiryType, o *SetExpiryOptions) (SetExpiryResponse, error) {
	if expiryType == nil {
		expiryType = ExpiryTypeNever{}
	}
	et, opts := expiryType.Format(o)
	resp, err := bb.innerBlobGenerated().SetExpiry(ctx, et, opts)
	return resp, err
}

// GetProperties returns the blob's properties.
// For more information, see https://docs.microsoft.com/rest/api/storageservices/get-blob-properties.
func (bb *Client) GetProperties(ctx context.Context, o *blob.GetPropertiesOptions) (blob.GetPropertiesResponse, error) {
	return bb.BlobClient().GetProperties(ctx, o)
}

// GetAccountInfo provides account level information
// For more information, see https://learn.microsoft.com/en-us/rest/api/storageservices/get-account-information?tabs=shared-access-signatures.
func (bb *Client) GetAccountInfo(ctx context.Context, o *blob.GetAccountInfoOptions) (blob.GetAccountInfoResponse, error) {
	return bb.BlobClient().GetAccountInfo(ctx, o)
}

// SetHTTPHeaders changes a blob's HTTP headers.
// For more information, see https://docs.microsoft.com/rest/api/storageservices/set-blob-properties.
func (bb *Client) SetHTTPHeaders(ctx context.Context, httpHeaders blob.HTTPHeaders, o *blob.SetHTTPHeadersOptions) (blob.SetHTTPHeadersResponse, error) {
	return bb.BlobClient().SetHTTPHeaders(ctx, httpHeaders, o)
}

// SetMetadata changes a blob's metadata.
// https://docs.microsoft.com/rest/api/storageservices/set-blob-metadata.
func (bb *Client) SetMetadata(ctx context.Context, metadata map[string]*string, o *blob.SetMetadataOptions) (blob.SetMetadataResponse, error) {
	return bb.BlobClient().SetMetadata(ctx, metadata, o)
}

// CreateSnapshot creates a read-only snapshot of a blob.
// For more information, see https://docs.microsoft.com/rest/api/storageservices/snapshot-blob.
func (bb *Client) CreateSnapshot(ctx context.Context, o *blob.CreateSnapshotOptions) (blob.CreateSnapshotResponse, error) {
	return bb.BlobClient().CreateSnapshot(ctx, o)
}

// StartCopyFromURL copies the data at the source URL to a blob.
// For more information, see https://docs.microsoft.com/rest/api/storageservices/copy-blob.
func (bb *Client) StartCopyFromURL(ctx context.Context, copySource string, o *blob.StartCopyFromURLOptions) (blob.StartCopyFromURLResponse, error) {
	return bb.BlobClient().StartCopyFromURL(ctx, copySource, o)
}

// AbortCopyFromURL stops a pending copy that was previously started and leaves a destination blob with 0 length and metadata.
// For more information, see https://docs.microsoft.com/rest/api/storageservices/abort-copy-blob.
func (bb *Client) AbortCopyFromURL(ctx context.Context, copyID string, o *blob.AbortCopyFromURLOptions) (blob.AbortCopyFromURLResponse, error) {
	return bb.BlobClient().AbortCopyFromURL(ctx, copyID, o)
}

// SetTags operation enables users to set tags on a blob or specific blob version, but not snapshot.
// Each call to this operation replaces all existing tags attached to the blob.
// To remove all tags from the blob, call this operation with no tags set.
// https://docs.microsoft.com/en-us/rest/api/storageservices/set-blob-tags
func (bb *Client) SetTags(ctx context.Context, tags map[string]string, o *blob.SetTagsOptions) (blob.SetTagsResponse, error) {
	return bb.BlobClient().SetTags(ctx, tags, o)
}

// GetTags operation enables users to get tags on a blob or specific blob version, or snapshot.
// https://docs.microsoft.com/en-us/rest/api/storageservices/get-blob-tags
func (bb *Client) GetTags(ctx context.Context, o *blob.GetTagsOptions) (blob.GetTagsResponse, error) {
	return bb.BlobClient().GetTags(ctx, o)
}

// CopyFromURL synchronously copies the data at the source URL to a block blob, with sizes up to 256 MB.
// For more information, see https://docs.microsoft.com/en-us/rest/api/storageservices/copy-blob-from-url.
func (bb *Client) CopyFromURL(ctx context.Context, copySource string, o *blob.CopyFromURLOptions) (blob.CopyFromURLResponse, error) {
	return bb.BlobClient().CopyFromURL(ctx, copySource, o)
}

// GetSASURL is a convenience method for generating a SAS token for the currently pointed at block blob.
// It can only be used if the credential supplied during creation was a SharedKeyCredential.
func (bb *Client) GetSASURL(permissions sas.BlobPermissions, expiry time.Time, o *blob.GetSASURLOptions) (string, error) {
	return bb.BlobClient().GetSASURL(permissions, expiry, o)
}

// Concurrent Upload Functions -----------------------------------------------------------------------------------------

// uploadFromReader uploads a buffer in blocks to a block blob.
func (bb *Client) uploadFromReader(ctx context.Context, reader io.ReaderAt, actualSize int64, o *uploadFromReaderOptions) (uploadFromReaderResponse, error) {
	if o.BlockSize == 0 {
		// If bufferSize > (MaxStageBlockBytes * MaxBlocks), then error
		if actualSize > MaxStageBlockBytes*MaxBlocks {
			return uploadFromReaderResponse{}, errors.New("buffer is too large to upload to a block blob")
		}
		// If bufferSize <= MaxUploadBlobBytes, then Upload should be used with just 1 I/O request
		if actualSize <= MaxUploadBlobBytes {
			o.BlockSize = MaxUploadBlobBytes // Default if unspecified
		} else {
			o.BlockSize = int64(math.Ceil(float64(actualSize) / MaxBlocks)) // ceil(buffer / max blocks) = block size to use all 50,000 blocks
			if o.BlockSize < blob.DefaultDownloadBlockSize {                // If the block size is smaller than 4MB, round up to 4MB
				o.BlockSize = blob.DefaultDownloadBlockSize
			}
			// StageBlock will be called with blockSize blocks and a Concurrency of (BufferSize / BlockSize).
		}
	}

	if actualSize <= MaxUploadBlobBytes {
		// If the size can fit in 1 Upload call, do it this way
		var body io.ReadSeeker = io.NewSectionReader(reader, 0, actualSize)
		if o.Progress != nil {
			body = streaming.NewRequestProgress(shared.NopCloser(body), o.Progress)
		}

		uploadBlockBlobOptions := o.getUploadBlockBlobOptions()
		resp, err := bb.Upload(ctx, shared.NopCloser(body), uploadBlockBlobOptions)

		return toUploadReaderAtResponseFromUploadResponse(resp), err
	}

	var numBlocks = uint16(((actualSize - 1) / o.BlockSize) + 1)
	if numBlocks > MaxBlocks {
		// prevent any math bugs from attempting to upload too many blocks which will always fail
		return uploadFromReaderResponse{}, errors.New("block limit exceeded")
	}

	if log.Should(exported.EventUpload) {
		urlparts, err := blob.ParseURL(bb.generated().Endpoint())
		if err == nil {
			log.Writef(exported.EventUpload, "blob name %s actual size %v block-size %v block-count %v",
				urlparts.BlobName, actualSize, o.BlockSize, numBlocks)
		}
	}

	blockIDList := make([]string, numBlocks) // Base-64 encoded block IDs
	progress := int64(0)
	progressLock := &sync.Mutex{}

	err := shared.DoBatchTransfer(ctx, &shared.BatchTransferOptions{
		OperationName: "uploadFromReader",
		TransferSize:  actualSize,
		ChunkSize:     o.BlockSize,
		NumChunks:     uint64(((actualSize - 1) / o.BlockSize) + 1),
		Concurrency:   o.Concurrency,
		Operation: func(ctx context.Context, offset int64, chunkSize int64) error {
			// This function is called once per block.
			// It is passed this block's offset within the buffer and its count of bytes
			// Prepare to read the proper block/section of the buffer
			if chunkSize < o.BlockSize {
				// this is the last block.  its actual size might be less
				// than the calculated size due to rounding up of the payload
				// size to fit in a whole number of blocks.
				chunkSize = (actualSize - offset)
			}
			var body io.ReadSeeker = io.NewSectionReader(reader, offset, chunkSize)
			blockNum := offset / o.BlockSize
			if o.Progress != nil {
				blockProgress := int64(0)
				body = streaming.NewRequestProgress(shared.NopCloser(body),
					func(bytesTransferred int64) {
						diff := bytesTransferred - blockProgress
						blockProgress = bytesTransferred
						progressLock.Lock() // 1 goroutine at a time gets progress report
						progress += diff
						o.Progress(progress)
						progressLock.Unlock()
					})
			}

			// Block IDs are unique values to avoid issue if 2+ clients are uploading blocks
			// at the same time causing PutBlockList to get a mix of blocks from all the clients.
			generatedUuid, err := uuid.New()
			if err != nil {
				return err
			}
			blockIDList[blockNum] = base64.StdEncoding.EncodeToString([]byte(generatedUuid.String()))
			stageBlockOptions := o.getStageBlockOptions()
			_, err = bb.StageBlock(ctx, blockIDList[blockNum], shared.NopCloser(body), stageBlockOptions)
			return err
		},
	})
	if err != nil {
		return uploadFromReaderResponse{}, err
	}
	// All put blocks were successful, call Put Block List to finalize the blob
	commitBlockListOptions := o.getCommitBlockListOptions()
	resp, err := bb.CommitBlockList(ctx, blockIDList, commitBlockListOptions)

	return toUploadReaderAtResponseFromCommitBlockListResponse(resp), err
}

// UploadBuffer uploads a buffer in blocks to a block blob.
func (bb *Client) UploadBuffer(ctx context.Context, buffer []byte, o *UploadBufferOptions) (UploadBufferResponse, error) {
	uploadOptions := uploadFromReaderOptions{}
	if o != nil {
		uploadOptions = *o
	}

	// If user attempts to pass in their own checksum, errors out.
	if uploadOptions.TransactionalValidation != nil && reflect.TypeOf(uploadOptions.TransactionalValidation).Kind() != reflect.Func {
		return UploadBufferResponse{}, bloberror.UnsupportedChecksum
	}

	return bb.uploadFromReader(ctx, bytes.NewReader(buffer), int64(len(buffer)), &uploadOptions)
}

// UploadFile uploads a file in blocks to a block blob.
func (bb *Client) UploadFile(ctx context.Context, file *os.File, o *UploadFileOptions) (UploadFileResponse, error) {
	stat, err := file.Stat()
	if err != nil {
		return uploadFromReaderResponse{}, err
	}
	uploadOptions := uploadFromReaderOptions{}
	if o != nil {
		uploadOptions = *o
	}

	// If user attempts to pass in their own checksum, errors out.
	if uploadOptions.TransactionalValidation != nil && reflect.TypeOf(uploadOptions.TransactionalValidation).Kind() != reflect.Func {
		return UploadFileResponse{}, bloberror.UnsupportedChecksum
	}

	return bb.uploadFromReader(ctx, file, stat.Size(), &uploadOptions)
}

// UploadStream copies the file held in io.Reader to the Blob at blockBlobClient.
// A Context deadline or cancellation will cause this to error.
func (bb *Client) UploadStream(ctx context.Context, body io.Reader, o *UploadStreamOptions) (UploadStreamResponse, error) {
	if o == nil {
		o = &UploadStreamOptions{}
	}

	// If user attempts to pass in their own checksum, errors out.
	if o.TransactionalValidation != nil && reflect.TypeOf(o.TransactionalValidation).Kind() != reflect.Func {
		return UploadStreamResponse{}, bloberror.UnsupportedChecksum
	}

	result, err := copyFromReader(ctx, body, bb, *o, shared.NewMMBPool)
	if err != nil {
		return CommitBlockListResponse{}, err
	}

	return result, nil
}

// Concurrent Download Functions -----------------------------------------------------------------------------------------

// DownloadStream reads a range of bytes from a blob. The response also includes the blob's properties and metadata.
// For more information, see https://docs.microsoft.com/rest/api/storageservices/get-blob.
func (bb *Client) DownloadStream(ctx context.Context, o *blob.DownloadStreamOptions) (blob.DownloadStreamResponse, error) {
	return bb.BlobClient().DownloadStream(ctx, o)
}

// DownloadBuffer downloads an Azure blob to a buffer with parallel.
func (bb *Client) DownloadBuffer(ctx context.Context, buffer []byte, o *blob.DownloadBufferOptions) (int64, error) {
	return bb.BlobClient().DownloadBuffer(ctx, shared.NewBytesWriter(buffer), o)
}

// DownloadFile downloads an Azure blob to a local file.
// The file would be truncated if the size doesn't match.
func (bb *Client) DownloadFile(ctx context.Context, file *os.File, o *blob.DownloadFileOptions) (int64, error) {
	return bb.BlobClient().DownloadFile(ctx, file, o)
}
