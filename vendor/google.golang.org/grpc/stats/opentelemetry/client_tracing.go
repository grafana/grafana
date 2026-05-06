/*
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
 */

package opentelemetry

import (
	"context"
	"log"
	"strings"

	otelcodes "go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc"
	grpccodes "google.golang.org/grpc/codes"
	"google.golang.org/grpc/stats"
	otelinternaltracing "google.golang.org/grpc/stats/opentelemetry/internal/tracing"
	"google.golang.org/grpc/status"
)

const (
	delayedResolutionEventName = "Delayed name resolution complete"
	tracerName                 = "grpc-go"
)

type clientTracingHandler struct {
	options Options
}

func (h *clientTracingHandler) initializeTraces() {
	if h.options.TraceOptions.TracerProvider == nil {
		log.Printf("TracerProvider is not provided in client TraceOptions")
		return
	}
}

func (h *clientTracingHandler) unaryInterceptor(ctx context.Context, method string, req, reply any, cc *grpc.ClientConn, invoker grpc.UnaryInvoker, opts ...grpc.CallOption) error {
	ctx, _ = getOrCreateCallInfo(ctx, cc, method, opts...)

	var span trace.Span
	ctx, span = h.createCallTraceSpan(ctx, method)
	err := invoker(ctx, method, req, reply, cc, opts...)
	h.finishTrace(err, span)
	return err
}

func (h *clientTracingHandler) streamInterceptor(ctx context.Context, desc *grpc.StreamDesc, cc *grpc.ClientConn, method string, streamer grpc.Streamer, opts ...grpc.CallOption) (grpc.ClientStream, error) {
	ctx, _ = getOrCreateCallInfo(ctx, cc, method, opts...)

	var span trace.Span
	ctx, span = h.createCallTraceSpan(ctx, method)
	callback := func(err error) { h.finishTrace(err, span) }
	opts = append([]grpc.CallOption{grpc.OnFinish(callback)}, opts...)
	return streamer(ctx, desc, cc, method, opts...)
}

// finishTrace sets the span status based on the RPC result and ends the span.
// It is used to finalize tracing for both unary and streaming calls.
func (h *clientTracingHandler) finishTrace(err error, ts trace.Span) {
	s := status.Convert(err)
	if s.Code() == grpccodes.OK {
		ts.SetStatus(otelcodes.Ok, s.Message())
	} else {
		ts.SetStatus(otelcodes.Error, s.Message())
	}
	ts.End()
}

// traceTagRPC populates provided context with a new span using the
// TextMapPropagator supplied in trace options and internal itracing.carrier.
// It creates a new outgoing carrier which serializes information about this
// span into gRPC Metadata, if TextMapPropagator is provided in the trace
// options. if TextMapPropagator is not provided, it returns the context as is.
func (h *clientTracingHandler) traceTagRPC(ctx context.Context, ai *attemptInfo, nameResolutionDelayed bool) (context.Context, *attemptInfo) {
	// Add a "Delayed name resolution complete" event to the call span
	// if there was name resolution delay. In case of multiple retry attempts,
	// ensure that event is added only once.
	callSpan := trace.SpanFromContext(ctx)
	ci := getCallInfo(ctx)
	if nameResolutionDelayed && !ci.nameResolutionEventAdded.Swap(true) && callSpan.SpanContext().IsValid() {
		callSpan.AddEvent(delayedResolutionEventName)
	}
	mn := "Attempt." + strings.Replace(ai.method, "/", ".", -1)
	tracer := h.options.TraceOptions.TracerProvider.Tracer(tracerName, trace.WithInstrumentationVersion(grpc.Version))
	ctx, span := tracer.Start(ctx, mn)
	carrier := otelinternaltracing.NewOutgoingCarrier(ctx)
	h.options.TraceOptions.TextMapPropagator.Inject(ctx, carrier)
	ai.traceSpan = span
	return carrier.Context(), ai
}

// createCallTraceSpan creates a call span to put in the provided context using
// provided TraceProvider. If TraceProvider is nil, it returns context as is.
func (h *clientTracingHandler) createCallTraceSpan(ctx context.Context, method string) (context.Context, trace.Span) {
	mn := "Sent." + strings.Replace(removeLeadingSlash(method), "/", ".", -1)
	tracer := h.options.TraceOptions.TracerProvider.Tracer(tracerName, trace.WithInstrumentationVersion(grpc.Version))
	ctx, span := tracer.Start(ctx, mn, trace.WithSpanKind(trace.SpanKindClient))
	return ctx, span
}

// TagConn exists to satisfy stats.Handler for tracing.
func (h *clientTracingHandler) TagConn(ctx context.Context, _ *stats.ConnTagInfo) context.Context {
	return ctx
}

// HandleConn exists to satisfy stats.Handler for tracing.
func (h *clientTracingHandler) HandleConn(context.Context, stats.ConnStats) {}

// TagRPC implements per RPC attempt context management for traces.
func (h *clientTracingHandler) TagRPC(ctx context.Context, info *stats.RPCTagInfo) context.Context {
	ctx, ai := getOrCreateRPCAttemptInfo(ctx)
	ctx, ai = h.traceTagRPC(ctx, ai, info.NameResolutionDelay)
	return setRPCInfo(ctx, &rpcInfo{ai: ai})
}

// HandleRPC handles per RPC tracing implementation.
func (h *clientTracingHandler) HandleRPC(ctx context.Context, rs stats.RPCStats) {
	ri := getRPCInfo(ctx)
	if ri == nil {
		logger.Error("ctx passed into client side tracing handler trace event handling has no client attempt data present")
		return
	}
	populateSpan(rs, ri.ai)
}
