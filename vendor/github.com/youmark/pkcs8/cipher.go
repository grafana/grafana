package pkcs8

import (
	"bytes"
	"crypto/cipher"
	"encoding/asn1"
)

type cipherWithBlock struct {
	oid      asn1.ObjectIdentifier
	ivSize   int
	keySize  int
	newBlock func(key []byte) (cipher.Block, error)
}

func (c cipherWithBlock) IVSize() int {
	return c.ivSize
}

func (c cipherWithBlock) KeySize() int {
	return c.keySize
}

func (c cipherWithBlock) OID() asn1.ObjectIdentifier {
	return c.oid
}

func (c cipherWithBlock) Encrypt(key, iv, plaintext []byte) ([]byte, error) {
	block, err := c.newBlock(key)
	if err != nil {
		return nil, err
	}
	return cbcEncrypt(block, key, iv, plaintext)
}

func (c cipherWithBlock) Decrypt(key, iv, ciphertext []byte) ([]byte, error) {
	block, err := c.newBlock(key)
	if err != nil {
		return nil, err
	}
	return cbcDecrypt(block, key, iv, ciphertext)
}

func cbcEncrypt(block cipher.Block, key, iv, plaintext []byte) ([]byte, error) {
	mode := cipher.NewCBCEncrypter(block, iv)
	paddingLen := block.BlockSize() - (len(plaintext) % block.BlockSize())
	ciphertext := make([]byte, len(plaintext)+paddingLen)
	copy(ciphertext, plaintext)
	copy(ciphertext[len(plaintext):], bytes.Repeat([]byte{byte(paddingLen)}, paddingLen))
	mode.CryptBlocks(ciphertext, ciphertext)
	return ciphertext, nil
}

func cbcDecrypt(block cipher.Block, key, iv, ciphertext []byte) ([]byte, error) {
	mode := cipher.NewCBCDecrypter(block, iv)
	plaintext := make([]byte, len(ciphertext))
	mode.CryptBlocks(plaintext, ciphertext)
	// TODO: remove padding
	return plaintext, nil
}
