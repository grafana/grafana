package image

import (
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/storage"
	ocispec "github.com/opencontainers/image-spec/specs-go/v1"
)

// RootFS returns Image's RootFS description including the layer IDs.
type RootFS struct {
	Type   string   `json:",omitempty"`
	Layers []string `json:",omitempty"`
}

// InspectResponse contains response of Engine API:
// GET "/images/{name:.*}/json"
type InspectResponse struct {
	// ID is the content-addressable ID of an image.
	//
	// This identifier is a content-addressable digest calculated from the
	// image's configuration (which includes the digests of layers used by
	// the image).
	//
	// Note that this digest differs from the `RepoDigests` below, which
	// holds digests of image manifests that reference the image.
	ID string `json:"Id"`

	// RepoTags is a list of image names/tags in the local image cache that
	// reference this image.
	//
	// Multiple image tags can refer to the same image, and this list may be
	// empty if no tags reference the image, in which case the image is
	// "untagged", in which case it can still be referenced by its ID.
	RepoTags []string

	// RepoDigests is a list of content-addressable digests of locally available
	// image manifests that the image is referenced from. Multiple manifests can
	// refer to the same image.
	//
	// These digests are usually only available if the image was either pulled
	// from a registry, or if the image was pushed to a registry, which is when
	// the manifest is generated and its digest calculated.
	RepoDigests []string

	// Parent is the ID of the parent image.
	//
	// Depending on how the image was created, this field may be empty and
	// is only set for images that were built/created locally. This field
	// is empty if the image was pulled from an image registry.
	Parent string

	// Comment is an optional message that can be set when committing or
	// importing the image.
	Comment string

	// Created is the date and time at which the image was created, formatted in
	// RFC 3339 nano-seconds (time.RFC3339Nano).
	//
	// This information is only available if present in the image,
	// and omitted otherwise.
	Created string `json:",omitempty"`

	// Container is the ID of the container that was used to create the image.
	//
	// Depending on how the image was created, this field may be empty.
	//
	// Deprecated: this field is omitted in API v1.45, but kept for backward compatibility.
	Container string `json:",omitempty"`

	// ContainerConfig is an optional field containing the configuration of the
	// container that was last committed when creating the image.
	//
	// Previous versions of Docker builder used this field to store build cache,
	// and it is not in active use anymore.
	//
	// Deprecated: this field is omitted in API v1.45, but kept for backward compatibility.
	ContainerConfig *container.Config `json:",omitempty"`

	// DockerVersion is the version of Docker that was used to build the image.
	//
	// Depending on how the image was created, this field may be empty.
	DockerVersion string

	// Author is the name of the author that was specified when committing the
	// image, or as specified through MAINTAINER (deprecated) in the Dockerfile.
	Author string
	Config *container.Config

	// Architecture is the hardware CPU architecture that the image runs on.
	Architecture string

	// Variant is the CPU architecture variant (presently ARM-only).
	Variant string `json:",omitempty"`

	// OS is the Operating System the image is built to run on.
	Os string

	// OsVersion is the version of the Operating System the image is built to
	// run on (especially for Windows).
	OsVersion string `json:",omitempty"`

	// Size is the total size of the image including all layers it is composed of.
	Size int64

	// VirtualSize is the total size of the image including all layers it is
	// composed of.
	//
	// Deprecated: this field is omitted in API v1.44, but kept for backward compatibility. Use Size instead.
	VirtualSize int64 `json:"VirtualSize,omitempty"`

	// GraphDriver holds information about the storage driver used to store the
	// container's and image's filesystem.
	GraphDriver storage.DriverData

	// RootFS contains information about the image's RootFS, including the
	// layer IDs.
	RootFS RootFS

	// Metadata of the image in the local cache.
	//
	// This information is local to the daemon, and not part of the image itself.
	Metadata Metadata

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
	// Only available if the daemon provides a multi-platform image store.
	//
	// WARNING: This is experimental and may change at any time without any backward
	// compatibility.
	Manifests []ManifestSummary `json:"Manifests,omitempty"`
}
