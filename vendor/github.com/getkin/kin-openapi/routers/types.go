package routers

import (
	"net/http"

	"github.com/getkin/kin-openapi/openapi3"
)

// Router helps link http.Request.s and an OpenAPIv3 spec
type Router interface {
	// FindRoute matches an HTTP request with the operation it resolves to.
	// Hosts are matched from the OpenAPIv3 servers key.
	//
	// If you experience ErrPathNotFound and have localhost hosts specified as your servers,
	// turning these server URLs as relative (leaving only the path) should resolve this.
	//
	// See openapi3filter for example uses with request and response validation.
	FindRoute(req *http.Request) (route *Route, pathParams map[string]string, err error)
}

// Route describes the operation an http.Request can match
type Route struct {
	Spec      *openapi3.T
	Server    *openapi3.Server
	Path      string
	PathItem  *openapi3.PathItem
	Method    string
	Operation *openapi3.Operation
}

// ErrPathNotFound is returned when no route match is found
var ErrPathNotFound error = &RouteError{"no matching operation was found"}

// ErrMethodNotAllowed is returned when no method of the matched route matches
var ErrMethodNotAllowed error = &RouteError{"method not allowed"}

// RouteError describes Router errors
type RouteError struct {
	Reason string
}

func (e *RouteError) Error() string { return e.Reason }
