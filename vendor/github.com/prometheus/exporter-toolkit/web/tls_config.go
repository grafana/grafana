// Copyright 2019 The Prometheus Authors
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

package web

import (
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/coreos/go-systemd/v22/activation"
	"github.com/mdlayher/vsock"
	config_util "github.com/prometheus/common/config"
	"golang.org/x/sync/errgroup"
	"gopkg.in/yaml.v2"
)

var (
	errNoTLSConfig = errors.New("TLS config is not present")
	ErrNoListeners = errors.New("no web listen address or systemd socket flag specified")
)

type Config struct {
	TLSConfig  TLSConfig                     `yaml:"tls_server_config"`
	HTTPConfig HTTPConfig                    `yaml:"http_server_config"`
	Users      map[string]config_util.Secret `yaml:"basic_auth_users"`
}

type TLSConfig struct {
	TLSCert                  string             `yaml:"cert"`
	TLSKey                   config_util.Secret `yaml:"key"`
	ClientCAsText            string             `yaml:"client_ca"`
	TLSCertPath              string             `yaml:"cert_file"`
	TLSKeyPath               string             `yaml:"key_file"`
	ClientAuth               string             `yaml:"client_auth_type"`
	ClientCAs                string             `yaml:"client_ca_file"`
	CipherSuites             []Cipher           `yaml:"cipher_suites"`
	CurvePreferences         []Curve            `yaml:"curve_preferences"`
	MinVersion               TLSVersion         `yaml:"min_version"`
	MaxVersion               TLSVersion         `yaml:"max_version"`
	PreferServerCipherSuites bool               `yaml:"prefer_server_cipher_suites"`
	ClientAllowedSans        []string           `yaml:"client_allowed_sans"`
}

type FlagConfig struct {
	WebListenAddresses *[]string
	WebSystemdSocket   *bool
	WebConfigFile      *string
}

// SetDirectory joins any relative file paths with dir.
func (t *TLSConfig) SetDirectory(dir string) {
	t.TLSCertPath = config_util.JoinDir(dir, t.TLSCertPath)
	t.TLSKeyPath = config_util.JoinDir(dir, t.TLSKeyPath)
	t.ClientCAs = config_util.JoinDir(dir, t.ClientCAs)
}

// VerifyPeerCertificate will check the SAN entries of the client cert if there is configuration for it
func (t *TLSConfig) VerifyPeerCertificate(rawCerts [][]byte, _ [][]*x509.Certificate) error {
	// sender cert comes first, see https://www.rfc-editor.org/rfc/rfc5246#section-7.4.2
	cert, err := x509.ParseCertificate(rawCerts[0])
	if err != nil {
		return fmt.Errorf("error parsing client certificate: %s", err)
	}

	// Build up a slice of strings with all Subject Alternate Name values
	sanValues := append(cert.DNSNames, cert.EmailAddresses...)

	for _, ip := range cert.IPAddresses {
		sanValues = append(sanValues, ip.String())
	}

	for _, uri := range cert.URIs {
		sanValues = append(sanValues, uri.String())
	}

	for _, sanValue := range sanValues {
		for _, allowedSan := range t.ClientAllowedSans {
			if sanValue == allowedSan {
				return nil
			}
		}
	}

	return fmt.Errorf("could not find allowed SANs in client cert, found: %v", t.ClientAllowedSans)
}

type HTTPConfig struct {
	HTTP2  bool              `yaml:"http2"`
	Header map[string]string `yaml:"headers,omitempty"`
}

func getConfig(configPath string) (*Config, error) {
	content, err := os.ReadFile(configPath)
	if err != nil {
		return nil, err
	}
	c := &Config{
		TLSConfig: TLSConfig{
			MinVersion:               tls.VersionTLS12,
			MaxVersion:               tls.VersionTLS13,
			PreferServerCipherSuites: true,
		},
		HTTPConfig: HTTPConfig{HTTP2: true},
	}
	err = yaml.UnmarshalStrict(content, c)
	if err == nil {
		err = validateHeaderConfig(c.HTTPConfig.Header)
	}
	c.TLSConfig.SetDirectory(filepath.Dir(configPath))
	return c, err
}

