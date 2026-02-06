// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package api

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/tls"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"os"
	"path"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode"

	"github.com/hashicorp/errwrap"
	"github.com/hashicorp/go-cleanhttp"
	"github.com/hashicorp/go-retryablehttp"
	"github.com/hashicorp/go-rootcerts"
	"github.com/hashicorp/go-secure-stdlib/parseutil"
	"github.com/hashicorp/go-secure-stdlib/strutil"
	"golang.org/x/net/http2"
	"golang.org/x/time/rate"
)

const (
	EnvVaultAddress          = "VAULT_ADDR"
	EnvVaultAgentAddr        = "VAULT_AGENT_ADDR"
	EnvVaultCACert           = "VAULT_CACERT"
	EnvVaultCACertBytes      = "VAULT_CACERT_BYTES"
	EnvVaultCAPath           = "VAULT_CAPATH"
	EnvVaultClientCert       = "VAULT_CLIENT_CERT"
	EnvVaultClientKey        = "VAULT_CLIENT_KEY"
	EnvVaultClientTimeout    = "VAULT_CLIENT_TIMEOUT"
	EnvVaultHeaders          = "VAULT_HEADERS"
	EnvVaultSRVLookup        = "VAULT_SRV_LOOKUP"
	EnvVaultSkipVerify       = "VAULT_SKIP_VERIFY"
	EnvVaultNamespace        = "VAULT_NAMESPACE"
	EnvVaultTLSServerName    = "VAULT_TLS_SERVER_NAME"
	EnvVaultWrapTTL          = "VAULT_WRAP_TTL"
	EnvVaultMaxRetries       = "VAULT_MAX_RETRIES"
	EnvVaultToken            = "VAULT_TOKEN"
	EnvVaultMFA              = "VAULT_MFA"
	EnvRateLimit             = "VAULT_RATE_LIMIT"
	EnvHTTPProxy             = "VAULT_HTTP_PROXY"
	EnvVaultProxyAddr        = "VAULT_PROXY_ADDR"
	EnvVaultDisableRedirects = "VAULT_DISABLE_REDIRECTS"
	HeaderIndex              = "X-Vault-Index"
	HeaderForward            = "X-Vault-Forward"
	HeaderInconsistent       = "X-Vault-Inconsistent"

	// NamespaceHeaderName is the header set to specify which namespace the
	// request is indented for.
	NamespaceHeaderName = "X-Vault-Namespace"

	// AuthHeaderName is the name of the header containing the token.
	AuthHeaderName = "X-Vault-Token"

	// RequestHeaderName is the name of the header used by the Agent for
	// SSRF protection.
	RequestHeaderName = "X-Vault-Request"

	TLSErrorString = "This error usually means that the server is running with TLS disabled\n" +
		"but the client is configured to use TLS. Please either enable TLS\n" +
		"on the server or run the client with -address set to an address\n" +
		"that uses the http protocol:\n\n" +
		"    vault <command> -address http://<address>\n\n" +
		"You can also set the VAULT_ADDR environment variable:\n\n\n" +
		"    VAULT_ADDR=http://<address> vault <command>\n\n" +
		"where <address> is replaced by the actual address to the server."
)

// Deprecated values
const (
	EnvVaultAgentAddress = "VAULT_AGENT_ADDR"
	EnvVaultInsecure     = "VAULT_SKIP_VERIFY"

	DefaultAddress = "https://127.0.0.1:8200"
)

// WrappingLookupFunc is a function that, given an HTTP verb and a path,
// returns an optional string duration to be used for response wrapping (e.g.
// "15s", or simply "15"). The path will not begin with "/v1/" or "v1/" or "/",
// however, end-of-path forward slashes are not trimmed, so must match your
// called path precisely. Response wrapping will only be used when the return
// value is not the empty string.
type WrappingLookupFunc func(operation, path string) string

// Config is used to configure the creation of the client.
type Config struct {
	modifyLock sync.RWMutex

	// Address is the address of the Vault server. This should be a complete
	// URL such as "http://vault.example.com". If you need a custom SSL
	// cert or want to enable insecure mode, you need to specify a custom
	// HttpClient.
	Address string

	// AgentAddress is the address of the local Vault agent. This should be a
	// complete URL such as "http://vault.example.com".
	AgentAddress string

	// HttpClient is the HTTP client to use. Vault sets sane defaults for the
	// http.Client and its associated http.Transport created in DefaultConfig.
	// If you must modify Vault's defaults, it is suggested that you start with
	// that client and modify as needed rather than start with an empty client
	// (or http.DefaultClient).
	HttpClient *http.Client

	// MinRetryWait controls the minimum time to wait before retrying when a 5xx
	// error occurs. Defaults to 1000 milliseconds.
	MinRetryWait time.Duration

	// MaxRetryWait controls the maximum time to wait before retrying when a 5xx
	// error occurs. Defaults to 1500 milliseconds.
	MaxRetryWait time.Duration

	// MaxRetries controls the maximum number of times to retry when a 5xx
	// error occurs. Set to 0 to disable retrying. Defaults to 2 (for a total
	// of three tries).
	MaxRetries int

	// Timeout, given a non-negative value, will apply the request timeout
	// to each request function unless an earlier deadline is passed to the
	// request function through context.Context. Note that this timeout is
	// not applicable to Logical().ReadRaw* (raw response) functions.
	// Defaults to 60 seconds.
	Timeout time.Duration

	// If there is an error when creating the configuration, this will be the
	// error
	Error error

	// The Backoff function to use; a default is used if not provided
	Backoff retryablehttp.Backoff

	// The CheckRetry function to use; a default is used if not provided
	CheckRetry retryablehttp.CheckRetry

	// Logger is the leveled logger to provide to the retryable HTTP client.
	Logger retryablehttp.LeveledLogger

	// Limiter is the rate limiter used by the client.
	// If this pointer is nil, then there will be no limit set.
	// In contrast, if this pointer is set, even to an empty struct,
	// then that limiter will be used. Note that an empty Limiter
	// is equivalent blocking all events.
	Limiter *rate.Limiter

	// OutputCurlString causes the actual request to return an error of type
	// *OutputStringError. Type asserting the error message will allow
	// fetching a cURL-compatible string for the operation.
	//
	// Note: It is not thread-safe to set this and make concurrent requests
	// with the same client. Cloning a client will not clone this value.
	OutputCurlString bool

	// OutputPolicy causes the actual request to return an error of type
	// *OutputPolicyError. Type asserting the error message will display
	// an example of the required policy HCL needed for the operation.
	//
	// Note: It is not thread-safe to set this and make concurrent requests
	// with the same client. Cloning a client will not clone this value.
	OutputPolicy bool

	// curlCACert, curlCAPath, curlClientCert and curlClientKey are used to keep
	// track of the name of the TLS certs and keys when OutputCurlString is set.
	// Cloning a client will also not clone those values.
	curlCACert, curlCAPath        string
	curlClientCert, curlClientKey string

	// SRVLookup enables the client to lookup the host through DNS SRV lookup
	SRVLookup bool

	// CloneHeaders ensures that the source client's headers are copied to
	// its clone.
	CloneHeaders bool

	// CloneToken from parent.
	CloneToken bool

	// CloneTLSConfig from parent (tls.Config).
	CloneTLSConfig bool

	// ReadYourWrites ensures isolated read-after-write semantics by
	// providing discovered cluster replication states in each request.
	// The shared state is automatically propagated to all Client clones.
	//
	// Note: Careful consideration should be made prior to enabling this setting
	// since there will be a performance penalty paid upon each request.
	// This feature requires Enterprise server-side.
	ReadYourWrites bool

	// DisableRedirects when set to true, will prevent the client from
	// automatically following a (single) redirect response to its initial
	// request. This behavior may be desirable if using Vault CLI on the server
	// side.
	//
	// Note: Disabling redirect following behavior could cause issues with
	// commands such as 'vault operator raft snapshot' as this redirects to the
	// primary node.
	DisableRedirects bool
	clientTLSConfig  *tls.Config
}

