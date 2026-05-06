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

	"github.com/googleapis/enterprise-certificate-proxy/client"
)

type ecpSource struct {
	key *client.Key
}

// NewEnterpriseCertificateProxyProvider creates a certificate source
// using the Enterprise Certificate Proxy client, which delegates
// certifcate related operations to an OS-specific "signer binary"
// that communicates with the native keystore (ex. keychain on MacOS).
//
// The configFilePath points to a config file containing relevant parameters
// such as the certificate issuer and the location of the signer binary.
// If configFilePath is empty, the client will attempt to load the config from
// a well-known gcloud location.
func NewEnterpriseCertificateProxyProvider(configFilePath string) (Provider, error) {
	key, err := client.Cred(configFilePath)
	if err != nil {
		// TODO(codyoss): once this is fixed upstream can handle this error a
		// little better here. But be safe for now and assume unavailable.
		return nil, errSourceUnavailable
	}

	return (&ecpSource{
		key: key,
	}).getClientCertificate, nil
}

func (s *ecpSource) getClientCertificate(info *tls.CertificateRequestInfo) (*tls.Certificate, error) {
	var cert tls.Certificate
	cert.PrivateKey = s.key
	cert.Certificate = s.key.CertificateChain()
	return &cert, nil
}
