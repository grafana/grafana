package customizations

import (
	"context"
	"fmt"
	"github.com/aws/aws-sdk-go-v2/aws"
	awsmiddleware "github.com/aws/aws-sdk-go-v2/aws/middleware"
	"github.com/aws/smithy-go/middleware"
	"github.com/aws/smithy-go/transport/http"
	"net/url"
)

type s3ObjectLambdaEndpoint struct {
	// whether the operation should use the s3-object-lambda endpoint
	UseEndpoint bool

	// use transfer acceleration
	UseAccelerate bool

	EndpointResolver        EndpointResolver
	EndpointResolverOptions EndpointResolverOptions
}

func (t *s3ObjectLambdaEndpoint) ID() string {
	return "S3:ObjectLambdaEndpoint"
}

func (t *s3ObjectLambdaEndpoint) HandleSerialize(
	ctx context.Context, in middleware.SerializeInput, next middleware.SerializeHandler,
) (
	out middleware.SerializeOutput, metadata middleware.Metadata, err error,
) {
	if !awsmiddleware.GetRequiresLegacyEndpoints(ctx) {
		return next.HandleSerialize(ctx, in)
	}

	if !t.UseEndpoint {
		return next.HandleSerialize(ctx, in)
	}

	req, ok := in.Request.(*http.Request)
	if !ok {
		return out, metadata, fmt.Errorf("unknown transport type: %T", in.Request)
	}

	if t.EndpointResolverOptions.UseDualStackEndpoint == aws.DualStackEndpointStateEnabled {
		return out, metadata, fmt.Errorf("client configured for dualstack but not supported for operation")
	}

	if t.UseAccelerate {
		return out, metadata, fmt.Errorf("client configured for accelerate but not supported for operation")
	}

	region := awsmiddleware.GetRegion(ctx)

	ero := t.EndpointResolverOptions

	endpoint, err := t.EndpointResolver.ResolveEndpoint(region, ero)
	if err != nil {
		return out, metadata, err
	}

	// Set the ServiceID and SigningName
	ctx = awsmiddleware.SetServiceID(ctx, s3ObjectLambda)

	if len(endpoint.SigningName) > 0 && endpoint.Source == aws.EndpointSourceCustom {
		ctx = awsmiddleware.SetSigningName(ctx, endpoint.SigningName)
	} else {
		ctx = awsmiddleware.SetSigningName(ctx, s3ObjectLambda)
	}

	req.URL, err = url.Parse(endpoint.URL)
	if err != nil {
		return out, metadata, err
	}

	if len(endpoint.SigningRegion) > 0 {
		ctx = awsmiddleware.SetSigningRegion(ctx, endpoint.SigningRegion)
	} else {
		ctx = awsmiddleware.SetSigningRegion(ctx, region)
	}

	if endpoint.Source == aws.EndpointSourceServiceMetadata || !endpoint.HostnameImmutable {
		updateS3HostForS3ObjectLambda(req)
	}

	return next.HandleSerialize(ctx, in)
}
