package proxy

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/pem"
	"errors"
	"fmt"
	"net"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/status"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"golang.org/x/net/proxy"
)

const (
	PluginSecureSocksProxyEnabled            = "GF_SECURE_SOCKS_DATASOURCE_PROXY_SERVER_ENABLED"
	PluginSecureSocksProxyClientCert         = "GF_SECURE_SOCKS_DATASOURCE_PROXY_CLIENT_CERT"
	PluginSecureSocksProxyClientCertContents = "GF_SECURE_SOCKS_DATASOURCE_PROXY_CLIENT_CERT_VAL"
	PluginSecureSocksProxyClientKey          = "GF_SECURE_SOCKS_DATASOURCE_PROXY_CLIENT_KEY"
	PluginSecureSocksProxyClientKeyContents  = "GF_SECURE_SOCKS_DATASOURCE_PROXY_CLIENT_KEY_VAL"
	PluginSecureSocksProxyRootCAs            = "GF_SECURE_SOCKS_DATASOURCE_PROXY_ROOT_CA_CERT"
	PluginSecureSocksProxyRootCAsContents    = "GF_SECURE_SOCKS_DATASOURCE_PROXY_ROOT_CA_CERT_VALS"
	PluginSecureSocksProxyProxyAddress       = "GF_SECURE_SOCKS_DATASOURCE_PROXY_PROXY_ADDRESS"
	PluginSecureSocksProxyServerName         = "GF_SECURE_SOCKS_DATASOURCE_PROXY_SERVER_NAME"
	PluginSecureSocksProxyAllowInsecure      = "GF_SECURE_SOCKS_DATASOURCE_PROXY_ALLOW_INSECURE"
)

var (
	socksUnknownError           = regexp.MustCompile(`unknown code: (\d+)`)
	secureSocksRequestsDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: "grafana",
		Name:      "secure_socks_requests_duration",
		Help:      "Duration of requests to the secure socks proxy",
	}, []string{"code", "datasource", "datasource_type"})
	errUseOfHTTPDefaultTransport = errors.New("use of the http.DefaultTransport is not allowed with secure proxy")
)

// Client is the main Proxy Client interface.
type Client interface {
	SecureSocksProxyEnabled() bool
	ConfigureSecureSocksHTTPProxy(transport *http.Transport) error
	NewSecureSocksProxyContextDialer() (proxy.Dialer, error)
}

// ClientCfg contains the information needed to allow datasource connections to be
// proxied to a secure socks proxy.
type ClientCfg struct {
	// Deprecated: ClientCert is the file path to the client certificate.
	ClientCert string
	// Deprecated: ClientKey is the file path to the client key.
	ClientKey string
	// Deprecated: RootCAs is a list of file paths to the root CA certificates.
	RootCAs []string

	ClientCertVal string
	ClientKeyVal  string
	RootCAsVals   []string
	ProxyAddress  string
	ServerName    string
	AllowInsecure bool
}

// New creates a new proxy client from a given config.
func New(opts *Options) Client {
	return &cfgProxyWrapper{
		opts: opts,
	}
}

type cfgProxyWrapper struct {
	opts *Options
}

// SecureSocksProxyEnabled checks if the Grafana instance allows the secure socks proxy to be used
// and the datasource options specify to use the proxy.
// The secure proxy can only be used if it's enabled on both the datasource connection and the client (Grafana server)
func (p *cfgProxyWrapper) SecureSocksProxyEnabled() bool {
	if p.opts == nil || !p.opts.Enabled || p.opts.ClientCfg == nil {
		return false
	}

	return true
}

// ConfigureSecureSocksHTTPProxy takes a http.Transport and wraps it in a socks5 proxy with TLS
// if it is enabled on the datasource and the grafana instance
func (p *cfgProxyWrapper) ConfigureSecureSocksHTTPProxy(transport *http.Transport) error {
	if !p.SecureSocksProxyEnabled() {
		return nil
	}

	if transport == http.DefaultTransport {
		return errUseOfHTTPDefaultTransport
	}

	dialSocksProxy, err := p.NewSecureSocksProxyContextDialer()
	if err != nil {
		return err
	}

	contextDialer, ok := dialSocksProxy.(proxy.ContextDialer)
	if !ok {
		return errors.New("unable to cast socks proxy dialer to context proxy dialer")
	}

	transport.DialContext = contextDialer.DialContext
	return nil
}

