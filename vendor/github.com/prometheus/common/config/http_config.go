// Copyright 2016 The Prometheus Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package config

import (
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"strings"

	"gopkg.in/yaml.v2"
)

// BasicAuth contains basic HTTP authentication credentials.
type BasicAuth struct {
	Username string `yaml:"username"`
	Password Secret `yaml:"password"`

	// Catches all undefined fields and must be empty after parsing.
	XXX map[string]interface{} `yaml:",inline"`
}

// URL is a custom URL type that allows validation at configuration load time.
type URL struct {
	*url.URL
}

// UnmarshalYAML implements the yaml.Unmarshaler interface for URLs.
func (u *URL) UnmarshalYAML(unmarshal func(interface{}) error) error {
	var s string
	if err := unmarshal(&s); err != nil {
		return err
	}

	urlp, err := url.Parse(s)
	if err != nil {
		return err
	}
	u.URL = urlp
	return nil
}

// MarshalYAML implements the yaml.Marshaler interface for URLs.
func (u URL) MarshalYAML() (interface{}, error) {
	if u.URL != nil {
		return u.String(), nil
	}
	return nil, nil
}

// HTTPClientConfig configures an HTTP client.
type HTTPClientConfig struct {
	// The HTTP basic authentication credentials for the targets.
	BasicAuth *BasicAuth `yaml:"basic_auth,omitempty"`
	// The bearer token for the targets.
	BearerToken Secret `yaml:"bearer_token,omitempty"`
	// The bearer token file for the targets.
	BearerTokenFile string `yaml:"bearer_token_file,omitempty"`
	// HTTP proxy server to use to connect to the targets.
	ProxyURL URL `yaml:"proxy_url,omitempty"`
	// TLSConfig to use to connect to the targets.
	TLSConfig TLSConfig `yaml:"tls_config,omitempty"`

	// Catches all undefined fields and must be empty after parsing.
	XXX map[string]interface{} `yaml:",inline"`
}

// Validate validates the HTTPClientConfig to check only one of BearerToken,
// BasicAuth and BearerTokenFile is configured.
func (c *HTTPClientConfig) Validate() error {
	if len(c.BearerToken) > 0 && len(c.BearerTokenFile) > 0 {
		return fmt.Errorf("at most one of bearer_token & bearer_token_file must be configured")
	}
	if c.BasicAuth != nil && (len(c.BearerToken) > 0 || len(c.BearerTokenFile) > 0) {
		return fmt.Errorf("at most one of basic_auth, bearer_token & bearer_token_file must be configured")
	}
	return nil
}

// UnmarshalYAML implements the yaml.Unmarshaler interface
func (c *HTTPClientConfig) UnmarshalYAML(unmarshal func(interface{}) error) error {
	type plain HTTPClientConfig
	err := unmarshal((*plain)(c))
	if err != nil {
		return err
	}
	err = c.Validate()
	if err != nil {
		return c.Validate()
	}
	return checkOverflow(c.XXX, "http_client_config")
}

// UnmarshalYAML implements the yaml.Unmarshaler interface.
func (a *BasicAuth) UnmarshalYAML(unmarshal func(interface{}) error) error {
	type plain BasicAuth
	err := unmarshal((*plain)(a))
	if err != nil {
		return err
	}
	return checkOverflow(a.XXX, "basic_auth")
}

// NewHTTPClientFromConfig returns a new HTTP client configured for the
// given config.HTTPClientConfig.
func NewHTTPClientFromConfig(cfg *HTTPClientConfig) (*http.Client, error) {
	tlsConfig, err := NewTLSConfig(&cfg.TLSConfig)
	if err != nil {
		return nil, err
	}

	// It's the caller's job to handle timeouts
	var rt http.RoundTripper = &http.Transport{
		Proxy:             http.ProxyURL(cfg.ProxyURL.URL),
		DisableKeepAlives: true,
		TLSClientConfig:   tlsConfig,
	}

	// If a bearer token is provided, create a round tripper that will set the
	// Authorization header correctly on each request.
	bearerToken := cfg.BearerToken
	if len(bearerToken) == 0 && len(cfg.BearerTokenFile) > 0 {
		b, err := ioutil.ReadFile(cfg.BearerTokenFile)
		if err != nil {
			return nil, fmt.Errorf("unable to read bearer token file %s: %s", cfg.BearerTokenFile, err)
		}
		bearerToken = Secret(strings.TrimSpace(string(b)))
	}

	if len(bearerToken) > 0 {
		rt = NewBearerAuthRoundTripper(bearerToken, rt)
	}

	if cfg.BasicAuth != nil {
		rt = NewBasicAuthRoundTripper(cfg.BasicAuth.Username, Secret(cfg.BasicAuth.Password), rt)
	}

	// Return a new client with the configured round tripper.
	return &http.Client{Transport: rt}, nil
}

