package azblob

import (
	"context"
	"net/url"
	"strings"
	"time"

	"github.com/Azure/azure-pipeline-go/pipeline"
)

// A BlobURL represents a URL to an Azure Storage blob; the blob may be a block blob, append blob, or page blob.
type BlobURL struct {
	blobClient blobClient
}

type BlobTagsMap map[string]string

var DefaultAccessTier = AccessTierNone
var DefaultPremiumBlobAccessTier = PremiumPageBlobAccessTierNone

// NewBlobURL creates a BlobURL object using the specified URL and request policy pipeline.
func NewBlobURL(url url.URL, p pipeline.Pipeline) BlobURL {
	blobClient := newBlobClient(url, p)
	return BlobURL{blobClient: blobClient}
}

// URL returns the URL endpoint used by the BlobURL object.
func (b BlobURL) URL() url.URL {
	return b.blobClient.URL()
}

// String returns the URL as a string.
func (b BlobURL) String() string {
	u := b.URL()
	return u.String()
}

func (b BlobURL) GetAccountInfo(ctx context.Context) (*BlobGetAccountInfoResponse, error) {
	return b.blobClient.GetAccountInfo(ctx)
}

// WithPipeline creates a new BlobURL object identical to the source but with the specified request policy pipeline.
func (b BlobURL) WithPipeline(p pipeline.Pipeline) BlobURL {
	return NewBlobURL(b.blobClient.URL(), p)
}

// WithSnapshot creates a new BlobURL object identical to the source but with the specified snapshot timestamp.
// Pass "" to remove the snapshot returning a URL to the base blob.
func (b BlobURL) WithSnapshot(snapshot string) BlobURL {
	p := NewBlobURLParts(b.URL())
	p.Snapshot = snapshot
	return NewBlobURL(p.URL(), b.blobClient.Pipeline())
}

// WithVersionID creates a new BlobURL object identical to the source but with the specified version id.
// Pass "" to remove the snapshot returning a URL to the base blob.
func (b BlobURL) WithVersionID(versionID string) BlobURL {
	p := NewBlobURLParts(b.URL())
	p.VersionID = versionID
	return NewBlobURL(p.URL(), b.blobClient.Pipeline())
}

// ToAppendBlobURL creates an AppendBlobURL using the source's URL and pipeline.
func (b BlobURL) ToAppendBlobURL() AppendBlobURL {
	return NewAppendBlobURL(b.URL(), b.blobClient.Pipeline())
}

// ToBlockBlobURL creates a BlockBlobURL using the source's URL and pipeline.
func (b BlobURL) ToBlockBlobURL() BlockBlobURL {
	return NewBlockBlobURL(b.URL(), b.blobClient.Pipeline())
}

// ToPageBlobURL creates a PageBlobURL using the source's URL and pipeline.
func (b BlobURL) ToPageBlobURL() PageBlobURL {
	return NewPageBlobURL(b.URL(), b.blobClient.Pipeline())
}

func SerializeBlobTagsHeader(blobTagsMap BlobTagsMap) *string {
	if len(blobTagsMap) == 0 {
		return nil
	}
	tags := make([]string, 0)
	for key, val := range blobTagsMap {
		tags = append(tags, url.QueryEscape(key)+"="+url.QueryEscape(val))
	}
	//tags = tags[:len(tags)-1]
	blobTagsString := strings.Join(tags, "&")
	return &blobTagsString
}

func SerializeBlobTags(blobTagsMap BlobTagsMap) BlobTags {
	if len(blobTagsMap) == 0 {
		return BlobTags{}
	}
	blobTagSet := make([]BlobTag, 0, len(blobTagsMap))
	for key, val := range blobTagsMap {
		blobTagSet = append(blobTagSet, BlobTag{Key: key, Value: val})
	}
	return BlobTags{BlobTagSet: blobTagSet}
}

