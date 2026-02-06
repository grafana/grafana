package customizations

import (
	"context"
	"fmt"
	"net/url"
	"strings"

	"github.com/aws/smithy-go/middleware"
	"github.com/aws/smithy-go/transport/http"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsmiddleware "github.com/aws/aws-sdk-go-v2/aws/middleware"
	"github.com/aws/aws-sdk-go-v2/internal/v4a"
	"github.com/aws/aws-sdk-go-v2/service/internal/s3shared"
	"github.com/aws/aws-sdk-go-v2/service/internal/s3shared/arn"
	s3arn "github.com/aws/aws-sdk-go-v2/service/s3/internal/arn"
	"github.com/aws/aws-sdk-go-v2/service/s3/internal/endpoints"
)

const (
	s3AccessPoint  = "s3-accesspoint"
	s3ObjectLambda = "s3-object-lambda"
)

// processARNResource is used to process an ARN resource.
type processARNResource struct {

	// UseARNRegion indicates if region parsed from an ARN should be used.
	UseARNRegion bool

	// UseAccelerate indicates if s3 transfer acceleration is enabled
	UseAccelerate bool

	// EndpointResolver used to resolve endpoints. This may be a custom endpoint resolver
	EndpointResolver EndpointResolver

	// EndpointResolverOptions used by endpoint resolver
	EndpointResolverOptions EndpointResolverOptions

	// DisableMultiRegionAccessPoints indicates multi-region access point support is disabled
	DisableMultiRegionAccessPoints bool
}

// ID returns the middleware ID.
func (*processARNResource) ID() string { return "S3:ProcessARNResource" }

