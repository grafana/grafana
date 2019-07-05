package dsig

import (
	"crypto/rsa"
	"crypto/tls"
	"fmt"
)

//Well-known errors
var (
	ErrNonRSAKey           = fmt.Errorf("Private key was not RSA")
	ErrMissingCertificates = fmt.Errorf("No public certificates provided")
)

//TLSCertKeyStore wraps the stdlib tls.Certificate to return its contained key
//and certs.
type TLSCertKeyStore tls.Certificate

//GetKeyPair implements X509KeyStore using the underlying tls.Certificate
func (d TLSCertKeyStore) GetKeyPair() (*rsa.PrivateKey, []byte, error) {
	pk, ok := d.PrivateKey.(*rsa.PrivateKey)

	if !ok {
		return nil, nil, ErrNonRSAKey
	}

	if len(d.Certificate) < 1 {
		return nil, nil, ErrMissingCertificates
	}

	crt := d.Certificate[0]

	return pk, crt, nil
}

//GetChain impliments X509ChainStore using the underlying tls.Certificate
func (d TLSCertKeyStore) GetChain() ([][]byte, error) {
	return d.Certificate, nil
}
