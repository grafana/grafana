package httpclient

import (
	"context"
	"net/http"
)

// ContextualMiddlewareName is the middleware name used by ContextualMiddleware.
const ContextualMiddlewareName = "contextual-middleware"

// ContextualMiddleware is a middleware that allows the outgoing request to be
// modified with contextual middlewares.
// Use WithContextualMiddleware to provide contextual middlewares.
func ContextualMiddleware() Middleware {
	return NamedMiddlewareFunc(ContextualMiddlewareName, func(opts Options, next http.RoundTripper) http.RoundTripper {
		return RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
			ctxMiddlewares := ContextualMiddlewareFromContext(req.Context())
			if len(ctxMiddlewares) == 0 {
				return next.RoundTrip(req)
			}

			rt, err := roundTripperFromMiddlewares(opts, ctxMiddlewares, next)
			if err != nil {
				return nil, err
			}
			return rt.RoundTrip(req)
		})
	})
}

type contextualMiddlewareValue struct {
	middlewares []Middleware
}

type contextualMiddlewareKey struct{}

// WithContextualMiddleware returns a copy of parent in which the provided
// middlewares is associated.
// If contextual middleware already exists, new middleware will be appended.
func WithContextualMiddleware(parent context.Context, middlewares ...Middleware) context.Context {
	if len(middlewares) == 0 {
		middlewares = []Middleware{}
	}

	existingMiddlewares := ContextualMiddlewareFromContext(parent)
	if len(existingMiddlewares) > 0 {
		middlewares = append(existingMiddlewares, middlewares...)
	}

	return context.WithValue(parent, contextualMiddlewareKey{}, contextualMiddlewareValue{
		middlewares: middlewares,
	})
}

// ContextualMiddlewareFromContext returns middlewares from context, if any.
func ContextualMiddlewareFromContext(ctx context.Context) []Middleware {
	v := ctx.Value(contextualMiddlewareKey{})
	if v == nil {
		return []Middleware{}
	}

	if opts, ok := v.(contextualMiddlewareValue); ok {
		return opts.middlewares
	}

	return []Middleware{}
}
