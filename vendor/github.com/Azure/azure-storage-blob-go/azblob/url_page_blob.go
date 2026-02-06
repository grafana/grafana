package azblob

import (
	"context"
	"fmt"
	"io"
	"net/url"
	"strconv"

	"github.com/Azure/azure-pipeline-go/pipeline"
)

const (
	// PageBlobPageBytes indicates the number of bytes in a page (512).
	PageBlobPageBytes = 512

	// PageBlobMaxUploadPagesBytes indicates the maximum number of bytes that can be sent in a call to PutPage.
	PageBlobMaxUploadPagesBytes = 4 * 1024 * 1024 // 4MB
)

// PageBlobURL defines a set of operations applicable to page blobs.
type PageBlobURL struct {
	BlobURL
	pbClient pageBlobClient
}

// NewPageBlobURL creates a PageBlobURL object using the specified URL and request policy pipeline.
func NewPageBlobURL(url url.URL, p pipeline.Pipeline) PageBlobURL {
	blobClient := newBlobClient(url, p)
	pbClient := newPageBlobClient(url, p)
	return PageBlobURL{BlobURL: BlobURL{blobClient: blobClient}, pbClient: pbClient}
}

// WithPipeline creates a new PageBlobURL object identical to the source but with the specific request policy pipeline.
func (pb PageBlobURL) WithPipeline(p pipeline.Pipeline) PageBlobURL {
	return NewPageBlobURL(pb.blobClient.URL(), p)
}

// WithSnapshot creates a new PageBlobURL object identical to the source but with the specified snapshot timestamp.
// Pass "" to remove the snapshot returning a URL to the base blob.
func (pb PageBlobURL) WithSnapshot(snapshot string) PageBlobURL {
	p := NewBlobURLParts(pb.URL())
	p.Snapshot = snapshot
	return NewPageBlobURL(p.URL(), pb.blobClient.Pipeline())
}

// WithVersionID creates a new PageBlobURL object identical to the source but with the specified snapshot timestamp.
// Pass "" to remove the snapshot returning a URL to the base blob.
func (pb PageBlobURL) WithVersionID(versionId string) PageBlobURL {
	p := NewBlobURLParts(pb.URL())
	p.VersionID = versionId
	return NewPageBlobURL(p.URL(), pb.blobClient.Pipeline())
}

func (pb PageBlobURL) GetAccountInfo(ctx context.Context) (*BlobGetAccountInfoResponse, error) {
	return pb.blobClient.GetAccountInfo(ctx)
}

// Create creates a page blob of the specified length. Call PutPage to upload data to a page blob.
// For more information, see https://docs.microsoft.com/rest/api/storageservices/put-blob.
func (pb PageBlobURL) Create(ctx context.Context, size int64, sequenceNumber int64, h BlobHTTPHeaders, metadata Metadata, ac BlobAccessConditions, tier PremiumPageBlobAccessTierType, blobTagsMap BlobTagsMap, cpk ClientProvidedKeyOptions, immutability ImmutabilityPolicyOptions) (*PageBlobCreateResponse, error) {
	ifModifiedSince, ifUnmodifiedSince, ifMatchETag, ifNoneMatchETag := ac.ModifiedAccessConditions.pointers()
	blobTagsString := SerializeBlobTagsHeader(blobTagsMap)
	immutabilityExpiry, immutabilityMode, legalHold := immutability.pointers()
	return pb.pbClient.Create(ctx, 0, size, nil, tier,
		&h.ContentType, &h.ContentEncoding, &h.ContentLanguage, h.ContentMD5, &h.CacheControl,
		metadata, ac.LeaseAccessConditions.pointers(), &h.ContentDisposition,
		cpk.EncryptionKey, cpk.EncryptionKeySha256, cpk.EncryptionAlgorithm, // CPK-V
		cpk.EncryptionScope, // CPK-N
		ifModifiedSince, ifUnmodifiedSince, ifMatchETag, ifNoneMatchETag,
		nil, // Blob tags
		&sequenceNumber, nil,
		blobTagsString, // Blob tags
		// immutability policy
		immutabilityExpiry, immutabilityMode, legalHold,
	)
}

