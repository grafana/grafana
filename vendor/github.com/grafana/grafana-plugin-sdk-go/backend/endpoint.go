package backend

import (
	"context"

	endpointctx "github.com/grafana/grafana-plugin-sdk-go/backend/internal/endpointctx"
)

// Endpoint used for defining names for endpoints/handlers.
type Endpoint string

// IsEmpty returns true if endpoint is not set/empty string.
func (e Endpoint) IsEmpty() bool {
	return e == ""
}

func (e Endpoint) String() string {
	return string(e)
}

// WithEndpoint adds endpoint to ctx.
func WithEndpoint(ctx context.Context, endpoint Endpoint) context.Context {
	return context.WithValue(ctx, endpointctx.EndpointCtxKey, endpoint)
}

// EndpointFromContext extracts [Endpoint] from ctx if available, otherwise empty [Endpoint].
func EndpointFromContext(ctx context.Context) Endpoint {
	if ep := ctx.Value(endpointctx.EndpointCtxKey); ep != nil {
		return ep.(Endpoint)
	}

	return Endpoint("")
}
