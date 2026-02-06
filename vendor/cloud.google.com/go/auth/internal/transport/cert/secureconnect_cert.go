// Copyright 2023 Google LLC
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

package cert

import (
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"os/user"
	"path/filepath"
	"sync"
	"time"
)

const (
	metadataPath = ".secureConnect"
	metadataFile = "context_aware_metadata.json"
)

type secureConnectSource struct {
	metadata secureConnectMetadata

	// Cache the cert to avoid executing helper command repeatedly.
	cachedCertMutex sync.Mutex
	cachedCert      *tls.Certificate
}

type secureConnectMetadata struct {
	Cmd []string `json:"cert_provider_command"`
}

// NewSecureConnectProvider creates a certificate source using
// the Secure Connect Helper and its associated metadata file.
//
// The configFilePath points to the location of the context aware metadata file.
// If configFilePath is empty, use the default context aware metadata location.
func NewSecureConnectProvider(configFilePath string) (Provider, error) {
	if configFilePath == "" {
		user, err := user.Current()
		if err != nil {
			// Error locating the default config means Secure Connect is not supported.
			return nil, errSourceUnavailable
		}
		configFilePath = filepath.Join(user.HomeDir, metadataPath, metadataFile)
	}

	file, err := os.ReadFile(configFilePath)
	if err != nil {
		// Config file missing means Secure Connect is not supported.
		// There are non-os.ErrNotExist errors that may be returned.
		// (e.g. if the home directory is /dev/null, *nix systems will
		// return ENOTDIR instead of ENOENT)
		return nil, errSourceUnavailable
	}

	var metadata secureConnectMetadata
	if err := json.Unmarshal(file, &metadata); err != nil {
		return nil, fmt.Errorf("cert: could not parse JSON in %q: %w", configFilePath, err)
	}
	if err := validateMetadata(metadata); err != nil {
		return nil, fmt.Errorf("cert: invalid config in %q: %w", configFilePath, err)
	}
	return (&secureConnectSource{
		metadata: metadata,
	}).getClientCertificate, nil
}

func validateMetadata(metadata secureConnectMetadata) error {
	if len(metadata.Cmd) == 0 {
		return errors.New("empty cert_provider_command")
	}
	return nil
}

func (s *secureConnectSource) getClientCertificate(info *tls.CertificateRequestInfo) (*tls.Certificate, error) {
	s.cachedCertMutex.Lock()
	defer s.cachedCertMutex.Unlock()
	if s.cachedCert != nil && !isCertificateExpired(s.cachedCert) {
		return s.cachedCert, nil
	}
	// Expand OS environment variables in the cert provider command such as "$HOME".
	for i := 0; i < len(s.metadata.Cmd); i++ {
		s.metadata.Cmd[i] = os.ExpandEnv(s.metadata.Cmd[i])
	}
	command := s.metadata.Cmd
	data, err := exec.Command(command[0], command[1:]...).Output()
	if err != nil {
		return nil, err
	}
	cert, err := tls.X509KeyPair(data, data)
	if err != nil {
		return nil, err
	}
	s.cachedCert = &cert
	return &cert, nil
}

// isCertificateExpired returns true if the given cert is expired or invalid.
func isCertificateExpired(cert *tls.Certificate) bool {
	if len(cert.Certificate) == 0 {
		return true
	}
	parsed, err := x509.ParseCertificate(cert.Certificate[0])
	if err != nil {
		return true
	}
	return time.Now().After(parsed.NotAfter)
}
