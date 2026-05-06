package azblob

import (
	"context"
	"io"
	"net/url"

	"github.com/Azure/azure-pipeline-go/pipeline"
)

const (
	// AppendBlobMaxAppendBlockBytes indicates the maximum number of bytes that can be sent in a call to AppendBlock.
	AppendBlobMaxAppendBlockBytes = 4 * 1024 * 1024 // 4MB

	// AppendBlobMaxBlocks indicates the maximum number of blocks allowed in an append blob.
	AppendBlobMaxBlocks = 50000
)

// AppendBlobURL defines a set of operations applicable to append blobs.
type AppendBlobURL struct {
	BlobURL
	abClient appendBlobClient
}

// NewAppendBlobURL creates an AppendBlobURL object using the specified URL and request policy pipeline.
func NewAppendBlobURL(url url.URL, p pipeline.Pipeline) AppendBlobURL {
	blobClient := newBlobClient(url, p)
	abClient := newAppendBlobClient(url, p)
	return AppendBlobURL{BlobURL: BlobURL{blobClient: blobClient}, abClient: abClient}
}

// WithPipeline creates a new AppendBlobURL object identical to the source but with the specific request policy pipeline.
func (ab AppendBlobURL) WithPipeline(p pipeline.Pipeline) AppendBlobURL {
	return NewAppendBlobURL(ab.blobClient.URL(), p)
}

// WithSnapshot creates a new AppendBlobURL object identical to the source but with the specified snapshot timestamp.
// Pass "" to remove the snapshot returning a URL to the base blob.
func (ab AppendBlobURL) WithSnapshot(snapshot string) AppendBlobURL {
	p := NewBlobURLParts(ab.URL())
	p.Snapshot = snapshot
	return NewAppendBlobURL(p.URL(), ab.blobClient.Pipeline())
}

// WithVersionID creates a new AppendBlobURL object identical to the source but with the specified version id.
// Pass "" to remove the snapshot returning a URL to the base blob.
func (ab AppendBlobURL) WithVersionID(versionId string) AppendBlobURL {
	p := NewBlobURLParts(ab.URL())
	p.VersionID = versionId
	return NewAppendBlobURL(p.URL(), ab.blobClient.Pipeline())
}

func (ab AppendBlobURL) GetAccountInfo(ctx context.Context) (*BlobGetAccountInfoResponse, error) {
	return ab.blobClient.GetAccountInfo(ctx)
}

// Create creates a 0-length append blob. Call AppendBlock to append data to an append blob.
// For more information, see https://docs.microsoft.com/rest/api/storageservices/put-blob.
func (ab AppendBlobURL) Create(ctx context.Context, h BlobHTTPHeaders, metadata Metadata, ac BlobAccessConditions, blobTagsMap BlobTagsMap, cpk ClientProvidedKeyOptions, immutability ImmutabilityPolicyOptions) (*AppendBlobCreateResponse, error) {
	ifModifiedSince, ifUnmodifiedSince, ifMatch, ifNoneMatch := ac.ModifiedAccessConditions.pointers()
	blobTagsString := SerializeBlobTagsHeader(blobTagsMap)
	immutabilityExpiry, immutabilityMode, legalHold := immutability.pointers()
	return ab.abClient.Create(ctx, 0, nil,
		&h.ContentType, &h.ContentEncoding, &h.ContentLanguage, h.ContentMD5,
		&h.CacheControl, metadata, ac.LeaseAccessConditions.pointers(), &h.ContentDisposition,
		cpk.EncryptionKey, cpk.EncryptionKeySha256, cpk.EncryptionAlgorithm, // CPK-V
		cpk.EncryptionScope, // CPK-N
		ifModifiedSince, ifUnmodifiedSince, ifMatch, ifNoneMatch,
		nil, // Blob ifTags
		nil,
		blobTagsString, // Blob tags
		// immutability policy
		immutabilityExpiry, immutabilityMode, legalHold,
	)
}

