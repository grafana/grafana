// Package rfc8009 provides encryption and checksum methods as specified in RFC 8009
package rfc8009

import (
	"crypto/aes"
	"crypto/hmac"
	"crypto/rand"
	"errors"
	"fmt"

	"github.com/jcmturner/aescts/v2"
	"github.com/jcmturner/gokrb5/v8/crypto/common"
	"github.com/jcmturner/gokrb5/v8/crypto/etype"
	"github.com/jcmturner/gokrb5/v8/iana/etypeID"
)

// EncryptData encrypts the data provided using methods specific to the etype provided as defined in RFC 8009.
func EncryptData(key, data []byte, e etype.EType) ([]byte, []byte, error) {
	kl := e.GetKeyByteSize()
	if e.GetETypeID() == etypeID.AES256_CTS_HMAC_SHA384_192 {
		kl = 32
	}
	if len(key) != kl {
		return []byte{}, []byte{}, fmt.Errorf("incorrect keysize: expected: %v actual: %v", e.GetKeyByteSize(), len(key))
	}
	ivz := make([]byte, aes.BlockSize)
	return aescts.Encrypt(key, ivz, data)
}

// EncryptMessage encrypts the message provided using the methods specific to the etype provided as defined in RFC 8009.
// The encrypted data is concatenated with its integrity hash to create an encrypted message.
func EncryptMessage(key, message []byte, usage uint32, e etype.EType) ([]byte, []byte, error) {
	kl := e.GetKeyByteSize()
	if e.GetETypeID() == etypeID.AES256_CTS_HMAC_SHA384_192 {
		kl = 32
	}
	if len(key) != kl {
		return []byte{}, []byte{}, fmt.Errorf("incorrect keysize: expected: %v actual: %v", kl, len(key))
	}
	if len(key) != e.GetKeyByteSize() {
	}
	//confounder
	c := make([]byte, e.GetConfounderByteSize())
	_, err := rand.Read(c)
	if err != nil {
		return []byte{}, []byte{}, fmt.Errorf("could not generate random confounder: %v", err)
	}
	plainBytes := append(c, message...)

	// Derive key for encryption from usage
	var k []byte
	if usage != 0 {
		k, err = e.DeriveKey(key, common.GetUsageKe(usage))
		if err != nil {
			return []byte{}, []byte{}, fmt.Errorf("error deriving key for encryption: %v", err)
		}
	}

	// Encrypt the data
	iv, b, err := e.EncryptData(k, plainBytes)
	if err != nil {
		return iv, b, fmt.Errorf("error encrypting data: %v", err)
	}

	ivz := make([]byte, e.GetConfounderByteSize())
	ih, err := GetIntegityHash(ivz, b, key, usage, e)
	if err != nil {
		return iv, b, fmt.Errorf("error encrypting data: %v", err)
	}
	b = append(b, ih...)
	return iv, b, nil
}

// DecryptData decrypts the data provided using the methods specific to the etype provided as defined in RFC 8009.
func DecryptData(key, data []byte, e etype.EType) ([]byte, error) {
	kl := e.GetKeyByteSize()
	if e.GetETypeID() == etypeID.AES256_CTS_HMAC_SHA384_192 {
		kl = 32
	}
	if len(key) != kl {
		return []byte{}, fmt.Errorf("incorrect keysize: expected: %v actual: %v", kl, len(key))
	}
	ivz := make([]byte, aes.BlockSize)
	return aescts.Decrypt(key, ivz, data)
}

// DecryptMessage decrypts the message provided using the methods specific to the etype provided as defined in RFC 8009.
// The integrity of the message is also verified.
func DecryptMessage(key, ciphertext []byte, usage uint32, e etype.EType) ([]byte, error) {
	//Derive the key
	k, err := e.DeriveKey(key, common.GetUsageKe(usage))
	if err != nil {
		return nil, fmt.Errorf("error deriving key: %v", err)
	}
	// Strip off the checksum from the end
	b, err := e.DecryptData(k, ciphertext[:len(ciphertext)-e.GetHMACBitLength()/8])
	if err != nil {
		return nil, err
	}
	//Verify checksum
	if !e.VerifyIntegrity(key, ciphertext, b, usage) {
		return nil, errors.New("integrity verification failed")
	}
	//Remove the confounder bytes
	return b[e.GetConfounderByteSize():], nil
}

// GetIntegityHash returns a keyed integrity hash of the bytes provided as defined in RFC 8009
func GetIntegityHash(iv, c, key []byte, usage uint32, e etype.EType) ([]byte, error) {
	// Generate and append integrity hash
	// Rather than calculating the hash over the confounder and plaintext
	// it is calculated over the iv concatenated with the AES cipher output.
	ib := append(iv, c...)
	return common.GetIntegrityHash(ib, key, usage, e)
}

// VerifyIntegrity verifies the integrity of cipertext bytes ct.
func VerifyIntegrity(key, ct []byte, usage uint32, etype etype.EType) bool {
	h := make([]byte, etype.GetHMACBitLength()/8)
	copy(h, ct[len(ct)-etype.GetHMACBitLength()/8:])
	ivz := make([]byte, etype.GetConfounderByteSize())
	ib := append(ivz, ct[:len(ct)-(etype.GetHMACBitLength()/8)]...)
	expectedMAC, _ := common.GetIntegrityHash(ib, key, usage, etype)
	return hmac.Equal(h, expectedMAC)
}
