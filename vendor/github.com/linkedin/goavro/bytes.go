// Copyright [2017] LinkedIn Corp. Licensed under the Apache License, Version
// 2.0 (the "License"); you may not use this file except in compliance with the
// License.  You may obtain a copy of the License at
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
// WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.

package goavro

import (
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"unicode"
	"unicode/utf16"
	"unicode/utf8"
)

////////////////////////////////////////
// Binary Decode
////////////////////////////////////////

func bytesNativeFromBinary(buf []byte) (interface{}, []byte, error) {
	if len(buf) < 1 {
		return nil, nil, fmt.Errorf("cannot decode binary bytes: %s", io.ErrShortBuffer)
	}
	var decoded interface{}
	var err error
	if decoded, buf, err = longNativeFromBinary(buf); err != nil {
		return nil, nil, fmt.Errorf("cannot decode binary bytes: %s", err)
	}
	size := decoded.(int64) // always returns int64
	if size < 0 {
		return nil, nil, fmt.Errorf("cannot decode binary bytes: negative size: %d", size)
	}
	if size > int64(len(buf)) {
		return nil, nil, fmt.Errorf("cannot decode binary bytes: %s", io.ErrShortBuffer)
	}
	return buf[:size], buf[size:], nil
}

func stringNativeFromBinary(buf []byte) (interface{}, []byte, error) {
	d, b, err := bytesNativeFromBinary(buf)
	if err != nil {
		return nil, nil, fmt.Errorf("cannot decode binary string: %s", err)
	}
	return string(d.([]byte)), b, nil
}

////////////////////////////////////////
// Binary Encode
////////////////////////////////////////

func bytesBinaryFromNative(buf []byte, datum interface{}) ([]byte, error) {
	var d []byte
	switch datum.(type) {
	case []byte:
		d = datum.([]byte)
	case string:
		d = []byte(datum.(string))
	default:
		return nil, fmt.Errorf("cannot encode binary bytes: expected: []byte; received: %T", datum)
	}
	buf, _ = longBinaryFromNative(buf, len(d)) // only fails when given non integer
	return append(buf, d...), nil              // append datum bytes
}

func stringBinaryFromNative(buf []byte, datum interface{}) ([]byte, error) {
	someBytes, ok := datum.(string)
	if !ok {
		return nil, fmt.Errorf("cannot encode binary bytes: expected: string; received: %T", datum)
	}
	buf, _ = longBinaryFromNative(buf, len(someBytes)) // only fails when given non integer
	return append(buf, someBytes...), nil              // append datum bytes
}

////////////////////////////////////////
// Text Decode
////////////////////////////////////////

func bytesNativeFromTextual(buf []byte) (interface{}, []byte, error) {
	buflen := len(buf)
	if buflen < 2 {
		return nil, nil, fmt.Errorf("cannot decode textual bytes: %s", io.ErrShortBuffer)
	}
	if buf[0] != '"' {
		return nil, nil, fmt.Errorf("cannot decode textual bytes: expected initial \"; found: %#U", buf[0])
	}
	var newBytes []byte
	var escaped bool
	// Loop through bytes following initial double quote, but note we will
	// return immediately when find unescaped double quote.
	for i := 1; i < buflen; i++ {
		b := buf[i]
		if escaped {
			escaped = false
			if b2, ok := unescapeSpecialJSON(b); ok {
				newBytes = append(newBytes, b2)
				continue
			}
			if b == 'u' {
				// NOTE: Need at least 4 more bytes to read uint16, but subtract
				// 1 because do not want to count the trailing quote and
				// subtract another 1 because already consumed u but have yet to
				// increment i.
				if i > buflen-6 {
					return nil, nil, fmt.Errorf("cannot decode textual bytes: %s", io.ErrShortBuffer)
				}
				// NOTE: Avro bytes represent binary data, and do not
				// necessarily represent text. Therefore, Avro bytes are not
				// encoded in UTF-16. Each \u is followed by 4 hexadecimal
				// digits, the first and second of which must be 0.
				v, err := parseUint64FromHexSlice(buf[i+3 : i+5])
				if err != nil {
					return nil, nil, fmt.Errorf("cannot decode textual bytes: %s", err)
				}
				i += 4 // absorb 4 characters: one 'u' and three of the digits
				newBytes = append(newBytes, byte(v))
				continue
			}
			newBytes = append(newBytes, b)
			continue
		}
		if b == '\\' {
			escaped = true
			continue
		}
		if b == '"' {
			return newBytes, buf[i+1:], nil
		}
		newBytes = append(newBytes, b)
	}
	return nil, nil, fmt.Errorf("cannot decode textual bytes: expected final \"; found: %#U", buf[buflen-1])
}