func (m *processARNResource) HandleSerialize(
	ctx context.Context, in middleware.SerializeInput, next middleware.SerializeHandler,
) (
	out middleware.SerializeOutput, metadata middleware.Metadata, err error,
) {
	if !awsmiddleware.GetRequiresLegacyEndpoints(ctx) {
		return next.HandleSerialize(ctx, in)
	}

	// check if arn was provided, if not skip this middleware
	arnValue, ok := s3shared.GetARNResourceFromContext(ctx)
	if !ok {
		return next.HandleSerialize(ctx, in)
	}

	req, ok := in.Request.(*http.Request)
	if !ok {
		return out, metadata, fmt.Errorf("unknown request type %T", req)
	}

	// parse arn into an endpoint arn wrt to service
	resource, err := s3arn.ParseEndpointARN(arnValue)
	if err != nil {
		return out, metadata, err
	}

	// build a resource request struct
	resourceRequest := s3shared.ResourceRequest{
		Resource:      resource,
		UseARNRegion:  m.UseARNRegion,
		UseFIPS:       m.EndpointResolverOptions.UseFIPSEndpoint == aws.FIPSEndpointStateEnabled,
		RequestRegion: awsmiddleware.GetRegion(ctx),
		SigningRegion: awsmiddleware.GetSigningRegion(ctx),
		PartitionID:   awsmiddleware.GetPartitionID(ctx),
	}

	// switch to correct endpoint updater
	switch tv := resource.(type) {
	case arn.AccessPointARN:
		// multi-region arns do not need to validate for cross partition request
		if len(tv.Region) != 0 {
			// validate resource request
			if err := validateRegionForResourceRequest(resourceRequest); err != nil {
				return out, metadata, err
			}
		}

		// Special handling for region-less ap-arns.
		if len(tv.Region) == 0 {
			// check if multi-region arn support is disabled
			if m.DisableMultiRegionAccessPoints {
				return out, metadata, fmt.Errorf("Invalid configuration, Multi-Region access point ARNs are disabled")
			}

			// Do not allow dual-stack configuration with multi-region arns.
			if m.EndpointResolverOptions.UseDualStackEndpoint == aws.DualStackEndpointStateEnabled {
				return out, metadata, s3shared.NewClientConfiguredForDualStackError(tv,
					resourceRequest.PartitionID, resourceRequest.RequestRegion, nil)
			}
		}

		// check if accelerate
		if m.UseAccelerate {
			return out, metadata, s3shared.NewClientConfiguredForAccelerateError(tv,
				resourceRequest.PartitionID, resourceRequest.RequestRegion, nil)
		}

		// fetch arn region to resolve request
		resolveRegion := tv.Region
		// check if request region is FIPS
		if resourceRequest.UseFIPS && len(resolveRegion) == 0 {
			// Do not allow Fips support within multi-region arns.
			return out, metadata, s3shared.NewClientConfiguredForFIPSError(
				tv, resourceRequest.PartitionID, resourceRequest.RequestRegion, nil)
		}

		var requestBuilder func(context.Context, accesspointOptions) (context.Context, error)
		if len(resolveRegion) == 0 {
			requestBuilder = buildMultiRegionAccessPointsRequest
		} else {
			requestBuilder = buildAccessPointRequest
		}

		// build request as per accesspoint builder
		ctx, err = requestBuilder(ctx, accesspointOptions{
			processARNResource: *m,
			request:            req,
			resource:           tv,
			resolveRegion:      resolveRegion,
			partitionID:        resourceRequest.PartitionID,
			requestRegion:      resourceRequest.RequestRegion,
		})
		if err != nil {
			return out, metadata, err
		}

	case arn.S3ObjectLambdaAccessPointARN:
		// validate region for resource request
		if err := validateRegionForResourceRequest(resourceRequest); err != nil {
			return out, metadata, err
		}

		// check if accelerate
		if m.UseAccelerate {
			return out, metadata, s3shared.NewClientConfiguredForAccelerateError(tv,
				resourceRequest.PartitionID, resourceRequest.RequestRegion, nil)
		}

		// check if dualstack
		if m.EndpointResolverOptions.UseDualStackEndpoint == aws.DualStackEndpointStateEnabled {
			return out, metadata, s3shared.NewClientConfiguredForDualStackError(tv,
				resourceRequest.PartitionID, resourceRequest.RequestRegion, nil)
		}

		// fetch arn region to resolve request
		resolveRegion := tv.Region

		// build access point request
		ctx, err = buildS3ObjectLambdaAccessPointRequest(ctx, accesspointOptions{
			processARNResource: *m,
			request:            req,
			resource:           tv.AccessPointARN,
			resolveRegion:      resolveRegion,
			partitionID:        resourceRequest.PartitionID,
			requestRegion:      resourceRequest.RequestRegion,
		})
		if err != nil {
			return out, metadata, err
		}

	// process outpost accesspoint ARN
	case arn.OutpostAccessPointARN:
		// validate region for resource request
		if err := validateRegionForResourceRequest(resourceRequest); err != nil {
			return out, metadata, err
		}

		// check if accelerate
		if m.UseAccelerate {
			return out, metadata, s3shared.NewClientConfiguredForAccelerateError(tv,
				resourceRequest.PartitionID, resourceRequest.RequestRegion, nil)
		}

		// check if dual stack
		if m.EndpointResolverOptions.UseDualStackEndpoint == aws.DualStackEndpointStateEnabled {
			return out, metadata, s3shared.NewClientConfiguredForDualStackError(tv,
				resourceRequest.PartitionID, resourceRequest.RequestRegion, nil)
		}

		// check if request region is FIPS
		if resourceRequest.UseFIPS {
			return out, metadata, s3shared.NewFIPSConfigurationError(tv, resourceRequest.PartitionID,
				resourceRequest.RequestRegion, nil)
		}

		// build outpost access point request
		ctx, err = buildOutpostAccessPointRequest(ctx, outpostAccessPointOptions{
			processARNResource: *m,
			resource:           tv,
			request:            req,
			partitionID:        resourceRequest.PartitionID,
			requestRegion:      resourceRequest.RequestRegion,
		})
		if err != nil {
			return out, metadata, err
		}

	default:
		return out, metadata, s3shared.NewInvalidARNError(resource, nil)
	}

	return next.HandleSerialize(ctx, in)
}

