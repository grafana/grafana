package tls

import (
	"crypto/tls"
	"crypto/x509"
	"flag"
	"fmt"
	"os"
	"strings"

	"github.com/pkg/errors"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"
)

type SecretReader interface {
	ReadSecret(path string) ([]byte, error)
}

type fileReader struct{}

func (f *fileReader) ReadSecret(path string) ([]byte, error) {
	return os.ReadFile(path)
}

// ClientConfig is the config for client TLS.
type ClientConfig struct {
	CertPath           string `yaml:"tls_cert_path" category:"advanced"`
	KeyPath            string `yaml:"tls_key_path" category:"advanced"`
	CAPath             string `yaml:"tls_ca_path" category:"advanced"`
	ServerName         string `yaml:"tls_server_name" category:"advanced"`
	InsecureSkipVerify bool   `yaml:"tls_insecure_skip_verify" category:"advanced"`
	CipherSuites       string `yaml:"tls_cipher_suites" category:"advanced" doc:"description_method=GetTLSCipherSuitesLongDescription"`
	MinVersion         string `yaml:"tls_min_version" category:"advanced"`

	Reader SecretReader `yaml:"-"`
}

var (
	errKeyMissing  = errors.New("certificate given but no key configured")
	errCertMissing = errors.New("key given but no certificate configured")

	tlsVersions = map[string]uint16{
		"VersionTLS10": tls.VersionTLS10,
		"VersionTLS11": tls.VersionTLS11,
		"VersionTLS12": tls.VersionTLS12,
		"VersionTLS13": tls.VersionTLS13,
	}
)

// RegisterFlagsWithPrefix registers flags with prefix.
func (cfg *ClientConfig) RegisterFlagsWithPrefix(prefix string, f *flag.FlagSet) {
	// Trim any trailing "." since we include our own here
	prefix = strings.TrimRight(prefix, ".")

	f.StringVar(&cfg.CertPath, prefix+".tls-cert-path", "", "Path to the client certificate, which will be used for authenticating with the server. Also requires the key path to be configured.")
	f.StringVar(&cfg.KeyPath, prefix+".tls-key-path", "", "Path to the key for the client certificate. Also requires the client certificate to be configured.")
	f.StringVar(&cfg.CAPath, prefix+".tls-ca-path", "", "Path to the CA certificates to validate server certificate against. If not set, the host's root CA certificates are used.")
	f.StringVar(&cfg.ServerName, prefix+".tls-server-name", "", "Override the expected name on the server certificate.")
	f.BoolVar(&cfg.InsecureSkipVerify, prefix+".tls-insecure-skip-verify", false, "Skip validating server certificate.")
	f.StringVar(&cfg.CipherSuites, prefix+".tls-cipher-suites", "", cfg.GetTLSCipherSuitesShortDescription())
	f.StringVar(&cfg.MinVersion, prefix+".tls-min-version", "", "Override the default minimum TLS version. Allowed values: VersionTLS10, VersionTLS11, VersionTLS12, VersionTLS13")
}

func (cfg *ClientConfig) GetTLSCipherSuitesShortDescription() string {
	return "Override the default cipher suite list (separated by commas)."
}

func (cfg *ClientConfig) GetTLSCipherSuitesLongDescription() string {
	text := cfg.GetTLSCipherSuitesShortDescription() + " Allowed values:\n\n"

	text += "Secure Ciphers:\n"
	for _, suite := range tls.CipherSuites() {
		text += fmt.Sprintf("- %s\n", suite.Name)
	}

	text += "\nInsecure Ciphers:\n"
	for _, suite := range tls.InsecureCipherSuites() {
		text += fmt.Sprintf("- %s\n", suite.Name)
	}

	return text
}

