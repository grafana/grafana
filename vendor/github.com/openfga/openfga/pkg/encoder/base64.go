package encoder

import (
	"encoding/base64"
)

// Ensure Base64Encoder implements the Encoder interface.
var _ Encoder = (*Base64Encoder)(nil)

// Base64Encoder adheres to the Encoder interface, utilizing
// the encoding/base64 encoding strategy for base64 encoding.
type Base64Encoder struct{}

// NewBase64Encoder creates a new instance of the Encoder interface that employs
// the base64 encoding strategy provided by the encoding/base64 package.
func NewBase64Encoder() *Base64Encoder {
	return &Base64Encoder{}
}

// Decode performs base64 URL decoding on the input string using the encoding/base64 package.
func (e *Base64Encoder) Decode(s string) ([]byte, error) {
	return base64.URLEncoding.DecodeString(s)
}

// Encode performs base64 URL encoding on the input byte slice using the encoding/base64 package.
func (e *Base64Encoder) Encode(data []byte) (string, error) {
	return base64.URLEncoding.EncodeToString(data), nil
}
