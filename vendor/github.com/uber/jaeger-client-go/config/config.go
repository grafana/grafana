// Copyright (c) 2017-2018 Uber Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package config

import (
	"errors"
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/opentracing/opentracing-go"
	"github.com/uber/jaeger-client-go/utils"

	"github.com/uber/jaeger-client-go"
	"github.com/uber/jaeger-client-go/internal/baggage/remote"
	throttler "github.com/uber/jaeger-client-go/internal/throttler/remote"
	"github.com/uber/jaeger-client-go/rpcmetrics"
	"github.com/uber/jaeger-client-go/transport"
	"github.com/uber/jaeger-lib/metrics"
)

const defaultSamplingProbability = 0.001

// Configuration configures and creates Jaeger Tracer
type Configuration struct {
	// ServiceName specifies the service name to use on the tracer.
	// Can be provided by FromEnv() via the environment variable named JAEGER_SERVICE_NAME
	ServiceName string `yaml:"serviceName"`

	// Disabled makes the config return opentracing.NoopTracer.
	// Value can be provided by FromEnv() via the environment variable named JAEGER_DISABLED.
	Disabled bool `yaml:"disabled"`

	// RPCMetrics enables generations of RPC metrics (requires metrics factory to be provided).
	// Value can be provided by FromEnv() via the environment variable named JAEGER_RPC_METRICS
	RPCMetrics bool `yaml:"rpc_metrics"`

	// Gen128Bit instructs the tracer to generate 128-bit wide trace IDs, compatible with W3C Trace Context.
	// Value can be provided by FromEnv() via the environment variable named JAEGER_TRACEID_128BIT.
	Gen128Bit bool `yaml:"traceid_128bit"`

	// Tags can be provided by FromEnv() via the environment variable named JAEGER_TAGS
	Tags []opentracing.Tag `yaml:"tags"`

	Sampler             *SamplerConfig             `yaml:"sampler"`
	Reporter            *ReporterConfig            `yaml:"reporter"`
	Headers             *jaeger.HeadersConfig      `yaml:"headers"`
	BaggageRestrictions *BaggageRestrictionsConfig `yaml:"baggage_restrictions"`
	Throttler           *ThrottlerConfig           `yaml:"throttler"`
}

// SamplerConfig allows initializing a non-default sampler.  All fields are optional.
type SamplerConfig struct {
	// Type specifies the type of the sampler: const, probabilistic, rateLimiting, or remote.
	// Can be provided by FromEnv() via the environment variable named JAEGER_SAMPLER_TYPE
	Type string `yaml:"type"`

	// Param is a value passed to the sampler.
	// Valid values for Param field are:
	// - for "const" sampler, 0 or 1 for always false/true respectively
	// - for "probabilistic" sampler, a probability between 0 and 1
	// - for "rateLimiting" sampler, the number of spans per second
	// - for "remote" sampler, param is the same as for "probabilistic"
	//   and indicates the initial sampling rate before the actual one
	//   is received from the mothership.
	// Can be provided by FromEnv() via the environment variable named JAEGER_SAMPLER_PARAM
	Param float64 `yaml:"param"`

	// SamplingServerURL is the URL of sampling manager that can provide
	// sampling strategy to this service.
	// Can be provided by FromEnv() via the environment variable named JAEGER_SAMPLING_ENDPOINT
	SamplingServerURL string `yaml:"samplingServerURL"`

	// SamplingRefreshInterval controls how often the remotely controlled sampler will poll
	// sampling manager for the appropriate sampling strategy.
	// Can be provided by FromEnv() via the environment variable named JAEGER_SAMPLER_REFRESH_INTERVAL
	SamplingRefreshInterval time.Duration `yaml:"samplingRefreshInterval"`

	// MaxOperations is the maximum number of operations that the PerOperationSampler
	// will keep track of. If an operation is not tracked, a default probabilistic
	// sampler will be used rather than the per operation specific sampler.
	// Can be provided by FromEnv() via the environment variable named JAEGER_SAMPLER_MAX_OPERATIONS.
	MaxOperations int `yaml:"maxOperations"`

	// Opt-in feature for applications that require late binding of span name via explicit
	// call to SetOperationName when using PerOperationSampler. When this feature is enabled,
	// the sampler will return retryable=true from OnCreateSpan(), thus leaving the sampling
	// decision as non-final (and the span as writeable). This may lead to degraded performance
	// in applications that always provide the correct span name on trace creation.
	//
	// For backwards compatibility this option is off by default.
	OperationNameLateBinding bool `yaml:"operationNameLateBinding"`

	// Options can be used to programmatically pass additional options to the Remote sampler.
	Options []jaeger.SamplerOption
}

