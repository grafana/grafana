// Provenance-includes-location: https://github.com/weaveworks/common/blob/main/tracing/tracing.go
// Provenance-includes-license: Apache-2.0
// Provenance-includes-copyright: Weaveworks Ltd.

package tracing

import (
	"context"
	"fmt"
	"io"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/go-kit/log"
	"github.com/go-kit/log/level"
	otelpyroscope "github.com/grafana/otel-profiling-go"
	"go.opentelemetry.io/contrib/exporters/autoexport"
	jaegerpropagator "go.opentelemetry.io/contrib/propagators/jaeger"
	"go.opentelemetry.io/contrib/samplers/jaegerremote"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	"go.opentelemetry.io/otel/trace"

	tracesdk "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.26.0"
)

var tracer = otel.Tracer("dskit/tracing")

// NewOTelFromEnv is a convenience function to allow OpenTelemetry tracing configuration via environment variables.
// Refer to official OTel SDK configuration docs to see the available options.
// https://opentelemetry.io/docs/languages/sdk-configuration/general/
func NewOTelFromEnv(serviceName string, logger log.Logger, opts ...OTelOption) (io.Closer, error) {
	level.Info(logger).Log("msg", "initialising OpenTelemetry tracer")

	exp, err := autoexport.NewSpanExporter(context.Background())
	if err != nil {
		return nil, fmt.Errorf("failed to create OTEL exporter: %w", err)
	}

	var cfg config
	for _, opt := range opts {
		opt.apply(&cfg)
	}

	resource, err := NewResource(serviceName, cfg.resourceAttributes)
	if err != nil {
		return nil, fmt.Errorf("failed to initialise trace resource: %w", err)
	}

	options := []tracesdk.TracerProviderOption{
		tracesdk.WithBatcher(exp),
		tracesdk.WithResource(resource),
	}
	if jaegerRemoteSampler, ok, err := MaybeJaegerRemoteSamplerFromEnv(serviceName); err != nil {
		return nil, fmt.Errorf("failed to create Jaeger remote sampler: %w", err)
	} else if ok {
		options = append(options, tracesdk.WithSampler(jaegerRemoteSampler))
	}
	options = append(options, cfg.tracerProviderOptions...)

	level.Debug(logger).Log("msg", "OpenTelemetry tracer provider initialized from OTel environment variables")
	tpsdk := tracesdk.NewTracerProvider(options...)
	tp := trace.TracerProvider(tpsdk)
	if !cfg.pyroscopeDisabled {
		tp = otelpyroscope.NewTracerProvider(tp)
	}

	otel.SetTracerProvider(tp)
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(OTelPropagatorsFromEnv()...))
	otel.SetErrorHandler(otelErrorHandlerFunc(func(err error) {
		level.Error(logger).Log("msg", "OpenTelemetry.ErrorHandler", "err", err)
	}))

	return ioCloser(func() error {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := tpsdk.Shutdown(ctx); err != nil {
			level.Error(logger).Log("msg", "OpenTelemetry trace provider failed to shutdown", "err", err)
			return err
		}
		return nil
	}), nil
}

type config struct {
	resourceAttributes    []attribute.KeyValue
	tracerProviderOptions []tracesdk.TracerProviderOption
	pyroscopeDisabled     bool
}

type OTelOption interface {
	apply(*config)
}

// WithResourceAttributes allows to add custom attributes to the OpenTelemetry resource.
// This is useful to set, for example, the service version.
// Service name is already set by default.
func WithResourceAttributes(attrs ...attribute.KeyValue) OTelOption {
	return resourceAttributesOption(attrs)
}

type resourceAttributesOption []attribute.KeyValue

func (o resourceAttributesOption) apply(cfg *config) {
	cfg.resourceAttributes = append(cfg.resourceAttributes, o...)
}

// WithTracerProviderOptions allows to pass additional options to the OpenTelemetry TracerProvider.
func WithTracerProviderOptions(opts ...tracesdk.TracerProviderOption) OTelOption {
	return tracerProviderOptionsOption(opts)
}

type tracerProviderOptionsOption []tracesdk.TracerProviderOption

func (o tracerProviderOptionsOption) apply(cfg *config) {
	cfg.tracerProviderOptions = append(cfg.tracerProviderOptions, o...)
}

// WithPyroscopeDisabled disables pyroscope profiling in the OpenTelemetry tracer.
func WithPyroscopeDisabled() OTelOption {
	return pyroscopeDisabledOption{}
}

type pyroscopeDisabledOption struct{}

func (o pyroscopeDisabledOption) apply(cfg *config) {
	cfg.pyroscopeDisabled = true
}

type ioCloser func() error

func (c ioCloser) Close() error { return c() }

type otelErrorHandlerFunc func(error)

// Handle implements otel.ErrorHandler
func (f otelErrorHandlerFunc) Handle(err error) {
	f(err)
}

// NewResource creates a new OpenTelemetry resource using the provided service name and custom attributes.
// This resource will be used for creating both tracers and meters, enriching telemetry data with context.
func NewResource(serviceName string, customAttributes []attribute.KeyValue) (*resource.Resource, error) {
	// Append the service name as an attribute to the custom attributes list.
	customAttributes = append(customAttributes, semconv.ServiceName(serviceName))

	// Merge the default resource with the new resource containing custom attributes.
	// This ensures that standard attributes are retained while adding custom ones.
	return resource.Merge(
		resource.Default(),
		resource.NewWithAttributes(
			semconv.SchemaURL,
			customAttributes...,
		),
	)
}

