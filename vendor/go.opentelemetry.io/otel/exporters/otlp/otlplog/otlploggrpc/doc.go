// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

/*
Package otlploggrpc provides an OTLP log exporter using gRPC. The exporter uses gRPC to
transport OTLP protobuf payloads.

All Exporters must be created with [New].

The environment variables described below can be used for configuration.

OTEL_EXPORTER_OTLP_ENDPOINT, OTEL_EXPORTER_OTLP_LOGS_ENDPOINT (default: "https://localhost:4317") -
target to which the exporter sends telemetry.
The target syntax is defined in https://github.com/grpc/grpc/blob/master/doc/naming.md.
The value must contain a scheme ("http" or "https") and host.
The value may additionally contain a port, and a path.
The value should not contain a query string or fragment.
OTEL_EXPORTER_OTLP_LOGS_ENDPOINT takes precedence over OTEL_EXPORTER_OTLP_ENDPOINT.
The configuration can be overridden by [WithEndpoint], [WithEndpointURL], [WithInsecure], and [WithGRPCConn] options.

OTEL_EXPORTER_OTLP_INSECURE, OTEL_EXPORTER_OTLP_LOGS_INSECURE (default: "false") -
setting "true" disables client transport security for the exporter's gRPC connection.
You can use this only when an endpoint is provided without scheme.
OTEL_EXPORTER_OTLP_LOGS_INSECURE takes precedence over OTEL_EXPORTER_OTLP_INSECURE.
The configuration can be overridden by [WithInsecure], [WithGRPCConn] options.

OTEL_EXPORTER_OTLP_HEADERS, OTEL_EXPORTER_OTLP_LOGS_HEADERS (default: none) -
key-value pairs used as gRPC metadata associated with gRPC requests.
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
the gRPC compressor the exporter uses.
Supported value: "gzip".
OTEL_EXPORTER_OTLP_LOGS_COMPRESSION takes precedence over OTEL_EXPORTER_OTLP_COMPRESSION.
The configuration can be overridden by [WithCompressor], [WithGRPCConn] options.

OTEL_EXPORTER_OTLP_CERTIFICATE, OTEL_EXPORTER_OTLP_LOGS_CERTIFICATE (default: none) -
the filepath to the trusted certificate to use when verifying a server's TLS credentials.
OTEL_EXPORTER_OTLP_LOGS_CERTIFICATE takes precedence over OTEL_EXPORTER_OTLP_CERTIFICATE.
The configuration can be overridden by [WithTLSCredentials], [WithGRPCConn] options.

OTEL_EXPORTER_OTLP_CLIENT_CERTIFICATE, OTEL_EXPORTER_OTLP_LOGS_CLIENT_CERTIFICATE (default: none) -
the filepath to the client certificate/chain trust for client's private key to use in mTLS communication in PEM format.
OTEL_EXPORTER_OTLP_LOGS_CLIENT_CERTIFICATE takes precedence over OTEL_EXPORTER_OTLP_CLIENT_CERTIFICATE.
The configuration can be overridden by [WithTLSCredentials], [WithGRPCConn] options.

OTEL_EXPORTER_OTLP_CLIENT_KEY, OTEL_EXPORTER_OTLP_LOGS_CLIENT_KEY (default: none) -
the filepath to the client's private key to use in mTLS communication in PEM format.
OTEL_EXPORTER_OTLP_LOGS_CLIENT_KEY takes precedence over OTEL_EXPORTER_OTLP_CLIENT_KEY.
The configuration can be overridden by [WithTLSCredentials], [WithGRPCConn] option.

[W3C Baggage HTTP Header Content Format]: https://www.w3.org/TR/baggage/#header-content
*/
package otlploggrpc // import "go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploggrpc"
