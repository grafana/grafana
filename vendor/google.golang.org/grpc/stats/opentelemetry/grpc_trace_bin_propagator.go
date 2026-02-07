/*
 *
 * Copyright 2024 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

package opentelemetry

import (
	"context"

	otelpropagation "go.opentelemetry.io/otel/propagation"
	oteltrace "go.opentelemetry.io/otel/trace"
)

// gRPCTraceBinHeaderKey is the gRPC metadata header key `grpc-trace-bin` used
// to propagate trace context in binary format.
const grpcTraceBinHeaderKey = "grpc-trace-bin"

// GRPCTraceBinPropagator is an OpenTelemetry TextMapPropagator which is used
// to extract and inject trace context data from and into headers exchanged by
// gRPC applications. It propagates trace data in binary format using the
// `grpc-trace-bin` header.
type GRPCTraceBinPropagator struct{}

// Inject sets OpenTelemetry span context from the Context into the carrier as
// a `grpc-trace-bin` header if span context is valid.
//
// If span context is not valid, it returns without setting `grpc-trace-bin`
// header.
func (GRPCTraceBinPropagator) Inject(ctx context.Context, carrier otelpropagation.TextMapCarrier) {
	sc := oteltrace.SpanFromContext(ctx)
	if !sc.SpanContext().IsValid() {
		return
	}

	bd := toBinary(sc.SpanContext())
	carrier.Set(grpcTraceBinHeaderKey, string(bd))
}

// Extract reads OpenTelemetry span context from the `grpc-trace-bin` header of
// carrier into the provided context, if present.
//
// If a valid span context is retrieved from `grpc-trace-bin`, it returns a new
// context containing the extracted OpenTelemetry span context marked as
// remote.
//
// If `grpc-trace-bin` header is not present, it returns the context as is.
func (GRPCTraceBinPropagator) Extract(ctx context.Context, carrier otelpropagation.TextMapCarrier) context.Context {
	h := carrier.Get(grpcTraceBinHeaderKey)
	if h == "" {
		return ctx
	}

	sc, ok := fromBinary([]byte(h))
	if !ok {
		return ctx
	}
	return oteltrace.ContextWithRemoteSpanContext(ctx, sc)
}

// Fields returns the keys whose values are set with Inject.
//
// GRPCTraceBinPropagator always returns a slice containing only
// `grpc-trace-bin` key because it only sets the `grpc-trace-bin` header for
// propagating trace context.
func (GRPCTraceBinPropagator) Fields() []string {
	return []string{grpcTraceBinHeaderKey}
}

// toBinary returns the binary format representation of a SpanContext.
//
// If sc is the zero value, returns nil.
func toBinary(sc oteltrace.SpanContext) []byte {
	if sc.Equal(oteltrace.SpanContext{}) {
		return nil
	}
	var b [29]byte
	traceID := oteltrace.TraceID(sc.TraceID())
	copy(b[2:18], traceID[:])
	b[18] = 1
	spanID := oteltrace.SpanID(sc.SpanID())
	copy(b[19:27], spanID[:])
	b[27] = 2
	b[28] = byte(oteltrace.TraceFlags(sc.TraceFlags()))
	return b[:]
}

// fromBinary returns the SpanContext represented by b with Remote set to true.
//
// It returns with zero value SpanContext and false, if any of the
// below condition is not satisfied:
// - Valid header: len(b) = 29
// - Valid version: b[0] = 0
// - Valid traceID prefixed with 0: b[1] = 0
// - Valid spanID prefixed with 1: b[18] = 1
// - Valid traceFlags prefixed with 2: b[27] = 2
func fromBinary(b []byte) (oteltrace.SpanContext, bool) {
	if len(b) != 29 || b[0] != 0 || b[1] != 0 || b[18] != 1 || b[27] != 2 {
		return oteltrace.SpanContext{}, false
	}

	return oteltrace.SpanContext{}.WithTraceID(
		oteltrace.TraceID(b[2:18])).WithSpanID(
		oteltrace.SpanID(b[19:27])).WithTraceFlags(
		oteltrace.TraceFlags(b[28])).WithRemote(true), true
}
