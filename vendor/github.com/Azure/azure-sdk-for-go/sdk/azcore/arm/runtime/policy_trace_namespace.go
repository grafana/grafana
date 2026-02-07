//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

package runtime

import (
	"net/http"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore/arm/internal/resource"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/internal/shared"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/policy"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/tracing"
)

// httpTraceNamespacePolicy is a policy that adds the az.namespace attribute to the current Span
func httpTraceNamespacePolicy(req *policy.Request) (resp *http.Response, err error) {
	rawTracer := req.Raw().Context().Value(shared.CtxWithTracingTracer{})
	if tracer, ok := rawTracer.(tracing.Tracer); ok && tracer.Enabled() {
		rt, err := resource.ParseResourceType(req.Raw().URL.Path)
		if err == nil {
			// add the namespace attribute to the current span
			span := tracer.SpanFromContext(req.Raw().Context())
			span.SetAttributes(tracing.Attribute{Key: shared.TracingNamespaceAttrName, Value: rt.Namespace})
		}
	}
	return req.Next()
}
