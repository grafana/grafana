// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package otlploghttp // import "go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploghttp"

import (
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
	"unicode"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploghttp/internal/retry"
	"go.opentelemetry.io/otel/internal/global"
)

// Default values.
var (
	defaultEndpoint                        = "localhost:4318"
	defaultPath                            = "/v1/logs"
	defaultTimeout                         = 10 * time.Second
	defaultProxy    HTTPTransportProxyFunc = http.ProxyFromEnvironment
	defaultRetryCfg                        = retry.DefaultConfig
)

// Environment variable keys.
var (
	envEndpoint = []string{
		"OTEL_EXPORTER_OTLP_LOGS_ENDPOINT",
		"OTEL_EXPORTER_OTLP_ENDPOINT",
	}
	envInsecure = envEndpoint

	// Split because these are parsed differently.
	envPathSignal = []string{"OTEL_EXPORTER_OTLP_LOGS_ENDPOINT"}
	envPathOTLP   = []string{"OTEL_EXPORTER_OTLP_ENDPOINT"}

	envHeaders = []string{
		"OTEL_EXPORTER_OTLP_LOGS_HEADERS",
		"OTEL_EXPORTER_OTLP_HEADERS",
	}

	envCompression = []string{
		"OTEL_EXPORTER_OTLP_LOGS_COMPRESSION",
		"OTEL_EXPORTER_OTLP_COMPRESSION",
	}

	envTimeout = []string{
		"OTEL_EXPORTER_OTLP_LOGS_TIMEOUT",
		"OTEL_EXPORTER_OTLP_TIMEOUT",
	}

	envTLSCert = []string{
		"OTEL_EXPORTER_OTLP_LOGS_CERTIFICATE",
		"OTEL_EXPORTER_OTLP_CERTIFICATE",
	}
	envTLSClient = []struct {
		Certificate string
		Key         string
	}{
		{
			"OTEL_EXPORTER_OTLP_LOGS_CLIENT_CERTIFICATE",
			"OTEL_EXPORTER_OTLP_LOGS_CLIENT_KEY",
		},
		{
			"OTEL_EXPORTER_OTLP_CLIENT_CERTIFICATE",
			"OTEL_EXPORTER_OTLP_CLIENT_KEY",
		},
	}
)

// Option applies an option to the Exporter.
type Option interface {
	applyHTTPOption(config) config
}

type fnOpt func(config) config

func (f fnOpt) applyHTTPOption(c config) config { return f(c) }

type config struct {
	endpoint    setting[string]
	path        setting[string]
	insecure    setting[bool]
	tlsCfg      setting[*tls.Config]
	headers     setting[map[string]string]
	compression setting[Compression]
	timeout     setting[time.Duration]
	proxy       setting[HTTPTransportProxyFunc]
	retryCfg    setting[retry.Config]
	httpClient  *http.Client
}

func newConfig(options []Option) config {
	var c config
	for _, opt := range options {
		c = opt.applyHTTPOption(c)
	}

	c.endpoint = c.endpoint.Resolve(
		getenv[string](envEndpoint, convEndpoint),
		fallback[string](defaultEndpoint),
	)
	c.path = c.path.Resolve(
		getenv[string](envPathSignal, convPathExact),
		getenv[string](envPathOTLP, convPath),
		fallback[string](defaultPath),
	)
	c.insecure = c.insecure.Resolve(
		getenv[bool](envInsecure, convInsecure),
	)
	c.tlsCfg = c.tlsCfg.Resolve(
		loadEnvTLS[*tls.Config](),
	)
	c.headers = c.headers.Resolve(
		getenv[map[string]string](envHeaders, convHeaders),
	)
	c.compression = c.compression.Resolve(
		getenv[Compression](envCompression, convCompression),
	)
	c.timeout = c.timeout.Resolve(
		getenv[time.Duration](envTimeout, convDuration),
		fallback[time.Duration](defaultTimeout),
	)
	c.proxy = c.proxy.Resolve(
		fallback[HTTPTransportProxyFunc](defaultProxy),
	)
	c.retryCfg = c.retryCfg.Resolve(
		fallback[retry.Config](defaultRetryCfg),
	)

	return c
}

