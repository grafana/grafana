package crypto

import (
	"bytes"
	"fmt"
	"io"

	cryptoRand "crypto/rand"

	"github.com/grafana/grafana-cloud-migration-snapshot/src/contracts"
	"golang.org/x/crypto/nacl/box"
)

type Nacl struct {
}

func NewNacl() Nacl {
	return Nacl{}
}

func (nacl Nacl) Algo() string {
	return "nacl"
}

func (nacl Nacl) Encrypt(keys contracts.AssymetricKeys, reader io.Reader) (io.Reader, error) {
	var nonce [24]byte

	if _, err := io.ReadFull(cryptoRand.Reader, nonce[:]); err != nil {
		return nil, fmt.Errorf("reading random bytes into nonce buffer: %w", err)
	}

	msg, err := io.ReadAll(reader)
	if err != nil {
		return nil, fmt.Errorf("reading payload from reader: %w", err)
	}

	// This encrypts msg and appends the result to the nonce.
	encrypted := box.Seal(nonce[:], msg, &nonce, (*[32]byte)(keys.Public), (*[32]byte)(keys.Private))

	return bytes.NewReader(encrypted), nil
}

func (nacl Nacl) Decrypt(keys contracts.AssymetricKeys, reader io.Reader) (io.Reader, error) {
	encryptedPayload, err := io.ReadAll(reader)
	if err != nil {
		return nil, fmt.Errorf("reading from reader: %w", err)
	}

	var decryptNonce [24]byte
	copy(decryptNonce[:], encryptedPayload[:24])
	decrypted, ok := box.Open(nil, encryptedPayload[24:], &decryptNonce, (*[32]byte)(keys.Public), (*[32]byte)(keys.Private))
	if !ok {
		return nil, fmt.Errorf("decrypting payload failed")
	}

	return bytes.NewReader(decrypted), nil
}
