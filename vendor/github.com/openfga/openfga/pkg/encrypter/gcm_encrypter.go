package encrypter

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"errors"
	"io"
)

// Ensure GCMEncrypter implements the Encrypter interface.
var _ Encrypter = (*GCMEncrypter)(nil)

// GCMEncrypter is an implementation of the Encrypter interface
// that uses the AES-GCM encryption algorithm.
type GCMEncrypter struct {
	cipherMode cipher.AEAD
}

// NewGCMEncrypter creates a new instance of GCMEncrypter with the provided key.
// It initializes the AES-GCM cipher mode for encryption and decryption.
func NewGCMEncrypter(key string) (*GCMEncrypter, error) {
	c, err := aes.NewCipher(create32ByteKey(key))
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(c)
	if err != nil {
		return nil, err
	}

	return &GCMEncrypter{cipherMode: gcm}, nil
}

// Decrypt decrypts an AES-GCM encrypted byte array.
func (e *GCMEncrypter) Decrypt(data []byte) ([]byte, error) {
	if len(data) == 0 {
		return data, nil
	}

	nonceSize := e.cipherMode.NonceSize()
	if len(data) < nonceSize {
		return nil, errors.New("ciphertext too short")
	}

	nonce, ciphertext := data[:nonceSize], data[nonceSize:]
	return e.cipherMode.Open(nil, nonce, ciphertext, nil)
}

// Encrypt encrypts the given byte array using the AES-GCM block cipher.
func (e *GCMEncrypter) Encrypt(data []byte) ([]byte, error) {
	if len(data) == 0 {
		return data, nil
	}

	nonce := make([]byte, e.cipherMode.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}

	return e.cipherMode.Seal(nonce, nonce, data, nil), nil
}

// create32ByteKey creates a 32-byte key by taking the
// hex representation of the SHA-256 hash of a string.
func create32ByteKey(s string) []byte {
	sum := sha256.Sum256([]byte(s))
	return sum[:]
}