// UploadPages writes 1 or more pages to the page blob. The start offset and the stream size must be a multiple of 512 bytes.
// This method panics if the stream is not at position 0.
// Note that the http client closes the body stream after the request is sent to the service.
// For more information, see https://docs.microsoft.com/rest/api/storageservices/put-page.
func (pb PageBlobURL) UploadPages(ctx context.Context, offset int64, body io.ReadSeeker, ac PageBlobAccessConditions, transactionalMD5 []byte, cpk ClientProvidedKeyOptions) (*PageBlobUploadPagesResponse, error) {
	count, err := validateSeekableStreamAt0AndGetCount(body)
	if err != nil {
		return nil, err
	}
	ifModifiedSince, ifUnmodifiedSince, ifMatchETag, ifNoneMatchETag := ac.ModifiedAccessConditions.pointers()
	ifSequenceNumberLessThanOrEqual, ifSequenceNumberLessThan, ifSequenceNumberEqual := ac.SequenceNumberAccessConditions.pointers()
	return pb.pbClient.UploadPages(ctx, body, count, transactionalMD5, nil, nil,
		PageRange{Start: offset, End: offset + count - 1}.pointers(),
		ac.LeaseAccessConditions.pointers(),
		cpk.EncryptionKey, cpk.EncryptionKeySha256, cpk.EncryptionAlgorithm, // CPK
		cpk.EncryptionScope, // CPK-N
		ifSequenceNumberLessThanOrEqual, ifSequenceNumberLessThan, ifSequenceNumberEqual,
		ifModifiedSince, ifUnmodifiedSince, ifMatchETag, ifNoneMatchETag,
		nil, // Blob ifTags
		nil)
}

// UploadPagesFromURL copies 1 or more pages from a source URL to the page blob.
// The sourceOffset specifies the start offset of source data to copy from.
// The destOffset specifies the start offset of data in page blob will be written to.
// The count must be a multiple of 512 bytes.
// For more information, see https://docs.microsoft.com/rest/api/storageservices/put-page-from-url.
func (pb PageBlobURL) UploadPagesFromURL(ctx context.Context, sourceURL url.URL, sourceOffset int64, destOffset int64, count int64, transactionalMD5 []byte, destinationAccessConditions PageBlobAccessConditions, sourceAccessConditions ModifiedAccessConditions, cpk ClientProvidedKeyOptions, sourceAuthorization TokenCredential) (*PageBlobUploadPagesFromURLResponse, error) {
	ifModifiedSince, ifUnmodifiedSince, ifMatchETag, ifNoneMatchETag := destinationAccessConditions.ModifiedAccessConditions.pointers()
	sourceIfModifiedSince, sourceIfUnmodifiedSince, sourceIfMatchETag, sourceIfNoneMatchETag := sourceAccessConditions.pointers()
	ifSequenceNumberLessThanOrEqual, ifSequenceNumberLessThan, ifSequenceNumberEqual := destinationAccessConditions.SequenceNumberAccessConditions.pointers()
	return pb.pbClient.UploadPagesFromURL(ctx, sourceURL.String(), *PageRange{Start: sourceOffset, End: sourceOffset + count - 1}.pointers(), 0,
		*PageRange{Start: destOffset, End: destOffset + count - 1}.pointers(), transactionalMD5, nil, nil,
		cpk.EncryptionKey, cpk.EncryptionKeySha256, cpk.EncryptionAlgorithm, // CPK-V
		cpk.EncryptionScope, // CPK-N
		destinationAccessConditions.LeaseAccessConditions.pointers(),
		ifSequenceNumberLessThanOrEqual, ifSequenceNumberLessThan, ifSequenceNumberEqual,
		ifModifiedSince, ifUnmodifiedSince, ifMatchETag, ifNoneMatchETag,
		nil, // Blob ifTags
		sourceIfModifiedSince, sourceIfUnmodifiedSince, sourceIfMatchETag, sourceIfNoneMatchETag, nil, tokenCredentialPointers(sourceAuthorization))
}

// ClearPages frees the specified pages from the page blob.
// For more information, see https://docs.microsoft.com/rest/api/storageservices/put-page.
func (pb PageBlobURL) ClearPages(ctx context.Context, offset int64, count int64, ac PageBlobAccessConditions, cpk ClientProvidedKeyOptions) (*PageBlobClearPagesResponse, error) {
	ifModifiedSince, ifUnmodifiedSince, ifMatchETag, ifNoneMatchETag := ac.ModifiedAccessConditions.pointers()
	ifSequenceNumberLessThanOrEqual, ifSequenceNumberLessThan, ifSequenceNumberEqual := ac.SequenceNumberAccessConditions.pointers()
	return pb.pbClient.ClearPages(ctx, 0, nil,
		PageRange{Start: offset, End: offset + count - 1}.pointers(),
		ac.LeaseAccessConditions.pointers(),
		cpk.EncryptionKey, cpk.EncryptionKeySha256, cpk.EncryptionAlgorithm, // CPK
		cpk.EncryptionScope, // CPK-N
		ifSequenceNumberLessThanOrEqual, ifSequenceNumberLessThan,
		ifSequenceNumberEqual, ifModifiedSince, ifUnmodifiedSince, ifMatchETag, ifNoneMatchETag, nil, nil)
}

