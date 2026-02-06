// Copyright 2024 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package externalaccount

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"io/fs"
	"net/http"
	"os"
	"strings"
	"time"

	"cloud.google.com/go/auth/internal/transport/cert"
)

// x509Provider implements the subjectTokenProvider type for x509 workload
// identity credentials. This provider retrieves and formats a JSON array
// containing the leaf certificate and trust chain (if provided) as
// base64-encoded strings. This JSON array serves as the subject token for
// mTLS authentication.
type x509Provider struct {
	// TrustChainPath is the path to the file containing the trust chain certificates.
	// The file should contain one or more PEM-encoded certificates.
	TrustChainPath string
	// ConfigFilePath is the path to the configuration file containing the path
	// to the leaf certificate file.
	ConfigFilePath string
}

const pemCertificateHeader = "-----BEGIN CERTIFICATE-----"

func (xp *x509Provider) providerType() string {
	return x509ProviderType
}

// loadLeafCertificate loads and parses the leaf certificate from the specified
// configuration file. It retrieves the certificate path from the config file,
// reads the certificate file, and parses the certificate data.
func loadLeafCertificate(configFilePath string) (*x509.Certificate, error) {
	// Get the path to the certificate file from the configuration file.
	path, err := cert.GetCertificatePath(configFilePath)
	if err != nil {
		return nil, fmt.Errorf("failed to get certificate path from config file: %w", err)
	}
	leafCertBytes, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read leaf certificate file: %w", err)
	}
	// Parse the certificate bytes.
	return parseCertificate(leafCertBytes)
}

// encodeCert encodes a x509.Certificate to a base64 string.
func encodeCert(cert *x509.Certificate) string {
	// cert.Raw contains the raw DER-encoded certificate. Encode the raw certificate bytes to base64.
	return base64.StdEncoding.EncodeToString(cert.Raw)
}

// parseCertificate parses a PEM-encoded certificate from the given byte slice.
func parseCertificate(certData []byte) (*x509.Certificate, error) {
	if len(certData) == 0 {
		return nil, errors.New("invalid certificate data: empty input")
	}
	// Decode the PEM-encoded data.
	block, _ := pem.Decode(certData)
	if block == nil {
		return nil, errors.New("invalid PEM-encoded certificate data: no PEM block found")
	}
	if block.Type != "CERTIFICATE" {
		return nil, fmt.Errorf("invalid PEM-encoded certificate data: expected CERTIFICATE block type, got %s", block.Type)
	}
	// Parse the DER-encoded certificate.
	certificate, err := x509.ParseCertificate(block.Bytes)
	if err != nil {
		return nil, fmt.Errorf("failed to parse certificate: %w", err)
	}
	return certificate, nil
}

// readTrustChain reads a file of PEM-encoded X.509 certificates and returns a slice of parsed certificates.
// It splits the file content into PEM certificate blocks and parses each one.
func readTrustChain(trustChainPath string) ([]*x509.Certificate, error) {
	certificateTrustChain := []*x509.Certificate{}

	// If no trust chain path is provided, return an empty slice.
	if trustChainPath == "" {
		return certificateTrustChain, nil
	}

	// Read the trust chain file.
	trustChainData, err := os.ReadFile(trustChainPath)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return nil, fmt.Errorf("trust chain file not found: %w", err)
		}
		return nil, fmt.Errorf("failed to read trust chain file: %w", err)
	}

	// Split the file content into PEM certificate blocks.
	certBlocks := strings.Split(string(trustChainData), pemCertificateHeader)

	// Iterate over each certificate block.
	for _, certBlock := range certBlocks {
		// Trim whitespace from the block.
		certBlock = strings.TrimSpace(certBlock)

		if certBlock != "" {
			// Add the PEM header to the block.
			certData := pemCertificateHeader + "\n" + certBlock

			// Parse the certificate data.
			cert, err := parseCertificate([]byte(certData))
			if err != nil {
				return nil, fmt.Errorf("error parsing certificate from trust chain file: %w", err)
			}

			// Append the certificate to the trust chain.
			certificateTrustChain = append(certificateTrustChain, cert)
		}
	}

	return certificateTrustChain, nil
}

// subjectToken retrieves the X.509 subject token. It loads the leaf
// certificate and, if a trust chain path is configured, the trust chain
// certificates. It then constructs a JSON array containing the base64-encoded
// leaf certificate and each base64-encoded certificate in the trust chain.
// The leaf certificate must be at the top of the trust chain file. This JSON
// array is used as the subject token for mTLS authentication.
func (xp *x509Provider) subjectToken(context.Context) (string, error) {
	// Load the leaf certificate.
	leafCert, err := loadLeafCertificate(xp.ConfigFilePath)
	if err != nil {
		return "", fmt.Errorf("failed to load leaf certificate: %w", err)
	}

	// Read the trust chain.
	trustChain, err := readTrustChain(xp.TrustChainPath)
	if err != nil {
		return "", fmt.Errorf("failed to read trust chain: %w", err)
	}

	// Initialize the certificate chain with the leaf certificate.
	certChain := []string{encodeCert(leafCert)}

	// If there is a trust chain, add certificates to the certificate chain.
	if len(trustChain) > 0 {
		firstCert := encodeCert(trustChain[0])

		// If the first certificate in the trust chain is not the same as the leaf certificate, add it to the chain.
		if firstCert != certChain[0] {
			certChain = append(certChain, firstCert)
		}

		// Iterate over the remaining certificates in the trust chain.
		for i := 1; i < len(trustChain); i++ {
			encoded := encodeCert(trustChain[i])

			// Return an error if the current certificate is the same as the leaf certificate.
			if encoded == certChain[0] {
				return "", errors.New("the leaf certificate must be at the top of the trust chain file")
			}

			// Add the current certificate to the chain.
			certChain = append(certChain, encoded)
		}
	}

	// Convert the certificate chain to a JSON array of base64-encoded strings.
	jsonChain, err := json.Marshal(certChain)
	if err != nil {
		return "", fmt.Errorf("failed to format certificate data: %w", err)
	}

	// Return the JSON-formatted certificate chain.
	return string(jsonChain), nil

}

// createX509Client creates a new client that is configured with mTLS, using the
// certificate configuration specified in the credential source.
func createX509Client(certificateConfigLocation string) (*http.Client, error) {
	certProvider, err := cert.NewWorkloadX509CertProvider(certificateConfigLocation)
	if err != nil {
		return nil, err
	}
	trans := http.DefaultTransport.(*http.Transport).Clone()

	trans.TLSClientConfig = &tls.Config{
		GetClientCertificate: certProvider,
	}

	// Create a client with default settings plus the X509 workload cert and key.
	client := &http.Client{
		Transport: trans,
		Timeout:   30 * time.Second,
	}

	return client, nil
}
