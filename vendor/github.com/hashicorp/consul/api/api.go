// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package api

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/hashicorp/go-cleanhttp"
	"github.com/hashicorp/go-hclog"
	"github.com/hashicorp/go-rootcerts"
)

const (
	// HTTPAddrEnvName defines an environment variable name which sets
	// the HTTP address if there is no -http-addr specified.
	HTTPAddrEnvName = "CONSUL_HTTP_ADDR"

	// HTTPTokenEnvName defines an environment variable name which sets
	// the HTTP token.
	HTTPTokenEnvName = "CONSUL_HTTP_TOKEN"

	// HTTPTokenFileEnvName defines an environment variable name which sets
	// the HTTP token file.
	HTTPTokenFileEnvName = "CONSUL_HTTP_TOKEN_FILE"

	// HTTPAuthEnvName defines an environment variable name which sets
	// the HTTP authentication header.
	HTTPAuthEnvName = "CONSUL_HTTP_AUTH"

	// HTTPSSLEnvName defines an environment variable name which sets
	// whether or not to use HTTPS.
	HTTPSSLEnvName = "CONSUL_HTTP_SSL"

	// HTTPCAFile defines an environment variable name which sets the
	// CA file to use for talking to Consul over TLS.
	HTTPCAFile = "CONSUL_CACERT"

	// HTTPCAPath defines an environment variable name which sets the
	// path to a directory of CA certs to use for talking to Consul over TLS.
	HTTPCAPath = "CONSUL_CAPATH"

	// HTTPClientCert defines an environment variable name which sets the
	// client cert file to use for talking to Consul over TLS.
	HTTPClientCert = "CONSUL_CLIENT_CERT"

	// HTTPClientKey defines an environment variable name which sets the
	// client key file to use for talking to Consul over TLS.
	HTTPClientKey = "CONSUL_CLIENT_KEY"

	// HTTPTLSServerName defines an environment variable name which sets the
	// server name to use as the SNI host when connecting via TLS
	HTTPTLSServerName = "CONSUL_TLS_SERVER_NAME"

	// HTTPSSLVerifyEnvName defines an environment variable name which sets
	// whether or not to disable certificate checking.
	HTTPSSLVerifyEnvName = "CONSUL_HTTP_SSL_VERIFY"

	// GRPCAddrEnvName defines an environment variable name which sets the gRPC
	// address for consul connect envoy. Note this isn't actually used by the api
	// client in this package but is defined here for consistency with all the
	// other ENV names we use.
	GRPCAddrEnvName = "CONSUL_GRPC_ADDR"

	// GRPCCAFileEnvName defines an environment variable name which sets the
	// CA file to use for talking to Consul gRPC over TLS.
	GRPCCAFileEnvName = "CONSUL_GRPC_CACERT"

	// GRPCCAPathEnvName defines an environment variable name which sets the
	// path to a directory of CA certs to use for talking to Consul gRPC over TLS.
	GRPCCAPathEnvName = "CONSUL_GRPC_CAPATH"

	// HTTPNamespaceEnvVar defines an environment variable name which sets
	// the HTTP Namespace to be used by default. This can still be overridden.
	HTTPNamespaceEnvName = "CONSUL_NAMESPACE"

	// HTTPPartitionEnvName defines an environment variable name which sets
	// the HTTP Partition to be used by default. This can still be overridden.
	HTTPPartitionEnvName = "CONSUL_PARTITION"

	// QueryBackendStreaming Query backend of type streaming
	QueryBackendStreaming = "streaming"

	// QueryBackendBlockingQuery Query backend of type blocking query
	QueryBackendBlockingQuery = "blocking-query"
)

type StatusError struct {
	Code int
	Body string
}

func (e StatusError) Error() string {
	return fmt.Sprintf("Unexpected response code: %d (%s)", e.Code, e.Body)
}

