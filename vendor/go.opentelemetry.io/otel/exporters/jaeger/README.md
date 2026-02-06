# OpenTelemetry-Go Jaeger Exporter

[![Go Reference](https://pkg.go.dev/badge/go.opentelemetry.io/otel/exporters/jaeger.svg)](https://pkg.go.dev/go.opentelemetry.io/otel/exporters/jaeger)

> **Deprecated:** This module is no longer supported.
> OpenTelemetry dropped support for Jaeger exporter in July 2023.
> Jaeger officially accepts and recommends using OTLP.
> Use [go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp](https://pkg.go.dev/go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp)
> or [go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc](https://pkg.go.dev/go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc) instead.

[OpenTelemetry span exporter for Jaeger](https://github.com/open-telemetry/opentelemetry-specification/blob/v1.20.0/specification/trace/sdk_exporters/jaeger.md) implementation.

## Installation

```
go get -u go.opentelemetry.io/otel/exporters/jaeger
```

## Example

See [../../example/jaeger](../../example/jaeger).

## Configuration

The exporter can be used to send spans to:

- Jaeger agent using `jaeger.thrift` over compact thrift protocol via
  [`WithAgentEndpoint`](https://pkg.go.dev/go.opentelemetry.io/otel/exporters/jaeger#WithAgentEndpoint) option.
- Jaeger collector using `jaeger.thrift` over HTTP via
  [`WithCollectorEndpoint`](https://pkg.go.dev/go.opentelemetry.io/otel/exporters/jaeger#WithCollectorEndpoint) option.

### Environment Variables

The following environment variables can be used
(instead of options objects) to override the default configuration.

| Environment variable              | Option                                                                                        | Default value                       |
| --------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------- |
| `OTEL_EXPORTER_JAEGER_AGENT_HOST` | [`WithAgentHost`](https://pkg.go.dev/go.opentelemetry.io/otel/exporters/jaeger#WithAgentHost) | `localhost`                         |
| `OTEL_EXPORTER_JAEGER_AGENT_PORT` | [`WithAgentPort`](https://pkg.go.dev/go.opentelemetry.io/otel/exporters/jaeger#WithAgentPort) | `6831`                              |
| `OTEL_EXPORTER_JAEGER_ENDPOINT`   | [`WithEndpoint`](https://pkg.go.dev/go.opentelemetry.io/otel/exporters/jaeger#WithEndpoint)   | `http://localhost:14268/api/traces` |
| `OTEL_EXPORTER_JAEGER_USER`       | [`WithUsername`](https://pkg.go.dev/go.opentelemetry.io/otel/exporters/jaeger#WithUsername)   |                                     |
| `OTEL_EXPORTER_JAEGER_PASSWORD`   | [`WithPassword`](https://pkg.go.dev/go.opentelemetry.io/otel/exporters/jaeger#WithPassword)   |                                     |

Configuration using options have precedence over the environment variables.

## Contributing

This exporter uses a vendored copy of the Apache Thrift library (v0.14.1) at a custom import path.
When re-generating Thrift code in the future, please adapt import paths as necessary.

## References

- [Jaeger](https://www.jaegertracing.io/)
- [OpenTelemetry to Jaeger Transformation](https://github.com/open-telemetry/opentelemetry-specification/blob/v1.20.0/specification/trace/sdk_exporters/jaeger.md)
- [OpenTelemetry Environment Variable Specification](https://github.com/open-telemetry/opentelemetry-specification/blob/v1.20.0/specification/sdk-environment-variables.md#jaeger-exporter)
