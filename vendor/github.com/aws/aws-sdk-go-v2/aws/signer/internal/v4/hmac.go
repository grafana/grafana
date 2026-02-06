package v4

import (
	"crypto/hmac"
	"crypto/sha256"
)

// HMACSHA256 computes a HMAC-SHA256 of data given the provided key.
func HMACSHA256(key []byte, data []byte) []byte {
	hash := hmac.New(sha256.New, key)
	hash.Write(data)
	return hash.Sum(nil)
}
