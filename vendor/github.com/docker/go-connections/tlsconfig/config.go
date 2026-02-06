// Package tlsconfig provides primitives to retrieve secure-enough TLS configurations for both clients and servers.
//
// As a reminder from https://golang.org/pkg/crypto/tls/#Config:
//
//	A Config structure is used to configure a TLS client or server. After one has been passed to a TLS function it must not be modified.
//	A Config may be reused; the tls package will also not modify it.
package tlsconfig

import (
	"crypto/tls"
	"crypto/x509"
	"encoding/pem"
	"errors"
	"fmt"
	"os"
)

// Options represents the information needed to create client and server TLS configurations.
type Options struct {
	CAFile string

	// If either CertFile or KeyFile is empty, Client() will not load them
	// preventing the client from authenticating to the server.
	// However, Server() requires them and will error out if they are empty.
	CertFile string
	KeyFile  string

	// client-only option
	InsecureSkipVerify bool
	// server-only option
	ClientAuth tls.ClientAuthType
	// If ExclusiveRootPools is set, then if a CA file is provided, the root pool used for TLS
	// creds will include exclusively the roots in that CA file.  If no CA file is provided,
	// the system pool will be used.
	ExclusiveRootPools bool
	MinVersion         uint16
}

// DefaultServerAcceptedCiphers should be uses by code which already has a crypto/tls
// options struct but wants to use a commonly accepted set of TLS cipher suites, with
// known weak algorithms removed.
var DefaultServerAcceptedCiphers = defaultCipherSuites

// defaultCipherSuites is shared by both client and server as the default set.
var defaultCipherSuites = []uint16{
	tls.TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384,
	tls.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384,
	tls.TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256,
	tls.TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256,
}

// ServerDefault returns a secure-enough TLS configuration for the server TLS configuration.
func ServerDefault(ops ...func(*tls.Config)) *tls.Config {
	return defaultConfig(ops...)
}

// ClientDefault returns a secure-enough TLS configuration for the client TLS configuration.
func ClientDefault(ops ...func(*tls.Config)) *tls.Config {
	return defaultConfig(ops...)
}

// defaultConfig is the default config used by both client and server TLS configuration.
func defaultConfig(ops ...func(*tls.Config)) *tls.Config {
	tlsConfig := &tls.Config{
		// Avoid fallback by default to SSL protocols < TLS1.2
		MinVersion:   tls.VersionTLS12,
		CipherSuites: defaultCipherSuites,
	}

	for _, op := range ops {
		op(tlsConfig)
	}

	return tlsConfig
}

// certPool returns an X.509 certificate pool from `caFile`, the certificate file.
func certPool(caFile string, exclusivePool bool) (*x509.CertPool, error) {
	// If we should verify the server, we need to load a trusted ca
	var (
		pool *x509.CertPool
		err  error
	)
	if exclusivePool {
		pool = x509.NewCertPool()
	} else {
		pool, err = SystemCertPool()
		if err != nil {
			return nil, fmt.Errorf("failed to read system certificates: %v", err)
		}
	}
	pemData, err := os.ReadFile(caFile)
	if err != nil {
		return nil, fmt.Errorf("could not read CA certificate %q: %v", caFile, err)
	}
	if !pool.AppendCertsFromPEM(pemData) {
		return nil, fmt.Errorf("failed to append certificates from PEM file: %q", caFile)
	}
	return pool, nil
}

// allTLSVersions lists all the TLS versions and is used by the code that validates
// a uint16 value as a TLS version.
var allTLSVersions = map[uint16]struct{}{
	tls.VersionTLS10: {},
	tls.VersionTLS11: {},
	tls.VersionTLS12: {},
	tls.VersionTLS13: {},
}

// isValidMinVersion checks that the input value is a valid tls minimum version
func isValidMinVersion(version uint16) bool {
	_, ok := allTLSVersions[version]
	return ok
}

// adjustMinVersion sets the MinVersion on `config`, the input configuration.
// It assumes the current MinVersion on the `config` is the lowest allowed.
func adjustMinVersion(options Options, config *tls.Config) error {
	if options.MinVersion > 0 {
		if !isValidMinVersion(options.MinVersion) {
			return fmt.Errorf("invalid minimum TLS version: %x", options.MinVersion)
		}
		if options.MinVersion < config.MinVersion {
			return fmt.Errorf("requested minimum TLS version is too low. Should be at-least: %x", config.MinVersion)
		}
		config.MinVersion = options.MinVersion
	}

	return nil
}

