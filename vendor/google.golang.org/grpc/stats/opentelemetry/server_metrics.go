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
	"sync/atomic"
	"time"

	otelattribute "go.opentelemetry.io/otel/attribute"
	otelmetric "go.opentelemetry.io/otel/metric"

	"google.golang.org/grpc"
	estats "google.golang.org/grpc/experimental/stats"
	"google.golang.org/grpc/internal"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/stats"
	"google.golang.org/grpc/status"
)

type serverMetricsHandler struct {
	estats.MetricsRecorder
	options       Options
	serverMetrics serverMetrics
}

func (h *serverMetricsHandler) initializeMetrics() {
	// Will set no metrics to record, logically making this stats handler a
	// no-op.
	if h.options.MetricsOptions.MeterProvider == nil {
		return
	}

	meter := h.options.MetricsOptions.MeterProvider.Meter("grpc-go", otelmetric.WithInstrumentationVersion(grpc.Version))
	if meter == nil {
		return
	}
	metrics := h.options.MetricsOptions.Metrics
	if metrics == nil {
		metrics = DefaultMetrics()
	}

	h.serverMetrics.callStarted = createInt64Counter(metrics.Metrics(), "grpc.server.call.started", meter, otelmetric.WithUnit("{call}"), otelmetric.WithDescription("Number of server calls started."))
	h.serverMetrics.callSentTotalCompressedMessageSize = createInt64Histogram(metrics.Metrics(), "grpc.server.call.sent_total_compressed_message_size", meter, otelmetric.WithUnit("By"), otelmetric.WithDescription("Compressed message bytes sent per server call."), otelmetric.WithExplicitBucketBoundaries(DefaultSizeBounds...))
	h.serverMetrics.callRcvdTotalCompressedMessageSize = createInt64Histogram(metrics.Metrics(), "grpc.server.call.rcvd_total_compressed_message_size", meter, otelmetric.WithUnit("By"), otelmetric.WithDescription("Compressed message bytes received per server call."), otelmetric.WithExplicitBucketBoundaries(DefaultSizeBounds...))
	h.serverMetrics.callDuration = createFloat64Histogram(metrics.Metrics(), "grpc.server.call.duration", meter, otelmetric.WithUnit("s"), otelmetric.WithDescription("End-to-end time taken to complete a call from server transport's perspective."), otelmetric.WithExplicitBucketBoundaries(DefaultLatencyBounds...))

	rm := &registryMetrics{
		optionalLabels: h.options.MetricsOptions.OptionalLabels,
	}
	h.MetricsRecorder = rm
	rm.registerMetrics(metrics, meter)
}

// attachLabelsTransportStream intercepts SetHeader and SendHeader calls of the
// underlying ServerTransportStream to attach metadataExchangeLabels.
type attachLabelsTransportStream struct {
	grpc.ServerTransportStream

	attachedLabels         atomic.Bool
	metadataExchangeLabels metadata.MD
}

func (s *attachLabelsTransportStream) SetHeader(md metadata.MD) error {
	if !s.attachedLabels.Swap(true) {
		s.ServerTransportStream.SetHeader(s.metadataExchangeLabels)
	}
	return s.ServerTransportStream.SetHeader(md)
}

func (s *attachLabelsTransportStream) SendHeader(md metadata.MD) error {
	if !s.attachedLabels.Swap(true) {
		s.ServerTransportStream.SetHeader(s.metadataExchangeLabels)
	}

	return s.ServerTransportStream.SendHeader(md)
}

func (h *serverMetricsHandler) unaryInterceptor(ctx context.Context, req any, _ *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
	var metadataExchangeLabels metadata.MD
	if h.options.MetricsOptions.pluginOption != nil {
		metadataExchangeLabels = h.options.MetricsOptions.pluginOption.GetMetadata()
	}

	sts := grpc.ServerTransportStreamFromContext(ctx)

	alts := &attachLabelsTransportStream{
		ServerTransportStream:  sts,
		metadataExchangeLabels: metadataExchangeLabels,
	}
	ctx = grpc.NewContextWithServerTransportStream(ctx, alts)

	res, err := handler(ctx, req)
	if err != nil { // maybe trailers-only if headers haven't already been sent
		if !alts.attachedLabels.Swap(true) {
			alts.SetTrailer(alts.metadataExchangeLabels)
		}
	} else { // headers will be written; a message was sent
		if !alts.attachedLabels.Swap(true) {
			alts.SetHeader(alts.metadataExchangeLabels)
		}
	}

	return res, err
}

// attachLabelsStream embeds a grpc.ServerStream, and intercepts the
// SetHeader/SendHeader/SendMsg/SendTrailer call to attach metadata exchange
// labels.
type attachLabelsStream struct {
	grpc.ServerStream

	attachedLabels         atomic.Bool
	metadataExchangeLabels metadata.MD
}

func (s *attachLabelsStream) SetHeader(md metadata.MD) error {
	if !s.attachedLabels.Swap(true) {
		s.ServerStream.SetHeader(s.metadataExchangeLabels)
	}

	return s.ServerStream.SetHeader(md)
}

func (s *attachLabelsStream) SendHeader(md metadata.MD) error {
	if !s.attachedLabels.Swap(true) {
		s.ServerStream.SetHeader(s.metadataExchangeLabels)
	}

	return s.ServerStream.SendHeader(md)
}

func (s *attachLabelsStream) SendMsg(m any) error {
	if !s.attachedLabels.Swap(true) {
		s.ServerStream.SetHeader(s.metadataExchangeLabels)
	}
	return s.ServerStream.SendMsg(m)
}

