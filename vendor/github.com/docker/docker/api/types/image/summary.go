package image

import ocispec "github.com/opencontainers/image-spec/specs-go/v1"

type Summary struct {

	// Number of containers using this image. Includes both stopped and running
	// containers.
	//
	// This size is not calculated by default, and depends on which API endpoint
	// is used. `-1` indicates that the value has not been set / calculated.
	//
	// Required: true
	Containers int64 `json:"Containers"`

	// Date and time at which the image was created as a Unix timestamp
	// (number of seconds since EPOCH).
	//
	// Required: true
	Created int64 `json:"Created"`

	// ID is the content-addressable ID of an image.
	//
	// This identifier is a content-addressable digest calculated from the
	// image's configuration (which includes the digests of layers used by
	// the image).
	//
	// Note that this digest differs from the `RepoDigests` below, which
	// holds digests of image manifests that reference the image.
	//
	// Required: true
	ID string `json:"Id"`

	// User-defined key/value metadata.
	// Required: true
	Labels map[string]string `json:"Labels"`

	// ID of the parent image.
	//
	// Depending on how the image was created, this field may be empty and
	// is only set for images that were built/created locally. This field
	// is empty if the image was pulled from an image registry.
	//
	// Required: true
	ParentID string `json:"ParentId"`

	// Descriptor is the OCI descriptor of the image target.
	// It's only set if the daemon provides a multi-platform image store.
	//
	// WARNING: This is experimental and may change at any time without any backward
	// compatibility.
	Descriptor *ocispec.Descriptor `json:"Descriptor,omitempty"`

	// Manifests is a list of image manifests available in this image.  It
	// provides a more detailed view of the platform-specific image manifests or
	// other image-attached data like build attestations.
	//
	// WARNING: This is experimental and may change at any time without any backward
	// compatibility.
	Manifests []ManifestSummary `json:"Manifests,omitempty"`

	// List of content-addressable digests of locally available image manifests
	// that the image is referenced from. Multiple manifests can refer to the
	// same image.
	//
	// These digests are usually only available if the image was either pulled
	// from a registry, or if the image was pushed to a registry, which is when
	// the manifest is generated and its digest calculated.
	//
	// Required: true
	RepoDigests []string `json:"RepoDigests"`

	// List of image names/tags in the local image cache that reference this
	// image.
	//
	// Multiple image tags can refer to the same image, and this list may be
	// empty if no tags reference the image, in which case the image is
	// "untagged", in which case it can still be referenced by its ID.
	//
	// Required: true
	RepoTags []string `json:"RepoTags"`

	// Total size of image layers that are shared between this image and other
	// images.
	//
	// This size is not calculated by default. `-1` indicates that the value
	// has not been set / calculated.
	//
	// Required: true
	SharedSize int64 `json:"SharedSize"`

	// Total size of the image including all layers it is composed of.
	//
	// Required: true
	Size int64 `json:"Size"`

	// Total size of the image including all layers it is composed of.
	//
	// Deprecated: this field is omitted in API v1.44, but kept for backward compatibility. Use Size instead.
	VirtualSize int64 `json:"VirtualSize,omitempty"`
}
