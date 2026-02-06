// Copyright 2024 Prometheus Team
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package tracing

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptrace"

	"go.opentelemetry.io/contrib/instrumentation/net/http/httptrace/otelhttptrace"
	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
)

// Transport wraps the provided http.RoundTripper with one that starts a span
// and injects the span context into the outbound request headers. If the
// provided http.RoundTripper is nil, http.DefaultTransport will be used as the
// base http.RoundTripper.
func Transport(rt http.RoundTripper, name string) http.RoundTripper {
	rt = otelhttp.NewTransport(rt,
		otelhttp.WithClientTrace(func(ctx context.Context) *httptrace.ClientTrace {
			return otelhttptrace.NewClientTrace(ctx, otelhttptrace.WithoutSubSpans())
		}),
		otelhttp.WithSpanNameFormatter(func(_ string, r *http.Request) string {
			return name + "/HTTP " + r.Method
		}),
	)

	return rt
}

// Middleware returns a new HTTP handler that will trace all requests with the
// HTTP method and path as the span name.
func Middleware(handler http.Handler) http.Handler {
	return otelhttp.NewHandler(handler, "",
		otelhttp.WithSpanNameFormatter(func(_ string, r *http.Request) string {
			return fmt.Sprintf("%s %s", r.Method, r.URL.Path)
		}),
	)
}
