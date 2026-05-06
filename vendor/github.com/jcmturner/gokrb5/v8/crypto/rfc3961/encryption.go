// Package rfc3961 provides encryption and checksum methods as specified in RFC 3961
package rfc3961

import (
	"crypto/cipher"
	"crypto/des"
	"crypto/hmac"
	"crypto/rand"
	"errors"
	"fmt"

	"github.com/jcmturner/gokrb5/v8/crypto/common"
	"github.com/jcmturner/gokrb5/v8/crypto/etype"
)

// DES3EncryptData encrypts the data provided using DES3 and methods specific to the etype provided.
func DES3EncryptData(key, data []byte, e etype.EType) ([]byte, []byte, error) {
	if len(key) != e.GetKeyByteSize() {
		return nil, nil, fmt.Errorf("incorrect keysize: expected: %v actual: %v", e.GetKeyByteSize(), len(key))
	}
	data, _ = common.ZeroPad(data, e.GetMessageBlockByteSize())

	block, err := des.NewTripleDESCipher(key)
	if err != nil {
		return nil, nil, fmt.Errorf("error creating cipher: %v", err)
	}

	//RFC 3961: initial cipher state      All bits zero
	ivz := make([]byte, des.BlockSize)

	ct := make([]byte, len(data))
	mode := cipher.NewCBCEncrypter(block, ivz)
	mode.CryptBlocks(ct, data)
	return ct[len(ct)-e.GetMessageBlockByteSize():], ct, nil
}

// DES3EncryptMessage encrypts the message provided using DES3 and methods specific to the etype provided.
// The encrypted data is concatenated with its integrity hash to create an encrypted message.
func DES3EncryptMessage(key, message []byte, usage uint32, e etype.EType) ([]byte, []byte, error) {
	//confounder
	c := make([]byte, e.GetConfounderByteSize())
	_, err := rand.Read(c)
	if err != nil {
		return []byte{}, []byte{}, fmt.Errorf("could not generate random confounder: %v", err)
	}
	plainBytes := append(c, message...)
	plainBytes, _ = common.ZeroPad(plainBytes, e.GetMessageBlockByteSize())

	// Derive key for encryption from usage
	var k []byte
	if usage != 0 {
		k, err = e.DeriveKey(key, common.GetUsageKe(usage))
		if err != nil {
			return []byte{}, []byte{}, fmt.Errorf("error deriving key for encryption: %v", err)
		}
	}

	iv, b, err := e.EncryptData(k, plainBytes)
	if err != nil {
		return iv, b, fmt.Errorf("error encrypting data: %v", err)
	}

	// Generate and append integrity hash
	ih, err := common.GetIntegrityHash(plainBytes, key, usage, e)
	if err != nil {
		return iv, b, fmt.Errorf("error encrypting data: %v", err)
	}
	b = append(b, ih...)
	return iv, b, nil
}

// DES3DecryptData decrypts the data provided using DES3 and methods specific to the etype provided.
func DES3DecryptData(key, data []byte, e etype.EType) ([]byte, error) {
	if len(key) != e.GetKeyByteSize() {
		return []byte{}, fmt.Errorf("incorrect keysize: expected: %v actual: %v", e.GetKeyByteSize(), len(key))
	}

	if len(data) < des.BlockSize || len(data)%des.BlockSize != 0 {
		return []byte{}, errors.New("ciphertext is not a multiple of the block size")
	}
	block, err := des.NewTripleDESCipher(key)
	if err != nil {
		return []byte{}, fmt.Errorf("error creating cipher: %v", err)
	}
	pt := make([]byte, len(data))
	ivz := make([]byte, des.BlockSize)
	mode := cipher.NewCBCDecrypter(block, ivz)
	mode.CryptBlocks(pt, data)
	return pt, nil
}

// DES3DecryptMessage decrypts the message provided using DES3 and methods specific to the etype provided.
// The integrity of the message is also verified.
func DES3DecryptMessage(key, ciphertext []byte, usage uint32, e etype.EType) ([]byte, error) {
	//Derive the key
	k, err := e.DeriveKey(key, common.GetUsageKe(usage))
	if err != nil {
		return nil, fmt.Errorf("error deriving key: %v", err)
	}
	// Strip off the checksum from the end
	b, err := e.DecryptData(k, ciphertext[:len(ciphertext)-e.GetHMACBitLength()/8])
	if err != nil {
		return nil, fmt.Errorf("error decrypting: %v", err)
	}
	//Verify checksum
	if !e.VerifyIntegrity(key, ciphertext, b, usage) {
		return nil, errors.New("error decrypting: integrity verification failed")
	}
	//Remove the confounder bytes
	return b[e.GetConfounderByteSize():], nil
}

// VerifyIntegrity verifies the integrity of cipertext bytes ct.
func VerifyIntegrity(key, ct, pt []byte, usage uint32, etype etype.EType) bool {
	h := make([]byte, etype.GetHMACBitLength()/8)
	copy(h, ct[len(ct)-etype.GetHMACBitLength()/8:])
	expectedMAC, _ := common.GetIntegrityHash(pt, key, usage, etype)
	return hmac.Equal(h, expectedMAC)
}
