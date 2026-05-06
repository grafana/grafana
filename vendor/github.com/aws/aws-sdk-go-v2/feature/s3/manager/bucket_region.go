package manager

import (
	"context"
	"errors"
	"fmt"
	"net/http"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/smithy-go/middleware"
	smithyhttp "github.com/aws/smithy-go/transport/http"
)

const bucketRegionHeader = "X-Amz-Bucket-Region"

// GetBucketRegion will attempt to get the region for a bucket using the
// client's configured region to determine which AWS partition to perform the query on.
//
// A BucketNotFound error will be returned if the bucket does not exist in the
// AWS partition the client region belongs to.
//
// For example to get the region of a bucket which exists in "eu-central-1"
// you could provide a region hint of "us-west-2".
//
//	cfg, err := config.LoadDefaultConfig(context.TODO(), config.WithRegion("us-west-2"))
//	if err != nil {
//		log.Println("error:", err)
//		return
//	}
//
//	bucket := "my-bucket"
//	region, err := manager.GetBucketRegion(ctx, s3.NewFromConfig(cfg), bucket)
//	if err != nil {
//		var bnf manager.BucketNotFound
//		if errors.As(err, &bnf) {
//			fmt.Fprintf(os.Stderr, "unable to find bucket %s's region\n", bucket)
//		}
//		return
//	}
//	fmt.Printf("Bucket %s is in %s region\n", bucket, region)
//
// By default the request will be made to the Amazon S3 endpoint using the virtual-hosted-style addressing.
//
//	bucketname.s3.us-west-2.amazonaws.com/
//
// To configure the GetBucketRegion to make a request via the Amazon
// S3 FIPS endpoints directly when a FIPS region name is not available, (e.g.
// fips-us-gov-west-1) set the EndpointResolver on the config or client the
// utility is called with.
//
//	cfg, err := config.LoadDefaultConfig(context.TODO(),
//		config.WithEndpointResolver(
//			aws.EndpointResolverFunc(func(service, region string) (aws.Endpoint, error) {
//				return aws.Endpoint{URL: "https://s3-fips.us-west-2.amazonaws.com"}, nil
//			}),
//	)
//	if err != nil {
//		panic(err)
//	}
//
// If buckets are public, you may use anonymous credential like so.
//
//	manager.GetBucketRegion(ctx, s3.NewFromConfig(cfg), bucket, func(o *s3.Options) {
//	     o.Credentials = nil
//	     // Or
//	     o.Credentials = aws.AnonymousCredentials{}
//	})
//
// The request with anonymous credentials will not be signed.
// Otherwise credentials would be required for private buckets.
func GetBucketRegion(ctx context.Context, client HeadBucketAPIClient, bucket string, optFns ...func(*s3.Options)) (string, error) {
	var captureBucketRegion deserializeBucketRegion

	clientOptionFns := make([]func(*s3.Options), len(optFns)+1)
	clientOptionFns[0] = func(options *s3.Options) {
		options.APIOptions = append(options.APIOptions, captureBucketRegion.RegisterMiddleware)
	}
	copy(clientOptionFns[1:], optFns)

	_, err := client.HeadBucket(ctx, &s3.HeadBucketInput{
		Bucket: aws.String(bucket),
	}, clientOptionFns...)
	if len(captureBucketRegion.BucketRegion) == 0 && err != nil {
		var httpStatusErr interface {
			HTTPStatusCode() int
		}
		if !errors.As(err, &httpStatusErr) {
			return "", err
		}

		if httpStatusErr.HTTPStatusCode() == http.StatusNotFound {
			return "", &bucketNotFound{}
		}

		return "", err
	}

	return captureBucketRegion.BucketRegion, nil
}

type deserializeBucketRegion struct {
	BucketRegion string
}

func (d *deserializeBucketRegion) RegisterMiddleware(stack *middleware.Stack) error {
	return stack.Deserialize.Add(d, middleware.After)
}

func (d *deserializeBucketRegion) ID() string {
	return "DeserializeBucketRegion"
}

func (d *deserializeBucketRegion) HandleDeserialize(ctx context.Context, in middleware.DeserializeInput, next middleware.DeserializeHandler) (
	out middleware.DeserializeOutput, metadata middleware.Metadata, err error,
) {
	out, metadata, err = next.HandleDeserialize(ctx, in)
	if err != nil {
		return out, metadata, err
	}

	resp, ok := out.RawResponse.(*smithyhttp.Response)
	if !ok {
		return out, metadata, fmt.Errorf("unknown transport type %T", out.RawResponse)
	}

	d.BucketRegion = resp.Header.Get(bucketRegionHeader)

	return out, metadata, err
}

// BucketNotFound indicates the bucket was not found in the partition when calling GetBucketRegion.
type BucketNotFound interface {
	error

	isBucketNotFound()
}

type bucketNotFound struct{}

func (b *bucketNotFound) Error() string {
	return "bucket not found"
}

func (b *bucketNotFound) isBucketNotFound() {}

var _ BucketNotFound = (*bucketNotFound)(nil)