// Download reads a range of bytes from a blob. The response also includes the blob's properties and metadata.
// Passing azblob.CountToEnd (0) for count will download the blob from the offset to the end.
// Note: Snapshot/VersionId are optional parameters which are part of request URL query params.
// 	These parameters can be explicitly set by calling WithSnapshot(snapshot string)/WithVersionID(versionID string)
// 	Therefore it not required to pass these here.
// For more information, see https://docs.microsoft.com/rest/api/storageservices/get-blob.
func (b BlobURL) Download(ctx context.Context, offset int64, count int64, ac BlobAccessConditions, rangeGetContentMD5 bool, cpk ClientProvidedKeyOptions) (*DownloadResponse, error) {
	var xRangeGetContentMD5 *bool
	if rangeGetContentMD5 {
		xRangeGetContentMD5 = &rangeGetContentMD5
	}
	ifModifiedSince, ifUnmodifiedSince, ifMatchETag, ifNoneMatchETag := ac.ModifiedAccessConditions.pointers()
	dr, err := b.blobClient.Download(ctx, nil, nil, nil,
		httpRange{offset: offset, count: count}.pointers(),
		ac.LeaseAccessConditions.pointers(), xRangeGetContentMD5, nil,
		cpk.EncryptionKey, cpk.EncryptionKeySha256, cpk.EncryptionAlgorithm, // CPK
		ifModifiedSince, ifUnmodifiedSince, ifMatchETag, ifNoneMatchETag,
		nil, // Blob ifTags
		nil)
	if err != nil {
		return nil, err
	}
	return &DownloadResponse{
		b:       b,
		r:       dr,
		ctx:     ctx,
		getInfo: HTTPGetterInfo{Offset: offset, Count: count, ETag: dr.ETag()},
	}, err
}

// Delete marks the specified blob or snapshot for deletion. The blob is later deleted during garbage collection.
// Note 1: that deleting a blob also deletes all its snapshots.
// Note 2: Snapshot/VersionId are optional parameters which are part of request URL query params.
// 	These parameters can be explicitly set by calling WithSnapshot(snapshot string)/WithVersionID(versionID string)
// 	Therefore it not required to pass these here.
// For more information, see https://docs.microsoft.com/rest/api/storageservices/delete-blob.
func (b BlobURL) Delete(ctx context.Context, deleteOptions DeleteSnapshotsOptionType, ac BlobAccessConditions) (*BlobDeleteResponse, error) {
	ifModifiedSince, ifUnmodifiedSince, ifMatchETag, ifNoneMatchETag := ac.ModifiedAccessConditions.pointers()
	return b.blobClient.Delete(ctx, nil, nil, nil, ac.LeaseAccessConditions.pointers(), deleteOptions,
		ifModifiedSince, ifUnmodifiedSince, ifMatchETag, ifNoneMatchETag,
		nil, // Blob ifTags
		nil, BlobDeleteNone)
}

// PermanentDelete permanently deletes soft-deleted snapshots & soft-deleted version blobs and is a dangerous operation and SHOULD NOT BE USED.
// WARNING: This operation should not be used unless you know exactly the implications. We will not provide support for this API.
// For more information, see https://docs.microsoft.com/rest/api/storageservices/delete-blob.
func (b BlobURL) PermanentDelete(ctx context.Context, deleteOptions DeleteSnapshotsOptionType, ac BlobAccessConditions) (*BlobDeleteResponse, error) {
	ifModifiedSince, ifUnmodifiedSince, ifMatchETag, ifNoneMatchETag := ac.ModifiedAccessConditions.pointers()
	return b.blobClient.Delete(ctx, nil, nil, nil, ac.LeaseAccessConditions.pointers(), deleteOptions,
		ifModifiedSince, ifUnmodifiedSince, ifMatchETag, ifNoneMatchETag,
		nil, // Blob ifTags
		nil, BlobDeletePermanent)
}

// SetTags operation enables users to set tags on a blob or specific blob version, but not snapshot.
// Each call to this operation replaces all existing tags attached to the blob.
// To remove all tags from the blob, call this operation with no tags set.
// https://docs.microsoft.com/en-us/rest/api/storageservices/set-blob-tags
func (b BlobURL) SetTags(ctx context.Context, transactionalContentMD5 []byte, transactionalContentCrc64 []byte, ifTags *string, blobTagsMap BlobTagsMap) (*BlobSetTagsResponse, error) {
	tags := SerializeBlobTags(blobTagsMap)
	return b.blobClient.SetTags(ctx, nil, nil, transactionalContentMD5, transactionalContentCrc64, nil, ifTags, nil, &tags)
}

// GetTags operation enables users to get tags on a blob or specific blob version, or snapshot.
// https://docs.microsoft.com/en-us/rest/api/storageservices/get-blob-tags
func (b BlobURL) GetTags(ctx context.Context, ifTags *string) (*BlobTags, error) {
	return b.blobClient.GetTags(ctx, nil, nil, nil, nil, ifTags, nil)
}

// Undelete restores the contents and metadata of a soft-deleted blob and any associated soft-deleted snapshots.
// For more information, see https://docs.microsoft.com/rest/api/storageservices/undelete-blob.
func (b BlobURL) Undelete(ctx context.Context) (*BlobUndeleteResponse, error) {
	return b.blobClient.Undelete(ctx, nil, nil)
}

