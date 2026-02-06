package image

import (
	"github.com/opencontainers/go-digest"
	ocispec "github.com/opencontainers/image-spec/specs-go/v1"
)

type ManifestKind string

const (
	ManifestKindImage       ManifestKind = "image"
	ManifestKindAttestation ManifestKind = "attestation"
	ManifestKindUnknown     ManifestKind = "unknown"
)

type ManifestSummary struct {
	// ID is the content-addressable ID of an image and is the same as the
	// digest of the image manifest.
	//
	// Required: true
	ID string `json:"ID"`

	// Descriptor is the OCI descriptor of the image.
	//
	// Required: true
	Descriptor ocispec.Descriptor `json:"Descriptor"`

	// Indicates whether all the child content (image config, layers) is
	// fully available locally
	//
	// Required: true
	Available bool `json:"Available"`

	// Size is the size information of the content related to this manifest.
	// Note: These sizes only take the locally available content into account.
	//
	// Required: true
	Size struct {
		// Content is the size (in bytes) of all the locally present
		// content in the content store (e.g. image config, layers)
		// referenced by this manifest and its children.
		// This only includes blobs in the content store.
		Content int64 `json:"Content"`

		// Total is the total size (in bytes) of all the locally present
		// data (both distributable and non-distributable) that's related to
		// this manifest and its children.
		// This equal to the sum of [Content] size AND all the sizes in the
		// [Size] struct present in the Kind-specific data struct.
		// For example, for an image kind (Kind == ManifestKindImage),
		// this would include the size of the image content and unpacked
		// image snapshots ([Size.Content] + [ImageData.Size.Unpacked]).
		Total int64 `json:"Total"`
	} `json:"Size"`

	// Kind is the kind of the image manifest.
	//
	// Required: true
	Kind ManifestKind `json:"Kind"`

	// Fields below are specific to the kind of the image manifest.

	// Present only if Kind == ManifestKindImage.
	ImageData *ImageProperties `json:"ImageData,omitempty"`

	// Present only if Kind == ManifestKindAttestation.
	AttestationData *AttestationProperties `json:"AttestationData,omitempty"`
}

type ImageProperties struct {
	// Platform is the OCI platform object describing the platform of the image.
	//
	// Required: true
	Platform ocispec.Platform `json:"Platform"`

	Size struct {
		// Unpacked is the size (in bytes) of the locally unpacked
		// (uncompressed) image content that's directly usable by the containers
		// running this image.
		// It's independent of the distributable content - e.g.
		// the image might still have an unpacked data that's still used by
		// some container even when the distributable/compressed content is
		// already gone.
		//
		// Required: true
		Unpacked int64 `json:"Unpacked"`
	}

	// Containers is an array containing the IDs of the containers that are
	// using this image.
	//
	// Required: true
	Containers []string `json:"Containers"`
}

type AttestationProperties struct {
	// For is the digest of the image manifest that this attestation is for.
	For digest.Digest `json:"For"`
}
