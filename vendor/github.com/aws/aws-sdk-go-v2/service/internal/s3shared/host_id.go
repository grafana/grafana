package s3shared

import (
	"github.com/aws/smithy-go/middleware"
)

// hostID is used to retrieve host id from response metadata
type hostID struct {
}

// SetHostIDMetadata sets the provided host id over middleware metadata
func SetHostIDMetadata(metadata *middleware.Metadata, id string) {
	metadata.Set(hostID{}, id)
}

// GetHostIDMetadata retrieves the host id from middleware metadata
// returns host id as string along with a boolean indicating presence of
// hostId on middleware metadata.
func GetHostIDMetadata(metadata middleware.Metadata) (string, bool) {
	if !metadata.Has(hostID{}) {
		return "", false
	}

	v, ok := metadata.Get(hostID{}).(string)
	if !ok {
		return "", true
	}
	return v, true
}
