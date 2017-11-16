package xjwt

import (
	"crypto"
	"crypto/x509"
	"encoding/pem"
	"errors"
	"fmt"
	"strings"
)

var ErrIncorrectPassword = x509.IncorrectPasswordError

func unmarshalPrivateKey(data []byte, passphrase []byte) (crypto.PrivateKey, error) {
	var err error

	block, _ := pem.Decode(data)
	if block == nil {
		return nil, errors.New("no PEM block found")
	}

	if x509.IsEncryptedPEMBlock(block) {
		data, err = x509.DecryptPEMBlock(block, passphrase)
		if err == x509.IncorrectPasswordError {
			return nil, ErrIncorrectPassword
		}
		if err != nil {
			return nil, err
		}
	} else {
		data = block.Bytes
	}

	switch block.Type {
	case "RSA PRIVATE KEY":
		pk, err := x509.ParsePKCS1PrivateKey(data)
		if err != nil {
			// The Algos for PEM Encryption do not include strong message authentication,
			// so sometimes DecryptPEMBlock works, but ParsePKCS1PrivateKey fails with an asn1 error.
			// We are just catching the most common prefix here...
			if len(passphrase) > 0 && strings.HasPrefix(err.Error(), "asn1: structure error") {
				return nil, ErrIncorrectPassword
			}
			return nil, err
		}
		return pk, nil
	case "EC PRIVATE KEY":
		return x509.ParseECPrivateKey(data)
	default:
		return nil, fmt.Errorf("unsupported key type: %q", block.Type)
	}
}
