package tracing

import (
	"context"
	"fmt"
	"io"
	"net"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/go-kit/log"
	"github.com/go-kit/log/level"
	otelpyroscope "github.com/grafana/otel-profiling-go"
	"github.com/pkg/errors"
	"go.opentelemetry.io/contrib/samplers/jaegerremote"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	tracesdk "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/trace"

	//nolint:staticcheck
	jaegerotel "go.opentelemetry.io/otel/exporters/jaeger"
	"go.opentelemetry.io/otel/propagation"
)

const (
	envJaegerAgentHost                 = "JAEGER_AGENT_HOST"
	envJaegerTags                      = "JAEGER_TAGS"
	envJaegerSamplerManagerHostPort    = "JAEGER_SAMPLER_MANAGER_HOST_PORT"
	envJaegerSamplerParam              = "JAEGER_SAMPLER_PARAM"
	envJaegerEndpoint                  = "JAEGER_ENDPOINT"
	envJaegerAgentPort                 = "JAEGER_AGENT_PORT"
	envJaegerSamplerType               = "JAEGER_SAMPLER_TYPE"
	envJaegerSamplingEndpoint          = "JAEGER_SAMPLING_ENDPOINT"
	envJaegerReporterMaxQueueSize      = "JAEGER_REPORTER_MAX_QUEUE_SIZE"
	envJaegerDefaultSamplingServerPort = 5778
	envJaegerDefaultUDPSpanServerHost  = "localhost"
	envJaegerDefaultUDPSpanServerPort  = "6831"
)

// NewOTelOrJaegerFromEnv is a convenience function to allow OTel tracing configuration via environment variables.
// It will configure Jaeger exporter if any of the following environment variables are set:
// - JAEGER_AGENT_HOST
// - JAEGER_ENDPOINT
// - JAEGER_SAMPLER_MANAGER_HOST_PORT
//
// Otherwise, it will initialize tracing with the OTel auto exporter using the environment variables defined in the OTel docs.
// If you want to explicitly disable OTel auto exporter, you can set the environment variable `OTEL_TRACES_EXPORTER` to `none`.
func NewOTelOrJaegerFromEnv(serviceName string, logger log.Logger, opts ...OTelOption) (io.Closer, error) {
	if env, found := findNonEmptyEnv(envJaegerAgentHost, envJaegerEndpoint, envJaegerSamplerManagerHostPort); found {
		level.Info(logger).Log("msg", "Configuring tracing with Jaeger exporter", "detected_env_var", env)
		return newOTelFromJaegerEnv(serviceName, logger, opts...)
	}

	level.Info(logger).Log("msg", "Configuring tracing with OTel auto exporter")

	return NewOTelFromEnv(serviceName, logger, opts...)
}

func findNonEmptyEnv(envVars ...string) (string, bool) {
	for _, envVar := range envVars {
		if value := os.Getenv(envVar); value != "" {
			return envVar, true
		}
	}
	return "", false
}

// NewOTelFromJaegerEnv is a convenience function to allow OTel tracing configuration via Jaeger environment variables
//
// Tracing will be enabled if one (or more) of the following environment variables is used to configure trace reporting:
// - JAEGER_AGENT_HOST
// - JAEGER_SAMPLER_MANAGER_HOST_PORT
//
// Deprecated: use NewOTelOrJaegerFromEnv instead as it will automatically configure OTel auto exporter if Jaeger is not configured.
func NewOTelFromJaegerEnv(serviceName string) (io.Closer, error) {
	return newOTelFromJaegerEnv(serviceName, log.NewNopLogger())
}

func newOTelFromJaegerEnv(serviceName string, logger log.Logger, options ...OTelOption) (io.Closer, error) {
	cfg, err := parseOTelJaegerConfig()
	if err != nil {
		return nil, errors.Wrap(err, "could not load jaeger tracer configuration")
	}
	if cfg.samplingServerURL == "" && cfg.agentHostPort == "" && cfg.jaegerEndpoint == "" {
		return nil, ErrBlankJaegerTraceConfiguration
	}
	return cfg.initJaegerTracerProvider(serviceName, logger, options...)
}