func (h *serverMetricsHandler) streamInterceptor(srv any, ss grpc.ServerStream, _ *grpc.StreamServerInfo, handler grpc.StreamHandler) error {
	var metadataExchangeLabels metadata.MD
	if h.options.MetricsOptions.pluginOption != nil {
		metadataExchangeLabels = h.options.MetricsOptions.pluginOption.GetMetadata()
	}
	als := &attachLabelsStream{
		ServerStream:           ss,
		metadataExchangeLabels: metadataExchangeLabels,
	}
	err := handler(srv, als)

	// Add metadata exchange labels to trailers if never sent in headers,
	// irrespective of whether or not RPC failed.
	if !als.attachedLabels.Load() {
		als.SetTrailer(als.metadataExchangeLabels)
	}
	return err
}

// TagConn exists to satisfy stats.Handler.
func (h *serverMetricsHandler) TagConn(ctx context.Context, _ *stats.ConnTagInfo) context.Context {
	return ctx
}

// HandleConn exists to satisfy stats.Handler.
func (h *serverMetricsHandler) HandleConn(context.Context, stats.ConnStats) {}

// TagRPC implements per RPC context management for metrics.
func (h *serverMetricsHandler) TagRPC(ctx context.Context, info *stats.RPCTagInfo) context.Context {
	method := info.FullMethodName
	if h.options.MetricsOptions.MethodAttributeFilter != nil {
		if !h.options.MetricsOptions.MethodAttributeFilter(method) {
			method = "other"
		}
	}
	server := internal.ServerFromContext.(func(context.Context) *grpc.Server)(ctx)
	if server == nil { // Shouldn't happen, defensive programming.
		logger.Error("ctx passed into server side stats handler has no grpc server ref")
		method = "other"
	} else {
		isRegisteredMethod := internal.IsRegisteredMethod.(func(*grpc.Server, string) bool)
		if !isRegisteredMethod(server, method) {
			method = "other"
		}
	}
	ctx, ai := getOrCreateRPCAttemptInfo(ctx)
	ai.startTime = time.Now()
	ai.method = removeLeadingSlash(method)

	return setRPCInfo(ctx, &rpcInfo{ai: ai})
}

// HandleRPC handles per RPC stats implementation.
func (h *serverMetricsHandler) HandleRPC(ctx context.Context, rs stats.RPCStats) {
	ri := getRPCInfo(ctx)
	if ri == nil {
		logger.Error("ctx passed into server side stats handler metrics event handling has no server call data present")
		return
	}
	h.processRPCData(ctx, rs, ri.ai)
}

func (h *serverMetricsHandler) processRPCData(ctx context.Context, s stats.RPCStats, ai *attemptInfo) {
	switch st := s.(type) {
	case *stats.InHeader:
		if ai.pluginOptionLabels == nil && h.options.MetricsOptions.pluginOption != nil {
			labels := h.options.MetricsOptions.pluginOption.GetLabels(st.Header)
			if labels == nil {
				labels = map[string]string{} // Shouldn't return a nil map. Make it empty if so to ignore future Get Calls for this Attempt.
			}
			ai.pluginOptionLabels = labels
		}
		attrs := otelmetric.WithAttributeSet(otelattribute.NewSet(
			otelattribute.String("grpc.method", ai.method),
		))
		h.serverMetrics.callStarted.Add(ctx, 1, attrs)
	case *stats.OutPayload:
		atomic.AddInt64(&ai.sentCompressedBytes, int64(st.CompressedLength))
	case *stats.InPayload:
		atomic.AddInt64(&ai.recvCompressedBytes, int64(st.CompressedLength))
	case *stats.End:
		h.processRPCEnd(ctx, ai, st)
	default:
	}
}

func (h *serverMetricsHandler) processRPCEnd(ctx context.Context, ai *attemptInfo, e *stats.End) {
	latency := float64(time.Since(ai.startTime)) / float64(time.Second)
	st := "OK"
	if e.Error != nil {
		s, _ := status.FromError(e.Error)
		st = canonicalString(s.Code())
	}
	attributes := []otelattribute.KeyValue{
		otelattribute.String("grpc.method", ai.method),
		otelattribute.String("grpc.status", st),
	}
	for k, v := range ai.pluginOptionLabels {
		attributes = append(attributes, otelattribute.String(k, v))
	}

	// Allocate vararg slice once.
	opts := []otelmetric.RecordOption{otelmetric.WithAttributeSet(otelattribute.NewSet(attributes...))}
	h.serverMetrics.callDuration.Record(ctx, latency, opts...)
	h.serverMetrics.callSentTotalCompressedMessageSize.Record(ctx, atomic.LoadInt64(&ai.sentCompressedBytes), opts...)
	h.serverMetrics.callRcvdTotalCompressedMessageSize.Record(ctx, atomic.LoadInt64(&ai.recvCompressedBytes), opts...)
}

const (
	// ServerCallStartedMetricName is the number of server calls started.
	ServerCallStartedMetricName string = "grpc.server.call.started"
	// ServerCallSentCompressedTotalMessageSizeMetricName is the compressed
	// message bytes sent per server call.
	ServerCallSentCompressedTotalMessageSizeMetricName string = "grpc.server.call.sent_total_compressed_message_size"
	// ServerCallRcvdCompressedTotalMessageSizeMetricName is the compressed
	// message bytes received per server call.
	ServerCallRcvdCompressedTotalMessageSizeMetricName string = "grpc.server.call.rcvd_total_compressed_message_size"
	// ServerCallDurationMetricName is the end-to-end time taken to complete a
	// call from server transport's perspective.
	ServerCallDurationMetricName string = "grpc.server.call.duration"
)
