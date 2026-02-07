//go:generate mockgen -source encoder.go -destination ../../internal/mocks/mock_encoder.go -package mocks OpenFGADatastore

package encoder

// Ensure NoopEncoder implements the Encoder interface.
var _ Encoder = (*NoopEncoder)(nil)

// Encoder is an interface that defines methods for decoding and encoding data.
type Encoder interface {
	Decode(string) ([]byte, error)
	Encode([]byte) (string, error)
}

// NoopEncoder is an implementation of the Encoder interface
// that performs no actual encoding or decoding.
type NoopEncoder struct{}

// Decode returns the input string as a byte slice.
func (e NoopEncoder) Decode(s string) ([]byte, error) {
	return []byte(s), nil
}

// Encode returns the input byte slice as a string.
func (e NoopEncoder) Encode(data []byte) (string, error) {
	return string(data), nil
}