// WithEndpoint sets the target endpoint the Exporter will connect to. This
// endpoint is specified as a host and optional port, no path or scheme should
// be included (see WithInsecure and WithURLPath).
//
// If the OTEL_EXPORTER_OTLP_ENDPOINT or OTEL_EXPORTER_OTLP_LOGS_ENDPOINT
// environment variable is set, and this option is not passed, that variable
// value will be used. If both environment variables are set,
// OTEL_EXPORTER_OTLP_LOGS_ENDPOINT will take precedence. If an environment
// variable is set, and this option is passed, this option will take precedence.
//
// If both this option and WithEndpointURL are used, the last used option will
// take precedence.
//
// By default, if an environment variable is not set, and this option is not
// passed, "localhost:4318" will be used.
func WithEndpoint(endpoint string) Option {
	return fnOpt(func(c config) config {
		c.endpoint = newSetting(endpoint)
		return c
	})
}

// WithEndpointURL sets the target endpoint URL the Exporter will connect to.
//
// If the OTEL_EXPORTER_OTLP_ENDPOINT or OTEL_EXPORTER_OTLP_LOGS_ENDPOINT
// environment variable is set, and this option is not passed, that variable
// value will be used. If both environment variables are set,
// OTEL_EXPORTER_OTLP_LOGS_ENDPOINT will take precedence. If an environment
// variable is set, and this option is passed, this option will take precedence.
//
// If both this option and WithEndpoint are used, the last used option will
// take precedence.
//
// If an invalid URL is provided, the default value will be kept.
//
// By default, if an environment variable is not set, and this option is not
// passed, "localhost:4318" will be used.
func WithEndpointURL(rawURL string) Option {
	u, err := url.Parse(rawURL)
	if err != nil {
		global.Error(err, "otlplog: parse endpoint url", "url", rawURL)
		return fnOpt(func(c config) config { return c })
	}
	return fnOpt(func(c config) config {
		c.endpoint = newSetting(u.Host)
		c.path = newSetting(u.Path)
		c.insecure = newSetting(u.Scheme != "https")
		return c
	})
}

// Compression describes the compression used for exported payloads.
type Compression int

const (
	// NoCompression represents that no compression should be used.
	NoCompression Compression = iota
	// GzipCompression represents that gzip compression should be used.
	GzipCompression
)

// WithCompression sets the compression strategy the Exporter will use to
// compress the HTTP body.
//
// If the OTEL_EXPORTER_OTLP_COMPRESSION or
// OTEL_EXPORTER_OTLP_LOGS_COMPRESSION environment variable is set, and
// this option is not passed, that variable value will be used. That value can
// be either "none" or "gzip". If both are set,
// OTEL_EXPORTER_OTLP_LOGS_COMPRESSION will take precedence.
//
// By default, if an environment variable is not set, and this option is not
// passed, no compression strategy will be used.
func WithCompression(compression Compression) Option {
	return fnOpt(func(c config) config {
		c.compression = newSetting(compression)
		return c
	})
}

// WithURLPath sets the URL path the Exporter will send requests to.
//
// If the OTEL_EXPORTER_OTLP_ENDPOINT or OTEL_EXPORTER_OTLP_LOGS_ENDPOINT
// environment variable is set, and this option is not passed, the path
// contained in that variable value will be used. If both are set,
// OTEL_EXPORTER_OTLP_LOGS_ENDPOINT will take precedence.
//
// By default, if an environment variable is not set, and this option is not
// passed, "/v1/logs" will be used.
func WithURLPath(urlPath string) Option {
	return fnOpt(func(c config) config {
		c.path = newSetting(urlPath)
		return c
	})
}

// WithTLSClientConfig sets the TLS configuration the Exporter will use for
// HTTP requests.
//
// If the OTEL_EXPORTER_OTLP_CERTIFICATE or
// OTEL_EXPORTER_OTLP_LOGS_CERTIFICATE environment variable is set, and
// this option is not passed, that variable value will be used. The value will
// be parsed the filepath of the TLS certificate chain to use. If both are
// set, OTEL_EXPORTER_OTLP_LOGS_CERTIFICATE will take precedence.
//
// By default, if an environment variable is not set, and this option is not
// passed, the system default configuration is used.
func WithTLSClientConfig(tlsCfg *tls.Config) Option {
	return fnOpt(func(c config) config {
		c.tlsCfg = newSetting(tlsCfg.Clone())
		return c
	})
}

