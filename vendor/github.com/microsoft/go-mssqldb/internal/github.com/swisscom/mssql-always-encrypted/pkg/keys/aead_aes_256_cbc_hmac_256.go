package keys

import (
	"fmt"

	"github.com/microsoft/go-mssqldb/internal/github.com/swisscom/mssql-always-encrypted/pkg/crypto"
	"github.com/microsoft/go-mssqldb/internal/github.com/swisscom/mssql-always-encrypted/pkg/utils"
)

var _ Key = &AeadAes256CbcHmac256{}

type AeadAes256CbcHmac256 struct {
	rootKey       []byte
	encryptionKey []byte
	macKey        []byte
	ivKey         []byte
}

func NewAeadAes256CbcHmac256(rootKey []byte) AeadAes256CbcHmac256 {
	const keySize = 256
	const encryptionKeySaltFormat = "Microsoft SQL Server cell encryption key with encryption algorithm:%v and key length:%v"
	const macKeySaltFormat = "Microsoft SQL Server cell MAC key with encryption algorithm:%v and key length:%v"
	const ivKeySaltFormat = "Microsoft SQL Server cell IV key with encryption algorithm:%v and key length:%v"
	const algorithmName = "AEAD_AES_256_CBC_HMAC_SHA256"

	encryptionKeySalt := utils.ProcessUTF16LE(fmt.Sprintf(encryptionKeySaltFormat, algorithmName, keySize))
	macKeySalt := utils.ProcessUTF16LE(fmt.Sprintf(macKeySaltFormat, algorithmName, keySize))
	ivKeySalt := utils.ProcessUTF16LE(fmt.Sprintf(ivKeySaltFormat, algorithmName, keySize))

	return AeadAes256CbcHmac256{
		rootKey:       rootKey,
		encryptionKey: crypto.Sha256Hmac(encryptionKeySalt, rootKey),
		macKey:        crypto.Sha256Hmac(macKeySalt, rootKey),
		ivKey:         crypto.Sha256Hmac(ivKeySalt, rootKey)}
}

func (a AeadAes256CbcHmac256) IvKey() []byte {
	return a.ivKey
}

func (a AeadAes256CbcHmac256) MacKey() []byte {
	return a.macKey
}

func (a AeadAes256CbcHmac256) EncryptionKey() []byte {
	return a.encryptionKey
}

func (a AeadAes256CbcHmac256) RootKey() []byte {
	return a.rootKey
}
