package crypto

import (
	"crypto/aes"
	"crypto/hmac"
	"crypto/sha1"
	"hash"

	"github.com/jcmturner/gokrb5/v8/crypto/common"
	"github.com/jcmturner/gokrb5/v8/crypto/rfc3961"
	"github.com/jcmturner/gokrb5/v8/crypto/rfc3962"
	"github.com/jcmturner/gokrb5/v8/iana/chksumtype"
	"github.com/jcmturner/gokrb5/v8/iana/etypeID"
)

// RFC 3962

// Aes256CtsHmacSha96 implements Kerberos encryption type aes256-cts-hmac-sha1-96
type Aes256CtsHmacSha96 struct {
}

// GetETypeID returns the EType ID number.
func (e Aes256CtsHmacSha96) GetETypeID() int32 {
	return etypeID.AES256_CTS_HMAC_SHA1_96
}

// GetHashID returns the checksum type ID number.
func (e Aes256CtsHmacSha96) GetHashID() int32 {
	return chksumtype.HMAC_SHA1_96_AES256
}

// GetKeyByteSize returns the number of bytes for key of this etype.
func (e Aes256CtsHmacSha96) GetKeyByteSize() int {
	return 256 / 8
}

// GetKeySeedBitLength returns the number of bits for the seed for key generation.
func (e Aes256CtsHmacSha96) GetKeySeedBitLength() int {
	return e.GetKeyByteSize() * 8
}

// GetHashFunc returns the hash function for this etype.
func (e Aes256CtsHmacSha96) GetHashFunc() func() hash.Hash {
	return sha1.New
}

// GetMessageBlockByteSize returns the block size for the etype's messages.
func (e Aes256CtsHmacSha96) GetMessageBlockByteSize() int {
	return 1
}

// GetDefaultStringToKeyParams returns the default key derivation parameters in string form.
func (e Aes256CtsHmacSha96) GetDefaultStringToKeyParams() string {
	return "00001000"
}

// GetConfounderByteSize returns the byte count for confounder to be used during cryptographic operations.
func (e Aes256CtsHmacSha96) GetConfounderByteSize() int {
	return aes.BlockSize
}

// GetHMACBitLength returns the bit count size of the integrity hash.
func (e Aes256CtsHmacSha96) GetHMACBitLength() int {
	return 96
}

// GetCypherBlockBitLength returns the bit count size of the cypher block.
func (e Aes256CtsHmacSha96) GetCypherBlockBitLength() int {
	return aes.BlockSize * 8
}

// StringToKey returns a key derived from the string provided.
func (e Aes256CtsHmacSha96) StringToKey(secret string, salt string, s2kparams string) ([]byte, error) {
	return rfc3962.StringToKey(secret, salt, s2kparams, e)
}

// RandomToKey returns a key from the bytes provided.
func (e Aes256CtsHmacSha96) RandomToKey(b []byte) []byte {
	return rfc3961.RandomToKey(b)
}

// EncryptData encrypts the data provided.
func (e Aes256CtsHmacSha96) EncryptData(key, data []byte) ([]byte, []byte, error) {
	return rfc3962.EncryptData(key, data, e)
}

// EncryptMessage encrypts the message provided and concatenates it with the integrity hash to create an encrypted message.
func (e Aes256CtsHmacSha96) EncryptMessage(key, message []byte, usage uint32) ([]byte, []byte, error) {
	return rfc3962.EncryptMessage(key, message, usage, e)
}

// DecryptData decrypts the data provided.
func (e Aes256CtsHmacSha96) DecryptData(key, data []byte) ([]byte, error) {
	return rfc3962.DecryptData(key, data, e)
}

// DecryptMessage decrypts the message provided and verifies the integrity of the message.
func (e Aes256CtsHmacSha96) DecryptMessage(key, ciphertext []byte, usage uint32) ([]byte, error) {
	return rfc3962.DecryptMessage(key, ciphertext, usage, e)
}

// DeriveKey derives a key from the protocol key based on the usage value.
func (e Aes256CtsHmacSha96) DeriveKey(protocolKey, usage []byte) ([]byte, error) {
	return rfc3961.DeriveKey(protocolKey, usage, e)
}

// DeriveRandom generates data needed for key generation.
func (e Aes256CtsHmacSha96) DeriveRandom(protocolKey, usage []byte) ([]byte, error) {
	return rfc3961.DeriveRandom(protocolKey, usage, e)
}

// VerifyIntegrity checks the integrity of the plaintext message.
func (e Aes256CtsHmacSha96) VerifyIntegrity(protocolKey, ct, pt []byte, usage uint32) bool {
	return rfc3961.VerifyIntegrity(protocolKey, ct, pt, usage, e)
}

// GetChecksumHash returns a keyed checksum hash of the bytes provided.
func (e Aes256CtsHmacSha96) GetChecksumHash(protocolKey, data []byte, usage uint32) ([]byte, error) {
	return common.GetHash(data, protocolKey, common.GetUsageKc(usage), e)
}

// VerifyChecksum compares the checksum of the message bytes is the same as the checksum provided.
func (e Aes256CtsHmacSha96) VerifyChecksum(protocolKey, data, chksum []byte, usage uint32) bool {
	c, err := e.GetChecksumHash(protocolKey, data, usage)
	if err != nil {
		return false
	}
	return hmac.Equal(chksum, c)
}