// WithInsecure disables client transport security for the Exporter's HTTP
// connection.
//
// If the OTEL_EXPORTER_OTLP_ENDPOINT or OTEL_EXPORTER_OTLP_LOGS_ENDPOINT
// environment variable is set, and this option is not passed, that variable
// value will be used to determine client security. If the endpoint has a
// scheme of "http" or "unix" client security will be disabled. If both are
// set, OTEL_EXPORTER_OTLP_LOGS_ENDPOINT will take precedence.
//
// By default, if an environment variable is not set, and this option is not
// passed, client security will be used.
func WithInsecure() Option {
	return fnOpt(func(c config) config {
		c.insecure = newSetting(true)
		return c
	})
}

// WithHeaders will send the provided headers with each HTTP requests.
//
// If the OTEL_EXPORTER_OTLP_HEADERS or OTEL_EXPORTER_OTLP_LOGS_HEADERS
// environment variable is set, and this option is not passed, that variable
// value will be used. The value will be parsed as a list of key value pairs.
// These pairs are expected to be in the W3C Correlation-Context format
// without additional semi-colon delimited metadata (i.e. "k1=v1,k2=v2"). If
// both are set, OTEL_EXPORTER_OTLP_LOGS_HEADERS will take precedence.
//
// By default, if an environment variable is not set, and this option is not
// passed, no user headers will be set.
func WithHeaders(headers map[string]string) Option {
	return fnOpt(func(c config) config {
		c.headers = newSetting(headers)
		return c
	})
}

// WithTimeout sets the max amount of time an Exporter will attempt an export.
//
// This takes precedence over any retry settings defined by WithRetry. Once
// this time limit has been reached the export is abandoned and the log data is
// dropped.
//
// If the OTEL_EXPORTER_OTLP_TIMEOUT or OTEL_EXPORTER_OTLP_LOGS_TIMEOUT
// environment variable is set, and this option is not passed, that variable
// value will be used. The value will be parsed as an integer representing the
// timeout in milliseconds. If both are set,
// OTEL_EXPORTER_OTLP_LOGS_TIMEOUT will take precedence.
//
// By default, if an environment variable is not set, and this option is not
// passed, a timeout of 10 seconds will be used.
func WithTimeout(duration time.Duration) Option {
	return fnOpt(func(c config) config {
		c.timeout = newSetting(duration)
		return c
	})
}

// RetryConfig defines configuration for retrying the export of log data that
// failed.
type RetryConfig retry.Config

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
	return fnOpt(func(c config) config {
		c.retryCfg = newSetting(retry.Config(rc))
		return c
	})
}

// HTTPTransportProxyFunc is a function that resolves which URL to use as proxy
// for a given request. This type is compatible with http.Transport.Proxy and
// can be used to set a custom proxy function to the OTLP HTTP client.
type HTTPTransportProxyFunc func(*http.Request) (*url.URL, error)

// WithProxy sets the Proxy function the client will use to determine the
// proxy to use for an HTTP request. If this option is not used, the client
// will use [http.ProxyFromEnvironment].
func WithProxy(pf HTTPTransportProxyFunc) Option {
	return fnOpt(func(c config) config {
		c.proxy = newSetting(pf)
		return c
	})
}

// WithHTTPClient sets the HTTP client to used by the exporter.
//
// This option will take precedence over [WithProxy], [WithTimeout],
// [WithTLSClientConfig] options as well as OTEL_EXPORTER_OTLP_CERTIFICATE,
// OTEL_EXPORTER_OTLP_LOGS_CERTIFICATE, OTEL_EXPORTER_OTLP_TIMEOUT,
// OTEL_EXPORTER_OTLP_LOGS_TIMEOUT environment variables.
//
// Timeout and all other fields of the passed [http.Client] are left intact.
//
// Be aware that passing an HTTP client with transport like
// [go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp.NewTransport] can
// cause the client to be instrumented twice and cause infinite recursion.
func WithHTTPClient(c *http.Client) Option {
	return fnOpt(func(cfg config) config {
		cfg.httpClient = c
		return cfg
	})
}

