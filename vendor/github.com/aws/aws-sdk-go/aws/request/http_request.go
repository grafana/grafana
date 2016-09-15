// +build go1.5

package request

import (
	"io"
	"net/http"
	"net/url"
)

func copyHTTPRequest(r *http.Request, body io.ReadCloser) *http.Request {
	req := &http.Request{
		URL:           &url.URL{},
		Header:        http.Header{},
		Close:         r.Close,
		Body:          body,
		Host:          r.Host,
		Method:        r.Method,
		Proto:         r.Proto,
		ContentLength: r.ContentLength,
		// Cancel will be deprecated in 1.7 and will be replaced with Context
		Cancel: r.Cancel,
	}

	*req.URL = *r.URL
	for k, v := range r.Header {
		for _, vv := range v {
			req.Header.Add(k, vv)
		}
	}

	return req
}
