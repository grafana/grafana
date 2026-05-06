package mock

import (
	"fmt"
	"net/http"

	"github.com/gorilla/mux"
	"golang.org/x/time/rate"
)

// WithRequestMatchHandler implements a request callback
// for the given `pattern`.
//
// For custom implementations, this handler usage is encouraged.
//
// Example:
//
//	WithRequestMatchHandler(
//		GetOrgsProjectsByOrg,
//		http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
//			w.Write(MustMarshal([]github.Project{
//				{
//					Name: github.String("mocked-proj-1"),
//				},
//				{
//					Name: github.String("mocked-proj-2"),
//				},
//			}))
//		}),
//	)
func WithRequestMatchHandler(
	ep EndpointPattern,
	handler http.Handler,
) MockBackendOption {
	return func(router *mux.Router) {
		router.Handle(ep.Pattern, handler).Methods(ep.Method)
	}
}

// WithRequestMatch implements a simple FIFO for requests
// of the given `pattern`.
//
// Once all responses have been used, it shall panic()!
//
// Example:
//
//	WithRequestMatch(
//		GetUsersByUsername,
//		github.User{
//			Name: github.String("foobar"),
//		},
//	)
func WithRequestMatch(
	ep EndpointPattern,
	responsesFIFO ...interface{},
) MockBackendOption {
	responses := [][]byte{}

	for _, r := range responsesFIFO {
		switch v := r.(type) {
		case []byte:
			responses = append(responses, v)
		default:
			responses = append(responses, MustMarshal(r))
		}
	}

	return WithRequestMatchHandler(ep, &FIFOResponseHandler{
		Responses: responses,
	})
}

// WithRequestMatchEnterprise Same as `WithRequestMatch` but for Github Enterprise
func WithRequestMatchEnterprise(
	ep EndpointPattern,
	responsesFIFO ...interface{},
) MockBackendOption {
	// prepend `/api/v3` like go-github: https://github.com/google/go-github/blob/8c7625e6a26563e0e031916cc44231912fc52e49/github/github.go#L375
	ep.Pattern = fmt.Sprintf("/api/v3%s", ep.Pattern)

	return WithRequestMatch(ep, responsesFIFO...)
}

// WithRequestMatchPages honors pagination directives.
//
// Pages can be requested in any order and each page can be called multiple times.
//
// E.g.
//
//	mockedHTTPClient := NewMockedHTTPClient(
//		WithRequestMatchPages(
//			GetOrgsReposByOrg,
//			[]github.Repository{
//				{
//					Name: github.String("repo-A-on-first-page"),
//				},
//				{
//					Name: github.String("repo-B-on-first-page"),
//				},
//			},
//			[]github.Repository{
//				{
//					Name: github.String("repo-C-on-second-page"),
//				},
//				{
//					Name: github.String("repo-D-on-second-page"),
//				},
//			},
//		),
//	)
func WithRequestMatchPages(
	ep EndpointPattern,
	pages ...interface{},
) MockBackendOption {
	p := [][]byte{}

	for _, r := range pages {
		p = append(p, MustMarshal(r))
	}

	return WithRequestMatchHandler(ep, &PaginatedResponseHandler{
		ResponsePages: p,
	})
}

// WithRequestMatchPagesEnterprise Same as `WithRequestMatchPages` but for Github Enterprise
func WithRequestMatchPagesEnterprise(
	ep EndpointPattern,
	pages ...interface{},
) MockBackendOption {
	// prepend `/api/v3` like go-github: https://github.com/google/go-github/blob/8c7625e6a26563e0e031916cc44231912fc52e49/github/github.go#L375
	ep.Pattern = fmt.Sprintf("/api/v3%s", ep.Pattern)

	return WithRequestMatchPages(ep, pages...)
}

// rateLimitMiddleware enforces a rate limit using [golang.org/x/time/rate].
// rps is the number of requests per second allowed by the rate limiter.
// Higher burst values allow more calls to happen at once.
// A zero value for burst will not allow any events, unless rps == [rate.Inf].
// This middleware is intended to be used with [github.com/gorilla/mux].
func rateLimitMiddleware(rps float64, burst int) func(next http.Handler) http.Handler {
	limiter := rate.NewLimiter(rate.Limit(rps), burst)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !limiter.Allow() {
				// These values are based on this bit of logic within [github.com/google/go-github]:
				// https://github.com/google/go-github/blob/5e25c5c215b3d21991d17447fba2e9d13a875159/github/github.go#L1243
				w.Header().Set("X-RateLimit-Remaining", "0")
				w.WriteHeader(http.StatusForbidden)

				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// WithRateLimit enforces a rate limit on the mocked [http.Client].
// NOTE: This is an alpha feature. Future changes might break compatibility, until a stable version is released.
func WithRateLimit(rps float64, burst int) MockBackendOption {
	return func(router *mux.Router) {
		router.Use(rateLimitMiddleware(rps, burst))
	}
}