// GetTLSConfig initialises tls.Config from config options
func (cfg *ClientConfig) GetTLSConfig() (*tls.Config, error) {
	config := &tls.Config{
		InsecureSkipVerify: cfg.InsecureSkipVerify,
		ServerName:         cfg.ServerName,
	}

	// If Reader interface not provided, default to reading from File
	reader := cfg.Reader
	if reader == nil {
		reader = &fileReader{}
	}

	// Read CA Certificates
	if cfg.CAPath != "" {
		var caCertPool *x509.CertPool
		caCert, err := reader.ReadSecret(cfg.CAPath)
		if err != nil {
			return nil, errors.Wrapf(err, "error loading ca cert: %s", cfg.CAPath)
		}
		caCertPool = x509.NewCertPool()
		caCertPool.AppendCertsFromPEM(caCert)

		config.RootCAs = caCertPool
	}

	loadCert := func() (tls.Certificate, error) {
		cert, err := reader.ReadSecret(cfg.CertPath)
		if err != nil {
			return tls.Certificate{}, errors.Wrapf(err, "error loading client cert: %s", cfg.CertPath)
		}
		key, err := reader.ReadSecret(cfg.KeyPath)
		if err != nil {
			return tls.Certificate{}, errors.Wrapf(err, "error loading client key: %s", cfg.KeyPath)
		}

		clientCert, err := tls.X509KeyPair(cert, key)
		if err != nil {
			return tls.Certificate{}, errors.Wrapf(err, "failed to load TLS certificate %s,%s", cfg.CertPath, cfg.KeyPath)
		}
		return clientCert, nil

	}

	// Read Client Certificate
	if cfg.CertPath != "" || cfg.KeyPath != "" {
		if cfg.CertPath == "" {
			return nil, errCertMissing
		}
		if cfg.KeyPath == "" {
			return nil, errKeyMissing
		}
		// Confirm that certificate and key paths are valid.
		cert, err := loadCert()
		if err != nil {
			return nil, err
		}

		config.GetClientCertificate = func(_ *tls.CertificateRequestInfo) (*tls.Certificate, error) {
			c, err := loadCert()
			if err != nil {
				return nil, err
			}
			return &c, err
		}
		// Allow fallback for callers using this config also for server purposes (i.e., kv/memberlist).
		// Clients will prefer GetClientCertificate, but servers can use Certificates.
		config.Certificates = []tls.Certificate{cert}

	}

	if cfg.MinVersion != "" {
		minVersion, ok := tlsVersions[cfg.MinVersion]
		if !ok {
			return nil, fmt.Errorf("unknown minimum TLS version: %q", cfg.MinVersion)
		}
		config.MinVersion = minVersion
	}

	if cfg.CipherSuites != "" {
		cleanedCipherSuiteNames := strings.ReplaceAll(cfg.CipherSuites, " ", "")
		cipherSuitesNames := strings.Split(cleanedCipherSuiteNames, ",")
		cipherSuites, err := mapCipherNamesToIDs(cipherSuitesNames)
		if err != nil {
			return nil, err
		}
		config.CipherSuites = cipherSuites
	}

	return config, nil
}

// GetGRPCDialOptions creates GRPC DialOptions for TLS
func (cfg *ClientConfig) GetGRPCDialOptions(enabled bool) ([]grpc.DialOption, error) {
	if !enabled {
		return []grpc.DialOption{grpc.WithTransportCredentials(insecure.NewCredentials())}, nil
	}

	tlsConfig, err := cfg.GetTLSConfig()
	if err != nil {
		return nil, errors.Wrap(err, "error creating grpc dial options")
	}

	return []grpc.DialOption{grpc.WithTransportCredentials(credentials.NewTLS(tlsConfig))}, nil
}

func mapCipherNamesToIDs(cipherSuiteNames []string) ([]uint16, error) {
	cipherSuites := []uint16{}
	allCipherSuites := tlsCipherSuites()

	for _, name := range cipherSuiteNames {
		id, ok := allCipherSuites[name]
		if !ok {
			return nil, fmt.Errorf("unsupported cipher suite: %q", name)
		}
		cipherSuites = append(cipherSuites, id)
	}

	return cipherSuites, nil
}

func tlsCipherSuites() map[string]uint16 {
	cipherSuites := map[string]uint16{}

	for _, suite := range tls.CipherSuites() {
		cipherSuites[suite.Name] = suite.ID
	}
	for _, suite := range tls.InsecureCipherSuites() {
		cipherSuites[suite.Name] = suite.ID
	}

	return cipherSuites
}
