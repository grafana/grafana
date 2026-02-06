// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package otlploggrpc // import "go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploggrpc"

import (
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
	"unicode"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploggrpc/internal/retry"
	"go.opentelemetry.io/otel/internal/global"
)

// Default values.
var (
	defaultEndpoint = "localhost:4317"
	defaultTimeout  = 10 * time.Second
	defaultRetryCfg = retry.DefaultConfig
)

// Environment variable keys.
var (
	envEndpoint = []string{
		"OTEL_EXPORTER_OTLP_LOGS_ENDPOINT",
		"OTEL_EXPORTER_OTLP_ENDPOINT",
	}
	envInsecure = []string{
		"OTEL_EXPORTER_OTLP_LOGS_INSECURE",
		"OTEL_EXPORTER_OTLP_INSECURE",
	}

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

type fnOpt func(config) config

func (f fnOpt) applyOption(c config) config { return f(c) }

// Option applies an option to the Exporter.
type Option interface {
	applyOption(config) config
}

type config struct {
	endpoint    setting[string]
	insecure    setting[bool]
	tlsCfg      setting[*tls.Config]
	headers     setting[map[string]string]
	compression setting[Compression]
	timeout     setting[time.Duration]
	retryCfg    setting[retry.Config]

	// gRPC configurations
	gRPCCredentials    setting[credentials.TransportCredentials]
	serviceConfig      setting[string]
	reconnectionPeriod setting[time.Duration]
	dialOptions        setting[[]grpc.DialOption]
	gRPCConn           setting[*grpc.ClientConn]
}

func newConfig(options []Option) config {
	var c config
	for _, opt := range options {
		c = opt.applyOption(c)
	}

	// Apply environment value and default value
	c.endpoint = c.endpoint.Resolve(
		getEnv[string](envEndpoint, convEndpoint),
		fallback[string](defaultEndpoint),
	)
	c.insecure = c.insecure.Resolve(
		loadInsecureFromEnvEndpoint(envEndpoint),
		getEnv[bool](envInsecure, convInsecure),
	)
	c.tlsCfg = c.tlsCfg.Resolve(
		loadEnvTLS[*tls.Config](),
	)
	c.headers = c.headers.Resolve(
		getEnv[map[string]string](envHeaders, convHeaders),
	)
	c.compression = c.compression.Resolve(
		getEnv[Compression](envCompression, convCompression),
	)
	c.timeout = c.timeout.Resolve(
		getEnv[time.Duration](envTimeout, convDuration),
		fallback[time.Duration](defaultTimeout),
	)
	c.retryCfg = c.retryCfg.Resolve(
		fallback[retry.Config](defaultRetryCfg),
	)

	return c
}

// RetryConfig defines configuration for retrying the export of log data
// that failed.
//
// This configuration does not define any network retry strategy. That is
// entirely handled by the gRPC ClientConn.
type RetryConfig retry.Config

// WithInsecure disables client transport security for the Exporter's gRPC
// connection, just like grpc.WithInsecure()
// (https://pkg.go.dev/google.golang.org/grpc#WithInsecure) does.
//
// If the OTEL_EXPORTER_OTLP_ENDPOINT or OTEL_EXPORTER_OTLP_LOGS_ENDPOINT
// environment variable is set, and this option is not passed, that variable
// value will be used to determine client security. If the endpoint has a
// scheme of "http" or "unix" client security will be disabled. If both are
// set, OTEL_EXPORTER_OTLP_LOGS_ENDPOINT will take precedence.
//
// By default, if an environment variable is not set, and this option is not
// passed, client security will be used.
//
// This option has no effect if WithGRPCConn is used.
func WithInsecure() Option {
	return fnOpt(func(c config) config {
		c.insecure = newSetting(true)
		return c
	})
}

// WithEndpoint sets the target endpoint the Exporter will connect to.
//
// If the OTEL_EXPORTER_OTLP_ENDPOINT or OTEL_EXPORTER_OTLP_LOGS_ENDPOINT
// environment variable is set, and this option is not passed, that variable
// value will be used. If both are set, OTEL_EXPORTER_OTLP_LOGS_ENDPOINT
// will take precedence.
//
// If both this option and WithEndpointURL are used, the last used option will
// take precedence.
//
// By default, if an environment variable is not set, and this option is not
// passed, "localhost:4317" will be used.
//
// This option has no effect if WithGRPCConn is used.
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
// value will be used. If both are set, OTEL_EXPORTER_OTLP_LOGS_ENDPOINT
// will take precedence.
//
// If both this option and WithEndpoint are used, the last used option will
// take precedence.
//
// If an invalid URL is provided, the default value will be kept.
//
// By default, if an environment variable is not set, and this option is not
// passed, "localhost:4317" will be used.
//
// This option has no effect if WithGRPCConn is used.
func WithEndpointURL(rawURL string) Option {
	u, err := url.Parse(rawURL)
	if err != nil {
		global.Error(err, "otlplog: parse endpoint url", "url", rawURL)
		return fnOpt(func(c config) config { return c })
	}
	return fnOpt(func(c config) config {
		c.endpoint = newSetting(u.Host)
		c.insecure = insecureFromScheme(c.insecure, u.Scheme)
		return c
	})
}

// WithReconnectionPeriod set the minimum amount of time between connection
// attempts to the target endpoint.
//
// This option has no effect if WithGRPCConn is used.
func WithReconnectionPeriod(rp time.Duration) Option {
	return fnOpt(func(c config) config {
		c.reconnectionPeriod = newSetting(rp)
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

// WithCompressor sets the compressor the gRPC client uses.
// Supported compressor values: "gzip".
//
// If the OTEL_EXPORTER_OTLP_COMPRESSION or
// OTEL_EXPORTER_OTLP_LOGS_COMPRESSION environment variable is set, and
// this option is not passed, that variable value will be used. That value can
// be either "none" or "gzip". If both are set,
// OTEL_EXPORTER_OTLP_LOGS_COMPRESSION will take precedence.
//
// By default, if an environment variable is not set, and this option is not
// passed, no compression strategy will be used.
//
// This option has no effect if WithGRPCConn is used.
func WithCompressor(compressor string) Option {
	return fnOpt(func(c config) config {
		c.compression = newSetting(compressorToCompression(compressor))
		return c
	})
}

// WithHeaders will send the provided headers with each gRPC requests.
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

// WithTLSCredentials sets the gRPC connection to use creds.
//
// If the OTEL_EXPORTER_OTLP_CERTIFICATE or
// OTEL_EXPORTER_OTLP_LOGS_CERTIFICATE environment variable is set, and
// this option is not passed, that variable value will be used. The value will
// be parsed the filepath of the TLS certificate chain to use. If both are
// set, OTEL_EXPORTER_OTLP_LOGS_CERTIFICATE will take precedence.
//
// By default, if an environment variable is not set, and this option is not
// passed, no TLS credentials will be used.
//
// This option has no effect if WithGRPCConn is used.
func WithTLSCredentials(credential credentials.TransportCredentials) Option {
	return fnOpt(func(c config) config {
		c.gRPCCredentials = newSetting(credential)
		return c
	})
}

// WithServiceConfig defines the default gRPC service config used.
//
// This option has no effect if WithGRPCConn is used.
func WithServiceConfig(serviceConfig string) Option {
	return fnOpt(func(c config) config {
		c.serviceConfig = newSetting(serviceConfig)
		return c
	})
}

// WithDialOption sets explicit grpc.DialOptions to use when establishing a
// gRPC connection. The options here are appended to the internal grpc.DialOptions
// used so they will take precedence over any other internal grpc.DialOptions
// they might conflict with.
// The [grpc.WithBlock], [grpc.WithTimeout], and [grpc.WithReturnConnectionError]
// grpc.DialOptions are ignored.
//
// This option has no effect if WithGRPCConn is used.
func WithDialOption(opts ...grpc.DialOption) Option {
	return fnOpt(func(c config) config {
		c.dialOptions = newSetting(opts)
		return c
	})
}

// WithGRPCConn sets conn as the gRPC ClientConn used for all communication.
//
// This option takes precedence over any other option that relates to
// establishing or persisting a gRPC connection to a target endpoint. Any
// other option of those types passed will be ignored.
//
// It is the callers responsibility to close the passed conn. The Exporter
// Shutdown method will not close this connection.
func WithGRPCConn(conn *grpc.ClientConn) Option {
	return fnOpt(func(c config) config {
		c.gRPCConn = newSetting(conn)
		return c
	})
}

// WithTimeout sets the max amount of time an Exporter will attempt an export.
//
// This takes precedence over any retry settings defined by WithRetry. Once
// this time limit has been reached the export is abandoned and the log
// data is dropped.
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

// WithRetry sets the retry policy for transient retryable errors that are
// returned by the target endpoint.
//
// If the target endpoint responds with not only a retryable error, but
// explicitly returns a backoff time in the response, that time will take
// precedence over these settings.
//
// These settings define the retry strategy implemented by the exporter.
// These settings do not define any network retry strategy.
// That is handled by the gRPC ClientConn.
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

// convEndpoint converts s from a URL string to an endpoint if s is a valid
// URL. Otherwise, "" and an error are returned.
func convEndpoint(s string) (string, error) {
	u, err := url.Parse(s)
	if err != nil {
		return "", err
	}
	return u.Host, nil
}

// convInsecure converts s from string to bool without case sensitivity.
// If s is not valid returns error.
func convInsecure(s string) (bool, error) {
	s = strings.ToLower(s)
	if s != "true" && s != "false" {
		return false, fmt.Errorf("can't convert %q to bool", s)
	}

	return s == "true", nil
}

// loadInsecureFromEnvEndpoint returns a resolver that fetches
// insecure setting from envEndpoint is it possible.
func loadInsecureFromEnvEndpoint(envEndpoint []string) resolver[bool] {
	return func(s setting[bool]) setting[bool] {
		if s.Set {
			// Passed, valid, options have precedence.
			return s
		}

		for _, key := range envEndpoint {
			if vStr := os.Getenv(key); vStr != "" {
				u, err := url.Parse(vStr)
				if err != nil {
					otel.Handle(fmt.Errorf("invalid %s value %s: %w", key, vStr, err))
					continue
				}

				return insecureFromScheme(s, u.Scheme)
			}
		}
		return s
	}
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

// insecureFromScheme return setting if the connection should
// use client transport security or not.
// Empty scheme doesn't force insecure setting.
func insecureFromScheme(prev setting[bool], scheme string) setting[bool] {
	if scheme == "https" {
		return newSetting(false)
	} else if len(scheme) > 0 {
		return newSetting(true)
	}

	return prev
}

func compressorToCompression(compressor string) Compression {
	c, err := convCompression(compressor)
	if err != nil {
		otel.Handle(fmt.Errorf("%w, using no compression as default", err))
		return NoCompression
	}

	return c
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

// getEnv returns a resolver that will apply an environment variable value
// associated with the first set key to a setting value. The conv function is
// used to convert between the environment variable value and the setting type.
//
// If the input setting to the resolver is set, the environment variable will
// not be applied.
//
// Any error returned from conv is sent to the OTel ErrorHandler and the
// setting will not be updated.
func getEnv[T any](keys []string, conv func(string) (T, error)) resolver[T] {
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
