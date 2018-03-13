// Copyright 2014 The Macaron Authors
//
// Licensed under the Apache License, Version 2.0 (the "License"): you may
// not use this file except in compliance with the License. You may obtain
// a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
// WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
// License for the specific language governing permissions and limitations
// under the License.

package macaron

import (
	"net/http"
	"strings"
	"sync"
)

var (
	// Known HTTP methods.
	_HTTP_METHODS = map[string]bool{
		"GET":     true,
		"POST":    true,
		"PUT":     true,
		"DELETE":  true,
		"PATCH":   true,
		"OPTIONS": true,
		"HEAD":    true,
	}
)

// routeMap represents a thread-safe map for route tree.
type routeMap struct {
	lock   sync.RWMutex
	routes map[string]map[string]*Leaf
}

// NewRouteMap initializes and returns a new routeMap.
func NewRouteMap() *routeMap {
	rm := &routeMap{
		routes: make(map[string]map[string]*Leaf),
	}
	for m := range _HTTP_METHODS {
		rm.routes[m] = make(map[string]*Leaf)
	}
	return rm
}

// getLeaf returns Leaf object if a route has been registered.
func (rm *routeMap) getLeaf(method, pattern string) *Leaf {
	rm.lock.RLock()
	defer rm.lock.RUnlock()

	return rm.routes[method][pattern]
}

// add adds new route to route tree map.
func (rm *routeMap) add(method, pattern string, leaf *Leaf) {
	rm.lock.Lock()
	defer rm.lock.Unlock()

	rm.routes[method][pattern] = leaf
}

type group struct {
	pattern  string
	handlers []Handler
}

// Router represents a Macaron router layer.
type Router struct {
	m        *Macaron
	autoHead bool
	routers  map[string]*Tree
	*routeMap
	namedRoutes map[string]*Leaf

	groups              []group
	notFound            http.HandlerFunc
	internalServerError func(*Context, error)

	// handlerWrapper is used to wrap arbitrary function from Handler to inject.FastInvoker.
	handlerWrapper func(Handler) Handler
}

func NewRouter() *Router {
	return &Router{
		routers:     make(map[string]*Tree),
		routeMap:    NewRouteMap(),
		namedRoutes: make(map[string]*Leaf),
	}
}

// SetAutoHead sets the value who determines whether add HEAD method automatically
// when GET method is added. Combo router will not be affected by this value.
func (r *Router) SetAutoHead(v bool) {
	r.autoHead = v
}

type Params map[string]string

// Handle is a function that can be registered to a route to handle HTTP requests.
// Like http.HandlerFunc, but has a third parameter for the values of wildcards (variables).
type Handle func(http.ResponseWriter, *http.Request, Params)

// Route represents a wrapper of leaf route and upper level router.
type Route struct {
	router *Router
	leaf   *Leaf
}

// Name sets name of route.
func (r *Route) Name(name string) {
	if len(name) == 0 {
		panic("route name cannot be empty")
	} else if r.router.namedRoutes[name] != nil {
		panic("route with given name already exists: " + name)
	}
	r.router.namedRoutes[name] = r.leaf
}

// handle adds new route to the router tree.
func (r *Router) handle(method, pattern string, handle Handle) *Route {
	method = strings.ToUpper(method)

	var leaf *Leaf
	// Prevent duplicate routes.
	if leaf = r.getLeaf(method, pattern); leaf != nil {
		return &Route{r, leaf}
	}

	// Validate HTTP methods.
	if !_HTTP_METHODS[method] && method != "*" {
		panic("unknown HTTP method: " + method)
	}

	// Generate methods need register.
	methods := make(map[string]bool)
	if method == "*" {
		for m := range _HTTP_METHODS {
			methods[m] = true
		}
	} else {
		methods[method] = true
	}

	// Add to router tree.
	for m := range methods {
		if t, ok := r.routers[m]; ok {
			leaf = t.Add(pattern, handle)
		} else {
			t := NewTree()
			leaf = t.Add(pattern, handle)
			r.routers[m] = t
		}
		r.add(m, pattern, leaf)
	}
	return &Route{r, leaf}
}

// Handle registers a new request handle with the given pattern, method and handlers.
func (r *Router) Handle(method string, pattern string, handlers []Handler) *Route {
	if len(r.groups) > 0 {
		groupPattern := ""
		h := make([]Handler, 0)
		for _, g := range r.groups {
			groupPattern += g.pattern
			h = append(h, g.handlers...)
		}

		pattern = groupPattern + pattern
		h = append(h, handlers...)
		handlers = h
	}
	handlers = validateAndWrapHandlers(handlers, r.handlerWrapper)

	return r.handle(method, pattern, func(resp http.ResponseWriter, req *http.Request, params Params) {
		c := r.m.createContext(resp, req)
		c.params = params
		c.handlers = make([]Handler, 0, len(r.m.handlers)+len(handlers))
		c.handlers = append(c.handlers, r.m.handlers...)
		c.handlers = append(c.handlers, handlers...)
		c.run()
	})
}

func (r *Router) Group(pattern string, fn func(), h ...Handler) {
	r.groups = append(r.groups, group{pattern, h})
	fn()
	r.groups = r.groups[:len(r.groups)-1]
}

// Get is a shortcut for r.Handle("GET", pattern, handlers)
func (r *Router) Get(pattern string, h ...Handler) (leaf *Route) {
	leaf = r.Handle("GET", pattern, h)
	if r.autoHead {
		r.Head(pattern, h...)
	}
	return leaf
}

// Patch is a shortcut for r.Handle("PATCH", pattern, handlers)
func (r *Router) Patch(pattern string, h ...Handler) *Route {
	return r.Handle("PATCH", pattern, h)
}

