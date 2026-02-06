package azblob

import (
	"time"
)

// ClientProvidedKeyOptions contains headers which may be be specified from service version 2019-02-02
// or higher to encrypts the data on the service-side with the given key. Use of customer-provided keys
// must be done over HTTPS. As the encryption key itself is provided in the request, a secure connection
// must be established to transfer the key.
// Note: Azure Storage does not store or manage customer provided encryption keys. Keys are securely discarded
// as soon as possible after they’ve been used to encrypt or decrypt the blob data.
// https://docs.microsoft.com/en-us/azure/storage/common/storage-service-encryption
// https://docs.microsoft.com/en-us/azure/storage/common/customer-managed-keys-overview
type ClientProvidedKeyOptions struct {
	// A Base64-encoded AES-256 encryption key value.
	EncryptionKey *string

	// The Base64-encoded SHA256 of the encryption key.
	EncryptionKeySha256 *string

	// Specifies the algorithm to use when encrypting data using the given key. Must be AES256.
	EncryptionAlgorithm EncryptionAlgorithmType

	// Specifies the name of the encryption scope to use to encrypt the data provided in the request
	// https://docs.microsoft.com/en-us/azure/storage/blobs/encryption-scope-overview
	// https://docs.microsoft.com/en-us/azure/key-vault/general/overview
	EncryptionScope *string
}

// NewClientProvidedKeyOptions function.
// By default the value of encryption algorithm params is "AES256" for service version 2019-02-02 or higher.
func NewClientProvidedKeyOptions(ek *string, eksha256 *string, es *string) (cpk ClientProvidedKeyOptions) {
	cpk = ClientProvidedKeyOptions{}
	cpk.EncryptionKey, cpk.EncryptionKeySha256, cpk.EncryptionAlgorithm, cpk.EncryptionScope = ek, eksha256, EncryptionAlgorithmAES256, es
	return cpk
}

type ImmutabilityPolicyOptions struct {
	// A container with object-level immutability enabled is required for any options.
	// Both ImmutabilityPolicy options must be filled to set an immutability policy.
	ImmutabilityPolicyUntilDate *time.Time
	ImmutabilityPolicyMode      BlobImmutabilityPolicyModeType

	LegalHold *bool
}

func NewImmutabilityPolicyOptions(untilDate *time.Time, policyMode BlobImmutabilityPolicyModeType, legalHold *bool) ImmutabilityPolicyOptions {
	opt := ImmutabilityPolicyOptions{}
	opt.ImmutabilityPolicyUntilDate, opt.ImmutabilityPolicyMode, opt.LegalHold = untilDate, policyMode, legalHold
	return opt
}

func (pol *ImmutabilityPolicyOptions) pointers() (*time.Time, BlobImmutabilityPolicyModeType, *bool) {
	return pol.ImmutabilityPolicyUntilDate, pol.ImmutabilityPolicyMode, pol.LegalHold
}
