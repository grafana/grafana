// Package rfc3962 provides encryption and checksum methods as specified in RFC 3962
package rfc3962

import (
	"crypto/rand"
	"errors"
	"fmt"

	"github.com/jcmturner/aescts/v2"
	"github.com/jcmturner/gokrb5/v8/crypto/common"
	"github.com/jcmturner/gokrb5/v8/crypto/etype"
)

// EncryptData encrypts the data provided using methods specific to the etype provided as defined in RFC 3962.
func EncryptData(key, data []byte, e etype.EType) ([]byte, []byte, error) {
	if len(key) != e.GetKeyByteSize() {
		return []byte{}, []byte{}, fmt.Errorf("incorrect keysize: expected: %v actual: %v", e.GetKeyByteSize(), len(key))
	}
	ivz := make([]byte, e.GetCypherBlockBitLength()/8)
	return aescts.Encrypt(key, ivz, data)
}

// EncryptMessage encrypts the message provided using the methods specific to the etype provided as defined in RFC 3962.
// The encrypted data is concatenated with its integrity hash to create an encrypted message.
func EncryptMessage(key, message []byte, usage uint32, e etype.EType) ([]byte, []byte, error) {
	if len(key) != e.GetKeyByteSize() {
		return []byte{}, []byte{}, fmt.Errorf("incorrect keysize: expected: %v actual: %v", e.GetKeyByteSize(), len(key))
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

	// Generate and append integrity hash
	ih, err := common.GetIntegrityHash(plainBytes, key, usage, e)
	if err != nil {
		return iv, b, fmt.Errorf("error encrypting data: %v", err)
	}
	b = append(b, ih...)
	return iv, b, nil
}

// DecryptData decrypts the data provided using the methods specific to the etype provided as defined in RFC 3962.
func DecryptData(key, data []byte, e etype.EType) ([]byte, error) {
	if len(key) != e.GetKeyByteSize() {
		return []byte{}, fmt.Errorf("incorrect keysize: expected: %v actual: %v", e.GetKeyByteSize(), len(key))
	}
	ivz := make([]byte, e.GetCypherBlockBitLength()/8)
	return aescts.Decrypt(key, ivz, data)
}

// DecryptMessage decrypts the message provided using the methods specific to the etype provided as defined in RFC 3962.
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
