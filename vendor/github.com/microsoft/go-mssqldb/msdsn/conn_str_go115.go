//go:build go1.15
// +build go1.15

package msdsn

import (
	"crypto/tls"
	"crypto/x509"
	"fmt"
)

func setupTLSCommonName(config *tls.Config, pem []byte) error {
	// fix for https://github.com/denisenkom/go-mssqldb/issues/704
	// A SSL/TLS certificate Common Name (CN) containing the ":" character
	// (which is a non-standard character) will cause normal verification to fail.
	// Since the VerifyConnection callback runs after normal certificate
	// verification, confirm that SetupTLS() has been called
	// with "insecureSkipVerify=false", then InsecureSkipVerify must be set to true
	// for this VerifyConnection callback to accomplish certificate verification.
	config.InsecureSkipVerify = true
	config.VerifyConnection = func(cs tls.ConnectionState) error {
		commonName := cs.PeerCertificates[0].Subject.CommonName
		if commonName != cs.ServerName {
			return fmt.Errorf("invalid certificate name %q, expected %q", commonName, cs.ServerName)
		}
		opts := x509.VerifyOptions{
			Roots:         nil,
			Intermediates: x509.NewCertPool(),
		}
		opts.Intermediates.AppendCertsFromPEM(pem)
		_, err := cs.PeerCertificates[0].Verify(opts)
		return err
	}
	return nil
}