// validate if s3 resource and request region config is compatible.
func validateRegionForResourceRequest(resourceRequest s3shared.ResourceRequest) error {
	// check if resourceRequest leads to a cross partition error
	v, err := resourceRequest.IsCrossPartition()
	if err != nil {
		return err
	}
	if v {
		// if cross partition
		return s3shared.NewClientPartitionMismatchError(resourceRequest.Resource,
			resourceRequest.PartitionID, resourceRequest.RequestRegion, nil)
	}

	// check if resourceRequest leads to a cross region error
	if !resourceRequest.AllowCrossRegion() && resourceRequest.IsCrossRegion() {
		// if cross region, but not use ARN region is not enabled
		return s3shared.NewClientRegionMismatchError(resourceRequest.Resource,
			resourceRequest.PartitionID, resourceRequest.RequestRegion, nil)
	}

	return nil
}

// === Accesspoint ==========

type accesspointOptions struct {
	processARNResource
	request       *http.Request
	resource      arn.AccessPointARN
	resolveRegion string
	partitionID   string
	requestRegion string
}

func buildAccessPointRequest(ctx context.Context, options accesspointOptions) (context.Context, error) {
	tv := options.resource
	req := options.request
	resolveRegion := options.resolveRegion

	resolveService := tv.Service

	ero := options.EndpointResolverOptions
	ero.Logger = middleware.GetLogger(ctx)
	ero.ResolvedRegion = "" // clear endpoint option's resolved region so that we resolve using the passed in region

	// resolve endpoint
	endpoint, err := options.EndpointResolver.ResolveEndpoint(resolveRegion, ero)
	if err != nil {
		return ctx, s3shared.NewFailedToResolveEndpointError(
			tv,
			options.partitionID,
			options.requestRegion,
			err,
		)
	}

	// assign resolved endpoint url to request url
	req.URL, err = url.Parse(endpoint.URL)
	if err != nil {
		return ctx, fmt.Errorf("failed to parse endpoint URL: %w", err)
	}

	if len(endpoint.SigningName) != 0 && endpoint.Source == aws.EndpointSourceCustom {
		ctx = awsmiddleware.SetSigningName(ctx, endpoint.SigningName)
	} else {
		// Must sign with s3-object-lambda
		ctx = awsmiddleware.SetSigningName(ctx, resolveService)
	}

	if len(endpoint.SigningRegion) != 0 {
		ctx = awsmiddleware.SetSigningRegion(ctx, endpoint.SigningRegion)
	} else {
		ctx = awsmiddleware.SetSigningRegion(ctx, resolveRegion)
	}

	// update serviceID to "s3-accesspoint"
	ctx = awsmiddleware.SetServiceID(ctx, s3AccessPoint)

	// disable host prefix behavior
	ctx = http.DisableEndpointHostPrefix(ctx, true)

	// remove the serialized arn in place of /{Bucket}
	ctx = setBucketToRemoveOnContext(ctx, tv.String())

	// skip arn processing, if arn region resolves to a immutable endpoint
	if endpoint.HostnameImmutable {
		return ctx, nil
	}

	updateS3HostForS3AccessPoint(req)

	ctx, err = buildAccessPointHostPrefix(ctx, req, tv)
	if err != nil {
		return ctx, err
	}

	return ctx, nil
}

