// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package autoexport // import "go.opentelemetry.io/contrib/exporters/autoexport"

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"

	prometheusbridge "go.opentelemetry.io/contrib/bridges/prometheus"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetricgrpc"
	"go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetrichttp"
	promexporter "go.opentelemetry.io/otel/exporters/prometheus"
	"go.opentelemetry.io/otel/exporters/stdout/stdoutmetric"
	"go.opentelemetry.io/otel/sdk/metric"
)

const otelExporterOTLPMetricsProtoEnvKey = "OTEL_EXPORTER_OTLP_METRICS_PROTOCOL"

// MetricOption applies an autoexport configuration option.
type MetricOption = option[metric.Reader]

// WithFallbackMetricReader sets the fallback exporter to use when no exporter
// is configured through the OTEL_METRICS_EXPORTER environment variable.
func WithFallbackMetricReader(metricReaderFactory func(ctx context.Context) (metric.Reader, error)) MetricOption {
	return withFallbackFactory[metric.Reader](metricReaderFactory)
}

// NewMetricReader returns a configured [go.opentelemetry.io/otel/sdk/metric.Reader]
// defined using the environment variables described below.
//
// OTEL_METRICS_EXPORTER defines the metrics exporter; supported values:
//   - "none" - "no operation" exporter
//   - "otlp" (default) - OTLP exporter; see [go.opentelemetry.io/otel/exporters/otlp/otlpmetric]
//   - "prometheus" - Prometheus exporter + HTTP server; see [go.opentelemetry.io/otel/exporters/prometheus]
//   - "console" - Standard output exporter; see [go.opentelemetry.io/otel/exporters/stdout/stdoutmetric]
//
// OTEL_EXPORTER_OTLP_PROTOCOL defines OTLP exporter's transport protocol;
// supported values:
//   - "grpc" - protobuf-encoded data using gRPC wire format over HTTP/2 connection;
//     see: [go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetricgrpc]
//   - "http/protobuf" (default) -  protobuf-encoded data over HTTP connection;
//     see: [go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetrichttp]
//
// OTEL_EXPORTER_OTLP_METRICS_PROTOCOL defines OTLP exporter's transport protocol for the metrics signal;
// supported values are the same as OTEL_EXPORTER_OTLP_PROTOCOL.
//
// OTEL_EXPORTER_PROMETHEUS_HOST (defaulting to "localhost") and
// OTEL_EXPORTER_PROMETHEUS_PORT (defaulting to 9464) define the host and port for the
// Prometheus exporter's HTTP server.
//
// Experimental: OTEL_METRICS_PRODUCERS can be used to configure metric producers.
// supported values: prometheus, none. Multiple values can be specified separated by commas.
//
// An error is returned if an environment value is set to an unhandled value.
//
// Use [RegisterMetricReader] to handle more values of OTEL_METRICS_EXPORTER.
// Use [RegisterMetricProducer] to handle more values of OTEL_METRICS_PRODUCERS.
//
// Use [WithFallbackMetricReader] option to change the returned exporter
// when OTEL_METRICS_EXPORTER is unset or empty.
//
// Use [IsNoneMetricReader] to check if the returned exporter is a "no operation" exporter.
func NewMetricReader(ctx context.Context, opts ...MetricOption) (metric.Reader, error) {
	return metricsSignal.create(ctx, opts...)
}

// RegisterMetricReader sets the MetricReader factory to be used when the
// OTEL_METRICS_EXPORTERS environment variable contains the exporter name. This
// will panic if name has already been registered.
func RegisterMetricReader(name string, factory func(context.Context) (metric.Reader, error)) {
	must(metricsSignal.registry.store(name, factory))
}

// RegisterMetricProducer sets the MetricReader factory to be used when the
// OTEL_METRICS_PRODUCERS environment variable contains the producer name. This
// will panic if name has already been registered.
func RegisterMetricProducer(name string, factory func(context.Context) (metric.Producer, error)) {
	must(metricsProducers.registry.store(name, factory))
}

// WithFallbackMetricProducer sets the fallback producer to use when no producer
// is configured through the OTEL_METRICS_PRODUCERS environment variable.
func WithFallbackMetricProducer(producerFactory func(ctx context.Context) (metric.Producer, error)) {
	metricsProducers.fallbackProducer = producerFactory
}

var (
	metricsSignal    = newSignal[metric.Reader]("OTEL_METRICS_EXPORTER")
	metricsProducers = newProducerRegistry("OTEL_METRICS_PRODUCERS")
)

