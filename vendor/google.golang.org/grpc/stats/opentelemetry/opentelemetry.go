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

// Package opentelemetry implements opentelemetry instrumentation code for
// gRPC-Go clients and servers.
//
// For details on configuring opentelemetry and various instruments that this
// package creates, see
// [gRPC OpenTelemetry Metrics](https://grpc.io/docs/guides/opentelemetry-metrics/).
package opentelemetry

import (
	"context"
	"strings"
	"sync/atomic"
	"time"

	otelattribute "go.opentelemetry.io/otel/attribute"
	otelmetric "go.opentelemetry.io/otel/metric"
	"go.opentelemetry.io/otel/metric/noop"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	experimental "google.golang.org/grpc/experimental/opentelemetry"
	estats "google.golang.org/grpc/experimental/stats"
	"google.golang.org/grpc/grpclog"
	"google.golang.org/grpc/internal"
	"google.golang.org/grpc/stats"
	otelinternal "google.golang.org/grpc/stats/opentelemetry/internal"
)

func init() {
	otelinternal.SetPluginOption = func(o *Options, po otelinternal.PluginOption) {
		o.MetricsOptions.pluginOption = po
		// Log an error if one of the options is missing.
		if (o.TraceOptions.TextMapPropagator == nil) != (o.TraceOptions.TracerProvider == nil) {
			logger.Warning("Tracing will not be recorded because traceOptions are not set properly: one of TextMapPropagator or TracerProvider is missing")
		}
	}
}

var (
	logger          = grpclog.Component("otel-plugin")
	canonicalString = internal.CanonicalString.(func(codes.Code) string)
	joinDialOptions = internal.JoinDialOptions.(func(...grpc.DialOption) grpc.DialOption)
)

// Options are the options for OpenTelemetry instrumentation.
type Options struct {
	// MetricsOptions are the metrics options for OpenTelemetry instrumentation.
	MetricsOptions MetricsOptions
	// TraceOptions are the tracing options for OpenTelemetry instrumentation.
	TraceOptions experimental.TraceOptions
}

func (o *Options) isMetricsEnabled() bool {
	return o.MetricsOptions.MeterProvider != nil
}

func (o *Options) isTracingEnabled() bool {
	return o.TraceOptions.TracerProvider != nil
}

// MetricsOptions are the metrics options for OpenTelemetry instrumentation.
type MetricsOptions struct {
	// MeterProvider is the MeterProvider instance that will be used to create
	// instruments. To enable metrics collection, set a meter provider. If
	// unset, no metrics will be recorded.
	MeterProvider otelmetric.MeterProvider

	// Metrics are the metrics to instrument. Will create instrument and record telemetry
	// for corresponding metric supported by the client and server
	// instrumentation components if applicable. If not set, the default metrics
	// will be recorded.
	Metrics *stats.MetricSet

	// MethodAttributeFilter is a function that determines whether to record the
	// method name of RPCs as an attribute, or to bucket into "other". Take care
	// to limit the values allowed, as allowing too many will increase
	// cardinality and could cause severe memory or performance problems.
	//
	// This only applies for server-side metrics.  For clients, to record the
	// method name in the attributes, pass grpc.StaticMethodCallOption to Invoke
	// or NewStream. Note that when using protobuf generated clients, this
	// CallOption is included automatically.
	MethodAttributeFilter func(string) bool

	// OptionalLabels specifies a list of optional labels to enable on any
	// metrics that support them.
	OptionalLabels []string

	// pluginOption is used to get labels to attach to certain metrics, if set.
	pluginOption otelinternal.PluginOption
}

// DialOption returns a dial option which enables OpenTelemetry instrumentation
// code for a grpc.ClientConn.
//
// Client applications interested in instrumenting their grpc.ClientConn should
// pass the dial option returned from this function as a dial option to
// grpc.NewClient().
//
// For the metrics supported by this instrumentation code, specify the client
// metrics to record in metrics options. Also provide an implementation of a
// MeterProvider. If the passed in Meter Provider does not have the view
// configured for an individual metric turned on, the API call in this component
// will create a default view for that metric.
//
// For the traces supported by this instrumentation code, provide an
// implementation of a TextMapPropagator and OpenTelemetry TracerProvider.
func DialOption(o Options) grpc.DialOption {
	var metricsOpts, tracingOpts []grpc.DialOption

	if o.isMetricsEnabled() {
		metricsHandler := &clientMetricsHandler{options: o}
		metricsHandler.initializeMetrics()
		metricsOpts = append(metricsOpts, grpc.WithChainUnaryInterceptor(metricsHandler.unaryInterceptor), grpc.WithChainStreamInterceptor(metricsHandler.streamInterceptor), grpc.WithStatsHandler(metricsHandler))
	}
	if o.isTracingEnabled() {
		tracingHandler := &clientTracingHandler{options: o}
		tracingHandler.initializeTraces()
		tracingOpts = append(tracingOpts, grpc.WithChainUnaryInterceptor(tracingHandler.unaryInterceptor), grpc.WithChainStreamInterceptor(tracingHandler.streamInterceptor), grpc.WithStatsHandler(tracingHandler))
	}
	return joinDialOptions(append(metricsOpts, tracingOpts...)...)
}

