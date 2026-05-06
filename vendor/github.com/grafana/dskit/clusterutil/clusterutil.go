package clusterutil

import (
	"context"
	"fmt"
	"net/http"

	"google.golang.org/grpc/metadata"
)

const (
	// ClusterValidationLabelHeader is the name of the cluster verification label HTTP header.
	ClusterValidationLabelHeader = "X-Cluster"

	// MetadataClusterValidationLabelKey is the key of the cluster validation label gRPC metadata.
	MetadataClusterValidationLabelKey = "x-cluster"
)

var (
	ErrNoClusterValidationLabel         = fmt.Errorf("no cluster validation label in context")
	ErrNoClusterValidationLabelInHeader = fmt.Errorf("no cluster validation label in request header")
	errDifferentClusterValidationLabels = func(clusterIDs []string) error {
		return fmt.Errorf("gRPC metadata should contain exactly 1 value for key %q, but it contains %v", MetadataClusterValidationLabelKey, clusterIDs)
	}
	errDifferentClusterValidationLabelsInHeader = func(clusterIDs []string) error {
		return fmt.Errorf("request header should contain exactly 1 value for key %q, but it contains %v", ClusterValidationLabelHeader, clusterIDs)
	}
)

// PutClusterIntoOutgoingContext returns a new context with the provided value for
// MetadataClusterValidationLabelKey, merged with any existing metadata in the context.
// Empty values are ignored.
func PutClusterIntoOutgoingContext(ctx context.Context, cluster string) context.Context {
	if cluster == "" {
		return ctx
	}
	return metadata.AppendToOutgoingContext(ctx, MetadataClusterValidationLabelKey, cluster)
}

// GetClusterFromIncomingContext returns a single metadata value corresponding to the
// MetadataClusterValidationLabelKey key from the incoming context, if it exists.
// In all other cases an error is returned.
func GetClusterFromIncomingContext(ctx context.Context) (string, error) {
	clusterIDs := metadata.ValueFromIncomingContext(ctx, MetadataClusterValidationLabelKey)
	if len(clusterIDs) > 1 {
		return "", errDifferentClusterValidationLabels(clusterIDs)
	}
	if len(clusterIDs) == 0 || clusterIDs[0] == "" {
		return "", ErrNoClusterValidationLabel
	}
	return clusterIDs[0], nil
}

// PutClusterIntoHeader enriches the given request's header with the provided value
// for the ClusterValidationLabelHeader key.
// Empty values are ignored.
func PutClusterIntoHeader(req *http.Request, cluster string) {
	if req == nil || cluster == "" {
		return
	}
	if req.Header == nil {
		req.Header = make(http.Header)
	}
	req.Header.Set(ClusterValidationLabelHeader, cluster)
}

// GetClusterFromRequest returns a single value corresponding to the ClusterValidationLabelHeader key
// from the header of the given request, if it exists.
// In all other cases an error is returned.
func GetClusterFromRequest(req *http.Request) (string, error) {
	clusterIDs := req.Header.Values(ClusterValidationLabelHeader)
	if len(clusterIDs) > 1 {
		return "", errDifferentClusterValidationLabelsInHeader(clusterIDs)
	}
	if len(clusterIDs) == 0 || clusterIDs[0] == "" {
		return "", ErrNoClusterValidationLabelInHeader
	}
	return clusterIDs[0], nil
}