// MaybeJaegerRemoteSamplerFromEnv checks the environment variables to see
// if `jaeger_remote` or `parentbased_jaeger_remote` sampler is configured through OTEL_TRACES_SAMPLER.
//
// This extends go.opentelemetry.io/otel/sdk/trace/sampler_env.go `samplerFromEnv()` with support for Jaeger remote samplers as per docs in:
// https://opentelemetry.io/docs/languages/sdk-configuration/general/
// It is not planned to implement this in OTel SDK: https://github.com/open-telemetry/opentelemetry-go/issues/6296#issuecomment-2648125926
//
// If the environment variable is set to "jaeger_remote" or "parentbased_jaeger_remote",
// but `OTEL_TRACES_SAMPLER_ARG` is not in the correct format (according to the docs mentioned above), then an error is returned.
func MaybeJaegerRemoteSamplerFromEnv(serviceName string) (tracesdk.Sampler, bool, error) {
	samplerName, ok := os.LookupEnv("OTEL_TRACES_SAMPLER")
	if !ok {
		return nil, false, nil
	}
	parentBased := false
	switch samplerName {
	case "jaeger_remote":
	case "parentbased_jaeger_remote":
		parentBased = true
	default:
		// Something else is configured, not a Jaeger remote sampler.
		// If it's something known, trace provider already configured it through samplerFromEnv() function in the SDK.
		return nil, false, nil
	}

	args, ok := os.LookupEnv("OTEL_TRACES_SAMPLER_ARG")
	if !ok || args == "" {
		return nil, false, fmt.Errorf("OTEL_TRACES_SAMPLER_ARG is not set for Jaeger remote sampler %s", samplerName)
	}

	// Parse the OTEL_TRACES_SAMPLER_ARG environment variable.
	// It should be in the format "endpoint=http://localhost:14250,pollingIntervalMs=5000,initialSamplingRate=0.25"
	parts := strings.Split(args, ",")
	var endpoint string
	var pollingInterval time.Duration
	var initialSamplingRate float64
	var initialSamplingRateSet bool
	var endpointSet bool
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if strings.HasPrefix(part, "endpoint=") {
			endpoint = strings.TrimPrefix(part, "endpoint=")
			endpointSet = true
		}
		if strings.HasPrefix(part, "pollingIntervalMs=") {
			pollingIntervalStr := strings.TrimPrefix(part, "pollingIntervalMs=")
			pollingIntervalMs, err := strconv.Atoi(pollingIntervalStr)
			if err != nil {
				return nil, false, fmt.Errorf("invalid pollingIntervalMs value in OTEL_TRACES_SAMPLER_ARG: %w", err)
			}
			pollingInterval = time.Duration(pollingIntervalMs) * time.Millisecond
		}
		if strings.HasPrefix(part, "initialSamplingRate=") {
			var err error
			initialSamplingRate, err = strconv.ParseFloat(strings.TrimPrefix(part, "initialSamplingRate="), 64)
			if err != nil {
				return nil, false, fmt.Errorf("invalid initialSamplingRate value in OTEL_TRACES_SAMPLER_ARG: %w", err)
			}
			if initialSamplingRate < 0 || initialSamplingRate > 1 {
				return nil, false, fmt.Errorf("initialSamplingRate value set in OTEL_TRACES_SAMPLER_ARG must be between 0 and 1, got %f", initialSamplingRate)
			}
			initialSamplingRateSet = true
		}
	}
	if !endpointSet {
		return nil, false, fmt.Errorf("endpoint is not set in OTEL_TRACES_SAMPLER_ARG for Jaeger remote sampler %s", samplerName)
	}

	options := []jaegerremote.Option{
		jaegerremote.WithSamplingServerURL(endpoint),
	}
	if pollingInterval > 0 {
		options = append(options, jaegerremote.WithSamplingRefreshInterval(pollingInterval))
	}
	if initialSamplingRateSet {
		options = append(options, jaegerremote.WithInitialSampler(tracesdk.TraceIDRatioBased(initialSamplingRate)))
	}

	sampler := jaegerremote.New(serviceName, options...)

	if parentBased {
		return closableParentBasedSampler{tracesdk.ParentBased(sampler), sampler}, true, nil
	}

	return sampler, true, nil
}

type closableParentBasedSampler struct {
	tracesdk.Sampler
	closer interface{ Close() }
}

func (c closableParentBasedSampler) Close() { c.closer.Close() }

// OTelPropagatorsFromEnv returns a slice of OpenTelemetry TextMapPropagators based on the OTEL_PROPAGATORS environment variable.
// If the environment variable is not set, it defaults to using TraceContext, Baggage, and Jaeger propagators.
// This implementation supports only `tracecontext`, `baggage`, and `jaeger` and `none` propagators.
// See docs in:
// https://opentelemetry.io/docs/languages/sdk-configuration/general/
func OTelPropagatorsFromEnv() []propagation.TextMapPropagator {
	// If OTEL_PROPAGATORS is not set, use the default propagators.
	if os.Getenv("OTEL_PROPAGATORS") == "" {
		return []propagation.TextMapPropagator{
			propagation.TraceContext{},
			propagation.Baggage{},
			jaegerpropagator.Jaeger{},
		}
	}

	// Parse the OTEL_PROPAGATORS environment variable.
	propagators := strings.Split(os.Getenv("OTEL_PROPAGATORS"), ",")
	var result []propagation.TextMapPropagator
	for _, p := range propagators {
		switch strings.TrimSpace(p) {
		case "tracecontext":
			result = append(result, propagation.TraceContext{})
		case "baggage":
			result = append(result, propagation.Baggage{})
		case "jaeger":
			result = append(result, jaegerpropagator.Jaeger{})
		case "none":
			return nil
		default:
			fmt.Printf("Unknown propagator: %s\n", p)
		}
	}
	return result
}
