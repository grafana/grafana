package s3

import (
	"context"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/aws"
	smithyauth "github.com/aws/smithy-go/auth"
)

type endpointAuthResolver struct {
	EndpointResolver EndpointResolverV2
}

var _ AuthSchemeResolver = (*endpointAuthResolver)(nil)

func (r *endpointAuthResolver) ResolveAuthSchemes(
	ctx context.Context, params *AuthResolverParameters,
) (
	[]*smithyauth.Option, error,
) {
	if params.endpointParams.Region == nil {
		// #2502: We're correcting the endpoint binding behavior to treat empty
		// Region as "unset" (nil), but auth resolution technically doesn't
		// care and someone could be using V1 or non-default V2 endpoint
		// resolution, both of which would bypass the required-region check.
		// They shouldn't be broken because the region is technically required
		// by this service's endpoint-based auth resolver, so we stub it here.
		params.endpointParams.Region = aws.String("")
	}

	opts, err := r.resolveAuthSchemes(ctx, params)
	if err != nil {
		return nil, err
	}

	// canonicalize sigv4-s3express ID
	for _, opt := range opts {
		if opt.SchemeID == "sigv4-s3express" {
			opt.SchemeID = "com.amazonaws.s3#sigv4express"
		}
	}

	// preserve pre-SRA behavior where everything technically had anonymous
	return append(opts, &smithyauth.Option{
		SchemeID: smithyauth.SchemeIDAnonymous,
	}), nil
}

func (r *endpointAuthResolver) resolveAuthSchemes(
	ctx context.Context, params *AuthResolverParameters,
) (
	[]*smithyauth.Option, error,
) {
	baseOpts, err := (&defaultAuthSchemeResolver{}).ResolveAuthSchemes(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("get base options: %w", err)
	}

	endpt, err := r.EndpointResolver.ResolveEndpoint(ctx, *params.endpointParams)
	if err != nil {
		return nil, fmt.Errorf("resolve endpoint: %w", err)
	}

	endptOpts, ok := smithyauth.GetAuthOptions(&endpt.Properties)
	if !ok {
		return baseOpts, nil
	}

	// the list of options from the endpoint is authoritative, however, the
	// modeled options have some properties that the endpoint ones don't, so we
	// start from the latter and merge in
	for _, endptOpt := range endptOpts {
		if baseOpt := findScheme(baseOpts, endptOpt.SchemeID); baseOpt != nil {
			rebaseProps(endptOpt, baseOpt)
		}
	}

	return endptOpts, nil
}

// rebase the properties of dst, taking src as the base and overlaying those
// from dst
func rebaseProps(dst, src *smithyauth.Option) {
	iprops, sprops := src.IdentityProperties, src.SignerProperties

	iprops.SetAll(&dst.IdentityProperties)
	sprops.SetAll(&dst.SignerProperties)

	dst.IdentityProperties = iprops
	dst.SignerProperties = sprops
}

func findScheme(opts []*smithyauth.Option, schemeID string) *smithyauth.Option {
	for _, opt := range opts {
		if opt.SchemeID == schemeID {
			return opt
		}
	}
	return nil
}

func finalizeServiceEndpointAuthResolver(options *Options) {
	if _, ok := options.AuthSchemeResolver.(*defaultAuthSchemeResolver); !ok {
		return
	}

	options.AuthSchemeResolver = &endpointAuthResolver{
		EndpointResolver: options.EndpointResolverV2,
	}
}

func finalizeOperationEndpointAuthResolver(options *Options) {
	resolver, ok := options.AuthSchemeResolver.(*endpointAuthResolver)
	if !ok {
		return
	}

	if resolver.EndpointResolver == options.EndpointResolverV2 {
		return
	}

	options.AuthSchemeResolver = &endpointAuthResolver{
		EndpointResolver: options.EndpointResolverV2,
	}
}
