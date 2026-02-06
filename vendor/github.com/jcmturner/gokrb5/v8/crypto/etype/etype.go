// Package etype provides the Kerberos Encryption Type interface
package etype

import "hash"

// EType is the interface defining the Encryption Type.
type EType interface {
	GetETypeID() int32
	GetHashID() int32
	GetKeyByteSize() int
	GetKeySeedBitLength() int
	GetDefaultStringToKeyParams() string
	StringToKey(string, salt, s2kparams string) ([]byte, error)
	RandomToKey(b []byte) []byte
	GetHMACBitLength() int
	GetMessageBlockByteSize() int
	EncryptData(key, data []byte) ([]byte, []byte, error)
	EncryptMessage(key, message []byte, usage uint32) ([]byte, []byte, error)
	DecryptData(key, data []byte) ([]byte, error)
	DecryptMessage(key, ciphertext []byte, usage uint32) ([]byte, error)
	GetCypherBlockBitLength() int
	GetConfounderByteSize() int
	DeriveKey(protocolKey, usage []byte) ([]byte, error)
	DeriveRandom(protocolKey, usage []byte) ([]byte, error)
	VerifyIntegrity(protocolKey, ct, pt []byte, usage uint32) bool
	GetChecksumHash(protocolKey, data []byte, usage uint32) ([]byte, error)
	VerifyChecksum(protocolKey, data, chksum []byte, usage uint32) bool
	GetHashFunc() func() hash.Hash
}
