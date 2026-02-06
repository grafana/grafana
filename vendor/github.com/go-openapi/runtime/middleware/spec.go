// Copyright 2015 go-swagger maintainers
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package middleware

import (
	"net/http"
	"path"
)

const (
	contentTypeHeader = "Content-Type"
	applicationJSON   = "application/json"
)

// SpecOption can be applied to the Spec serving middleware
type SpecOption func(*specOptions)

var defaultSpecOptions = specOptions{
	Path:     "",
	Document: "swagger.json",
}

type specOptions struct {
	Path     string
	Document string
}

func specOptionsWithDefaults(opts []SpecOption) specOptions {
	o := defaultSpecOptions
	for _, apply := range opts {
		apply(&o)
	}

	return o
}

// Spec creates a middleware to serve a swagger spec as a JSON document.
//
// This allows for altering the spec before starting the http listener.
//
// The basePath argument indicates the path of the spec document (defaults to "/").
// Additional SpecOption can be used to change the name of the document (defaults to "swagger.json").
func Spec(basePath string, b []byte, next http.Handler, opts ...SpecOption) http.Handler {
	if basePath == "" {
		basePath = "/"
	}
	o := specOptionsWithDefaults(opts)
	pth := path.Join(basePath, o.Path, o.Document)

	return http.HandlerFunc(func(rw http.ResponseWriter, r *http.Request) {
		if path.Clean(r.URL.Path) == pth {
			rw.Header().Set(contentTypeHeader, applicationJSON)
			rw.WriteHeader(http.StatusOK)
			_, _ = rw.Write(b)

			return
		}

		if next != nil {
			next.ServeHTTP(rw, r)

			return
		}

		rw.Header().Set(contentTypeHeader, applicationJSON)
		rw.WriteHeader(http.StatusNotFound)
	})
}

// WithSpecPath sets the path to be joined to the base path of the Spec middleware.
//
// This is empty by default.
func WithSpecPath(pth string) SpecOption {
	return func(o *specOptions) {
		o.Path = pth
	}
}

// WithSpecDocument sets the name of the JSON document served as a spec.
//
// By default, this is "swagger.json"
func WithSpecDocument(doc string) SpecOption {
	return func(o *specOptions) {
		if doc == "" {
			return
		}

		o.Document = doc
	}
}
