package httpclient

import (
	"net/http"
)

// BasicAuthenticationMiddlewareName is the middleware name used by BasicAuthenticationMiddleware.
const BasicAuthenticationMiddlewareName = "BasicAuth"

// BasicAuthenticationMiddleware applies basic authentication to the HTTP header "Authorization"
// in the outgoing request.
// If Authorization header is already set, it will not be overridden by this middleware.
// If opts.BasicAuth is nil, next will be returned.
func BasicAuthenticationMiddleware() Middleware {
	return NamedMiddlewareFunc(BasicAuthenticationMiddlewareName, func(opts Options, next http.RoundTripper) http.RoundTripper {
		if opts.BasicAuth == nil {
			return next
		}

		return RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
			if req.Header.Get("Authorization") == "" {
				req.SetBasicAuth(opts.BasicAuth.User, opts.BasicAuth.Password)
			}
			return next.RoundTrip(req)
		})
	})
}
