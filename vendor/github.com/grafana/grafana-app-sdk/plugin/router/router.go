package router

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

var replArgRegex = regexp.MustCompile(`\{([^\}^\:]+):?([^\}^\:]*)\}`)

// DefaultNotFoundHandler is the handler
// that is used for handling requests when a handler can't be found for a given route.
// This can be overridden in the Router.
var DefaultNotFoundHandler HandlerFunc = func(
	_ context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender,
) {
	_ = sender.Send(&backend.CallResourceResponse{
		Status: http.StatusNotFound,
		Body:   []byte(fmt.Sprintf("no route match for path %s", req.Path)),
	})
}

// NewRouter returns a new Router
func NewRouter() *Router {
	return &Router{
		NotFoundHandler: DefaultNotFoundHandler,
		subrouters:      make([]*Subrouter, 0),
		routes:          make([]*RouteHandler, 0),
	}
}

// Use adds middlewares to the router.
func (r *Router) Use(middlewares ...middleware) {
	r.middlewares = append(r.middlewares, middlewares...)
}

// HandlerFunc defines the signatures handlers need to have in order to be used in this router.
type HandlerFunc func(context.Context, *backend.CallResourceRequest, backend.CallResourceResponseSender)

// Router is a simple request router specific to the grafana plugin SDK backend.CallResourceRequest HTTP calls.
// It allows the user to treat the grafana plugin backend as a traditional HTTP server,
// registering routes and using path parameters as normal.
type Router struct {
	// Handler called when there's no route match.
	NotFoundHandler HandlerFunc

	// Nested routers with a matching path.
	subrouters []*Subrouter

	// Routes to be matched.
	routes []*RouteHandler

	// Slice of middlewares to be called after a match is found.
	middlewares []middleware
}

// Subrouter is a slightly-extended router
// meant for being registered a with Subrouter() on either a Router or Subrouter.
type Subrouter struct {
	Router
	matcher      *regexp.Regexp
	pathArgNames []string
	path         string
}

func (r *Subrouter) Path() string {
	return r.path
}

// Subrouter creates and returns a Subrouter for the given path prefix.
// All handlers registered with the Subrouter will have the prefix added implicitly.
func (r *Router) Subrouter(path string) *Subrouter {
	pathArgNames := make([]string, 0)
	// Look for path replacement vars ({...})
	matches := replArgRegex.FindAllStringSubmatch(path, -1)
	if len(matches) > 0 {
		// Check each match, replace it with regex, and add the match to our list of pathArgNames
		for _, match := range matches {
			if len(match) != 3 {
				continue
			}
			// Element 0 is the whole matched string which needs replacing in the path
			// Element 1 is the variable name
			// Element 2 is the match expression (may be empty, in which case it should be `([^\/]+)`)
			repl := `([^\/]+)`
			if match[2] != "" {
				repl = fmt.Sprintf("(%s)", match[2])
			}
			path = strings.ReplaceAll(path, match[0], repl)
			pathArgNames = append(pathArgNames, match[1])
		}
	}
	regex, err := regexp.Compile(fmt.Sprintf(`^%s`, path))
	if err != nil {
		// TODO
		return nil
	}

	sr := &Subrouter{
		Router: Router{
			NotFoundHandler: r.NotFoundHandler,
			subrouters:      make([]*Subrouter, 0),
			routes:          make([]*RouteHandler, 0),
		},
		pathArgNames: pathArgNames,
		matcher:      regex,
		path:         path,
	}

	r.subrouters = append(r.subrouters, sr)
	return sr
}

// Handle registers a handler to a given path and method(s). If no method(s) are specified, GET is implicitly used.
func (r *Router) Handle(path string, handler HandlerFunc, methods ...string) *RouteHandler {
	providedPath := path
	// Normalize empty path to root.
	if path == "" {
		path = "/"
	}

	pathArgNames := make([]string, 0)
	// Look for path replacement vars ({...})
	matches := replArgRegex.FindAllStringSubmatch(path, -1)
	if len(matches) > 0 {
		// Check each match, replace it with regex, and add the match to our list of pathArgNames
		for _, match := range matches {
			if len(match) != 3 {
				continue
			}
			// Element 0 is the whole matched string which needs replacing in the path
			// Element 1 is the variable name
			// Element 2 is the match expression (may be empty, in which case it should be `([^\/]+)`)
			repl := `([^\/]+)`
			if match[2] != "" {
				repl = fmt.Sprintf("(%s)", match[2])
			}
			path = strings.ReplaceAll(path, match[0], repl)
			pathArgNames = append(pathArgNames, match[1])
		}
	}
	regex, err := regexp.Compile(fmt.Sprintf(`^%s$`, path))
	if err != nil {
		// TODO
		return nil
	}

	// Methods
	m := make(map[string]struct{})
	if len(methods) == 0 {
		m["GET"] = struct{}{}
	}
	for _, method := range methods {
		m[strings.ToUpper(method)] = struct{}{}
	}

	h := &RouteHandler{
		matcher:      regex,
		handleFunc:   handler,
		pathArgNames: pathArgNames,
		methods:      m,
		path:         providedPath,
	}

	r.routes = append(r.routes, h)

	return h
}