var joinServerOptions = internal.JoinServerOptions.(func(...grpc.ServerOption) grpc.ServerOption)

// ServerOption returns a server option which enables OpenTelemetry
// instrumentation code for a grpc.Server.
//
// Server applications interested in instrumenting their grpc.Server should pass
// the server option returned from this function as an argument to
// grpc.NewServer().
//
// For the metrics supported by this instrumentation code, specify the server
// metrics to record in metrics options. Also provide an implementation of a
// MeterProvider. If the passed in Meter Provider does not have the view
// configured for an individual metric turned on, the API call in this component
// will create a default view for that metric.
//
// For the traces supported by this instrumentation code, provide an
// implementation of a TextMapPropagator and OpenTelemetry TracerProvider.
func ServerOption(o Options) grpc.ServerOption {
	var metricsOpts, tracingOpts []grpc.ServerOption

	if o.isMetricsEnabled() {
		metricsHandler := &serverMetricsHandler{options: o}
		metricsHandler.initializeMetrics()
		metricsOpts = append(metricsOpts, grpc.ChainUnaryInterceptor(metricsHandler.unaryInterceptor), grpc.ChainStreamInterceptor(metricsHandler.streamInterceptor), grpc.StatsHandler(metricsHandler))
	}
	if o.isTracingEnabled() {
		tracingHandler := &serverTracingHandler{options: o}
		tracingHandler.initializeTraces()
		tracingOpts = append(tracingOpts, grpc.StatsHandler(tracingHandler))
	}
	return joinServerOptions(append(metricsOpts, tracingOpts...)...)
}

// callInfo is information pertaining to the lifespan of the RPC client side.
type callInfo struct {
	target string

	method string

	// nameResolutionEventAdded is set when the resolver delay trace event
	// is added. Prevents duplicate events, since it is reported per-attempt.
	nameResolutionEventAdded atomic.Bool
}

type callInfoKey struct{}

func setCallInfo(ctx context.Context, ci *callInfo) context.Context {
	return context.WithValue(ctx, callInfoKey{}, ci)
}

// getCallInfo returns the callInfo stored in the context, or nil
// if there isn't one.
func getCallInfo(ctx context.Context) *callInfo {
	ci, _ := ctx.Value(callInfoKey{}).(*callInfo)
	return ci
}

// rpcInfo is RPC information scoped to the RPC attempt life span client side,
// and the RPC life span server side.
type rpcInfo struct {
	ai *attemptInfo
}

type rpcInfoKey struct{}

func setRPCInfo(ctx context.Context, ri *rpcInfo) context.Context {
	return context.WithValue(ctx, rpcInfoKey{}, ri)
}

// getRPCInfo returns the rpcInfo stored in the context, or nil
// if there isn't one.
func getRPCInfo(ctx context.Context) *rpcInfo {
	ri, _ := ctx.Value(rpcInfoKey{}).(*rpcInfo)
	return ri
}

func removeLeadingSlash(mn string) string {
	return strings.TrimLeft(mn, "/")
}

// attemptInfo is RPC information scoped to the RPC attempt life span client
// side, and the RPC life span server side.
type attemptInfo struct {
	// access these counts atomically for hedging in the future:
	// number of bytes after compression (within each message) from side (client
	// || server).
	sentCompressedBytes int64
	// number of compressed bytes received (within each message) received on
	// side (client || server).
	recvCompressedBytes int64

	startTime time.Time
	method    string

	pluginOptionLabels map[string]string // pluginOptionLabels to attach to metrics emitted
	xdsLabels          map[string]string

	// traceSpan is data used for recording traces.
	traceSpan trace.Span
	// message counters for sent and received messages (used for
	// generating message IDs), and the number of previous RPC attempts for the
	// associated call.
	countSentMsg        uint32
	countRecvMsg        uint32
	previousRPCAttempts uint32
}

