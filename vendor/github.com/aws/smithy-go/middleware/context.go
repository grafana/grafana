package middleware

import "context"

type (
	serviceIDKey     struct{}
	operationNameKey struct{}
)

// WithServiceID adds a service ID to the context, scoped to middleware stack
// values.
//
// This API is called in the client runtime when bootstrapping an operation and
// should not typically be used directly.
func WithServiceID(parent context.Context, id string) context.Context {
	return WithStackValue(parent, serviceIDKey{}, id)
}

// GetServiceID retrieves the service ID from the context. This is typically
// the service shape's name from its Smithy model. Service clients for specific
// systems (e.g. AWS SDK) may use an alternate designated value.
func GetServiceID(ctx context.Context) string {
	id, _ := GetStackValue(ctx, serviceIDKey{}).(string)
	return id
}

// WithOperationName adds the operation name to the context, scoped to
// middleware stack values.
//
// This API is called in the client runtime when bootstrapping an operation and
// should not typically be used directly.
func WithOperationName(parent context.Context, id string) context.Context {
	return WithStackValue(parent, operationNameKey{}, id)
}

// GetOperationName retrieves the operation name from the context. This is
// typically the operation shape's name from its Smithy model.
func GetOperationName(ctx context.Context) string {
	name, _ := GetStackValue(ctx, operationNameKey{}).(string)
	return name
}
