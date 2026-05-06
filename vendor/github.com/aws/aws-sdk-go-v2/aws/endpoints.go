package aws

import (
	"fmt"
)

// DualStackEndpointState is a constant to describe the dual-stack endpoint resolution behavior.
type DualStackEndpointState uint

const (
	// DualStackEndpointStateUnset is the default value behavior for dual-stack endpoint resolution.
	DualStackEndpointStateUnset DualStackEndpointState = iota

	// DualStackEndpointStateEnabled enables dual-stack endpoint resolution for service endpoints.
	DualStackEndpointStateEnabled

	// DualStackEndpointStateDisabled disables dual-stack endpoint resolution for endpoints.
	DualStackEndpointStateDisabled
)

// GetUseDualStackEndpoint takes a service's EndpointResolverOptions and returns the UseDualStackEndpoint value.
// Returns boolean false if the provided options does not have a method to retrieve the DualStackEndpointState.
func GetUseDualStackEndpoint(options ...interface{}) (value DualStackEndpointState, found bool) {
	type iface interface {
		GetUseDualStackEndpoint() DualStackEndpointState
	}
	for _, option := range options {
		if i, ok := option.(iface); ok {
			value = i.GetUseDualStackEndpoint()
			found = true
			break
		}
	}
	return value, found
}

// FIPSEndpointState is a constant to describe the FIPS endpoint resolution behavior.
type FIPSEndpointState uint

const (
	// FIPSEndpointStateUnset is the default value behavior for FIPS endpoint resolution.
	FIPSEndpointStateUnset FIPSEndpointState = iota

	// FIPSEndpointStateEnabled enables FIPS endpoint resolution for service endpoints.
	FIPSEndpointStateEnabled

	// FIPSEndpointStateDisabled disables FIPS endpoint resolution for endpoints.
	FIPSEndpointStateDisabled
)

// GetUseFIPSEndpoint takes a service's EndpointResolverOptions and returns the UseDualStackEndpoint value.
// Returns boolean false if the provided options does not have a method to retrieve the DualStackEndpointState.
func GetUseFIPSEndpoint(options ...interface{}) (value FIPSEndpointState, found bool) {
	type iface interface {
		GetUseFIPSEndpoint() FIPSEndpointState
	}
	for _, option := range options {
		if i, ok := option.(iface); ok {
			value = i.GetUseFIPSEndpoint()
			found = true
			break
		}
	}
	return value, found
}

// Endpoint represents the endpoint a service client should make API operation
// calls to.
//
// The SDK will automatically resolve these endpoints per API client using an
// internal endpoint resolvers. If you'd like to provide custom endpoint
// resolving behavior you can implement the EndpointResolver interface.
//
// Deprecated: This structure was used with the global [EndpointResolver]
// interface, which has been deprecated in favor of service-specific endpoint
// resolution. See the deprecation docs on that interface for more information.
type Endpoint struct {
	// The base URL endpoint the SDK API clients will use to make API calls to.
	// The SDK will suffix URI path and query elements to this endpoint.
	URL string

	// Specifies if the endpoint's hostname can be modified by the SDK's API
	// client.
	//
	// If the hostname is mutable the SDK API clients may modify any part of
	// the hostname based on the requirements of the API, (e.g. adding, or
	// removing content in the hostname). Such as, Amazon S3 API client
	// prefixing "bucketname" to the hostname, or changing the
	// hostname service name component from "s3." to "s3-accesspoint.dualstack."
	// for the dualstack endpoint of an S3 Accesspoint resource.
	//
	// Care should be taken when providing a custom endpoint for an API. If the
	// endpoint hostname is mutable, and the client cannot modify the endpoint
	// correctly, the operation call will most likely fail, or have undefined
	// behavior.
	//
	// If hostname is immutable, the SDK API clients will not modify the
	// hostname of the URL. This may cause the API client not to function
	// correctly if the API requires the operation specific hostname values
	// to be used by the client.
	//
	// This flag does not modify the API client's behavior if this endpoint
	// will be used instead of Endpoint Discovery, or if the endpoint will be
	// used to perform Endpoint Discovery. That behavior is configured via the
	// API Client's Options.
	HostnameImmutable bool

	// The AWS partition the endpoint belongs to.
	PartitionID string

	// The service name that should be used for signing the requests to the
	// endpoint.
	SigningName string

	// The region that should be used for signing the request to the endpoint.
	SigningRegion string

	// The signing method that should be used for signing the requests to the
	// endpoint.
	SigningMethod string

	// The source of the Endpoint. By default, this will be EndpointSourceServiceMetadata.
	// When providing a custom endpoint, you should set the source as EndpointSourceCustom.
	// If source is not provided when providing a custom endpoint, the SDK may not
	// perform required host mutations correctly. Source should be used along with
	// HostnameImmutable property as per the usage requirement.
	Source EndpointSource
}

