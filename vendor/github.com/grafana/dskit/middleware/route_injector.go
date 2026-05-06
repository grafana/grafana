// SPDX-License-Identifier: AGPL-3.0-only

package middleware

import (
	"context"
	"net/http"
	"regexp"
	"strings"

	"github.com/gorilla/mux"
)

// RouteInjector is a middleware that injects the route name for the current request into the request context.
//
// The route name can be retrieved by calling ExtractRouteName.
type RouteInjector struct {
	RouteMatcher RouteMatcher
}

func (i RouteInjector) Wrap(handler http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		routeName := getRouteName(i.RouteMatcher, r)
		handler.ServeHTTP(w, WithRouteName(r, routeName))
	})
}

// WithRouteName annotates r's context with the provided route name.
//
// The provided value must be suitable to use as a Prometheus label value.
//
// This method should generally only be used in tests: in production code, use RouteInjector instead.
func WithRouteName(r *http.Request, routeName string) *http.Request {
	ctx := context.WithValue(r.Context(), contextKeyRouteName, routeName)
	return r.WithContext(ctx)
}

// ExtractRouteName returns the route name associated with this request that was previously injected by the
// RouteInjector middleware or WithRouteName.
//
// This is the same route name used for trace and metric names, and is already suitable for use as a Prometheus label
// value.
func ExtractRouteName(ctx context.Context) string {
	routeName, ok := ctx.Value(contextKeyRouteName).(string)
	if !ok {
		return ""
	}

	return routeName
}

func getRouteName(routeMatcher RouteMatcher, r *http.Request) string {
	var routeMatch mux.RouteMatch
	if routeMatcher == nil || !routeMatcher.Match(r, &routeMatch) {
		return ""
	}

	if routeMatch.MatchErr == mux.ErrNotFound {
		return "notfound"
	}

	if routeMatch.Route == nil {
		return ""
	}

	if name := routeMatch.Route.GetName(); name != "" {
		return name
	}

	tmpl, err := routeMatch.Route.GetPathTemplate()
	if err == nil {
		return MakeLabelValue(tmpl)
	}

	return ""
}

var invalidChars = regexp.MustCompile(`[^a-zA-Z0-9]+`)

// MakeLabelValue converts a Gorilla mux path to a string suitable for use in
// a Prometheus label value.
func MakeLabelValue(path string) string {
	// Convert non-alnums to underscores.
	result := invalidChars.ReplaceAllString(path, "_")

	// Trim leading and trailing underscores.
	result = strings.Trim(result, "_")

	// Make it all lowercase
	result = strings.ToLower(result)

	// Special case.
	if result == "" {
		result = "root"
	}
	return result
}
