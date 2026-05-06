// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package otlpmetrichttp // import "go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetrichttp"

import (
	"crypto/tls"
	"net/http"
	"net/url"
	"time"

	"go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetrichttp/internal/oconf"
	"go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetrichttp/internal/retry"
	"go.opentelemetry.io/otel/sdk/metric"
)

// Compression describes the compression used for payloads sent to the
// collector.
type Compression oconf.Compression

// HTTPTransportProxyFunc is a function that resolves which URL to use as proxy for a given request.
// This type is compatible with http.Transport.Proxy and can be used to set a custom proxy function
// to the OTLP HTTP client.
type HTTPTransportProxyFunc func(*http.Request) (*url.URL, error)

const (
	// NoCompression tells the driver to send payloads without
	// compression.
	NoCompression = Compression(oconf.NoCompression)
	// GzipCompression tells the driver to send payloads after
	// compressing them with gzip.
	GzipCompression = Compression(oconf.GzipCompression)
)

// Option applies an option to the Exporter.
type Option interface {
	applyHTTPOption(oconf.Config) oconf.Config
}

func asHTTPOptions(opts []Option) []oconf.HTTPOption {
	converted := make([]oconf.HTTPOption, len(opts))
	for i, o := range opts {
		converted[i] = oconf.NewHTTPOption(o.applyHTTPOption)
	}
	return converted
}

// RetryConfig defines configuration for retrying the export of metric data
// that failed.
type RetryConfig retry.Config

type wrappedOption struct {
	oconf.HTTPOption
}

func (w wrappedOption) applyHTTPOption(cfg oconf.Config) oconf.Config {
	return w.ApplyHTTPOption(cfg)
}

// WithEndpoint sets the target endpoint the Exporter will connect to. This
// endpoint is specified as a host and optional port, no path or scheme should
// be included (see WithInsecure and WithURLPath).
//
// If the OTEL_EXPORTER_OTLP_ENDPOINT or OTEL_EXPORTER_OTLP_METRICS_ENDPOINT
// environment variable is set, and this option is not passed, that variable
// value will be used. If both environment variables are set,
// OTEL_EXPORTER_OTLP_METRICS_ENDPOINT will take precedence. If an environment
// variable is set, and this option is passed, this option will take precedence.
//
// By default, if an environment variable is not set, and this option is not
// passed, "localhost:4318" will be used.
func WithEndpoint(endpoint string) Option {
	return wrappedOption{oconf.WithEndpoint(endpoint)}
}

// WithEndpointURL sets the target endpoint URL the Exporter will connect to.
//
// If the OTEL_EXPORTER_OTLP_ENDPOINT or OTEL_EXPORTER_OTLP_METRICS_ENDPOINT
// environment variable is set, and this option is not passed, that variable
// value will be used. If both environment variables are set,
// OTEL_EXPORTER_OTLP_METRICS_ENDPOINT will take precedence. If an environment
// variable is set, and this option is passed, this option will take precedence.
//
// If both this option and WithEndpoint are used, the last used option will
// take precedence.
//
// If an invalid URL is provided, the default value will be kept.
//
// By default, if an environment variable is not set, and this option is not
// passed, "localhost:4318" will be used.
//
// This option has no effect if WithGRPCConn is used.
func WithEndpointURL(u string) Option {
	return wrappedOption{oconf.WithEndpointURL(u)}
}

// WithCompression sets the compression strategy the Exporter will use to
// compress the HTTP body.
//
// If the OTEL_EXPORTER_OTLP_COMPRESSION or
// OTEL_EXPORTER_OTLP_METRICS_COMPRESSION environment variable is set, and
// this option is not passed, that variable value will be used. That value can
// be either "none" or "gzip". If both are set,
// OTEL_EXPORTER_OTLP_METRICS_COMPRESSION will take precedence.
//
// By default, if an environment variable is not set, and this option is not
// passed, no compression strategy will be used.
func WithCompression(compression Compression) Option {
	return wrappedOption{oconf.WithCompression(oconf.Compression(compression))}
}

// WithURLPath sets the URL path the Exporter will send requests to.
//
// If the OTEL_EXPORTER_OTLP_ENDPOINT or OTEL_EXPORTER_OTLP_METRICS_ENDPOINT
// environment variable is set, and this option is not passed, the path
// contained in that variable value will be used. If both are set,
// OTEL_EXPORTER_OTLP_METRICS_ENDPOINT will take precedence.
//
// By default, if an environment variable is not set, and this option is not
// passed, "/v1/metrics" will be used.
func WithURLPath(urlPath string) Option {
	return wrappedOption{oconf.WithURLPath(urlPath)}
}

// WithTLSClientConfig sets the TLS configuration the Exporter will use for
// HTTP requests.
//
// If the OTEL_EXPORTER_OTLP_CERTIFICATE or
// OTEL_EXPORTER_OTLP_METRICS_CERTIFICATE environment variable is set, and
// this option is not passed, that variable value will be used. The value will
// be parsed the filepath of the TLS certificate chain to use. If both are
// set, OTEL_EXPORTER_OTLP_METRICS_CERTIFICATE will take precedence.
//
// By default, if an environment variable is not set, and this option is not
// passed, the system default configuration is used.
func WithTLSClientConfig(tlsCfg *tls.Config) Option {
	return wrappedOption{oconf.WithTLSClientConfig(tlsCfg)}
}

