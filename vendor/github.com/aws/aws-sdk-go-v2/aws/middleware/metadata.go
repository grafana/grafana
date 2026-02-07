package middleware

import (
	"context"

	"github.com/aws/aws-sdk-go-v2/aws"

	"github.com/aws/smithy-go/middleware"
)

// RegisterServiceMetadata registers metadata about the service and operation into the middleware context
// so that it is available at runtime for other middleware to introspect.
type RegisterServiceMetadata struct {
	ServiceID     string
	SigningName   string
	Region        string
	OperationName string
}

// ID returns the middleware identifier.
func (s *RegisterServiceMetadata) ID() string {
	return "RegisterServiceMetadata"
}

// HandleInitialize registers service metadata information into the middleware context, allowing for introspection.
func (s RegisterServiceMetadata) HandleInitialize(
	ctx context.Context, in middleware.InitializeInput, next middleware.InitializeHandler,
) (out middleware.InitializeOutput, metadata middleware.Metadata, err error) {
	if len(s.ServiceID) > 0 {
		ctx = SetServiceID(ctx, s.ServiceID)
	}
	if len(s.SigningName) > 0 {
		ctx = SetSigningName(ctx, s.SigningName)
	}
	if len(s.Region) > 0 {
		ctx = setRegion(ctx, s.Region)
	}
	if len(s.OperationName) > 0 {
		ctx = setOperationName(ctx, s.OperationName)
	}
	return next.HandleInitialize(ctx, in)
}

// service metadata keys for storing and lookup of runtime stack information.
type (
	serviceIDKey               struct{}
	signingNameKey             struct{}
	signingRegionKey           struct{}
	regionKey                  struct{}
	operationNameKey           struct{}
	partitionIDKey             struct{}
	requiresLegacyEndpointsKey struct{}
)

// GetServiceID retrieves the service id from the context.
//
// Scoped to stack values. Use github.com/aws/smithy-go/middleware#ClearStackValues
// to clear all stack values.
func GetServiceID(ctx context.Context) (v string) {
	v, _ = middleware.GetStackValue(ctx, serviceIDKey{}).(string)
	return v
}

// GetSigningName retrieves the service signing name from the context.
//
// Scoped to stack values. Use github.com/aws/smithy-go/middleware#ClearStackValues
// to clear all stack values.
//
// Deprecated: This value is unstable. The resolved signing name is available
// in the signer properties object passed to the signer.
func GetSigningName(ctx context.Context) (v string) {
	v, _ = middleware.GetStackValue(ctx, signingNameKey{}).(string)
	return v
}

// GetSigningRegion retrieves the region from the context.
//
// Scoped to stack values. Use github.com/aws/smithy-go/middleware#ClearStackValues
// to clear all stack values.
//
// Deprecated: This value is unstable. The resolved signing region is available
// in the signer properties object passed to the signer.
func GetSigningRegion(ctx context.Context) (v string) {
	v, _ = middleware.GetStackValue(ctx, signingRegionKey{}).(string)
	return v
}

// GetRegion retrieves the endpoint region from the context.
//
// Scoped to stack values. Use github.com/aws/smithy-go/middleware#ClearStackValues
// to clear all stack values.
func GetRegion(ctx context.Context) (v string) {
	v, _ = middleware.GetStackValue(ctx, regionKey{}).(string)
	return v
}

// GetOperationName retrieves the service operation metadata from the context.
//
// Scoped to stack values. Use github.com/aws/smithy-go/middleware#ClearStackValues
// to clear all stack values.
func GetOperationName(ctx context.Context) (v string) {
	v, _ = middleware.GetStackValue(ctx, operationNameKey{}).(string)
	return v
}

// GetPartitionID retrieves the endpoint partition id from the context.
//
// Scoped to stack values. Use github.com/aws/smithy-go/middleware#ClearStackValues
// to clear all stack values.
func GetPartitionID(ctx context.Context) string {
	v, _ := middleware.GetStackValue(ctx, partitionIDKey{}).(string)
	return v
}