// TLSConfig contains the parameters needed to configure TLS on the HTTP client
// used to communicate with Vault.
type TLSConfig struct {
	// CACert is the path to a PEM-encoded CA cert file to use to verify the
	// Vault server SSL certificate. It takes precedence over CACertBytes
	// and CAPath.
	CACert string

	// CACertBytes is a PEM-encoded certificate or bundle. It takes precedence
	// over CAPath.
	CACertBytes []byte

	// CAPath is the path to a directory of PEM-encoded CA cert files to verify
	// the Vault server SSL certificate.
	CAPath string

	// ClientCert is the path to the certificate for Vault communication
	ClientCert string

	// ClientKey is the path to the private key for Vault communication
	ClientKey string

	// TLSServerName, if set, is used to set the SNI host when connecting via
	// TLS.
	TLSServerName string

	// Insecure enables or disables SSL verification
	Insecure bool
}

// DefaultConfig returns a default configuration for the client. It is
// safe to modify the return value of this function.
//
// The default Address is https://127.0.0.1:8200, but this can be overridden by
// setting the `VAULT_ADDR` environment variable.
//
// If an error is encountered, the Error field on the returned *Config will be populated with the specific error.
func DefaultConfig() *Config {
	config := &Config{
		Address:      DefaultAddress,
		HttpClient:   cleanhttp.DefaultPooledClient(),
		Timeout:      time.Second * 60,
		MinRetryWait: time.Millisecond * 1000,
		MaxRetryWait: time.Millisecond * 1500,
		MaxRetries:   2,
		Backoff:      retryablehttp.LinearJitterBackoff,
	}

	transport := config.HttpClient.Transport.(*http.Transport)
	transport.TLSHandshakeTimeout = 10 * time.Second
	transport.TLSClientConfig = &tls.Config{
		MinVersion: tls.VersionTLS12,
	}
	if err := http2.ConfigureTransport(transport); err != nil {
		config.Error = err
		return config
	}

	if err := config.ReadEnvironment(); err != nil {
		config.Error = err
		return config
	}

	// Ensure redirects are not automatically followed
	// Note that this is sane for the API client as it has its own
	// redirect handling logic (and thus also for command/meta),
	// but in e.g. http_test actual redirect handling is necessary
	config.HttpClient.CheckRedirect = func(req *http.Request, via []*http.Request) error {
		// Returning this value causes the Go net library to not close the
		// response body and to nil out the error. Otherwise retry clients may
		// try three times on every redirect because it sees an error from this
		// function (to prevent redirects) passing through to it.
		return http.ErrUseLastResponse
	}

	return config
}

// configureTLS is a lock free version of ConfigureTLS that can be used in
// ReadEnvironment where the lock is already hold
func (c *Config) configureTLS(t *TLSConfig) error {
	if c.HttpClient == nil {
		c.HttpClient = DefaultConfig().HttpClient
	}

	transport, ok := c.HttpClient.Transport.(*http.Transport)
	if !ok {
		return fmt.Errorf(
			"unsupported HTTPClient transport type %T", c.HttpClient.Transport)
	}

	clientTLSConfig := transport.TLSClientConfig

	var clientCert tls.Certificate
	foundClientCert := false

	switch {
	case t.ClientCert != "" && t.ClientKey != "":
		var err error
		clientCert, err = tls.LoadX509KeyPair(t.ClientCert, t.ClientKey)
		if err != nil {
			return err
		}
		foundClientCert = true
		c.curlClientCert = t.ClientCert
		c.curlClientKey = t.ClientKey
	case t.ClientCert != "" || t.ClientKey != "":
		return fmt.Errorf("both client cert and client key must be provided")
	}

	if t.CACert != "" || len(t.CACertBytes) != 0 || t.CAPath != "" {
		c.curlCACert = t.CACert
		c.curlCAPath = t.CAPath
		rootConfig := &rootcerts.Config{
			CAFile:        t.CACert,
			CACertificate: t.CACertBytes,
			CAPath:        t.CAPath,
		}
		if err := rootcerts.ConfigureTLS(clientTLSConfig, rootConfig); err != nil {
			return err
		}
	}

	if t.Insecure {
		clientTLSConfig.InsecureSkipVerify = true
	}

	if foundClientCert {
		// We use this function to ignore the server's preferential list of
		// CAs, otherwise any CA used for the cert auth backend must be in the
		// server's CA pool
		clientTLSConfig.GetClientCertificate = func(*tls.CertificateRequestInfo) (*tls.Certificate, error) {
			return &clientCert, nil
		}
	}

	if t.TLSServerName != "" {
		clientTLSConfig.ServerName = t.TLSServerName
	}
	c.clientTLSConfig = clientTLSConfig

	return nil
}

func (c *Config) TLSConfig() *tls.Config {
	c.modifyLock.RLock()
	defer c.modifyLock.RUnlock()
	return c.clientTLSConfig.Clone()
}

// ConfigureTLS takes a set of TLS configurations and applies those to the
// HTTP client.
func (c *Config) ConfigureTLS(t *TLSConfig) error {
	c.modifyLock.Lock()
	defer c.modifyLock.Unlock()

	return c.configureTLS(t)
}

// ReadEnvironment reads configuration information from the environment. If
// there is an error, no configuration value is updated.
func (c *Config) ReadEnvironment() error {
	var envAddress string
	var envAgentAddress string
	var envCACert string
	var envCACertBytes []byte
	var envCAPath string
	var envClientCert string
	var envClientKey string
	var envClientTimeout time.Duration
	var envInsecure bool
	var envTLSServerName string
	var envMaxRetries *uint64
	var envSRVLookup bool
	var limit *rate.Limiter
	var envVaultProxy string
	var envVaultDisableRedirects bool

	// Parse the environment variables
	if v := os.Getenv(EnvVaultAddress); v != "" {
		envAddress = v
	}
	if v := os.Getenv(EnvVaultAgentAddr); v != "" {
		envAgentAddress = v
	}
	if v := os.Getenv(EnvVaultMaxRetries); v != "" {
		maxRetries, err := strconv.ParseUint(v, 10, 32)
		if err != nil {
			return err
		}
		envMaxRetries = &maxRetries
	}
	if v := os.Getenv(EnvVaultCACert); v != "" {
		envCACert = v
	}
	if v := os.Getenv(EnvVaultCACertBytes); v != "" {
		envCACertBytes = []byte(v)
	}
	if v := os.Getenv(EnvVaultCAPath); v != "" {
		envCAPath = v
	}
	if v := os.Getenv(EnvVaultClientCert); v != "" {
		envClientCert = v
	}
	if v := os.Getenv(EnvVaultClientKey); v != "" {
		envClientKey = v
	}
	if v := os.Getenv(EnvRateLimit); v != "" {
		rateLimit, burstLimit, err := parseRateLimit(v)
		if err != nil {
			return err
		}
		limit = rate.NewLimiter(rate.Limit(rateLimit), burstLimit)
	}
	if t := os.Getenv(EnvVaultClientTimeout); t != "" {
		clientTimeout, err := parseutil.ParseDurationSecond(t)
		if err != nil {
			return fmt.Errorf("could not parse %q", EnvVaultClientTimeout)
		}
		envClientTimeout = clientTimeout
	}
	if v := os.Getenv(EnvVaultSkipVerify); v != "" {
		var err error
		envInsecure, err = strconv.ParseBool(v)
		if err != nil {
			return fmt.Errorf("could not parse %s", EnvVaultSkipVerify)
		}
	}
	if v := os.Getenv(EnvVaultSRVLookup); v != "" {
		var err error
		envSRVLookup, err = strconv.ParseBool(v)
		if err != nil {
			return fmt.Errorf("could not parse %s", EnvVaultSRVLookup)
		}
	}

	if v := os.Getenv(EnvVaultTLSServerName); v != "" {
		envTLSServerName = v
	}

	if v := os.Getenv(EnvHTTPProxy); v != "" {
		envVaultProxy = v
	}

	// VAULT_PROXY_ADDR supersedes VAULT_HTTP_PROXY
	if v := os.Getenv(EnvVaultProxyAddr); v != "" {
		envVaultProxy = v
	}

	if v := os.Getenv(EnvVaultDisableRedirects); v != "" {
		var err error
		envVaultDisableRedirects, err = strconv.ParseBool(v)
		if err != nil {
			return fmt.Errorf("could not parse %s", EnvVaultDisableRedirects)
		}

		c.DisableRedirects = envVaultDisableRedirects
	}

	// Configure the HTTP clients TLS configuration.
	t := &TLSConfig{
		CACert:        envCACert,
		CACertBytes:   envCACertBytes,
		CAPath:        envCAPath,
		ClientCert:    envClientCert,
		ClientKey:     envClientKey,
		TLSServerName: envTLSServerName,
		Insecure:      envInsecure,
	}

	c.modifyLock.Lock()
	defer c.modifyLock.Unlock()

	c.SRVLookup = envSRVLookup
	c.Limiter = limit

	if err := c.configureTLS(t); err != nil {
		return err
	}

	if envAddress != "" {
		c.Address = envAddress
	}

	if envAgentAddress != "" {
		c.AgentAddress = envAgentAddress
	}

	if envMaxRetries != nil {
		c.MaxRetries = int(*envMaxRetries)
	}

	if envClientTimeout != 0 {
		c.Timeout = envClientTimeout
	}

	if envVaultProxy != "" {
		u, err := url.Parse(envVaultProxy)
		if err != nil {
			return err
		}

		transport := c.HttpClient.Transport.(*http.Transport)
		transport.Proxy = http.ProxyURL(u)
	}

	return nil
}