// SetTier operation sets the tier on a blob. The operation is allowed on a page  blob in a premium storage account
// and on a block blob in a blob storage account (locally redundant storage only).
// A premium page blob's tier determines the allowed size, IOPS, and bandwidth of the blob.
// A block blob's tier determines Hot/Cool/Archive storage type. This operation does not update the blob's ETag.
// Note: VersionId is an optional parameter which is part of request URL query params.
// It can be explicitly set by calling WithVersionID(versionID string) function and hence it not required to pass it here.
// For detailed information about block blob level tiering see https://docs.microsoft.com/en-us/azure/storage/blobs/storage-blob-storage-tiers.
func (b BlobURL) SetTier(ctx context.Context, tier AccessTierType, lac LeaseAccessConditions, rehydratePriority RehydratePriorityType) (*BlobSetTierResponse, error) {
	return b.blobClient.SetTier(ctx, tier, nil,
		nil, // Blob versioning
		nil, rehydratePriority, nil, lac.pointers(),
		nil) // Blob ifTags
}

// GetProperties returns the blob's properties.
// Note: Snapshot/VersionId are optional parameters which are part of request URL query params.
// These parameters can be explicitly set by calling WithSnapshot(snapshot string)/WithVersionID(versionID string)
// Therefore it not required to pass these here.
// For more information, see https://docs.microsoft.com/rest/api/storageservices/get-blob-properties.
func (b BlobURL) GetProperties(ctx context.Context, ac BlobAccessConditions, cpk ClientProvidedKeyOptions) (*BlobGetPropertiesResponse, error) {
	ifModifiedSince, ifUnmodifiedSince, ifMatchETag, ifNoneMatchETag := ac.ModifiedAccessConditions.pointers()
	return b.blobClient.GetProperties(ctx, nil,
		nil, // Blob versioning
		nil, ac.LeaseAccessConditions.pointers(),
		cpk.EncryptionKey, cpk.EncryptionKeySha256, cpk.EncryptionAlgorithm, // CPK
		ifModifiedSince, ifUnmodifiedSince, ifMatchETag, ifNoneMatchETag,
		nil, // Blob ifTags
		nil)
}

// SetHTTPHeaders changes a blob's HTTP headers.
// For more information, see https://docs.microsoft.com/rest/api/storageservices/set-blob-properties.
func (b BlobURL) SetHTTPHeaders(ctx context.Context, h BlobHTTPHeaders, ac BlobAccessConditions) (*BlobSetHTTPHeadersResponse, error) {
	ifModifiedSince, ifUnmodifiedSince, ifMatchETag, ifNoneMatchETag := ac.ModifiedAccessConditions.pointers()
	return b.blobClient.SetHTTPHeaders(ctx, nil,
		&h.CacheControl, &h.ContentType, h.ContentMD5, &h.ContentEncoding, &h.ContentLanguage,
		ac.LeaseAccessConditions.pointers(), ifModifiedSince, ifUnmodifiedSince, ifMatchETag, ifNoneMatchETag,
		nil, // Blob ifTags
		&h.ContentDisposition, nil)
}

// SetMetadata changes a blob's metadata.
// https://docs.microsoft.com/rest/api/storageservices/set-blob-metadata.
func (b BlobURL) SetMetadata(ctx context.Context, metadata Metadata, ac BlobAccessConditions, cpk ClientProvidedKeyOptions) (*BlobSetMetadataResponse, error) {
	ifModifiedSince, ifUnmodifiedSince, ifMatchETag, ifNoneMatchETag := ac.ModifiedAccessConditions.pointers()
	return b.blobClient.SetMetadata(ctx, nil, metadata, ac.LeaseAccessConditions.pointers(),
		cpk.EncryptionKey, cpk.EncryptionKeySha256, cpk.EncryptionAlgorithm, // CPK-V
		cpk.EncryptionScope, // CPK-N
		ifModifiedSince, ifUnmodifiedSince, ifMatchETag, ifNoneMatchETag,
		nil, // Blob ifTags
		nil)
}