// GetRequiresLegacyEndpoints the flag used to indicate if legacy endpoint
// customizations need to be executed.
//
// Scoped to stack values. Use github.com/aws/smithy-go/middleware#ClearStackValues
// to clear all stack values.
func GetRequiresLegacyEndpoints(ctx context.Context) bool {
	v, _ := middleware.GetStackValue(ctx, requiresLegacyEndpointsKey{}).(bool)
	return v
}

// SetRequiresLegacyEndpoints set or modifies the flag indicated that
// legacy endpoint customizations are needed.
//
// Scoped to stack values. Use github.com/aws/smithy-go/middleware#ClearStackValues
// to clear all stack values.
func SetRequiresLegacyEndpoints(ctx context.Context, value bool) context.Context {
	return middleware.WithStackValue(ctx, requiresLegacyEndpointsKey{}, value)
}

// SetSigningName set or modifies the sigv4 or sigv4a signing name on the context.
//
// Scoped to stack values. Use github.com/aws/smithy-go/middleware#ClearStackValues
// to clear all stack values.
//
// Deprecated: This value is unstable. Use WithSigV4SigningName client option
// funcs instead.
func SetSigningName(ctx context.Context, value string) context.Context {
	return middleware.WithStackValue(ctx, signingNameKey{}, value)
}

// SetSigningRegion sets or modifies the region on the context.
//
// Scoped to stack values. Use github.com/aws/smithy-go/middleware#ClearStackValues
// to clear all stack values.
//
// Deprecated: This value is unstable. Use WithSigV4SigningRegion client option
// funcs instead.
func SetSigningRegion(ctx context.Context, value string) context.Context {
	return middleware.WithStackValue(ctx, signingRegionKey{}, value)
}

// SetServiceID sets the service id on the context.
//
// Scoped to stack values. Use github.com/aws/smithy-go/middleware#ClearStackValues
// to clear all stack values.
func SetServiceID(ctx context.Context, value string) context.Context {
	return middleware.WithStackValue(ctx, serviceIDKey{}, value)
}

// setRegion sets the endpoint region on the context.
//
// Scoped to stack values. Use github.com/aws/smithy-go/middleware#ClearStackValues
// to clear all stack values.
func setRegion(ctx context.Context, value string) context.Context {
	return middleware.WithStackValue(ctx, regionKey{}, value)
}

// setOperationName sets the service operation on the context.
//
// Scoped to stack values. Use github.com/aws/smithy-go/middleware#ClearStackValues
// to clear all stack values.
func setOperationName(ctx context.Context, value string) context.Context {
	return middleware.WithStackValue(ctx, operationNameKey{}, value)
}

// SetPartitionID sets the partition id of a resolved region on the context
//
// Scoped to stack values. Use github.com/aws/smithy-go/middleware#ClearStackValues
// to clear all stack values.
func SetPartitionID(ctx context.Context, value string) context.Context {
	return middleware.WithStackValue(ctx, partitionIDKey{}, value)
}

// EndpointSource key
type endpointSourceKey struct{}

// GetEndpointSource returns an endpoint source if set on context
func GetEndpointSource(ctx context.Context) (v aws.EndpointSource) {
	v, _ = middleware.GetStackValue(ctx, endpointSourceKey{}).(aws.EndpointSource)
	return v
}

// SetEndpointSource sets endpoint source on context
func SetEndpointSource(ctx context.Context, value aws.EndpointSource) context.Context {
	return middleware.WithStackValue(ctx, endpointSourceKey{}, value)
}

type signingCredentialsKey struct{}

// GetSigningCredentials returns the credentials that were used for signing if set on context.
func GetSigningCredentials(ctx context.Context) (v aws.Credentials) {
	v, _ = middleware.GetStackValue(ctx, signingCredentialsKey{}).(aws.Credentials)
	return v
}

// SetSigningCredentials sets the credentails used for signing on the context.
func SetSigningCredentials(ctx context.Context, value aws.Credentials) context.Context {
	return middleware.WithStackValue(ctx, signingCredentialsKey{}, value)
}