// QueryOptions are used to parameterize a query
type QueryOptions struct {
	// Namespace overrides the `default` namespace
	// Note: Namespaces are available only in Consul Enterprise
	Namespace string

	// Partition overrides the `default` partition
	// Note: Partitions are available only in Consul Enterprise
	Partition string

	// SamenessGroup is used find the SamenessGroup in the given
	// Partition and will find the failover order for the Service
	// from the SamenessGroup Members, with the given Partition being
	// the first member.
	// Note: SamenessGroups are available only in Consul Enterprise
	SamenessGroup string

	// Providing a datacenter overwrites the DC provided
	// by the Config
	Datacenter string

	// Providing a peer name in the query option
	Peer string

	// AllowStale allows any Consul server (non-leader) to service
	// a read. This allows for lower latency and higher throughput
	AllowStale bool

	// RequireConsistent forces the read to be fully consistent.
	// This is more expensive but prevents ever performing a stale
	// read.
	RequireConsistent bool

	// UseCache requests that the agent cache results locally. See
	// https://www.consul.io/api/features/caching.html for more details on the
	// semantics.
	UseCache bool

	// MaxAge limits how old a cached value will be returned if UseCache is true.
	// If there is a cached response that is older than the MaxAge, it is treated
	// as a cache miss and a new fetch invoked. If the fetch fails, the error is
	// returned. Clients that wish to allow for stale results on error can set
	// StaleIfError to a longer duration to change this behavior. It is ignored
	// if the endpoint supports background refresh caching. See
	// https://www.consul.io/api/features/caching.html for more details.
	MaxAge time.Duration

	// StaleIfError specifies how stale the client will accept a cached response
	// if the servers are unavailable to fetch a fresh one. Only makes sense when
	// UseCache is true and MaxAge is set to a lower, non-zero value. It is
	// ignored if the endpoint supports background refresh caching. See
	// https://www.consul.io/api/features/caching.html for more details.
	StaleIfError time.Duration

	// WaitIndex is used to enable a blocking query. Waits
	// until the timeout or the next index is reached
	WaitIndex uint64

	// WaitHash is used by some endpoints instead of WaitIndex to perform blocking
	// on state based on a hash of the response rather than a monotonic index.
	// This is required when the state being blocked on is not stored in Raft, for
	// example agent-local proxy configuration.
	WaitHash string

	// WaitTime is used to bound the duration of a wait.
	// Defaults to that of the Config, but can be overridden.
	WaitTime time.Duration

	// Token is used to provide a per-request ACL token
	// which overrides the agent's default token.
	Token string

	// Near is used to provide a node name that will sort the results
	// in ascending order based on the estimated round trip time from
	// that node. Setting this to "_agent" will use the agent's node
	// for the sort.
	Near string

	// NodeMeta is used to filter results by nodes with the given
	// metadata key/value pairs. Currently, only one key/value pair can
	// be provided for filtering.
	NodeMeta map[string]string

	// RelayFactor is used in keyring operations to cause responses to be
	// relayed back to the sender through N other random nodes. Must be
	// a value from 0 to 5 (inclusive).
	RelayFactor uint8

	// LocalOnly is used in keyring list operation to force the keyring
	// query to only hit local servers (no WAN traffic).
	LocalOnly bool

	// Connect filters prepared query execution to only include Connect-capable
	// services. This currently affects prepared query execution.
	Connect bool

	// ctx is an optional context pass through to the underlying HTTP
	// request layer. Use Context() and WithContext() to manage this.
	ctx context.Context

	// Filter requests filtering data prior to it being returned. The string
	// is a go-bexpr compatible expression.
	Filter string

	// MergeCentralConfig returns a service definition merged with the
	// proxy-defaults/global and service-defaults/:service config entries.
	// This can be used to ensure a full service definition is returned in the response
	// especially when the service might not be written into the catalog that way.
	MergeCentralConfig bool

	// Global is used to request information from all datacenters. Currently only
	// used for operator usage requests.
	Global bool
}

func (o *QueryOptions) Context() context.Context {
	if o != nil && o.ctx != nil {
		return o.ctx
	}
	return context.Background()
}

func (o *QueryOptions) WithContext(ctx context.Context) *QueryOptions {
	o2 := new(QueryOptions)
	if o != nil {
		*o2 = *o
	}
	o2.ctx = ctx
	return o2
}

// WriteOptions are used to parameterize a write
type WriteOptions struct {
	// Namespace overrides the `default` namespace
	// Note: Namespaces are available only in Consul Enterprise
	Namespace string

	// Partition overrides the `default` partition
	// Note: Partitions are available only in Consul Enterprise
	Partition string

	// Providing a datacenter overwrites the DC provided
	// by the Config
	Datacenter string

	// Token is used to provide a per-request ACL token
	// which overrides the agent's default token.
	Token string

	// RelayFactor is used in keyring operations to cause responses to be
	// relayed back to the sender through N other random nodes. Must be
	// a value from 0 to 5 (inclusive).
	RelayFactor uint8

	// ctx is an optional context pass through to the underlying HTTP
	// request layer. Use Context() and WithContext() to manage this.
	ctx context.Context
}

func (o *WriteOptions) Context() context.Context {
	if o != nil && o.ctx != nil {
		return o.ctx
	}
	return context.Background()
}

func (o *WriteOptions) WithContext(ctx context.Context) *WriteOptions {
	o2 := new(WriteOptions)
	if o != nil {
		*o2 = *o
	}
	o2.ctx = ctx
	return o2
}

// QueryMeta is used to return meta data about a query
type QueryMeta struct {
	// LastIndex. This can be used as a WaitIndex to perform
	// a blocking query
	LastIndex uint64

	// LastContentHash. This can be used as a WaitHash to perform a blocking query
	// for endpoints that support hash-based blocking. Endpoints that do not
	// support it will return an empty hash.
	LastContentHash string

	// Time of last contact from the leader for the
	// server servicing the request
	LastContact time.Duration

	// Is there a known leader
	KnownLeader bool

	// How long did the request take
	RequestTime time.Duration

	// Is address translation enabled for HTTP responses on this agent
	AddressTranslationEnabled bool

	// CacheHit is true if the result was served from agent-local cache.
	CacheHit bool

	// CacheAge is set if request was ?cached and indicates how stale the cached
	// response is.
	CacheAge time.Duration

	// QueryBackend represent which backend served the request.
	QueryBackend string

	// DefaultACLPolicy is used to control the ACL interaction when there is no
	// defined policy. This can be "allow" which means ACLs are used to
	// deny-list, or "deny" which means ACLs are allow-lists.
	DefaultACLPolicy string

	// ResultsFilteredByACLs is true when some of the query's results were
	// filtered out by enforcing ACLs. It may be false because nothing was
	// removed, or because the endpoint does not yet support this flag.
	ResultsFilteredByACLs bool
}