func getTLSConfig(configPath string) (*tls.Config, error) {
	c, err := getConfig(configPath)
	if err != nil {
		return nil, err
	}
	return ConfigToTLSConfig(&c.TLSConfig)
}

func validateTLSPaths(c *TLSConfig) error {
	if c.TLSCertPath == "" && c.TLSCert == "" &&
		c.TLSKeyPath == "" && c.TLSKey == "" &&
		c.ClientCAs == "" && c.ClientCAsText == "" &&
		c.ClientAuth == "" {
		return errNoTLSConfig
	}

	if c.TLSCertPath == "" && c.TLSCert == "" {
		return errors.New("missing one of cert or cert_file")
	}

	if c.TLSKeyPath == "" && c.TLSKey == "" {
		return errors.New("missing one of key or key_file")
	}

	return nil
}

// ConfigToTLSConfig generates the golang tls.Config from the TLSConfig struct.
func ConfigToTLSConfig(c *TLSConfig) (*tls.Config, error) {
	if err := validateTLSPaths(c); err != nil {
		return nil, err
	}

	loadCert := func() (*tls.Certificate, error) {
		var certData, keyData []byte
		var err error

		if c.TLSCertPath != "" {
			certData, err = os.ReadFile(c.TLSCertPath)
			if err != nil {
				return nil, fmt.Errorf("failed to read cert_file (%s): %s", c.TLSCertPath, err)
			}
		} else {
			certData = []byte(c.TLSCert)
		}

		if c.TLSKeyPath != "" {
			keyData, err = os.ReadFile(c.TLSKeyPath)
			if err != nil {
				return nil, fmt.Errorf("failed to read key_file (%s): %s", c.TLSKeyPath, err)
			}
		} else {
			keyData = []byte(c.TLSKey)
		}

		cert, err := tls.X509KeyPair(certData, keyData)
		if err != nil {
			return nil, fmt.Errorf("failed to load X509KeyPair: %w", err)
		}
		return &cert, nil
	}

	// Confirm that certificate and key paths are valid.
	if _, err := loadCert(); err != nil {
		return nil, err
	}

	cfg := &tls.Config{
		MinVersion:               (uint16)(c.MinVersion),
		MaxVersion:               (uint16)(c.MaxVersion),
		PreferServerCipherSuites: c.PreferServerCipherSuites,
	}

	cfg.GetCertificate = func(*tls.ClientHelloInfo) (*tls.Certificate, error) {
		return loadCert()
	}

	var cf []uint16
	for _, c := range c.CipherSuites {
		cf = append(cf, (uint16)(c))
	}
	if len(cf) > 0 {
		cfg.CipherSuites = cf
	}

	var cp []tls.CurveID
	for _, c := range c.CurvePreferences {
		cp = append(cp, (tls.CurveID)(c))
	}
	if len(cp) > 0 {
		cfg.CurvePreferences = cp
	}

	if c.ClientCAs != "" {
		clientCAPool := x509.NewCertPool()
		clientCAFile, err := os.ReadFile(c.ClientCAs)
		if err != nil {
			return nil, err
		}
		clientCAPool.AppendCertsFromPEM(clientCAFile)
		cfg.ClientCAs = clientCAPool
	} else if c.ClientCAsText != "" {
		clientCAPool := x509.NewCertPool()
		clientCAPool.AppendCertsFromPEM([]byte(c.ClientCAsText))
		cfg.ClientCAs = clientCAPool
	}

	if c.ClientAllowedSans != nil {
		// verify that the client cert contains an allowed SAN
		cfg.VerifyPeerCertificate = c.VerifyPeerCertificate
	}

	switch c.ClientAuth {
	case "RequestClientCert":
		cfg.ClientAuth = tls.RequestClientCert
	case "RequireAnyClientCert", "RequireClientCert": // Preserved for backwards compatibility.
		cfg.ClientAuth = tls.RequireAnyClientCert
	case "VerifyClientCertIfGiven":
		cfg.ClientAuth = tls.VerifyClientCertIfGiven
	case "RequireAndVerifyClientCert":
		cfg.ClientAuth = tls.RequireAndVerifyClientCert
	case "", "NoClientCert":
		cfg.ClientAuth = tls.NoClientCert
	default:
		return nil, errors.New("Invalid ClientAuth: " + c.ClientAuth)
	}

	if (c.ClientCAs != "" || c.ClientCAsText != "") && cfg.ClientAuth == tls.NoClientCert {
		return nil, errors.New("Client CA's have been configured without a Client Auth Policy")
	}

	return cfg, nil
}

