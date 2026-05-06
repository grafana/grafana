package authz

import (
	"context"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
)

type ServerInterface interface {
	Check(ctx context.Context, req *openfgav1.CheckRequest) (*openfgav1.CheckResponse, error)
	ListObjects(ctx context.Context, req *openfgav1.ListObjectsRequest) (*openfgav1.ListObjectsResponse, error)
}