// GetPageRanges returns the list of valid page ranges for a page blob or snapshot of a page blob.
// For more information, see https://docs.microsoft.com/rest/api/storageservices/get-page-ranges.
func (pb PageBlobURL) GetPageRanges(ctx context.Context, offset int64, count int64, ac BlobAccessConditions) (*PageList, error) {
	ifModifiedSince, ifUnmodifiedSince, ifMatchETag, ifNoneMatchETag := ac.ModifiedAccessConditions.pointers()
	return pb.pbClient.GetPageRanges(ctx, nil, nil,
		httpRange{offset: offset, count: count}.pointers(),
		ac.LeaseAccessConditions.pointers(),
		ifModifiedSince, ifUnmodifiedSince, ifMatchETag, ifNoneMatchETag,
		nil, // Blob ifTags
		nil)
}

// GetManagedDiskPageRangesDiff gets the collection of page ranges that differ between a specified snapshot and this page blob representing managed disk.
// For more information, see https://docs.microsoft.com/rest/api/storageservices/get-page-ranges.
func (pb PageBlobURL) GetManagedDiskPageRangesDiff(ctx context.Context, offset int64, count int64, prevSnapshot *string, prevSnapshotURL *string, ac BlobAccessConditions) (*PageList, error) {
	ifModifiedSince, ifUnmodifiedSince, ifMatchETag, ifNoneMatchETag := ac.ModifiedAccessConditions.pointers()

	return pb.pbClient.GetPageRangesDiff(ctx, nil, nil, prevSnapshot,
		prevSnapshotURL, // Get managed disk diff
		httpRange{offset: offset, count: count}.pointers(),
		ac.LeaseAccessConditions.pointers(),
		ifModifiedSince, ifUnmodifiedSince, ifMatchETag, ifNoneMatchETag,
		nil, // Blob ifTags
		nil)
}

// GetPageRangesDiff gets the collection of page ranges that differ between a specified snapshot and this page blob.
// For more information, see https://docs.microsoft.com/rest/api/storageservices/get-page-ranges.
func (pb PageBlobURL) GetPageRangesDiff(ctx context.Context, offset int64, count int64, prevSnapshot string, ac BlobAccessConditions) (*PageList, error) {
	ifModifiedSince, ifUnmodifiedSince, ifMatchETag, ifNoneMatchETag := ac.ModifiedAccessConditions.pointers()
	return pb.pbClient.GetPageRangesDiff(ctx, nil, nil, &prevSnapshot,
		nil, // Get managed disk diff
		httpRange{offset: offset, count: count}.pointers(),
		ac.LeaseAccessConditions.pointers(),
		ifModifiedSince, ifUnmodifiedSince, ifMatchETag, ifNoneMatchETag,
		nil, // Blob ifTags
		nil)
}

// Resize resizes the page blob to the specified size (which must be a multiple of 512).
// For more information, see https://docs.microsoft.com/rest/api/storageservices/set-blob-properties.
func (pb PageBlobURL) Resize(ctx context.Context, size int64, ac BlobAccessConditions, cpk ClientProvidedKeyOptions) (*PageBlobResizeResponse, error) {
	ifModifiedSince, ifUnmodifiedSince, ifMatchETag, ifNoneMatchETag := ac.ModifiedAccessConditions.pointers()
	return pb.pbClient.Resize(ctx, size, nil, ac.LeaseAccessConditions.pointers(),
		cpk.EncryptionKey, cpk.EncryptionKeySha256, cpk.EncryptionAlgorithm, // CPK
		cpk.EncryptionScope, // CPK-N
		ifModifiedSince, ifUnmodifiedSince, ifMatchETag, ifNoneMatchETag, nil, nil)
}