// setting is a configuration setting value.
type setting[T any] struct {
	Value T
	Set   bool
}

// newSetting returns a new setting with the value set.
func newSetting[T any](value T) setting[T] {
	return setting[T]{Value: value, Set: true}
}

// resolver returns an updated setting after applying an resolution operation.
type resolver[T any] func(setting[T]) setting[T]

// Resolve returns a resolved version of s.
//
// It will apply all the passed fn in the order provided, chaining together the
// return setting to the next input. The setting s is used as the initial
// argument to the first fn.
//
// Each fn needs to validate if it should apply given the Set state of the
// setting. This will not perform any checks on the set state when chaining
// function.
func (s setting[T]) Resolve(fn ...resolver[T]) setting[T] {
	for _, f := range fn {
		s = f(s)
	}
	return s
}

// loadEnvTLS returns a resolver that loads a *tls.Config from files defined by
// the OTLP TLS environment variables. This will load both the rootCAs and
// certificates used for mTLS.
//
// If the filepath defined is invalid or does not contain valid TLS files, an
// error is passed to the OTel ErrorHandler and no TLS configuration is
// provided.
func loadEnvTLS[T *tls.Config]() resolver[T] {
	return func(s setting[T]) setting[T] {
		if s.Set {
			// Passed, valid, options have precedence.
			return s
		}

		var rootCAs *x509.CertPool
		var err error
		for _, key := range envTLSCert {
			if v := os.Getenv(key); v != "" {
				rootCAs, err = loadCertPool(v)
				break
			}
		}

		var certs []tls.Certificate
		for _, pair := range envTLSClient {
			cert := os.Getenv(pair.Certificate)
			key := os.Getenv(pair.Key)
			if cert != "" && key != "" {
				var e error
				certs, e = loadCertificates(cert, key)
				err = errors.Join(err, e)
				break
			}
		}

		if err != nil {
			err = fmt.Errorf("failed to load TLS: %w", err)
			otel.Handle(err)
		} else if rootCAs != nil || certs != nil {
			s.Set = true
			s.Value = &tls.Config{RootCAs: rootCAs, Certificates: certs}
		}
		return s
	}
}

// readFile is used for testing.
var readFile = os.ReadFile

// loadCertPool loads and returns the *x509.CertPool found at path if it exists
// and is valid. Otherwise, nil and an error is returned.
func loadCertPool(path string) (*x509.CertPool, error) {
	b, err := readFile(path)
	if err != nil {
		return nil, err
	}
	cp := x509.NewCertPool()
	if ok := cp.AppendCertsFromPEM(b); !ok {
		return nil, errors.New("certificate not added")
	}
	return cp, nil
}

// loadCertificates loads and returns the tls.Certificate found at path if it
// exists and is valid. Otherwise, nil and an error is returned.
func loadCertificates(certPath, keyPath string) ([]tls.Certificate, error) {
	cert, err := readFile(certPath)
	if err != nil {
		return nil, err
	}
	key, err := readFile(keyPath)
	if err != nil {
		return nil, err
	}
	crt, err := tls.X509KeyPair(cert, key)
	if err != nil {
		return nil, err
	}
	return []tls.Certificate{crt}, nil
}

// getenv returns a resolver that will apply an environment variable value
// associated with the first set key to a setting value. The conv function is
// used to convert between the environment variable value and the setting type.
//
// If the input setting to the resolver is set, the environment variable will
// not be applied.
//
// Any error returned from conv is sent to the OTel ErrorHandler and the
// setting will not be updated.
func getenv[T any](keys []string, conv func(string) (T, error)) resolver[T] {
	return func(s setting[T]) setting[T] {
		if s.Set {
			// Passed, valid, options have precedence.
			return s
		}

		for _, key := range keys {
			if vStr := os.Getenv(key); vStr != "" {
				v, err := conv(vStr)
				if err == nil {
					s.Value = v
					s.Set = true
					break
				}
				otel.Handle(fmt.Errorf("invalid %s value %s: %w", key, vStr, err))
			}
		}
		return s
	}
}