// ReporterConfig configures the reporter. All fields are optional.
type ReporterConfig struct {
	// QueueSize controls how many spans the reporter can keep in memory before it starts dropping
	// new spans. The queue is continuously drained by a background go-routine, as fast as spans
	// can be sent out of process.
	// Can be provided by FromEnv() via the environment variable named JAEGER_REPORTER_MAX_QUEUE_SIZE
	QueueSize int `yaml:"queueSize"`

	// BufferFlushInterval controls how often the buffer is force-flushed, even if it's not full.
	// It is generally not useful, as it only matters for very low traffic services.
	// Can be provided by FromEnv() via the environment variable named JAEGER_REPORTER_FLUSH_INTERVAL
	BufferFlushInterval time.Duration

	// LogSpans, when true, enables LoggingReporter that runs in parallel with the main reporter
	// and logs all submitted spans. Main Configuration.Logger must be initialized in the code
	// for this option to have any effect.
	// Can be provided by FromEnv() via the environment variable named JAEGER_REPORTER_LOG_SPANS
	LogSpans bool `yaml:"logSpans"`

	// LocalAgentHostPort instructs reporter to send spans to jaeger-agent at this address.
	// Can be provided by FromEnv() via the environment variable named JAEGER_AGENT_HOST / JAEGER_AGENT_PORT
	LocalAgentHostPort string `yaml:"localAgentHostPort"`

	// DisableAttemptReconnecting when true, disables udp connection helper that periodically re-resolves
	// the agent's hostname and reconnects if there was a change. This option only
	// applies if LocalAgentHostPort is specified.
	// Can be provided by FromEnv() via the environment variable named JAEGER_REPORTER_ATTEMPT_RECONNECTING_DISABLED
	DisableAttemptReconnecting bool `yaml:"disableAttemptReconnecting"`

	// AttemptReconnectInterval controls how often the agent client re-resolves the provided hostname
	// in order to detect address changes. This option only applies if DisableAttemptReconnecting is false.
	// Can be provided by FromEnv() via the environment variable named JAEGER_REPORTER_ATTEMPT_RECONNECT_INTERVAL
	AttemptReconnectInterval time.Duration

	// CollectorEndpoint instructs reporter to send spans to jaeger-collector at this URL.
	// Can be provided by FromEnv() via the environment variable named JAEGER_ENDPOINT
	CollectorEndpoint string `yaml:"collectorEndpoint"`

	// User instructs reporter to include a user for basic http authentication when sending spans to jaeger-collector.
	// Can be provided by FromEnv() via the environment variable named JAEGER_USER
	User string `yaml:"user"`

	// Password instructs reporter to include a password for basic http authentication when sending spans to
	// jaeger-collector.
	// Can be provided by FromEnv() via the environment variable named JAEGER_PASSWORD
	Password string `yaml:"password"`

	// HTTPHeaders instructs the reporter to add these headers to the http request when reporting spans.
	// This field takes effect only when using HTTPTransport by setting the CollectorEndpoint.
	HTTPHeaders map[string]string `yaml:"http_headers"`
}

// BaggageRestrictionsConfig configures the baggage restrictions manager which can be used to whitelist
// certain baggage keys. All fields are optional.
type BaggageRestrictionsConfig struct {
	// DenyBaggageOnInitializationFailure controls the startup failure mode of the baggage restriction
	// manager. If true, the manager will not allow any baggage to be written until baggage restrictions have
	// been retrieved from jaeger-agent. If false, the manager wil allow any baggage to be written until baggage
	// restrictions have been retrieved from jaeger-agent.
	DenyBaggageOnInitializationFailure bool `yaml:"denyBaggageOnInitializationFailure"`

	// HostPort is the hostPort of jaeger-agent's baggage restrictions server
	HostPort string `yaml:"hostPort"`

	// RefreshInterval controls how often the baggage restriction manager will poll
	// jaeger-agent for the most recent baggage restrictions.
	RefreshInterval time.Duration `yaml:"refreshInterval"`
}

// ThrottlerConfig configures the throttler which can be used to throttle the
// rate at which the client may send debug requests.
type ThrottlerConfig struct {
	// HostPort of jaeger-agent's credit server.
	HostPort string `yaml:"hostPort"`

	// RefreshInterval controls how often the throttler will poll jaeger-agent
	// for more throttling credits.
	RefreshInterval time.Duration `yaml:"refreshInterval"`

	// SynchronousInitialization determines whether or not the throttler should
	// synchronously fetch credits from the agent when an operation is seen for
	// the first time. This should be set to true if the client will be used by
	// a short lived service that needs to ensure that credits are fetched
	// upfront such that sampling or throttling occurs.
	SynchronousInitialization bool `yaml:"synchronousInitialization"`
}

type nullCloser struct{}

func (*nullCloser) Close() error { return nil }

