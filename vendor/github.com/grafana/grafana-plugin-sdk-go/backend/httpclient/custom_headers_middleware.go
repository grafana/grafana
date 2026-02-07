package httpclient

import (
	"net/http"
)

// CustomHeadersMiddlewareName is the middleware name used by CustomHeadersMiddleware.
const CustomHeadersMiddlewareName = "CustomHeaders"

// CustomHeadersMiddleware applies custom HTTP headers to the outgoing request.
//
// If opts.Headers is empty, next will be returned.
func CustomHeadersMiddleware() Middleware {
	return NamedMiddlewareFunc(CustomHeadersMiddlewareName, func(opts Options, next http.RoundTripper) http.RoundTripper {
		if len(opts.Header) == 0 {
			return next
		}

		return RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
			for key, values := range opts.Header {
				// According to https://pkg.go.dev/net/http#Request.Header, Host is a special case
				if http.CanonicalHeaderKey(key) == "Host" {
					req.Host = values[0]
				} else {
					// Clean up the header before adding the new values
					req.Header.Del(key)
					for _, value := range values {
						req.Header.Add(key, value)
					}
				}
			}

			return next.RoundTrip(req)
		})
	})
}
