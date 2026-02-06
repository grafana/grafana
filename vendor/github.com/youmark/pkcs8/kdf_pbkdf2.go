package pkcs8

import (
	"crypto"
	"crypto/sha1"
	"crypto/sha256"
	"crypto/x509/pkix"
	"encoding/asn1"
	"errors"
	"hash"

	"golang.org/x/crypto/pbkdf2"
)

var (
	oidPKCS5PBKDF2        = asn1.ObjectIdentifier{1, 2, 840, 113549, 1, 5, 12}
	oidHMACWithSHA1       = asn1.ObjectIdentifier{1, 2, 840, 113549, 2, 7}
	oidHMACWithSHA256     = asn1.ObjectIdentifier{1, 2, 840, 113549, 2, 9}
)

func init() {
	RegisterKDF(oidPKCS5PBKDF2, func() KDFParameters {
		return new(pbkdf2Params)
	})
}

func newHashFromPRF(ai pkix.AlgorithmIdentifier) (func() hash.Hash, error) {
	switch {
	case len(ai.Algorithm) == 0 || ai.Algorithm.Equal(oidHMACWithSHA1):
		return sha1.New, nil
	case ai.Algorithm.Equal(oidHMACWithSHA256):
		return sha256.New, nil
	default:
		return nil, errors.New("pkcs8: unsupported hash function")
	}
}

func newPRFParamFromHash(h crypto.Hash) (pkix.AlgorithmIdentifier, error) {
	switch h {
	case crypto.SHA1:
		return pkix.AlgorithmIdentifier{
			Algorithm:  oidHMACWithSHA1,
			Parameters: asn1.RawValue{Tag: asn1.TagNull}}, nil
	case crypto.SHA256:
		return pkix.AlgorithmIdentifier{
			Algorithm:  oidHMACWithSHA256,
			Parameters: asn1.RawValue{Tag: asn1.TagNull}}, nil
	}
	return pkix.AlgorithmIdentifier{}, errors.New("pkcs8: unsupported hash function")
}

type pbkdf2Params struct {
	Salt           []byte
	IterationCount int
	PRF            pkix.AlgorithmIdentifier `asn1:"optional"`
}

func (p pbkdf2Params) DeriveKey(password []byte, size int) (key []byte, err error) {
	h, err := newHashFromPRF(p.PRF)
	if err != nil {
		return nil, err
	}
	return pbkdf2.Key(password, p.Salt, p.IterationCount, size, h), nil
}

// PBKDF2Opts contains options for the PBKDF2 key derivation function.
type PBKDF2Opts struct {
	SaltSize       int
	IterationCount int
	HMACHash       crypto.Hash
}

func (p PBKDF2Opts) DeriveKey(password, salt []byte, size int) (
	key []byte, params KDFParameters, err error) {

	key = pbkdf2.Key(password, salt, p.IterationCount, size, p.HMACHash.New)
	prfParam, err := newPRFParamFromHash(p.HMACHash)
	if err != nil {
		return nil, nil, err
	}
	params = pbkdf2Params{salt, p.IterationCount, prfParam}
	return key, params, nil
}

func (p PBKDF2Opts) GetSaltSize() int {
	return p.SaltSize
}

func (p PBKDF2Opts) OID() asn1.ObjectIdentifier {
	return oidPKCS5PBKDF2
}
