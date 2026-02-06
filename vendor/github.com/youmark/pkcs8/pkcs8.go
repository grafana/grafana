// Package pkcs8 implements functions to parse and convert private keys in PKCS#8 format, as defined in RFC5208 and RFC5958
package pkcs8

import (
	"crypto"
	"crypto/ecdsa"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/asn1"
	"errors"
	"fmt"
)

// DefaultOpts are the default options for encrypting a key if none are given.
// The defaults can be changed by the library user.
var DefaultOpts = &Opts{
	Cipher: AES256CBC,
	KDFOpts: PBKDF2Opts{
		SaltSize:       8,
		IterationCount: 10000,
		HMACHash:       crypto.SHA256,
	},
}

// KDFOpts contains options for a key derivation function.
// An implementation of this interface must be specified when encrypting a PKCS#8 key.
type KDFOpts interface {
	// DeriveKey derives a key of size bytes from the given password and salt.
	// It returns the key and the ASN.1-encodable parameters used.
	DeriveKey(password, salt []byte, size int) (key []byte, params KDFParameters, err error)
	// GetSaltSize returns the salt size specified.
	GetSaltSize() int
	// OID returns the OID of the KDF specified.
	OID() asn1.ObjectIdentifier
}

// KDFParameters contains parameters (salt, etc.) for a key deriviation function.
// It must be a ASN.1-decodable structure.
// An implementation of this interface is created when decoding an encrypted PKCS#8 key.
type KDFParameters interface {
	// DeriveKey derives a key of size bytes from the given password.
	// It uses the salt from the decoded parameters.
	DeriveKey(password []byte, size int) (key []byte, err error)
}

var kdfs = make(map[string]func() KDFParameters)

// RegisterKDF registers a function that returns a new instance of the given KDF
// parameters. This allows the library to support client-provided KDFs.
func RegisterKDF(oid asn1.ObjectIdentifier, params func() KDFParameters) {
	kdfs[oid.String()] = params
}

// Cipher represents a cipher for encrypting the key material.
type Cipher interface {
	// IVSize returns the IV size of the cipher, in bytes.
	IVSize() int
	// KeySize returns the key size of the cipher, in bytes.
	KeySize() int
	// Encrypt encrypts the key material.
	Encrypt(key, iv, plaintext []byte) ([]byte, error)
	// Decrypt decrypts the key material.
	Decrypt(key, iv, ciphertext []byte) ([]byte, error)
	// OID returns the OID of the cipher specified.
	OID() asn1.ObjectIdentifier
}

var ciphers = make(map[string]func() Cipher)

// RegisterCipher registers a function that returns a new instance of the given
// cipher. This allows the library to support client-provided ciphers.
func RegisterCipher(oid asn1.ObjectIdentifier, cipher func() Cipher) {
	ciphers[oid.String()] = cipher
}

// Opts contains options for encrypting a PKCS#8 key.
type Opts struct {
	Cipher  Cipher
	KDFOpts KDFOpts
}

// Unecrypted PKCS8
var (
	oidPBES2 = asn1.ObjectIdentifier{1, 2, 840, 113549, 1, 5, 13}
)

type encryptedPrivateKeyInfo struct {
	EncryptionAlgorithm pkix.AlgorithmIdentifier
	EncryptedData       []byte
}

type pbes2Params struct {
	KeyDerivationFunc pkix.AlgorithmIdentifier
	EncryptionScheme  pkix.AlgorithmIdentifier
}

type privateKeyInfo struct {
	Version             int
	PrivateKeyAlgorithm pkix.AlgorithmIdentifier
	PrivateKey          []byte
}

func parseKeyDerivationFunc(keyDerivationFunc pkix.AlgorithmIdentifier) (KDFParameters, error) {
	oid := keyDerivationFunc.Algorithm.String()
	newParams, ok := kdfs[oid]
	if !ok {
		return nil, fmt.Errorf("pkcs8: unsupported KDF (OID: %s)", oid)
	}
	params := newParams()
	_, err := asn1.Unmarshal(keyDerivationFunc.Parameters.FullBytes, params)
	if err != nil {
		return nil, errors.New("pkcs8: invalid KDF parameters")
	}
	return params, nil
}

func parseEncryptionScheme(encryptionScheme pkix.AlgorithmIdentifier) (Cipher, []byte, error) {
	oid := encryptionScheme.Algorithm.String()
	newCipher, ok := ciphers[oid]
	if !ok {
		return nil, nil, fmt.Errorf("pkcs8: unsupported cipher (OID: %s)", oid)
	}
	cipher := newCipher()
	var iv []byte
	if _, err := asn1.Unmarshal(encryptionScheme.Parameters.FullBytes, &iv); err != nil {
		return nil, nil, errors.New("pkcs8: invalid cipher parameters")
	}
	return cipher, iv, nil
}

