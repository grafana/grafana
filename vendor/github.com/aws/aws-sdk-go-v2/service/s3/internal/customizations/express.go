package customizations

import (
	"context"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/aws"
	internalauthsmithy "github.com/aws/aws-sdk-go-v2/internal/auth/smithy"
	"github.com/aws/smithy-go"
	"github.com/aws/smithy-go/auth"
)

// S3ExpressCredentialsProvider retrieves credentials for the S3Express storage
// class.
type S3ExpressCredentialsProvider interface {
	Retrieve(ctx context.Context, bucket string) (aws.Credentials, error)
}

// ExpressIdentityResolver retrieves identity for the S3Express storage class.
type ExpressIdentityResolver struct {
	Provider S3ExpressCredentialsProvider
}

var _ (auth.IdentityResolver) = (*ExpressIdentityResolver)(nil)

// GetIdentity retrieves AWS credentials using the underlying provider.
func (v *ExpressIdentityResolver) GetIdentity(ctx context.Context, props smithy.Properties) (
	auth.Identity, error,
) {
	bucket, ok := GetIdentityPropertiesBucket(&props)
	if !ok {
		bucket = GetBucket(ctx)
	}
	if bucket == "" {
		return nil, fmt.Errorf("bucket name is missing")
	}

	creds, err := v.Provider.Retrieve(ctx, bucket)
	if err != nil {
		return nil, fmt.Errorf("get credentials: %v", err)
	}

	return &internalauthsmithy.CredentialsAdapter{Credentials: creds}, nil
}