type clientMetrics struct {
	// "grpc.client.attempt.started"
	attemptStarted otelmetric.Int64Counter
	// "grpc.client.attempt.duration"
	attemptDuration otelmetric.Float64Histogram
	// "grpc.client.attempt.sent_total_compressed_message_size"
	attemptSentTotalCompressedMessageSize otelmetric.Int64Histogram
	// "grpc.client.attempt.rcvd_total_compressed_message_size"
	attemptRcvdTotalCompressedMessageSize otelmetric.Int64Histogram
	// "grpc.client.call.duration"
	callDuration otelmetric.Float64Histogram
}

type serverMetrics struct {
	// "grpc.server.call.started"
	callStarted otelmetric.Int64Counter
	// "grpc.server.call.sent_total_compressed_message_size"
	callSentTotalCompressedMessageSize otelmetric.Int64Histogram
	// "grpc.server.call.rcvd_total_compressed_message_size"
	callRcvdTotalCompressedMessageSize otelmetric.Int64Histogram
	// "grpc.server.call.duration"
	callDuration otelmetric.Float64Histogram
}

func createInt64Counter(setOfMetrics map[string]bool, metricName string, meter otelmetric.Meter, options ...otelmetric.Int64CounterOption) otelmetric.Int64Counter {
	if _, ok := setOfMetrics[metricName]; !ok {
		return noop.Int64Counter{}
	}
	ret, err := meter.Int64Counter(string(metricName), options...)
	if err != nil {
		logger.Errorf("failed to register metric \"%v\", will not record: %v", metricName, err)
		return noop.Int64Counter{}
	}
	return ret
}

func createInt64UpDownCounter(setOfMetrics map[string]bool, metricName string, meter otelmetric.Meter, options ...otelmetric.Int64UpDownCounterOption) otelmetric.Int64UpDownCounter {
	if _, ok := setOfMetrics[metricName]; !ok {
		return noop.Int64UpDownCounter{}
	}
	ret, err := meter.Int64UpDownCounter(string(metricName), options...)
	if err != nil {
		logger.Errorf("Failed to register metric \"%v\", will not record: %v", metricName, err)
		return noop.Int64UpDownCounter{}
	}
	return ret
}

func createFloat64Counter(setOfMetrics map[string]bool, metricName string, meter otelmetric.Meter, options ...otelmetric.Float64CounterOption) otelmetric.Float64Counter {
	if _, ok := setOfMetrics[metricName]; !ok {
		return noop.Float64Counter{}
	}
	ret, err := meter.Float64Counter(string(metricName), options...)
	if err != nil {
		logger.Errorf("failed to register metric \"%v\", will not record: %v", metricName, err)
		return noop.Float64Counter{}
	}
	return ret
}

func createInt64Histogram(setOfMetrics map[string]bool, metricName string, meter otelmetric.Meter, options ...otelmetric.Int64HistogramOption) otelmetric.Int64Histogram {
	if _, ok := setOfMetrics[metricName]; !ok {
		return noop.Int64Histogram{}
	}
	ret, err := meter.Int64Histogram(string(metricName), options...)
	if err != nil {
		logger.Errorf("failed to register metric \"%v\", will not record: %v", metricName, err)
		return noop.Int64Histogram{}
	}
	return ret
}

func createFloat64Histogram(setOfMetrics map[string]bool, metricName string, meter otelmetric.Meter, options ...otelmetric.Float64HistogramOption) otelmetric.Float64Histogram {
	if _, ok := setOfMetrics[metricName]; !ok {
		return noop.Float64Histogram{}
	}
	ret, err := meter.Float64Histogram(string(metricName), options...)
	if err != nil {
		logger.Errorf("failed to register metric \"%v\", will not record: %v", metricName, err)
		return noop.Float64Histogram{}
	}
	return ret
}

func createInt64Gauge(setOfMetrics map[string]bool, metricName string, meter otelmetric.Meter, options ...otelmetric.Int64GaugeOption) otelmetric.Int64Gauge {
	if _, ok := setOfMetrics[metricName]; !ok {
		return noop.Int64Gauge{}
	}
	ret, err := meter.Int64Gauge(string(metricName), options...)
	if err != nil {
		logger.Errorf("failed to register metric \"%v\", will not record: %v", metricName, err)
		return noop.Int64Gauge{}
	}
	return ret
}

