package rfc3961

import (
	"bytes"

	"github.com/jcmturner/gokrb5/v8/crypto/etype"
)

const (
	prfconstant = "prf"
)

// DeriveRandom implements the RFC 3961 defined function: DR(Key, Constant) = k-truncate(E(Key, Constant, initial-cipher-state)).
//
// key: base key or protocol key. Likely to be a key from a keytab file.
//
// usage: a constant.
//
// n: block size in bits (not bytes) - note if you use something like aes.BlockSize this is in bytes.
//
// k: key length / key seed length in bits. Eg. for AES256 this value is 256.
//
// e: the encryption etype function to use.
func DeriveRandom(key, usage []byte, e etype.EType) ([]byte, error) {
	n := e.GetCypherBlockBitLength()
	k := e.GetKeySeedBitLength()
	//Ensure the usage constant is at least the size of the cypher block size. Pass it through the nfold algorithm that will "stretch" it if needs be.
	nFoldUsage := Nfold(usage, n)
	//k-truncate implemented by creating a byte array the size of k (k is in bits hence /8)
	out := make([]byte, k/8)
	// Keep feeding the output back into the encryption function until it is no longer short than k.
	_, K, err := e.EncryptData(key, nFoldUsage)
	if err != nil {
		return out, err
	}
	for i := copy(out, K); i < len(out); {
		_, K, _ = e.EncryptData(key, K)
		i = i + copy(out[i:], K)
	}
	return out, nil
}

// DeriveKey derives a key from the protocol key based on the usage and the etype's specific methods.
func DeriveKey(protocolKey, usage []byte, e etype.EType) ([]byte, error) {
	r, err := e.DeriveRandom(protocolKey, usage)
	if err != nil {
		return nil, err
	}
	return e.RandomToKey(r), nil
}

// RandomToKey returns a key from the bytes provided according to the definition in RFC 3961.
func RandomToKey(b []byte) []byte {
	return b
}

// DES3RandomToKey returns a key from the bytes provided according to the definition in RFC 3961 for DES3 etypes.
func DES3RandomToKey(b []byte) []byte {
	r := fixWeakKey(stretch56Bits(b[:7]))
	r2 := fixWeakKey(stretch56Bits(b[7:14]))
	r = append(r, r2...)
	r3 := fixWeakKey(stretch56Bits(b[14:21]))
	r = append(r, r3...)
	return r
}

// DES3StringToKey returns a key derived from the string provided according to the definition in RFC 3961 for DES3 etypes.
func DES3StringToKey(secret, salt string, e etype.EType) ([]byte, error) {
	s := secret + salt
	tkey := e.RandomToKey(Nfold([]byte(s), e.GetKeySeedBitLength()))
	return e.DeriveKey(tkey, []byte("kerberos"))
}

// PseudoRandom function as defined in RFC 3961
func PseudoRandom(key, b []byte, e etype.EType) ([]byte, error) {
	h := e.GetHashFunc()()
	h.Write(b)
	tmp := h.Sum(nil)[:e.GetMessageBlockByteSize()]
	k, err := e.DeriveKey(key, []byte(prfconstant))
	if err != nil {
		return []byte{}, err
	}
	_, prf, err := e.EncryptData(k, tmp)
	if err != nil {
		return []byte{}, err
	}
	return prf, nil
}

func stretch56Bits(b []byte) []byte {
	d := make([]byte, len(b), len(b))
	copy(d, b)
	var lb byte
	for i, v := range d {
		bv, nb := calcEvenParity(v)
		d[i] = nb
		if bv != 0 {
			lb = lb | (1 << uint(i+1))
		} else {
			lb = lb &^ (1 << uint(i+1))
		}
	}
	_, lb = calcEvenParity(lb)
	d = append(d, lb)
	return d
}

func calcEvenParity(b byte) (uint8, uint8) {
	lowestbit := b & 0x01
	// c counter of 1s in the first 7 bits of the byte
	var c int
	// Iterate over the highest 7 bits (hence p starts at 1 not zero) and count the 1s.
	for p := 1; p < 8; p++ {
		v := b & (1 << uint(p))
		if v != 0 {
			c++
		}
	}
	if c%2 == 0 {
		//Even number of 1s so set parity to 1
		b = b | 1
	} else {
		//Odd number of 1s so set parity to 0
		b = b &^ 1
	}
	return lowestbit, b
}

func fixWeakKey(b []byte) []byte {
	if weak(b) {
		b[7] ^= 0xF0
	}
	return b
}

func weak(b []byte) bool {
	// weak keys from https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-67r1.pdf
	weakKeys := [4][]byte{
		{0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01},
		{0xFE, 0xFE, 0xFE, 0xFE, 0xFE, 0xFE, 0xFE, 0xFE},
		{0xE0, 0xE0, 0xE0, 0xE0, 0xF1, 0xF1, 0xF1, 0xF1},
		{0x1F, 0x1F, 0x1F, 0x1F, 0x0E, 0x0E, 0x0E, 0x0E},
	}
	semiWeakKeys := [12][]byte{
		{0x01, 0x1F, 0x01, 0x1F, 0x01, 0x0E, 0x01, 0x0E},
		{0x1F, 0x01, 0x1F, 0x01, 0x0E, 0x01, 0x0E, 0x01},
		{0x01, 0xE0, 0x01, 0xE0, 0x01, 0xF1, 0x01, 0xF1},
		{0xE0, 0x01, 0xE0, 0x01, 0xF1, 0x01, 0xF1, 0x01},
		{0x01, 0xFE, 0x01, 0xFE, 0x01, 0xFE, 0x01, 0xFE},
		{0xFE, 0x01, 0xFE, 0x01, 0xFE, 0x01, 0xFE, 0x01},
		{0x1F, 0xE0, 0x1F, 0xE0, 0x0E, 0xF1, 0x0E, 0xF1},
		{0xE0, 0x1F, 0xE0, 0x1F, 0xF1, 0x0E, 0xF1, 0x0E},
		{0x1F, 0xFE, 0x1F, 0xFE, 0x0E, 0xFE, 0x0E, 0xFE},
		{0xFE, 0x1F, 0xFE, 0x1F, 0xFE, 0x0E, 0xFE, 0x0E},
		{0xE0, 0xFE, 0xE0, 0xFE, 0xF1, 0xFE, 0xF1, 0xFE},
		{0xFE, 0xE0, 0xFE, 0xE0, 0xFE, 0xF1, 0xFE, 0xF1},
	}
	for _, k := range weakKeys {
		if bytes.Equal(b, k) {
			return true
		}
	}
	for _, k := range semiWeakKeys {
		if bytes.Equal(b, k) {
			return true
		}
	}
	return false
}
