package azblob

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"net/url"

	"github.com/Azure/azure-pipeline-go/pipeline"
)

// A ContainerURL represents a URL to the Azure Storage container allowing you to manipulate its blobs.
type ContainerURL struct {
	client containerClient
}

// NewContainerURL creates a ContainerURL object using the specified URL and request policy pipeline.
func NewContainerURL(url url.URL, p pipeline.Pipeline) ContainerURL {
	client := newContainerClient(url, p)
	return ContainerURL{client: client}
}

// URL returns the URL endpoint used by the ContainerURL object.
func (c ContainerURL) URL() url.URL {
	return c.client.URL()
}

// String returns the URL as a string.
func (c ContainerURL) String() string {
	u := c.URL()
	return u.String()
}

func (c ContainerURL) GetAccountInfo(ctx context.Context) (*ContainerGetAccountInfoResponse, error) {
	return c.client.GetAccountInfo(ctx)
}

// WithPipeline creates a new ContainerURL object identical to the source but with the specified request policy pipeline.
func (c ContainerURL) WithPipeline(p pipeline.Pipeline) ContainerURL {
	return NewContainerURL(c.URL(), p)
}

// NewBlobURL creates a new BlobURL object by concatenating blobName to the end of
// ContainerURL's URL. The new BlobURL uses the same request policy pipeline as the ContainerURL.
// To change the pipeline, create the BlobURL and then call its WithPipeline method passing in the
// desired pipeline object. Or, call this package's NewBlobURL instead of calling this object's
// NewBlobURL method.
func (c ContainerURL) NewBlobURL(blobName string) BlobURL {
	blobURL := appendToURLPath(c.URL(), blobName)
	return NewBlobURL(blobURL, c.client.Pipeline())
}

// NewAppendBlobURL creates a new AppendBlobURL object by concatenating blobName to the end of
// ContainerURL's URL. The new AppendBlobURL uses the same request policy pipeline as the ContainerURL.
// To change the pipeline, create the AppendBlobURL and then call its WithPipeline method passing in the
// desired pipeline object. Or, call this package's NewAppendBlobURL instead of calling this object's
// NewAppendBlobURL method.
func (c ContainerURL) NewAppendBlobURL(blobName string) AppendBlobURL {
	blobURL := appendToURLPath(c.URL(), blobName)
	return NewAppendBlobURL(blobURL, c.client.Pipeline())
}

// NewBlockBlobURL creates a new BlockBlobURL object by concatenating blobName to the end of
// ContainerURL's URL. The new BlockBlobURL uses the same request policy pipeline as the ContainerURL.
// To change the pipeline, create the BlockBlobURL and then call its WithPipeline method passing in the
// desired pipeline object. Or, call this package's NewBlockBlobURL instead of calling this object's
// NewBlockBlobURL method.
func (c ContainerURL) NewBlockBlobURL(blobName string) BlockBlobURL {
	blobURL := appendToURLPath(c.URL(), blobName)
	return NewBlockBlobURL(blobURL, c.client.Pipeline())
}

// NewPageBlobURL creates a new PageBlobURL object by concatenating blobName to the end of
// ContainerURL's URL. The new PageBlobURL uses the same request policy pipeline as the ContainerURL.
// To change the pipeline, create the PageBlobURL and then call its WithPipeline method passing in the
// desired pipeline object. Or, call this package's NewPageBlobURL instead of calling this object's
// NewPageBlobURL method.
func (c ContainerURL) NewPageBlobURL(blobName string) PageBlobURL {
	blobURL := appendToURLPath(c.URL(), blobName)
	return NewPageBlobURL(blobURL, c.client.Pipeline())
}

// Create creates a new container within a storage account. If a container with the same name already exists, the operation fails.
// For more information, see https://docs.microsoft.com/rest/api/storageservices/create-container.
func (c ContainerURL) Create(ctx context.Context, metadata Metadata, publicAccessType PublicAccessType) (*ContainerCreateResponse, error) {
	return c.client.Create(ctx, nil, metadata, publicAccessType, nil,
		nil, nil, // container encryption
	)
}

