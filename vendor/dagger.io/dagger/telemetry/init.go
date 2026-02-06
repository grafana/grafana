package telemetry

import (
	"context"
	"fmt"
	"log/slog"
	"net"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploggrpc"
	"go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploghttp"
	"go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetricgrpc"
	"go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetrichttp"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/propagation"
	sdklog "go.opentelemetry.io/otel/sdk/log"
	sdkmetric "go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.26.0"
	"google.golang.org/grpc"
)

var (
	configuredSpanExporter     sdktrace.SpanExporter
	configuredSpanExporterOnce sync.Once
)

func ConfiguredSpanExporter(ctx context.Context) (sdktrace.SpanExporter, bool) {
	ctx = context.WithoutCancel(ctx)

	configuredSpanExporterOnce.Do(func() {
		var err error

		// handle protocol first so we can guess the full uri from a top-level OTLP endpoint
		var proto string
		if v := os.Getenv("OTEL_EXPORTER_OTLP_TRACES_PROTOCOL"); v != "" {
			proto = v
		} else if v := os.Getenv("OTEL_EXPORTER_OTLP_PROTOCOL"); v != "" {
			proto = v
		} else {
			// https://github.com/open-telemetry/opentelemetry-specification/blob/v1.8.0/specification/protocol/exporter.md#specify-protocol
			proto = "http/protobuf"
		}

		var endpoint string
		if v := os.Getenv("OTEL_EXPORTER_OTLP_TRACES_ENDPOINT"); v != "" {
			endpoint = v
		} else if v := os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT"); v != "" {
			if proto == "http/protobuf" {
				endpoint, err = url.JoinPath(v, "v1", "traces")
				if err != nil {
					slog.Warn("failed to join path", "error", err)
					return
				}
			} else {
				endpoint = v
			}
		}

		if endpoint == "" {
			return
		}

		//nolint:dupl
		switch proto {
		case "http/protobuf", "http":
			headers := map[string]string{}
			if hs := os.Getenv("OTEL_EXPORTER_OTLP_HEADERS"); hs != "" {
				for _, header := range strings.Split(hs, ",") {
					name, value, _ := strings.Cut(header, "=")
					headers[name] = value
				}
			}
			configuredSpanExporter, err = otlptracehttp.New(ctx,
				otlptracehttp.WithEndpointURL(endpoint),
				otlptracehttp.WithHeaders(headers))
		case "grpc":
			var u *url.URL
			u, err = url.Parse(endpoint)
			if err != nil {
				slog.Warn("bad OTLP span endpoint %q: %w", endpoint, err)
				return
			}
			opts := []otlptracegrpc.Option{
				otlptracegrpc.WithEndpointURL(endpoint),
			}
			if u.Scheme == "unix" {
				dialer := func(ctx context.Context, addr string) (net.Conn, error) {
					return net.Dial(u.Scheme, u.Path)
				}
				opts = append(opts,
					otlptracegrpc.WithDialOption(grpc.WithContextDialer(dialer)),
					otlptracegrpc.WithInsecure())
			}
			configuredSpanExporter, err = otlptracegrpc.New(ctx, opts...)
		default:
			err = fmt.Errorf("unknown OTLP protocol: %s", proto)
		}
		if err != nil {
			slog.Warn("failed to configure tracing", "error", err)
		}
	})
	return configuredSpanExporter, configuredSpanExporter != nil
}

var configuredLogExporter sdklog.Exporter
var configuredLogExporterOnce sync.Once

