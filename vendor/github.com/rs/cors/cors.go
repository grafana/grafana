/*
Package cors is net/http handler to handle CORS related requests
as defined by http://www.w3.org/TR/cors/

You can configure it by passing an option struct to cors.New:

	c := cors.New(cors.Options{
	    AllowedOrigins:   []string{"foo.com"},
	    AllowedMethods:   []string{http.MethodGet, http.MethodPost, http.MethodDelete},
	    AllowCredentials: true,
	})

Then insert the handler in the chain:

	handler = c.Handler(handler)

See Options documentation for more options.

The resulting handler is a standard net/http handler.
*/
package cors

import (
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"

	"github.com/rs/cors/internal"
)

var headerVaryOrigin = []string{"Origin"}
var headerOriginAll = []string{"*"}
var headerTrue = []string{"true"}

// Options is a configuration container to setup the CORS middleware.
type Options struct {
	// AllowedOrigins is a list of origins a cross-domain request can be executed from.
	// If the special "*" value is present in the list, all origins will be allowed.
	// An origin may contain a wildcard (*) to replace 0 or more characters
	// (i.e.: http://*.domain.com). Usage of wildcards implies a small performance penalty.
	// Only one wildcard can be used per origin.
	// Default value is ["*"]
	AllowedOrigins []string
	// AllowOriginFunc is a custom function to validate the origin. It take the
	// origin as argument and returns true if allowed or false otherwise. If
	// this option is set, the content of `AllowedOrigins` is ignored.
	AllowOriginFunc func(origin string) bool
	// AllowOriginRequestFunc is a custom function to validate the origin. It
	// takes the HTTP Request object and the origin as argument and returns true
	// if allowed or false otherwise. If headers are used take the decision,
	// consider using AllowOriginVaryRequestFunc instead. If this option is set,
	// the contents of `AllowedOrigins`, `AllowOriginFunc` are ignored.
	//
	// Deprecated: use `AllowOriginVaryRequestFunc` instead.
	AllowOriginRequestFunc func(r *http.Request, origin string) bool
	// AllowOriginVaryRequestFunc is a custom function to validate the origin.
	// It takes the HTTP Request object and the origin as argument and returns
	// true if allowed or false otherwise with a list of headers used to take
	// that decision if any so they can be added to the Vary header. If this
	// option is set, the contents of `AllowedOrigins`, `AllowOriginFunc` and
	// `AllowOriginRequestFunc` are ignored.
	AllowOriginVaryRequestFunc func(r *http.Request, origin string) (bool, []string)
	// AllowedMethods is a list of methods the client is allowed to use with
	// cross-domain requests. Default value is simple methods (HEAD, GET and POST).
	AllowedMethods []string
	// AllowedHeaders is list of non simple headers the client is allowed to use with
	// cross-domain requests.
	// If the special "*" value is present in the list, all headers will be allowed.
	// Default value is [].
	AllowedHeaders []string
	// ExposedHeaders indicates which headers are safe to expose to the API of a CORS
	// API specification
	ExposedHeaders []string
	// MaxAge indicates how long (in seconds) the results of a preflight request
	// can be cached. Default value is 0, which stands for no
	// Access-Control-Max-Age header to be sent back, resulting in browsers
	// using their default value (5s by spec). If you need to force a 0 max-age,
	// set `MaxAge` to a negative value (ie: -1).
	MaxAge int
	// AllowCredentials indicates whether the request can include user credentials like
	// cookies, HTTP authentication or client side SSL certificates.
	AllowCredentials bool
	// AllowPrivateNetwork indicates whether to accept cross-origin requests over a
	// private network.
	AllowPrivateNetwork bool
	// OptionsPassthrough instructs preflight to let other potential next handlers to
	// process the OPTIONS method. Turn this on if your application handles OPTIONS.
	OptionsPassthrough bool
	// Provides a status code to use for successful OPTIONS requests.
	// Default value is http.StatusNoContent (204).
	OptionsSuccessStatus int
	// Debugging flag adds additional output to debug server side CORS issues
	Debug bool
	// Adds a custom logger, implies Debug is true
	Logger Logger
}

// Logger generic interface for logger
type Logger interface {
	Printf(string, ...interface{})
}