func optionFromLabels(labelKeys []string, optionalLabelKeys []string, optionalLabels []string, labelVals ...string) otelmetric.MeasurementOption {
	var attributes []otelattribute.KeyValue

	// Once it hits here lower level has guaranteed length of labelVals matches
	// labelKeys + optionalLabelKeys.
	for i, label := range labelKeys {
		attributes = append(attributes, otelattribute.String(label, labelVals[i]))
	}

	for i, label := range optionalLabelKeys {
		for _, optLabel := range optionalLabels { // o(n) could build out a set but n is currently capped at < 5
			if label == optLabel {
				attributes = append(attributes, otelattribute.String(label, labelVals[i+len(labelKeys)]))
			}
		}
	}
	return otelmetric.WithAttributeSet(otelattribute.NewSet(attributes...))
}

// registryMetrics implements MetricsRecorder for the client and server stats
// handlers.
type registryMetrics struct {
	intCounts       map[*estats.MetricDescriptor]otelmetric.Int64Counter
	floatCounts     map[*estats.MetricDescriptor]otelmetric.Float64Counter
	intHistos       map[*estats.MetricDescriptor]otelmetric.Int64Histogram
	floatHistos     map[*estats.MetricDescriptor]otelmetric.Float64Histogram
	intGauges       map[*estats.MetricDescriptor]otelmetric.Int64Gauge
	intUpDownCounts map[*estats.MetricDescriptor]otelmetric.Int64UpDownCounter

	optionalLabels []string
}

func (rm *registryMetrics) registerMetrics(metrics *stats.MetricSet, meter otelmetric.Meter) {
	rm.intCounts = make(map[*estats.MetricDescriptor]otelmetric.Int64Counter)
	rm.floatCounts = make(map[*estats.MetricDescriptor]otelmetric.Float64Counter)
	rm.intHistos = make(map[*estats.MetricDescriptor]otelmetric.Int64Histogram)
	rm.floatHistos = make(map[*estats.MetricDescriptor]otelmetric.Float64Histogram)
	rm.intGauges = make(map[*estats.MetricDescriptor]otelmetric.Int64Gauge)
	rm.intUpDownCounts = make(map[*estats.MetricDescriptor]otelmetric.Int64UpDownCounter)

	for metric := range metrics.Metrics() {
		desc := estats.DescriptorForMetric(metric)
		if desc == nil {
			// Either the metric was per call or the metric is not registered.
			// Thus, if this component ever receives the desc as a handle in
			// record it will be a no-op.
			continue
		}
		switch desc.Type {
		case estats.MetricTypeIntCount:
			rm.intCounts[desc] = createInt64Counter(metrics.Metrics(), desc.Name, meter, otelmetric.WithUnit(desc.Unit), otelmetric.WithDescription(desc.Description))
		case estats.MetricTypeFloatCount:
			rm.floatCounts[desc] = createFloat64Counter(metrics.Metrics(), desc.Name, meter, otelmetric.WithUnit(desc.Unit), otelmetric.WithDescription(desc.Description))
		case estats.MetricTypeIntHisto:
			rm.intHistos[desc] = createInt64Histogram(metrics.Metrics(), desc.Name, meter, otelmetric.WithUnit(desc.Unit), otelmetric.WithDescription(desc.Description), otelmetric.WithExplicitBucketBoundaries(desc.Bounds...))
		case estats.MetricTypeFloatHisto:
			rm.floatHistos[desc] = createFloat64Histogram(metrics.Metrics(), desc.Name, meter, otelmetric.WithUnit(desc.Unit), otelmetric.WithDescription(desc.Description), otelmetric.WithExplicitBucketBoundaries(desc.Bounds...))
		case estats.MetricTypeIntGauge:
			rm.intGauges[desc] = createInt64Gauge(metrics.Metrics(), desc.Name, meter, otelmetric.WithUnit(desc.Unit), otelmetric.WithDescription(desc.Description))
		case estats.MetricTypeIntUpDownCount:
			rm.intUpDownCounts[desc] = createInt64UpDownCounter(metrics.Metrics(), desc.Name, meter, otelmetric.WithUnit(desc.Unit), otelmetric.WithDescription(desc.Description))
		}
	}
}

