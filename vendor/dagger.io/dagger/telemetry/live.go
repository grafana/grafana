package telemetry

import (
	"context"

	sdktrace "go.opentelemetry.io/otel/sdk/trace"
)

// LiveSpanProcessor is a SpanProcessor whose OnStart calls OnEnd on the
// underlying SpanProcessor in order to send live telemetry.
type LiveSpanProcessor struct {
	sdktrace.SpanProcessor
}

func NewLiveSpanProcessor(exp sdktrace.SpanExporter) *LiveSpanProcessor {
	return &LiveSpanProcessor{
		SpanProcessor: sdktrace.NewBatchSpanProcessor(
			// NOTE: span heartbeating is handled by the Cloud exporter
			exp,
			sdktrace.WithBatchTimeout(NearlyImmediate),
		),
	}
}

func (p *LiveSpanProcessor) OnStart(ctx context.Context, span sdktrace.ReadWriteSpan) {
	// Send a read-only snapshot of the live span downstream so it can be
	// filtered out by FilterLiveSpansExporter. Otherwise the span can complete
	// before being exported, resulting in two completed spans being sent, which
	// will confuse traditional OpenTelemetry services.
	p.SpanProcessor.OnEnd(SnapshotSpan(span))
}