// Post is a shortcut for r.Handle("POST", pattern, handlers)
func (r *Router) Post(pattern string, h ...Handler) *Route {
	return r.Handle("POST", pattern, h)
}

// Put is a shortcut for r.Handle("PUT", pattern, handlers)
func (r *Router) Put(pattern string, h ...Handler) *Route {
	return r.Handle("PUT", pattern, h)
}

// Delete is a shortcut for r.Handle("DELETE", pattern, handlers)
func (r *Router) Delete(pattern string, h ...Handler) *Route {
	return r.Handle("DELETE", pattern, h)
}

// Options is a shortcut for r.Handle("OPTIONS", pattern, handlers)
func (r *Router) Options(pattern string, h ...Handler) *Route {
	return r.Handle("OPTIONS", pattern, h)
}

// Head is a shortcut for r.Handle("HEAD", pattern, handlers)
func (r *Router) Head(pattern string, h ...Handler) *Route {
	return r.Handle("HEAD", pattern, h)
}

// Any is a shortcut for r.Handle("*", pattern, handlers)
func (r *Router) Any(pattern string, h ...Handler) *Route {
	return r.Handle("*", pattern, h)
}

// Route is a shortcut for same handlers but different HTTP methods.
//
// Example:
// 		m.Route("/", "GET,POST", h)
func (r *Router) Route(pattern, methods string, h ...Handler) (route *Route) {
	for _, m := range strings.Split(methods, ",") {
		route = r.Handle(strings.TrimSpace(m), pattern, h)
	}
	return route
}

// Combo returns a combo router.
func (r *Router) Combo(pattern string, h ...Handler) *ComboRouter {
	return &ComboRouter{r, pattern, h, map[string]bool{}, nil}
}

// NotFound configurates http.HandlerFunc which is called when no matching route is
// found. If it is not set, http.NotFound is used.
// Be sure to set 404 response code in your handler.
func (r *Router) NotFound(handlers ...Handler) {
	handlers = validateAndWrapHandlers(handlers)
	r.notFound = func(rw http.ResponseWriter, req *http.Request) {
		c := r.m.createContext(rw, req)
		c.handlers = make([]Handler, 0, len(r.m.handlers)+len(handlers))
		c.handlers = append(c.handlers, r.m.handlers...)
		c.handlers = append(c.handlers, handlers...)
		c.run()
	}
}

// InternalServerError configurates handler which is called when route handler returns
// error. If it is not set, default handler is used.
// Be sure to set 500 response code in your handler.
func (r *Router) InternalServerError(handlers ...Handler) {
	handlers = validateAndWrapHandlers(handlers)
	r.internalServerError = func(c *Context, err error) {
		c.index = 0
		c.handlers = handlers
		c.Map(err)
		c.run()
	}
}

// SetHandlerWrapper sets handlerWrapper for the router.
func (r *Router) SetHandlerWrapper(f func(Handler) Handler) {
	r.handlerWrapper = f
}

func (r *Router) ServeHTTP(rw http.ResponseWriter, req *http.Request) {
	if t, ok := r.routers[req.Method]; ok {
		// Fast match for static routes
		leaf := r.getLeaf(req.Method, req.URL.Path)
		if leaf != nil {
			leaf.handle(rw, req, nil)
			return
		}

		h, p, ok := t.Match(req.URL.EscapedPath())
		if ok {
			if splat, ok := p["*0"]; ok {
				p["*"] = splat // Easy name.
			}
			h(rw, req, p)
			return
		}
	}

	r.notFound(rw, req)
}

// URLFor builds path part of URL by given pair values.
func (r *Router) URLFor(name string, pairs ...string) string {
	leaf, ok := r.namedRoutes[name]
	if !ok {
		panic("route with given name does not exists: " + name)
	}
	return leaf.URLPath(pairs...)
}

// ComboRouter represents a combo router.
type ComboRouter struct {
	router   *Router
	pattern  string
	handlers []Handler
	methods  map[string]bool // Registered methods.

	lastRoute *Route
}

func (cr *ComboRouter) checkMethod(name string) {
	if cr.methods[name] {
		panic("method '" + name + "' has already been registered")
	}
	cr.methods[name] = true
}

func (cr *ComboRouter) route(fn func(string, ...Handler) *Route, method string, h ...Handler) *ComboRouter {
	cr.checkMethod(method)
	cr.lastRoute = fn(cr.pattern, append(cr.handlers, h...)...)
	return cr
}

func (cr *ComboRouter) Get(h ...Handler) *ComboRouter {
	return cr.route(cr.router.Get, "GET", h...)
}

func (cr *ComboRouter) Patch(h ...Handler) *ComboRouter {
	return cr.route(cr.router.Patch, "PATCH", h...)
}

func (cr *ComboRouter) Post(h ...Handler) *ComboRouter {
	return cr.route(cr.router.Post, "POST", h...)
}

func (cr *ComboRouter) Put(h ...Handler) *ComboRouter {
	return cr.route(cr.router.Put, "PUT", h...)
}

func (cr *ComboRouter) Delete(h ...Handler) *ComboRouter {
	return cr.route(cr.router.Delete, "DELETE", h...)
}

func (cr *ComboRouter) Options(h ...Handler) *ComboRouter {
	return cr.route(cr.router.Options, "OPTIONS", h...)
}

func (cr *ComboRouter) Head(h ...Handler) *ComboRouter {
	return cr.route(cr.router.Head, "HEAD", h...)
}

// Name sets name of ComboRouter route.
func (cr *ComboRouter) Name(name string) {
	if cr.lastRoute == nil {
		panic("no corresponding route to be named")
	}
	cr.lastRoute.Name(name)
}
