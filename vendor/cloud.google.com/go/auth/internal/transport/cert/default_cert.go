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
	"errors"
	"sync"
)

// defaultCertData holds all the variables pertaining to
// the default certificate provider created by [DefaultProvider].
//
// A singleton model is used to allow the provider to be reused
// by the transport layer. As mentioned in [DefaultProvider] (provider nil, nil)
// may be returned to indicate a default provider could not be found, which
// will skip extra tls config in the transport layer .
type defaultCertData struct {
	once     sync.Once
	provider Provider
	err      error
}

var (
	defaultCert defaultCertData
)

// Provider is a function that can be passed into crypto/tls.Config.GetClientCertificate.
type Provider func(*tls.CertificateRequestInfo) (*tls.Certificate, error)

// errSourceUnavailable is a sentinel error to indicate certificate source is unavailable.
var errSourceUnavailable = errors.New("certificate source is unavailable")

// DefaultProvider returns a certificate source using the preferred EnterpriseCertificateProxySource.
// If EnterpriseCertificateProxySource is not available, fall back to the legacy SecureConnectSource.
//
// If neither source is available (due to missing configurations), a nil Source and a nil Error are
// returned to indicate that a default certificate source is unavailable.
func DefaultProvider() (Provider, error) {
	defaultCert.once.Do(func() {
		defaultCert.provider, defaultCert.err = NewWorkloadX509CertProvider("")
		if errors.Is(defaultCert.err, errSourceUnavailable) {
			defaultCert.provider, defaultCert.err = NewEnterpriseCertificateProxyProvider("")
			if errors.Is(defaultCert.err, errSourceUnavailable) {
				defaultCert.provider, defaultCert.err = NewSecureConnectProvider("")
				if errors.Is(defaultCert.err, errSourceUnavailable) {
					defaultCert.provider, defaultCert.err = nil, nil
				}
			}
		}
	})
	return defaultCert.provider, defaultCert.err
}