func buildS3ObjectLambdaAccessPointRequest(ctx context.Context, options accesspointOptions) (context.Context, error) {
	tv := options.resource
	req := options.request
	resolveRegion := options.resolveRegion

	resolveService := tv.Service

	ero := options.EndpointResolverOptions
	ero.Logger = middleware.GetLogger(ctx)
	ero.ResolvedRegion = "" // clear endpoint options resolved region so we resolve the passed in region

	// resolve endpoint
	endpoint, err := options.EndpointResolver.ResolveEndpoint(resolveRegion, ero)
	if err != nil {
		return ctx, s3shared.NewFailedToResolveEndpointError(
			tv,
			options.partitionID,
			options.requestRegion,
			err,
		)
	}

	// assign resolved endpoint url to request url
	req.URL, err = url.Parse(endpoint.URL)
	if err != nil {
		return ctx, fmt.Errorf("failed to parse endpoint URL: %w", err)
	}

	if len(endpoint.SigningName) != 0 && endpoint.Source == aws.EndpointSourceCustom {
		ctx = awsmiddleware.SetSigningName(ctx, endpoint.SigningName)
	} else {
		// Must sign with s3-object-lambda
		ctx = awsmiddleware.SetSigningName(ctx, resolveService)
	}

	if len(endpoint.SigningRegion) != 0 {
		ctx = awsmiddleware.SetSigningRegion(ctx, endpoint.SigningRegion)
	} else {
		ctx = awsmiddleware.SetSigningRegion(ctx, resolveRegion)
	}

	// update serviceID to "s3-object-lambda"
	ctx = awsmiddleware.SetServiceID(ctx, s3ObjectLambda)

	// disable host prefix behavior
	ctx = http.DisableEndpointHostPrefix(ctx, true)

	// remove the serialized arn in place of /{Bucket}
	ctx = setBucketToRemoveOnContext(ctx, tv.String())

	// skip arn processing, if arn region resolves to a immutable endpoint
	if endpoint.HostnameImmutable {
		return ctx, nil
	}

	if endpoint.Source == aws.EndpointSourceServiceMetadata {
		updateS3HostForS3ObjectLambda(req)
	}

	ctx, err = buildAccessPointHostPrefix(ctx, req, tv)
	if err != nil {
		return ctx, err
	}

	return ctx, nil
}

func buildMultiRegionAccessPointsRequest(ctx context.Context, options accesspointOptions) (context.Context, error) {
	const s3GlobalLabel = "s3-global."
	const accesspointLabel = "accesspoint."

	tv := options.resource
	req := options.request
	resolveService := tv.Service
	resolveRegion := options.requestRegion
	arnPartition := tv.Partition

	// resolve endpoint
	ero := options.EndpointResolverOptions
	ero.Logger = middleware.GetLogger(ctx)

	endpoint, err := options.EndpointResolver.ResolveEndpoint(resolveRegion, ero)
	if err != nil {
		return ctx, s3shared.NewFailedToResolveEndpointError(
			tv,
			options.partitionID,
			options.requestRegion,
			err,
		)
	}

	// set signing region and version for MRAP
	endpoint.SigningRegion = "*"
	ctx = awsmiddleware.SetSigningRegion(ctx, endpoint.SigningRegion)
	ctx = SetSignerVersion(ctx, v4a.Version)

	if len(endpoint.SigningName) != 0 {
		ctx = awsmiddleware.SetSigningName(ctx, endpoint.SigningName)
	} else {
		ctx = awsmiddleware.SetSigningName(ctx, resolveService)
	}

	// skip arn processing, if arn region resolves to a immutable endpoint
	if endpoint.HostnameImmutable {
		return ctx, nil
	}

	// modify endpoint host to use s3-global host prefix
	scheme := strings.SplitN(endpoint.URL, "://", 2)
	dnsSuffix, err := endpoints.GetDNSSuffix(arnPartition, ero)
	if err != nil {
		return ctx, fmt.Errorf("Error determining dns suffix from arn partition, %w", err)
	}
	// set url as per partition
	endpoint.URL = scheme[0] + "://" + s3GlobalLabel + dnsSuffix

	// assign resolved endpoint url to request url
	req.URL, err = url.Parse(endpoint.URL)
	if err != nil {
		return ctx, fmt.Errorf("failed to parse endpoint URL: %w", err)
	}

	// build access point host prefix
	accessPointHostPrefix := tv.AccessPointName + "." + accesspointLabel

	// add host prefix to url
	req.URL.Host = accessPointHostPrefix + req.URL.Host
	if len(req.Host) > 0 {
		req.Host = accessPointHostPrefix + req.Host
	}

	// validate the endpoint host
	if err := http.ValidateEndpointHost(req.URL.Host); err != nil {
		return ctx, fmt.Errorf("endpoint validation error: %w, when using arn %v", err, tv)
	}

	// disable host prefix behavior
	ctx = http.DisableEndpointHostPrefix(ctx, true)

	// remove the serialized arn in place of /{Bucket}
	ctx = setBucketToRemoveOnContext(ctx, tv.String())

	return ctx, nil
}

