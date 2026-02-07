// Package tracing defines tracing APIs to be used by Smithy clients.
package tracing

import (
	"context"

	"github.com/aws/smithy-go"
)

// SpanStatus records the "success" state of an observed span.
type SpanStatus int

// Enumeration of SpanStatus.
const (
	SpanStatusUnset SpanStatus = iota
	SpanStatusOK
	SpanStatusError
)

// SpanKind indicates the nature of the work being performed.
type SpanKind int

// Enumeration of SpanKind.
const (
	SpanKindInternal SpanKind = iota
	SpanKindClient
	SpanKindServer
	SpanKindProducer
	SpanKindConsumer
)

// TracerProvider is the entry point for creating client traces.
type TracerProvider interface {
	Tracer(scope string, opts ...TracerOption) Tracer
}

// TracerOption applies configuration to a tracer.
type TracerOption func(o *TracerOptions)

// TracerOptions represent configuration for tracers.
type TracerOptions struct {
	Properties smithy.Properties
}

// Tracer is the entry point for creating observed client Spans.
//
// Spans created by tracers propagate by existing on the Context. Consumers of
// the API can use [GetSpan] to pull the active Span from a Context.
//
// Creation of child Spans is implicit through Context persistence. If
// CreateSpan is called with a Context that holds a Span, the result will be a
// child of that Span.
type Tracer interface {
	StartSpan(ctx context.Context, name string, opts ...SpanOption) (context.Context, Span)
}

// SpanOption applies configuration to a span.
type SpanOption func(o *SpanOptions)

// SpanOptions represent configuration for span events.
type SpanOptions struct {
	Kind       SpanKind
	Properties smithy.Properties
}

// Span records a conceptually individual unit of work that takes place in a
// Smithy client operation.
type Span interface {
	Name() string
	Context() SpanContext
	AddEvent(name string, opts ...EventOption)
	SetStatus(status SpanStatus)
	SetProperty(k, v any)
	End()
}

// EventOption applies configuration to a span event.
type EventOption func(o *EventOptions)

// EventOptions represent configuration for span events.
type EventOptions struct {
	Properties smithy.Properties
}

// SpanContext uniquely identifies a Span.
type SpanContext struct {
	TraceID  string
	SpanID   string
	IsRemote bool
}

// IsValid is true when a span has nonzero trace and span IDs.
func (ctx *SpanContext) IsValid() bool {
	return len(ctx.TraceID) != 0 && len(ctx.SpanID) != 0
}