// ServeMultiple starts the server on the given listeners. The FlagConfig is
// also passed on to Serve.
func ServeMultiple(listeners []net.Listener, server *http.Server, flags *FlagConfig, logger *slog.Logger) error {
	errs := new(errgroup.Group)
	for _, l := range listeners {
		l := l
		errs.Go(func() error {
			return Serve(l, server, flags, logger)
		})
	}
	return errs.Wait()
}

// ListenAndServe starts the server on addresses given in WebListenAddresses in
// the FlagConfig. When address starts looks like vsock://:{port}, it listens on
// vsock. More info check https://wiki.qemu.org/Features/VirtioVsock .
// Or instead uses systemd socket activated listeners if WebSystemdSocket in the
// FlagConfig is true.
// The FlagConfig is also passed on to ServeMultiple.
func ListenAndServe(server *http.Server, flags *FlagConfig, logger *slog.Logger) error {
	if flags.WebSystemdSocket == nil && (flags.WebListenAddresses == nil || len(*flags.WebListenAddresses) == 0) {
		return ErrNoListeners
	}

	if flags.WebSystemdSocket != nil && *flags.WebSystemdSocket {
		logger.Info("Listening on systemd activated listeners instead of port listeners.")
		listeners, err := activation.Listeners()
		if err != nil {
			return err
		}
		if len(listeners) < 1 {
			return errors.New("no socket activation file descriptors found")
		}
		return ServeMultiple(listeners, server, flags, logger)
	}

	listeners := make([]net.Listener, 0, len(*flags.WebListenAddresses))
	for _, address := range *flags.WebListenAddresses {
		var err error
		var listener net.Listener
		if strings.HasPrefix(address, "vsock://") {
			port, err := parseVsockPort(address)
			if err != nil {
				return err
			}
			listener, err = vsock.Listen(port, nil)
			if err != nil {
				return err
			}
		} else {
			listener, err = net.Listen("tcp", address)
			if err != nil {
				return err
			}
		}
		defer listener.Close()
		listeners = append(listeners, listener)
	}
	return ServeMultiple(listeners, server, flags, logger)
}

func parseVsockPort(address string) (uint32, error) {
	uri, err := url.Parse(address)
	if err != nil {
		return 0, err
	}
	_, portStr, err := net.SplitHostPort(uri.Host)
	if err != nil {
		return 0, err
	}
	port, err := strconv.ParseUint(portStr, 10, 32)
	if err != nil {
		return 0, err
	}
	return uint32(port), nil
}

// Server starts the server on the given listener. Based on the file path
// WebConfigFile in the FlagConfig, TLS or basic auth could be enabled.
func Serve(l net.Listener, server *http.Server, flags *FlagConfig, logger *slog.Logger) error {
	logger.Info("Listening on", "address", l.Addr().String())
	tlsConfigPath := *flags.WebConfigFile
	if tlsConfigPath == "" {
		logger.Info("TLS is disabled.", "http2", false, "address", l.Addr().String())
		return server.Serve(l)
	}

	if err := validateUsers(tlsConfigPath); err != nil {
		return err
	}

	// Setup basic authentication.
	var handler http.Handler = http.DefaultServeMux
	if server.Handler != nil {
		handler = server.Handler
	}

	c, err := getConfig(tlsConfigPath)
	if err != nil {
		return err
	}

	server.Handler = &webHandler{
		tlsConfigPath: tlsConfigPath,
		logger:        logger,
		handler:       handler,
		cache:         newCache(),
	}

	config, err := ConfigToTLSConfig(&c.TLSConfig)
	switch err {
	case nil:
		if !c.HTTPConfig.HTTP2 {
			server.TLSNextProto = make(map[string]func(*http.Server, *tls.Conn, http.Handler))
		}
		// Valid TLS config.
		logger.Info("TLS is enabled.", "http2", c.HTTPConfig.HTTP2, "address", l.Addr().String())
	case errNoTLSConfig:
		// No TLS config, back to plain HTTP.
		logger.Info("TLS is disabled.", "http2", false, "address", l.Addr().String())
		return server.Serve(l)
	default:
		// Invalid TLS config.
		return err
	}

	server.TLSConfig = config

	// Set the GetConfigForClient method of the HTTPS server so that the config
	// and certs are reloaded on new connections.
	server.TLSConfig.GetConfigForClient = func(*tls.ClientHelloInfo) (*tls.Config, error) {
		config, err := getTLSConfig(tlsConfigPath)
		if err != nil {
			return nil, err
		}
		config.NextProtos = server.TLSConfig.NextProtos
		return config, nil
	}
	return server.ServeTLS(l, "", "")
}

