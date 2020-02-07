package xmlenc

import (
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"fmt"

	"github.com/beevik/etree"
)

// RSA implements Encrypter and Decrypter using RSA public key encryption.
//
// Use function like OAEP(), or PKCS1v15() to get an instance of this type ready
// to use.
type RSA struct {
	BlockCipher  BlockCipher
	DigestMethod DigestMethod // only for OAEP

	algorithm    string
	keyEncrypter func(e RSA, pubKey *rsa.PublicKey, plaintext []byte) ([]byte, error)
	keyDecrypter func(e RSA, privKey *rsa.PrivateKey, ciphertext []byte) ([]byte, error)
}

// Algorithm returns the name of the algorithm
func (e RSA) Algorithm() string {
	return e.algorithm
}

// Encrypt implements encrypter. certificate must be a []byte containing the ASN.1 bytes
// of certificate containing an RSA public key.
func (e RSA) Encrypt(certificate interface{}, plaintext []byte) (*etree.Element, error) {
	cert, ok := certificate.(*x509.Certificate)
	if !ok {
		return nil, ErrIncorrectKeyType("*x.509 certificate")
	}

	pubKey, ok := cert.PublicKey.(*rsa.PublicKey)
	if !ok {
		return nil, ErrIncorrectKeyType("x.509 certificate with an RSA public key")
	}

	// generate a key
	key := make([]byte, e.BlockCipher.KeySize())
	if _, err := RandReader.Read(key); err != nil {
		return nil, err
	}

	keyInfoEl := etree.NewElement("ds:KeyInfo")
	keyInfoEl.CreateAttr("xmlns:ds", "http://www.w3.org/2000/09/xmldsig#")

	encryptedKey := keyInfoEl.CreateElement("xenc:EncryptedKey")
	{
		randBuf := make([]byte, 16)
		if _, err := RandReader.Read(randBuf); err != nil {
			return nil, err
		}
		encryptedKey.CreateAttr("Id", fmt.Sprintf("_%x", randBuf))
	}
	encryptedKey.CreateAttr("xmlns:xenc", "http://www.w3.org/2001/04/xmlenc#")

	encryptionMethodEl := encryptedKey.CreateElement("xenc:EncryptionMethod")
	encryptionMethodEl.CreateAttr("Algorithm", e.algorithm)
	encryptionMethodEl.CreateAttr("xmlns:xenc", "http://www.w3.org/2001/04/xmlenc#")
	if e.DigestMethod != nil {
		dm := encryptionMethodEl.CreateElement("ds:DigestMethod")
		dm.CreateAttr("Algorithm", e.DigestMethod.Algorithm())
		dm.CreateAttr("xmlns:ds", "http://www.w3.org/2000/09/xmldsig#")
	}
	{
		innerKeyInfoEl := encryptedKey.CreateElement("ds:KeyInfo")
		x509data := innerKeyInfoEl.CreateElement("ds:X509Data")
		x509data.CreateElement("ds:X509Certificate").SetText(
			base64.StdEncoding.EncodeToString(cert.Raw),
		)
	}

	buf, err := e.keyEncrypter(e, pubKey, key)
	if err != nil {
		return nil, err
	}

	cd := encryptedKey.CreateElement("xenc:CipherData")
	cd.CreateAttr("xmlns:xenc", "http://www.w3.org/2001/04/xmlenc#")
	cd.CreateElement("xenc:CipherValue").SetText(base64.StdEncoding.EncodeToString(buf))
	encryptedDataEl, err := e.BlockCipher.Encrypt(key, plaintext)
	if err != nil {
		return nil, err
	}
	encryptedDataEl.InsertChild(encryptedDataEl.FindElement("./CipherData"), keyInfoEl)

	return encryptedDataEl, nil
}

// Decrypt implements Decryptor. `key` must be an *rsa.PrivateKey.
func (e RSA) Decrypt(key interface{}, ciphertextEl *etree.Element) ([]byte, error) {
	rsaKey, err := validateRSAKeyIfPresent(key, ciphertextEl)
	if err != nil {
		return nil, err
	}

	ciphertext, err := getCiphertext(ciphertextEl)
	if err != nil {
		return nil, err
	}

	{
		digestMethodEl := ciphertextEl.FindElement("./EncryptionMethod/DigestMethod")
		if digestMethodEl == nil {
			e.DigestMethod = SHA1
		} else {
			hashAlgorithmStr := digestMethodEl.SelectAttrValue("Algorithm", "")
			digestMethod, ok := digestMethods[hashAlgorithmStr]
			if !ok {
				return nil, ErrAlgorithmNotImplemented(hashAlgorithmStr)
			}
			e.DigestMethod = digestMethod
		}
	}

	return e.keyDecrypter(e, rsaKey, ciphertext)
}

// OAEP returns a version of RSA that implements RSA in OAEP-MGF1P mode. By default
// the block cipher used is AES-256 CBC and the digest method is SHA-256. You can
// specify other ciphers and digest methods by assigning to BlockCipher or
// DigestMethod.
func OAEP() RSA {
	return RSA{
		BlockCipher:  AES256CBC,
		DigestMethod: SHA256,
		algorithm:    "http://www.w3.org/2001/04/xmlenc#rsa-oaep-mgf1p",
		keyEncrypter: func(e RSA, pubKey *rsa.PublicKey, plaintext []byte) ([]byte, error) {
			return rsa.EncryptOAEP(e.DigestMethod.Hash(), RandReader, pubKey, plaintext, nil)
		},
		keyDecrypter: func(e RSA, privKey *rsa.PrivateKey, ciphertext []byte) ([]byte, error) {
			return rsa.DecryptOAEP(e.DigestMethod.Hash(), RandReader, privKey, ciphertext, nil)
		},
	}
}

// PKCS1v15 returns a version of RSA that implements RSA in PKCS1v15 mode. By default
// the block cipher used is AES-256 CBC. The DigestMethod field is ignored because PKCS1v15
// does not use a digest function.
func PKCS1v15() RSA {
	return RSA{
		BlockCipher:  AES256CBC,
		DigestMethod: nil,
		algorithm:    "http://www.w3.org/2001/04/xmlenc#rsa-1_5",
		keyEncrypter: func(e RSA, pubKey *rsa.PublicKey, plaintext []byte) ([]byte, error) {
			return rsa.EncryptPKCS1v15(RandReader, pubKey, plaintext)
		},
		keyDecrypter: func(e RSA, privKey *rsa.PrivateKey, ciphertext []byte) ([]byte, error) {
			return rsa.DecryptPKCS1v15(RandReader, privKey, ciphertext)
		},
	}
}

func init() {
	RegisterDecrypter(OAEP())
	RegisterDecrypter(PKCS1v15())
}
