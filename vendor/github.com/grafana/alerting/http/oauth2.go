package http

import (
	"context"
	"crypto/tls"
	"fmt"
	"net/http"
	"net/url"
	"time"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/clientcredentials"

	"github.com/grafana/alerting/receivers"
	commoncfg "github.com/prometheus/common/config"
)

var (
	// ErrOAuth2ClientIDRequired is returned when OAuth2 ClientID is required but not provided.
	ErrOAuth2ClientIDRequired = fmt.Errorf("OAuth2 ClientID is required")
	// ErrOAuth2ClientSecretRequired is returned when OAuth2 ClientSecret is required but not provided.
	ErrOAuth2ClientSecretRequired = fmt.Errorf("OAuth2 ClientSecret is required")
	// ErrOAuth2TokenURLRequired is returned when OAuth2 TokenURL is required but not provided.
	ErrOAuth2TokenURLRequired = fmt.Errorf("OAuth2 TokenURL is required")
	// ErrOAuth2TLSConfigInvalid is returned when the provided TLS configuration is invalid.
	ErrOAuth2TLSConfigInvalid = fmt.Errorf("invalid TLS configuration")
)

// OAuth2Config is the oauth2 client configuration.
type OAuth2Config struct {
	ClientID       string               `json:"client_id" yaml:"client_id"`
	ClientSecret   string               `json:"client_secret" yaml:"client_secret"`
	TokenURL       string               `json:"token_url" yaml:"token_url"`
	Scopes         []string             `json:"scopes,omitempty" yaml:"scopes,omitempty"`
	EndpointParams map[string]string    `json:"endpoint_params,omitempty" yaml:"endpoint_params,omitempty"`
	TLSConfig      *receivers.TLSConfig `json:"tls_config,omitempty" yaml:"tls_config,omitempty"`
	ProxyConfig    *ProxyConfig         `json:"proxy_config,omitempty" yaml:"proxy_config,omitempty"`
}

func ValidateOAuth2Config(config *OAuth2Config) error {
	if config == nil {
		// If no OAuth2 config is provided, we consider it valid.
		return nil
	}
	if config.ClientID == "" {
		return ErrOAuth2ClientIDRequired
	}
	if config.ClientSecret == "" {
		return ErrOAuth2ClientSecretRequired
	}
	if config.TokenURL == "" {
		return ErrOAuth2TokenURLRequired
	}
	if config.TLSConfig != nil {
		if _, err := config.TLSConfig.ToCryptoTLSConfig(); err != nil {
			return fmt.Errorf("%w: %w", ErrOAuth2TLSConfigInvalid, err)
		}
	}

	if config.ProxyConfig != nil {
		if err := ValidateProxyConfig(*config.ProxyConfig); err != nil {
			return fmt.Errorf("%w: %w", ErrInvalidProxyConfig, err)
		}
	}

	return nil
}

type OAuth2RoundTripper struct {
	rt http.RoundTripper
}

func NewOAuth2RoundTripper(tokenSource oauth2.TokenSource, next http.RoundTripper) *OAuth2RoundTripper {
	return &OAuth2RoundTripper{
		rt: &oauth2.Transport{
			Base:   next,
			Source: tokenSource,
		},
	}
}

func NewOAuth2TokenSource(config OAuth2Config, clientConfig clientConfiguration) (oauth2.TokenSource, error) {
	credconfig := &clientcredentials.Config{
		ClientID:       config.ClientID,
		ClientSecret:   config.ClientSecret,
		Scopes:         config.Scopes,
		TokenURL:       config.TokenURL,
		EndpointParams: url.Values{},
	}

	for name, value := range config.EndpointParams {
		credconfig.EndpointParams.Set(name, value)
	}

	var tlsConfig *tls.Config
	if config.TLSConfig != nil {
		var err error
		tlsConfig, err = config.TLSConfig.ToCryptoTLSConfig()
		if err != nil {
			return nil, fmt.Errorf("%w: %w", ErrOAuth2TLSConfigInvalid, err)
		}
	}

	// From prometheus/common oauth2RoundTripper.
	var rt http.RoundTripper = &http.Transport{
		TLSClientConfig:       tlsConfig,
		Proxy:                 config.ProxyConfig.Proxy(),
		ProxyConnectHeader:    config.ProxyConfig.GetProxyConnectHeader(),
		MaxIdleConns:          20,
		MaxIdleConnsPerHost:   1, // see https://github.com/golang/go/issues/13801
		IdleConnTimeout:       10 * time.Second,
		TLSHandshakeTimeout:   10 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,

		// The following differs from upstream, allowing proxy settings to be configured.
		DialContext: clientConfig.dialer.DialContext,
	}

	// Ensure that OAuth2 requests use the same user agent as the rest of the HTTP client.
	if clientConfig.userAgent != "" {
		rt = commoncfg.NewUserAgentRoundTripper(clientConfig.userAgent, rt)
	}

	return credconfig.TokenSource(
		context.WithValue(
			context.Background(),
			oauth2.HTTPClient,
			&http.Client{
				Transport: rt,
				Timeout:   time.Second * 30,
			},
		),
	), nil
}

func (rt *OAuth2RoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	return rt.rt.RoundTrip(req)
}