// New creates a new Jaeger Tracer, and a closer func that can be used to flush buffers
// before shutdown.
//
// Deprecated: use NewTracer() function
func (c Configuration) New(
	serviceName string,
	options ...Option,
) (opentracing.Tracer, io.Closer, error) {
	if serviceName != "" {
		c.ServiceName = serviceName
	}

	return c.NewTracer(options...)
}

// NewTracer returns a new tracer based on the current configuration, using the given options,
// and a closer func that can be used to flush buffers before shutdown.
func (c Configuration) NewTracer(options ...Option) (opentracing.Tracer, io.Closer, error) {
	if c.Disabled {
		return &opentracing.NoopTracer{}, &nullCloser{}, nil
	}

	if c.ServiceName == "" {
		return nil, nil, errors.New("no service name provided")
	}

	opts := applyOptions(options...)
	tracerMetrics := jaeger.NewMetrics(opts.metrics, nil)
	if c.RPCMetrics {
		Observer(
			rpcmetrics.NewObserver(
				opts.metrics.Namespace(metrics.NSOptions{Name: "jaeger-rpc", Tags: map[string]string{"component": "jaeger"}}),
				rpcmetrics.DefaultNameNormalizer,
			),
		)(&opts) // adds to c.observers
	}
	if c.Sampler == nil {
		c.Sampler = &SamplerConfig{
			Type:  jaeger.SamplerTypeRemote,
			Param: defaultSamplingProbability,
		}
	}
	if c.Reporter == nil {
		c.Reporter = &ReporterConfig{}
	}

	sampler := opts.sampler
	if sampler == nil {
		s, err := c.Sampler.NewSampler(c.ServiceName, tracerMetrics)
		if err != nil {
			return nil, nil, err
		}
		sampler = s
	}

	reporter := opts.reporter
	if reporter == nil {
		r, err := c.Reporter.NewReporter(c.ServiceName, tracerMetrics, opts.logger)
		if err != nil {
			return nil, nil, err
		}
		reporter = r
	}

	tracerOptions := []jaeger.TracerOption{
		jaeger.TracerOptions.Metrics(tracerMetrics),
		jaeger.TracerOptions.Logger(opts.logger),
		jaeger.TracerOptions.CustomHeaderKeys(c.Headers),
		jaeger.TracerOptions.PoolSpans(opts.poolSpans),
		jaeger.TracerOptions.ZipkinSharedRPCSpan(opts.zipkinSharedRPCSpan),
		jaeger.TracerOptions.MaxTagValueLength(opts.maxTagValueLength),
		jaeger.TracerOptions.NoDebugFlagOnForcedSampling(opts.noDebugFlagOnForcedSampling),
	}

	if c.Gen128Bit || opts.gen128Bit {
		tracerOptions = append(tracerOptions, jaeger.TracerOptions.Gen128Bit(true))
	}

	if opts.randomNumber != nil {
		tracerOptions = append(tracerOptions, jaeger.TracerOptions.RandomNumber(opts.randomNumber))
	}

	for _, tag := range opts.tags {
		tracerOptions = append(tracerOptions, jaeger.TracerOptions.Tag(tag.Key, tag.Value))
	}

	for _, tag := range c.Tags {
		tracerOptions = append(tracerOptions, jaeger.TracerOptions.Tag(tag.Key, tag.Value))
	}

	for _, obs := range opts.observers {
		tracerOptions = append(tracerOptions, jaeger.TracerOptions.Observer(obs))
	}

	for _, cobs := range opts.contribObservers {
		tracerOptions = append(tracerOptions, jaeger.TracerOptions.ContribObserver(cobs))
	}

	for format, injector := range opts.injectors {
		tracerOptions = append(tracerOptions, jaeger.TracerOptions.Injector(format, injector))
	}

	for format, extractor := range opts.extractors {
		tracerOptions = append(tracerOptions, jaeger.TracerOptions.Extractor(format, extractor))
	}

	if c.BaggageRestrictions != nil {
		mgr := remote.NewRestrictionManager(
			c.ServiceName,
			remote.Options.Metrics(tracerMetrics),
			remote.Options.Logger(opts.logger),
			remote.Options.HostPort(c.BaggageRestrictions.HostPort),
			remote.Options.RefreshInterval(c.BaggageRestrictions.RefreshInterval),
			remote.Options.DenyBaggageOnInitializationFailure(
				c.BaggageRestrictions.DenyBaggageOnInitializationFailure,
			),
		)
		tracerOptions = append(tracerOptions, jaeger.TracerOptions.BaggageRestrictionManager(mgr))
	}

	if c.Throttler != nil {
		debugThrottler := throttler.NewThrottler(
			c.ServiceName,
			throttler.Options.Metrics(tracerMetrics),
			throttler.Options.Logger(opts.logger),
			throttler.Options.HostPort(c.Throttler.HostPort),
			throttler.Options.RefreshInterval(c.Throttler.RefreshInterval),
			throttler.Options.SynchronousInitialization(
				c.Throttler.SynchronousInitialization,
			),
		)

		tracerOptions = append(tracerOptions, jaeger.TracerOptions.DebugThrottler(debugThrottler))
	}

	tracer, closer := jaeger.NewTracer(
		c.ServiceName,
		sampler,
		reporter,
		tracerOptions...,
	)

	return tracer, closer, nil
}

