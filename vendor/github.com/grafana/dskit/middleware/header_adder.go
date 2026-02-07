// Provenance-includes-location: https://github.com/weaveworks/common/blob/main/middleware/header_adder.go
// Provenance-includes-license: Apache-2.0
// Provenance-includes-copyright: Weaveworks Ltd.

package middleware

import (
	"net/http"
)

// HeaderAdder adds headers to responses
type HeaderAdder struct {
	http.Header
}

// Wrap implements Middleware
func (h HeaderAdder) Wrap(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Do it in pre-order since headers need to be added before
		// writing the response body
		dst := w.Header()
		for k, vv := range h.Header {
			for _, v := range vv {
				dst.Add(k, v)
			}
		}
		next.ServeHTTP(w, r)
	})
}