// ParseAddress transforms the provided address into a url.URL and handles
// the case of Unix domain sockets by setting the DialContext in the
// configuration's HttpClient.Transport. This function must be called with
// c.modifyLock held for write access.
func (c *Config) ParseAddress(address string) (*url.URL, error) {
	u, err := url.Parse(address)
	if err != nil {
		return nil, err
	}

	previousAddress := c.Address
	c.Address = address

	if strings.HasPrefix(address, "unix://") {
		// When the address begins with unix://, always change the transport's
		// DialContext (to match previous behaviour)
		socket := strings.TrimPrefix(address, "unix://")

		if transport, ok := c.HttpClient.Transport.(*http.Transport); ok {
			transport.DialContext = func(context.Context, string, string) (net.Conn, error) {
				return net.Dial("unix", socket)
			}

			// Since the address points to a unix domain socket, the scheme in the
			// *URL would be set to `unix`. The *URL in the client is expected to
			// be pointing to the protocol used in the application layer and not to
			// the transport layer. Hence, setting the fields accordingly.
			u.Scheme = "http"
			u.Host = "localhost"
			u.Path = ""
		} else {
			return nil, fmt.Errorf("attempting to specify unix:// address with non-transport transport")
		}
	} else if strings.HasPrefix(previousAddress, "unix://") {
		// When the address being set does not begin with unix:// but the previous
		// address in the Config did, change the transport's DialContext back to
		// use the default configuration that cleanhttp uses.

		if transport, ok := c.HttpClient.Transport.(*http.Transport); ok {
			transport.DialContext = cleanhttp.DefaultPooledTransport().DialContext
		}
	}

	return u, nil
}

func parseRateLimit(val string) (rate float64, burst int, err error) {
	_, err = fmt.Sscanf(val, "%f:%d", &rate, &burst)
	if err != nil {
		rate, err = strconv.ParseFloat(val, 64)
		if err != nil {
			err = fmt.Errorf("%v was provided but incorrectly formatted", EnvRateLimit)
		}
		burst = int(rate)
	}

	return rate, burst, err
}

// Client is the client to the Vault API. Create a client with NewClient.
type Client struct {
	modifyLock            sync.RWMutex
	addr                  *url.URL
	config                *Config
	token                 string
	headers               http.Header
	wrappingLookupFunc    WrappingLookupFunc
	mfaCreds              []string
	policyOverride        bool
	requestCallbacks      []RequestCallback
	responseCallbacks     []ResponseCallback
	replicationStateStore *replicationStateStore
	hcpCookie             *http.Cookie
}

// NewClient returns a new client for the given configuration.
//
// If the configuration is nil, Vault will use configuration from
// DefaultConfig(), which is the recommended starting configuration.
//
// If the environment variable `VAULT_TOKEN` is present, the token will be
// automatically added to the client. Otherwise, you must manually call
// `SetToken()`.
func NewClient(c *Config) (*Client, error) {
	def := DefaultConfig()
	if def == nil {
		return nil, fmt.Errorf("could not create/read default configuration")
	}
	if def.Error != nil {
		return nil, errwrap.Wrapf("error encountered setting up default configuration: {{err}}", def.Error)
	}

	if c == nil {
		c = def
	}

	c.modifyLock.Lock()
	defer c.modifyLock.Unlock()

	if c.MinRetryWait == 0 {
		c.MinRetryWait = def.MinRetryWait
	}

	if c.MaxRetryWait == 0 {
		c.MaxRetryWait = def.MaxRetryWait
	}

	if c.HttpClient == nil {
		c.HttpClient = def.HttpClient
	}
	if c.HttpClient.Transport == nil {
		c.HttpClient.Transport = def.HttpClient.Transport
	}

	address := c.Address
	if c.AgentAddress != "" {
		address = c.AgentAddress
	}

	u, err := c.ParseAddress(address)
	if err != nil {
		return nil, err
	}

	client := &Client{
		addr:    u,
		config:  c,
		headers: make(http.Header),
	}

	if c.ReadYourWrites {
		client.replicationStateStore = &replicationStateStore{}
	}

	// Add the VaultRequest SSRF protection header
	client.headers[RequestHeaderName] = []string{"true"}

	if token := os.Getenv(EnvVaultToken); token != "" {
		client.token = token
	}

	if namespace := os.Getenv(EnvVaultNamespace); namespace != "" {
		client.setNamespace(namespace)
	}

	if envHeaders := os.Getenv(EnvVaultHeaders); envHeaders != "" {
		var result map[string]any
		err := json.Unmarshal([]byte(envHeaders), &result)
		if err != nil {
			return nil, fmt.Errorf("could not unmarshal environment-supplied headers")
		}
		var forbiddenHeaders []string
		for key, value := range result {
			if strings.HasPrefix(key, "X-Vault-") {
				forbiddenHeaders = append(forbiddenHeaders, key)
				continue
			}

			value, ok := value.(string)
			if !ok {
				return nil, fmt.Errorf("environment-supplied headers include non-string values")
			}
			client.AddHeader(key, value)
		}
		if len(forbiddenHeaders) > 0 {
			return nil, fmt.Errorf("failed to setup Headers[%s]: Header starting by 'X-Vault-' are for internal usage only", strings.Join(forbiddenHeaders, ", "))
		}
	}

	return client, nil
}

