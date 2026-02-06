//go:build (amd64 || arm64) && !purego
// +build amd64 arm64
// +build !purego

package base64

import (
	"encoding/base64"

	"github.com/segmentio/asm/internal/unsafebytes"
)

// An Encoding is a radix 64 encoding/decoding scheme, defined by a
// 64-character alphabet.
type Encoding struct {
	enc    func(dst []byte, src []byte, lut *int8) (int, int)
	enclut [encLutSize]int8

	dec    func(dst []byte, src []byte, lut *int8) (int, int)
	declut [decLutSize]int8

	base *base64.Encoding
}

// WithPadding creates a duplicate Encoding updated with a specified padding
// character, or NoPadding to disable padding. The padding character must not
// be contained in the encoding alphabet, must not be '\r' or '\n', and must
// be no greater than '\xFF'.
func (enc Encoding) WithPadding(padding rune) *Encoding {
	enc.base = enc.base.WithPadding(padding)
	return &enc
}

// Strict creates a duplicate encoding updated with strict decoding enabled.
// This requires that trailing padding bits are zero.
func (enc Encoding) Strict() *Encoding {
	enc.base = enc.base.Strict()
	return &enc
}

// Encode encodes src using the defined encoding alphabet.
// This will write EncodedLen(len(src)) bytes to dst.
func (enc *Encoding) Encode(dst, src []byte) {
	if len(src) >= minEncodeLen && enc.enc != nil {
		d, s := enc.enc(dst, src, &enc.enclut[0])
		dst = dst[d:]
		src = src[s:]
	}
	enc.base.Encode(dst, src)
}

// Encode encodes src using the encoding enc, writing
// EncodedLen(len(src)) bytes to dst.
func (enc *Encoding) EncodeToString(src []byte) string {
	buf := make([]byte, enc.base.EncodedLen(len(src)))
	enc.Encode(buf, src)
	return string(buf)
}

// EncodedLen calculates the base64-encoded byte length for a message
// of length n.
func (enc *Encoding) EncodedLen(n int) int {
	return enc.base.EncodedLen(n)
}

// Decode decodes src using the defined encoding alphabet.
// This will write DecodedLen(len(src)) bytes to dst and return the number of
// bytes written.
func (enc *Encoding) Decode(dst, src []byte) (n int, err error) {
	var d, s int
	if len(src) >= minDecodeLen && enc.dec != nil {
		d, s = enc.dec(dst, src, &enc.declut[0])
		dst = dst[d:]
		src = src[s:]
	}
	n, err = enc.base.Decode(dst, src)
	n += d
	return
}

// DecodeString decodes the base64 encoded string s, returns the decoded
// value as bytes.
func (enc *Encoding) DecodeString(s string) ([]byte, error) {
	src := unsafebytes.BytesOf(s)
	dst := make([]byte, enc.base.DecodedLen(len(s)))
	n, err := enc.Decode(dst, src)
	return dst[:n], err
}

// DecodedLen calculates the decoded byte length for a base64-encoded message
// of length n.
func (enc *Encoding) DecodedLen(n int) int {
	return enc.base.DecodedLen(n)
}
