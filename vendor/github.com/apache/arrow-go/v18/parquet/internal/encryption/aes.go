// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Package encryption contains the internal helpers for the parquet AES encryption/decryption handling.
//
// Testing for this is done via integration testing at the top level parquet package via attempting to
// read and write encrypted files with different configurations to match test files in parquet-testing
package encryption

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/binary"
	"fmt"
	"io"

	"github.com/apache/arrow-go/v18/parquet"
)

// important constants for handling the aes encryption
const (
	GcmTagLength = 16
	NonceLength  = 12

	gcmMode          = 0
	ctrMode          = 1
	ctrIVLen         = 16
	bufferSizeLength = 4
)

// Module constants for constructing the AAD bytes, the order here is
// important as the constants are set via iota.
const (
	FooterModule int8 = iota
	ColumnMetaModule
	DataPageModule
	DictPageModule
	DataPageHeaderModule
	DictPageHeaderModule
	ColumnIndexModule
	OffsetIndexModule
	BloomFilterHeaderModule
	BloomFilterBitsetModule
)

type aesEncryptor struct {
	mode                int
	ciphertextSizeDelta int
}

// NewAesEncryptor constructs an encryptor for the passed in cipher and whether
// or not it's being used to encrypt metadata.
func NewAesEncryptor(alg parquet.Cipher, metadata bool) *aesEncryptor {
	ret := &aesEncryptor{}
	ret.ciphertextSizeDelta = bufferSizeLength + NonceLength
	if metadata || alg == parquet.AesGcm {
		ret.mode = gcmMode
		ret.ciphertextSizeDelta += GcmTagLength
	} else {
		ret.mode = ctrMode
	}

	return ret
}

// CiphertextSizeDelta is the number of extra bytes that are part of the encrypted data
// above and beyond the plaintext value.
func (a *aesEncryptor) CiphertextSizeDelta() int { return a.ciphertextSizeDelta }

// SignedFooterEncrypt writes the signature for the provided footer bytes using the given key, AAD and nonce.
// It returns the number of bytes that were written to w.
func (a *aesEncryptor) SignedFooterEncrypt(w io.Writer, footer, key, aad, nonce []byte) int {
	if a.mode != gcmMode {
		panic("must use AES GCM (metadata) encryptor")
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		panic(err)
	}

	aead, err := cipher.NewGCM(block)
	if err != nil {
		panic(err)
	}
	if aead.NonceSize() != NonceLength {
		panic(fmt.Errorf("nonce size mismatch %d, %d", aead.NonceSize(), NonceLength))
	}
	if aead.Overhead() != GcmTagLength {
		panic(fmt.Errorf("tagsize mismatch %d %d", aead.Overhead(), GcmTagLength))
	}

	ciphertext := aead.Seal(nil, nonce, footer, aad)
	bufferSize := uint32(len(ciphertext) + len(nonce))
	// data is written with a prefix of the size written as a little endian 32bit int.
	if err := binary.Write(w, binary.LittleEndian, bufferSize); err != nil {
		panic(err)
	}
	w.Write(nonce)
	w.Write(ciphertext)
	return bufferSizeLength + int(bufferSize)
}

// Encrypt calculates the ciphertext for src with the given key and aad, then writes it to w.
// Returns the total number of bytes written.
func (a *aesEncryptor) Encrypt(w io.Writer, src, key, aad []byte) int {
	block, err := aes.NewCipher(key)
	if err != nil {
		panic(err)
	}

	nonce := make([]byte, NonceLength)
	rand.Read(nonce)

	if a.mode == gcmMode {
		aead, err := cipher.NewGCM(block)
		if err != nil {
			panic(err)
		}
		if aead.NonceSize() != NonceLength {
			panic(fmt.Errorf("nonce size mismatch %d, %d", aead.NonceSize(), NonceLength))
		}
		if aead.Overhead() != GcmTagLength {
			panic(fmt.Errorf("tagsize mismatch %d %d", aead.Overhead(), GcmTagLength))
		}

		ciphertext := aead.Seal(nil, nonce, src, aad)
		bufferSize := len(ciphertext) + len(nonce)
		// data is written with a prefix of the size written as a little endian 32bit int.
		if err := binary.Write(w, binary.LittleEndian, uint32(bufferSize)); err != nil {
			panic(err)
		}
		w.Write(nonce)
		w.Write(ciphertext)
		return bufferSizeLength + bufferSize
	}

	// Parquet CTR IVs are comprised of a 12-byte nonce and a 4-byte initial
	// counter field.
	// The first 31 bits of the initial counter field are set to 0, the last bit
	// is set to 1.
	iv := make([]byte, ctrIVLen)
	copy(iv, nonce)
	iv[ctrIVLen-1] = 1

	bufferSize := NonceLength + len(src)
	// data is written with a prefix of the size written as a little endian 32bit int.
	if err := binary.Write(w, binary.LittleEndian, uint32(bufferSize)); err != nil {
		panic(err)
	}
	w.Write(nonce)
	cipher.StreamWriter{S: cipher.NewCTR(block, iv), W: w}.Write(src)
	return bufferSizeLength + bufferSize
}