// convEndpoint converts s from a URL string to an endpoint if s is a valid
// URL. Otherwise, "" and an error are returned.
func convEndpoint(s string) (string, error) {
	u, err := url.Parse(s)
	if err != nil {
		return "", err
	}
	return u.Host, nil
}

// convPathExact converts s from a URL string to the exact path if s is a valid
// URL. Otherwise, "" and an error are returned.
//
// If the path contained in s is empty, "/" is returned.
func convPathExact(s string) (string, error) {
	u, err := url.Parse(s)
	if err != nil {
		return "", err
	}
	if u.Path == "" {
		return "/", nil
	}
	return u.Path, nil
}

// convPath converts s from a URL string to an OTLP endpoint path if s is a
// valid URL. Otherwise, "" and an error are returned.
func convPath(s string) (string, error) {
	u, err := url.Parse(s)
	if err != nil {
		return "", err
	}
	return u.Path + "/v1/logs", nil
}

// convInsecure parses s as a URL string and returns if the connection should
// use client transport security or not. If s is an invalid URL, false and an
// error are returned.
func convInsecure(s string) (bool, error) {
	u, err := url.Parse(s)
	if err != nil {
		return false, err
	}
	return u.Scheme != "https", nil
}

// convHeaders converts the OTel environment variable header value s into a
// mapping of header key to value. If s is invalid a partial result and error
// are returned.
func convHeaders(s string) (map[string]string, error) {
	out := make(map[string]string)
	var err error
	for _, header := range strings.Split(s, ",") {
		rawKey, rawVal, found := strings.Cut(header, "=")
		if !found {
			err = errors.Join(err, fmt.Errorf("invalid header: %s", header))
			continue
		}

		key := strings.TrimSpace(rawKey)

		// Validate the key.
		if !isValidHeaderKey(key) {
			err = errors.Join(err, fmt.Errorf("invalid header key: %s", rawKey))
			continue
		}

		// Only decode the value.
		escVal, e := url.PathUnescape(rawVal)
		if e != nil {
			err = errors.Join(err, fmt.Errorf("invalid header value: %s", rawVal))
			continue
		}
		val := strings.TrimSpace(escVal)

		out[key] = val
	}
	return out, err
}

// convCompression returns the parsed compression encoded in s. NoCompression
// and an errors are returned if s is unknown.
func convCompression(s string) (Compression, error) {
	switch s {
	case "gzip":
		return GzipCompression, nil
	case "none", "":
		return NoCompression, nil
	}
	return NoCompression, fmt.Errorf("unknown compression: %s", s)
}

// convDuration converts s into a duration of milliseconds. If s does not
// contain an integer, 0 and an error are returned.
func convDuration(s string) (time.Duration, error) {
	d, err := strconv.Atoi(s)
	if err != nil {
		return 0, err
	}
	// OTel durations are defined in milliseconds.
	return time.Duration(d) * time.Millisecond, nil
}

// fallback returns a resolve that will set a setting value to val if it is not
// already set.
//
// This is usually passed at the end of a resolver chain to ensure a default is
// applied if the setting has not already been set.
func fallback[T any](val T) resolver[T] {
	return func(s setting[T]) setting[T] {
		if !s.Set {
			s.Value = val
			s.Set = true
		}
		return s
	}
}

func isValidHeaderKey(key string) bool {
	if key == "" {
		return false
	}
	for _, c := range key {
		if !isTokenChar(c) {
			return false
		}
	}
	return true
}

func isTokenChar(c rune) bool {
	return c <= unicode.MaxASCII && (unicode.IsLetter(c) ||
		unicode.IsDigit(c) ||
		c == '!' || c == '#' || c == '$' || c == '%' || c == '&' || c == '\'' || c == '*' ||
		c == '+' || c == '-' || c == '.' || c == '^' || c == '_' || c == '`' || c == '|' || c == '~')
}
