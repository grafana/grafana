// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package autoexport // import "go.opentelemetry.io/contrib/exporters/autoexport"

import (
	"context"

	"go.opentelemetry.io/otel/sdk/log"
	"go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/metric/metricdata"
	"go.opentelemetry.io/otel/sdk/trace"
)

// noopSpanExporter is an implementation of trace.SpanExporter that performs no operations.
type noopSpanExporter struct{}

var _ trace.SpanExporter = noopSpanExporter{}

// ExportSpans is part of trace.SpanExporter interface.
func (e noopSpanExporter) ExportSpans(ctx context.Context, spans []trace.ReadOnlySpan) error {
	return nil
}

// Shutdown is part of trace.SpanExporter interface.
func (e noopSpanExporter) Shutdown(ctx context.Context) error {
	return nil
}

// IsNoneSpanExporter returns true for the exporter returned by [NewSpanExporter]
// when OTEL_TRACES_EXPORTER environment variable is set to "none".
func IsNoneSpanExporter(e trace.SpanExporter) bool {
	_, ok := e.(noopSpanExporter)
	return ok
}

type noopMetricReader struct {
	*metric.ManualReader
}

func newNoopMetricReader() noopMetricReader {
	return noopMetricReader{metric.NewManualReader()}
}

// IsNoneMetricReader returns true for the exporter returned by [NewMetricReader]
// when OTEL_METRICS_EXPORTER environment variable is set to "none".
func IsNoneMetricReader(e metric.Reader) bool {
	_, ok := e.(noopMetricReader)
	return ok
}

type noopMetricProducer struct{}

func (e noopMetricProducer) Produce(ctx context.Context) ([]metricdata.ScopeMetrics, error) {
	return nil, nil
}

func newNoopMetricProducer() noopMetricProducer {
	return noopMetricProducer{}
}

// noopLogExporter is an implementation of log.SpanExporter that performs no operations.
type noopLogExporter struct{}

var _ log.Exporter = noopLogExporter{}

// ExportSpans is part of log.Exporter interface.
func (e noopLogExporter) Export(ctx context.Context, records []log.Record) error {
	return nil
}

// Shutdown is part of log.Exporter interface.
func (e noopLogExporter) Shutdown(ctx context.Context) error {
	return nil
}

// ForceFlush is part of log.Exporter interface.
func (e noopLogExporter) ForceFlush(ctx context.Context) error {
	return nil
}

// IsNoneLogExporter returns true for the exporter returned by [NewLogExporter]
// when OTEL_LOGSS_EXPORTER environment variable is set to "none".
func IsNoneLogExporter(e log.Exporter) bool {
	_, ok := e.(noopLogExporter)
	return ok
}