// AppendBlock writes a stream to a new block of data to the end of the existing append blob.
// This method panics if the stream is not at position 0.
// Note that the http client closes the body stream after the request is sent to the service.
// For more information, see https://docs.microsoft.com/rest/api/storageservices/append-block.
func (ab AppendBlobURL) AppendBlock(ctx context.Context, body io.ReadSeeker, ac AppendBlobAccessConditions, transactionalMD5 []byte, cpk ClientProvidedKeyOptions) (*AppendBlobAppendBlockResponse, error) {
	ifModifiedSince, ifUnmodifiedSince, ifMatchETag, ifNoneMatchETag := ac.ModifiedAccessConditions.pointers()
	ifAppendPositionEqual, ifMaxSizeLessThanOrEqual := ac.AppendPositionAccessConditions.pointers()
	count, err := validateSeekableStreamAt0AndGetCount(body)
	if err != nil {
		return nil, err
	}
	return ab.abClient.AppendBlock(ctx, body, count, nil,
		transactionalMD5,
		nil, // CRC
		ac.LeaseAccessConditions.pointers(),
		ifMaxSizeLessThanOrEqual, ifAppendPositionEqual,
		cpk.EncryptionKey, cpk.EncryptionKeySha256, cpk.EncryptionAlgorithm, // CPK
		cpk.EncryptionScope, // CPK-N
		ifModifiedSince, ifUnmodifiedSince, ifMatchETag, ifNoneMatchETag,
		nil, // Blob ifTags
		nil)
}

// AppendBlockFromURL copies a new block of data from source URL to the end of the existing append blob.
// For more information, see https://docs.microsoft.com/rest/api/storageservices/append-block-from-url.
func (ab AppendBlobURL) AppendBlockFromURL(ctx context.Context, sourceURL url.URL, offset int64, count int64, destinationAccessConditions AppendBlobAccessConditions, sourceAccessConditions ModifiedAccessConditions, transactionalMD5 []byte, cpk ClientProvidedKeyOptions, sourceAuthorization TokenCredential) (*AppendBlobAppendBlockFromURLResponse, error) {
	ifModifiedSince, ifUnmodifiedSince, ifMatchETag, ifNoneMatchETag := destinationAccessConditions.ModifiedAccessConditions.pointers()
	sourceIfModifiedSince, sourceIfUnmodifiedSince, sourceIfMatchETag, sourceIfNoneMatchETag := sourceAccessConditions.pointers()
	ifAppendPositionEqual, ifMaxSizeLessThanOrEqual := destinationAccessConditions.AppendPositionAccessConditions.pointers()
	return ab.abClient.AppendBlockFromURL(ctx, sourceURL.String(), 0, httpRange{offset: offset, count: count}.pointers(),
		transactionalMD5, nil, nil, nil,
		cpk.EncryptionKey, cpk.EncryptionKeySha256, cpk.EncryptionAlgorithm, // CPK
		cpk.EncryptionScope, // CPK-N
		destinationAccessConditions.LeaseAccessConditions.pointers(),
		ifMaxSizeLessThanOrEqual, ifAppendPositionEqual,
		ifModifiedSince, ifUnmodifiedSince, ifMatchETag, ifNoneMatchETag,
		nil, // Blob ifTags
		sourceIfModifiedSince, sourceIfUnmodifiedSince, sourceIfMatchETag, sourceIfNoneMatchETag, nil, tokenCredentialPointers(sourceAuthorization))
}

type AppendBlobAccessConditions struct {
	ModifiedAccessConditions
	LeaseAccessConditions
	AppendPositionAccessConditions
}

// AppendPositionAccessConditions identifies append blob-specific access conditions which you optionally set.
type AppendPositionAccessConditions struct {
	// IfAppendPositionEqual ensures that the AppendBlock operation succeeds
	// only if the append position is equal to a value.
	// IfAppendPositionEqual=0 means no 'IfAppendPositionEqual' header specified.
	// IfAppendPositionEqual>0 means 'IfAppendPositionEqual' header specified with its value
	// IfAppendPositionEqual==-1 means IfAppendPositionEqual' header specified with a value of 0
	IfAppendPositionEqual int64

	// IfMaxSizeLessThanOrEqual ensures that the AppendBlock operation succeeds
	// only if the append blob's size is less than or equal to a value.
	// IfMaxSizeLessThanOrEqual=0 means no 'IfMaxSizeLessThanOrEqual' header specified.
	// IfMaxSizeLessThanOrEqual>0 means 'IfMaxSizeLessThanOrEqual' header specified with its value
	// IfMaxSizeLessThanOrEqual==-1 means 'IfMaxSizeLessThanOrEqual' header specified with a value of 0
	IfMaxSizeLessThanOrEqual int64
}

// pointers is for internal infrastructure. It returns the fields as pointers.
func (ac AppendPositionAccessConditions) pointers() (iape *int64, imsltoe *int64) {
	var zero int64 // defaults to 0
	switch ac.IfAppendPositionEqual {
	case -1:
		iape = &zero
	case 0:
		iape = nil
	default:
		iape = &ac.IfAppendPositionEqual
	}

	switch ac.IfMaxSizeLessThanOrEqual {
	case -1:
		imsltoe = &zero
	case 0:
		imsltoe = nil
	default:
		imsltoe = &ac.IfMaxSizeLessThanOrEqual
	}
	return
}
