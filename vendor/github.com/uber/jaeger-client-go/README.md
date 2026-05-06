[![GoDoc][doc-img]][doc] [![Build Status][ci-img]][ci] [![Coverage Status][cov-img]][cov] [![OpenTracing 1.0 Enabled][ot-img]][ot-url]

# 🛑 This library is being deprecated!

We urge all users to migrate to [OpenTelemetry](https://opentelemetry.io/). Please refer to the [notice in the documentation](https://www.jaegertracing.io/docs/latest/client-libraries/#deprecating-jaeger-clients) for details.

# Jaeger Bindings for Go OpenTracing API

Instrumentation library that implements an
[OpenTracing Go](https://github.com/opentracing/opentracing-go) Tracer for Jaeger (https://jaegertracing.io).

**IMPORTANT**: The library's import path is based on its original location under `github.com/uber`. Do not try to import it as `github.com/jaegertracing`, it will not compile. We might revisit this in the next major release.
  * :white_check_mark: `import "github.com/uber/jaeger-client-go"`
  * :x: `import "github.com/jaegertracing/jaeger-client-go"`

## How to Contribute

Please see [CONTRIBUTING.md](CONTRIBUTING.md).

## Installation

### Preferred

Add `github.com/uber/jaeger-client-go` to `go.mod`.

### Old way

We recommended using a dependency manager like [dep](https://golang.github.io/dep/)
and [semantic versioning](http://semver.org/) when including this library into an application.
For example, Jaeger backend imports this library like this:

```toml
[[constraint]]
  name = "github.com/uber/jaeger-client-go"
  version = "2.17"
```

If you instead want to use the latest version in `master`, you can pull it via `go get`.
Note that during `go get` you may see build errors due to incompatible dependencies, which is why
we recommend using semantic versions for dependencies.  The error  may be fixed by running
`make install` (it will install `dep` if you don't have it):

```shell
go get -u github.com/uber/jaeger-client-go/
cd $GOPATH/src/github.com/uber/jaeger-client-go/
git submodule update --init --recursive
make install
```

## Initialization

See tracer initialization examples in [godoc](https://pkg.go.dev/github.com/uber/jaeger-client-go/config#pkg-examples)
and [config/example_test.go](./config/example_test.go).

There are two ways to create a tracer:
  * Using [Configuration](https://pkg.go.dev/github.com/uber/jaeger-client-go/config#Configuration) struct that allows declarative configuration. For example, you can populate that struct from a YAML/JSON config, or ask it to initialize itself using environment variables (see next section).
  * Using [NewTracer()](https://pkg.go.dev/github.com/uber/jaeger-client-go#NewTracer) function that allows for full programmatic control of configuring the tracer using TracerOptions.

### Environment variables

The tracer can be initialized with values coming from environment variables, if it is
[built from a config](https://pkg.go.dev/github.com/uber/jaeger-client-go/config?tab=doc#Configuration.NewTracer)
that was created via [FromEnv()](https://pkg.go.dev/github.com/uber/jaeger-client-go/config?tab=doc#FromEnv).
None of the env vars are required and all of them can be overridden via direct setting
of the property on the configuration object.

Property| Description
--- | ---
JAEGER_SERVICE_NAME | The service name.
JAEGER_AGENT_HOST | The hostname for communicating with agent via UDP (default `localhost`).
JAEGER_AGENT_PORT | The port for communicating with agent via UDP (default `6831`).
JAEGER_ENDPOINT | The HTTP endpoint for sending spans directly to a collector, i.e. http://jaeger-collector:14268/api/traces. If specified, the agent host/port are ignored.
JAEGER_USER | Username to send as part of "Basic" authentication to the collector endpoint.
JAEGER_PASSWORD | Password to send as part of "Basic" authentication to the collector endpoint.
JAEGER_REPORTER_LOG_SPANS | Whether the reporter should also log the spans" `true` or `false` (default `false`).
JAEGER_REPORTER_MAX_QUEUE_SIZE | The reporter's maximum queue size (default `100`).
JAEGER_REPORTER_FLUSH_INTERVAL | The reporter's flush interval, with units, e.g. `500ms` or `2s` ([valid units][timeunits]; default `1s`).
JAEGER_REPORTER_ATTEMPT_RECONNECTING_DISABLED | When true, disables udp connection helper that periodically re-resolves the agent's hostname and reconnects if there was a change (default `false`).
JAEGER_REPORTER_ATTEMPT_RECONNECT_INTERVAL | Controls how often the agent client re-resolves the provided hostname in order to detect address changes ([valid units][timeunits]; default `30s`).
JAEGER_SAMPLER_TYPE | The sampler type: `remote`, `const`, `probabilistic`, `ratelimiting` (default `remote`). See also https://www.jaegertracing.io/docs/latest/sampling/.
JAEGER_SAMPLER_PARAM | The sampler parameter (number).
JAEGER_SAMPLER_MANAGER_HOST_PORT | (deprecated) The HTTP endpoint when using the `remote` sampler.
JAEGER_SAMPLING_ENDPOINT | The URL for the sampling configuration server when using sampler type `remote` (default `http://127.0.0.1:5778/sampling`).
JAEGER_SAMPLER_MAX_OPERATIONS | The maximum number of operations that the sampler will keep track of (default `2000`).
JAEGER_SAMPLER_REFRESH_INTERVAL | How often the `remote` sampler should poll the configuration server for the appropriate sampling strategy, e.g. "1m" or "30s" ([valid units][timeunits]; default `1m`).
JAEGER_TAGS | A comma separated list of `name=value` tracer-level tags, which get added to all reported spans. The value can also refer to an environment variable using the format `${envVarName:defaultValue}`.
JAEGER_TRACEID_128BIT | Whether to enable 128bit trace-id generation, `true` or `false`. If not enabled, the SDK defaults to 64bit trace-ids.
JAEGER_DISABLED | Whether the tracer is disabled or not. If `true`, the `opentracing.NoopTracer` is used (default `false`).
JAEGER_RPC_METRICS | Whether to store RPC metrics, `true` or `false` (default `false`).

By default, the client sends traces via UDP to the agent at `localhost:6831`. Use `JAEGER_AGENT_HOST` and
`JAEGER_AGENT_PORT` to send UDP traces to a different `host:port`. If `JAEGER_ENDPOINT` is set, the client sends traces
to the endpoint via `HTTP`, making the `JAEGER_AGENT_HOST` and `JAEGER_AGENT_PORT` unused. If `JAEGER_ENDPOINT` is
secured, HTTP basic authentication can be performed by setting the `JAEGER_USER` and `JAEGER_PASSWORD` environment
variables.

### Closing the tracer via `io.Closer`

The constructor function for Jaeger Tracer returns the tracer itself and an `io.Closer` instance.
It is recommended to structure your `main()` so that it calls the `Close()` function on the closer
before exiting, e.g.

```go
tracer, closer, err := cfg.NewTracer(...)
defer closer.Close()
```

This is especially useful for command-line tools that enable tracing, as well as
for the long-running apps that support graceful shutdown. For example, if your deployment
system sends SIGTERM instead of killing the process and you trap that signal to do a graceful
exit, then having `defer closer.Close()` ensures that all buffered spans are flushed.

### Metrics & Monitoring

The tracer emits a number of different metrics, defined in
[metrics.go](metrics.go). The monitoring backend is expected to support
tag-based metric names, e.g. instead of `statsd`-style string names
like `counters.my-service.jaeger.spans.started.sampled`, the metrics
are defined by a short name and a collection of key/value tags, for
example: `name:jaeger.traces, state:started, sampled:y`. See [metrics.go](./metrics.go)
file for the full list and descriptions of emitted metrics.

The monitoring backend is represented by the `metrics.Factory` interface from package
[`"github.com/uber/jaeger-lib/metrics"`](https://github.com/jaegertracing/jaeger-lib/tree/master/metrics).  An implementation
of that interface can be passed as an option to either the Configuration object or the Tracer
constructor, for example:

```go
import (
    "github.com/uber/jaeger-client-go/config"
    "github.com/uber/jaeger-lib/metrics/prometheus"
)

    metricsFactory := prometheus.New()
    tracer, closer, err := config.Configuration{
        ServiceName: "your-service-name",
    }.NewTracer(
        config.Metrics(metricsFactory),
    )
```

By default, a no-op `metrics.NullFactory` is used.

### Logging

The tracer can be configured with an optional logger, which will be
used to log communication errors, or log spans if a logging reporter
option is specified in the configuration. The logging API is abstracted
by the [Logger](logger.go) interface. A logger instance implementing
this interface can be set on the `Config` object before calling the
`New` method.

Besides the [zap](https://github.com/uber-go/zap) implementation
bundled with this package there is also a [go-kit](https://github.com/go-kit/kit)
one in the [jaeger-lib](https://github.com/jaegertracing/jaeger-lib) repository.

## Instrumentation for Tracing

Since this tracer is fully compliant with OpenTracing API 1.0,
all code instrumentation should only use the API itself, as described
in the [opentracing-go](https://github.com/opentracing/opentracing-go) documentation.

## Features

### Reporters

A "reporter" is a component that receives the finished spans and reports
them to somewhere. Under normal circumstances, the Tracer
should use the default `RemoteReporter`, which sends the spans out of
process via configurable "transport". For testing purposes, one can
use an `InMemoryReporter` that accumulates spans in a buffer and
allows to retrieve them for later verification. Also available are
`NullReporter`, a no-op reporter that does nothing, a `LoggingReporter`
which logs all finished spans using their `String()` method, and a
`CompositeReporter` that can be used to combine more than one reporter
into one, e.g. to attach a logging reporter to the main remote reporter.

### Span Reporting Transports

The remote reporter uses "transports" to actually send the spans out
of process. Currently the supported transports include:
  * [Jaeger Thrift](https://github.com/jaegertracing/jaeger-idl/blob/master/thrift/agent.thrift) over UDP or HTTP,
  * [Zipkin Thrift](https://github.com/jaegertracing/jaeger-idl/blob/master/thrift/zipkincore.thrift) over HTTP.

### Sampling

The tracer does not record all spans, but only those that have the
sampling bit set in the `flags`. When a new trace is started and a new
unique ID is generated, a sampling decision is made whether this trace
should be sampled. The sampling decision is propagated to all downstream
calls via the `flags` field of the trace context. The following samplers
are available:
  1. `RemotelyControlledSampler` uses one of the other simpler samplers
     and periodically updates it by polling an external server. This
     allows dynamic control of the sampling strategies.
  1. `ConstSampler` always makes the same sampling decision for all
     trace IDs. it can be configured to either sample all traces, or
     to sample none.
  1. `ProbabilisticSampler` uses a fixed sampling rate as a probability
     for a given trace to be sampled. The actual decision is made by
     comparing the trace ID with a random number multiplied by the
     sampling rate.
  1. `RateLimitingSampler` can be used to allow only a certain fixed
     number of traces to be sampled per second.

#### Delayed sampling

Version 2.20 introduced the ability to delay sampling decisions in the life cycle
of the root span. It involves several features and architectural changes:
  * **Shared sampling state**: the sampling state is shared across all local
    (i.e. in-process) spans for a given trace.
  * **New `SamplerV2` API** allows the sampler to be called at multiple points
    in the life cycle of a span:
    * on span creation
    * on overwriting span operation name
    * on setting span tags
    * on finishing the span
  * **Final/non-final sampling state**: the new `SamplerV2` API allows the sampler
    to indicate if the negative sampling decision is final or not (positive sampling
    decisions are always final). If the decision is not final, the sampler will be
    called again on further span life cycle events, like setting tags.

These new features are used in the experimental `x.TagMatchingSampler`, which
can sample a trace based on a certain tag added to the root
span or one of its local (in-process) children. The sampler can be used with
another experimental `x.PrioritySampler` that allows multiple samplers to try
to make a sampling decision, in a certain priority order.

### Baggage Injection

The OpenTracing spec allows for [baggage][baggage], which are key value pairs that are added
to the span context and propagated throughout the trace. An external process can inject baggage
by setting the special HTTP Header `jaeger-baggage` on a request:

```sh
curl -H "jaeger-baggage: key1=value1, key2=value2" http://myhost.com
```

Baggage can also be programatically set inside your service:

```go
if span := opentracing.SpanFromContext(ctx); span != nil {
    span.SetBaggageItem("key", "value")
}
```

Another service downstream of that can retrieve the baggage in a similar way:

```go
if span := opentracing.SpanFromContext(ctx); span != nil {
    val := span.BaggageItem("key")
    println(val)
}
```

### Debug Traces (Forced Sampling)

#### Programmatically

The OpenTracing API defines a `sampling.priority` standard tag that
can be used to affect the sampling of a span and its children:

```go
import (
    "github.com/opentracing/opentracing-go"
    "github.com/opentracing/opentracing-go/ext"
)

span := opentracing.SpanFromContext(ctx)
ext.SamplingPriority.Set(span, 1)
```

#### Via HTTP Headers

Jaeger Tracer also understands a special HTTP Header `jaeger-debug-id`,
which can be set in the incoming request, e.g.

```sh
curl -H "jaeger-debug-id: some-correlation-id" http://myhost.com
```

When Jaeger sees this header in the request that otherwise has no
tracing context, it ensures that the new trace started for this
request will be sampled in the "debug" mode (meaning it should survive
all downsampling that might happen in the collection pipeline), and the
root span will have a tag as if this statement was executed:

```go
span.SetTag("jaeger-debug-id", "some-correlation-id")
```

This allows using Jaeger UI to find the trace by this tag.

### Zipkin HTTP B3 compatible header propagation

Jaeger Tracer supports Zipkin B3 Propagation HTTP headers, which are used
by a lot of Zipkin tracers. This means that you can use Jaeger in conjunction with e.g. [these OpenZipkin tracers](https://github.com/openzipkin).

However it is not the default propagation format, see [here](zipkin/README.md#NewZipkinB3HTTPHeaderPropagator) how to set it up.

## SelfRef

Jaeger Tracer supports an additional [span reference][] type call `Self`, which was proposed
to the OpenTracing Specification (https://github.com/opentracing/specification/issues/81)
but not yet accepted. This allows the caller to provide an already created `SpanContext`
when starting a new span. The `Self` reference bypasses trace and span id generation,
as well as sampling decisions (i.e. the sampling bit in the `SpanContext.flags` must be
set appropriately by the caller).

The `Self` reference supports the following use cases:
  * the ability to provide externally generated trace and span IDs
  * appending data to the same span from different processes, such as loading and continuing spans/traces from offline (ie log-based) storage

Usage requires passing in a `SpanContext` and the `jaeger.Self` reference type:
```
span := tracer.StartSpan(
    "continued_span",
    jaeger.SelfRef(yourSpanContext),
)
...
defer span.Finish()
```

## License

[Apache 2.0 License](LICENSE).


[doc-img]: https://pkg.go.dev/badge/github.com/uber/jaeger-client-go.svg
[doc]: https://pkg.go.dev/github.com/uber/jaeger-client-go
[ci-img]: https://travis-ci.org/jaegertracing/jaeger-client-go.svg?branch=master
[ci]: https://travis-ci.org/jaegertracing/jaeger-client-go
[cov-img]: https://codecov.io/gh/jaegertracing/jaeger-client-go/branch/master/graph/badge.svg
[cov]: https://codecov.io/gh/jaegertracing/jaeger-client-go
[ot-img]: https://img.shields.io/badge/OpenTracing--1.0-enabled-blue.svg
[ot-url]: http://opentracing.io
[baggage]: https://github.com/opentracing/specification/blob/master/specification.md#set-a-baggage-item
[timeunits]: https://golang.org/pkg/time/#ParseDuration
[span reference]: https://github.com/opentracing/specification/blob/1.1/specification.md#references-between-spans