// WriteMeta is used to return meta data about a write
type WriteMeta struct {
	// How long did the request take
	RequestTime time.Duration
}

// HttpBasicAuth is used to authenticate http client with HTTP Basic Authentication
type HttpBasicAuth struct {
	// Username to use for HTTP Basic Authentication
	Username string

	// Password to use for HTTP Basic Authentication
	Password string
}

// Config is used to configure the creation of a client
type Config struct {
	// Address is the address of the Consul server
	Address string

	// Scheme is the URI scheme for the Consul server
	Scheme string

	// Prefix for URIs for when consul is behind an API gateway (reverse
	// proxy).  The API gateway must strip off the PathPrefix before
	// passing the request onto consul.
	PathPrefix string

	// Datacenter to use. If not provided, the default agent datacenter is used.
	Datacenter string

	// Transport is the Transport to use for the http client.
	Transport *http.Transport

	// HttpClient is the client to use. Default will be
	// used if not provided.
	HttpClient *http.Client

	// HttpAuth is the auth info to use for http access.
	HttpAuth *HttpBasicAuth

	// WaitTime limits how long a Watch will block. If not provided,
	// the agent default values will be used.
	WaitTime time.Duration

	// Token is used to provide a per-request ACL token
	// which overrides the agent's default token.
	Token string

	// TokenFile is a file containing the current token to use for this client.
	// If provided it is read once at startup and never again.
	TokenFile string

	// Namespace is the name of the namespace to send along for the request
	// when no other Namespace is present in the QueryOptions
	Namespace string

	// Partition is the name of the partition to send along for the request
	// when no other Partition is present in the QueryOptions
	Partition string

	TLSConfig TLSConfig
}

// TLSConfig is used to generate a TLSClientConfig that's useful for talking to
// Consul using TLS.
type TLSConfig struct {
	// Address is the optional address of the Consul server. The port, if any
	// will be removed from here and this will be set to the ServerName of the
	// resulting config.
	Address string

	// CAFile is the optional path to the CA certificate used for Consul
	// communication, defaults to the system bundle if not specified.
	CAFile string

	// CAPath is the optional path to a directory of CA certificates to use for
	// Consul communication, defaults to the system bundle if not specified.
	CAPath string

	// CAPem is the optional PEM-encoded CA certificate used for Consul
	// communication, defaults to the system bundle if not specified.
	CAPem []byte

	// CertFile is the optional path to the certificate for Consul
	// communication. If this is set then you need to also set KeyFile.
	CertFile string

	// CertPEM is the optional PEM-encoded certificate for Consul
	// communication. If this is set then you need to also set KeyPEM.
	CertPEM []byte

	// KeyFile is the optional path to the private key for Consul communication.
	// If this is set then you need to also set CertFile.
	KeyFile string

	// KeyPEM is the optional PEM-encoded private key for Consul communication.
	// If this is set then you need to also set CertPEM.
	KeyPEM []byte

	// InsecureSkipVerify if set to true will disable TLS host verification.
	InsecureSkipVerify bool
}

// DefaultConfig returns a default configuration for the client. By default this
// will pool and reuse idle connections to Consul. If you have a long-lived
// client object, this is the desired behavior and should make the most efficient
// use of the connections to Consul. If you don't reuse a client object, which
// is not recommended, then you may notice idle connections building up over
// time. To avoid this, use the DefaultNonPooledConfig() instead.
func DefaultConfig() *Config {
	return defaultConfig(nil, cleanhttp.DefaultPooledTransport)
}

// DefaultConfigWithLogger returns a default configuration for the client. It
// is exactly the same as DefaultConfig, but allows for a pre-configured logger
// object to be passed through.
func DefaultConfigWithLogger(logger hclog.Logger) *Config {
	return defaultConfig(logger, cleanhttp.DefaultPooledTransport)
}

// DefaultNonPooledConfig returns a default configuration for the client which
// does not pool connections. This isn't a recommended configuration because it
// will reconnect to Consul on every request, but this is useful to avoid the
// accumulation of idle connections if you make many client objects during the
// lifetime of your application.
func DefaultNonPooledConfig() *Config {
	return defaultConfig(nil, cleanhttp.DefaultTransport)
}