func stringNativeFromTextual(buf []byte) (interface{}, []byte, error) {
	buflen := len(buf)
	if buflen < 2 {
		return nil, nil, fmt.Errorf("cannot decode textual string: %s", io.ErrShortBuffer)
	}
	if buf[0] != '"' {
		return nil, nil, fmt.Errorf("cannot decode textual string: expected initial \"; found: %#U", buf[0])
	}
	var newBytes []byte
	var escaped bool
	// Loop through bytes following initial double quote, but note we will
	// return immediately when find unescaped double quote.
	for i := 1; i < buflen; i++ {
		b := buf[i]
		if escaped {
			escaped = false
			if b2, ok := unescapeSpecialJSON(b); ok {
				newBytes = append(newBytes, b2)
				continue
			}
			if b == 'u' {
				// NOTE: Need at least 4 more bytes to read uint16, but subtract
				// 1 because do not want to count the trailing quote and
				// subtract another 1 because already consumed u but have yet to
				// increment i.
				if i > buflen-6 {
					return nil, nil, fmt.Errorf("cannot decode textual string: %s", io.ErrShortBuffer)
				}
				v, err := parseUint64FromHexSlice(buf[i+1 : i+5])
				if err != nil {
					return nil, nil, fmt.Errorf("cannot decode textual string: %s", err)
				}
				i += 4 // absorb 4 characters: one 'u' and three of the digits

				nbl := len(newBytes)
				newBytes = append(newBytes, []byte{0, 0, 0, 0}...) // grow to make room for UTF-8 encoded rune

				r := rune(v)
				if utf16.IsSurrogate(r) {
					i++ // absorb final hexadecimal digit from previous value

					// Expect second half of surrogate pair
					if i > buflen-6 || buf[i] != '\\' || buf[i+1] != 'u' {
						return nil, nil, errors.New("cannot decode textual string: missing second half of surrogate pair")
					}

					v, err = parseUint64FromHexSlice(buf[i+2 : i+6])
					if err != nil {
						return nil, nil, fmt.Errorf("cannot decode textual string: %s", err)
					}
					i += 5 // absorb 5 characters: two for '\u', and 3 of the 4 digits

					// Get code point by combining high and low surrogate bits
					r = utf16.DecodeRune(r, rune(v))
				}

				width := utf8.EncodeRune(newBytes[nbl:], r) // append UTF-8 encoded version of code point
				newBytes = newBytes[:nbl+width]             // trim off excess bytes
				continue
			}
			newBytes = append(newBytes, b)
			continue
		}
		if b == '\\' {
			escaped = true
			continue
		}
		if b == '"' {
			return string(newBytes), buf[i+1:], nil
		}
		newBytes = append(newBytes, b)
	}
	return nil, nil, fmt.Errorf("cannot decode textual string: expected final \"; found: %x", buf[buflen-1])
}

func parseUint64FromHexSlice(buf []byte) (uint64, error) {
	var value uint64
	for _, b := range buf {
		diff := uint64(b - '0')
		if diff < 10 {
			value = (value << 4) | diff
			continue
		}
		b10 := b + 10
		diff = uint64(b10 - 'A')
		if diff < 10 {
			return 0, hex.InvalidByteError(b)
		}
		if diff < 16 {
			value = (value << 4) | diff
			continue
		}
		diff = uint64(b10 - 'a')
		if diff < 10 {
			return 0, hex.InvalidByteError(b)
		}
		if diff < 16 {
			value = (value << 4) | diff
			continue
		}
		return 0, hex.InvalidByteError(b)
	}
	return value, nil
}