// parseJaegerTags Parse Jaeger tags from env var JAEGER_TAGS, example of TAGs format: key1=value1,key2=${value2:value3} where value2 is an env var
// and value3 is the default value, which is optional.
func parseJaegerTags(sTags string) ([]attribute.KeyValue, error) {
	pairs := strings.Split(sTags, ",")
	res := make([]attribute.KeyValue, 0, len(pairs))
	for _, p := range pairs {
		k, v, found := strings.Cut(p, "=")
		if found {
			k, v := strings.TrimSpace(k), strings.TrimSpace(v)
			if strings.HasPrefix(v, "${") && strings.HasSuffix(v, "}") {
				e, d, _ := strings.Cut(v[2:len(v)-1], ":")
				v = os.Getenv(e)
				if v == "" && d != "" {
					v = d
				}
			}
			if v == "" {
				return nil, errors.Errorf("invalid tag %q, expected key=value", p)
			}
			res = append(res, attribute.String(k, v))
		} else if p != "" {
			return nil, errors.Errorf("invalid tag %q, expected key=value", p)
		}
	}
	return res, nil
}

type otelJaegerConfig struct {
	agentHost            string
	jaegerEndpoint       string
	agentPort            string
	samplerType          string
	samplingServerURL    string
	samplerParam         float64
	jaegerTags           []attribute.KeyValue
	agentHostPort        string
	reporterMaxQueueSize int
}

// parseOTelJaegerConfig facilitates initialization that is compatible with Jaeger's InitGlobalTracer method.
func parseOTelJaegerConfig() (otelJaegerConfig, error) {
	cfg := otelJaegerConfig{}
	var err error

	// Parse reporting agent configuration
	if e := os.Getenv(envJaegerEndpoint); e != "" {
		u, err := url.ParseRequestURI(e)
		if err != nil {
			return cfg, errors.Wrapf(err, "cannot parse env var %s=%s", envJaegerEndpoint, e)
		}
		cfg.jaegerEndpoint = u.String()
	} else {
		useEnv := false
		host := envJaegerDefaultUDPSpanServerHost
		if e := os.Getenv(envJaegerAgentHost); e != "" {
			host = e
			useEnv = true
		}

		port := envJaegerDefaultUDPSpanServerPort
		if e := os.Getenv(envJaegerAgentPort); e != "" {
			port = e
			useEnv = true
		}

		if useEnv || cfg.agentHostPort == "" {
			cfg.agentHost = host
			cfg.agentPort = port
			cfg.agentHostPort = net.JoinHostPort(host, port)
		}
	}

	// Then parse the sampler Configuration
	if e := os.Getenv(envJaegerSamplerType); e != "" {
		cfg.samplerType = e
	}

	if e := os.Getenv(envJaegerSamplerParam); e != "" {
		if value, err := strconv.ParseFloat(e, 64); err == nil {
			cfg.samplerParam = value
		} else {
			return cfg, errors.Wrapf(err, "cannot parse env var %s=%s", envJaegerSamplerParam, e)
		}
	}

	if e := os.Getenv(envJaegerSamplingEndpoint); e != "" {
		cfg.samplingServerURL = e
	} else if e := os.Getenv(envJaegerSamplerManagerHostPort); e != "" {
		cfg.samplingServerURL = e
	} else if e := os.Getenv(envJaegerAgentHost); e != "" {
		// Fallback if we know the agent host - try the sampling endpoint there
		cfg.samplingServerURL = fmt.Sprintf("http://%s:%d/sampling", e, envJaegerDefaultSamplingServerPort)
	}

	// When sampling server URL is set, we use the remote sampler
	if cfg.samplingServerURL != "" && cfg.samplerType == "" {
		cfg.samplerType = "remote"
	}

	// Parse tags
	cfg.jaegerTags, err = parseJaegerTags(os.Getenv(envJaegerTags))
	if err != nil {
		return cfg, errors.Wrapf(err, "could not parse %s", envJaegerTags)
	}

	// Parse reporter max queue size
	if e := os.Getenv(envJaegerReporterMaxQueueSize); e != "" {
		if value, err := strconv.Atoi(e); err == nil {
			cfg.reporterMaxQueueSize = value
		} else {
			return cfg, errors.Wrapf(err, "cannot parse env var %s=%s", envJaegerReporterMaxQueueSize, e)
		}
	}
	return cfg, nil
}

