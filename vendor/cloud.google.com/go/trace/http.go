// Copyright 2017 Google Inc. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// +build go1.7

package trace

import (
	"net/http"
)

// Transport is an http.RoundTripper that traces the outgoing requests.
//
// Transport is safe for concurrent usage.
type Transport struct {
	// Base is the base http.RoundTripper to be used to do the actual request.
	//
	// Optional. If nil, http.DefaultTransport is used.
	Base http.RoundTripper
}

// RoundTrip creates a trace.Span and inserts it into the outgoing request's headers.
// The created span can follow a parent span, if a parent is presented in
// the request's context.
func (t Transport) RoundTrip(req *http.Request) (*http.Response, error) {
	span := FromContext(req.Context()).NewRemoteChild(req)
	resp, err := t.base().RoundTrip(req)

	// TODO(jbd): Is it possible to defer the span.Finish?
	// In cases where RoundTrip panics, we still can finish the span.
	span.Finish(WithResponse(resp))
	return resp, err
}

// CancelRequest cancels an in-flight request by closing its connection.
func (t Transport) CancelRequest(req *http.Request) {
	type canceler interface {
		CancelRequest(*http.Request)
	}
	if cr, ok := t.base().(canceler); ok {
		cr.CancelRequest(req)
	}
}

func (t Transport) base() http.RoundTripper {
	if t.Base != nil {
		return t.Base
	}
	return http.DefaultTransport
}

// HTTPHandler returns a http.Handler from the given handler
// that is aware of the incoming request's span.
// The span can be extracted from the incoming request in handler
// functions from incoming request's context:
//
//    span := trace.FromContext(r.Context())
//
// The span will be auto finished by the handler.
func (c *Client) HTTPHandler(h http.Handler) http.Handler {
	if c == nil {
		return h
	}
	return &handler{traceClient: c, handler: h}
}

type handler struct {
	traceClient *Client
	handler     http.Handler
}

func (h *handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	traceID, parentSpanID, options, optionsOk, ok := traceInfoFromHeader(r.Header.Get(httpHeader))
	if !ok {
		traceID = nextTraceID()
	}
	t := &trace{
		traceID:       traceID,
		client:        h.traceClient,
		globalOptions: options,
		localOptions:  options,
	}
	span := startNewChildWithRequest(r, t, parentSpanID)
	span.span.Kind = spanKindServer
	span.rootSpan = true
	configureSpanFromPolicy(span, h.traceClient.policy, ok)
	defer span.Finish()

	r = r.WithContext(NewContext(r.Context(), span))
	if ok && !optionsOk {
		// Inject the trace context back to the response with the sampling options.
		// TODO(jbd): Remove when there is a better way to report the client's sampling.
		w.Header().Set(httpHeader, spanHeader(traceID, parentSpanID, span.trace.localOptions))
	}
	h.handler.ServeHTTP(w, r)
}