func unescapeSpecialJSON(b byte) (byte, bool) {
	// NOTE: The following 8 special JSON characters must be escaped:
	switch b {
	case '"', '\\', '/':
		return b, true
	case 'b':
		return '\b', true
	case 'f':
		return '\f', true
	case 'n':
		return '\n', true
	case 'r':
		return '\r', true
	case 't':
		return '\t', true
	}
	return b, false
}

////////////////////////////////////////
// Text Encode
////////////////////////////////////////

func bytesTextualFromNative(buf []byte, datum interface{}) ([]byte, error) {
	someBytes, ok := datum.([]byte)
	if !ok {
		return nil, fmt.Errorf("cannot encode textual bytes: expected: []byte; received: %T", datum)
	}
	buf = append(buf, '"') // prefix buffer with double quote
	for _, b := range someBytes {
		if escaped, ok := escapeSpecialJSON(b); ok {
			buf = append(buf, escaped...)
			continue
		}
		if r := rune(b); r < utf8.RuneSelf && unicode.IsPrint(r) {
			buf = append(buf, b)
			continue
		}
		// This Code Point _could_ be encoded as a single byte, however, it's
		// above standard ASCII range (b > 127), therefore must encode using its
		// four-byte hexadecimal equivalent, which will always start with the
		// high byte 00
		buf = appendUnicodeHex(buf, uint16(b))
	}
	return append(buf, '"'), nil // postfix buffer with double quote
}

func stringTextualFromNative(buf []byte, datum interface{}) ([]byte, error) {
	someString, ok := datum.(string)
	if !ok {
		return nil, fmt.Errorf("cannot encode textual string: expected: string; received: %T", datum)
	}
	buf = append(buf, '"') // prefix buffer with double quote
	for _, r := range someString {
		if escaped, ok := escapeSpecialJSON(byte(r)); ok {
			buf = append(buf, escaped...)
			continue
		}
		if r < utf8.RuneSelf && unicode.IsPrint(r) {
			buf = append(buf, byte(r))
			continue
		}
		// NOTE: Attempt to encode code point as UTF-16 surrogate pair
		r1, r2 := utf16.EncodeRune(r)
		if r1 != unicode.ReplacementChar || r2 != unicode.ReplacementChar {
			// code point does require surrogate pair, and thus two uint16 values
			buf = appendUnicodeHex(buf, uint16(r1))
			buf = appendUnicodeHex(buf, uint16(r2))
			continue
		}
		// Code Point does not require surrogate pair.
		buf = appendUnicodeHex(buf, uint16(r))
	}
	return append(buf, '"'), nil // postfix buffer with double quote
}

func appendUnicodeHex(buf []byte, v uint16) []byte {
	// Start with '\u' prefix:
	buf = append(buf, sliceUnicode...)
	// And tack on 4 hexadecimal digits:
	buf = append(buf, hexDigits[(v&0xF000)>>12])
	buf = append(buf, hexDigits[(v&0xF00)>>8])
	buf = append(buf, hexDigits[(v&0xF0)>>4])
	buf = append(buf, hexDigits[(v&0xF)])
	return buf
}

const hexDigits = "0123456789ABCDEF"

func escapeSpecialJSON(b byte) ([]byte, bool) {
	// NOTE: The following 8 special JSON characters must be escaped:
	switch b {
	case '"':
		return sliceQuote, true
	case '\\':
		return sliceBackslash, true
	case '/':
		return sliceSlash, true
	case '\b':
		return sliceBackspace, true
	case '\f':
		return sliceFormfeed, true
	case '\n':
		return sliceNewline, true
	case '\r':
		return sliceCarriageReturn, true
	case '\t':
		return sliceTab, true
	}
	return nil, false
}

// While slices in Go are never constants, we can initialize them once and reuse
// them many times. We define these slices at library load time and reuse them
// when encoding JSON.
var (
	sliceQuote          = []byte("\\\"")
	sliceBackslash      = []byte("\\\\")
	sliceSlash          = []byte("\\/")
	sliceBackspace      = []byte("\\b")
	sliceFormfeed       = []byte("\\f")
	sliceNewline        = []byte("\\n")
	sliceCarriageReturn = []byte("\\r")
	sliceTab            = []byte("\\t")
	sliceUnicode        = []byte("\\u")
)
