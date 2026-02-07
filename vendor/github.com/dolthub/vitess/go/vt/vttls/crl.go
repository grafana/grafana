/*
Copyright 2021 The Vitess Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package vttls

import (
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"fmt"
	"os"
	"time"

	"github.com/dolthub/vitess/go/vt/log"
)

type verifyPeerCertificateFunc func([][]byte, [][]*x509.Certificate) error

func certIsRevoked(cert *x509.Certificate, crl *pkix.CertificateList) bool {
	if crl.HasExpired(time.Now()) {
		log.Warningf("The current Certificate Revocation List (CRL) is past expiry date and must be updated. Revoked certificates will still be rejected in this state.")
	}

	for _, revoked := range crl.TBSCertList.RevokedCertificates {
		if cert.SerialNumber.Cmp(revoked.SerialNumber) == 0 {
			return true
		}
	}
	return false
}

func verifyPeerCertificateAgainstCRL(crl string) (verifyPeerCertificateFunc, error) {
	crlSet, err := loadCRLSet(crl)
	if err != nil {
		return nil, err
	}

	return func(_ [][]byte, verifiedChains [][]*x509.Certificate) error {
		for _, chain := range verifiedChains {
			for i := 0; i < len(chain)-1; i++ {
				cert := chain[i]
				issuerCert := chain[i+1]
				for _, crl := range crlSet {
					if issuerCert.CheckCRLSignature(crl) == nil {
						if certIsRevoked(cert, crl) {
							return fmt.Errorf("Certificate revoked: CommonName=%v", cert.Subject.CommonName)
						}
					}
				}
			}
		}
		return nil
	}, nil
}

func loadCRLSet(crl string) ([]*pkix.CertificateList, error) {
	body, err := os.ReadFile(crl)
	if err != nil {
		return nil, err
	}

	crlSet := make([]*pkix.CertificateList, 0)
	for len(body) > 0 {
		var block *pem.Block
		block, body = pem.Decode(body)
		if block == nil {
			break
		}
		if block.Type != "X509 CRL" {
			continue
		}

		parsedCRL, err := x509.ParseCRL(block.Bytes)
		if err != nil {
			return nil, err
		}
		crlSet = append(crlSet, parsedCRL)
	}
	return crlSet, nil
}
