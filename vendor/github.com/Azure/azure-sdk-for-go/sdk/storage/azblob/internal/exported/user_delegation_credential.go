//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

package exported

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/internal/generated"
)

// NewUserDelegationCredential creates a new UserDelegationCredential using a Storage account's Name and a user delegation Key from it
func NewUserDelegationCredential(accountName string, udk UserDelegationKey) *UserDelegationCredential {
	return &UserDelegationCredential{
		accountName:       accountName,
		userDelegationKey: udk,
	}
}

// UserDelegationKey contains UserDelegationKey.
type UserDelegationKey = generated.UserDelegationKey

// UserDelegationCredential contains an account's name and its user delegation key.
type UserDelegationCredential struct {
	accountName       string
	userDelegationKey UserDelegationKey
}

// getAccountName returns the Storage account's Name
func (f *UserDelegationCredential) getAccountName() string {
	return f.accountName
}

// GetAccountName is a helper method for accessing the user delegation key parameters outside this package.
func GetAccountName(udc *UserDelegationCredential) string {
	return udc.getAccountName()
}

// computeHMACSHA256 generates a hash signature for an HTTP request or for a SAS.
func (f *UserDelegationCredential) computeHMACSHA256(message string) (string, error) {
	bytes, _ := base64.StdEncoding.DecodeString(*f.userDelegationKey.Value)
	h := hmac.New(sha256.New, bytes)
	_, err := h.Write([]byte(message))
	return base64.StdEncoding.EncodeToString(h.Sum(nil)), err
}

// ComputeUDCHMACSHA256 is a helper method for computing the signed string outside this package.
func ComputeUDCHMACSHA256(udc *UserDelegationCredential, message string) (string, error) {
	return udc.computeHMACSHA256(message)
}

// getUDKParams returns UserDelegationKey
func (f *UserDelegationCredential) getUDKParams() *UserDelegationKey {
	return &f.userDelegationKey
}

// GetUDKParams is a helper method for accessing the user delegation key parameters outside this package.
func GetUDKParams(udc *UserDelegationCredential) *UserDelegationKey {
	return udc.getUDKParams()
}