func (c *Client) CloneConfig() *Config {
	c.modifyLock.RLock()
	defer c.modifyLock.RUnlock()

	newConfig := DefaultConfig()
	newConfig.Address = c.config.Address
	newConfig.AgentAddress = c.config.AgentAddress
	newConfig.MinRetryWait = c.config.MinRetryWait
	newConfig.MaxRetryWait = c.config.MaxRetryWait
	newConfig.MaxRetries = c.config.MaxRetries
	newConfig.Timeout = c.config.Timeout
	newConfig.Backoff = c.config.Backoff
	newConfig.CheckRetry = c.config.CheckRetry
	newConfig.Logger = c.config.Logger
	newConfig.Limiter = c.config.Limiter
	newConfig.SRVLookup = c.config.SRVLookup
	newConfig.CloneHeaders = c.config.CloneHeaders
	newConfig.CloneToken = c.config.CloneToken
	newConfig.ReadYourWrites = c.config.ReadYourWrites
	newConfig.clientTLSConfig = c.config.clientTLSConfig

	// we specifically want a _copy_ of the client here, not a pointer to the original one
	newClient := *c.config.HttpClient
	newConfig.HttpClient = &newClient

	return newConfig
}

// SetAddress sets the address of Vault in the client. The format of address should be
// "<Scheme>://<Host>:<Port>". Setting this on a client will override the
// value of VAULT_ADDR environment variable.
func (c *Client) SetAddress(addr string) error {
	c.modifyLock.Lock()
	defer c.modifyLock.Unlock()

	parsedAddr, err := c.config.ParseAddress(addr)
	if err != nil {
		return fmt.Errorf("failed to set address: %w", err)
	}

	c.addr = parsedAddr
	return nil
}

// Address returns the Vault URL the client is configured to connect to
func (c *Client) Address() string {
	c.modifyLock.RLock()
	defer c.modifyLock.RUnlock()

	return c.addr.String()
}

func (c *Client) SetCheckRedirect(f func(*http.Request, []*http.Request) error) {
	c.modifyLock.Lock()
	defer c.modifyLock.Unlock()

	c.config.modifyLock.Lock()
	defer c.config.modifyLock.Unlock()

	c.config.HttpClient.CheckRedirect = f
}

// SetLimiter will set the rate limiter for this client.
// This method is thread-safe.
// rateLimit and burst are specified according to https://godoc.org/golang.org/x/time/rate#NewLimiter
func (c *Client) SetLimiter(rateLimit float64, burst int) {
	c.modifyLock.RLock()
	defer c.modifyLock.RUnlock()
	c.config.modifyLock.Lock()
	defer c.config.modifyLock.Unlock()

	c.config.Limiter = rate.NewLimiter(rate.Limit(rateLimit), burst)
}

func (c *Client) Limiter() *rate.Limiter {
	c.modifyLock.RLock()
	defer c.modifyLock.RUnlock()
	c.config.modifyLock.RLock()
	defer c.config.modifyLock.RUnlock()

	return c.config.Limiter
}

// SetMinRetryWait sets the minimum time to wait before retrying in the case of certain errors.
func (c *Client) SetMinRetryWait(retryWait time.Duration) {
	c.modifyLock.RLock()
	defer c.modifyLock.RUnlock()
	c.config.modifyLock.Lock()
	defer c.config.modifyLock.Unlock()

	c.config.MinRetryWait = retryWait
}

func (c *Client) MinRetryWait() time.Duration {
	c.modifyLock.RLock()
	defer c.modifyLock.RUnlock()
	c.config.modifyLock.RLock()
	defer c.config.modifyLock.RUnlock()

	return c.config.MinRetryWait
}

// SetMaxRetryWait sets the maximum time to wait before retrying in the case of certain errors.
func (c *Client) SetMaxRetryWait(retryWait time.Duration) {
	c.modifyLock.RLock()
	defer c.modifyLock.RUnlock()
	c.config.modifyLock.Lock()
	defer c.config.modifyLock.Unlock()

	c.config.MaxRetryWait = retryWait
}

func (c *Client) MaxRetryWait() time.Duration {
	c.modifyLock.RLock()
	defer c.modifyLock.RUnlock()
	c.config.modifyLock.RLock()
	defer c.config.modifyLock.RUnlock()

	return c.config.MaxRetryWait
}

// SetMaxRetries sets the number of retries that will be used in the case of certain errors
func (c *Client) SetMaxRetries(retries int) {
	c.modifyLock.RLock()
	defer c.modifyLock.RUnlock()
	c.config.modifyLock.Lock()
	defer c.config.modifyLock.Unlock()

	c.config.MaxRetries = retries
}

func (c *Client) SetMaxIdleConnections(idle int) {
	c.modifyLock.RLock()
	defer c.modifyLock.RUnlock()
	c.config.modifyLock.Lock()
	defer c.config.modifyLock.Unlock()

	c.config.HttpClient.Transport.(*http.Transport).MaxIdleConns = idle
}

func (c *Client) MaxIdleConnections() int {
	c.modifyLock.RLock()
	defer c.modifyLock.RUnlock()
	c.config.modifyLock.Lock()
	defer c.config.modifyLock.Unlock()

	return c.config.HttpClient.Transport.(*http.Transport).MaxIdleConns
}

func (c *Client) SetDisableKeepAlives(disable bool) {
	c.modifyLock.RLock()
	defer c.modifyLock.RUnlock()
	c.config.modifyLock.Lock()
	defer c.config.modifyLock.Unlock()

	c.config.HttpClient.Transport.(*http.Transport).DisableKeepAlives = disable
}

func (c *Client) DisableKeepAlives() bool {
	c.modifyLock.RLock()
	defer c.modifyLock.RUnlock()
	c.config.modifyLock.RLock()
	defer c.config.modifyLock.RUnlock()

	return c.config.HttpClient.Transport.(*http.Transport).DisableKeepAlives
}

func (c *Client) MaxRetries() int {
	c.modifyLock.RLock()
	defer c.modifyLock.RUnlock()
	c.config.modifyLock.RLock()
	defer c.config.modifyLock.RUnlock()

	return c.config.MaxRetries
}

func (c *Client) SetSRVLookup(srv bool) {
	c.modifyLock.RLock()
	defer c.modifyLock.RUnlock()
	c.config.modifyLock.Lock()
	defer c.config.modifyLock.Unlock()

	c.config.SRVLookup = srv
}

func (c *Client) SRVLookup() bool {
	c.modifyLock.RLock()
	defer c.modifyLock.RUnlock()
	c.config.modifyLock.RLock()
	defer c.config.modifyLock.RUnlock()

	return c.config.SRVLookup
}

// SetCheckRetry sets the CheckRetry function to be used for future requests.
func (c *Client) SetCheckRetry(checkRetry retryablehttp.CheckRetry) {
	c.modifyLock.RLock()
	defer c.modifyLock.RUnlock()
	c.config.modifyLock.Lock()
	defer c.config.modifyLock.Unlock()

	c.config.CheckRetry = checkRetry
}

func (c *Client) CheckRetry() retryablehttp.CheckRetry {
	c.modifyLock.RLock()
	defer c.modifyLock.RUnlock()
	c.config.modifyLock.RLock()
	defer c.config.modifyLock.RUnlock()

	return c.config.CheckRetry
}

// SetClientTimeout sets the client request timeout
func (c *Client) SetClientTimeout(timeout time.Duration) {
	c.modifyLock.RLock()
	defer c.modifyLock.RUnlock()
	c.config.modifyLock.Lock()
	defer c.config.modifyLock.Unlock()

	c.config.Timeout = timeout
}

func (c *Client) ClientTimeout() time.Duration {
	c.modifyLock.RLock()
	defer c.modifyLock.RUnlock()
	c.config.modifyLock.RLock()
	defer c.config.modifyLock.RUnlock()

	return c.config.Timeout
}

func (c *Client) OutputCurlString() bool {
	c.modifyLock.RLock()
	defer c.modifyLock.RUnlock()
	c.config.modifyLock.RLock()
	defer c.config.modifyLock.RUnlock()

	return c.config.OutputCurlString
}