func ConfiguredLogExporter(ctx context.Context) (sdklog.Exporter, bool) {
	ctx = context.WithoutCancel(ctx)

	configuredLogExporterOnce.Do(func() {
		var err error

		var endpoint string
		if v := os.Getenv("OTEL_EXPORTER_OTLP_LOGS_ENDPOINT"); v != "" {
			endpoint = v
		} else if v := os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT"); v != "" {
			// we can't assume all OTLP endpoints support logs. better to be explicit
			// than have noisy otel errors.
			return
		}
		if endpoint == "" {
			return
		}

		var proto string
		if v := os.Getenv("OTEL_EXPORTER_OTLP_LOGS_PROTOCOL"); v != "" {
			proto = v
		} else if v := os.Getenv("OTEL_EXPORTER_OTLP_PROTOCOL"); v != "" {
			proto = v
		} else {
			// https://github.com/open-telemetry/opentelemetry-specification/blob/v1.8.0/specification/protocol/exporter.md#specify-protocol
			proto = "http/protobuf"
		}

		switch proto {
		case "http/protobuf", "http":
			headers := map[string]string{}
			if hs := os.Getenv("OTEL_EXPORTER_OTLP_HEADERS"); hs != "" {
				for _, header := range strings.Split(hs, ",") {
					name, value, _ := strings.Cut(header, "=")
					headers[name] = value
				}
			}
			configuredLogExporter, err = otlploghttp.New(ctx,
				otlploghttp.WithEndpointURL(endpoint),
				otlploghttp.WithHeaders(headers))

		case "grpc":
			// FIXME: bring back when it's actually implemented

			// u, err := url.Parse(endpoint)
			// if err != nil {
			// 	slog.Warn("bad OTLP logs endpoint %q: %w", endpoint, err)
			// 	return
			// }
			//
			opts := []otlploggrpc.Option{
				// 	otlploggrpc.WithEndpointURL(endpoint),
			}
			// if u.Scheme == "unix" {
			// 	dialer := func(ctx context.Context, addr string) (net.Conn, error) {
			// 		return net.Dial(u.Scheme, u.Path)
			// 	}
			// 	opts = append(opts,
			// 		otlploggrpc.WithDialOption(grpc.WithContextDialer(dialer)),
			// 		otlploggrpc.WithInsecure())
			// }
			configuredLogExporter, err = otlploggrpc.New(ctx, opts...)

		default:
			err = fmt.Errorf("unknown OTLP protocol: %s", proto)
		}
		if err != nil {
			slog.Warn("failed to configure logging", "error", err)
		}
	})
	return configuredLogExporter, configuredLogExporter != nil
}

var configuredMetricExporter sdkmetric.Exporter
var configuredMetricExporterOnce sync.Once

func ConfiguredMetricExporter(ctx context.Context) (sdkmetric.Exporter, bool) {
	ctx = context.WithoutCancel(ctx)

	configuredMetricExporterOnce.Do(func() {
		var err error

		var endpoint string
		if v := os.Getenv("OTEL_EXPORTER_OTLP_METRICS_ENDPOINT"); v != "" {
			endpoint = v
		} else if v := os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT"); v != "" {
			// we can't assume all OTLP endpoints support metrics. better to be explicit
			// than have noisy otel errors.
			return
		}
		if endpoint == "" {
			return
		}

		var proto string
		if v := os.Getenv("OTEL_EXPORTER_OTLP_METRICS_PROTOCOL"); v != "" {
			proto = v
		} else if v := os.Getenv("OTEL_EXPORTER_OTLP_PROTOCOL"); v != "" {
			proto = v
		} else {
			// https://github.com/open-telemetry/opentelemetry-specification/blob/v1.8.0/specification/protocol/exporter.md#specify-protocol
			proto = "http/protobuf"
		}

		//nolint:dupl
		switch proto {
		case "http/protobuf", "http":
			headers := map[string]string{}
			if hs := os.Getenv("OTEL_EXPORTER_OTLP_HEADERS"); hs != "" {
				for _, header := range strings.Split(hs, ",") {
					name, value, _ := strings.Cut(header, "=")
					headers[name] = value
				}
			}
			configuredMetricExporter, err = otlpmetrichttp.New(ctx,
				otlpmetrichttp.WithEndpointURL(endpoint),
				otlpmetrichttp.WithHeaders(headers))

		case "grpc":
			var u *url.URL
			u, err = url.Parse(endpoint)
			if err != nil {
				slog.Warn("bad OTLP metrics endpoint %q: %w", endpoint, err)
				return
			}
			opts := []otlpmetricgrpc.Option{
				otlpmetricgrpc.WithEndpointURL(endpoint),
			}
			if u.Scheme == "unix" {
				dialer := func(ctx context.Context, addr string) (net.Conn, error) {
					return net.Dial(u.Scheme, u.Path)
				}
				opts = append(opts,
					otlpmetricgrpc.WithDialOption(grpc.WithContextDialer(dialer)),
					otlpmetricgrpc.WithInsecure())
			}
			configuredMetricExporter, err = otlpmetricgrpc.New(ctx, opts...)

		default:
			err = fmt.Errorf("unknown OTLP protocol: %s", proto)
		}
		if err != nil {
			slog.Warn("failed to configure metrics", "error", err)
		}
	})
	return configuredMetricExporter, configuredMetricExporter != nil
}