// NewSecureSocksProxyContextDialer returns a proxy context dialer that can be used to allow datasource connections to go through a secure socks proxy
func (p *cfgProxyWrapper) NewSecureSocksProxyContextDialer() (proxy.Dialer, error) {
	p.opts.setDefaults()

	if !p.SecureSocksProxyEnabled() {
		return nil, errors.New("proxy not enabled")
	}

	if p.opts.ClientCfg == nil {
		return nil, errors.New("client config is not set")
	}

	var dialer proxy.Dialer
	if p.opts.ClientCfg.AllowInsecure {
		dialer = &net.Dialer{
			Timeout:   p.opts.Timeouts.Timeout,
			KeepAlive: p.opts.Timeouts.KeepAlive,
		}
	} else {
		d, err := p.getTLSDialer()
		if err != nil {
			return nil, fmt.Errorf("instantiating tls dialer: %w", err)
		}
		dialer = d
	}

	var auth *proxy.Auth
	if p.opts.Auth != nil {
		auth = &proxy.Auth{
			User:     p.opts.Auth.Username,
			Password: p.opts.Auth.Password,
		}
	}

	dialSocksProxy, err := proxy.SOCKS5("tcp", p.opts.ClientCfg.ProxyAddress, auth, dialer)
	if err != nil {
		return nil, err
	}

	return newInstrumentedSocksDialer(dialSocksProxy, p.opts.DatasourceName, p.opts.DatasourceType), nil
}

func (p *cfgProxyWrapper) getTLSDialer() (*tls.Dialer, error) {
	if len(p.opts.ClientCfg.RootCAsVals) == 0 {
		// legacy file path support
		if len(p.opts.ClientCfg.RootCAs) > 0 {
			return p.getTLSDialerFromFiles()
		}
		return nil, errors.New("one or more root ca are required")
	}

	certPool := x509.NewCertPool()
	for _, rootCA := range p.opts.ClientCfg.RootCAsVals {
		pemBytes := []byte(rootCA)
		pemDecoded, _ := pem.Decode(pemBytes)
		if pemDecoded == nil || pemDecoded.Type != "CERTIFICATE" {
			return nil, errors.New("root ca is invalid")
		}

		if !certPool.AppendCertsFromPEM(pemBytes) {
			return nil, errors.New("failed to append CA certificate to pool")
		}
	}

	cert, err := tls.X509KeyPair([]byte(p.opts.ClientCfg.ClientCertVal), []byte(p.opts.ClientCfg.ClientKeyVal))
	if err != nil {
		return nil, err
	}

	return &tls.Dialer{
		Config: &tls.Config{
			Certificates: []tls.Certificate{cert},
			ServerName:   p.opts.ClientCfg.ServerName,
			RootCAs:      certPool,
			MinVersion:   tls.VersionTLS13,
		},
		NetDialer: &net.Dialer{
			Timeout:   p.opts.Timeouts.Timeout,
			KeepAlive: p.opts.Timeouts.KeepAlive,
		},
	}, nil
}

// Deprecated: getTLSDialerFromFiles is a helper function that creates a tls.Dialer from the client cert, client key, and root CA files on disk.
// As of Grafana 11 we are moving to using the root CA and client cert/key values instead of files.
func (p *cfgProxyWrapper) getTLSDialerFromFiles() (*tls.Dialer, error) {
	certPool := x509.NewCertPool()
	for _, rootCAFile := range p.opts.ClientCfg.RootCAs {
		// nolint:gosec
		// The gosec G304 warning can be ignored because `rootCAFile` comes from config ini
		// and we check below if it's the right file type
		pemBytes, err := os.ReadFile(rootCAFile)
		if err != nil {
			return nil, err
		}

		pemDecoded, _ := pem.Decode(pemBytes)
		if pemDecoded == nil || pemDecoded.Type != "CERTIFICATE" {
			return nil, errors.New("root ca is invalid")
		}

		if !certPool.AppendCertsFromPEM(pemBytes) {
			return nil, fmt.Errorf("failed to append CA certificate %s", rootCAFile)
		}
	}

	cert, err := tls.LoadX509KeyPair(p.opts.ClientCfg.ClientCert, p.opts.ClientCfg.ClientKey)
	if err != nil {
		return nil, err
	}
	return &tls.Dialer{
		Config: &tls.Config{
			Certificates: []tls.Certificate{cert},
			ServerName:   p.opts.ClientCfg.ServerName,
			RootCAs:      certPool,
			MinVersion:   tls.VersionTLS13,
		},
		NetDialer: &net.Dialer{
			Timeout:   p.opts.Timeouts.Timeout,
			KeepAlive: p.opts.Timeouts.KeepAlive,
		},
	}, nil
}

