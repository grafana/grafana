package crypto

import (
	"crypto/hmac"
	"crypto/sha256"
)

func Sha256Hmac(input []byte, key []byte) []byte {
	sha256Hmac := hmac.New(sha256.New, key)
	sha256Hmac.Write(input)
	return sha256Hmac.Sum(nil)
}
