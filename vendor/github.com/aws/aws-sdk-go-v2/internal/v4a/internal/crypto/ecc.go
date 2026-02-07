package crypto

import (
	"bytes"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/hmac"
	"encoding/asn1"
	"encoding/binary"
	"fmt"
	"hash"
	"math"
	"math/big"
)

type ecdsaSignature struct {
	R, S *big.Int
}

// ECDSAKey takes the given elliptic curve, and private key (d) byte slice
// and returns the private ECDSA key.
func ECDSAKey(curve elliptic.Curve, d []byte) *ecdsa.PrivateKey {
	return ECDSAKeyFromPoint(curve, (&big.Int{}).SetBytes(d))
}

// ECDSAKeyFromPoint takes the given elliptic curve and point and returns the
// private and public keypair
func ECDSAKeyFromPoint(curve elliptic.Curve, d *big.Int) *ecdsa.PrivateKey {
	pX, pY := curve.ScalarBaseMult(d.Bytes())

	privKey := &ecdsa.PrivateKey{
		PublicKey: ecdsa.PublicKey{
			Curve: curve,
			X:     pX,
			Y:     pY,
		},
		D: d,
	}

	return privKey
}

// ECDSAPublicKey takes the provide curve and (x, y) coordinates and returns
// *ecdsa.PublicKey. Returns an error if the given points are not on the curve.
func ECDSAPublicKey(curve elliptic.Curve, x, y []byte) (*ecdsa.PublicKey, error) {
	xPoint := (&big.Int{}).SetBytes(x)
	yPoint := (&big.Int{}).SetBytes(y)

	if !curve.IsOnCurve(xPoint, yPoint) {
		return nil, fmt.Errorf("point(%v, %v) is not on the given curve", xPoint.String(), yPoint.String())
	}

	return &ecdsa.PublicKey{
		Curve: curve,
		X:     xPoint,
		Y:     yPoint,
	}, nil
}

// VerifySignature takes the provided public key, hash, and asn1 encoded signature and returns
// whether the given signature is valid.
func VerifySignature(key *ecdsa.PublicKey, hash []byte, signature []byte) (bool, error) {
	var ecdsaSignature ecdsaSignature

	_, err := asn1.Unmarshal(signature, &ecdsaSignature)
	if err != nil {
		return false, err
	}

	return ecdsa.Verify(key, hash, ecdsaSignature.R, ecdsaSignature.S), nil
}

// HMACKeyDerivation provides an implementation of a NIST-800-108 of a KDF (Key Derivation Function) in Counter Mode.
// For the purposes of this implantation HMAC is used as the PRF (Pseudorandom function), where the value of
// `r` is defined as a 4 byte counter.
func HMACKeyDerivation(hash func() hash.Hash, bitLen int, key []byte, label, context []byte) ([]byte, error) {
	// verify that we won't overflow the counter
	n := int64(math.Ceil((float64(bitLen) / 8) / float64(hash().Size())))
	if n > 0x7FFFFFFF {
		return nil, fmt.Errorf("unable to derive key of size %d using 32-bit counter", bitLen)
	}

	// verify the requested bit length is not larger then the length encoding size
	if int64(bitLen) > 0x7FFFFFFF {
		return nil, fmt.Errorf("bitLen is greater than 32-bits")
	}

	fixedInput := bytes.NewBuffer(nil)
	fixedInput.Write(label)
	fixedInput.WriteByte(0x00)
	fixedInput.Write(context)
	if err := binary.Write(fixedInput, binary.BigEndian, int32(bitLen)); err != nil {
		return nil, fmt.Errorf("failed to write bit length to fixed input string: %v", err)
	}

	var output []byte

	h := hmac.New(hash, key)

	for i := int64(1); i <= n; i++ {
		h.Reset()
		if err := binary.Write(h, binary.BigEndian, int32(i)); err != nil {
			return nil, err
		}
		_, err := h.Write(fixedInput.Bytes())
		if err != nil {
			return nil, err
		}
		output = append(output, h.Sum(nil)...)
	}

	return output[:bitLen/8], nil
}