// Delete marks the specified container for deletion. The container and any blobs contained within it are later deleted during garbage collection.
// For more information, see https://docs.microsoft.com/rest/api/storageservices/delete-container.
func (c ContainerURL) Delete(ctx context.Context, ac ContainerAccessConditions) (*ContainerDeleteResponse, error) {
	if ac.IfMatch != ETagNone || ac.IfNoneMatch != ETagNone {
		return nil, errors.New("the IfMatch and IfNoneMatch access conditions must have their default values because they are ignored by the service")
	}

	ifModifiedSince, ifUnmodifiedSince, _, _ := ac.ModifiedAccessConditions.pointers()
	return c.client.Delete(ctx, nil, ac.LeaseAccessConditions.pointers(),
		ifModifiedSince, ifUnmodifiedSince, nil)
}

// GetProperties returns the container's properties.
// For more information, see https://docs.microsoft.com/rest/api/storageservices/get-container-metadata.
func (c ContainerURL) GetProperties(ctx context.Context, ac LeaseAccessConditions) (*ContainerGetPropertiesResponse, error) {
	// NOTE: GetMetadata actually calls GetProperties internally because GetProperties returns the metadata AND the properties.
	// This allows us to not expose a GetProperties method at all simplifying the API.
	return c.client.GetProperties(ctx, nil, ac.pointers(), nil)
}

// SetMetadata sets the container's metadata.
// For more information, see https://docs.microsoft.com/rest/api/storageservices/set-container-metadata.
func (c ContainerURL) SetMetadata(ctx context.Context, metadata Metadata, ac ContainerAccessConditions) (*ContainerSetMetadataResponse, error) {
	if !ac.IfUnmodifiedSince.IsZero() || ac.IfMatch != ETagNone || ac.IfNoneMatch != ETagNone {
		return nil, errors.New("the IfUnmodifiedSince, IfMatch, and IfNoneMatch must have their default values because they are ignored by the blob service")
	}
	ifModifiedSince, _, _, _ := ac.ModifiedAccessConditions.pointers()
	return c.client.SetMetadata(ctx, nil, ac.LeaseAccessConditions.pointers(), metadata, ifModifiedSince, nil)
}

// GetAccessPolicy returns the container's access policy. The access policy indicates whether container's blobs may be accessed publicly.
// For more information, see https://docs.microsoft.com/rest/api/storageservices/get-container-acl.
func (c ContainerURL) GetAccessPolicy(ctx context.Context, ac LeaseAccessConditions) (*SignedIdentifiers, error) {
	return c.client.GetAccessPolicy(ctx, nil, ac.pointers(), nil)
}

// The AccessPolicyPermission type simplifies creating the permissions string for a container's access policy.
// Initialize an instance of this type and then call its String method to set AccessPolicy's Permission field.
type AccessPolicyPermission struct {
	Read, Add, Create, Write, Delete, List bool
}

// String produces the access policy permission string for an Azure Storage container.
// Call this method to set AccessPolicy's Permission field.
func (p AccessPolicyPermission) String() string {
	var b bytes.Buffer
	if p.Read {
		b.WriteRune('r')
	}
	if p.Add {
		b.WriteRune('a')
	}
	if p.Create {
		b.WriteRune('c')
	}
	if p.Write {
		b.WriteRune('w')
	}
	if p.Delete {
		b.WriteRune('d')
	}
	if p.List {
		b.WriteRune('l')
	}
	return b.String()
}

// Parse initializes the AccessPolicyPermission's fields from a string.
func (p *AccessPolicyPermission) Parse(s string) error {
	*p = AccessPolicyPermission{} // Clear the flags
	for _, r := range s {
		switch r {
		case 'r':
			p.Read = true
		case 'a':
			p.Add = true
		case 'c':
			p.Create = true
		case 'w':
			p.Write = true
		case 'd':
			p.Delete = true
		case 'l':
			p.List = true
		default:
			return fmt.Errorf("invalid permission: '%v'", r)
		}
	}
	return nil
}

