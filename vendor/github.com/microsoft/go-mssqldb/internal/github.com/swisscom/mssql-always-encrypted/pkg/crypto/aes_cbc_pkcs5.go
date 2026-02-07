package crypto

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"fmt"
)

// Inspired by: https://gist.github.com/hothero/7d085573f5cb7cdb5801d7adcf66dcf3

type AESCbcPKCS5 struct {
	key   []byte
	iv    []byte
	block cipher.Block
}

func NewAESCbcPKCS5(key []byte, iv []byte) AESCbcPKCS5 {
	a := AESCbcPKCS5{
		key:   key,
		iv:    iv,
		block: nil,
	}
	a.initCipher()
	return a
}

func (a AESCbcPKCS5) Encrypt(cleartext []byte) (cipherText []byte) {
	if a.block == nil {
		a.initCipher()
	}

	blockMode := cipher.NewCBCEncrypter(a.block, a.iv)
	paddedCleartext := PKCS5Padding(cleartext, blockMode.BlockSize())
	cipherText = make([]byte, len(paddedCleartext))
	blockMode.CryptBlocks(cipherText, paddedCleartext)
	return
}

func (a AESCbcPKCS5) Decrypt(ciphertext []byte) []byte {
	if a.block == nil {
		a.initCipher()
	}

	blockMode := cipher.NewCBCDecrypter(a.block, a.iv)
	var cleartext = make([]byte, len(ciphertext))
	blockMode.CryptBlocks(cleartext, ciphertext)
	return PKCS5Trim(cleartext)
}

func PKCS5Padding(inArr []byte, blockSize int) []byte {
	padding := blockSize - len(inArr)%blockSize
	padText := bytes.Repeat([]byte{byte(padding)}, padding)
	return append(inArr, padText...)
}

func PKCS5Trim(inArr []byte) []byte {
	padding := inArr[len(inArr)-1]
	return inArr[:len(inArr)-int(padding)]
}

func (a *AESCbcPKCS5) initCipher() {
	block, err := aes.NewCipher(a.key)
	if err != nil {
		panic(fmt.Errorf("unable to create cipher: %v", err))
	}

	a.block = block
}
