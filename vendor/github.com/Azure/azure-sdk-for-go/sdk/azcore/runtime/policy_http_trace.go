//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

package runtime

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore/internal/exported"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/internal/shared"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/policy"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/tracing"
)

const (
	attrHTTPMethod     = "http.method"
	attrHTTPURL        = "http.url"
	attrHTTPUserAgent  = "http.user_agent"
	attrHTTPStatusCode = "http.status_code"

	attrAZClientReqID  = "az.client_request_id"
	attrAZServiceReqID = "az.service_request_id"

	attrNetPeerName = "net.peer.name"
)

// newHTTPTracePolicy creates a new instance of the httpTracePolicy.
//   - allowedQueryParams contains the user-specified query parameters that don't need to be redacted from the trace
func newHTTPTracePolicy(allowedQueryParams []string) exported.Policy {
	return &httpTracePolicy{allowedQP: getAllowedQueryParams(allowedQueryParams)}
}

// httpTracePolicy is a policy that creates a trace for the HTTP request and its response
type httpTracePolicy struct {
	allowedQP map[string]struct{}
}

// Do implements the pipeline.Policy interfaces for the httpTracePolicy type.
func (h *httpTracePolicy) Do(req *policy.Request) (resp *http.Response, err error) {
	rawTracer := req.Raw().Context().Value(shared.CtxWithTracingTracer{})
	if tracer, ok := rawTracer.(tracing.Tracer); ok && tracer.Enabled() {
		attributes := []tracing.Attribute{
			{Key: attrHTTPMethod, Value: req.Raw().Method},
			{Key: attrHTTPURL, Value: getSanitizedURL(*req.Raw().URL, h.allowedQP)},
			{Key: attrNetPeerName, Value: req.Raw().URL.Host},
		}

		if ua := req.Raw().Header.Get(shared.HeaderUserAgent); ua != "" {
			attributes = append(attributes, tracing.Attribute{Key: attrHTTPUserAgent, Value: ua})
		}
		if reqID := req.Raw().Header.Get(shared.HeaderXMSClientRequestID); reqID != "" {
			attributes = append(attributes, tracing.Attribute{Key: attrAZClientReqID, Value: reqID})
		}

		ctx := req.Raw().Context()
		ctx, span := tracer.Start(ctx, "HTTP "+req.Raw().Method, &tracing.SpanOptions{
			Kind:       tracing.SpanKindClient,
			Attributes: attributes,
		})

		defer func() {
			if resp != nil {
				span.SetAttributes(tracing.Attribute{Key: attrHTTPStatusCode, Value: resp.StatusCode})
				if resp.StatusCode > 399 {
					span.SetStatus(tracing.SpanStatusError, resp.Status)
				}
				if reqID := resp.Header.Get(shared.HeaderXMSRequestID); reqID != "" {
					span.SetAttributes(tracing.Attribute{Key: attrAZServiceReqID, Value: reqID})
				}
			} else if err != nil {
				var urlErr *url.Error
				if errors.As(err, &urlErr) {
					// calling *url.Error.Error() will include the unsanitized URL
					// which we don't want. in addition, we already have the HTTP verb
					// and sanitized URL in the trace so we aren't losing any info
					err = urlErr.Err
				}
				span.SetStatus(tracing.SpanStatusError, err.Error())
			}
			span.End()
		}()

		req = req.WithContext(ctx)
	}
	resp, err = req.Next()
	return
}

// StartSpanOptions contains the optional values for StartSpan.
type StartSpanOptions struct {
	// Kind indicates the kind of Span.
	Kind tracing.SpanKind
	// Attributes contains key-value pairs of attributes for the span.
	Attributes []tracing.Attribute
}

// StartSpan starts a new tracing span.
// You must call the returned func to terminate the span. Pass the applicable error
// if the span will exit with an error condition.
//   - ctx is the parent context of the newly created context
//   - name is the name of the span. this is typically the fully qualified name of an API ("Client.Method")
//   - tracer is the client's Tracer for creating spans
//   - options contains optional values. pass nil to accept any default values
func StartSpan(ctx context.Context, name string, tracer tracing.Tracer, options *StartSpanOptions) (context.Context, func(error)) {
	if !tracer.Enabled() {
		return ctx, func(err error) {}
	}

	// we MUST propagate the active tracer before returning so that the trace policy can access it
	ctx = context.WithValue(ctx, shared.CtxWithTracingTracer{}, tracer)

	if activeSpan := ctx.Value(ctxActiveSpan{}); activeSpan != nil {
		// per the design guidelines, if a SDK method Foo() calls SDK method Bar(),
		// then the span for Bar() must be suppressed. however, if Bar() makes a REST
		// call, then Bar's HTTP span must be a child of Foo's span.
		// however, there is an exception to this rule. if the SDK method Foo() is a
		// messaging producer/consumer, and it takes a callback that's a SDK method
		// Bar(), then the span for Bar() must _not_ be suppressed.
		if kind := activeSpan.(tracing.SpanKind); kind == tracing.SpanKindClient || kind == tracing.SpanKindInternal {
			return ctx, func(err error) {}
		}
	}

	if options == nil {
		options = &StartSpanOptions{}
	}
	if options.Kind == 0 {
		options.Kind = tracing.SpanKindInternal
	}

	ctx, span := tracer.Start(ctx, name, &tracing.SpanOptions{
		Kind:       options.Kind,
		Attributes: options.Attributes,
	})
	ctx = context.WithValue(ctx, ctxActiveSpan{}, options.Kind)
	return ctx, func(err error) {
		if err != nil {
			errType := strings.Replace(fmt.Sprintf("%T", err), "*exported.", "*azcore.", 1)
			span.SetStatus(tracing.SpanStatusError, fmt.Sprintf("%s:\n%s", errType, err.Error()))
		}
		span.End()
	}
}

// ctxActiveSpan is used as a context key for indicating a SDK client span is in progress.
type ctxActiveSpan struct{}