type bearerAuthRoundTripper struct {
	bearerToken Secret
	rt          http.RoundTripper
}

type basicAuthRoundTripper struct {
	username string
	password Secret
	rt       http.RoundTripper
}

// NewBasicAuthRoundTripper will apply a BASIC auth authorization header to a request unless it has
// already been set.
func NewBasicAuthRoundTripper(username string, password Secret, rt http.RoundTripper) http.RoundTripper {
	return &basicAuthRoundTripper{username, password, rt}
}

func (rt *bearerAuthRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	if len(req.Header.Get("Authorization")) == 0 {
		req = cloneRequest(req)
		req.Header.Set("Authorization", "Bearer "+string(rt.bearerToken))
	}

	return rt.rt.RoundTrip(req)
}

// NewBearerAuthRoundTripper adds the provided bearer token to a request unless the authorization
// header has already been set.
func NewBearerAuthRoundTripper(bearer Secret, rt http.RoundTripper) http.RoundTripper {
	return &bearerAuthRoundTripper{bearer, rt}
}

func (rt *basicAuthRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	if len(req.Header.Get("Authorization")) != 0 {
		return rt.RoundTrip(req)
	}
	req = cloneRequest(req)
	req.SetBasicAuth(rt.username, string(rt.password))
	return rt.rt.RoundTrip(req)
}

// cloneRequest returns a clone of the provided *http.Request.
// The clone is a shallow copy of the struct and its Header map.
func cloneRequest(r *http.Request) *http.Request {
	// Shallow copy of the struct.
	r2 := new(http.Request)
	*r2 = *r
	// Deep copy of the Header.
	r2.Header = make(http.Header)
	for k, s := range r.Header {
		r2.Header[k] = s
	}
	return r2
}

// NewTLSConfig creates a new tls.Config from the given config.TLSConfig.
func NewTLSConfig(cfg *TLSConfig) (*tls.Config, error) {
	tlsConfig := &tls.Config{InsecureSkipVerify: cfg.InsecureSkipVerify}

	// If a CA cert is provided then let's read it in so we can validate the
	// scrape target's certificate properly.
	if len(cfg.CAFile) > 0 {
		caCertPool := x509.NewCertPool()
		// Load CA cert.
		caCert, err := ioutil.ReadFile(cfg.CAFile)
		if err != nil {
			return nil, fmt.Errorf("unable to use specified CA cert %s: %s", cfg.CAFile, err)
		}
		caCertPool.AppendCertsFromPEM(caCert)
		tlsConfig.RootCAs = caCertPool
	}

	if len(cfg.ServerName) > 0 {
		tlsConfig.ServerName = cfg.ServerName
	}

	// If a client cert & key is provided then configure TLS config accordingly.
	if len(cfg.CertFile) > 0 && len(cfg.KeyFile) == 0 {
		return nil, fmt.Errorf("client cert file %q specified without client key file", cfg.CertFile)
	} else if len(cfg.KeyFile) > 0 && len(cfg.CertFile) == 0 {
		return nil, fmt.Errorf("client key file %q specified without client cert file", cfg.KeyFile)
	} else if len(cfg.CertFile) > 0 && len(cfg.KeyFile) > 0 {
		cert, err := tls.LoadX509KeyPair(cfg.CertFile, cfg.KeyFile)
		if err != nil {
			return nil, fmt.Errorf("unable to use specified client cert (%s) & key (%s): %s", cfg.CertFile, cfg.KeyFile, err)
		}
		tlsConfig.Certificates = []tls.Certificate{cert}
	}
	tlsConfig.BuildNameToCertificate()

	return tlsConfig, nil
}

// TLSConfig configures the options for TLS connections.
type TLSConfig struct {
	// The CA cert to use for the targets.
	CAFile string `yaml:"ca_file,omitempty"`
	// The client cert file for the targets.
	CertFile string `yaml:"cert_file,omitempty"`
	// The client key file for the targets.
	KeyFile string `yaml:"key_file,omitempty"`
	// Used to verify the hostname for the targets.
	ServerName string `yaml:"server_name,omitempty"`
	// Disable target certificate validation.
	InsecureSkipVerify bool `yaml:"insecure_skip_verify"`

	// Catches all undefined fields and must be empty after parsing.
	XXX map[string]interface{} `yaml:",inline"`
}

// UnmarshalYAML implements the yaml.Unmarshaler interface.
func (c *TLSConfig) UnmarshalYAML(unmarshal func(interface{}) error) error {
	type plain TLSConfig
	if err := unmarshal((*plain)(c)); err != nil {
		return err
	}
	return checkOverflow(c.XXX, "TLS config")
}

func (c HTTPClientConfig) String() string {
	b, err := yaml.Marshal(c)
	if err != nil {
		return fmt.Sprintf("<error creating http client config string: %s>", err)
	}
	return string(b)
}