// InitGlobalTracer creates a new Jaeger Tracer, and sets it as global OpenTracing Tracer.
// It returns a closer func that can be used to flush buffers before shutdown.
func (c Configuration) InitGlobalTracer(
	serviceName string,
	options ...Option,
) (io.Closer, error) {
	if c.Disabled {
		return &nullCloser{}, nil
	}
	tracer, closer, err := c.New(serviceName, options...)
	if err != nil {
		return nil, err
	}
	opentracing.SetGlobalTracer(tracer)
	return closer, nil
}

// NewSampler creates a new sampler based on the configuration
func (sc *SamplerConfig) NewSampler(
	serviceName string,
	metrics *jaeger.Metrics,
) (jaeger.Sampler, error) {
	samplerType := strings.ToLower(sc.Type)
	if samplerType == jaeger.SamplerTypeConst {
		return jaeger.NewConstSampler(sc.Param != 0), nil
	}
	if samplerType == jaeger.SamplerTypeProbabilistic {
		if sc.Param >= 0 && sc.Param <= 1.0 {
			return jaeger.NewProbabilisticSampler(sc.Param)
		}
		return nil, fmt.Errorf(
			"invalid Param for probabilistic sampler; expecting value between 0 and 1, received %v",
			sc.Param,
		)
	}
	if samplerType == jaeger.SamplerTypeRateLimiting {
		return jaeger.NewRateLimitingSampler(sc.Param), nil
	}
	if samplerType == jaeger.SamplerTypeRemote || sc.Type == "" {
		sc2 := *sc
		sc2.Type = jaeger.SamplerTypeProbabilistic
		initSampler, err := sc2.NewSampler(serviceName, nil)
		if err != nil {
			return nil, err
		}
		options := []jaeger.SamplerOption{
			jaeger.SamplerOptions.Metrics(metrics),
			jaeger.SamplerOptions.InitialSampler(initSampler),
			jaeger.SamplerOptions.SamplingServerURL(sc.SamplingServerURL),
			jaeger.SamplerOptions.MaxOperations(sc.MaxOperations),
			jaeger.SamplerOptions.OperationNameLateBinding(sc.OperationNameLateBinding),
			jaeger.SamplerOptions.SamplingRefreshInterval(sc.SamplingRefreshInterval),
		}
		options = append(options, sc.Options...)
		return jaeger.NewRemotelyControlledSampler(serviceName, options...), nil
	}
	return nil, fmt.Errorf("unknown sampler type (%s)", sc.Type)
}

// NewReporter instantiates a new reporter that submits spans to the collector
func (rc *ReporterConfig) NewReporter(
	serviceName string,
	metrics *jaeger.Metrics,
	logger jaeger.Logger,
) (jaeger.Reporter, error) {
	sender, err := rc.newTransport(logger)
	if err != nil {
		return nil, err
	}
	reporter := jaeger.NewRemoteReporter(
		sender,
		jaeger.ReporterOptions.QueueSize(rc.QueueSize),
		jaeger.ReporterOptions.BufferFlushInterval(rc.BufferFlushInterval),
		jaeger.ReporterOptions.Logger(logger),
		jaeger.ReporterOptions.Metrics(metrics))
	if rc.LogSpans && logger != nil {
		logger.Infof("Initializing logging reporter")
		reporter = jaeger.NewCompositeReporter(jaeger.NewLoggingReporter(logger), reporter)
	}
	return reporter, err
}

func (rc *ReporterConfig) newTransport(logger jaeger.Logger) (jaeger.Transport, error) {
	switch {
	case rc.CollectorEndpoint != "":
		httpOptions := []transport.HTTPOption{transport.HTTPHeaders(rc.HTTPHeaders)}
		if rc.User != "" && rc.Password != "" {
			httpOptions = append(httpOptions, transport.HTTPBasicAuth(rc.User, rc.Password))
		}
		return transport.NewHTTPTransport(rc.CollectorEndpoint, httpOptions...), nil
	default:
		return jaeger.NewUDPTransportWithParams(jaeger.UDPTransportParams{
			AgentClientUDPParams: utils.AgentClientUDPParams{
				HostPort:                   rc.LocalAgentHostPort,
				Logger:                     logger,
				DisableAttemptReconnecting: rc.DisableAttemptReconnecting,
				AttemptReconnectInterval:   rc.AttemptReconnectInterval,
			},
		})
	}
}
