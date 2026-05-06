package customizations

import (
	"context"
	"fmt"
	"log"
	"net/url"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsmiddleware "github.com/aws/aws-sdk-go-v2/aws/middleware"
	"github.com/aws/aws-sdk-go-v2/service/internal/s3shared"
	internalendpoints "github.com/aws/aws-sdk-go-v2/service/s3/internal/endpoints"
	"github.com/aws/smithy-go/encoding/httpbinding"
	"github.com/aws/smithy-go/middleware"
	smithyhttp "github.com/aws/smithy-go/transport/http"
)

// EndpointResolver interface for resolving service endpoints.
type EndpointResolver interface {
	ResolveEndpoint(region string, options EndpointResolverOptions) (aws.Endpoint, error)
}

// EndpointResolverOptions is the service endpoint resolver options
type EndpointResolverOptions = internalendpoints.Options

// UpdateEndpointParameterAccessor represents accessor functions used by the middleware
type UpdateEndpointParameterAccessor struct {
	// functional pointer to fetch bucket name from provided input.
	// The function is intended to take an input value, and
	// return a string pointer to value of string, and bool if
	// input has no bucket member.
	GetBucketFromInput func(interface{}) (*string, bool)
}

// UpdateEndpointOptions provides the options for the UpdateEndpoint middleware setup.
type UpdateEndpointOptions struct {
	// Accessor are parameter accessors used by the middleware
	Accessor UpdateEndpointParameterAccessor

	// use path style
	UsePathStyle bool

	// use transfer acceleration
	UseAccelerate bool

	// indicates if an operation supports s3 transfer acceleration.
	SupportsAccelerate bool

	// use ARN region
	UseARNRegion bool

	// Indicates that the operation should target the s3-object-lambda endpoint.
	// Used to direct operations that do not route based on an input ARN.
	TargetS3ObjectLambda bool

	// EndpointResolver used to resolve endpoints. This may be a custom endpoint resolver
	EndpointResolver EndpointResolver

	// EndpointResolverOptions used by endpoint resolver
	EndpointResolverOptions EndpointResolverOptions

	// DisableMultiRegionAccessPoints indicates multi-region access point support is disabled
	DisableMultiRegionAccessPoints bool
}

// UpdateEndpoint adds the middleware to the middleware stack based on the UpdateEndpointOptions.
func UpdateEndpoint(stack *middleware.Stack, options UpdateEndpointOptions) (err error) {
	const serializerID = "OperationSerializer"

	// initial arn look up middleware
	err = stack.Initialize.Insert(&s3shared.ARNLookup{
		GetARNValue: options.Accessor.GetBucketFromInput,
	}, "legacyEndpointContextSetter", middleware.After)
	if err != nil {
		return err
	}

	// process arn
	err = stack.Serialize.Insert(&processARNResource{
		UseARNRegion:                   options.UseARNRegion,
		UseAccelerate:                  options.UseAccelerate,
		EndpointResolver:               options.EndpointResolver,
		EndpointResolverOptions:        options.EndpointResolverOptions,
		DisableMultiRegionAccessPoints: options.DisableMultiRegionAccessPoints,
	}, serializerID, middleware.Before)
	if err != nil {
		return err
	}

	// process whether the operation requires the s3-object-lambda endpoint
	// Occurs before operation serializer so that hostPrefix mutations
	// can be handled correctly.
	err = stack.Serialize.Insert(&s3ObjectLambdaEndpoint{
		UseEndpoint:             options.TargetS3ObjectLambda,
		UseAccelerate:           options.UseAccelerate,
		EndpointResolver:        options.EndpointResolver,
		EndpointResolverOptions: options.EndpointResolverOptions,
	}, serializerID, middleware.Before)
	if err != nil {
		return err
	}

	// remove bucket arn middleware
	err = stack.Serialize.Insert(&removeBucketFromPathMiddleware{}, serializerID, middleware.After)
	if err != nil {
		return err
	}

	// update endpoint to use options for path style and accelerate
	err = stack.Serialize.Insert(&updateEndpoint{
		usePathStyle:       options.UsePathStyle,
		getBucketFromInput: options.Accessor.GetBucketFromInput,
		useAccelerate:      options.UseAccelerate,
		supportsAccelerate: options.SupportsAccelerate,
	}, serializerID, middleware.After)
	if err != nil {
		return err
	}

	return err
}

type updateEndpoint struct {
	// path style options
	usePathStyle       bool
	getBucketFromInput func(interface{}) (*string, bool)

	// accelerate options
	useAccelerate      bool
	supportsAccelerate bool
}

// ID returns the middleware ID.
func (*updateEndpoint) ID() string {
	return "S3:UpdateEndpoint"
}

