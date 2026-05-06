package customizations

import (
	"context"
	"fmt"

	ictx "github.com/aws/aws-sdk-go-v2/internal/context"
	"github.com/aws/aws-sdk-go-v2/service/internal/checksum"
	"github.com/aws/smithy-go/middleware"
)

type expressDefaultChecksumMiddleware struct{}

func (*expressDefaultChecksumMiddleware) ID() string {
	return "expressDefaultChecksum"
}

func (*expressDefaultChecksumMiddleware) HandleFinalize(
	ctx context.Context, in middleware.FinalizeInput, next middleware.FinalizeHandler,
) (
	out middleware.FinalizeOutput, metadata middleware.Metadata, err error,
) {
	if ictx.GetS3Backend(ctx) == ictx.S3BackendS3Express && ictx.GetChecksumInputAlgorithm(ctx) == "" {
		ctx = ictx.SetChecksumInputAlgorithm(ctx, string(checksum.AlgorithmCRC32))
	}
	return next.HandleFinalize(ctx, in)
}

// AddExpressDefaultChecksumMiddleware appends a step to default to CRC32 for
// S3Express requests. This should only be applied to operations where a
// checksum is required (e.g. DeleteObject).
func AddExpressDefaultChecksumMiddleware(s *middleware.Stack) error {
	err := s.Finalize.Insert(
		&expressDefaultChecksumMiddleware{},
		"AWSChecksum:ComputeInputPayloadChecksum",
		middleware.Before,
	)
	if err != nil {
		return fmt.Errorf("add expressDefaultChecksum: %v", err)
	}
	return nil
}
