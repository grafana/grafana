// Provenance-includes-location: https://github.com/weaveworks/common/blob/main/server/metrics.go
// Provenance-includes-license: Apache-2.0
// Provenance-includes-copyright: Weaveworks Ltd.

package server

import (
	"strconv"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"

	"github.com/grafana/dskit/instrument"
	"github.com/grafana/dskit/middleware"
)

type Metrics struct {
	TCPConnections             *prometheus.GaugeVec
	TCPConnectionsLimit        *prometheus.GaugeVec
	GRPCConcurrentStreamsLimit *prometheus.GaugeVec
	RequestDuration            *prometheus.HistogramVec
	PerTenantRequestDuration   *prometheus.HistogramVec
	PerTenantRequestTotal      *prometheus.CounterVec
	ReceivedMessageSize        *prometheus.HistogramVec
	SentMessageSize            *prometheus.HistogramVec
	InflightRequests           *prometheus.GaugeVec
	RequestThroughput          *prometheus.HistogramVec
	InvalidClusterRequests     *prometheus.CounterVec
}

func NewServerMetrics(cfg Config) *Metrics {
	reg := cfg.registererOrDefault()
	factory := promauto.With(reg)

	return &Metrics{
		TCPConnections: factory.NewGaugeVec(prometheus.GaugeOpts{
			Namespace: cfg.MetricsNamespace,
			Name:      "tcp_connections",
			Help:      "Current number of accepted TCP connections.",
		}, []string{"protocol"}),
		TCPConnectionsLimit: factory.NewGaugeVec(prometheus.GaugeOpts{
			Namespace: cfg.MetricsNamespace,
			Name:      "tcp_connections_limit",
			Help:      "The max number of TCP connections that can be accepted (0 means no limit).",
		}, []string{"protocol"}),
		GRPCConcurrentStreamsLimit: factory.NewGaugeVec(prometheus.GaugeOpts{
			Namespace: cfg.MetricsNamespace,
			Name:      "grpc_concurrent_streams_limit",
			Help:      "The max number of concurrent streams that can be accepted (0 means no limit).",
		}, []string{}),
		RequestDuration: factory.NewHistogramVec(prometheus.HistogramOpts{
			Namespace:                       cfg.MetricsNamespace,
			Name:                            "request_duration_seconds",
			Help:                            "Time (in seconds) spent serving HTTP requests.",
			Buckets:                         instrument.DefBuckets,
			NativeHistogramBucketFactor:     cfg.MetricsNativeHistogramFactor,
			NativeHistogramMaxBucketNumber:  100,
			NativeHistogramMinResetDuration: time.Hour,
		}, []string{"method", "route", "status_code", "ws"}),
		PerTenantRequestDuration: factory.NewHistogramVec(prometheus.HistogramOpts{
			Namespace:                       cfg.MetricsNamespace,
			Name:                            "per_tenant_request_duration_seconds",
			Help:                            "Time (in seconds) spent serving HTTP requests for a particular tenant.",
			Buckets:                         instrument.DefBuckets,
			NativeHistogramBucketFactor:     cfg.MetricsNativeHistogramFactor,
			NativeHistogramMaxBucketNumber:  100,
			NativeHistogramMinResetDuration: time.Hour,
		}, []string{"method", "route", "status_code", "ws", "tenant"}),
		PerTenantRequestTotal: factory.NewCounterVec(prometheus.CounterOpts{
			Namespace: cfg.MetricsNamespace,
			Name:      "per_tenant_request_total",
			Help:      "Total count of requests for a particular tenant.",
		}, []string{"method", "route", "status_code", "ws", "tenant"}),
		ReceivedMessageSize: factory.NewHistogramVec(prometheus.HistogramOpts{
			Namespace: cfg.MetricsNamespace,
			Name:      "request_message_bytes",
			Help:      "Size (in bytes) of messages received in the request.",
			Buckets:   middleware.BodySizeBuckets,
		}, []string{"method", "route"}),
		SentMessageSize: factory.NewHistogramVec(prometheus.HistogramOpts{
			Namespace: cfg.MetricsNamespace,
			Name:      "response_message_bytes",
			Help:      "Size (in bytes) of messages sent in response.",
			Buckets:   middleware.BodySizeBuckets,
		}, []string{"method", "route"}),
		InflightRequests: factory.NewGaugeVec(prometheus.GaugeOpts{
			Namespace: cfg.MetricsNamespace,
			Name:      "inflight_requests",
			Help:      "Current number of inflight requests.",
		}, []string{"method", "route"}),
		RequestThroughput: factory.NewHistogramVec(prometheus.HistogramOpts{
			Namespace:                       cfg.MetricsNamespace,
			Name:                            "request_throughput_" + cfg.Throughput.Unit,
			Help:                            "Server throughput of running requests.",
			ConstLabels:                     prometheus.Labels{"cutoff_ms": strconv.FormatInt(cfg.Throughput.LatencyCutoff.Milliseconds(), 10)},
			Buckets:                         instrument.DefBuckets,
			NativeHistogramBucketFactor:     cfg.MetricsNativeHistogramFactor,
			NativeHistogramMaxBucketNumber:  100,
			NativeHistogramMinResetDuration: time.Hour,
		}, []string{"method", "route"}),
		InvalidClusterRequests: middleware.NewInvalidClusterRequests(reg, cfg.MetricsNamespace),
	}
}