func (u *updateEndpoint) HandleSerialize(
	ctx context.Context, in middleware.SerializeInput, next middleware.SerializeHandler,
) (
	out middleware.SerializeOutput, metadata middleware.Metadata, err error,
) {
	if !awsmiddleware.GetRequiresLegacyEndpoints(ctx) {
		return next.HandleSerialize(ctx, in)
	}

	// if arn was processed, skip this middleware
	if _, ok := s3shared.GetARNResourceFromContext(ctx); ok {
		return next.HandleSerialize(ctx, in)
	}

	// skip this customization if host name is set as immutable
	if smithyhttp.GetHostnameImmutable(ctx) {
		return next.HandleSerialize(ctx, in)
	}

	req, ok := in.Request.(*smithyhttp.Request)
	if !ok {
		return out, metadata, fmt.Errorf("unknown request type %T", req)
	}

	// check if accelerate is supported
	if u.useAccelerate && !u.supportsAccelerate {
		// accelerate is not supported, thus will be ignored
		log.Println("Transfer acceleration is not supported for the operation, ignoring UseAccelerate.")
		u.useAccelerate = false
	}

	// transfer acceleration is not supported with path style urls
	if u.useAccelerate && u.usePathStyle {
		log.Println("UseAccelerate is not compatible with UsePathStyle, ignoring UsePathStyle.")
		u.usePathStyle = false
	}

	if u.getBucketFromInput != nil {
		// Below customization only apply if bucket name is provided
		bucket, ok := u.getBucketFromInput(in.Parameters)
		if ok && bucket != nil {
			region := awsmiddleware.GetRegion(ctx)
			if err := u.updateEndpointFromConfig(req, *bucket, region); err != nil {
				return out, metadata, err
			}
		}
	}

	return next.HandleSerialize(ctx, in)
}

func (u updateEndpoint) updateEndpointFromConfig(req *smithyhttp.Request, bucket string, region string) error {
	// do nothing if path style is enforced
	if u.usePathStyle {
		return nil
	}

	if !hostCompatibleBucketName(req.URL, bucket) {
		// bucket name must be valid to put into the host for accelerate operations.
		// For non-accelerate operations the bucket name can stay in the path if
		// not valid hostname.
		var err error
		if u.useAccelerate {
			err = fmt.Errorf("bucket name %s is not compatible with S3", bucket)
		}

		// No-Op if not using accelerate.
		return err
	}

	// accelerate is only supported if use path style is disabled
	if u.useAccelerate {
		parts := strings.Split(req.URL.Host, ".")
		if len(parts) < 3 {
			return fmt.Errorf("unable to update endpoint host for S3 accelerate, hostname invalid, %s", req.URL.Host)
		}

		if parts[0] == "s3" || strings.HasPrefix(parts[0], "s3-") {
			parts[0] = "s3-accelerate"
		}

		for i := 1; i+1 < len(parts); i++ {
			if strings.EqualFold(parts[i], region) {
				parts = append(parts[:i], parts[i+1:]...)
				break
			}
		}

		// construct the url host
		req.URL.Host = strings.Join(parts, ".")
	}

	// move bucket to follow virtual host style
	moveBucketNameToHost(req.URL, bucket)
	return nil
}

// updates endpoint to use virtual host styling
func moveBucketNameToHost(u *url.URL, bucket string) {
	u.Host = bucket + "." + u.Host
	removeBucketFromPath(u, bucket)
}

// remove bucket from url
func removeBucketFromPath(u *url.URL, bucket string) {
	if strings.HasPrefix(u.Path, "/"+bucket) {
		// modify url path
		u.Path = strings.Replace(u.Path, "/"+bucket, "", 1)

		// modify url raw path
		u.RawPath = strings.Replace(u.RawPath, "/"+httpbinding.EscapePath(bucket, true), "", 1)
	}

	if u.Path == "" {
		u.Path = "/"
	}

	if u.RawPath == "" {
		u.RawPath = "/"
	}
}

// hostCompatibleBucketName returns true if the request should
// put the bucket in the host. This is false if the bucket is not
// DNS compatible or the EndpointResolver resolves an aws.Endpoint with
// HostnameImmutable member set to true.
//
// https://pkg.go.dev/github.com/aws/aws-sdk-go-v2/aws#Endpoint.HostnameImmutable
func hostCompatibleBucketName(u *url.URL, bucket string) bool {
	// Bucket might be DNS compatible but dots in the hostname will fail
	// certificate validation, so do not use host-style.
	if u.Scheme == "https" && strings.Contains(bucket, ".") {
		return false
	}

	// if the bucket is DNS compatible
	return dnsCompatibleBucketName(bucket)
}

// dnsCompatibleBucketName returns true if the bucket name is DNS compatible.
// Buckets created outside of the classic region MUST be DNS compatible.
func dnsCompatibleBucketName(bucket string) bool {
	if strings.Contains(bucket, "..") {
		return false
	}

	// checks for `^[a-z0-9][a-z0-9\.\-]{1,61}[a-z0-9]$` domain mapping
	if !((bucket[0] > 96 && bucket[0] < 123) || (bucket[0] > 47 && bucket[0] < 58)) {
		return false
	}

	for _, c := range bucket[1:] {
		if !((c > 96 && c < 123) || (c > 47 && c < 58) || c == 46 || c == 45) {
			return false
		}
	}

	// checks for `^(\d+\.){3}\d+$` IPaddressing
	v := strings.SplitN(bucket, ".", -1)
	if len(v) == 4 {
		for _, c := range bucket {
			if !((c > 47 && c < 58) || c == 46) {
				// we confirm that this is not a IP address
				return true
			}
		}
		// this is a IP address
		return false
	}

	return true
}