// Cors http handler
type Cors struct {
	// Debug logger
	Log Logger
	// Normalized list of plain allowed origins
	allowedOrigins []string
	// List of allowed origins containing wildcards
	allowedWOrigins []wildcard
	// Optional origin validator function
	allowOriginFunc func(r *http.Request, origin string) (bool, []string)
	// Normalized list of allowed headers
	// Note: the Fetch standard guarantees that CORS-unsafe request-header names
	// (i.e. the values listed in the Access-Control-Request-Headers header)
	// are unique and sorted;
	// see https://fetch.spec.whatwg.org/#cors-unsafe-request-header-names.
	allowedHeaders internal.SortedSet
	// Normalized list of allowed methods
	allowedMethods []string
	// Pre-computed normalized list of exposed headers
	exposedHeaders []string
	// Pre-computed maxAge header value
	maxAge []string
	// Set to true when allowed origins contains a "*"
	allowedOriginsAll bool
	// Set to true when allowed headers contains a "*"
	allowedHeadersAll bool
	// Status code to use for successful OPTIONS requests
	optionsSuccessStatus int
	allowCredentials     bool
	allowPrivateNetwork  bool
	optionPassthrough    bool
	preflightVary        []string
}

// New creates a new Cors handler with the provided options.
func New(options Options) *Cors {
	c := &Cors{
		allowCredentials:    options.AllowCredentials,
		allowPrivateNetwork: options.AllowPrivateNetwork,
		optionPassthrough:   options.OptionsPassthrough,
		Log:                 options.Logger,
	}
	if options.Debug && c.Log == nil {
		c.Log = log.New(os.Stdout, "[cors] ", log.LstdFlags)
	}

	// Allowed origins
	switch {
	case options.AllowOriginVaryRequestFunc != nil:
		c.allowOriginFunc = options.AllowOriginVaryRequestFunc
	case options.AllowOriginRequestFunc != nil:
		c.allowOriginFunc = func(r *http.Request, origin string) (bool, []string) {
			return options.AllowOriginRequestFunc(r, origin), nil
		}
	case options.AllowOriginFunc != nil:
		c.allowOriginFunc = func(r *http.Request, origin string) (bool, []string) {
			return options.AllowOriginFunc(origin), nil
		}
	case len(options.AllowedOrigins) == 0:
		if c.allowOriginFunc == nil {
			// Default is all origins
			c.allowedOriginsAll = true
		}
	default:
		c.allowedOrigins = []string{}
		c.allowedWOrigins = []wildcard{}
		for _, origin := range options.AllowedOrigins {
			// Note: for origins matching, the spec requires a case-sensitive matching.
			// As it may error prone, we chose to ignore the spec here.
			origin = strings.ToLower(origin)
			if origin == "*" {
				// If "*" is present in the list, turn the whole list into a match all
				c.allowedOriginsAll = true
				c.allowedOrigins = nil
				c.allowedWOrigins = nil
				break
			} else if i := strings.IndexByte(origin, '*'); i >= 0 {
				// Split the origin in two: start and end string without the *
				w := wildcard{origin[0:i], origin[i+1:]}
				c.allowedWOrigins = append(c.allowedWOrigins, w)
			} else {
				c.allowedOrigins = append(c.allowedOrigins, origin)
			}
		}
	}

	// Allowed Headers
	// Note: the Fetch standard guarantees that CORS-unsafe request-header names
	// (i.e. the values listed in the Access-Control-Request-Headers header)
	// are lowercase; see https://fetch.spec.whatwg.org/#cors-unsafe-request-header-names.
	if len(options.AllowedHeaders) == 0 {
		// Use sensible defaults
		c.allowedHeaders = internal.NewSortedSet("accept", "content-type", "x-requested-with")
	} else {
		normalized := convert(options.AllowedHeaders, strings.ToLower)
		c.allowedHeaders = internal.NewSortedSet(normalized...)
		for _, h := range options.AllowedHeaders {
			if h == "*" {
				c.allowedHeadersAll = true
				c.allowedHeaders = internal.SortedSet{}
				break
			}
		}
	}

	// Allowed Methods
	if len(options.AllowedMethods) == 0 {
		// Default is spec's "simple" methods
		c.allowedMethods = []string{http.MethodGet, http.MethodPost, http.MethodHead}
	} else {
		c.allowedMethods = options.AllowedMethods
	}

	// Options Success Status Code
	if options.OptionsSuccessStatus == 0 {
		c.optionsSuccessStatus = http.StatusNoContent
	} else {
		c.optionsSuccessStatus = options.OptionsSuccessStatus
	}

	// Pre-compute exposed headers header value
	if len(options.ExposedHeaders) > 0 {
		c.exposedHeaders = []string{strings.Join(convert(options.ExposedHeaders, http.CanonicalHeaderKey), ", ")}
	}

	// Pre-compute prefight Vary header to save allocations
	if c.allowPrivateNetwork {
		c.preflightVary = []string{"Origin, Access-Control-Request-Method, Access-Control-Request-Headers, Access-Control-Request-Private-Network"}
	} else {
		c.preflightVary = []string{"Origin, Access-Control-Request-Method, Access-Control-Request-Headers"}
	}

	// Precompute max-age
	if options.MaxAge > 0 {
		c.maxAge = []string{strconv.Itoa(options.MaxAge)}
	} else if options.MaxAge < 0 {
		c.maxAge = []string{"0"}
	}

	return c
}

