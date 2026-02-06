package pkcs8

import (
	"crypto/des"
	"encoding/asn1"
)

var (
	oidDESEDE3CBC = asn1.ObjectIdentifier{1, 2, 840, 113549, 3, 7}
)

func init() {
	RegisterCipher(oidDESEDE3CBC, func() Cipher {
		return TripleDESCBC
	})
}

// TripleDESCBC is the 168-bit key 3DES cipher in CBC mode.
var TripleDESCBC = cipherWithBlock{
	ivSize:   des.BlockSize,
	keySize:  24,
	newBlock: des.NewTripleDESCipher,
	oid:      oidDESEDE3CBC,
}
