// Provenance-includes-location: https://github.com/weaveworks/common/blob/main/middleware/http_auth.go
// Provenance-includes-license: Apache-2.0
// Provenance-includes-copyright: Weaveworks Ltd.

package middleware

import (
	"net/http"

	"github.com/grafana/dskit/user"
)

// AuthenticateUser propagates the user ID from HTTP headers back to the request's context.
var AuthenticateUser = Func(func(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, ctx, err := user.ExtractOrgIDFromHTTPRequest(r)
		if err != nil {
			http.Error(w, err.Error(), http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r.WithContext(ctx))
	})
})
