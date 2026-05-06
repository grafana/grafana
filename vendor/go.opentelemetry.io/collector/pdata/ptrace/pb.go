// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package ptrace // import "go.opentelemetry.io/collector/pdata/ptrace"

import (
	"go.opentelemetry.io/collector/pdata/internal"
	otlptrace "go.opentelemetry.io/collector/pdata/internal/data/protogen/trace/v1"
)

var _ MarshalSizer = (*ProtoMarshaler)(nil)

type ProtoMarshaler struct{}

func (e *ProtoMarshaler) MarshalTraces(td Traces) ([]byte, error) {
	pb := internal.TracesToProto(internal.Traces(td))
	return pb.Marshal()
}

func (e *ProtoMarshaler) TracesSize(td Traces) int {
	pb := internal.TracesToProto(internal.Traces(td))
	return pb.Size()
}

func (e *ProtoMarshaler) ResourceSpansSize(rs ResourceSpans) int {
	return rs.orig.Size()
}

func (e *ProtoMarshaler) ScopeSpansSize(ss ScopeSpans) int {
	return ss.orig.Size()
}

func (e *ProtoMarshaler) SpanSize(span Span) int {
	return span.orig.Size()
}

type ProtoUnmarshaler struct{}

func (d *ProtoUnmarshaler) UnmarshalTraces(buf []byte) (Traces, error) {
	pb := otlptrace.TracesData{}
	err := pb.Unmarshal(buf)
	return Traces(internal.TracesFromProto(pb)), err
}
