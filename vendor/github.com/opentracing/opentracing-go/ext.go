package opentracing

import (
	"context"
)

// TracerContextWithSpanExtension is an extension interface that the
// implementation of the Tracer interface may want to implement. It
// allows to have some control over the go context when the
// ContextWithSpan is invoked.
//
// The primary purpose of this extension are adapters from opentracing
// API to some other tracing API.
type TracerContextWithSpanExtension interface {
	// ContextWithSpanHook gets called by the ContextWithSpan
	// function, when the Tracer implementation also implements
	// this interface. It allows to put extra information into the
	// context and make it available to the callers of the
	// ContextWithSpan.
	//
	// This hook is invoked before the ContextWithSpan function
	// actually puts the span into the context.
	ContextWithSpanHook(ctx context.Context, span Span) context.Context
}