func (rm *registryMetrics) RecordInt64Count(handle *estats.Int64CountHandle, incr int64, labels ...string) {
	desc := handle.Descriptor()
	if ic, ok := rm.intCounts[desc]; ok {
		ao := optionFromLabels(desc.Labels, desc.OptionalLabels, rm.optionalLabels, labels...)
		ic.Add(context.TODO(), incr, ao)
	}
}

func (rm *registryMetrics) RecordInt64UpDownCount(handle *estats.Int64UpDownCountHandle, incr int64, labels ...string) {
	desc := handle.Descriptor()
	if ic, ok := rm.intUpDownCounts[desc]; ok {
		ao := optionFromLabels(desc.Labels, desc.OptionalLabels, rm.optionalLabels, labels...)
		ic.Add(context.TODO(), incr, ao)
	}
}

func (rm *registryMetrics) RecordFloat64Count(handle *estats.Float64CountHandle, incr float64, labels ...string) {
	desc := handle.Descriptor()
	if fc, ok := rm.floatCounts[desc]; ok {
		ao := optionFromLabels(desc.Labels, desc.OptionalLabels, rm.optionalLabels, labels...)
		fc.Add(context.TODO(), incr, ao)
	}
}

func (rm *registryMetrics) RecordInt64Histo(handle *estats.Int64HistoHandle, incr int64, labels ...string) {
	desc := handle.Descriptor()
	if ih, ok := rm.intHistos[desc]; ok {
		ao := optionFromLabels(desc.Labels, desc.OptionalLabels, rm.optionalLabels, labels...)
		ih.Record(context.TODO(), incr, ao)
	}
}

func (rm *registryMetrics) RecordFloat64Histo(handle *estats.Float64HistoHandle, incr float64, labels ...string) {
	desc := handle.Descriptor()
	if fh, ok := rm.floatHistos[desc]; ok {
		ao := optionFromLabels(desc.Labels, desc.OptionalLabels, rm.optionalLabels, labels...)
		fh.Record(context.TODO(), incr, ao)
	}
}

func (rm *registryMetrics) RecordInt64Gauge(handle *estats.Int64GaugeHandle, incr int64, labels ...string) {
	desc := handle.Descriptor()
	if ig, ok := rm.intGauges[desc]; ok {
		ao := optionFromLabels(desc.Labels, desc.OptionalLabels, rm.optionalLabels, labels...)
		ig.Record(context.TODO(), incr, ao)
	}
}

// Users of this component should use these bucket boundaries as part of their
// SDK MeterProvider passed in. This component sends this as "advice" to the
// API, which works, however this stability is not guaranteed, so for safety the
// SDK Meter Provider provided should set these bounds for corresponding
// metrics.
var (
	// DefaultLatencyBounds are the default bounds for latency metrics.
	DefaultLatencyBounds = []float64{0, 0.00001, 0.00005, 0.0001, 0.0003, 0.0006, 0.0008, 0.001, 0.002, 0.003, 0.004, 0.005, 0.006, 0.008, 0.01, 0.013, 0.016, 0.02, 0.025, 0.03, 0.04, 0.05, 0.065, 0.08, 0.1, 0.13, 0.16, 0.2, 0.25, 0.3, 0.4, 0.5, 0.65, 0.8, 1, 2, 5, 10, 20, 50, 100} // provide "advice" through API, SDK should set this too
	// DefaultSizeBounds are the default bounds for metrics which record size.
	DefaultSizeBounds = []float64{0, 1024, 2048, 4096, 16384, 65536, 262144, 1048576, 4194304, 16777216, 67108864, 268435456, 1073741824, 4294967296}
	// defaultPerCallMetrics are the default metrics provided by this module.
	defaultPerCallMetrics = stats.NewMetricSet(ClientAttemptStartedMetricName, ClientAttemptDurationMetricName, ClientAttemptSentCompressedTotalMessageSizeMetricName, ClientAttemptRcvdCompressedTotalMessageSizeMetricName, ClientCallDurationMetricName, ServerCallStartedMetricName, ServerCallSentCompressedTotalMessageSizeMetricName, ServerCallRcvdCompressedTotalMessageSizeMetricName, ServerCallDurationMetricName)
)

// DefaultMetrics returns a set of default OpenTelemetry metrics.
//
// This should only be invoked after init time.
func DefaultMetrics() *stats.MetricSet {
	return defaultPerCallMetrics.Join(estats.DefaultMetrics)
}
