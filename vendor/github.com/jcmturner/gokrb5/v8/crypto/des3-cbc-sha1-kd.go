package crypto

import (
	"crypto/des"
	"crypto/hmac"
	"crypto/sha1"
	"errors"
	"hash"

	"github.com/jcmturner/gokrb5/v8/crypto/common"
	"github.com/jcmturner/gokrb5/v8/crypto/rfc3961"
	"github.com/jcmturner/gokrb5/v8/iana/chksumtype"
	"github.com/jcmturner/gokrb5/v8/iana/etypeID"
)

//RFC: 3961 Section 6.3

// Des3CbcSha1Kd implements Kerberos encryption type des3-cbc-hmac-sha1-kd
type Des3CbcSha1Kd struct {
}

// GetETypeID returns the EType ID number.
func (e Des3CbcSha1Kd) GetETypeID() int32 {
	return etypeID.DES3_CBC_SHA1_KD
}

// GetHashID returns the checksum type ID number.
func (e Des3CbcSha1Kd) GetHashID() int32 {
	return chksumtype.HMAC_SHA1_DES3_KD
}

// GetKeyByteSize returns the number of bytes for key of this etype.
func (e Des3CbcSha1Kd) GetKeyByteSize() int {
	return 24
}

// GetKeySeedBitLength returns the number of bits for the seed for key generation.
func (e Des3CbcSha1Kd) GetKeySeedBitLength() int {
	return 21 * 8
}

// GetHashFunc returns the hash function for this etype.
func (e Des3CbcSha1Kd) GetHashFunc() func() hash.Hash {
	return sha1.New
}

// GetMessageBlockByteSize returns the block size for the etype's messages.
func (e Des3CbcSha1Kd) GetMessageBlockByteSize() int {
	//For traditional CBC mode with padding, it would be the underlying cipher's block size
	return des.BlockSize
}

// GetDefaultStringToKeyParams returns the default key derivation parameters in string form.
func (e Des3CbcSha1Kd) GetDefaultStringToKeyParams() string {
	var s string
	return s
}

// GetConfounderByteSize returns the byte count for confounder to be used during cryptographic operations.
func (e Des3CbcSha1Kd) GetConfounderByteSize() int {
	return des.BlockSize
}

// GetHMACBitLength returns the bit count size of the integrity hash.
func (e Des3CbcSha1Kd) GetHMACBitLength() int {
	return e.GetHashFunc()().Size() * 8
}

// GetCypherBlockBitLength returns the bit count size of the cypher block.
func (e Des3CbcSha1Kd) GetCypherBlockBitLength() int {
	return des.BlockSize * 8
}

// StringToKey returns a key derived from the string provided.
func (e Des3CbcSha1Kd) StringToKey(secret string, salt string, s2kparams string) ([]byte, error) {
	if s2kparams != "" {
		return []byte{}, errors.New("s2kparams must be an empty string")
	}
	return rfc3961.DES3StringToKey(secret, salt, e)
}

// RandomToKey returns a key from the bytes provided.
func (e Des3CbcSha1Kd) RandomToKey(b []byte) []byte {
	return rfc3961.DES3RandomToKey(b)
}

// DeriveRandom generates data needed for key generation.
func (e Des3CbcSha1Kd) DeriveRandom(protocolKey, usage []byte) ([]byte, error) {
	r, err := rfc3961.DeriveRandom(protocolKey, usage, e)
	return r, err
}

// DeriveKey derives a key from the protocol key based on the usage value.
func (e Des3CbcSha1Kd) DeriveKey(protocolKey, usage []byte) ([]byte, error) {
	r, err := e.DeriveRandom(protocolKey, usage)
	if err != nil {
		return nil, err
	}
	return e.RandomToKey(r), nil
}

// EncryptData encrypts the data provided.
func (e Des3CbcSha1Kd) EncryptData(key, data []byte) ([]byte, []byte, error) {
	return rfc3961.DES3EncryptData(key, data, e)
}

// EncryptMessage encrypts the message provided and concatenates it with the integrity hash to create an encrypted message.
func (e Des3CbcSha1Kd) EncryptMessage(key, message []byte, usage uint32) ([]byte, []byte, error) {
	return rfc3961.DES3EncryptMessage(key, message, usage, e)
}

// DecryptData decrypts the data provided.
func (e Des3CbcSha1Kd) DecryptData(key, data []byte) ([]byte, error) {
	return rfc3961.DES3DecryptData(key, data, e)
}

// DecryptMessage decrypts the message provided and verifies the integrity of the message.
func (e Des3CbcSha1Kd) DecryptMessage(key, ciphertext []byte, usage uint32) ([]byte, error) {
	return rfc3961.DES3DecryptMessage(key, ciphertext, usage, e)
}

// VerifyIntegrity checks the integrity of the plaintext message.
func (e Des3CbcSha1Kd) VerifyIntegrity(protocolKey, ct, pt []byte, usage uint32) bool {
	return rfc3961.VerifyIntegrity(protocolKey, ct, pt, usage, e)
}

// GetChecksumHash returns a keyed checksum hash of the bytes provided.
func (e Des3CbcSha1Kd) GetChecksumHash(protocolKey, data []byte, usage uint32) ([]byte, error) {
	return common.GetHash(data, protocolKey, common.GetUsageKc(usage), e)
}

// VerifyChecksum compares the checksum of the message bytes is the same as the checksum provided.
func (e Des3CbcSha1Kd) VerifyChecksum(protocolKey, data, chksum []byte, usage uint32) bool {
	c, err := e.GetChecksumHash(protocolKey, data, usage)
	if err != nil {
		return false
	}
	return hmac.Equal(chksum, c)
}