// RouteByName gets a RouteHandler by its name, if assigned.
// If multiple routes have the same name, the first registered one will be returned.
func (r *Router) RouteByName(name string) *RouteHandler {
	for _, h := range r.routes {
		if h.name == name {
			return h
		}
	}
	return nil
}

//nolint:lll
func (r *Router) getHandler(ctx context.Context, path string, method string, matchedPath string, applyMiddlewares ...middleware) (context.Context, HandlerFunc) {
	// Check subrouters
	for _, h := range r.subrouters {
		if matches := h.matcher.FindStringSubmatch(path); len(matches) > 0 {
			for i := 1; i < len(matches); i++ {
				if i > len(h.pathArgNames) {
					break
				}

				ctx = CtxWithVar(ctx, h.pathArgNames[i-1], matches[i])
			}

			// Matched path
			mPath := h.path
			if matchedPath != "" {
				mPath = filepath.Join(matchedPath, mPath)
			}
			return h.getHandler(ctx, path[len(matches[0]):], method, mPath, append(applyMiddlewares, r.middlewares...)...)
		}
	}

	// Look for a matching handler
	for _, routeHandler := range r.routes {
		if _, ok := routeHandler.methods[method]; !ok {
			continue
		}

		if matches := routeHandler.matcher.FindStringSubmatch(path); len(matches) > 0 {
			for i := 1; i < len(matches); i++ {
				if i > len(routeHandler.pathArgNames) {
					break
				}

				ctx = CtxWithVar(ctx, routeHandler.pathArgNames[i-1], matches[i])
			}

			// handler found, apply middleware chain
			var handler HandlerFunc = routeHandler.handleFunc
			// middlewares attached to this router first
			for i := len(r.middlewares) - 1; i >= 0; i-- {
				handler = r.middlewares[i].Middleware(handler)
			}
			// middlewares from parent routers next
			for i := len(applyMiddlewares) - 1; i >= 0; i-- {
				handler = applyMiddlewares[i].Middleware(handler)
			}

			// Add the matched route info to the context
			mPath := routeHandler.path
			if matchedPath != "" {
				mPath = filepath.Join(matchedPath, mPath)
			}
			ctx = context.WithValue(ctx, ctxMatchedRouteKey{}, RouteInfo{
				Name:   routeHandler.name,
				Path:   mPath,
				Method: method,
			})
			return ctx, handler
		}
	}

	return ctx, nil
}

// CallResource implements backend.CallResourceHandler, allowing the Router to route resource API requests
func (r *Router) CallResource(
	ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender,
) error {
	// Get the appropriate handler (if one exists)
	ctx, handler := r.getHandler(ctx, req.Path, strings.ToUpper(req.Method), "")
	if handler == nil {
		if r.NotFoundHandler == nil {
			return errors.New("no handler found for the request")
		}

		// Return not found
		handler = r.NotFoundHandler
		for i := len(r.middlewares) - 1; i >= 0; i-- {
			handler = r.middlewares[i].Middleware(handler)
		}
		ctx = context.WithValue(ctx, ctxMatchedRouteKey{}, RouteInfo{
			Name:   "NotFoundHandler",
			Path:   req.Path,
			Method: req.Method,
		})
	}

	handler(ctx, req, sender)
	return nil
}

// ListenAndServe hooks into the backend of the plugin SDK to handle and serve resource API requests
// nolint: staticcheck
// TODO: migration to backend.Manage requires plugin ID
func (r *Router) ListenAndServe() error {
	return backend.Serve(backend.ServeOpts{
		CallResourceHandler: r,
	})
}

// RouteHandler is a Handler function assigned to a route
type RouteHandler struct {
	// matcher is the regexp matcher for the route, built from the path
	matcher *regexp.Regexp
	// name is a user-provided name for the route, may be empty
	name string
	// path is the user-provided path when registering the route, used to build the matcher expression
	path string
	// handleFunc is the function called to handle the route
	handleFunc func(ctx context.Context, req *backend.CallResourceRequest, res backend.CallResourceResponseSender)
	// pathArgNames is a list of names of path arguments, ordered so that they correspond to the match order in matcher
	pathArgNames []string
	// methods is the list of HTTP methods that this RouteHandler should handle
	methods map[string]struct{}
}

// Methods sets the methods the handler function will be called for
func (h *RouteHandler) Methods(methods []string) *RouteHandler {
	m := make(map[string]struct{})
	for _, method := range methods {
		m[strings.ToUpper(method)] = struct{}{}
	}
	h.methods = m
	return h
}

// Name sets the name of the RouteHandler.
// Names should be unique for retrieval purposes, but uniqueness is not enforced.
func (h *RouteHandler) Name(name string) *RouteHandler {
	h.name = name
	return h
}

type ctxMatchedRouteKey struct{}

// RouteInfo stores information about a matched route
type RouteInfo struct {
	// Name is the user-provided name on the route, if a name was provided
	Name string
	// Path is the matched route path, as provided by the user when adding the route to the router
	Path string
	// Method is the matched route method
	Method string
}

// MatchedRouteFromContext returns the RouteInfo set in the request context by the router
func MatchedRouteFromContext(ctx context.Context) RouteInfo {
	if route, ok := ctx.Value(ctxMatchedRouteKey{}).(RouteInfo); ok {
		return route
	}
	return RouteInfo{}
}