// ParsePrivateKey parses a DER-encoded PKCS#8 private key.
// Password can be nil.
// This is equivalent to ParsePKCS8PrivateKey.
func ParsePrivateKey(der []byte, password []byte) (interface{}, KDFParameters, error) {
	// No password provided, assume the private key is unencrypted
	if len(password) == 0 {
		privateKey, err := x509.ParsePKCS8PrivateKey(der)
		return privateKey, nil, err
	}

	// Use the password provided to decrypt the private key
	var privKey encryptedPrivateKeyInfo
	if _, err := asn1.Unmarshal(der, &privKey); err != nil {
		return nil, nil, errors.New("pkcs8: only PKCS #5 v2.0 supported")
	}

	if !privKey.EncryptionAlgorithm.Algorithm.Equal(oidPBES2) {
		return nil, nil, errors.New("pkcs8: only PBES2 supported")
	}

	var params pbes2Params
	if _, err := asn1.Unmarshal(privKey.EncryptionAlgorithm.Parameters.FullBytes, &params); err != nil {
		return nil, nil, errors.New("pkcs8: invalid PBES2 parameters")
	}

	cipher, iv, err := parseEncryptionScheme(params.EncryptionScheme)
	if err != nil {
		return nil, nil, err
	}

	kdfParams, err := parseKeyDerivationFunc(params.KeyDerivationFunc)
	if err != nil {
		return nil, nil, err
	}

	keySize := cipher.KeySize()
	symkey, err := kdfParams.DeriveKey(password, keySize)
	if err != nil {
		return nil, nil, err
	}

	encryptedKey := privKey.EncryptedData
	decryptedKey, err := cipher.Decrypt(symkey, iv, encryptedKey)
	if err != nil {
		return nil, nil, err
	}

	key, err := x509.ParsePKCS8PrivateKey(decryptedKey)
	if err != nil {
		return nil, nil, errors.New("pkcs8: incorrect password")
	}
	return key, kdfParams, nil
}

// MarshalPrivateKey encodes a private key into DER-encoded PKCS#8 with the given options.
// Password can be nil.
func MarshalPrivateKey(priv interface{}, password []byte, opts *Opts) ([]byte, error) {
	if len(password) == 0 {
		return x509.MarshalPKCS8PrivateKey(priv)
	}

	if opts == nil {
		opts = DefaultOpts
	}

	// Convert private key into PKCS8 format
	pkey, err := x509.MarshalPKCS8PrivateKey(priv)
	if err != nil {
		return nil, err
	}

	encAlg := opts.Cipher
	salt := make([]byte, opts.KDFOpts.GetSaltSize())
	_, err = rand.Read(salt)
	if err != nil {
		return nil, err
	}
	iv := make([]byte, encAlg.IVSize())
	_, err = rand.Read(iv)
	if err != nil {
		return nil, err
	}
	key, kdfParams, err := opts.KDFOpts.DeriveKey(password, salt, encAlg.KeySize())
	if err != nil {
		return nil, err
	}

	encryptedKey, err := encAlg.Encrypt(key, iv, pkey)
	if err != nil {
		return nil, err
	}

	marshalledParams, err := asn1.Marshal(kdfParams)
	if err != nil {
		return nil, err
	}
	keyDerivationFunc := pkix.AlgorithmIdentifier{
		Algorithm:  opts.KDFOpts.OID(),
		Parameters: asn1.RawValue{FullBytes: marshalledParams},
	}
	marshalledIV, err := asn1.Marshal(iv)
	if err != nil {
		return nil, err
	}
	encryptionScheme := pkix.AlgorithmIdentifier{
		Algorithm:  encAlg.OID(),
		Parameters: asn1.RawValue{FullBytes: marshalledIV},
	}

	encryptionAlgorithmParams := pbes2Params{
		EncryptionScheme:  encryptionScheme,
		KeyDerivationFunc: keyDerivationFunc,
	}
	marshalledEncryptionAlgorithmParams, err := asn1.Marshal(encryptionAlgorithmParams)
	if err != nil {
		return nil, err
	}
	encryptionAlgorithm := pkix.AlgorithmIdentifier{
		Algorithm:  oidPBES2,
		Parameters: asn1.RawValue{FullBytes: marshalledEncryptionAlgorithmParams},
	}

	encryptedPkey := encryptedPrivateKeyInfo{
		EncryptionAlgorithm: encryptionAlgorithm,
		EncryptedData:       encryptedKey,
	}

	return asn1.Marshal(encryptedPkey)
}

// ParsePKCS8PrivateKey parses encrypted/unencrypted private keys in PKCS#8 format. To parse encrypted private keys, a password of []byte type should be provided to the function as the second parameter.
func ParsePKCS8PrivateKey(der []byte, v ...[]byte) (interface{}, error) {
	var password []byte
	if len(v) > 0 {
		password = v[0]
	}
	privateKey, _, err := ParsePrivateKey(der, password)
	return privateKey, err
}

// ParsePKCS8PrivateKeyRSA parses encrypted/unencrypted private keys in PKCS#8 format. To parse encrypted private keys, a password of []byte type should be provided to the function as the second parameter.
func ParsePKCS8PrivateKeyRSA(der []byte, v ...[]byte) (*rsa.PrivateKey, error) {
	key, err := ParsePKCS8PrivateKey(der, v...)
	if err != nil {
		return nil, err
	}
	typedKey, ok := key.(*rsa.PrivateKey)
	if !ok {
		return nil, errors.New("key block is not of type RSA")
	}
	return typedKey, nil
}

// ParsePKCS8PrivateKeyECDSA parses encrypted/unencrypted private keys in PKCS#8 format. To parse encrypted private keys, a password of []byte type should be provided to the function as the second parameter.
func ParsePKCS8PrivateKeyECDSA(der []byte, v ...[]byte) (*ecdsa.PrivateKey, error) {
	key, err := ParsePKCS8PrivateKey(der, v...)
	if err != nil {
		return nil, err
	}
	typedKey, ok := key.(*ecdsa.PrivateKey)
	if !ok {
		return nil, errors.New("key block is not of type ECDSA")
	}
	return typedKey, nil
}

// ConvertPrivateKeyToPKCS8 converts the private key into PKCS#8 format.
// To encrypt the private key, the password of []byte type should be provided as the second parameter.
//
// The only supported key types are RSA and ECDSA (*rsa.PrivateKey or *ecdsa.PrivateKey for priv)
func ConvertPrivateKeyToPKCS8(priv interface{}, v ...[]byte) ([]byte, error) {
	var password []byte
	if len(v) > 0 {
		password = v[0]
	}
	return MarshalPrivateKey(priv, password, nil)
}
