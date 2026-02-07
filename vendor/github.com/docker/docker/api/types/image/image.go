package image

import (
	"io"
	"time"
)

// Metadata contains engine-local data about the image.
type Metadata struct {
	// LastTagTime is the date and time at which the image was last tagged.
	LastTagTime time.Time `json:",omitempty"`
}

// PruneReport contains the response for Engine API:
// POST "/images/prune"
type PruneReport struct {
	ImagesDeleted  []DeleteResponse
	SpaceReclaimed uint64
}

// LoadResponse returns information to the client about a load process.
//
// TODO(thaJeztah): remove this type, and just use an io.ReadCloser
//
// This type was added in https://github.com/moby/moby/pull/18878, related
// to https://github.com/moby/moby/issues/19177;
//
// Make docker load to output json when the response content type is json
// Swarm hijacks the response from docker load and returns JSON rather
// than plain text like the Engine does. This makes the API library to return
// information to figure that out.
//
// However the "load" endpoint unconditionally returns JSON;
// https://github.com/moby/moby/blob/7b9d2ef6e5518a3d3f3cc418459f8df786cfbbd1/api/server/router/image/image_routes.go#L248-L255
//
// PR https://github.com/moby/moby/pull/21959 made the response-type depend
// on whether "quiet" was set, but this logic got changed in a follow-up
// https://github.com/moby/moby/pull/25557, which made the JSON response-type
// unconditionally, but the output produced depend on whether"quiet" was set.
//
// We should deprecated the "quiet" option, as it's really a client
// responsibility.
type LoadResponse struct {
	// Body must be closed to avoid a resource leak
	Body io.ReadCloser
	JSON bool
}
