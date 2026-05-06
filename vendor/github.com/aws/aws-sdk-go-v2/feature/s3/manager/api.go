package manager

import (
	"context"

	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// DeleteObjectsAPIClient is an S3 API client that can invoke the DeleteObjects operation.
type DeleteObjectsAPIClient interface {
	DeleteObjects(context.Context, *s3.DeleteObjectsInput, ...func(*s3.Options)) (*s3.DeleteObjectsOutput, error)
}

// DownloadAPIClient is an S3 API client that can invoke the GetObject operation.
type DownloadAPIClient interface {
	GetObject(context.Context, *s3.GetObjectInput, ...func(*s3.Options)) (*s3.GetObjectOutput, error)
}

// HeadBucketAPIClient is an S3 API client that can invoke the HeadBucket operation.
type HeadBucketAPIClient interface {
	HeadBucket(context.Context, *s3.HeadBucketInput, ...func(*s3.Options)) (*s3.HeadBucketOutput, error)
}

// ListObjectsV2APIClient is an S3 API client that can invoke the ListObjectV2 operation.
type ListObjectsV2APIClient interface {
	ListObjectsV2(context.Context, *s3.ListObjectsV2Input, ...func(*s3.Options)) (*s3.ListObjectsV2Output, error)
}

// UploadAPIClient is an S3 API client that can invoke PutObject, UploadPart, CreateMultipartUpload,
// CompleteMultipartUpload, and AbortMultipartUpload operations.
type UploadAPIClient interface {
	PutObject(context.Context, *s3.PutObjectInput, ...func(*s3.Options)) (*s3.PutObjectOutput, error)
	UploadPart(context.Context, *s3.UploadPartInput, ...func(*s3.Options)) (*s3.UploadPartOutput, error)
	CreateMultipartUpload(context.Context, *s3.CreateMultipartUploadInput, ...func(*s3.Options)) (*s3.CreateMultipartUploadOutput, error)
	CompleteMultipartUpload(context.Context, *s3.CompleteMultipartUploadInput, ...func(*s3.Options)) (*s3.CompleteMultipartUploadOutput, error)
	AbortMultipartUpload(context.Context, *s3.AbortMultipartUploadInput, ...func(*s3.Options)) (*s3.AbortMultipartUploadOutput, error)
}
