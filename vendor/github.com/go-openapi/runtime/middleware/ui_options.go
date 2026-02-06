package middleware

import (
	"bytes"
	"encoding/gob"
	"fmt"
	"net/http"
	"path"
	"strings"
)

const (
	// constants that are common to all UI-serving middlewares
	defaultDocsPath  = "docs"
	defaultDocsURL   = "/swagger.json"
	defaultDocsTitle = "API Documentation"
)

// uiOptions defines common options for UI serving middlewares.
type uiOptions struct {
	// BasePath for the UI, defaults to: /
	BasePath string

	// Path combines with BasePath to construct the path to the UI, defaults to: "docs".
	Path string

	// SpecURL is the URL of the spec document.
	//
	// Defaults to: /swagger.json
	SpecURL string

	// Title for the documentation site, default to: API documentation
	Title string

	// Template specifies a custom template to serve the UI
	Template string
}

// toCommonUIOptions converts any UI option type to retain the common options.
//
// This uses gob encoding/decoding to convert common fields from one struct to another.
func toCommonUIOptions(opts interface{}) uiOptions {
	var buf bytes.Buffer
	enc := gob.NewEncoder(&buf)
	dec := gob.NewDecoder(&buf)
	var o uiOptions
	err := enc.Encode(opts)
	if err != nil {
		panic(err)
	}

	err = dec.Decode(&o)
	if err != nil {
		panic(err)
	}

	return o
}

func fromCommonToAnyOptions[T any](source uiOptions, target *T) {
	var buf bytes.Buffer
	enc := gob.NewEncoder(&buf)
	dec := gob.NewDecoder(&buf)
	err := enc.Encode(source)
	if err != nil {
		panic(err)
	}

	err = dec.Decode(target)
	if err != nil {
		panic(err)
	}
}

// UIOption can be applied to UI serving middleware, such as Context.APIHandler or
// Context.APIHandlerSwaggerUI to alter the defaut behavior.
type UIOption func(*uiOptions)

func uiOptionsWithDefaults(opts []UIOption) uiOptions {
	var o uiOptions
	for _, apply := range opts {
		apply(&o)
	}

	return o
}

// WithUIBasePath sets the base path from where to serve the UI assets.
//
// By default, Context middleware sets this value to the API base path.
func WithUIBasePath(base string) UIOption {
	return func(o *uiOptions) {
		if !strings.HasPrefix(base, "/") {
			base = "/" + base
		}
		o.BasePath = base
	}
}

// WithUIPath sets the path from where to serve the UI assets (i.e. /{basepath}/{path}.
func WithUIPath(pth string) UIOption {
	return func(o *uiOptions) {
		o.Path = pth
	}
}

// WithUISpecURL sets the path from where to serve swagger spec document.
//
// This may be specified as a full URL or a path.
//
// By default, this is "/swagger.json"
func WithUISpecURL(specURL string) UIOption {
	return func(o *uiOptions) {
		o.SpecURL = specURL
	}
}

// WithUITitle sets the title of the UI.
//
// By default, Context middleware sets this value to the title found in the API spec.
func WithUITitle(title string) UIOption {
	return func(o *uiOptions) {
		o.Title = title
	}
}

// WithTemplate allows to set a custom template for the UI.
//
// UI middleware will panic if the template does not parse or execute properly.
func WithTemplate(tpl string) UIOption {
	return func(o *uiOptions) {
		o.Template = tpl
	}
}

// EnsureDefaults in case some options are missing
func (r *uiOptions) EnsureDefaults() {
	if r.BasePath == "" {
		r.BasePath = "/"
	}
	if r.Path == "" {
		r.Path = defaultDocsPath
	}
	if r.SpecURL == "" {
		r.SpecURL = defaultDocsURL
	}
	if r.Title == "" {
		r.Title = defaultDocsTitle
	}
}

// serveUI creates a middleware that serves a templated asset as text/html.
func serveUI(pth string, assets []byte, next http.Handler) http.Handler {
	return http.HandlerFunc(func(rw http.ResponseWriter, r *http.Request) {
		if path.Clean(r.URL.Path) == pth {
			rw.Header().Set(contentTypeHeader, "text/html; charset=utf-8")
			rw.WriteHeader(http.StatusOK)
			_, _ = rw.Write(assets)

			return
		}

		if next != nil {
			next.ServeHTTP(rw, r)

			return
		}

		rw.Header().Set(contentTypeHeader, "text/plain")
		rw.WriteHeader(http.StatusNotFound)
		_, _ = rw.Write([]byte(fmt.Sprintf("%q not found", pth)))
	})
}