// Default creates a new Cors handler with default options.
func Default() *Cors {
	return New(Options{})
}

// AllowAll create a new Cors handler with permissive configuration allowing all
// origins with all standard methods with any header and credentials.
func AllowAll() *Cors {
	return New(Options{
		AllowedOrigins: []string{"*"},
		AllowedMethods: []string{
			http.MethodHead,
			http.MethodGet,
			http.MethodPost,
			http.MethodPut,
			http.MethodPatch,
			http.MethodDelete,
		},
		AllowedHeaders:   []string{"*"},
		AllowCredentials: false,
	})
}

// Handler apply the CORS specification on the request, and add relevant CORS headers
// as necessary.
func (c *Cors) Handler(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodOptions && r.Header.Get("Access-Control-Request-Method") != "" {
			c.logf("Handler: Preflight request")
			c.handlePreflight(w, r)
			// Preflight requests are standalone and should stop the chain as some other
			// middleware may not handle OPTIONS requests correctly. One typical example
			// is authentication middleware ; OPTIONS requests won't carry authentication
			// headers (see #1)
			if c.optionPassthrough {
				h.ServeHTTP(w, r)
			} else {
				w.WriteHeader(c.optionsSuccessStatus)
			}
		} else {
			c.logf("Handler: Actual request")
			c.handleActualRequest(w, r)
			h.ServeHTTP(w, r)
		}
	})
}

// HandlerFunc provides Martini compatible handler
func (c *Cors) HandlerFunc(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions && r.Header.Get("Access-Control-Request-Method") != "" {
		c.logf("HandlerFunc: Preflight request")
		c.handlePreflight(w, r)

		w.WriteHeader(c.optionsSuccessStatus)
	} else {
		c.logf("HandlerFunc: Actual request")
		c.handleActualRequest(w, r)
	}
}

// Negroni compatible interface
func (c *Cors) ServeHTTP(w http.ResponseWriter, r *http.Request, next http.HandlerFunc) {
	if r.Method == http.MethodOptions && r.Header.Get("Access-Control-Request-Method") != "" {
		c.logf("ServeHTTP: Preflight request")
		c.handlePreflight(w, r)
		// Preflight requests are standalone and should stop the chain as some other
		// middleware may not handle OPTIONS requests correctly. One typical example
		// is authentication middleware ; OPTIONS requests won't carry authentication
		// headers (see #1)
		if c.optionPassthrough {
			next(w, r)
		} else {
			w.WriteHeader(c.optionsSuccessStatus)
		}
	} else {
		c.logf("ServeHTTP: Actual request")
		c.handleActualRequest(w, r)
		next(w, r)
	}
}

// handlePreflight handles pre-flight CORS requests
func (c *Cors) handlePreflight(w http.ResponseWriter, r *http.Request) {
	headers := w.Header()
	origin := r.Header.Get("Origin")

	if r.Method != http.MethodOptions {
		c.logf("  Preflight aborted: %s!=OPTIONS", r.Method)
		return
	}
	// Always set Vary headers
	// see https://github.com/rs/cors/issues/10,
	//     https://github.com/rs/cors/commit/dbdca4d95feaa7511a46e6f1efb3b3aa505bc43f#commitcomment-12352001
	if vary, found := headers["Vary"]; found {
		headers["Vary"] = append(vary, c.preflightVary[0])
	} else {
		headers["Vary"] = c.preflightVary
	}
	allowed, additionalVaryHeaders := c.isOriginAllowed(r, origin)
	if len(additionalVaryHeaders) > 0 {
		headers.Add("Vary", strings.Join(convert(additionalVaryHeaders, http.CanonicalHeaderKey), ", "))
	}

	if origin == "" {
		c.logf("  Preflight aborted: empty origin")
		return
	}
	if !allowed {
		c.logf("  Preflight aborted: origin '%s' not allowed", origin)
		return
	}

	reqMethod := r.Header.Get("Access-Control-Request-Method")
	if !c.isMethodAllowed(reqMethod) {
		c.logf("  Preflight aborted: method '%s' not allowed", reqMethod)
		return
	}
	// Note: the Fetch standard guarantees that at most one
	// Access-Control-Request-Headers header is present in the preflight request;
	// see step 5.2 in https://fetch.spec.whatwg.org/#cors-preflight-fetch-0.
	// However, some gateways split that header into multiple headers of the same name;
	// see https://github.com/rs/cors/issues/184.
	reqHeaders, found := r.Header["Access-Control-Request-Headers"]
	if found && !c.allowedHeadersAll && !c.allowedHeaders.Accepts(reqHeaders) {
		c.logf("  Preflight aborted: headers '%v' not allowed", reqHeaders)
		return
	}
	if c.allowedOriginsAll {
		headers["Access-Control-Allow-Origin"] = headerOriginAll
	} else {
		headers["Access-Control-Allow-Origin"] = r.Header["Origin"]
	}
	// Spec says: Since the list of methods can be unbounded, simply returning the method indicated
	// by Access-Control-Request-Method (if supported) can be enough
	headers["Access-Control-Allow-Methods"] = r.Header["Access-Control-Request-Method"]
	if found && len(reqHeaders[0]) > 0 {
		// Spec says: Since the list of headers can be unbounded, simply returning supported headers
		// from Access-Control-Request-Headers can be enough
		headers["Access-Control-Allow-Headers"] = reqHeaders
	}
	if c.allowCredentials {
		headers["Access-Control-Allow-Credentials"] = headerTrue
	}
	if c.allowPrivateNetwork && r.Header.Get("Access-Control-Request-Private-Network") == "true" {
		headers["Access-Control-Allow-Private-Network"] = headerTrue
	}
	if len(c.maxAge) > 0 {
		headers["Access-Control-Max-Age"] = c.maxAge
	}
	c.logf("  Preflight response headers: %v", headers)
}

