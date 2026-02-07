// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

/*
Package otlploghttp provides an OTLP log exporter. The exporter uses HTTP to
transport OTLP protobuf payloads.

Exporter should be created using [New].

The environment variables described below can be used for configuration.

OTEL_EXPORTER_OTLP_ENDPOINT (default: "https://localhost:4318") -
target base URL ("/v1/logs" is appended) to which the exporter sends telemetry.
The value must contain a scheme ("http" or "https") and host.
The value may additionally contain a port and a path.
The value should not contain a query string or fragment.
The configuration can be overridden by OTEL_EXPORTER_OTLP_LOGS_ENDPOINT
environment variable and by [WithEndpoint], [WithEndpointURL], [WithInsecure] options.

OTEL_EXPORTER_OTLP_LOGS_ENDPOINT (default: "https://localhost:4318/v1/logs") -
target URL to which the exporter sends telemetry.
The value must contain a scheme ("http" or "https") and host.
The value may additionally contain a port and a path.
The value should not contain a query string or fragment.
The configuration can be overridden by [WithEndpoint], [WithEndpointURL], [WithInsecure], and [WithURLPath] options.

OTEL_EXPORTER_OTLP_HEADERS, OTEL_EXPORTER_OTLP_LOGS_HEADERS (default: none) -
key-value pairs used as headers associated with HTTP requests.
The value is expected to be represented in a format matching the [W3C Baggage HTTP Header Content Format],
except that additional semi-colon delimited metadata is not supported.
Example value: "key1=value1,key2=value2".
OTEL_EXPORTER_OTLP_LOGS_HEADERS takes precedence over OTEL_EXPORTER_OTLP_HEADERS.
The configuration can be overridden by [WithHeaders] option.

OTEL_EXPORTER_OTLP_TIMEOUT, OTEL_EXPORTER_OTLP_LOGS_TIMEOUT (default: "10000") -
maximum time in milliseconds the OTLP exporter waits for each batch export.
OTEL_EXPORTER_OTLP_LOGS_TIMEOUT takes precedence over OTEL_EXPORTER_OTLP_TIMEOUT.
The configuration can be overridden by [WithTimeout] option.

OTEL_EXPORTER_OTLP_COMPRESSION, OTEL_EXPORTER_OTLP_LOGS_COMPRESSION (default: none) -
the compression strategy the exporter uses to compress the HTTP body.
Supported value: "gzip".
OTEL_EXPORTER_OTLP_LOGS_COMPRESSION takes precedence over OTEL_EXPORTER_OTLP_COMPRESSION.
The configuration can be overridden by [WithCompression] option.

OTEL_EXPORTER_OTLP_CERTIFICATE, OTEL_EXPORTER_OTLP_LOGS_CERTIFICATE (default: none) -
the filepath to the trusted certificate to use when verifying a server's TLS credentials.
OTEL_EXPORTER_OTLP_LOGS_CERTIFICATE takes precedence over OTEL_EXPORTER_OTLP_CERTIFICATE.
The configuration can be overridden by [WithTLSClientConfig] option.

OTEL_EXPORTER_OTLP_CLIENT_CERTIFICATE, OTEL_EXPORTER_OTLP_LOGS_CLIENT_CERTIFICATE (default: none) -
the filepath to the client certificate/chain trust for client's private key to use in mTLS communication in PEM format.
OTEL_EXPORTER_OTLP_LOGS_CLIENT_CERTIFICATE takes precedence over OTEL_EXPORTER_OTLP_CLIENT_CERTIFICATE.
The configuration can be overridden by [WithTLSClientConfig] option.

OTEL_EXPORTER_OTLP_CLIENT_KEY, OTEL_EXPORTER_OTLP_LOGS_CLIENT_KEY (default: none) -
the filepath to the client's private key to use in mTLS communication in PEM format.
OTEL_EXPORTER_OTLP_LOGS_CLIENT_KEY takes precedence over OTEL_EXPORTER_OTLP_CLIENT_KEY.
The configuration can be overridden by [WithTLSClientConfig] option.

[W3C Baggage HTTP Header Content Format]: https://www.w3.org/TR/baggage/#header-content
*/
package otlploghttp // import "go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploghttp"