// WithInsecure disables client transport security for the Exporter's HTTP
// connection.
//
// If the OTEL_EXPORTER_OTLP_ENDPOINT or OTEL_EXPORTER_OTLP_METRICS_ENDPOINT
// environment variable is set, and this option is not passed, that variable
// value will be used to determine client security. If the endpoint has a
// scheme of "http" or "unix" client security will be disabled. If both are
// set, OTEL_EXPORTER_OTLP_METRICS_ENDPOINT will take precedence.
//
// By default, if an environment variable is not set, and this option is not
// passed, client security will be used.
func WithInsecure() Option {
	return wrappedOption{oconf.WithInsecure()}
}

// WithHeaders will send the provided headers with each HTTP requests.
//
// If the OTEL_EXPORTER_OTLP_HEADERS or OTEL_EXPORTER_OTLP_METRICS_HEADERS
// environment variable is set, and this option is not passed, that variable
// value will be used. The value will be parsed as a list of key value pairs.
// These pairs are expected to be in the W3C Correlation-Context format
// without additional semi-colon delimited metadata (i.e. "k1=v1,k2=v2"). If
// both are set, OTEL_EXPORTER_OTLP_METRICS_HEADERS will take precedence.
//
// By default, if an environment variable is not set, and this option is not
// passed, no user headers will be set.
func WithHeaders(headers map[string]string) Option {
	return wrappedOption{oconf.WithHeaders(headers)}
}

// WithTimeout sets the max amount of time an Exporter will attempt an export.
//
// This takes precedence over any retry settings defined by WithRetry. Once
// this time limit has been reached the export is abandoned and the metric
// data is dropped.
//
// If the OTEL_EXPORTER_OTLP_TIMEOUT or OTEL_EXPORTER_OTLP_METRICS_TIMEOUT
// environment variable is set, and this option is not passed, that variable
// value will be used. The value will be parsed as an integer representing the
// timeout in milliseconds. If both are set,
// OTEL_EXPORTER_OTLP_METRICS_TIMEOUT will take precedence.
//
// By default, if an environment variable is not set, and this option is not
// passed, a timeout of 10 seconds will be used.
func WithTimeout(duration time.Duration) Option {
	return wrappedOption{oconf.WithTimeout(duration)}
}

// WithRetry sets the retry policy for transient retryable errors that are
// returned by the target endpoint.
//
// If the target endpoint responds with not only a retryable error, but
// explicitly returns a backoff time in the response, that time will take
// precedence over these settings.
//
// If unset, the default retry policy will be used. It will retry the export
// 5 seconds after receiving a retryable error and increase exponentially
// after each error for no more than a total time of 1 minute.
func WithRetry(rc RetryConfig) Option {
	return wrappedOption{oconf.WithRetry(retry.Config(rc))}
}

// WithTemporalitySelector sets the TemporalitySelector the client will use to
// determine the Temporality of an instrument based on its kind. If this option
// is not used, the client will use the DefaultTemporalitySelector from the
// go.opentelemetry.io/otel/sdk/metric package.
func WithTemporalitySelector(selector metric.TemporalitySelector) Option {
	return wrappedOption{oconf.WithTemporalitySelector(selector)}
}

// WithAggregationSelector sets the AggregationSelector the client will use to
// determine the aggregation to use for an instrument based on its kind. If
// this option is not used, the reader will use the DefaultAggregationSelector
// from the go.opentelemetry.io/otel/sdk/metric package, or the aggregation
// explicitly passed for a view matching an instrument.
func WithAggregationSelector(selector metric.AggregationSelector) Option {
	return wrappedOption{oconf.WithAggregationSelector(selector)}
}

// WithProxy sets the Proxy function the client will use to determine the
// proxy to use for an HTTP request. If this option is not used, the client
// will use [http.ProxyFromEnvironment].
func WithProxy(pf HTTPTransportProxyFunc) Option {
	return wrappedOption{oconf.WithProxy(oconf.HTTPTransportProxyFunc(pf))}
}

// WithHTTPClient sets the HTTP client to used by the exporter.
//
// This option will take precedence over [WithProxy], [WithTimeout],
// [WithTLSClientConfig] options as well as OTEL_EXPORTER_OTLP_CERTIFICATE,
// OTEL_EXPORTER_OTLP_METRICS_CERTIFICATE, OTEL_EXPORTER_OTLP_TIMEOUT,
// OTEL_EXPORTER_OTLP_METRICS_TIMEOUT environment variables.
//
// Timeout and all other fields of the passed [http.Client] are left intact.
//
// Be aware that passing an HTTP client with transport like
// [go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp.NewTransport] can
// cause the client to be instrumented twice and cause infinite recursion.
func WithHTTPClient(c *http.Client) Option {
	return wrappedOption{oconf.WithHTTPClient(c)}
}
