package errorsource

import (
	"errors"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
)

// Middleware captures error source metric
//
// Deprecated: If you are using sdk httpclient, this is already included in the default middleware.
// If you are not using the sdk httpclient, you should use httpclient.ErrorSourceMiddleware instead.
func Middleware(plugin string) httpclient.Middleware {
	return httpclient.NamedMiddlewareFunc(plugin, RoundTripper)
}

// RoundTripper returns the error source
//
// Deprecated: If you are using sdk httpclient, this is already included in the default middleware.
// If you are not using the sdk httpclient, you should use httpclient.ErrorSourceRoundTripper instead.
func RoundTripper(_ httpclient.Options, next http.RoundTripper) http.RoundTripper {
	return httpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
		res, err := next.RoundTrip(req)
		if res != nil && res.StatusCode >= 400 {
			errorSource := backend.ErrorSourceFromHTTPStatus(res.StatusCode)
			if err == nil {
				err = errors.New(res.Status)
			}
			return res, backend.NewErrorWithSource(err, errorSource)
		}

		if backend.IsDownstreamHTTPError(err) {
			return res, backend.NewErrorWithSource(err, backend.ErrorSourceDownstream)
		}

		return res, err
	})
}