// CreateSnapshot creates a read-only snapshot of a blob.
// For more information, see https://docs.microsoft.com/rest/api/storageservices/snapshot-blob.
func (b BlobURL) CreateSnapshot(ctx context.Context, metadata Metadata, ac BlobAccessConditions, cpk ClientProvidedKeyOptions) (*BlobCreateSnapshotResponse, error) {
	// CreateSnapshot does NOT panic if the user tries to create a snapshot using a URL that already has a snapshot query parameter
	// because checking this would be a performance hit for a VERY unusual path and I don't think the common case should suffer this
	// performance hit.
	ifModifiedSince, ifUnmodifiedSince, ifMatchETag, ifNoneMatchETag := ac.ModifiedAccessConditions.pointers()
	return b.blobClient.CreateSnapshot(ctx, nil, metadata,
		cpk.EncryptionKey, cpk.EncryptionKeySha256, cpk.EncryptionAlgorithm, // CPK-V
		cpk.EncryptionScope, // CPK-N
		ifModifiedSince, ifUnmodifiedSince, ifMatchETag, ifNoneMatchETag,
		nil, // Blob ifTags
		ac.LeaseAccessConditions.pointers(), nil)
}

// AcquireLease acquires a lease on the blob for write and delete operations. The lease duration must be between
// 15 to 60 seconds, or infinite (-1).
// For more information, see https://docs.microsoft.com/rest/api/storageservices/lease-blob.
func (b BlobURL) AcquireLease(ctx context.Context, proposedID string, duration int32, ac ModifiedAccessConditions) (*BlobAcquireLeaseResponse, error) {
	ifModifiedSince, ifUnmodifiedSince, ifMatchETag, ifNoneMatchETag := ac.pointers()
	return b.blobClient.AcquireLease(ctx, nil, &duration, &proposedID,
		ifModifiedSince, ifUnmodifiedSince, ifMatchETag, ifNoneMatchETag,
		nil, // Blob ifTags
		nil)
}

// RenewLease renews the blob's previously-acquired lease.
// For more information, see https://docs.microsoft.com/rest/api/storageservices/lease-blob.
func (b BlobURL) RenewLease(ctx context.Context, leaseID string, ac ModifiedAccessConditions) (*BlobRenewLeaseResponse, error) {
	ifModifiedSince, ifUnmodifiedSince, ifMatchETag, ifNoneMatchETag := ac.pointers()
	return b.blobClient.RenewLease(ctx, leaseID, nil,
		ifModifiedSince, ifUnmodifiedSince, ifMatchETag, ifNoneMatchETag,
		nil, // Blob ifTags
		nil)
}

// ReleaseLease releases the blob's previously-acquired lease.
// For more information, see https://docs.microsoft.com/rest/api/storageservices/lease-blob.
func (b BlobURL) ReleaseLease(ctx context.Context, leaseID string, ac ModifiedAccessConditions) (*BlobReleaseLeaseResponse, error) {
	ifModifiedSince, ifUnmodifiedSince, ifMatchETag, ifNoneMatchETag := ac.pointers()
	return b.blobClient.ReleaseLease(ctx, leaseID, nil,
		ifModifiedSince, ifUnmodifiedSince, ifMatchETag, ifNoneMatchETag,
		nil, // Blob ifTags
		nil)
}

// BreakLease breaks the blob's previously-acquired lease (if it exists). Pass the LeaseBreakDefault (-1)
// constant to break a fixed-duration lease when it expires or an infinite lease immediately.
// For more information, see https://docs.microsoft.com/rest/api/storageservices/lease-blob.
func (b BlobURL) BreakLease(ctx context.Context, breakPeriodInSeconds int32, ac ModifiedAccessConditions) (*BlobBreakLeaseResponse, error) {
	ifModifiedSince, ifUnmodifiedSince, ifMatchETag, ifNoneMatchETag := ac.pointers()
	return b.blobClient.BreakLease(ctx, nil, leasePeriodPointer(breakPeriodInSeconds),
		ifModifiedSince, ifUnmodifiedSince, ifMatchETag, ifNoneMatchETag,
		nil, // Blob ifTags
		nil)
}

// ChangeLease changes the blob's lease ID.
// For more information, see https://docs.microsoft.com/rest/api/storageservices/lease-blob.
func (b BlobURL) ChangeLease(ctx context.Context, leaseID string, proposedID string, ac ModifiedAccessConditions) (*BlobChangeLeaseResponse, error) {
	ifModifiedSince, ifUnmodifiedSince, ifMatchETag, ifNoneMatchETag := ac.pointers()
	return b.blobClient.ChangeLease(ctx, leaseID, proposedID,
		nil, ifModifiedSince, ifUnmodifiedSince, ifMatchETag, ifNoneMatchETag,
		nil, // Blob ifTags
		nil)
}

// LeaseBreakNaturally tells ContainerURL's or BlobURL's BreakLease method to break the lease using service semantics.
const LeaseBreakNaturally = -1