func buildAccessPointHostPrefix(ctx context.Context, req *http.Request, tv arn.AccessPointARN) (context.Context, error) {
	// add host prefix for access point
	accessPointHostPrefix := tv.AccessPointName + "-" + tv.AccountID + "."
	req.URL.Host = accessPointHostPrefix + req.URL.Host
	if len(req.Host) > 0 {
		req.Host = accessPointHostPrefix + req.Host
	}

	// validate the endpoint host
	if err := http.ValidateEndpointHost(req.URL.Host); err != nil {
		return ctx, s3shared.NewInvalidARNError(tv, err)
	}

	return ctx, nil
}

// ====== Outpost Accesspoint ========

type outpostAccessPointOptions struct {
	processARNResource
	request       *http.Request
	resource      arn.OutpostAccessPointARN
	partitionID   string
	requestRegion string
}

func buildOutpostAccessPointRequest(ctx context.Context, options outpostAccessPointOptions) (context.Context, error) {
	tv := options.resource
	req := options.request

	resolveRegion := tv.Region
	resolveService := tv.Service
	endpointsID := resolveService
	if strings.EqualFold(resolveService, "s3-outposts") {
		// assign endpoints ID as "S3"
		endpointsID = "s3"
	}

	ero := options.EndpointResolverOptions
	ero.Logger = middleware.GetLogger(ctx)
	ero.ResolvedRegion = ""

	// resolve regional endpoint for resolved region.
	endpoint, err := options.EndpointResolver.ResolveEndpoint(resolveRegion, ero)
	if err != nil {
		return ctx, s3shared.NewFailedToResolveEndpointError(
			tv,
			options.partitionID,
			options.requestRegion,
			err,
		)
	}

	// assign resolved endpoint url to request url
	req.URL, err = url.Parse(endpoint.URL)
	if err != nil {
		return ctx, fmt.Errorf("failed to parse endpoint URL: %w", err)
	}

	// assign resolved service from arn as signing name
	if len(endpoint.SigningName) != 0 && endpoint.Source == aws.EndpointSourceCustom {
		ctx = awsmiddleware.SetSigningName(ctx, endpoint.SigningName)
	} else {
		ctx = awsmiddleware.SetSigningName(ctx, resolveService)
	}

	if len(endpoint.SigningRegion) != 0 {
		// redirect signer to use resolved endpoint signing name and region
		ctx = awsmiddleware.SetSigningRegion(ctx, endpoint.SigningRegion)
	} else {
		ctx = awsmiddleware.SetSigningRegion(ctx, resolveRegion)
	}

	// update serviceID to resolved service id
	ctx = awsmiddleware.SetServiceID(ctx, resolveService)

	// disable host prefix behavior
	ctx = http.DisableEndpointHostPrefix(ctx, true)

	// remove the serialized arn in place of /{Bucket}
	ctx = setBucketToRemoveOnContext(ctx, tv.String())

	// skip further customizations, if arn region resolves to a immutable endpoint
	if endpoint.HostnameImmutable {
		return ctx, nil
	}

	updateHostPrefix(req, endpointsID, resolveService)

	// add host prefix for s3-outposts
	outpostAPHostPrefix := tv.AccessPointName + "-" + tv.AccountID + "." + tv.OutpostID + "."
	req.URL.Host = outpostAPHostPrefix + req.URL.Host
	if len(req.Host) > 0 {
		req.Host = outpostAPHostPrefix + req.Host
	}

	// validate the endpoint host
	if err := http.ValidateEndpointHost(req.URL.Host); err != nil {
		return ctx, s3shared.NewInvalidARNError(tv, err)
	}

	return ctx, nil
}
