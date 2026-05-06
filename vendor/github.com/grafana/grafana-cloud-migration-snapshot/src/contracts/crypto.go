package contracts

import "io"

type AssymetricKeys struct {
	// The public key used to encrypt.
	Public []byte
	// The private key that should be used to decrypt.
	Private []byte
}

type Crypto interface {
	Algo() string
	Encrypt(keys AssymetricKeys, reader io.Reader) (io.Reader, error)
	Decrypt(keys AssymetricKeys, reader io.Reader) (io.Reader, error)
}