// fallbackResource is the fallback resource definition. A more specific
// resource should be set in Init.
func fallbackResource() *resource.Resource {
	return resource.NewWithAttributes(
		semconv.SchemaURL,
		semconv.ServiceNameKey.String("dagger"),
	)
}

var (
	// set by Init, closed by Close
	tracerProvider *sdktrace.TracerProvider = sdktrace.NewTracerProvider()
)

type Config struct {
	// Auto-detect exporters from OTEL_* env variables.
	Detect bool

	// SpanProcessors are processors to prepend to the telemetry pipeline.
	SpanProcessors []sdktrace.SpanProcessor

	// LiveTraceExporters are exporters that can receive updates for spans at runtime,
	// rather than waiting until the span ends.
	//
	// Example: TUI, Cloud
	LiveTraceExporters []sdktrace.SpanExporter

	// BatchedTraceExporters are exporters that receive spans in batches, after the
	// spans have ended.
	//
	// Example: Honeycomb, Jaeger, etc.
	BatchedTraceExporters []sdktrace.SpanExporter

	// LiveLogExporters are exporters that receive logs in batches of ~100ms.
	LiveLogExporters []sdklog.Exporter

	// LiveMetricExporters are exporters that receive metrics in batches of ~1s.
	LiveMetricExporters []sdkmetric.Exporter

	// Resource is the resource describing this component and runtime
	// environment.
	Resource *resource.Resource
}

// NearlyImmediate is 100ms, below which has diminishing returns in terms of
// visual perception vs. performance cost.
const NearlyImmediate = 100 * time.Millisecond

// LiveTracesEnabled indicates that the configured OTEL_* exporter should be
// sent live span telemetry.
var LiveTracesEnabled = os.Getenv("OTEL_EXPORTER_OTLP_TRACES_LIVE") != ""

var Resource *resource.Resource
var SpanProcessors = []sdktrace.SpanProcessor{}
var LogProcessors = []sdklog.Processor{}
var MetricExporters = []sdkmetric.Exporter{}

func InitEmbedded(ctx context.Context, res *resource.Resource) context.Context {
	traceCfg := Config{
		Detect:   false, // false, since we want "live" exporting
		Resource: res,
	}
	if exp, ok := ConfiguredSpanExporter(ctx); ok {
		traceCfg.LiveTraceExporters = append(traceCfg.LiveTraceExporters, exp)
	}
	if exp, ok := ConfiguredLogExporter(ctx); ok {
		traceCfg.LiveLogExporters = append(traceCfg.LiveLogExporters, exp)
	}
	if exp, ok := ConfiguredMetricExporter(ctx); ok {
		traceCfg.LiveMetricExporters = append(traceCfg.LiveMetricExporters, exp)
	}
	return Init(ctx, traceCfg)
}

// Propagator is a composite propagator of everything we could possibly want.
//
// Do not rely on otel.GetTextMapPropagator() - it's prone to change from a
// random import.
var Propagator = propagation.NewCompositeTextMapPropagator(
	propagation.Baggage{},
	propagation.TraceContext{},
)

// closeCtx holds on to the initial context returned by Init. Close will
// extract its providers and close them.
var closeCtx context.Context