func init() {
	RegisterMetricReader("otlp", func(ctx context.Context) (metric.Reader, error) {
		producers, err := metricsProducers.create(ctx)
		if err != nil {
			return nil, err
		}
		readerOpts := []metric.PeriodicReaderOption{}
		for _, producer := range producers {
			readerOpts = append(readerOpts, metric.WithProducer(producer))
		}

		proto := os.Getenv(otelExporterOTLPMetricsProtoEnvKey)
		if proto == "" {
			proto = os.Getenv(otelExporterOTLPProtoEnvKey)
		}

		// Fallback to default, http/protobuf.
		if proto == "" {
			proto = "http/protobuf"
		}

		switch proto {
		case "grpc":
			r, err := otlpmetricgrpc.New(ctx)
			if err != nil {
				return nil, err
			}
			return metric.NewPeriodicReader(r, readerOpts...), nil
		case "http/protobuf":
			r, err := otlpmetrichttp.New(ctx)
			if err != nil {
				return nil, err
			}
			return metric.NewPeriodicReader(r, readerOpts...), nil
		default:
			return nil, errInvalidOTLPProtocol
		}
	})
	RegisterMetricReader("console", func(ctx context.Context) (metric.Reader, error) {
		producers, err := metricsProducers.create(ctx)
		if err != nil {
			return nil, err
		}
		readerOpts := []metric.PeriodicReaderOption{}
		for _, producer := range producers {
			readerOpts = append(readerOpts, metric.WithProducer(producer))
		}

		r, err := stdoutmetric.New()
		if err != nil {
			return nil, err
		}
		return metric.NewPeriodicReader(r, readerOpts...), nil
	})
	RegisterMetricReader("none", func(ctx context.Context) (metric.Reader, error) {
		return newNoopMetricReader(), nil
	})
	RegisterMetricReader("prometheus", func(ctx context.Context) (metric.Reader, error) {
		// create an isolated registry instead of using the global registry --
		// the user might not want to mix OTel with non-OTel metrics.
		// Those that want to comingle metrics from global registry can use
		// OTEL_METRICS_PRODUCERS=prometheus
		reg := prometheus.NewRegistry()

		exporterOpts := []promexporter.Option{promexporter.WithRegisterer(reg)}

		producers, err := metricsProducers.create(ctx)
		if err != nil {
			return nil, err
		}
		for _, producer := range producers {
			exporterOpts = append(exporterOpts, promexporter.WithProducer(producer))
		}

		reader, err := promexporter.New(exporterOpts...)
		if err != nil {
			return nil, err
		}

		mux := http.NewServeMux()
		mux.Handle("/metrics", promhttp.HandlerFor(reg, promhttp.HandlerOpts{Registry: reg}))
		server := http.Server{
			// Timeouts are necessary to make a server resilient to attacks, but ListenAndServe doesn't set any.
			// We use values from this example: https://blog.cloudflare.com/exposing-go-on-the-internet/#:~:text=There%20are%20three%20main%20timeouts
			ReadTimeout:  5 * time.Second,
			WriteTimeout: 10 * time.Second,
			IdleTimeout:  120 * time.Second,
			Handler:      mux,
		}

		// environment variable names and defaults specified at https://opentelemetry.io/docs/specs/otel/configuration/sdk-environment-variables/#prometheus-exporter
		host := getenv("OTEL_EXPORTER_PROMETHEUS_HOST", "localhost")
		port := getenv("OTEL_EXPORTER_PROMETHEUS_PORT", "9464")
		addr := host + ":" + port
		lis, err := net.Listen("tcp", addr)
		if err != nil {
			return nil, errors.Join(
				fmt.Errorf("binding address %s for Prometheus exporter: %w", addr, err),
				reader.Shutdown(ctx),
			)
		}

		go func() {
			if err := server.Serve(lis); err != nil && !errors.Is(err, http.ErrServerClosed) {
				otel.Handle(fmt.Errorf("the Prometheus HTTP server exited unexpectedly: %w", err))
			}
		}()

		return readerWithServer{lis.Addr(), reader, &server}, nil
	})

	RegisterMetricProducer("prometheus", func(ctx context.Context) (metric.Producer, error) {
		return prometheusbridge.NewMetricProducer(), nil
	})
	RegisterMetricProducer("none", func(ctx context.Context) (metric.Producer, error) {
		return newNoopMetricProducer(), nil
	})
}

type readerWithServer struct {
	addr net.Addr
	metric.Reader
	server *http.Server
}

func (rws readerWithServer) Shutdown(ctx context.Context) error {
	return errors.Join(
		rws.Reader.Shutdown(ctx),
		rws.server.Shutdown(ctx),
	)
}

func getenv(key, fallback string) string {
	result, ok := os.LookupEnv(key)
	if !ok {
		return fallback
	}
	return result
}

type producerRegistry struct {
	envKey           string
	fallbackProducer func(context.Context) (metric.Producer, error)
	registry         *registry[metric.Producer]
}

func newProducerRegistry(envKey string) producerRegistry {
	return producerRegistry{
		envKey: envKey,
		registry: &registry[metric.Producer]{
			names: make(map[string]func(context.Context) (metric.Producer, error)),
		},
	}
}

func (pr producerRegistry) create(ctx context.Context) ([]metric.Producer, error) {
	expType := os.Getenv(pr.envKey)
	if expType == "" {
		if pr.fallbackProducer != nil {
			producer, err := pr.fallbackProducer(ctx)
			if err != nil {
				return nil, err
			}

			return []metric.Producer{producer}, nil
		}

		return nil, nil
	}

	producers := dedupedMetricProducers(expType)
	metricProducers := make([]metric.Producer, 0, len(producers))
	for _, producer := range producers {
		producer, err := pr.registry.load(ctx, producer)
		if err != nil {
			return nil, err
		}

		metricProducers = append(metricProducers, producer)
	}

	return metricProducers, nil
}

func dedupedMetricProducers(envValue string) []string {
	producers := make(map[string]struct{})
	for _, producer := range strings.Split(envValue, ",") {
		producers[producer] = struct{}{}
	}

	result := make([]string, 0, len(producers))
	for producer := range producers {
		result = append(result, producer)
	}

	return result
}