// Validate configuration file by reading the configuration and the certificates.
func Validate(tlsConfigPath string) error {
	if tlsConfigPath == "" {
		return nil
	}
	if err := validateUsers(tlsConfigPath); err != nil {
		return err
	}
	c, err := getConfig(tlsConfigPath)
	if err != nil {
		return err
	}
	_, err = ConfigToTLSConfig(&c.TLSConfig)
	if err == errNoTLSConfig {
		return nil
	}
	return err
}

type Cipher uint16

func (c *Cipher) UnmarshalYAML(unmarshal func(interface{}) error) error {
	var s string
	err := unmarshal((*string)(&s))
	if err != nil {
		return err
	}
	for _, cs := range tls.CipherSuites() {
		if cs.Name == s {
			*c = (Cipher)(cs.ID)
			return nil
		}
	}
	return errors.New("unknown cipher: " + s)
}

func (c Cipher) MarshalYAML() (interface{}, error) {
	return tls.CipherSuiteName((uint16)(c)), nil
}

type Curve tls.CurveID

var curves = map[string]Curve{
	"CurveP256": (Curve)(tls.CurveP256),
	"CurveP384": (Curve)(tls.CurveP384),
	"CurveP521": (Curve)(tls.CurveP521),
	"X25519":    (Curve)(tls.X25519),
}

func (c *Curve) UnmarshalYAML(unmarshal func(interface{}) error) error {
	var s string
	err := unmarshal((*string)(&s))
	if err != nil {
		return err
	}
	if curveid, ok := curves[s]; ok {
		*c = curveid
		return nil
	}
	return errors.New("unknown curve: " + s)
}

func (c *Curve) MarshalYAML() (interface{}, error) {
	for s, curveid := range curves {
		if *c == curveid {
			return s, nil
		}
	}
	return fmt.Sprintf("%v", c), nil
}

type TLSVersion uint16

var tlsVersions = map[string]TLSVersion{
	"TLS13": (TLSVersion)(tls.VersionTLS13),
	"TLS12": (TLSVersion)(tls.VersionTLS12),
	"TLS11": (TLSVersion)(tls.VersionTLS11),
	"TLS10": (TLSVersion)(tls.VersionTLS10),
}

func (tv *TLSVersion) UnmarshalYAML(unmarshal func(interface{}) error) error {
	var s string
	err := unmarshal((*string)(&s))
	if err != nil {
		return err
	}
	if v, ok := tlsVersions[s]; ok {
		*tv = v
		return nil
	}
	return errors.New("unknown TLS version: " + s)
}

func (tv *TLSVersion) MarshalYAML() (interface{}, error) {
	for s, v := range tlsVersions {
		if *tv == v {
			return s, nil
		}
	}
	return fmt.Sprintf("%v", tv), nil
}

// Listen starts the server on the given address. Based on the file
// tlsConfigPath, TLS or basic auth could be enabled.
//
// Deprecated: Use ListenAndServe instead.
func Listen(server *http.Server, flags *FlagConfig, logger *slog.Logger) error {
	return ListenAndServe(server, flags, logger)
}
