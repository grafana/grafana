package grpcutil

import (
	"context"
	"strconv"

	"google.golang.org/grpc/metadata"
)

// MetadataMessageSize is grpc metadata key for message size.
const MetadataMessageSize = "message-size"

// Sizer can return its size in bytes.
type Sizer interface {
	Size() int
}

func AppendMessageSizeToOutgoingContext(ctx context.Context, req Sizer) context.Context {
	return metadata.AppendToOutgoingContext(ctx, MetadataMessageSize, strconv.Itoa(req.Size()))
}