// SetAccessPolicy sets the container's permissions. The access policy indicates whether blobs in a container may be accessed publicly.
// For more information, see https://docs.microsoft.com/rest/api/storageservices/set-container-acl.
func (c ContainerURL) SetAccessPolicy(ctx context.Context, accessType PublicAccessType, si []SignedIdentifier,
	ac ContainerAccessConditions) (*ContainerSetAccessPolicyResponse, error) {
	if ac.IfMatch != ETagNone || ac.IfNoneMatch != ETagNone {
		return nil, errors.New("the IfMatch and IfNoneMatch access conditions must have their default values because they are ignored by the service")
	}
	ifModifiedSince, ifUnmodifiedSince, _, _ := ac.ModifiedAccessConditions.pointers()
	return c.client.SetAccessPolicy(ctx, si, nil, ac.LeaseAccessConditions.pointers(),
		accessType, ifModifiedSince, ifUnmodifiedSince, nil)
}

// AcquireLease acquires a lease on the container for delete operations. The lease duration must be between 15 to 60 seconds, or infinite (-1).
// For more information, see https://docs.microsoft.com/rest/api/storageservices/lease-container.
func (c ContainerURL) AcquireLease(ctx context.Context, proposedID string, duration int32, ac ModifiedAccessConditions) (*ContainerAcquireLeaseResponse, error) {
	ifModifiedSince, ifUnmodifiedSince, _, _ := ac.pointers()
	return c.client.AcquireLease(ctx, nil, &duration, &proposedID,
		ifModifiedSince, ifUnmodifiedSince, nil)
}

// RenewLease renews the container's previously-acquired lease.
// For more information, see https://docs.microsoft.com/rest/api/storageservices/lease-container.
func (c ContainerURL) RenewLease(ctx context.Context, leaseID string, ac ModifiedAccessConditions) (*ContainerRenewLeaseResponse, error) {
	ifModifiedSince, ifUnmodifiedSince, _, _ := ac.pointers()
	return c.client.RenewLease(ctx, leaseID, nil, ifModifiedSince, ifUnmodifiedSince, nil)
}

// ReleaseLease releases the container's previously-acquired lease.
// For more information, see https://docs.microsoft.com/rest/api/storageservices/lease-container.
func (c ContainerURL) ReleaseLease(ctx context.Context, leaseID string, ac ModifiedAccessConditions) (*ContainerReleaseLeaseResponse, error) {
	ifModifiedSince, ifUnmodifiedSince, _, _ := ac.pointers()
	return c.client.ReleaseLease(ctx, leaseID, nil, ifModifiedSince, ifUnmodifiedSince, nil)
}

// BreakLease breaks the container's previously-acquired lease (if it exists).
// For more information, see https://docs.microsoft.com/rest/api/storageservices/lease-container.
func (c ContainerURL) BreakLease(ctx context.Context, period int32, ac ModifiedAccessConditions) (*ContainerBreakLeaseResponse, error) {
	ifModifiedSince, ifUnmodifiedSince, _, _ := ac.pointers()
	return c.client.BreakLease(ctx, nil, leasePeriodPointer(period), ifModifiedSince, ifUnmodifiedSince, nil)
}

// ChangeLease changes the container's lease ID.
// For more information, see https://docs.microsoft.com/rest/api/storageservices/lease-container.
func (c ContainerURL) ChangeLease(ctx context.Context, leaseID string, proposedID string, ac ModifiedAccessConditions) (*ContainerChangeLeaseResponse, error) {
	ifModifiedSince, ifUnmodifiedSince, _, _ := ac.pointers()
	return c.client.ChangeLease(ctx, leaseID, proposedID, nil, ifModifiedSince, ifUnmodifiedSince, nil)
}

