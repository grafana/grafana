package encoder

import (
	"github.com/openfga/openfga/pkg/encrypter"
)

// Ensure TokenEncoder implements the Encoder interface.
var _ Encoder = (*TokenEncoder)(nil)

// TokenEncoder combines an encrypter and an encoder to provide
// functionality for encoding and decoding tokens.
type TokenEncoder struct {
	encrypter encrypter.Encrypter
	encoder   Encoder
}

// NewTokenEncoder constructs a TokenEncoder with the provided encrypter and encoder.
func NewTokenEncoder(encrypter encrypter.Encrypter, encoder Encoder) *TokenEncoder {
	return &TokenEncoder{
		encrypter: encrypter,
		encoder:   encoder,
	}
}

// Decode first decodes the input string using its internal decoder,
// and subsequently decrypts the resulting data using its encrypter.
func (e *TokenEncoder) Decode(s string) ([]byte, error) {
	decoded, err := e.encoder.Decode(s)
	if err != nil {
		return nil, err
	}

	return e.encrypter.Decrypt(decoded)
}

// Encode first encrypts the provided data using its internal encrypter,
// and then encodes the resulting encrypted data using its encoder.
func (e *TokenEncoder) Encode(data []byte) (string, error) {
	encrypted, err := e.encrypter.Encrypt(data)
	if err != nil {
		return "", err
	}

	return e.encoder.Encode(encrypted)
}