// Init sets up the global OpenTelemetry providers tracing, logging, and
// someday metrics providers. It is called by the CLI, the engine, and the
// container shim, so it needs to be versatile.
func Init(ctx context.Context, cfg Config) context.Context {
	// Set up a text map propagator so that things, well, propagate. The default
	// is a noop.
	otel.SetTextMapPropagator(Propagator)

	// Inherit trace context from env if present.
	ctx = Propagator.Extract(ctx, NewEnvCarrier(true))

	// Log to slog.
	otel.SetErrorHandler(otel.ErrorHandlerFunc(func(err error) {
		slog.Error("failed to emit telemetry", "error", err)
	}))

	if cfg.Resource == nil {
		cfg.Resource = fallbackResource()
	}

	// Set up the global resource so we can pass it into dynamically allocated
	// log/trace providers at runtime.
	Resource = cfg.Resource

	if cfg.Detect {
		if exp, ok := ConfiguredSpanExporter(ctx); ok {
			if LiveTracesEnabled {
				cfg.LiveTraceExporters = append(cfg.LiveTraceExporters, exp)
			} else {
				cfg.BatchedTraceExporters = append(cfg.BatchedTraceExporters,
					// Filter out unfinished spans to avoid confusing external systems.
					//
					// Normally we avoid sending them here by virtue of putting this into
					// BatchedTraceExporters, but that only applies to the local process.
					// Unfinished spans may end up here if they're proxied out of the
					// engine via Params.EngineTrace.
					FilterLiveSpansExporter{exp})
			}
		}
		if exp, ok := ConfiguredLogExporter(ctx); ok {
			cfg.LiveLogExporters = append(cfg.LiveLogExporters, exp)
		}
		if exp, ok := ConfiguredMetricExporter(ctx); ok {
			cfg.LiveMetricExporters = append(cfg.LiveMetricExporters, exp)
		}
	}

	traceOpts := []sdktrace.TracerProviderOption{
		sdktrace.WithResource(cfg.Resource),
	}

	SpanProcessors = cfg.SpanProcessors

	for _, exporter := range cfg.LiveTraceExporters {
		processor := NewLiveSpanProcessor(exporter)
		SpanProcessors = append(SpanProcessors, processor)
	}
	for _, exporter := range cfg.BatchedTraceExporters {
		processor := sdktrace.NewBatchSpanProcessor(exporter)
		SpanProcessors = append(SpanProcessors, processor)
	}
	for _, proc := range SpanProcessors {
		traceOpts = append(traceOpts, sdktrace.WithSpanProcessor(proc))
	}

	tracerProvider = sdktrace.NewTracerProvider(traceOpts...)

	// Register our TracerProvider as the global so any imported instrumentation
	// in the future will default to using it.
	//
	// NB: this is also necessary so that we can establish a root span, otherwise
	// telemetry doesn't work.
	otel.SetTracerProvider(tracerProvider)

	// Set up a log provider if configured.
	if len(cfg.LiveLogExporters) > 0 {
		logOpts := []sdklog.LoggerProviderOption{
			sdklog.WithResource(cfg.Resource),
		}
		for _, exp := range cfg.LiveLogExporters {
			processor := sdklog.NewBatchProcessor(exp,
				sdklog.WithExportInterval(NearlyImmediate))
			LogProcessors = append(LogProcessors, processor)
			logOpts = append(logOpts, sdklog.WithProcessor(processor))
		}
		ctx = WithLoggerProvider(ctx, sdklog.NewLoggerProvider(logOpts...))
	}

	// Set up a metric provider if configured.
	if len(cfg.LiveMetricExporters) > 0 {
		meterOpts := []sdkmetric.Option{
			sdkmetric.WithResource(cfg.Resource),
		}
		const metricsExportInterval = 1 * time.Second
		for _, exp := range cfg.LiveMetricExporters {
			MetricExporters = append(MetricExporters, exp)
			reader := sdkmetric.NewPeriodicReader(exp,
				sdkmetric.WithInterval(metricsExportInterval))
			meterOpts = append(meterOpts, sdkmetric.WithReader(reader))
		}
		ctx = WithMeterProvider(ctx, sdkmetric.NewMeterProvider(meterOpts...))
	}

	closeCtx = ctx

	return ctx
}

// Close shuts down the global OpenTelemetry providers, flushing any remaining
// data to the configured exporters.
func Close() {
	ctx := closeCtx
	flushCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 30*time.Second)
	defer cancel()
	if tracerProvider != nil {
		if err := tracerProvider.Shutdown(flushCtx); err != nil {
			slog.Error("failed to shut down tracer provider", "error", err)
		}
	}
	if loggerProvider := LoggerProvider(ctx); loggerProvider != nil {
		if err := loggerProvider.Shutdown(flushCtx); err != nil {
			slog.Error("failed to shut down logger provider", "error", err)
		}
	}
}