func leasePeriodPointer(period int32) (p *int32) {
	if period != LeaseBreakNaturally {
		p = &period
	}
	return nil
}

// StartCopyFromURL copies the data at the source URL to a blob.
// For more information, see https://docs.microsoft.com/rest/api/storageservices/copy-blob.
func (b BlobURL) StartCopyFromURL(ctx context.Context, source url.URL, metadata Metadata, srcac ModifiedAccessConditions, dstac BlobAccessConditions, tier AccessTierType, blobTagsMap BlobTagsMap) (*BlobStartCopyFromURLResponse, error) {
	srcIfModifiedSince, srcIfUnmodifiedSince, srcIfMatchETag, srcIfNoneMatchETag := srcac.pointers()
	dstIfModifiedSince, dstIfUnmodifiedSince, dstIfMatchETag, dstIfNoneMatchETag := dstac.ModifiedAccessConditions.pointers()
	dstLeaseID := dstac.LeaseAccessConditions.pointers()
	blobTagsString := SerializeBlobTagsHeader(blobTagsMap)
	return b.blobClient.StartCopyFromURL(ctx, source.String(), nil, metadata,
		tier, RehydratePriorityNone, srcIfModifiedSince, srcIfUnmodifiedSince,
		srcIfMatchETag, srcIfNoneMatchETag,
		nil, // source ifTags
		dstIfModifiedSince, dstIfUnmodifiedSince,
		dstIfMatchETag, dstIfNoneMatchETag,
		nil, // Blob ifTags
		dstLeaseID,
		nil,
		blobTagsString, // Blob tags
		nil,
		// immutability policy
		nil, BlobImmutabilityPolicyModeNone, nil,
	)
}

// AbortCopyFromURL stops a pending copy that was previously started and leaves a destination blob with 0 length and metadata.
// For more information, see https://docs.microsoft.com/rest/api/storageservices/abort-copy-blob.
func (b BlobURL) AbortCopyFromURL(ctx context.Context, copyID string, ac LeaseAccessConditions) (*BlobAbortCopyFromURLResponse, error) {
	return b.blobClient.AbortCopyFromURL(ctx, copyID, nil, ac.pointers(), nil)
}

// SetImmutabilityPolicy sets a temporary immutability policy with an expiration date. The expiration date must be in the future.
// While the immutability policy is active, the blob can be read but not modified or deleted.
// For more information, see https://docs.microsoft.com/en-us/azure/storage/blobs/immutable-time-based-retention-policy-overview (Feature overview)
// and https://docs.microsoft.com/en-us/rest/api/storageservices/set-blob-immutability-policy (REST API reference)
// A container with object-level immutability enabled is required.
func (b BlobURL) SetImmutabilityPolicy(ctx context.Context, expiry time.Time, mode BlobImmutabilityPolicyModeType, ifUnmodifiedSince *time.Time) (*BlobSetImmutabilityPolicyResponse, error) {
	return b.blobClient.SetImmutabilityPolicy(ctx, nil, nil, ifUnmodifiedSince, &expiry, mode)
}

// DeleteImmutabilityPolicy deletes a temporary immutability policy with an expiration date.
// While the immutability policy is active, the blob can be read but not modified or deleted.
// For more information, see https://docs.microsoft.com/en-us/azure/storage/blobs/immutable-time-based-retention-policy-overview (Feature overview)
// and https://docs.microsoft.com/en-us/rest/api/storageservices/delete-blob-immutability-policy (REST API reference)
// A container with object-level immutability enabled is required.
func (b BlobURL) DeleteImmutabilityPolicy(ctx context.Context) (*BlobDeleteImmutabilityPolicyResponse, error) {
	return b.blobClient.DeleteImmutabilityPolicy(ctx, nil, nil)
}

// SetLegalHold enables a temporary immutability policy that can be applied for general data protection purposes.
// It stores the current blob version in a WORM (Write-Once Read-Many) state. While in effect, the blob can be read but not modified or deleted.
// For more information, see https://docs.microsoft.com/en-us/azure/storage/blobs/immutable-legal-hold-overview (Feature overview)
// and https://docs.microsoft.com/en-us/rest/api/storageservices/set-blob-legal-hold (REST API reference)
// A container with object-level immutability enabled is required.
func (b BlobURL) SetLegalHold(ctx context.Context, legalHold bool) (*BlobSetLegalHoldResponse, error) {
	return b.blobClient.SetLegalHold(ctx, legalHold, nil, nil)
}