func (c *Client) SetOutputCurlString(curl bool) {
	c.modifyLock.RLock()
	defer c.modifyLock.RUnlock()
	c.config.modifyLock.Lock()
	defer c.config.modifyLock.Unlock()

	c.config.OutputCurlString = curl
}

func (c *Client) OutputPolicy() bool {
	c.modifyLock.RLock()
	defer c.modifyLock.RUnlock()
	c.config.modifyLock.RLock()
	defer c.config.modifyLock.RUnlock()

	return c.config.OutputPolicy
}

func (c *Client) SetOutputPolicy(isSet bool) {
	c.modifyLock.RLock()
	defer c.modifyLock.RUnlock()
	c.config.modifyLock.Lock()
	defer c.config.modifyLock.Unlock()

	c.config.OutputPolicy = isSet
}

// CurrentWrappingLookupFunc sets a lookup function that returns desired wrap TTLs
// for a given operation and path.
func (c *Client) CurrentWrappingLookupFunc() WrappingLookupFunc {
	c.modifyLock.RLock()
	defer c.modifyLock.RUnlock()
	return c.wrappingLookupFunc
}

// SetWrappingLookupFunc sets a lookup function that returns desired wrap TTLs
// for a given operation and path.
func (c *Client) SetWrappingLookupFunc(lookupFunc WrappingLookupFunc) {
	c.modifyLock.Lock()
	defer c.modifyLock.Unlock()
	c.wrappingLookupFunc = lookupFunc
}

// SetMFACreds sets the MFA credentials supplied either via the environment
// variable or via the command line.
func (c *Client) SetMFACreds(creds []string) {
	c.modifyLock.Lock()
	defer c.modifyLock.Unlock()
	c.mfaCreds = creds
}

// SetNamespace sets the namespace supplied either via the environment
// variable or via the command line.
func (c *Client) SetNamespace(namespace string) {
	c.modifyLock.Lock()
	defer c.modifyLock.Unlock()
	c.setNamespace(namespace)
}

func (c *Client) setNamespace(namespace string) {
	if c.headers == nil {
		c.headers = make(http.Header)
	}

	c.headers.Set(NamespaceHeaderName, namespace)
}

// ClearNamespace removes the namespace header if set.
func (c *Client) ClearNamespace() {
	c.modifyLock.Lock()
	defer c.modifyLock.Unlock()
	if c.headers != nil {
		c.headers.Del(NamespaceHeaderName)
	}
}

// Namespace returns the namespace currently set in this client. It will
// return an empty string if there is no namespace set.
func (c *Client) Namespace() string {
	c.modifyLock.Lock()
	defer c.modifyLock.Unlock()
	if c.headers == nil {
		return ""
	}
	return c.headers.Get(NamespaceHeaderName)
}

// WithNamespace makes a shallow copy of Client, modifies it to use
// the given namespace, and returns it. Passing an empty string will
// temporarily unset the namespace.
func (c *Client) WithNamespace(namespace string) *Client {
	c2 := *c
	c2.modifyLock = sync.RWMutex{}
	c.modifyLock.RLock()
	c2.headers = c.headersInternal()
	c.modifyLock.RUnlock()
	if namespace == "" {
		c2.ClearNamespace()
	} else {
		c2.SetNamespace(namespace)
	}
	return &c2
}

// Token returns the access token being used by this client. It will
// return the empty string if there is no token set.
func (c *Client) Token() string {
	c.modifyLock.RLock()
	defer c.modifyLock.RUnlock()
	return c.token
}

// SetToken sets the token directly. This won't perform any auth
// verification, it simply sets the token properly for future requests.
func (c *Client) SetToken(v string) {
	c.modifyLock.Lock()
	defer c.modifyLock.Unlock()
	c.token = v
}

// HCPCookie returns the HCP cookie being used by this client. It will
// return an empty cookie when no cookie is set.
func (c *Client) HCPCookie() string {
	c.modifyLock.RLock()
	defer c.modifyLock.RUnlock()

	if c.hcpCookie == nil {
		return ""
	}
	return c.hcpCookie.String()
}

// SetHCPCookie sets the hcp cookie directly. This won't perform any auth
// verification, it simply sets the token properly for future requests.
func (c *Client) SetHCPCookie(v *http.Cookie) error {
	c.modifyLock.Lock()
	defer c.modifyLock.Unlock()

	if err := v.Valid(); err != nil {
		return err
	}

	c.hcpCookie = v

	return nil
}

// ClearToken deletes the token if it is set or does nothing otherwise.
func (c *Client) ClearToken() {
	c.modifyLock.Lock()
	defer c.modifyLock.Unlock()
	c.token = ""
}

// Headers gets the current set of headers used for requests. This returns a
// copy; to modify it call AddHeader or SetHeaders.
func (c *Client) Headers() http.Header {
	c.modifyLock.RLock()
	defer c.modifyLock.RUnlock()
	return c.headersInternal()
}

