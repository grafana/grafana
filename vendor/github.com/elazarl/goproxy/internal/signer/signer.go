package signer

import (
	"crypto"
	"crypto/ecdsa"
	"crypto/ed25519"
	"crypto/elliptic"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"fmt"
	"math/big"
	"math/rand"
	"net"
	"runtime"
	"sort"
	"strings"
	"time"
)

const _goproxySignerVersion = ":goproxy2"

func hashSorted(lst []string) []byte {
	c := make([]string, len(lst))
	copy(c, lst)
	sort.Strings(c)
	h := sha256.New()
	h.Write([]byte(strings.Join(c, ",")))
	return h.Sum(nil)
}

func SignHost(ca tls.Certificate, hosts []string) (cert *tls.Certificate, err error) {
	// Use the provided CA for certificate generation.
	// Use already parsed Leaf certificate when present.
	x509ca := ca.Leaf
	if x509ca == nil {
		if x509ca, err = x509.ParseCertificate(ca.Certificate[0]); err != nil {
			return nil, err
		}
	}

	now := time.Now()
	start := now.Add(-30 * 24 * time.Hour) // -30 days
	end := now.Add(365 * 24 * time.Hour)   // 365 days

	// Always generate a positive int value
	// (Two complement is not enabled when the first bit is 0)
	generated := rand.Uint64()
	generated >>= 1

	template := x509.Certificate{
		SerialNumber: big.NewInt(int64(generated)),
		Issuer:       x509ca.Subject,
		Subject: pkix.Name{
			Organization: []string{"GoProxy untrusted MITM proxy Inc"},
		},
		NotBefore: start,
		NotAfter:  end,

		KeyUsage:              x509.KeyUsageKeyEncipherment | x509.KeyUsageDigitalSignature,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		BasicConstraintsValid: true,
	}
	for _, h := range hosts {
		if ip := net.ParseIP(h); ip != nil {
			template.IPAddresses = append(template.IPAddresses, ip)
		} else {
			template.DNSNames = append(template.DNSNames, h)
			template.Subject.CommonName = h
		}
	}

	hash := hashSorted(append(hosts, _goproxySignerVersion, ":"+runtime.Version()))
	var csprng CounterEncryptorRand
	if csprng, err = NewCounterEncryptorRandFromKey(ca.PrivateKey, hash); err != nil {
		return nil, err
	}

	var certpriv crypto.Signer
	switch ca.PrivateKey.(type) {
	case *rsa.PrivateKey:
		if certpriv, err = rsa.GenerateKey(&csprng, 2048); err != nil {
			return nil, err
		}
	case *ecdsa.PrivateKey:
		if certpriv, err = ecdsa.GenerateKey(elliptic.P256(), &csprng); err != nil {
			return nil, err
		}
	case ed25519.PrivateKey:
		if _, certpriv, err = ed25519.GenerateKey(&csprng); err != nil {
			return nil, err
		}
	default:
		return nil, fmt.Errorf("unsupported key type %T", ca.PrivateKey)
	}

	derBytes, err := x509.CreateCertificate(&csprng, &template, x509ca, certpriv.Public(), ca.PrivateKey)
	if err != nil {
		return nil, err
	}

	// Save an already parsed leaf certificate to use less CPU
	// when it will be used
	leafCert, err := x509.ParseCertificate(derBytes)
	if err != nil {
		return nil, err
	}

	certBytes := [][]byte{derBytes}
	certBytes = append(certBytes, ca.Certificate...)
	return &tls.Certificate{
		Certificate: certBytes,
		PrivateKey:  certpriv,
		Leaf:        leafCert,
	}, nil
}