// initJaegerTracerProvider initializes a new Jaeger Tracer Provider.
func (cfg otelJaegerConfig) initJaegerTracerProvider(serviceName string, logger log.Logger, option ...OTelOption) (io.Closer, error) {
	var otelCfg config
	for _, opt := range option {
		opt.apply(&otelCfg)
	}

	// Read environment variables to configure Jaeger
	var ep jaegerotel.EndpointOption
	// Create the jaeger exporter: address can be either agent address (host:port) or collector Endpoint.
	if cfg.agentHostPort != "" {
		ep = jaegerotel.WithAgentEndpoint(
			jaegerotel.WithAgentHost(cfg.agentHost),
			jaegerotel.WithAgentPort(cfg.agentPort))
	} else {
		ep = jaegerotel.WithCollectorEndpoint(
			jaegerotel.WithEndpoint(cfg.jaegerEndpoint))
	}
	exp, err := jaegerotel.New(ep)

	if err != nil {
		return nil, err
	}

	// Configure sampling strategy
	sampler := tracesdk.AlwaysSample()
	if cfg.samplerType == "const" {
		if cfg.samplerParam == 0 {
			sampler = tracesdk.NeverSample()
		}
	} else if cfg.samplerType == "probabilistic" {
		tracesdk.TraceIDRatioBased(cfg.samplerParam)
	} else if cfg.samplerType == "remote" {
		sampler = jaegerremote.New(serviceName, jaegerremote.WithSamplingServerURL(cfg.samplingServerURL),
			jaegerremote.WithInitialSampler(tracesdk.TraceIDRatioBased(cfg.samplerParam)))
	} else if cfg.samplerType != "" {
		return nil, errors.Errorf("unknown sampler type %q", cfg.samplerType)
	}
	customAttrs := cfg.jaegerTags
	customAttrs = append(customAttrs,
		attribute.String("samplerType", cfg.samplerType),
		attribute.Float64("samplerParam", cfg.samplerParam),
		attribute.String("samplingServerURL", cfg.samplingServerURL),
	)
	customAttrs = append(customAttrs, otelCfg.resourceAttributes...)

	res, err := NewResource(serviceName, customAttrs)
	if err != nil {
		return nil, err
	}

	var batcherOptions []tracesdk.BatchSpanProcessorOption
	if cfg.reporterMaxQueueSize > 0 {
		batcherOptions = append(batcherOptions, tracesdk.WithMaxQueueSize(cfg.reporterMaxQueueSize))
	}

	tracerProviderOptions := []tracesdk.TracerProviderOption{
		tracesdk.WithBatcher(exp, batcherOptions...),
		tracesdk.WithResource(res),
		tracesdk.WithSampler(sampler),
	}
	tracerProviderOptions = append(tracerProviderOptions, otelCfg.tracerProviderOptions...)

	tpsdk := tracesdk.NewTracerProvider(tracerProviderOptions...)
	tp := trace.TracerProvider(tpsdk)
	if !otelCfg.pyroscopeDisabled {
		tp = otelpyroscope.NewTracerProvider(tp)
	}

	level.Debug(logger).Log("msg", "OpenTelemetry tracer provider initialized from Jaeger env vars")
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