// SecureSocksProxyEnabledOnDS checks the datasource json data for `enableSecureSocksProxy`
// to determine if the secure socks proxy should be enabled on it
func SecureSocksProxyEnabledOnDS(jsonData map[string]interface{}) bool {
	res, enabled := jsonData["enableSecureSocksProxy"]
	if !enabled {
		return false
	}

	if val, ok := res.(bool); ok {
		return val
	}

	return false
}

// instrumentedSocksDialer  is a wrapper around the proxy.Dialer and proxy.DialContext
// that records relevant socks secure socks proxy.
type instrumentedSocksDialer struct {
	// datasourceName is the name of the datasource the proxy will be used to communicate with.
	datasourceName string
	// datasourceType is the type of the datasourceType the proxy will be used to communicate with.
	// It should be the value assigned to the type property in a datasourceType provisioning file (e.g mysql, prometheus)
	datasourceType string
	dialer         proxy.Dialer
}

// newInstrumentedSocksDialer creates a new instrumented dialer
func newInstrumentedSocksDialer(dialer proxy.Dialer, datasourceName, datasourceType string) proxy.Dialer {
	return &instrumentedSocksDialer{
		dialer:         dialer,
		datasourceName: datasourceName,
		datasourceType: datasourceType,
	}
}

// Dial -
func (d *instrumentedSocksDialer) Dial(network, addr string) (net.Conn, error) {
	return d.DialContext(context.Background(), network, addr)
}

// DialContext -
func (d *instrumentedSocksDialer) DialContext(ctx context.Context, n, addr string) (net.Conn, error) {
	if ctx.Err() != nil {
		log.DefaultLogger.Debug("context cancelled or deadline exceeded, returning context error")
		return nil, ctx.Err()
	}

	start := time.Now()
	dialer, ok := d.dialer.(proxy.ContextDialer)
	if !ok {
		return nil, errors.New("unable to cast socks proxy dialer to context proxy dialer")
	}
	c, err := dialer.DialContext(ctx, n, addr)

	var code string
	var opErr *net.OpError

	switch {
	case err == nil:
		code = "0"
	case errors.As(err, &opErr):
		unknownCode := socksUnknownError.FindStringSubmatch(err.Error())

		// Socks errors defined here: https://cs.opensource.google/go/x/net/+/refs/tags/v0.15.0:internal/socks/socks.go;l=40-63
		switch {
		case strings.Contains(err.Error(), "general SOCKS server failure"):
			code = "1"
		case strings.Contains(err.Error(), "connection not allowed by ruleset"):
			code = "2"
		case strings.Contains(err.Error(), "network unreachable"):
			code = "3"
		case strings.Contains(err.Error(), "host unreachable"):
			code = "4"
		case strings.Contains(err.Error(), "connection refused"):
			code = "5"
		case strings.Contains(err.Error(), "TTL expired"):
			code = "6"
		case strings.Contains(err.Error(), "command not supported"):
			code = "7"
		case strings.Contains(err.Error(), "address type not supported"):
			code = "8"
		case strings.HasSuffix(err.Error(), "EOF"):
			code = "eof_error"
		case strings.HasSuffix(err.Error(), "i/o timeout"):
			code = "io_timeout_error"
		case strings.HasSuffix(err.Error(), "context canceled"):
			code = "context_canceled_error"
		case strings.HasSuffix(err.Error(), "operation was canceled"):
			code = "context_canceled_error"
		case len(unknownCode) > 1:
			code = unknownCode[1]
		default:
			code = "socks_unknown_error"
		}
		log.DefaultLogger.Error("received opErr from dialer", "network", n, "addr", addr, "opErr", opErr, "code", code)
	default:
		log.DefaultLogger.Error("received err from dialer", "network", n, "addr", addr, "err", err)
		code = "dial_error"
	}
	if err != nil {
		err = status.DownstreamError(err)
	}

	secureSocksRequestsDuration.WithLabelValues(code, d.datasourceName, d.datasourceType).Observe(time.Since(start).Seconds())
	return c, err
}
