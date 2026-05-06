// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

/*
Package otlpmetricgrpc provides an OTLP metrics exporter using gRPC.
By default the telemetry is sent to https://localhost:4317.

Exporter should be created using [New] and used with a [metric.PeriodicReader].

The environment variables described below can be used for configuration.

OTEL_EXPORTER_OTLP_ENDPOINT, OTEL_EXPORTER_OTLP_METRICS_ENDPOINT (default: "https://localhost:4317") -
target to which the exporter sends telemetry.
The target syntax is defined in https://github.com/grpc/grpc/blob/master/doc/naming.md.
The value must contain a scheme ("http" or "https") and host.
The value may additionally contain a port, and a path.
The value should not contain a query string or fragment.
OTEL_EXPORTER_OTLP_METRICS_ENDPOINT takes precedence over OTEL_EXPORTER_OTLP_ENDPOINT.
The configuration can be overridden by [WithEndpoint], [WithEndpointURL], [WithInsecure], and [WithGRPCConn] options.

OTEL_EXPORTER_OTLP_INSECURE, OTEL_EXPORTER_OTLP_METRICS_INSECURE (default: "false") -
setting "true" disables client transport security for the exporter's gRPC connection.
You can use this only when an endpoint is provided without the http or https scheme.
OTEL_EXPORTER_OTLP_ENDPOINT, OTEL_EXPORTER_OTLP_METRICS_ENDPOINT setting overrides
the scheme defined via OTEL_EXPORTER_OTLP_ENDPOINT, OTEL_EXPORTER_OTLP_METRICS_ENDPOINT.
OTEL_EXPORTER_OTLP_METRICS_INSECURE takes precedence over OTEL_EXPORTER_OTLP_INSECURE.
The configuration can be overridden by [WithInsecure], [WithGRPCConn] options.

OTEL_EXPORTER_OTLP_HEADERS, OTEL_EXPORTER_OTLP_METRICS_HEADERS (default: none) -
key-value pairs used as gRPC metadata associated with gRPC requests.
The value is expected to be represented in a format matching the [W3C Baggage HTTP Header Content Format],
except that additional semi-colon delimited metadata is not supported.
Example value: "key1=value1,key2=value2".
OTEL_EXPORTER_OTLP_METRICS_HEADERS takes precedence over OTEL_EXPORTER_OTLP_HEADERS.
The configuration can be overridden by [WithHeaders] option.

OTEL_EXPORTER_OTLP_TIMEOUT, OTEL_EXPORTER_OTLP_METRICS_TIMEOUT (default: "10000") -
maximum time in milliseconds the OTLP exporter waits for each batch export.
OTEL_EXPORTER_OTLP_METRICS_TIMEOUT takes precedence over OTEL_EXPORTER_OTLP_TIMEOUT.
The configuration can be overridden by [WithTimeout] option.

OTEL_EXPORTER_OTLP_COMPRESSION, OTEL_EXPORTER_OTLP_METRICS_COMPRESSION (default: none) -
the gRPC compressor the exporter uses.
Supported value: "gzip".
OTEL_EXPORTER_OTLP_METRICS_COMPRESSION takes precedence over OTEL_EXPORTER_OTLP_COMPRESSION.
The configuration can be overridden by [WithCompressor], [WithGRPCConn] options.

OTEL_EXPORTER_OTLP_CERTIFICATE, OTEL_EXPORTER_OTLP_METRICS_CERTIFICATE (default: none) -
the filepath to the trusted certificate to use when verifying a server's TLS credentials.
OTEL_EXPORTER_OTLP_METRICS_CERTIFICATE takes precedence over OTEL_EXPORTER_OTLP_CERTIFICATE.
The configuration can be overridden by [WithTLSCredentials], [WithGRPCConn] options.

OTEL_EXPORTER_OTLP_CLIENT_CERTIFICATE, OTEL_EXPORTER_OTLP_METRICS_CLIENT_CERTIFICATE (default: none) -
the filepath to the client certificate/chain trust for client's private key to use in mTLS communication in PEM format.
OTEL_EXPORTER_OTLP_METRICS_CLIENT_CERTIFICATE takes precedence over OTEL_EXPORTER_OTLP_CLIENT_CERTIFICATE.
The configuration can be overridden by [WithTLSCredentials], [WithGRPCConn] options.

OTEL_EXPORTER_OTLP_CLIENT_KEY, OTEL_EXPORTER_OTLP_METRICS_CLIENT_KEY (default: none) -
the filepath to the client's private key to use in mTLS communication in PEM format.
OTEL_EXPORTER_OTLP_METRICS_CLIENT_KEY takes precedence over OTEL_EXPORTER_OTLP_CLIENT_KEY.
The configuration can be overridden by [WithTLSCredentials], [WithGRPCConn] option.

OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE (default: "cumulative") -
aggregation temporality to use on the basis of instrument kind. Supported values:
  - "cumulative" - Cumulative aggregation temporality for all instrument kinds,
  - "delta" - Delta aggregation temporality for Counter, Asynchronous Counter and Histogram instrument kinds;
    Cumulative aggregation for UpDownCounter and Asynchronous UpDownCounter instrument kinds,
  - "lowmemory" - Delta aggregation temporality for Synchronous Counter and Histogram instrument kinds;
    Cumulative aggregation temporality for Synchronous UpDownCounter, Asynchronous Counter, and Asynchronous UpDownCounter instrument kinds.

The configuration can be overridden by [WithTemporalitySelector] option.

OTEL_EXPORTER_OTLP_METRICS_DEFAULT_HISTOGRAM_AGGREGATION (default: "explicit_bucket_histogram") -
default aggregation to use for histogram instruments. Supported values:
  - "explicit_bucket_histogram" - [Explicit Bucket Histogram Aggregation],
  - "base2_exponential_bucket_histogram" - [Base2 Exponential Bucket Histogram Aggregation].

The configuration can be overridden by [WithAggregationSelector] option.

[W3C Baggage HTTP Header Content Format]: https://www.w3.org/TR/baggage/#header-content
[Explicit Bucket Histogram Aggregation]: https://github.com/open-telemetry/opentelemetry-specification/blob/v1.26.0/specification/metrics/sdk.md#explicit-bucket-histogram-aggregation
[Base2 Exponential Bucket Histogram Aggregation]: https://github.com/open-telemetry/opentelemetry-specification/blob/v1.26.0/specification/metrics/sdk.md#base2-exponential-bucket-histogram-aggregation
*/
package otlpmetricgrpc // import "go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetricgrpc"