// defaultConfig returns the default configuration for the client, using the
// given function to make the transport.
func defaultConfig(logger hclog.Logger, transportFn func() *http.Transport) *Config {
	if logger == nil {
		logger = hclog.New(&hclog.LoggerOptions{
			Name: "consul-api",
		})
	}

	config := &Config{
		Address:   "127.0.0.1:8500",
		Scheme:    "http",
		Transport: transportFn(),
	}

	if addr := os.Getenv(HTTPAddrEnvName); addr != "" {
		config.Address = addr
	}

	if tokenFile := os.Getenv(HTTPTokenFileEnvName); tokenFile != "" {
		config.TokenFile = tokenFile
	}

	if token := os.Getenv(HTTPTokenEnvName); token != "" {
		config.Token = token
	}

	if auth := os.Getenv(HTTPAuthEnvName); auth != "" {
		var username, password string
		if strings.Contains(auth, ":") {
			split := strings.SplitN(auth, ":", 2)
			username = split[0]
			password = split[1]
		} else {
			username = auth
		}

		config.HttpAuth = &HttpBasicAuth{
			Username: username,
			Password: password,
		}
	}

	if ssl := os.Getenv(HTTPSSLEnvName); ssl != "" {
		enabled, err := strconv.ParseBool(ssl)
		if err != nil {
			logger.Warn(fmt.Sprintf("could not parse %s", HTTPSSLEnvName), "error", err)
		}

		if enabled {
			config.Scheme = "https"
		}
	}

	if v := os.Getenv(HTTPTLSServerName); v != "" {
		config.TLSConfig.Address = v
	}
	if v := os.Getenv(HTTPCAFile); v != "" {
		config.TLSConfig.CAFile = v
	}
	if v := os.Getenv(HTTPCAPath); v != "" {
		config.TLSConfig.CAPath = v
	}
	if v := os.Getenv(HTTPClientCert); v != "" {
		config.TLSConfig.CertFile = v
	}
	if v := os.Getenv(HTTPClientKey); v != "" {
		config.TLSConfig.KeyFile = v
	}
	if v := os.Getenv(HTTPSSLVerifyEnvName); v != "" {
		doVerify, err := strconv.ParseBool(v)
		if err != nil {
			logger.Warn(fmt.Sprintf("could not parse %s", HTTPSSLVerifyEnvName), "error", err)
		}
		if !doVerify {
			config.TLSConfig.InsecureSkipVerify = true
		}
	}

	if v := os.Getenv(HTTPNamespaceEnvName); v != "" {
		config.Namespace = v
	}

	if v := os.Getenv(HTTPPartitionEnvName); v != "" {
		config.Partition = v
	}

	return config
}

// TLSConfig is used to generate a TLSClientConfig that's useful for talking to
// Consul using TLS.
func SetupTLSConfig(tlsConfig *TLSConfig) (*tls.Config, error) {
	tlsClientConfig := &tls.Config{
		InsecureSkipVerify: tlsConfig.InsecureSkipVerify,
	}

	if tlsConfig.Address != "" {
		server := tlsConfig.Address
		hasPort := strings.LastIndex(server, ":") > strings.LastIndex(server, "]")
		if hasPort {
			var err error
			server, _, err = net.SplitHostPort(server)
			if err != nil {
				return nil, err
			}
		}
		tlsClientConfig.ServerName = server
	}

	if len(tlsConfig.CertPEM) != 0 && len(tlsConfig.KeyPEM) != 0 {
		tlsCert, err := tls.X509KeyPair(tlsConfig.CertPEM, tlsConfig.KeyPEM)
		if err != nil {
			return nil, err
		}
		tlsClientConfig.Certificates = []tls.Certificate{tlsCert}
	} else if len(tlsConfig.CertPEM) != 0 || len(tlsConfig.KeyPEM) != 0 {
		return nil, fmt.Errorf("both client cert and client key must be provided")
	}

	if tlsConfig.CertFile != "" && tlsConfig.KeyFile != "" {
		tlsCert, err := tls.LoadX509KeyPair(tlsConfig.CertFile, tlsConfig.KeyFile)
		if err != nil {
			return nil, err
		}
		tlsClientConfig.Certificates = []tls.Certificate{tlsCert}
	} else if tlsConfig.CertFile != "" || tlsConfig.KeyFile != "" {
		return nil, fmt.Errorf("both client cert and client key must be provided")
	}

	if tlsConfig.CAFile != "" || tlsConfig.CAPath != "" || len(tlsConfig.CAPem) != 0 {
		rootConfig := &rootcerts.Config{
			CAFile:        tlsConfig.CAFile,
			CAPath:        tlsConfig.CAPath,
			CACertificate: tlsConfig.CAPem,
		}
		if err := rootcerts.ConfigureTLS(tlsClientConfig, rootConfig); err != nil {
			return nil, err
		}
	}

	return tlsClientConfig, nil
}

func (c *Config) GenerateEnv() []string {
	env := make([]string, 0, 10)

	env = append(env,
		fmt.Sprintf("%s=%s", HTTPAddrEnvName, c.Address),
		fmt.Sprintf("%s=%s", HTTPTokenEnvName, c.Token),
		fmt.Sprintf("%s=%s", HTTPTokenFileEnvName, c.TokenFile),
		fmt.Sprintf("%s=%t", HTTPSSLEnvName, c.Scheme == "https"),
		fmt.Sprintf("%s=%s", HTTPCAFile, c.TLSConfig.CAFile),
		fmt.Sprintf("%s=%s", HTTPCAPath, c.TLSConfig.CAPath),
		fmt.Sprintf("%s=%s", HTTPClientCert, c.TLSConfig.CertFile),
		fmt.Sprintf("%s=%s", HTTPClientKey, c.TLSConfig.KeyFile),
		fmt.Sprintf("%s=%s", HTTPTLSServerName, c.TLSConfig.Address),
		fmt.Sprintf("%s=%t", HTTPSSLVerifyEnvName, !c.TLSConfig.InsecureSkipVerify))

	if c.HttpAuth != nil {
		env = append(env, fmt.Sprintf("%s=%s:%s", HTTPAuthEnvName, c.HttpAuth.Username, c.HttpAuth.Password))
	} else {
		env = append(env, fmt.Sprintf("%s=", HTTPAuthEnvName))
	}

	return env
}

// Client provides a client to the Consul API
type Client struct {
	modifyLock sync.RWMutex
	headers    http.Header

	config Config
}

