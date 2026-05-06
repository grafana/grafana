package middleware

import (
	"github.com/aws/smithy-go/middleware"
)

// requestIDKey is used to retrieve request id from response metadata
type requestIDKey struct{}

// SetRequestIDMetadata sets the provided request id over middleware metadata
func SetRequestIDMetadata(metadata *middleware.Metadata, id string) {
	metadata.Set(requestIDKey{}, id)
}

// GetRequestIDMetadata retrieves the request id from middleware metadata
// returns string and bool indicating value of request id, whether request id was set.
func GetRequestIDMetadata(metadata middleware.Metadata) (string, bool) {
	if !metadata.Has(requestIDKey{}) {
		return "", false
	}

	v, ok := metadata.Get(requestIDKey{}).(string)
	if !ok {
		return "", true
	}
	return v, true
}
