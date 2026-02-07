package wait

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"io"
	"time"
)

// Validate we implement interface.
var _ Strategy = (*TLSStrategy)(nil)

// TLSStrategy is a strategy for handling TLS.
type TLSStrategy struct {
	// General Settings.
	timeout      *time.Duration
	pollInterval time.Duration

	// Custom Settings.
	certFiles *x509KeyPair
	rootFiles []string

	// State.
	tlsConfig *tls.Config
}

// x509KeyPair is a pair of certificate and key files.
type x509KeyPair struct {
	certPEMFile string
	keyPEMFile  string
}

// ForTLSCert returns a CertStrategy that will add a Certificate to the [tls.Config]
// constructed from PEM formatted certificate key file pair in the container.
func ForTLSCert(certPEMFile, keyPEMFile string) *TLSStrategy {
	return &TLSStrategy{
		certFiles: &x509KeyPair{
			certPEMFile: certPEMFile,
			keyPEMFile:  keyPEMFile,
		},
		tlsConfig:    &tls.Config{},
		pollInterval: defaultPollInterval(),
	}
}

// ForTLSRootCAs returns a CertStrategy that sets the root CAs for the [tls.Config]
// using the given PEM formatted files from the container.
func ForTLSRootCAs(pemFiles ...string) *TLSStrategy {
	return &TLSStrategy{
		rootFiles:    pemFiles,
		tlsConfig:    &tls.Config{},
		pollInterval: defaultPollInterval(),
	}
}

// WithRootCAs sets the root CAs for the [tls.Config] using the given files from
// the container.
func (ws *TLSStrategy) WithRootCAs(files ...string) *TLSStrategy {
	ws.rootFiles = files
	return ws
}

// WithCert sets the [tls.Config] Certificates using the given files from the container.
func (ws *TLSStrategy) WithCert(certPEMFile, keyPEMFile string) *TLSStrategy {
	ws.certFiles = &x509KeyPair{
		certPEMFile: certPEMFile,
		keyPEMFile:  keyPEMFile,
	}
	return ws
}

// WithServerName sets the server for the [tls.Config].
func (ws *TLSStrategy) WithServerName(serverName string) *TLSStrategy {
	ws.tlsConfig.ServerName = serverName
	return ws
}

// WithStartupTimeout can be used to change the default startup timeout.
func (ws *TLSStrategy) WithStartupTimeout(startupTimeout time.Duration) *TLSStrategy {
	ws.timeout = &startupTimeout
	return ws
}

// WithPollInterval can be used to override the default polling interval of 100 milliseconds.
func (ws *TLSStrategy) WithPollInterval(pollInterval time.Duration) *TLSStrategy {
	ws.pollInterval = pollInterval
	return ws
}

// TLSConfig returns the TLS config once the strategy is ready.
// If the strategy is nil, it returns nil.
func (ws *TLSStrategy) TLSConfig() *tls.Config {
	if ws == nil {
		return nil
	}

	return ws.tlsConfig
}

// WaitUntilReady implements the [Strategy] interface.
// It waits for the CA, client cert and key files to be available in the container and
// uses them to setup the TLS config.
func (ws *TLSStrategy) WaitUntilReady(ctx context.Context, target StrategyTarget) error {
	size := len(ws.rootFiles)
	if ws.certFiles != nil {
		size += 2
	}
	strategies := make([]Strategy, 0, size)
	for _, file := range ws.rootFiles {
		strategies = append(strategies,
			ForFile(file).WithMatcher(func(r io.Reader) error {
				buf, err := io.ReadAll(r)
				if err != nil {
					return fmt.Errorf("read CA cert file %q: %w", file, err)
				}

				if ws.tlsConfig.RootCAs == nil {
					ws.tlsConfig.RootCAs = x509.NewCertPool()
				}

				if !ws.tlsConfig.RootCAs.AppendCertsFromPEM(buf) {
					return fmt.Errorf("invalid CA cert file %q", file)
				}

				return nil
			}).WithPollInterval(ws.pollInterval),
		)
	}

	if ws.certFiles != nil {
		var certPEMBlock []byte
		strategies = append(strategies,
			ForFile(ws.certFiles.certPEMFile).WithMatcher(func(r io.Reader) error {
				var err error
				if certPEMBlock, err = io.ReadAll(r); err != nil {
					return fmt.Errorf("read certificate cert %q: %w", ws.certFiles.certPEMFile, err)
				}

				return nil
			}).WithPollInterval(ws.pollInterval),
			ForFile(ws.certFiles.keyPEMFile).WithMatcher(func(r io.Reader) error {
				keyPEMBlock, err := io.ReadAll(r)
				if err != nil {
					return fmt.Errorf("read certificate key %q: %w", ws.certFiles.keyPEMFile, err)
				}

				cert, err := tls.X509KeyPair(certPEMBlock, keyPEMBlock)
				if err != nil {
					return fmt.Errorf("x509 key pair %q %q: %w", ws.certFiles.certPEMFile, ws.certFiles.keyPEMFile, err)
				}

				ws.tlsConfig.Certificates = []tls.Certificate{cert}

				return nil
			}).WithPollInterval(ws.pollInterval),
		)
	}

	strategy := ForAll(strategies...)
	if ws.timeout != nil {
		strategy.WithStartupTimeout(*ws.timeout)
	}

	return strategy.WaitUntilReady(ctx, target)
}
