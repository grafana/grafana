package encrypter

// Ensure NoopEncrypter implements the Encrypter interface.
var _ Encrypter = (*NoopEncrypter)(nil)

// Encrypter is an interface that defines methods for encrypting and decrypting data.
type Encrypter interface {
	Decrypt([]byte) ([]byte, error)
	Encrypt([]byte) ([]byte, error)
}

// NoopEncrypter is an implementation of the Encrypter interface
// that performs no actual encryption or decryption.
type NoopEncrypter struct{}

// NewNoopEncrypter creates a new instance of NoopEncrypter.
func NewNoopEncrypter() *NoopEncrypter {
	return &NoopEncrypter{}
}

// Decrypt returns the input byte slice as is.
func (e *NoopEncrypter) Decrypt(data []byte) ([]byte, error) {
	return data, nil
}

// Encrypt returns the input byte slice as is.
func (e *NoopEncrypter) Encrypt(data []byte) ([]byte, error) {
	return data, nil
}
