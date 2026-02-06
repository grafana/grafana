package crypto

import (
	"crypto/aes"
	"crypto/hmac"
	"crypto/sha256"
	"hash"

	"github.com/jcmturner/gokrb5/v8/crypto/common"
	"github.com/jcmturner/gokrb5/v8/crypto/rfc8009"
	"github.com/jcmturner/gokrb5/v8/iana/chksumtype"
	"github.com/jcmturner/gokrb5/v8/iana/etypeID"
)

// RFC https://tools.ietf.org/html/rfc8009

// Aes128CtsHmacSha256128 implements Kerberos encryption type aes128-cts-hmac-sha256-128
type Aes128CtsHmacSha256128 struct {
}

// GetETypeID returns the EType ID number.
func (e Aes128CtsHmacSha256128) GetETypeID() int32 {
	return etypeID.AES128_CTS_HMAC_SHA256_128
}

// GetHashID returns the checksum type ID number.
func (e Aes128CtsHmacSha256128) GetHashID() int32 {
	return chksumtype.HMAC_SHA256_128_AES128
}

// GetKeyByteSize returns the number of bytes for key of this etype.
func (e Aes128CtsHmacSha256128) GetKeyByteSize() int {
	return 128 / 8
}

// GetKeySeedBitLength returns the number of bits for the seed for key generation.
func (e Aes128CtsHmacSha256128) GetKeySeedBitLength() int {
	return e.GetKeyByteSize() * 8
}

// GetHashFunc returns the hash function for this etype.
func (e Aes128CtsHmacSha256128) GetHashFunc() func() hash.Hash {
	return sha256.New
}

// GetMessageBlockByteSize returns the block size for the etype's messages.
func (e Aes128CtsHmacSha256128) GetMessageBlockByteSize() int {
	return 1
}

// GetDefaultStringToKeyParams returns the default key derivation parameters in string form.
func (e Aes128CtsHmacSha256128) GetDefaultStringToKeyParams() string {
	return "00008000"
}

// GetConfounderByteSize returns the byte count for confounder to be used during cryptographic operations.
func (e Aes128CtsHmacSha256128) GetConfounderByteSize() int {
	return aes.BlockSize
}

// GetHMACBitLength returns the bit count size of the integrity hash.
func (e Aes128CtsHmacSha256128) GetHMACBitLength() int {
	return 128
}

// GetCypherBlockBitLength returns the bit count size of the cypher block.
func (e Aes128CtsHmacSha256128) GetCypherBlockBitLength() int {
	return aes.BlockSize * 8
}

// StringToKey returns a key derived from the string provided.
func (e Aes128CtsHmacSha256128) StringToKey(secret string, salt string, s2kparams string) ([]byte, error) {
	saltp := rfc8009.GetSaltP(salt, "aes128-cts-hmac-sha256-128")
	return rfc8009.StringToKey(secret, saltp, s2kparams, e)
}

// RandomToKey returns a key from the bytes provided.
func (e Aes128CtsHmacSha256128) RandomToKey(b []byte) []byte {
	return rfc8009.RandomToKey(b)
}

// EncryptData encrypts the data provided.
func (e Aes128CtsHmacSha256128) EncryptData(key, data []byte) ([]byte, []byte, error) {
	return rfc8009.EncryptData(key, data, e)
}

// EncryptMessage encrypts the message provided and concatenates it with the integrity hash to create an encrypted message.
func (e Aes128CtsHmacSha256128) EncryptMessage(key, message []byte, usage uint32) ([]byte, []byte, error) {
	return rfc8009.EncryptMessage(key, message, usage, e)
}

// DecryptData decrypts the data provided.
func (e Aes128CtsHmacSha256128) DecryptData(key, data []byte) ([]byte, error) {
	return rfc8009.DecryptData(key, data, e)
}

// DecryptMessage decrypts the message provided and verifies the integrity of the message.
func (e Aes128CtsHmacSha256128) DecryptMessage(key, ciphertext []byte, usage uint32) ([]byte, error) {
	return rfc8009.DecryptMessage(key, ciphertext, usage, e)
}

// DeriveKey derives a key from the protocol key based on the usage value.
func (e Aes128CtsHmacSha256128) DeriveKey(protocolKey, usage []byte) ([]byte, error) {
	return rfc8009.DeriveKey(protocolKey, usage, e), nil
}

// DeriveRandom generates data needed for key generation.
func (e Aes128CtsHmacSha256128) DeriveRandom(protocolKey, usage []byte) ([]byte, error) {
	return rfc8009.DeriveRandom(protocolKey, usage, e)
}

// VerifyIntegrity checks the integrity of the ciphertext message.
// As the hash is calculated over the iv concatenated with the AES cipher output not the plaintext the pt value to this
// interface method is not use. Pass any []byte.
func (e Aes128CtsHmacSha256128) VerifyIntegrity(protocolKey, ct, pt []byte, usage uint32) bool {
	// We don't need ib just there for the interface
	return rfc8009.VerifyIntegrity(protocolKey, ct, usage, e)
}

// GetChecksumHash returns a keyed checksum hash of the bytes provided.
func (e Aes128CtsHmacSha256128) GetChecksumHash(protocolKey, data []byte, usage uint32) ([]byte, error) {
	return common.GetHash(data, protocolKey, common.GetUsageKc(usage), e)
}

// VerifyChecksum compares the checksum of the message bytes is the same as the checksum provided.
func (e Aes128CtsHmacSha256128) VerifyChecksum(protocolKey, data, chksum []byte, usage uint32) bool {
	c, err := e.GetChecksumHash(protocolKey, data, usage)
	if err != nil {
		return false
	}
	return hmac.Equal(chksum, c)
}
