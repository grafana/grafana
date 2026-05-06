// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

/*
Package otlpmetrichttp provides an OTLP metrics exporter using HTTP with protobuf payloads.
By default the telemetry is sent to https://localhost:4318/v1/metrics.

Exporter should be created using [New] and used with a [metric.PeriodicReader].

The environment variables described below can be used for configuration.

OTEL_EXPORTER_OTLP_ENDPOINT (default: "https://localhost:4318") -
target base URL ("/v1/metrics" is appended) to which the exporter sends telemetry.
The value must contain a scheme ("http" or "https") and host.
The value may additionally contain a port and a path.
The value should not contain a query string or fragment.
The configuration can be overridden by OTEL_EXPORTER_OTLP_METRICS_ENDPOINT
environment variable and by [WithEndpoint], [WithEndpointURL], and [WithInsecure] options.

OTEL_EXPORTER_OTLP_METRICS_ENDPOINT (default: "https://localhost:4318/v1/metrics") -
target URL to which the exporter sends telemetry.
The value must contain a scheme ("http" or "https") and host.
The value may additionally contain a port and a path.
The value should not contain a query string or fragment.
The configuration can be overridden by [WithEndpoint], [WithEndpointURL], [WithInsecure], and [WithURLPath] options.

OTEL_EXPORTER_OTLP_HEADERS, OTEL_EXPORTER_OTLP_METRICS_HEADERS (default: none) -
key-value pairs used as headers associated with HTTP requests.
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
compression strategy the exporter uses to compress the HTTP body.
Supported values: "gzip".
OTEL_EXPORTER_OTLP_METRICS_COMPRESSION takes precedence over OTEL_EXPORTER_OTLP_COMPRESSION.
The configuration can be overridden by [WithCompression] option.

OTEL_EXPORTER_OTLP_CERTIFICATE, OTEL_EXPORTER_OTLP_METRICS_CERTIFICATE (default: none) -
filepath to the trusted certificate to use when verifying a server's TLS credentials.
OTEL_EXPORTER_OTLP_METRICS_CERTIFICATE takes precedence over OTEL_EXPORTER_OTLP_CERTIFICATE.
The configuration can be overridden by [WithTLSClientConfig] option.

OTEL_EXPORTER_OTLP_CLIENT_CERTIFICATE, OTEL_EXPORTER_OTLP_METRICS_CLIENT_CERTIFICATE (default: none) -
filepath to the client certificate/chain trust for client's private key to use in mTLS communication in PEM format.
OTEL_EXPORTER_OTLP_METRICS_CLIENT_CERTIFICATE takes precedence over OTEL_EXPORTER_OTLP_CLIENT_CERTIFICATE.
The configuration can be overridden by [WithTLSClientConfig] option.

OTEL_EXPORTER_OTLP_CLIENT_KEY, OTEL_EXPORTER_OTLP_METRICS_CLIENT_KEY (default: none) -
filepath to the client's private key to use in mTLS communication in PEM format.
OTEL_EXPORTER_OTLP_METRICS_CLIENT_KEY takes precedence over OTEL_EXPORTER_OTLP_CLIENT_KEY.
The configuration can be overridden by [WithTLSClientConfig] option.

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
package otlpmetrichttp // import "go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetrichttp"