// errEncryptedKeyDeprecated is produced when we encounter an encrypted
// (password-protected) key. From https://go-review.googlesource.com/c/go/+/264159;
//
// > Legacy PEM encryption as specified in RFC 1423 is insecure by design. Since
// > it does not authenticate the ciphertext, it is vulnerable to padding oracle
// > attacks that can let an attacker recover the plaintext
// >
// > It's unfortunate that we don't implement PKCS#8 encryption so we can't
// > recommend an alternative but PEM encryption is so broken that it's worth
// > deprecating outright.
//
// Also see https://docs.docker.com/go/deprecated/
var errEncryptedKeyDeprecated = errors.New("private key is encrypted; encrypted private keys are obsolete, and not supported")

// getPrivateKey returns the private key in 'keyBytes', in PEM-encoded format.
// It returns an error if the file could not be decoded or was protected by
// a passphrase.
func getPrivateKey(keyBytes []byte) ([]byte, error) {
	// this section makes some small changes to code from notary/tuf/utils/x509.go
	pemBlock, _ := pem.Decode(keyBytes)
	if pemBlock == nil {
		return nil, fmt.Errorf("no valid private key found")
	}

	if x509.IsEncryptedPEMBlock(pemBlock) { //nolint:staticcheck // Ignore SA1019 (IsEncryptedPEMBlock is deprecated)
		return nil, errEncryptedKeyDeprecated
	}

	return keyBytes, nil
}

// getCert returns a Certificate from the CertFile and KeyFile in 'options',
// if the key is encrypted, the Passphrase in 'options' will be used to
// decrypt it.
func getCert(options Options) ([]tls.Certificate, error) {
	if options.CertFile == "" && options.KeyFile == "" {
		return nil, nil
	}

	cert, err := os.ReadFile(options.CertFile)
	if err != nil {
		return nil, err
	}

	prKeyBytes, err := os.ReadFile(options.KeyFile)
	if err != nil {
		return nil, err
	}

	prKeyBytes, err = getPrivateKey(prKeyBytes)
	if err != nil {
		return nil, err
	}

	tlsCert, err := tls.X509KeyPair(cert, prKeyBytes)
	if err != nil {
		return nil, err
	}

	return []tls.Certificate{tlsCert}, nil
}

// Client returns a TLS configuration meant to be used by a client.
func Client(options Options) (*tls.Config, error) {
	tlsConfig := defaultConfig()
	tlsConfig.InsecureSkipVerify = options.InsecureSkipVerify
	if !options.InsecureSkipVerify && options.CAFile != "" {
		CAs, err := certPool(options.CAFile, options.ExclusiveRootPools)
		if err != nil {
			return nil, err
		}
		tlsConfig.RootCAs = CAs
	}

	tlsCerts, err := getCert(options)
	if err != nil {
		return nil, fmt.Errorf("could not load X509 key pair: %w", err)
	}
	tlsConfig.Certificates = tlsCerts

	if err := adjustMinVersion(options, tlsConfig); err != nil {
		return nil, err
	}

	return tlsConfig, nil
}

// Server returns a TLS configuration meant to be used by a server.
func Server(options Options) (*tls.Config, error) {
	tlsConfig := defaultConfig()
	tlsConfig.ClientAuth = options.ClientAuth
	tlsCert, err := tls.LoadX509KeyPair(options.CertFile, options.KeyFile)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, fmt.Errorf("could not load X509 key pair (cert: %q, key: %q): %v", options.CertFile, options.KeyFile, err)
		}
		return nil, fmt.Errorf("error reading X509 key pair - make sure the key is not encrypted (cert: %q, key: %q): %v", options.CertFile, options.KeyFile, err)
	}
	tlsConfig.Certificates = []tls.Certificate{tlsCert}
	if options.ClientAuth >= tls.VerifyClientCertIfGiven && options.CAFile != "" {
		CAs, err := certPool(options.CAFile, options.ExclusiveRootPools)
		if err != nil {
			return nil, err
		}
		tlsConfig.ClientCAs = CAs
	}

	if err := adjustMinVersion(options, tlsConfig); err != nil {
		return nil, err
	}

	return tlsConfig, nil
}
