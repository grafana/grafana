// Copyright 2019 The age Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package age

import (
	"crypto/hmac"
	"crypto/sha256"
	"errors"
	"io"

	"filippo.io/age/internal/format"
	"golang.org/x/crypto/chacha20poly1305"
	"golang.org/x/crypto/hkdf"
)

// aeadEncrypt encrypts a message with a one-time key.
func aeadEncrypt(key, plaintext []byte) ([]byte, error) {
	aead, err := chacha20poly1305.New(key)
	if err != nil {
		return nil, err
	}
	// The nonce is fixed because this function is only used in places where the
	// spec guarantees each key is only used once (by deriving it from values
	// that include fresh randomness), allowing us to save the overhead.
	// For the code that encrypts the actual payload, look at the
	// filippo.io/age/internal/stream package.
	nonce := make([]byte, chacha20poly1305.NonceSize)
	return aead.Seal(nil, nonce, plaintext, nil), nil
}

var errIncorrectCiphertextSize = errors.New("encrypted value has unexpected length")

// aeadDecrypt decrypts a message of an expected fixed size.
//
// The message size is limited to mitigate multi-key attacks, where a ciphertext
// can be crafted that decrypts successfully under multiple keys. Short
// ciphertexts can only target two keys, which has limited impact.
func aeadDecrypt(key []byte, size int, ciphertext []byte) ([]byte, error) {
	aead, err := chacha20poly1305.New(key)
	if err != nil {
		return nil, err
	}
	if len(ciphertext) != size+aead.Overhead() {
		return nil, errIncorrectCiphertextSize
	}
	nonce := make([]byte, chacha20poly1305.NonceSize)
	return aead.Open(nil, nonce, ciphertext, nil)
}

func headerMAC(fileKey []byte, hdr *format.Header) ([]byte, error) {
	h := hkdf.New(sha256.New, fileKey, nil, []byte("header"))
	hmacKey := make([]byte, 32)
	if _, err := io.ReadFull(h, hmacKey); err != nil {
		return nil, err
	}
	hh := hmac.New(sha256.New, hmacKey)
	if err := hdr.MarshalWithoutMAC(hh); err != nil {
		return nil, err
	}
	return hh.Sum(nil), nil
}

func streamKey(fileKey, nonce []byte) []byte {
	h := hkdf.New(sha256.New, fileKey, nonce, []byte("payload"))
	streamKey := make([]byte, chacha20poly1305.KeySize)
	if _, err := io.ReadFull(h, streamKey); err != nil {
		panic("age: internal error: failed to read from HKDF: " + err.Error())
	}
	return streamKey
}