type aesDecryptor struct {
	mode                int
	ciphertextSizeDelta int
}

// newAesDecryptor constructs and returns a decryptor for the given cipher type and whether or
// not it is intended to be used for decrypting metadata.
func newAesDecryptor(alg parquet.Cipher, metadata bool) *aesDecryptor {
	ret := &aesDecryptor{}
	ret.ciphertextSizeDelta = bufferSizeLength + NonceLength
	if metadata || alg == parquet.AesGcm {
		ret.mode = gcmMode
		ret.ciphertextSizeDelta += GcmTagLength
	} else {
		ret.mode = ctrMode
	}

	return ret
}

// CiphertextSizeDelta is the number of bytes in the ciphertext that will not exist in the
// plaintext due to be used for the decryption. The total size - the CiphertextSizeDelta is
// the length of the plaintext after decryption.
func (a *aesDecryptor) CiphertextSizeDelta() int { return a.ciphertextSizeDelta }

// DecryptFrom
func (a *aesDecryptor) DecryptFrom(r io.Reader, key, aad []byte) []byte {
	block, err := aes.NewCipher(key)
	if err != nil {
		panic(err)
	}

	var writtenCiphertextLen uint32
	if err := binary.Read(r, binary.LittleEndian, &writtenCiphertextLen); err != nil {
		panic(err)
	}

	cipherText := make([]byte, writtenCiphertextLen)
	if n, err := io.ReadFull(r, cipherText); n != int(writtenCiphertextLen) || err != nil {
		panic(err)
	}

	nonce := cipherText[:NonceLength]
	cipherText = cipherText[NonceLength:]
	if a.mode == gcmMode {
		aead, err := cipher.NewGCM(block)
		if err != nil {
			panic(err)
		}

		plain, err := aead.Open(cipherText[:0], nonce, cipherText, aad)
		if err != nil {
			panic(err)
		}
		return plain
	}

	// Parquet CTR IVs are comprised of a 12-byte nonce and a 4-byte initial
	// counter field.
	// The first 31 bits of the initial counter field are set to 0, the last bit
	// is set to 1.
	iv := make([]byte, ctrIVLen)
	copy(iv, nonce)
	iv[ctrIVLen-1] = 1

	stream := cipher.NewCTR(block, iv)
	// dst := make([]byte, len(cipherText))
	stream.XORKeyStream(cipherText, cipherText)
	return cipherText
}

// Decrypt returns the plaintext version of the given ciphertext when decrypted
// with the provided key and AAD security bytes.
func (a *aesDecryptor) Decrypt(cipherText, key, aad []byte) []byte {
	block, err := aes.NewCipher(key)
	if err != nil {
		panic(err)
	}

	writtenCiphertextLen := binary.LittleEndian.Uint32(cipherText)
	cipherLen := writtenCiphertextLen + bufferSizeLength
	nonce := cipherText[bufferSizeLength : bufferSizeLength+NonceLength]

	if a.mode == gcmMode {
		aead, err := cipher.NewGCM(block)
		if err != nil {
			panic(err)
		}

		plain, err := aead.Open(nil, nonce, cipherText[bufferSizeLength+NonceLength:cipherLen], aad)
		if err != nil {
			panic(err)
		}
		return plain
	}

	// Parquet CTR IVs are comprised of a 12-byte nonce and a 4-byte initial
	// counter field.
	// The first 31 bits of the initial counter field are set to 0, the last bit
	// is set to 1.
	iv := make([]byte, ctrIVLen)
	copy(iv, nonce)
	iv[ctrIVLen-1] = 1

	stream := cipher.NewCTR(block, iv)
	dst := make([]byte, len(cipherText)-bufferSizeLength-NonceLength)
	stream.XORKeyStream(dst, cipherText[bufferSizeLength+NonceLength:])
	return dst
}

// CreateModuleAad creates the section AAD security bytes for the file, module, row group, column and page.
//
// This should be used for being passed to the encryptor and decryptor whenever requesting AAD bytes.
func CreateModuleAad(fileAad string, moduleType int8, rowGroupOrdinal, columnOrdinal, pageOrdinal int16) string {
	buf := bytes.NewBuffer([]byte(fileAad))
	buf.WriteByte(byte(moduleType))

	if moduleType == FooterModule {
		return buf.String()
	}

	binary.Write(buf, binary.LittleEndian, rowGroupOrdinal)
	binary.Write(buf, binary.LittleEndian, columnOrdinal)
	if DataPageModule != moduleType && DataPageHeaderModule != moduleType {
		return buf.String()
	}

	binary.Write(buf, binary.LittleEndian, pageOrdinal)
	return buf.String()
}

// CreateFooterAad takes an aadPrefix and constructs the security AAD bytes for encrypting
// and decrypting the parquet footer bytes.
func CreateFooterAad(aadPrefix string) string {
	return CreateModuleAad(aadPrefix, FooterModule, -1, -1, -1)
}

// QuickUpdatePageAad updates aad with the new page ordinal, modifying the
// last two bytes of aad.
func QuickUpdatePageAad(aad []byte, newPageOrdinal int16) {
	binary.LittleEndian.PutUint16(aad[len(aad)-2:], uint16(newPageOrdinal))
}
