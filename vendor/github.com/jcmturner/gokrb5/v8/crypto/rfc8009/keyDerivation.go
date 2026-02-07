package rfc8009

import (
	"crypto/hmac"
	"encoding/binary"
	"encoding/hex"
	"errors"

	"github.com/jcmturner/gokrb5/v8/crypto/etype"
	"github.com/jcmturner/gokrb5/v8/iana/etypeID"
	"golang.org/x/crypto/pbkdf2"
)

const (
	s2kParamsZero = 32768
)

// DeriveRandom for key derivation as defined in RFC 8009
func DeriveRandom(protocolKey, usage []byte, e etype.EType) ([]byte, error) {
	h := e.GetHashFunc()()
	return KDF_HMAC_SHA2(protocolKey, []byte("prf"), usage, h.Size(), e), nil
}

// DeriveKey derives a key from the protocol key based on the usage and the etype's specific methods.
//
// https://tools.ietf.org/html/rfc8009#section-5
func DeriveKey(protocolKey, label []byte, e etype.EType) []byte {
	var context []byte
	var kl int
	// Key length is longer for aes256-cts-hmac-sha384-192 is it is a Ke or from StringToKey (where label is "kerberos")
	if e.GetETypeID() == etypeID.AES256_CTS_HMAC_SHA384_192 {
	Swtch:
		switch label[len(label)-1] {
		case 0x73:
			// 0x73 is "s" so label could be kerberos meaning StringToKey so now check if the label is "kerberos"
			kerblabel := []byte("kerberos")
			if len(label) != len(kerblabel) {
				break
			}
			for i, b := range label {
				if b != kerblabel[i] {
					kl = e.GetKeySeedBitLength()
					break Swtch
				}
			}
			if kl == 0 {
				// This is StringToKey
				kl = 256
			}
		case 0xAA:
			// This is a Ke
			kl = 256
		}
	}
	if kl == 0 {
		kl = e.GetKeySeedBitLength()
	}
	return e.RandomToKey(KDF_HMAC_SHA2(protocolKey, label, context, kl, e))
}

// RandomToKey returns a key from the bytes provided according to the definition in RFC 8009.
func RandomToKey(b []byte) []byte {
	return b
}

// StringToKey returns a key derived from the string provided according to the definition in RFC 8009.
func StringToKey(secret, salt, s2kparams string, e etype.EType) ([]byte, error) {
	i, err := S2KparamsToItertions(s2kparams)
	if err != nil {
		return nil, err
	}
	return StringToKeyIter(secret, salt, i, e)
}

// StringToKeyIter returns a key derived from the string provided according to the definition in RFC 8009.
func StringToKeyIter(secret, salt string, iterations int, e etype.EType) ([]byte, error) {
	tkey := e.RandomToKey(StringToPBKDF2(secret, salt, iterations, e))
	return e.DeriveKey(tkey, []byte("kerberos"))
}

// StringToPBKDF2 generates an encryption key from a pass phrase and salt string using the PBKDF2 function from PKCS #5 v2.0
func StringToPBKDF2(secret, salt string, iterations int, e etype.EType) []byte {
	kl := e.GetKeyByteSize()
	if e.GetETypeID() == etypeID.AES256_CTS_HMAC_SHA384_192 {
		kl = 32
	}
	return pbkdf2.Key([]byte(secret), []byte(salt), iterations, kl, e.GetHashFunc())
}

// KDF_HMAC_SHA2 key derivation: https://tools.ietf.org/html/rfc8009#section-3
func KDF_HMAC_SHA2(protocolKey, label, context []byte, kl int, e etype.EType) []byte {
	//k: Length in bits of the key to be outputted, expressed in big-endian binary representation in 4 bytes.
	k := make([]byte, 4, 4)
	binary.BigEndian.PutUint32(k, uint32(kl))

	c := make([]byte, 4, 4)
	binary.BigEndian.PutUint32(c, uint32(1))
	c = append(c, label...)
	c = append(c, byte(0))
	if len(context) > 0 {
		c = append(c, context...)
	}
	c = append(c, k...)

	mac := hmac.New(e.GetHashFunc(), protocolKey)
	mac.Write(c)
	return mac.Sum(nil)[:(kl / 8)]
}

// GetSaltP returns the salt value based on the etype name: https://tools.ietf.org/html/rfc8009#section-4
func GetSaltP(salt, ename string) string {
	b := []byte(ename)
	b = append(b, byte(0))
	b = append(b, []byte(salt)...)
	return string(b)
}

// S2KparamsToItertions converts the string representation of iterations to an integer for RFC 8009.
func S2KparamsToItertions(s2kparams string) (int, error) {
	var i uint32
	if len(s2kparams) != 8 {
		return s2kParamsZero, errors.New("Invalid s2kparams length")
	}
	b, err := hex.DecodeString(s2kparams)
	if err != nil {
		return s2kParamsZero, errors.New("Invalid s2kparams, cannot decode string to bytes")
	}
	i = binary.BigEndian.Uint32(b)
	//buf := bytes.NewBuffer(b)
	//err = binary.Read(buf, binary.BigEndian, &i)
	if err != nil {
		return s2kParamsZero, errors.New("Invalid s2kparams, cannot convert to big endian int32")
	}
	return int(i), nil
}