// UpdateSequenceNumber sets the page blob's sequence number.
func (pb PageBlobURL) UpdateSequenceNumber(ctx context.Context, action SequenceNumberActionType, sequenceNumber int64,
	ac BlobAccessConditions) (*PageBlobUpdateSequenceNumberResponse, error) {
	sn := &sequenceNumber
	if action == SequenceNumberActionIncrement {
		sn = nil
	}
	ifModifiedSince, ifUnmodifiedSince, ifMatch, ifNoneMatch := ac.ModifiedAccessConditions.pointers()
	return pb.pbClient.UpdateSequenceNumber(ctx, action, nil,
		ac.LeaseAccessConditions.pointers(), ifModifiedSince, ifUnmodifiedSince, ifMatch, ifNoneMatch,
		nil, sn, nil)
}

// StartCopyIncremental begins an operation to start an incremental copy from one page blob's snapshot to this page blob.
// The snapshot is copied such that only the differential changes between the previously copied snapshot are transferred to the destination.
// The copied snapshots are complete copies of the original snapshot and can be read or copied from as usual.
// For more information, see https://docs.microsoft.com/rest/api/storageservices/incremental-copy-blob and
// https://docs.microsoft.com/en-us/azure/virtual-machines/windows/incremental-snapshots.
func (pb PageBlobURL) StartCopyIncremental(ctx context.Context, source url.URL, snapshot string, ac BlobAccessConditions) (*PageBlobCopyIncrementalResponse, error) {
	ifModifiedSince, ifUnmodifiedSince, ifMatchETag, ifNoneMatchETag := ac.ModifiedAccessConditions.pointers()
	qp := source.Query()
	qp.Set("snapshot", snapshot)
	source.RawQuery = qp.Encode()
	return pb.pbClient.CopyIncremental(ctx, source.String(), nil,
		ifModifiedSince, ifUnmodifiedSince, ifMatchETag, ifNoneMatchETag, nil, nil)
}

func (pr PageRange) pointers() *string {
	endOffset := strconv.FormatInt(int64(pr.End), 10)
	asString := fmt.Sprintf("bytes=%v-%s", pr.Start, endOffset)
	return &asString
}

type PageBlobAccessConditions struct {
	ModifiedAccessConditions
	LeaseAccessConditions
	SequenceNumberAccessConditions
}

// SequenceNumberAccessConditions identifies page blob-specific access conditions which you optionally set.
type SequenceNumberAccessConditions struct {
	// IfSequenceNumberLessThan ensures that the page blob operation succeeds
	// only if the blob's sequence number is less than a value.
	// IfSequenceNumberLessThan=0 means no 'IfSequenceNumberLessThan' header specified.
	// IfSequenceNumberLessThan>0 means 'IfSequenceNumberLessThan' header specified with its value
	// IfSequenceNumberLessThan==-1 means 'IfSequenceNumberLessThan' header specified with a value of 0
	IfSequenceNumberLessThan int64

	// IfSequenceNumberLessThanOrEqual ensures that the page blob operation succeeds
	// only if the blob's sequence number is less than or equal to a value.
	// IfSequenceNumberLessThanOrEqual=0 means no 'IfSequenceNumberLessThanOrEqual' header specified.
	// IfSequenceNumberLessThanOrEqual>0 means 'IfSequenceNumberLessThanOrEqual' header specified with its value
	// IfSequenceNumberLessThanOrEqual=-1 means 'IfSequenceNumberLessThanOrEqual' header specified with a value of 0
	IfSequenceNumberLessThanOrEqual int64

	// IfSequenceNumberEqual ensures that the page blob operation succeeds
	// only if the blob's sequence number is equal to a value.
	// IfSequenceNumberEqual=0 means no 'IfSequenceNumberEqual' header specified.
	// IfSequenceNumberEqual>0 means 'IfSequenceNumberEqual' header specified with its value
	// IfSequenceNumberEqual=-1 means 'IfSequenceNumberEqual' header specified with a value of 0
	IfSequenceNumberEqual int64
}

// pointers is for internal infrastructure. It returns the fields as pointers.
func (ac SequenceNumberAccessConditions) pointers() (snltoe *int64, snlt *int64, sne *int64) {
	var zero int64 // Defaults to 0
	switch ac.IfSequenceNumberLessThan {
	case -1:
		snlt = &zero
	case 0:
		snlt = nil
	default:
		snlt = &ac.IfSequenceNumberLessThan
	}

	switch ac.IfSequenceNumberLessThanOrEqual {
	case -1:
		snltoe = &zero
	case 0:
		snltoe = nil
	default:
		snltoe = &ac.IfSequenceNumberLessThanOrEqual
	}
	switch ac.IfSequenceNumberEqual {
	case -1:
		sne = &zero
	case 0:
		sne = nil
	default:
		sne = &ac.IfSequenceNumberEqual
	}
	return
}
