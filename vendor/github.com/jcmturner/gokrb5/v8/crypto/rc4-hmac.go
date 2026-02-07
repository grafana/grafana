package crypto

import (
	"bytes"
	"crypto/hmac"
	"crypto/md5"
	"hash"
	"io"

	"github.com/jcmturner/gokrb5/v8/crypto/rfc3961"
	"github.com/jcmturner/gokrb5/v8/crypto/rfc4757"
	"github.com/jcmturner/gokrb5/v8/iana/chksumtype"
	"github.com/jcmturner/gokrb5/v8/iana/etypeID"
	"golang.org/x/crypto/md4"
)

// RC4HMAC implements Kerberos encryption type rc4-hmac
type RC4HMAC struct {
}

// GetETypeID returns the EType ID number.
func (e RC4HMAC) GetETypeID() int32 {
	return etypeID.RC4_HMAC
}

// GetHashID returns the checksum type ID number.
func (e RC4HMAC) GetHashID() int32 {
	return chksumtype.KERB_CHECKSUM_HMAC_MD5
}

// GetKeyByteSize returns the number of bytes for key of this etype.
func (e RC4HMAC) GetKeyByteSize() int {
	return 16
}

// GetKeySeedBitLength returns the number of bits for the seed for key generation.
func (e RC4HMAC) GetKeySeedBitLength() int {
	return e.GetKeyByteSize() * 8
}

// GetHashFunc returns the hash function for this etype.
func (e RC4HMAC) GetHashFunc() func() hash.Hash {
	return md5.New
}

// GetMessageBlockByteSize returns the block size for the etype's messages.
func (e RC4HMAC) GetMessageBlockByteSize() int {
	return 1
}

// GetDefaultStringToKeyParams returns the default key derivation parameters in string form.
func (e RC4HMAC) GetDefaultStringToKeyParams() string {
	return ""
}

// GetConfounderByteSize returns the byte count for confounder to be used during cryptographic operations.
func (e RC4HMAC) GetConfounderByteSize() int {
	return 8
}

// GetHMACBitLength returns the bit count size of the integrity hash.
func (e RC4HMAC) GetHMACBitLength() int {
	return md5.Size * 8
}

// GetCypherBlockBitLength returns the bit count size of the cypher block.
func (e RC4HMAC) GetCypherBlockBitLength() int {
	return 8 // doesn't really apply
}

// StringToKey returns a key derived from the string provided.
func (e RC4HMAC) StringToKey(secret string, salt string, s2kparams string) ([]byte, error) {
	return rfc4757.StringToKey(secret)
}

// RandomToKey returns a key from the bytes provided.
func (e RC4HMAC) RandomToKey(b []byte) []byte {
	r := bytes.NewReader(b)
	h := md4.New()
	io.Copy(h, r)
	return h.Sum(nil)
}

// EncryptData encrypts the data provided.
func (e RC4HMAC) EncryptData(key, data []byte) ([]byte, []byte, error) {
	b, err := rfc4757.EncryptData(key, data, e)
	return []byte{}, b, err
}

// EncryptMessage encrypts the message provided and concatenates it with the integrity hash to create an encrypted message.
func (e RC4HMAC) EncryptMessage(key, message []byte, usage uint32) ([]byte, []byte, error) {
	b, err := rfc4757.EncryptMessage(key, message, usage, false, e)
	return []byte{}, b, err
}

// DecryptData decrypts the data provided.
func (e RC4HMAC) DecryptData(key, data []byte) ([]byte, error) {
	return rfc4757.DecryptData(key, data, e)
}

// DecryptMessage decrypts the message provided and verifies the integrity of the message.
func (e RC4HMAC) DecryptMessage(key, ciphertext []byte, usage uint32) ([]byte, error) {
	return rfc4757.DecryptMessage(key, ciphertext, usage, false, e)
}

// DeriveKey derives a key from the protocol key based on the usage value.
func (e RC4HMAC) DeriveKey(protocolKey, usage []byte) ([]byte, error) {
	return rfc4757.HMAC(protocolKey, usage), nil
}

// DeriveRandom generates data needed for key generation.
func (e RC4HMAC) DeriveRandom(protocolKey, usage []byte) ([]byte, error) {
	return rfc3961.DeriveRandom(protocolKey, usage, e)
}

// VerifyIntegrity checks the integrity of the plaintext message.
func (e RC4HMAC) VerifyIntegrity(protocolKey, ct, pt []byte, usage uint32) bool {
	return rfc4757.VerifyIntegrity(protocolKey, pt, ct, e)
}

// GetChecksumHash returns a keyed checksum hash of the bytes provided.
func (e RC4HMAC) GetChecksumHash(protocolKey, data []byte, usage uint32) ([]byte, error) {
	return rfc4757.Checksum(protocolKey, usage, data)
}

// VerifyChecksum compares the checksum of the message bytes is the same as the checksum provided.
func (e RC4HMAC) VerifyChecksum(protocolKey, data, chksum []byte, usage uint32) bool {
	checksum, err := rfc4757.Checksum(protocolKey, usage, data)
	if err != nil {
		return false
	}
	return hmac.Equal(checksum, chksum)
}
