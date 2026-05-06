// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package internal // import "go.opentelemetry.io/collector/pdata/internal"

import (
	otlpcollectortrace "go.opentelemetry.io/collector/pdata/internal/data/protogen/collector/trace/v1"
	otlptrace "go.opentelemetry.io/collector/pdata/internal/data/protogen/trace/v1"
)

type Traces struct {
	orig  *otlpcollectortrace.ExportTraceServiceRequest
	state *State
}

func GetOrigTraces(ms Traces) *otlpcollectortrace.ExportTraceServiceRequest {
	return ms.orig
}

func GetTracesState(ms Traces) *State {
	return ms.state
}

func SetTracesState(ms Traces, state State) {
	*ms.state = state
}

func NewTraces(orig *otlpcollectortrace.ExportTraceServiceRequest, state *State) Traces {
	return Traces{orig: orig, state: state}
}

// TracesToProto internal helper to convert Traces to protobuf representation.
func TracesToProto(l Traces) otlptrace.TracesData {
	return otlptrace.TracesData{
		ResourceSpans: l.orig.ResourceSpans,
	}
}

// TracesFromProto internal helper to convert protobuf representation to Traces.
// This function set exclusive state assuming that it's called only once per Traces.
func TracesFromProto(orig otlptrace.TracesData) Traces {
	state := StateMutable
	return NewTraces(&otlpcollectortrace.ExportTraceServiceRequest{
		ResourceSpans: orig.ResourceSpans,
	}, &state)
}