// headersInternal gets the current set of headers used for requests. Must be called
// with the read modifyLock held.
func (c *Client) headersInternal() http.Header {
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

// SetBackoff sets the backoff function to be used for future requests.
func (c *Client) SetBackoff(backoff retryablehttp.Backoff) {
	c.modifyLock.RLock()
	defer c.modifyLock.RUnlock()
	c.config.modifyLock.Lock()
	defer c.config.modifyLock.Unlock()

	c.config.Backoff = backoff
}

func (c *Client) SetLogger(logger retryablehttp.LeveledLogger) {
	c.modifyLock.RLock()
	defer c.modifyLock.RUnlock()
	c.config.modifyLock.Lock()
	defer c.config.modifyLock.Unlock()

	c.config.Logger = logger
}

// SetCloneHeaders to allow headers to be copied whenever the client is cloned.
func (c *Client) SetCloneHeaders(cloneHeaders bool) {
	c.modifyLock.Lock()
	defer c.modifyLock.Unlock()
	c.config.modifyLock.Lock()
	defer c.config.modifyLock.Unlock()

	c.config.CloneHeaders = cloneHeaders
}

// CloneHeaders gets the configured CloneHeaders value.
func (c *Client) CloneHeaders() bool {
	c.modifyLock.RLock()
	defer c.modifyLock.RUnlock()
	c.config.modifyLock.RLock()
	defer c.config.modifyLock.RUnlock()

	return c.config.CloneHeaders
}

// SetCloneToken from parent
func (c *Client) SetCloneToken(cloneToken bool) {
	c.modifyLock.Lock()
	defer c.modifyLock.Unlock()
	c.config.modifyLock.Lock()
	defer c.config.modifyLock.Unlock()

	c.config.CloneToken = cloneToken
}

// CloneToken gets the configured CloneToken value.
func (c *Client) CloneToken() bool {
	c.modifyLock.RLock()
	defer c.modifyLock.RUnlock()
	c.config.modifyLock.RLock()
	defer c.config.modifyLock.RUnlock()

	return c.config.CloneToken
}

// SetReadYourWrites to prevent reading stale cluster replication state.
func (c *Client) SetReadYourWrites(preventStaleReads bool) {
	c.modifyLock.Lock()
	defer c.modifyLock.Unlock()
	c.config.modifyLock.Lock()
	defer c.config.modifyLock.Unlock()

	if preventStaleReads {
		if c.replicationStateStore == nil {
			c.replicationStateStore = &replicationStateStore{}
		}
	} else {
		c.replicationStateStore = nil
	}

	c.config.ReadYourWrites = preventStaleReads
}

// ReadYourWrites gets the configured value of ReadYourWrites
func (c *Client) ReadYourWrites() bool {
	c.modifyLock.RLock()
	defer c.modifyLock.RUnlock()
	c.config.modifyLock.RLock()
	defer c.config.modifyLock.RUnlock()

	return c.config.ReadYourWrites
}

// SetCloneTLSConfig from parent.
func (c *Client) SetCloneTLSConfig(clone bool) {
	c.modifyLock.Lock()
	defer c.modifyLock.Unlock()
	c.config.modifyLock.Lock()
	defer c.config.modifyLock.Unlock()

	c.config.CloneTLSConfig = clone
}

// CloneTLSConfig gets the configured CloneTLSConfig value.
func (c *Client) CloneTLSConfig() bool {
	c.modifyLock.RLock()
	defer c.modifyLock.RUnlock()
	c.config.modifyLock.RLock()
	defer c.config.modifyLock.RUnlock()

	return c.config.CloneTLSConfig
}

// Clone creates a new client with the same configuration. Note that the same
// underlying http.Client is used; modifying the client from more than one
// goroutine at once may not be safe, so modify the client as needed and then
// clone. The headers are cloned based on the CloneHeaders property of the
// source config
//
// Also, only the client's config is currently copied; this means items not in
// the api.Config struct, such as policy override and wrapping function
// behavior, must currently then be set as desired on the new client.
func (c *Client) Clone() (*Client, error) {
	c.modifyLock.RLock()
	defer c.modifyLock.RUnlock()
	c.config.modifyLock.RLock()
	defer c.config.modifyLock.RUnlock()
	return c.clone(c.config.CloneHeaders)
}

// CloneWithHeaders creates a new client similar to Clone, with the difference
// being that the headers are always cloned
func (c *Client) CloneWithHeaders() (*Client, error) {
	c.modifyLock.RLock()
	defer c.modifyLock.RUnlock()
	c.config.modifyLock.RLock()
	defer c.config.modifyLock.RUnlock()
	return c.clone(true)
}

// clone creates a new client, with the headers being cloned based on the
// passed in cloneheaders boolean.
// Must be called with the read lock and config read lock held.
func (c *Client) clone(cloneHeaders bool) (*Client, error) {
	config := c.config

	newConfig := &Config{
		Address:        config.Address,
		HttpClient:     config.HttpClient,
		MinRetryWait:   config.MinRetryWait,
		MaxRetryWait:   config.MaxRetryWait,
		MaxRetries:     config.MaxRetries,
		Timeout:        config.Timeout,
		Backoff:        config.Backoff,
		CheckRetry:     config.CheckRetry,
		Logger:         config.Logger,
		Limiter:        config.Limiter,
		AgentAddress:   config.AgentAddress,
		SRVLookup:      config.SRVLookup,
		CloneHeaders:   config.CloneHeaders,
		CloneToken:     config.CloneToken,
		ReadYourWrites: config.ReadYourWrites,
	}

	if config.CloneTLSConfig {
		newConfig.clientTLSConfig = config.clientTLSConfig
	}

	client, err := NewClient(newConfig)
	if err != nil {
		return nil, err
	}

	if cloneHeaders {
		client.SetHeaders(c.headersInternal().Clone())
	}

	if config.CloneToken {
		client.SetToken(c.token)
	}

	client.replicationStateStore = c.replicationStateStore

	return client, nil
}

// SetPolicyOverride sets whether requests should be sent with the policy
// override flag to request overriding soft-mandatory Sentinel policies (both
// RGPs and EGPs)
func (c *Client) SetPolicyOverride(override bool) {
	c.modifyLock.Lock()
	defer c.modifyLock.Unlock()
	c.policyOverride = override
}

// NewRequest creates a new raw request object to query the Vault server
// configured for this client. This is an advanced method and generally
// doesn't need to be called externally.
func (c *Client) NewRequest(method, requestPath string) *Request {
	c.modifyLock.RLock()
	addr := c.addr
	token := c.token
	mfaCreds := c.mfaCreds
	wrappingLookupFunc := c.wrappingLookupFunc
	policyOverride := c.policyOverride
	headers := c.headersInternal()
	c.modifyLock.RUnlock()

	host := addr.Host
	// if SRV records exist (see https://tools.ietf.org/html/draft-andrews-http-srv-02), lookup the SRV
	// record and take the highest match; this is not designed for high-availability, just discovery
	// Internet Draft specifies that the SRV record is ignored if a port is given
	if addr.Port() == "" && c.config.SRVLookup {
		_, addrs, err := net.LookupSRV("http", "tcp", addr.Hostname())
		if err == nil && len(addrs) > 0 {
			host = fmt.Sprintf("%s:%d", addrs[0].Target, addrs[0].Port)
		}
	}

	req := &Request{
		Method: method,
		URL: &url.URL{
			User:   addr.User,
			Scheme: addr.Scheme,
			Host:   host,
			Path:   path.Join(addr.Path, requestPath),
		},
		Host:        addr.Host,
		ClientToken: token,
		Params:      make(map[string][]string),
	}

	req.HCPCookie = c.hcpCookie

	var lookupPath string
	switch {
	case strings.HasPrefix(requestPath, "/v1/"):
		lookupPath = strings.TrimPrefix(requestPath, "/v1/")
	case strings.HasPrefix(requestPath, "v1/"):
		lookupPath = strings.TrimPrefix(requestPath, "v1/")
	default:
		lookupPath = requestPath
	}

	req.MFAHeaderVals = mfaCreds

	if wrappingLookupFunc != nil {
		req.WrapTTL = wrappingLookupFunc(method, lookupPath)
	} else {
		req.WrapTTL = DefaultWrappingLookupFunc(method, lookupPath)
	}

	req.Headers = headers
	req.PolicyOverride = policyOverride

	return req
}

// RawRequest performs the raw request given. This request may be against
// a Vault server not configured with this client. This is an advanced operation
// that generally won't need to be called externally.
//
// Deprecated: RawRequest exists for historical compatibility and should not be
// used directly. Use client.Logical().ReadRaw(...) or higher level methods
// instead.
func (c *Client) RawRequest(r *Request) (*Response, error) {
	return c.RawRequestWithContext(context.Background(), r)
}

// RawRequestWithContext performs the raw request given. This request may be against
// a Vault server not configured with this client. This is an advanced operation
// that generally won't need to be called externally.
//
// Deprecated: RawRequestWithContext exists for historical compatibility and
// should not be used directly. Use client.Logical().ReadRawWithContext(...)
// or higher level methods instead.
func (c *Client) RawRequestWithContext(ctx context.Context, r *Request) (*Response, error) {
	// Note: we purposefully do not call cancel manually. The reason is
	// when canceled, the request.Body will EOF when reading due to the way
	// it streams data in. Cancel will still be run when the timeout is
	// hit, so this doesn't really harm anything.
	ctx, _ = c.withConfiguredTimeout(ctx)
	return c.rawRequestWithContext(ctx, r)
}

func (c *Client) rawRequestWithContext(ctx context.Context, r *Request) (*Response, error) {
	c.modifyLock.RLock()
	token := c.token

	c.config.modifyLock.RLock()
	limiter := c.config.Limiter
	minRetryWait := c.config.MinRetryWait
	maxRetryWait := c.config.MaxRetryWait
	maxRetries := c.config.MaxRetries
	checkRetry := c.config.CheckRetry
	backoff := c.config.Backoff
	httpClient := c.config.HttpClient
	ns := c.headers.Get(NamespaceHeaderName)
	outputCurlString := c.config.OutputCurlString
	outputPolicy := c.config.OutputPolicy
	logger := c.config.Logger
	disableRedirects := c.config.DisableRedirects
	c.config.modifyLock.RUnlock()

	c.modifyLock.RUnlock()

	// ensure that the most current namespace setting is used at the time of the call
	// e.g. calls using (*Client).WithNamespace
	switch ns {
	case "":
		r.Headers.Del(NamespaceHeaderName)
	default:
		r.Headers.Set(NamespaceHeaderName, ns)
	}

	for _, cb := range c.requestCallbacks {
		cb(r)
	}

	if c.config.ReadYourWrites {
		c.replicationStateStore.requireState(r)
	}

	if limiter != nil {
		limiter.Wait(ctx)
	}

	// check the token before potentially erroring from the API
	if err := validateToken(token); err != nil {
		return nil, err
	}

	redirectCount := 0
START:
	req, err := r.toRetryableHTTP()
	if err != nil {
		return nil, err
	}
	if req == nil {
		return nil, fmt.Errorf("nil request created")
	}

	if outputCurlString {
		// Note that although we're building this up here and returning it as an error object, the Error()
		// interface method on it only gets called in a context where the actual string returned from that
		// method is irrelevant, because it gets swallowed by an error buffer that's never output to the user.
		// That's on purpose, not a bug, because in this case, OutputStringError is not really an _error_, per se.
		// It's just a way of aborting the control flow so that requests don't actually execute, and instead,
		// we can detect what's happened back in the CLI machinery and show the actual curl string to the user.
		LastOutputStringError = &OutputStringError{
			Request:       req,
			TLSSkipVerify: c.config.HttpClient.Transport.(*http.Transport).TLSClientConfig.InsecureSkipVerify,
			ClientCert:    c.config.curlClientCert,
			ClientKey:     c.config.curlClientKey,
			ClientCACert:  c.config.curlCACert,
			ClientCAPath:  c.config.curlCAPath,
		}
		return nil, LastOutputStringError
	}

	if outputPolicy {
		LastOutputPolicyError = &OutputPolicyError{
			method: req.Method,
			path:   strings.TrimPrefix(req.URL.Path, "/v1"),
			params: req.URL.Query(),
		}
		return nil, LastOutputPolicyError
	}

	req.Request = req.Request.WithContext(ctx)

	if backoff == nil {
		backoff = retryablehttp.LinearJitterBackoff
	}

	if checkRetry == nil {
		checkRetry = DefaultRetryPolicy
	}

	client := &retryablehttp.Client{
		HTTPClient:   httpClient,
		RetryWaitMin: minRetryWait,
		RetryWaitMax: maxRetryWait,
		RetryMax:     maxRetries,
		Backoff:      backoff,
		CheckRetry:   checkRetry,
		Logger:       logger,
		ErrorHandler: retryablehttp.PassthroughErrorHandler,
	}

	var result *Response
	resp, err := client.Do(req)
	if resp != nil {
		result = &Response{Response: resp}
	}
	if err != nil {
		if strings.Contains(err.Error(), "tls: oversized") {
			err = errwrap.Wrapf("{{err}}\n\n"+TLSErrorString, err)
		}
		return result, err
	}

	// Check for a redirect, only allowing for a single redirect (if redirects aren't disabled)
	if (resp.StatusCode == 301 || resp.StatusCode == 302 || resp.StatusCode == 307) && redirectCount == 0 && !disableRedirects {
		// Parse the updated location
		respLoc, err := resp.Location()
		if err != nil {
			return result, err
		}

		// Ensure a protocol downgrade doesn't happen
		if req.URL.Scheme == "https" && respLoc.Scheme != "https" {
			return result, fmt.Errorf("redirect would cause protocol downgrade")
		}

		// Update the request
		r.URL = respLoc

		// Reset the request body if any
		if err := r.ResetJSONBody(); err != nil {
			return result, err
		}

		// Retry the request
		redirectCount++
		goto START
	}

	if result != nil {
		for _, cb := range c.responseCallbacks {
			cb(result)
		}

		if c.config.ReadYourWrites {
			c.replicationStateStore.recordState(result)
		}
	}
	if err := result.Error(); err != nil {
		return result, err
	}

	return result, nil
}

// httpRequestWithContext avoids the use of the go-retryable library found in RawRequestWithContext and is
// useful when making calls where a net/http client is desirable. A single redirect (status code 301, 302,
// or 307) will be followed but all retry and timeout logic is the responsibility of the caller as is
// closing the Response body.
func (c *Client) httpRequestWithContext(ctx context.Context, r *Request) (*Response, error) {
	req, err := http.NewRequestWithContext(ctx, r.Method, r.URL.RequestURI(), r.Body)
	if err != nil {
		return nil, err
	}

	c.modifyLock.RLock()
	token := c.token

	c.config.modifyLock.RLock()
	limiter := c.config.Limiter
	httpClient := c.config.HttpClient
	outputCurlString := c.config.OutputCurlString
	outputPolicy := c.config.OutputPolicy
	disableRedirects := c.config.DisableRedirects

	// add headers
	if c.headers != nil {
		for header, vals := range c.headers {
			for _, val := range vals {
				req.Header.Add(header, val)
			}
		}
		// explicitly set the namespace header to current client
		if ns := c.headers.Get(NamespaceHeaderName); ns != "" {
			r.Headers.Set(NamespaceHeaderName, ns)
		}
	}

	c.config.modifyLock.RUnlock()
	c.modifyLock.RUnlock()

	// OutputCurlString and OutputPolicy logic rely on the request type to be retryable.Request
	if outputCurlString {
		return nil, fmt.Errorf("output-curl-string is not implemented for this request")
	}
	if outputPolicy {
		return nil, fmt.Errorf("output-policy is not implemented for this request")
	}

	req.URL.User = r.URL.User
	req.URL.Scheme = r.URL.Scheme
	req.URL.Host = r.URL.Host
	req.Host = r.URL.Host

	if len(r.ClientToken) != 0 {
		req.Header.Set(AuthHeaderName, r.ClientToken)
	}

	if len(r.WrapTTL) != 0 {
		req.Header.Set("X-Vault-Wrap-TTL", r.WrapTTL)
	}

	if len(r.MFAHeaderVals) != 0 {
		for _, mfaHeaderVal := range r.MFAHeaderVals {
			req.Header.Add("X-Vault-MFA", mfaHeaderVal)
		}
	}

	if r.PolicyOverride {
		req.Header.Set("X-Vault-Policy-Override", "true")
	}

	if limiter != nil {
		limiter.Wait(ctx)
	}

	// check the token before potentially erroring from the API
	if err := validateToken(token); err != nil {
		return nil, err
	}

	var result *Response

	resp, err := httpClient.Do(req)

	if resp != nil {
		result = &Response{Response: resp}
	}

	if err != nil {
		if strings.Contains(err.Error(), "tls: oversized") {
			err = errwrap.Wrapf("{{err}}\n\n"+TLSErrorString, err)
		}
		return result, err
	}

	// Check for a redirect, only allowing for a single redirect, if redirects aren't disabled
	if (resp.StatusCode == 301 || resp.StatusCode == 302 || resp.StatusCode == 307) && !disableRedirects {
		// Parse the updated location
		respLoc, err := resp.Location()
		if err != nil {
			return result, fmt.Errorf("redirect failed: %s", err)
		}

		// Ensure a protocol downgrade doesn't happen
		if req.URL.Scheme == "https" && respLoc.Scheme != "https" {
			return result, fmt.Errorf("redirect would cause protocol downgrade")
		}

		// Update the request
		req.URL = respLoc

		// Reset the request body if any
		if err := r.ResetJSONBody(); err != nil {
			return result, fmt.Errorf("redirect failed: %s", err)
		}

		// Retry the request
		resp, err = httpClient.Do(req)
		if err != nil {
			return result, fmt.Errorf("redirect failed: %s", err)
		}
	}

	if err := result.Error(); err != nil {
		return nil, err
	}

	return result, nil
}

type (
	RequestCallback  func(*Request)
	ResponseCallback func(*Response)
)

// WithRequestCallbacks makes a shallow clone of Client, modifies it to use
// the given callbacks, and returns it.  Each of the callbacks will be invoked
// on every outgoing request.  A client may be used to issue requests
// concurrently; any locking needed by callbacks invoked concurrently is the
// callback's responsibility.
func (c *Client) WithRequestCallbacks(callbacks ...RequestCallback) *Client {
	c2 := *c
	c2.modifyLock = sync.RWMutex{}
	c2.requestCallbacks = callbacks
	return &c2
}

// WithResponseCallbacks makes a shallow clone of Client, modifies it to use
// the given callbacks, and returns it.  Each of the callbacks will be invoked
// on every received response.  A client may be used to issue requests
// concurrently; any locking needed by callbacks invoked concurrently is the
// callback's responsibility.
func (c *Client) WithResponseCallbacks(callbacks ...ResponseCallback) *Client {
	c2 := *c
	c2.modifyLock = sync.RWMutex{}
	c2.responseCallbacks = callbacks
	return &c2
}

// withConfiguredTimeout wraps the context with a timeout from the client configuration.
func (c *Client) withConfiguredTimeout(ctx context.Context) (context.Context, context.CancelFunc) {
	timeout := c.ClientTimeout()

	if timeout > 0 {
		return context.WithTimeout(ctx, timeout)
	}

	return ctx, func() {}
}

// RecordState returns a response callback that will record the state returned
// by Vault in a response header.
func RecordState(state *string) ResponseCallback {
	return func(resp *Response) {
		*state = resp.Header.Get(HeaderIndex)
	}
}

// RequireState returns a request callback that will add a request header to
// specify the state we require of Vault. This state was obtained from a
// response header seen previous, probably captured with RecordState.
func RequireState(states ...string) RequestCallback {
	return func(req *Request) {
		for _, s := range states {
			req.Headers.Add(HeaderIndex, s)
		}
	}
}

// compareReplicationStates returns 1 if s1 is newer or identical, -1 if s1 is older, and 0
// if neither s1 or s2 is strictly greater. An error is returned if s1 or s2
// are invalid or from different clusters.
func compareReplicationStates(s1, s2 string) (int, error) {
	w1, err := ParseReplicationState(s1, nil)
	if err != nil {
		return 0, err
	}
	w2, err := ParseReplicationState(s2, nil)
	if err != nil {
		return 0, err
	}

	if w1.ClusterID != w2.ClusterID {
		return 0, fmt.Errorf("can't compare replication states with different ClusterIDs")
	}

	switch {
	case w1.LocalIndex >= w2.LocalIndex && w1.ReplicatedIndex >= w2.ReplicatedIndex:
		return 1, nil
	// We've already handled the case where both are equal above, so really we're
	// asking here if one or both are lesser.
	case w1.LocalIndex <= w2.LocalIndex && w1.ReplicatedIndex <= w2.ReplicatedIndex:
		return -1, nil
	}

	return 0, nil
}

// MergeReplicationStates returns a merged array of replication states by iterating
// through all states in `old`. An iterated state is merged to the result before `new`
// based on the result of compareReplicationStates
func MergeReplicationStates(old []string, new string) []string {
	if len(old) == 0 || len(old) > 2 {
		return []string{new}
	}

	var ret []string
	for _, o := range old {
		c, err := compareReplicationStates(o, new)
		if err != nil {
			return []string{new}
		}
		switch c {
		case 1:
			ret = append(ret, o)
		case -1:
			ret = append(ret, new)
		case 0:
			ret = append(ret, o, new)
		}
	}
	return strutil.RemoveDuplicates(ret, false)
}

type WALState struct {
	ClusterID       string
	LocalIndex      uint64
	ReplicatedIndex uint64
}

func ParseReplicationState(raw string, hmacKey []byte) (*WALState, error) {
	cooked, err := base64.StdEncoding.DecodeString(raw)
	if err != nil {
		return nil, err
	}
	s := string(cooked)

	lastIndex := strings.LastIndexByte(s, ':')
	if lastIndex == -1 {
		return nil, fmt.Errorf("invalid full state header format")
	}
	state, stateHMACRaw := s[:lastIndex], s[lastIndex+1:]
	stateHMAC, err := hex.DecodeString(stateHMACRaw)
	if err != nil {
		return nil, fmt.Errorf("invalid state header HMAC: %v, %w", stateHMACRaw, err)
	}

	if len(hmacKey) != 0 {
		hm := hmac.New(sha256.New, hmacKey)
		hm.Write([]byte(state))
		if !hmac.Equal(hm.Sum(nil), stateHMAC) {
			return nil, fmt.Errorf("invalid state header HMAC (mismatch)")
		}
	}

	pieces := strings.Split(state, ":")
	if len(pieces) != 4 || pieces[0] != "v1" || pieces[1] == "" {
		return nil, fmt.Errorf("invalid state header format")
	}
	localIndex, err := strconv.ParseUint(pieces[2], 10, 64)
	if err != nil {
		return nil, fmt.Errorf("invalid local index in state header: %w", err)
	}
	replicatedIndex, err := strconv.ParseUint(pieces[3], 10, 64)
	if err != nil {
		return nil, fmt.Errorf("invalid replicated index in state header: %w", err)
	}

	return &WALState{
		ClusterID:       pieces[1],
		LocalIndex:      localIndex,
		ReplicatedIndex: replicatedIndex,
	}, nil
}

// ForwardInconsistent returns a request callback that will add a request
// header which says: if the state required isn't present on the node receiving
// this request, forward it to the active node.  This should be used in
// conjunction with RequireState.
func ForwardInconsistent() RequestCallback {
	return func(req *Request) {
		req.Headers.Set(HeaderInconsistent, "forward-active-node")
	}
}

// ForwardAlways returns a request callback which adds a header telling any
// performance standbys handling the request to forward it to the active node.
// This feature must be enabled in Vault's configuration.
func ForwardAlways() RequestCallback {
	return func(req *Request) {
		req.Headers.Set(HeaderForward, "active-node")
	}
}

// DefaultRetryPolicy is the default retry policy used by new Client objects.
// It is the same as retryablehttp.DefaultRetryPolicy except that it also retries
// 412 requests, which are returned by Vault when a X-Vault-Index header isn't
// satisfied.
func DefaultRetryPolicy(ctx context.Context, resp *http.Response, err error) (bool, error) {
	retry, err := retryablehttp.DefaultRetryPolicy(ctx, resp, err)
	if err != nil || retry {
		return retry, err
	}
	if resp != nil && resp.StatusCode == 412 {
		return true, nil
	}
	return false, nil
}

// replicationStateStore is used to track cluster replication states
// in order to ensure proper read-after-write semantics for a Client.
type replicationStateStore struct {
	m     sync.RWMutex
	store []string
}

// recordState updates the store's replication states with the merger of all
// states.
func (w *replicationStateStore) recordState(resp *Response) {
	w.m.Lock()
	defer w.m.Unlock()
	newState := resp.Header.Get(HeaderIndex)
	if newState != "" {
		w.store = MergeReplicationStates(w.store, newState)
	}
}

// requireState updates the Request with the store's current replication states.
func (w *replicationStateStore) requireState(req *Request) {
	w.m.RLock()
	defer w.m.RUnlock()
	for _, s := range w.store {
		req.Headers.Add(HeaderIndex, s)
	}
}

// states currently stored.
func (w *replicationStateStore) states() []string {
	w.m.RLock()
	defer w.m.RUnlock()
	c := make([]string, len(w.store))
	copy(c, w.store)
	return c
}

// validateToken will check for non-printable characters to prevent a call that will fail at the api
func validateToken(t string) error {
	idx := strings.IndexFunc(t, func(c rune) bool {
		return !unicode.IsPrint(c)
	})
	if idx != -1 {
		return fmt.Errorf("configured Vault token contains non-printable characters and cannot be used")
	}
	return nil
}
