package backend

import (
	"net/http"
	"sort"
	"strings"
)

// SchemaProviderFunc defines func provides a Schema.
type SchemaProviderFunc func() Schema

// ResourceHandlerFunc defines resource handler function.
type ResourceHandlerFunc func(*ResourceRequestContext) http.Handler

// Schema defines plugin schema.
type Schema struct {
	Resources            ResourceMap
	HealthCheckHandler   CheckHealthHandler
	DataQueryHandler     DataQueryHandler
	TransformDataHandler TransformDataHandler
}

// RouteMethod route method.
type RouteMethod int

const (
	// RouteMethodAny any HTTP method.
	RouteMethodAny RouteMethod = iota
	// RouteMethodGet HTTP GET method.
	RouteMethodGet
	// RouteMethodPut HTTP PUT method.
	RouteMethodPut
	// RouteMethodPost HTTP POST method.
	RouteMethodPost
	// RouteMethodDelete HTTP DELETE method.
	RouteMethodDelete
	// RouteMethodPatch HTTP PATCH method.
	RouteMethodPatch
)

// Route defines a route for a resource.
type Route struct {
	Path    string
	Method  RouteMethod
	Handler ResourceHandlerFunc
}

// NewRoute creates a new Route.
func NewRoute(path string, method RouteMethod, handler ResourceHandlerFunc) *Route {
	return &Route{
		Path:    path,
		Method:  method,
		Handler: handler,
	}
}

func (r *Route) Matches(method string) bool {
	switch method {
	case http.MethodGet:
		return r.Method == RouteMethodGet
	case http.MethodPut:
		return r.Method == RouteMethodPut
	case http.MethodPost:
		return r.Method == RouteMethodPost
	case http.MethodDelete:
		return r.Method == RouteMethodDelete
	case http.MethodPatch:
		return r.Method == RouteMethodPatch
	}

	return r.Method == RouteMethodAny
}

// Resource defines a resource that can be called.
type Resource struct {
	Path   string
	Routes []*Route
}

// NewResource creates a new Resource.
func NewResource(path string) *Resource {
	return &Resource{
		Path:   path,
		Routes: []*Route{},
	}
}

// AddRoute adds a routes to the resource.
func (r *Resource) AddRoute(path string, method RouteMethod, handler ResourceHandlerFunc) *Resource {
	r.Routes = append(r.Routes, NewRoute(path, method, handler))
	return r
}

// AddRoutes adds routes to the resource.
func (r *Resource) AddRoutes(route ...*Route) *Resource {
	r.Routes = append(r.Routes, route...)
	return r
}

func (r *Resource) GetMatchingRoute(path, method string) *Route {
	path = NormalizePath(path)
	if !strings.HasPrefix(path, r.Path) {
		return nil
	}

	sort.SliceStable(r.Routes, func(i, j int) bool {
		return r.Routes[i].Method > r.Routes[j].Method
	})

	for _, route := range r.Routes {
		combinedPath := CombinePaths(r.Path, route.Path)
		if strings.HasPrefix(path, combinedPath) {
			if route.Matches(method) {
				return route
			}
		}
	}

	return nil
}

// ResourceMap defines a map of resource names to Resource.
type ResourceMap map[string]*Resource

type ResourceRequestContext struct {
	PluginConfig PluginConfig
	params       map[string]string
}

func NewResourceRequestContext(config PluginConfig, params map[string]string) *ResourceRequestContext {
	return &ResourceRequestContext{
		PluginConfig: config,
		params:       params,
	}
}

// Params returns value of given param name.
// e.g. ctx.Params(":uid") or ctx.Params("uid")
func (ctx *ResourceRequestContext) Params(name string) string {
	if len(name) == 0 {
		return ""
	}
	if len(name) > 1 && name[0] != ':' {
		name = ":" + name
	}
	return ctx.params[name]
}

// NormalizePath normalizes a path.
func NormalizePath(path string) string {
	if path == "" {
		path = "/"
	}

	path = strings.TrimSuffix(path, "/")

	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}

	return path
}

// CombinePaths combinbe paths into a path.
func CombinePaths(paths ...string) string {
	path := ""
	for _, p := range paths {
		p = NormalizePath(p)
		if p == "/" {
			p = ""
		}
		path += p
	}

	return NormalizePath(path)
}