// Headers gets the current set of headers used for requests. This returns a
// copy; to modify it call AddHeader or SetHeaders.
func (c *Client) Headers() http.Header {
	c.modifyLock.RLock()
	defer c.modifyLock.RUnlock()

	if c.headers == nil {
		return nil
	}

	ret := make(http.Header)
	for k, v := range c.headers {
		for _, val := range v {
			ret[k] = append(ret[k], val)
		}
	}

	return ret
}

// AddHeader allows a single header key/value pair to be added
// in a race-safe fashion.
func (c *Client) AddHeader(key, value string) {
	c.modifyLock.Lock()
	defer c.modifyLock.Unlock()
	c.headers.Add(key, value)
}

// SetHeaders clears all previous headers and uses only the given
// ones going forward.
func (c *Client) SetHeaders(headers http.Header) {
	c.modifyLock.Lock()
	defer c.modifyLock.Unlock()
	c.headers = headers
}

// NewClient returns a new client
func NewClient(config *Config) (*Client, error) {
	// bootstrap the config
	defConfig := DefaultConfig()

	if config.Address == "" {
		config.Address = defConfig.Address
	}

	if config.Scheme == "" {
		config.Scheme = defConfig.Scheme
	}

	if config.Transport == nil {
		config.Transport = defConfig.Transport
	}

	if config.TLSConfig.Address == "" {
		config.TLSConfig.Address = defConfig.TLSConfig.Address
	}

	if config.TLSConfig.CAFile == "" {
		config.TLSConfig.CAFile = defConfig.TLSConfig.CAFile
	}

	if config.TLSConfig.CAPath == "" {
		config.TLSConfig.CAPath = defConfig.TLSConfig.CAPath
	}

	if config.TLSConfig.CertFile == "" {
		config.TLSConfig.CertFile = defConfig.TLSConfig.CertFile
	}

	if config.TLSConfig.KeyFile == "" {
		config.TLSConfig.KeyFile = defConfig.TLSConfig.KeyFile
	}

	if !config.TLSConfig.InsecureSkipVerify {
		config.TLSConfig.InsecureSkipVerify = defConfig.TLSConfig.InsecureSkipVerify
	}

	if config.HttpClient == nil {
		var err error
		config.HttpClient, err = NewHttpClient(config.Transport, config.TLSConfig)
		if err != nil {
			return nil, err
		}
	}

	if config.Namespace == "" {
		config.Namespace = defConfig.Namespace
	}

	if config.Partition == "" {
		config.Partition = defConfig.Partition
	}

	parts := strings.SplitN(config.Address, "://", 2)
	if len(parts) == 2 {
		switch parts[0] {
		case "http":
			// Never revert to http if TLS was explicitly requested.
		case "https":
			config.Scheme = "https"
		case "unix":
			trans := cleanhttp.DefaultTransport()
			trans.DialContext = func(_ context.Context, _, _ string) (net.Conn, error) {
				return net.Dial("unix", parts[1])
			}
			httpClient, err := NewHttpClient(trans, config.TLSConfig)
			if err != nil {
				return nil, err
			}
			config.HttpClient = httpClient
		default:
			return nil, fmt.Errorf("Unknown protocol scheme: %s", parts[0])
		}
		config.Address = parts[1]

		// separate out a reverse proxy prefix, if it is present.
		// NOTE: Rewriting this code to use url.Parse() instead of
		// strings.SplitN() breaks existing test cases.
		switch parts[0] {
		case "http", "https":
			parts := strings.SplitN(parts[1], "/", 2)
			if len(parts) == 2 {
				config.Address = parts[0]
				config.PathPrefix = "/" + parts[1]
			}
		}
	}

	// If the TokenFile is set, always use that, even if a Token is configured.
	// This is because when TokenFile is set it is read into the Token field.
	// We want any derived clients to have to re-read the token file.
	// The precedence of ACL token should be:
	// 1. -token-file cli option
	// 2. -token cli option
	// 3. CONSUL_HTTP_TOKEN_FILE environment variable
	// 4. CONSUL_HTTP_TOKEN environment variable
	if config.TokenFile != "" && config.TokenFile != defConfig.TokenFile {
		data, err := os.ReadFile(config.TokenFile)
		if err != nil {
			return nil, fmt.Errorf("Error loading token file %s : %s", config.TokenFile, err)
		}

		if token := strings.TrimSpace(string(data)); token != "" {
			config.Token = token
		}
	} else if config.Token != "" && defConfig.Token != config.Token {
		// Fall through
	} else if defConfig.TokenFile != "" {
		data, err := os.ReadFile(defConfig.TokenFile)
		if err != nil {
			return nil, fmt.Errorf("Error loading token file %s : %s", defConfig.TokenFile, err)
		}

		if token := strings.TrimSpace(string(data)); token != "" {
			config.Token = token
			config.TokenFile = defConfig.TokenFile
		}
	} else {
		config.Token = defConfig.Token
	}
	return &Client{config: *config, headers: make(http.Header)}, nil
}

// NewHttpClient returns an http client configured with the given Transport and TLS
// config.
func NewHttpClient(transport *http.Transport, tlsConf TLSConfig) (*http.Client, error) {
	client := &http.Client{
		Transport: transport,
	}

	// TODO (slackpad) - Once we get some run time on the HTTP/2 support we
	// should turn it on by default if TLS is enabled. We would basically
	// just need to call http2.ConfigureTransport(transport) here. We also
	// don't want to introduce another external dependency on
	// golang.org/x/net/http2 at this time. For a complete recipe for how
	// to enable HTTP/2 support on a transport suitable for the API client
	// library see agent/http_test.go:TestHTTPServer_H2.

	if transport.TLSClientConfig == nil {
		tlsClientConfig, err := SetupTLSConfig(&tlsConf)

		if err != nil {
			return nil, err
		}

		transport.TLSClientConfig = tlsClientConfig
	}

	return client, nil
}

