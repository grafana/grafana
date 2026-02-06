package s3

import (
	"github.com/aws/aws-sdk-go-v2/service/s3/internal/customizations"
)

// ExpressCredentialsProvider retrieves credentials for operations against the
// S3Express storage class.
type ExpressCredentialsProvider = customizations.S3ExpressCredentialsProvider
