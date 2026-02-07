# Logs SDK

## Abstract

`go.opentelemetry.io/otel/sdk/log` provides Logs SDK compliant with the
[specification](https://opentelemetry.io/docs/specs/otel/logs/sdk/).

The prototype was created in
[#4955](https://github.com/open-telemetry/opentelemetry-go/pull/4955).

## Background

The goal is to design the exported API of the SDK would have low performance
overhead. Most importantly, have a design that reduces the amount of heap
allocations and even make it possible to have a zero-allocation implementation.
Eliminating the amount of heap allocations reduces the GC pressure which can
produce some of the largest improvements in performance.[^1]

The main and recommended use case is to configure the SDK to use an OTLP
exporter with a batch processor.[^2] Therefore, the implementation aims to be
high-performant in this scenario. Some users that require high throughput may
also want to use e.g. an [user_events](https://docs.kernel.org/trace/user_events.html),
[LLTng](https://lttng.org/docs/v2.13/#doc-tracing-your-own-user-application)
or [ETW](https://learn.microsoft.com/en-us/windows/win32/etw/about-event-tracing)
exporter with a simple processor. Users may also want to use
[OTLP File](https://opentelemetry.io/docs/specs/otel/protocol/file-exporter/)
or [Standard Output](https://opentelemetry.io/docs/specs/otel/logs/sdk_exporters/stdout/)
exporter in order to emit logs to standard output/error or files.

## Modules structure

The SDK is published as a single `go.opentelemetry.io/otel/sdk/log` Go module.

The exporters are going to be published as following Go modules:

- `go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploggrpc`
- `go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploghttp`
- `go.opentelemetry.io/otel/exporters/stdout/stdoutlog`

## LoggerProvider

The [LoggerProvider](https://opentelemetry.io/docs/specs/otel/logs/sdk/#loggerprovider)
is implemented as `LoggerProvider` struct in [provider.go](provider.go).

## LogRecord limits

The [LogRecord limits](https://opentelemetry.io/docs/specs/otel/logs/sdk/#logrecord-limits)
can be configured using following options:

```go
func WithAttributeCountLimit(limit int) LoggerProviderOption
func WithAttributeValueLengthLimit(limit int) LoggerProviderOption
```

The limits can be also configured using the `OTEL_LOGRECORD_*` environment variables as
[defined by the specification](https://opentelemetry.io/docs/specs/otel/configuration/sdk-environment-variables/#logrecord-limits).

### Processor

The [LogRecordProcessor](https://opentelemetry.io/docs/specs/otel/logs/sdk/#logrecordprocessor)
is defined as `Processor` interface in [processor.go](processor.go).

The user set processors for the `LoggerProvider` using
`func WithProcessor(processor Processor) LoggerProviderOption`.

The user can configure custom processors and decorate built-in processors.

The specification may add new operations to the
[LogRecordProcessor](https://opentelemetry.io/docs/specs/otel/logs/sdk/#logrecordprocessor).
If it happens, [CONTRIBUTING.md](../../CONTRIBUTING.md#how-to-change-other-interfaces)
describes how the SDK can be extended in a backwards-compatible way.

### SimpleProcessor

The [Simple processor](https://opentelemetry.io/docs/specs/otel/logs/sdk/#simple-processor)
is implemented as `SimpleProcessor` struct in [simple.go](simple.go).

### BatchProcessor

The [Batching processor](https://opentelemetry.io/docs/specs/otel/logs/sdk/#batching-processor)
is implemented as `BatchProcessor` struct in [batch.go](batch.go).

The `Batcher` can be also configured using the `OTEL_BLRP_*` environment variables as
[defined by the specification](https://opentelemetry.io/docs/specs/otel/configuration/sdk-environment-variables/#batch-logrecord-processor).

### Exporter

The [LogRecordExporter](https://opentelemetry.io/docs/specs/otel/logs/sdk/#logrecordexporter)
is defined as `Exporter` interface in [exporter.go](exporter.go).

The slice passed to `Export` must not be retained by the implementation
(like e.g. [`io.Writer`](https://pkg.go.dev/io#Writer))
so that the caller can reuse the passed slice
(e.g. using [`sync.Pool`](https://pkg.go.dev/sync#Pool))
to avoid heap allocations on each call.

The specification may add new operations to the
[LogRecordExporter](https://opentelemetry.io/docs/specs/otel/logs/sdk/#logrecordexporter).
If it happens, [CONTRIBUTING.md](../../CONTRIBUTING.md#how-to-change-other-interfaces)
describes how the SDK can be extended in a backwards-compatible way.

### Record

The [ReadWriteLogRecord](https://opentelemetry.io/docs/specs/otel/logs/sdk/#readwritelogrecord)
is defined as `Record` struct in [record.go](record.go).

The `Record` is designed similarly to [`log.Record`](https://pkg.go.dev/go.opentelemetry.io/otel/log#Record)
in order to reduce the number of heap allocations when processing attributes.

The SDK does not have have an additional definition of
[ReadableLogRecord](https://opentelemetry.io/docs/specs/otel/logs/sdk/#readablelogrecord)
as the specification does not say that the exporters must not be able to modify
the log records. It simply requires them to be able to read the log records.
Having less abstractions reduces the API surface and makes the design simpler.

## Benchmarking

The benchmarks are supposed to test end-to-end scenarios
and avoid I/O that could affect the stability of the results.

The benchmark results can be found in [the prototype](https://github.com/open-telemetry/opentelemetry-go/pull/4955).

## Rejected alternatives

### Represent both LogRecordProcessor and LogRecordExporter as Exporter

Because the [LogRecordProcessor](https://opentelemetry.io/docs/specs/otel/logs/sdk/#logrecordprocessor)
and the [LogRecordProcessor](https://opentelemetry.io/docs/specs/otel/logs/sdk/#logrecordexporter)
abstractions are so similar, there was a proposal to unify them under
single `Exporter` interface.[^3]

However, introducing a `Processor` interface makes it easier
to create custom processor decorators[^4]
and makes the design more aligned with the specification.

### Embed log.Record

Because [`Record`](#record) and [`log.Record`](https://pkg.go.dev/go.opentelemetry.io/otel/log#Record)
are very similar, there was a proposal to embed `log.Record` in `Record` definition.

[`log.Record`](https://pkg.go.dev/go.opentelemetry.io/otel/log#Record)
supports only adding attributes.
In the SDK, we also need to be able to modify the attributes (e.g. removal)
provided via API.

Moreover it is safer to have these abstraction decoupled.
E.g. there can be a need for some fields that can be set via API and cannot be modified by the processors.

### Processor.OnEmit to accept Record values

There was a proposal to make the [Processor](#processor)'s `OnEmit`
to accept a [Record](#record) value instead of a pointer to reduce allocations
as well as to have design similar to [`slog.Handler`](https://pkg.go.dev/log/slog#Handler).

There have been long discussions within the OpenTelemetry Specification SIG[^5]
about whether such a design would comply with the specification. The summary
was that the current processor design flaws are present in other languages as
well. Therefore, it would be favorable to introduce new processing concepts
(e.g. chaining processors) in the specification that would coexist with the
current "mutable" processor design.

The performance disadvantages caused by using a pointer (which at the time of
writing causes an additional heap allocation) may be mitigated by future
versions of the Go compiler, thanks to improved escape analysis and
profile-guided optimization (PGO)[^6].

On the other hand, [Processor](#processor)'s `Enabled` is fine to accept
a [Record](#record) value as the processors should not mutate the passed
parameters.

[^1]: [A Guide to the Go Garbage Collector](https://tip.golang.org/doc/gc-guide)
[^2]: [OpenTelemetry Logging](https://opentelemetry.io/docs/specs/otel/logs)
[^3]: [Conversation on representing LogRecordProcessor and LogRecordExporter via a single Exporter interface](https://github.com/open-telemetry/opentelemetry-go/pull/4954#discussion_r1515050480)
[^4]: [Introduce Processor](https://github.com/pellared/opentelemetry-go/pull/9)
[^5]: [Log record mutations do not have to be visible in next registered processors](https://github.com/open-telemetry/opentelemetry-specification/pull/4067)
[^6]: [Profile-guided optimization](https://go.dev/doc/pgo)