// request is used to help build up a request
type request struct {
	config *Config
	method string
	url    *url.URL
	params url.Values
	body   io.Reader
	header http.Header
	obj    interface{}
	ctx    context.Context
}

// setQueryOptions is used to annotate the request with
// additional query options
func (r *request) setQueryOptions(q *QueryOptions) {
	if q == nil {
		return
	}
	if q.Namespace != "" {
		// For backwards-compatibility with existing tests,
		// use the short-hand query param name "ns"
		// rather than the alternative long-hand "namespace"
		r.params.Set("ns", q.Namespace)
	}
	if q.Partition != "" {
		// For backwards-compatibility with existing tests,
		// use the long-hand query param name "partition"
		// rather than the alternative short-hand "ap"
		r.params.Set("partition", q.Partition)
	}
	if q.SamenessGroup != "" {
		// For backwards-compatibility with existing tests,
		// use the long-hand query param name "sameness-group"
		// rather than the alternative short-hand "sg"
		r.params.Set("sameness-group", q.SamenessGroup)
	}
	if q.Datacenter != "" {
		// For backwards-compatibility with existing tests,
		// use the short-hand query param name "dc"
		// rather than the alternative long-hand "datacenter"
		r.params.Set("dc", q.Datacenter)
	}
	if q.Peer != "" {
		r.params.Set("peer", q.Peer)
	}
	if q.AllowStale {
		r.params.Set("stale", "")
	}
	if q.RequireConsistent {
		r.params.Set("consistent", "")
	}
	if q.WaitIndex != 0 {
		r.params.Set("index", strconv.FormatUint(q.WaitIndex, 10))
	}
	if q.WaitTime != 0 {
		r.params.Set("wait", durToMsec(q.WaitTime))
	}
	if q.WaitHash != "" {
		r.params.Set("hash", q.WaitHash)
	}
	if q.Token != "" {
		r.header.Set("X-Consul-Token", q.Token)
	}
	if q.Near != "" {
		r.params.Set("near", q.Near)
	}
	if q.Filter != "" {
		r.params.Set("filter", q.Filter)
	}
	if len(q.NodeMeta) > 0 {
		for key, value := range q.NodeMeta {
			r.params.Add("node-meta", key+":"+value)
		}
	}
	if q.RelayFactor != 0 {
		r.params.Set("relay-factor", strconv.Itoa(int(q.RelayFactor)))
	}
	if q.LocalOnly {
		r.params.Set("local-only", fmt.Sprintf("%t", q.LocalOnly))
	}
	if q.Connect {
		r.params.Set("connect", "true")
	}
	if q.UseCache && !q.RequireConsistent {
		r.params.Set("cached", "")

		cc := []string{}
		if q.MaxAge > 0 {
			cc = append(cc, fmt.Sprintf("max-age=%.0f", q.MaxAge.Seconds()))
		}
		if q.StaleIfError > 0 {
			cc = append(cc, fmt.Sprintf("stale-if-error=%.0f", q.StaleIfError.Seconds()))
		}
		if len(cc) > 0 {
			r.header.Set("Cache-Control", strings.Join(cc, ", "))
		}
	}
	if q.MergeCentralConfig {
		r.params.Set("merge-central-config", "")
	}
	if q.Global {
		r.params.Set("global", "")
	}

	r.ctx = q.ctx
}

// durToMsec converts a duration to a millisecond specified string. If the
// user selected a positive value that rounds to 0 ms, then we will use 1 ms
// so they get a short delay, otherwise Consul will translate the 0 ms into
// a huge default delay.
func durToMsec(dur time.Duration) string {
	ms := dur / time.Millisecond
	if dur > 0 && ms == 0 {
		ms = 1
	}
	return fmt.Sprintf("%dms", ms)
}

// serverError is a string we look for to detect 500 errors.
const serverError = "Unexpected response code: 500"

// IsRetryableError returns true for 500 errors from the Consul servers, and
// network connection errors. These are usually retryable at a later time.
// This applies to reads but NOT to writes. This may return true for errors
// on writes that may have still gone through, so do not use this to retry
// any write operations.
func IsRetryableError(err error) bool {
	if err == nil {
		return false
	}

	if _, ok := err.(net.Error); ok {
		return true
	}

	// TODO (slackpad) - Make a real error type here instead of using
	// a string check.
	return strings.Contains(err.Error(), serverError)
}

// setWriteOptions is used to annotate the request with
// additional write options
func (r *request) setWriteOptions(q *WriteOptions) {
	if q == nil {
		return
	}
	// For backwards-compatibility, continue to use the shorthand "ns"
	// rather than "namespace"
	if q.Namespace != "" {
		r.params.Set("ns", q.Namespace)
	}
	if q.Partition != "" {
		r.params.Set("partition", q.Partition)
	}
	// For backwards-compatibility, continue to use the shorthand "dc"
	// rather than "datacenter"
	if q.Datacenter != "" {
		r.params.Set("dc", q.Datacenter)
	}
	if q.Token != "" {
		r.header.Set("X-Consul-Token", q.Token)
	}
	if q.RelayFactor != 0 {
		r.params.Set("relay-factor", strconv.Itoa(int(q.RelayFactor)))
	}
	r.ctx = q.ctx
}