// handleActualRequest handles simple cross-origin requests, actual request or redirects
func (c *Cors) handleActualRequest(w http.ResponseWriter, r *http.Request) {
	headers := w.Header()
	origin := r.Header.Get("Origin")

	allowed, additionalVaryHeaders := c.isOriginAllowed(r, origin)

	// Always set Vary, see https://github.com/rs/cors/issues/10
	if vary := headers["Vary"]; vary == nil {
		headers["Vary"] = headerVaryOrigin
	} else {
		headers["Vary"] = append(vary, headerVaryOrigin[0])
	}
	if len(additionalVaryHeaders) > 0 {
		headers.Add("Vary", strings.Join(convert(additionalVaryHeaders, http.CanonicalHeaderKey), ", "))
	}
	if origin == "" {
		c.logf("  Actual request no headers added: missing origin")
		return
	}
	if !allowed {
		c.logf("  Actual request no headers added: origin '%s' not allowed", origin)
		return
	}

	// Note that spec does define a way to specifically disallow a simple method like GET or
	// POST. Access-Control-Allow-Methods is only used for pre-flight requests and the
	// spec doesn't instruct to check the allowed methods for simple cross-origin requests.
	// We think it's a nice feature to be able to have control on those methods though.
	if !c.isMethodAllowed(r.Method) {
		c.logf("  Actual request no headers added: method '%s' not allowed", r.Method)
		return
	}
	if c.allowedOriginsAll {
		headers["Access-Control-Allow-Origin"] = headerOriginAll
	} else {
		headers["Access-Control-Allow-Origin"] = r.Header["Origin"]
	}
	if len(c.exposedHeaders) > 0 {
		headers["Access-Control-Expose-Headers"] = c.exposedHeaders
	}
	if c.allowCredentials {
		headers["Access-Control-Allow-Credentials"] = headerTrue
	}
	c.logf("  Actual response added headers: %v", headers)
}

// convenience method. checks if a logger is set.
func (c *Cors) logf(format string, a ...interface{}) {
	if c.Log != nil {
		c.Log.Printf(format, a...)
	}
}

// check the Origin of a request. No origin at all is also allowed.
func (c *Cors) OriginAllowed(r *http.Request) bool {
	origin := r.Header.Get("Origin")
	allowed, _ := c.isOriginAllowed(r, origin)
	return allowed
}

// isOriginAllowed checks if a given origin is allowed to perform cross-domain requests
// on the endpoint
func (c *Cors) isOriginAllowed(r *http.Request, origin string) (allowed bool, varyHeaders []string) {
	if c.allowOriginFunc != nil {
		return c.allowOriginFunc(r, origin)
	}
	if c.allowedOriginsAll {
		return true, nil
	}
	origin = strings.ToLower(origin)
	for _, o := range c.allowedOrigins {
		if o == origin {
			return true, nil
		}
	}
	for _, w := range c.allowedWOrigins {
		if w.match(origin) {
			return true, nil
		}
	}
	return false, nil
}

// isMethodAllowed checks if a given method can be used as part of a cross-domain request
// on the endpoint
func (c *Cors) isMethodAllowed(method string) bool {
	if len(c.allowedMethods) == 0 {
		// If no method allowed, always return false, even for preflight request
		return false
	}
	if method == http.MethodOptions {
		// Always allow preflight requests
		return true
	}
	for _, m := range c.allowedMethods {
		if m == method {
			return true
		}
	}
	return false
}
