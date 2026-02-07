package xmlenc

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"io"

	"github.com/beevik/etree"
)

// GCM implements Decrypter and Encrypter for block ciphers in struct mode
type GCM struct {
	keySize   int
	algorithm string
	cipher    func([]byte) (cipher.Block, error)
}

// KeySize returns the length of the key required.
func (e GCM) KeySize() int {
	return e.keySize
}

// Algorithm returns the name of the algorithm, as will be found
// in an xenc:EncryptionMethod element.
func (e GCM) Algorithm() string {
	return e.algorithm
}

// Encrypt encrypts plaintext with key and nonce
func (e GCM) Encrypt(key interface{}, plaintext []byte, nonce []byte) (*etree.Element, error) {
	keyBuf, ok := key.([]byte)
	if !ok {
		return nil, ErrIncorrectKeyType("[]byte")
	}
	if len(keyBuf) != e.keySize {
		return nil, ErrIncorrectKeyLength(e.keySize)
	}

	block, err := e.cipher(keyBuf)
	if err != nil {
		return nil, err
	}

	encryptedDataEl := etree.NewElement("xenc:EncryptedData")
	encryptedDataEl.CreateAttr("xmlns:xenc", "http://www.w3.org/2001/04/xmlenc#")
	{
		randBuf := make([]byte, 16)
		if _, err := RandReader.Read(randBuf); err != nil {
			return nil, err
		}
		encryptedDataEl.CreateAttr("Id", fmt.Sprintf("_%x", randBuf))
	}

	em := encryptedDataEl.CreateElement("xenc:EncryptionMethod")
	em.CreateAttr("Algorithm", e.algorithm)
	em.CreateAttr("xmlns:xenc", "http://www.w3.org/2001/04/xmlenc#")

	plaintext = appendPadding(plaintext, block.BlockSize())

	aesgcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	if nonce == nil {
		// generate random nonce when it's nil
		nonce := make([]byte, aesgcm.NonceSize())
		if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
			panic(err.Error())
		}
	}

	ciphertext := make([]byte, len(plaintext))
	text := aesgcm.Seal(nil, nonce, ciphertext, nil)

	cd := encryptedDataEl.CreateElement("xenc:CipherData")
	cd.CreateAttr("xmlns:xenc", "http://www.w3.org/2001/04/xmlenc#")
	cd.CreateElement("xenc:CipherValue").SetText(base64.StdEncoding.EncodeToString(text))
	return encryptedDataEl, nil
}

// Decrypt decrypts an encrypted element with key. If the ciphertext contains an
// EncryptedKey element, then the type of `key` is determined by the registered
// Decryptor for the EncryptedKey element. Otherwise, `key` must be a []byte of
// length KeySize().
func (e GCM) Decrypt(key interface{}, ciphertextEl *etree.Element) ([]byte, error) {
	if encryptedKeyEl := ciphertextEl.FindElement("./KeyInfo/EncryptedKey"); encryptedKeyEl != nil {
		var err error
		key, err = Decrypt(key, encryptedKeyEl)
		if err != nil {
			return nil, err
		}
	}

	keyBuf, ok := key.([]byte)

	if !ok {
		return nil, ErrIncorrectKeyType("[]byte")
	}
	if len(keyBuf) != e.KeySize() {
		return nil, ErrIncorrectKeyLength(e.KeySize())
	}

	block, err := e.cipher(keyBuf)
	if err != nil {
		return nil, err
	}

	aesgcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	ciphertext, err := getCiphertext(ciphertextEl)
	if err != nil {
		return nil, err
	}

	nonce := ciphertext[:aesgcm.NonceSize()]
	text := ciphertext[aesgcm.NonceSize():]

	plainText, err := aesgcm.Open(nil, nonce, text, nil)
	if err != nil {
		return nil, err
	}
	return plainText, nil
}

var (
	// AES128GCM implements AES128-GCM mode for encryption and decryption
	AES128GCM BlockCipher = GCM{
		keySize:   16,
		algorithm: "http://www.w3.org/2009/xmlenc11#aes128-gcm",
		cipher:    aes.NewCipher,
	}
)

func init() {
	RegisterDecrypter(AES128GCM)
}