// toHTTP converts the request to an HTTP request
func (r *request) toHTTP() (*http.Request, error) {
	// Encode the query parameters
	r.url.RawQuery = r.params.Encode()

	// Check if we should encode the body
	if r.body == nil && r.obj != nil {
		b, err := encodeBody(r.obj)
		if err != nil {
			return nil, err
		}
		r.body = b
	}

	// Create the HTTP request
	req, err := http.NewRequest(r.method, r.url.RequestURI(), r.body)
	if err != nil {
		return nil, err
	}

	// validate that socket communications that do not use the host, detect
	// slashes in the host name and replace it with local host.
	// this is required since go started validating req.host in 1.20.6 and 1.19.11.
	// prior to that they would strip out the slashes for you.  They removed that
	// behavior and added more strict validation as part of a CVE.
	// This issue is being tracked by the Go team:
	// https://github.com/golang/go/issues/61431
	// If there is a resolution in this issue, we will remove this code.
	// In the time being, this is the accepted workaround.
	if strings.HasPrefix(r.url.Host, "/") {
		r.url.Host = "localhost"
	}

	req.URL.Host = r.url.Host
	req.URL.Scheme = r.url.Scheme
	req.Host = r.url.Host
	req.Header = r.header

	// Content-Type must always be set when a body is present
	// See https://github.com/hashicorp/consul/issues/10011
	if req.Body != nil && req.Header.Get("Content-Type") == "" {
		req.Header.Set("Content-Type", "application/json")
	}

	// Setup auth
	if r.config.HttpAuth != nil {
		req.SetBasicAuth(r.config.HttpAuth.Username, r.config.HttpAuth.Password)
	}
	if r.ctx != nil {
		return req.WithContext(r.ctx), nil
	}

	return req, nil
}

// newRequest is used to create a new request
func (c *Client) newRequest(method, path string) *request {
	r := &request{
		config: &c.config,
		method: method,
		url: &url.URL{
			Scheme: c.config.Scheme,
			Host:   c.config.Address,
			Path:   c.config.PathPrefix + path,
		},
		params: make(map[string][]string),
		header: c.Headers(),
	}

	if c.config.Datacenter != "" {
		r.params.Set("dc", c.config.Datacenter)
	}
	if c.config.Namespace != "" {
		r.params.Set("ns", c.config.Namespace)
	}
	if c.config.Partition != "" {
		r.params.Set("partition", c.config.Partition)
	}
	if c.config.WaitTime != 0 {
		r.params.Set("wait", durToMsec(r.config.WaitTime))
	}
	if c.config.Token != "" {
		r.header.Set("X-Consul-Token", r.config.Token)
	}
	return r
}

// doRequest runs a request with our client
func (c *Client) doRequest(r *request) (time.Duration, *http.Response, error) {
	req, err := r.toHTTP()
	if err != nil {
		return 0, nil, err
	}

	contentType := GetContentType(req)

	if req != nil {
		req.Header.Set(contentTypeHeader, contentType)
	}

	start := time.Now()
	resp, err := c.config.HttpClient.Do(req)

	if resp != nil {
		respContentType := resp.Header.Get(contentTypeHeader)
		if respContentType == "" || respContentType != contentType {
			resp.Header.Set(contentTypeHeader, contentType)
		}
	}

	diff := time.Since(start)
	return diff, resp, err
}

// Query is used to do a GET request against an endpoint
// and deserialize the response into an interface using
// standard Consul conventions.
func (c *Client) query(endpoint string, out interface{}, q *QueryOptions) (*QueryMeta, error) {
	r := c.newRequest("GET", endpoint)
	r.setQueryOptions(q)
	rtt, resp, err := c.doRequest(r)
	if err != nil {
		return nil, err
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return nil, err
	}
	qm := &QueryMeta{}
	parseQueryMeta(resp, qm)
	qm.RequestTime = rtt

	if err := decodeBody(resp, out); err != nil {
		return nil, err
	}
	return qm, nil
}

// write is used to do a PUT request against an endpoint
// and serialize/deserialized using the standard Consul conventions.
func (c *Client) write(endpoint string, in, out interface{}, q *WriteOptions) (*WriteMeta, error) {
	r := c.newRequest("PUT", endpoint)
	r.setWriteOptions(q)
	r.obj = in
	rtt, resp, err := c.doRequest(r)
	if err != nil {
		return nil, err
	}
	defer closeResponseBody(resp)
	if err := requireOK(resp); err != nil {
		return nil, err
	}

	wm := &WriteMeta{RequestTime: rtt}
	if out != nil {
		if err := decodeBody(resp, &out); err != nil {
			return nil, err
		}
	} else if _, err := io.ReadAll(resp.Body); err != nil {
		return nil, err
	}
	return wm, nil
}

// delete is used to do a DELETE request against an endpoint
func (c *Client) delete(endpoint string, q *QueryOptions) (*WriteMeta, error) {
	r := c.newRequest("DELETE", endpoint)
	r.setQueryOptions(q)
	rtt, resp, err := c.doRequest(r)
	if err != nil {
		return nil, err
	}
	defer closeResponseBody(resp)
	if err = requireHttpCodes(resp, 204, 200); err != nil {
		return nil, err
	}

	wm := &WriteMeta{RequestTime: rtt}
	return wm, nil
}