// EndpointSource is the endpoint source type.
//
// Deprecated: The global [Endpoint] structure is deprecated.
type EndpointSource int

const (
	// EndpointSourceServiceMetadata denotes service modeled endpoint metadata is used as Endpoint Source.
	EndpointSourceServiceMetadata EndpointSource = iota

	// EndpointSourceCustom denotes endpoint is a custom endpoint. This source should be used when
	// user provides a custom endpoint to be used by the SDK.
	EndpointSourceCustom
)

// EndpointNotFoundError is a sentinel error to indicate that the
// EndpointResolver implementation was unable to resolve an endpoint for the
// given service and region. Resolvers should use this to indicate that an API
// client should fallback and attempt to use it's internal default resolver to
// resolve the endpoint.
type EndpointNotFoundError struct {
	Err error
}

// Error is the error message.
func (e *EndpointNotFoundError) Error() string {
	return fmt.Sprintf("endpoint not found, %v", e.Err)
}

// Unwrap returns the underlying error.
func (e *EndpointNotFoundError) Unwrap() error {
	return e.Err
}

// EndpointResolver is an endpoint resolver that can be used to provide or
// override an endpoint for the given service and region. API clients will
// attempt to use the EndpointResolver first to resolve an endpoint if
// available. If the EndpointResolver returns an EndpointNotFoundError error,
// API clients will fallback to attempting to resolve the endpoint using its
// internal default endpoint resolver.
//
// Deprecated: The global endpoint resolution interface is deprecated. The API
// for endpoint resolution is now unique to each service and is set via the
// EndpointResolverV2 field on service client options. Setting a value for
// EndpointResolver on aws.Config or service client options will prevent you
// from using any endpoint-related service features released after the
// introduction of EndpointResolverV2. You may also encounter broken or
// unexpected behavior when using the old global interface with services that
// use many endpoint-related customizations such as S3.
type EndpointResolver interface {
	ResolveEndpoint(service, region string) (Endpoint, error)
}

// EndpointResolverFunc wraps a function to satisfy the EndpointResolver interface.
//
// Deprecated: The global endpoint resolution interface is deprecated. See
// deprecation docs on [EndpointResolver].
type EndpointResolverFunc func(service, region string) (Endpoint, error)

// ResolveEndpoint calls the wrapped function and returns the results.
func (e EndpointResolverFunc) ResolveEndpoint(service, region string) (Endpoint, error) {
	return e(service, region)
}

// EndpointResolverWithOptions is an endpoint resolver that can be used to provide or
// override an endpoint for the given service, region, and the service client's EndpointOptions. API clients will
// attempt to use the EndpointResolverWithOptions first to resolve an endpoint if
// available. If the EndpointResolverWithOptions returns an EndpointNotFoundError error,
// API clients will fallback to attempting to resolve the endpoint using its
// internal default endpoint resolver.
//
// Deprecated: The global endpoint resolution interface is deprecated. See
// deprecation docs on [EndpointResolver].
type EndpointResolverWithOptions interface {
	ResolveEndpoint(service, region string, options ...interface{}) (Endpoint, error)
}

// EndpointResolverWithOptionsFunc wraps a function to satisfy the EndpointResolverWithOptions interface.
//
// Deprecated: The global endpoint resolution interface is deprecated. See
// deprecation docs on [EndpointResolver].
type EndpointResolverWithOptionsFunc func(service, region string, options ...interface{}) (Endpoint, error)

// ResolveEndpoint calls the wrapped function and returns the results.
func (e EndpointResolverWithOptionsFunc) ResolveEndpoint(service, region string, options ...interface{}) (Endpoint, error) {
	return e(service, region, options...)
}

// GetDisableHTTPS takes a service's EndpointResolverOptions and returns the DisableHTTPS value.
// Returns boolean false if the provided options does not have a method to retrieve the DisableHTTPS.
func GetDisableHTTPS(options ...interface{}) (value bool, found bool) {
	type iface interface {
		GetDisableHTTPS() bool
	}
	for _, option := range options {
		if i, ok := option.(iface); ok {
			value = i.GetDisableHTTPS()
			found = true
			break
		}
	}
	return value, found
}

// GetResolvedRegion takes a service's EndpointResolverOptions and returns the ResolvedRegion value.
// Returns boolean false if the provided options does not have a method to retrieve the ResolvedRegion.
func GetResolvedRegion(options ...interface{}) (value string, found bool) {
	type iface interface {
		GetResolvedRegion() string
	}
	for _, option := range options {
		if i, ok := option.(iface); ok {
			value = i.GetResolvedRegion()
			found = true
			break
		}
	}
	return value, found
}