// ListBlobsFlatSegment returns a single segment of blobs starting from the specified Marker. Use an empty
// Marker to start enumeration from the beginning. Blob names are returned in lexicographic order.
// After getting a segment, process it, and then call ListBlobsFlatSegment again (passing the the
// previously-returned Marker) to get the next segment.
// For more information, see https://docs.microsoft.com/rest/api/storageservices/list-blobs.
func (c ContainerURL) ListBlobsFlatSegment(ctx context.Context, marker Marker, o ListBlobsSegmentOptions) (*ListBlobsFlatSegmentResponse, error) {
	prefix, include, maxResults := o.pointers()
	return c.client.ListBlobFlatSegment(ctx, prefix, marker.Val, maxResults, include, nil, nil)
}

// ListBlobsHierarchySegment returns a single segment of blobs starting from the specified Marker. Use an empty
// Marker to start enumeration from the beginning. Blob names are returned in lexicographic order.
// After getting a segment, process it, and then call ListBlobsHierarchicalSegment again (passing the the
// previously-returned Marker) to get the next segment.
// For more information, see https://docs.microsoft.com/rest/api/storageservices/list-blobs.
func (c ContainerURL) ListBlobsHierarchySegment(ctx context.Context, marker Marker, delimiter string, o ListBlobsSegmentOptions) (*ListBlobsHierarchySegmentResponse, error) {
	if o.Details.Snapshots {
		return nil, errors.New("snapshots are not supported in this listing operation")
	}
	prefix, include, maxResults := o.pointers()
	return c.client.ListBlobHierarchySegment(ctx, delimiter, prefix, marker.Val, maxResults, include, nil, nil)
}

// ListBlobsSegmentOptions defines options available when calling ListBlobs.
type ListBlobsSegmentOptions struct {
	Details BlobListingDetails // No IncludeType header is produced if ""
	Prefix  string             // No Prefix header is produced if ""

	// SetMaxResults sets the maximum desired results you want the service to return. Note, the
	// service may return fewer results than requested.
	// MaxResults=0 means no 'MaxResults' header specified.
	MaxResults int32
}

func (o *ListBlobsSegmentOptions) pointers() (prefix *string, include []ListBlobsIncludeItemType, maxResults *int32) {
	if o.Prefix != "" {
		prefix = &o.Prefix
	}
	include = o.Details.slice()
	if o.MaxResults != 0 {
		maxResults = &o.MaxResults
	}
	return
}

// BlobListingDetails indicates what additional information the service should return with each blob.
type BlobListingDetails struct {
	Copy, Metadata, Snapshots, UncommittedBlobs, Deleted, Tags, Versions, Permissions, LegalHold, ImmutabilityPolicy, DeletedWithVersions bool
}

// string produces the Include query parameter's value.
func (d *BlobListingDetails) slice() []ListBlobsIncludeItemType {
	items := []ListBlobsIncludeItemType{}
	// NOTE: Multiple strings MUST be appended in alphabetic order or signing the string for authentication fails!
	if d.Copy {
		items = append(items, ListBlobsIncludeItemCopy)
	}
	if d.Deleted {
		items = append(items, ListBlobsIncludeItemDeleted)
	}
	if d.DeletedWithVersions {
		items = append(items, ListBlobsIncludeItemDeletedwithversions)
	}
	if d.ImmutabilityPolicy {
		items = append(items, ListBlobsIncludeItemImmutabilitypolicy)
	}
	if d.LegalHold {
		items = append(items, ListBlobsIncludeItemLegalhold)
	}
	if d.Metadata {
		items = append(items, ListBlobsIncludeItemMetadata)
	}
	if d.Permissions {
		items = append(items, ListBlobsIncludeItemPermissions)
	}
	if d.Snapshots {
		items = append(items, ListBlobsIncludeItemSnapshots)
	}
	if d.UncommittedBlobs {
		items = append(items, ListBlobsIncludeItemUncommittedblobs)
	}
	if d.Tags {
		items = append(items, ListBlobsIncludeItemTags)
	}
	if d.Versions {
		items = append(items, ListBlobsIncludeItemVersions)
	}
	return items
}