// parseQueryMeta is used to help parse query meta-data
//
// TODO(rb): bug? the error from this function is never handled
func parseQueryMeta(resp *http.Response, q *QueryMeta) error {
	header := resp.Header

	// Parse the X-Consul-Index (if it's set - hash based blocking queries don't
	// set this)
	if indexStr := header.Get("X-Consul-Index"); indexStr != "" {
		index, err := strconv.ParseUint(indexStr, 10, 64)
		if err != nil {
			return fmt.Errorf("Failed to parse X-Consul-Index: %v", err)
		}
		q.LastIndex = index
	}
	q.LastContentHash = header.Get("X-Consul-ContentHash")

	// Parse the X-Consul-LastContact
	last, err := strconv.ParseUint(header.Get("X-Consul-LastContact"), 10, 64)
	if err != nil {
		return fmt.Errorf("Failed to parse X-Consul-LastContact: %v", err)
	}
	if last > math.MaxInt64 {
		return fmt.Errorf("X-Consul-LastContact Header value is out of range: %d", last)
	}
	q.LastContact = time.Duration(last) * time.Millisecond

	// Parse the X-Consul-KnownLeader
	switch header.Get("X-Consul-KnownLeader") {
	case "true":
		q.KnownLeader = true
	default:
		q.KnownLeader = false
	}

	// Parse X-Consul-Translate-Addresses
	switch header.Get("X-Consul-Translate-Addresses") {
	case "true":
		q.AddressTranslationEnabled = true
	default:
		q.AddressTranslationEnabled = false
	}

	// Parse X-Consul-Default-ACL-Policy
	switch v := header.Get("X-Consul-Default-ACL-Policy"); v {
	case "allow", "deny":
		q.DefaultACLPolicy = v
	}

	// Parse the X-Consul-Results-Filtered-By-ACLs
	switch header.Get("X-Consul-Results-Filtered-By-ACLs") {
	case "true":
		q.ResultsFilteredByACLs = true
	default:
		q.ResultsFilteredByACLs = false
	}

	// Parse Cache info
	if cacheStr := header.Get("X-Cache"); cacheStr != "" {
		q.CacheHit = strings.EqualFold(cacheStr, "HIT")
	}
	if ageStr := header.Get("Age"); ageStr != "" {
		age, err := strconv.ParseUint(ageStr, 10, 64)
		if err != nil {
			return fmt.Errorf("Failed to parse Age Header: %v", err)
		}
		if age > math.MaxInt64 {
			return fmt.Errorf("Age Header value is out of range: %d", last)
		}
		q.CacheAge = time.Duration(age) * time.Second
	}

	switch v := header.Get("X-Consul-Query-Backend"); v {
	case QueryBackendStreaming, QueryBackendBlockingQuery:
		q.QueryBackend = v
	}
	return nil
}

// decodeBody is used to JSON decode a body
func decodeBody(resp *http.Response, out interface{}) error {
	dec := json.NewDecoder(resp.Body)
	return dec.Decode(out)
}

// encodeBody is used to encode a request body
func encodeBody(obj interface{}) (io.Reader, error) {
	buf := bytes.NewBuffer(nil)
	enc := json.NewEncoder(buf)
	if err := enc.Encode(obj); err != nil {
		return nil, err
	}
	return buf, nil
}

// requireOK is used to wrap doRequest and check for a 200
func requireOK(resp *http.Response) error {
	return requireHttpCodes(resp, 200)
}

// requireHttpCodes checks for the "allowable" http codes for a response
func requireHttpCodes(resp *http.Response, httpCodes ...int) error {
	// if there is an http code that we require, return w no error
	for _, httpCode := range httpCodes {
		if resp.StatusCode == httpCode {
			return nil
		}
	}

	// if we reached here, then none of the http codes in resp matched any that we expected
	// so err out
	return generateUnexpectedResponseCodeError(resp)
}

// closeResponseBody reads resp.Body until EOF, and then closes it. The read
// is necessary to ensure that the http.Client's underlying RoundTripper is able
// to re-use the TCP connection. See godoc on net/http.Client.Do.
func closeResponseBody(resp *http.Response) error {
	_, _ = io.Copy(io.Discard, resp.Body)
	return resp.Body.Close()
}

func (req *request) filterQuery(filter string) {
	if filter == "" {
		return
	}

	req.params.Set("filter", filter)
}

// generateUnexpectedResponseCodeError consumes the rest of the body, closes
// the body stream and generates an error indicating the status code was
// unexpected.
func generateUnexpectedResponseCodeError(resp *http.Response) error {
	var buf bytes.Buffer
	io.Copy(&buf, resp.Body)
	closeResponseBody(resp)

	trimmed := strings.TrimSpace(string(buf.Bytes()))
	return StatusError{Code: resp.StatusCode, Body: trimmed}
}

func requireNotFoundOrOK(resp *http.Response) (bool, *http.Response, error) {
	switch resp.StatusCode {
	case 200:
		return true, resp, nil
	case 404:
		return false, resp, nil
	default:
		return false, nil, generateUnexpectedResponseCodeError(resp)
	}
}
