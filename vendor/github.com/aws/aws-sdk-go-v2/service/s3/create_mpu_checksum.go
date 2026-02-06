package s3

import (
	"context"
	"fmt"

	internalcontext "github.com/aws/aws-sdk-go-v2/internal/context"
	"github.com/aws/smithy-go/middleware"
)

// backfills checksum algorithm onto the context for CreateMultipart upload so
// transfer manager can set a checksum header on the request accordingly for
// s3express requests
type setCreateMPUChecksumAlgorithm struct{}

func (*setCreateMPUChecksumAlgorithm) ID() string {
	return "setCreateMPUChecksumAlgorithm"
}

func (*setCreateMPUChecksumAlgorithm) HandleSerialize(
	ctx context.Context, in middleware.SerializeInput, next middleware.SerializeHandler,
) (
	out middleware.SerializeOutput, metadata middleware.Metadata, err error,
) {
	input, ok := in.Parameters.(*CreateMultipartUploadInput)
	if !ok {
		return out, metadata, fmt.Errorf("unexpected input type %T", in.Parameters)
	}

	ctx = internalcontext.SetChecksumInputAlgorithm(ctx, string(input.ChecksumAlgorithm))
	return next.HandleSerialize(ctx, in)
}

func addSetCreateMPUChecksumAlgorithm(s *middleware.Stack) error {
	return s.Serialize.Add(&setCreateMPUChecksumAlgorithm{}, middleware.Before)
}
