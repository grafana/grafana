package telemetry

import (
	"context"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

// Encapsulate can be applied to a span to indicate that this span should
// collapse its children by default.
func Encapsulate() trace.SpanStartOption {
	return trace.WithAttributes(attribute.Bool(UIEncapsulateAttr, true))
}

// Reveal can be applied to a span to indicate that this span should
// collapse its children by default.
func Reveal() trace.SpanStartOption {
	return trace.WithAttributes(attribute.Bool(UIRevealAttr, true))
}

// Encapsulated can be applied to a child span to indicate that it should be
// collapsed by default.
func Encapsulated() trace.SpanStartOption {
	return trace.WithAttributes(attribute.Bool(UIEncapsulatedAttr, true))
}

func Resume(ctx context.Context) trace.SpanStartOption {
	return trace.WithLinks(trace.Link{SpanContext: trace.SpanContextFromContext(ctx)})
}

// Internal can be applied to a span to indicate that this span should not be
// shown to the user by default.
func Internal() trace.SpanStartOption {
	return trace.WithAttributes(attribute.Bool(UIInternalAttr, true))
}

// ActorEmoji sets an emoji representing the actor of the span.
func ActorEmoji(emoji string) trace.SpanStartOption {
	return trace.WithAttributes(attribute.String(UIActorEmojiAttr, emoji))
}

// Passthrough can be applied to a span to cause the UI to skip over it and
// show its children instead.
func Passthrough() trace.SpanStartOption {
	return trace.WithAttributes(attribute.Bool(UIPassthroughAttr, true))
}

// Tracer returns a Tracer for the given library using the provider from
// the current span.
func Tracer(ctx context.Context, lib string) trace.Tracer {
	return trace.SpanFromContext(ctx).TracerProvider().Tracer(lib)
}

// End is a helper to end a span with an error if the function returns an error.
//
// It is optimized for use as a defer one-liner with a function that has a
// named error return value, conventionally `rerr`.
//
//	defer telemetry.End(span, func() error { return rerr })
func End(span trace.Span, fn func() error) {
	if err := fn(); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
	}
	span.End()
}
