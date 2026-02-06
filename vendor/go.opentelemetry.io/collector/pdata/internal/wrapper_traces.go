// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package internal // import "go.opentelemetry.io/collector/pdata/internal"

import (
	otlpcollectortrace "go.opentelemetry.io/collector/pdata/internal/data/protogen/collector/trace/v1"
	otlptrace "go.opentelemetry.io/collector/pdata/internal/data/protogen/trace/v1"
)

// TracesToProto internal helper to convert Traces to protobuf representation.
func TracesToProto(l Traces) otlptrace.TracesData {
	return otlptrace.TracesData{
		ResourceSpans: l.orig.ResourceSpans,
	}
}

// TracesFromProto internal helper to convert protobuf representation to Traces.
// This function set exclusive state assuming that it's called only once per Traces.
func TracesFromProto(orig otlptrace.TracesData) Traces {
	return NewTraces(&otlpcollectortrace.ExportTraceServiceRequest{
		ResourceSpans: orig.ResourceSpans,
	}, NewState())
}
