// Copyright (C) MongoDB, Inc. 2017-present.
//
// Licensed under the Apache License, Version 2.0 (the "License"); you may
// not use this file except in compliance with the License. You may obtain
// a copy of the License at http://www.apache.org/licenses/LICENSE-2.0

package bsonrw

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"math"
	"strconv"
	"unicode"
	"unicode/utf16"
)

type jsonTokenType byte

const (
	jttBeginObject jsonTokenType = iota
	jttEndObject
	jttBeginArray
	jttEndArray
	jttColon
	jttComma
	jttInt32
	jttInt64
	jttDouble
	jttString
	jttBool
	jttNull
	jttEOF
)

type jsonToken struct {
	t jsonTokenType
	v interface{}
	p int
}

type jsonScanner struct {
	r           io.Reader
	buf         []byte
	pos         int
	lastReadErr error
}

// nextToken returns the next JSON token if one exists. A token is a character
// of the JSON grammar, a number, a string, or a literal.
func (js *jsonScanner) nextToken() (*jsonToken, error) {
	c, err := js.readNextByte()

	// keep reading until a non-space is encountered (break on read error or EOF)
	for isWhiteSpace(c) && err == nil {
		c, err = js.readNextByte()
	}

	if errors.Is(err, io.EOF) {
		return &jsonToken{t: jttEOF}, nil
	} else if err != nil {
		return nil, err
	}

	// switch on the character
	switch c {
	case '{':
		return &jsonToken{t: jttBeginObject, v: byte('{'), p: js.pos - 1}, nil
	case '}':
		return &jsonToken{t: jttEndObject, v: byte('}'), p: js.pos - 1}, nil
	case '[':
		return &jsonToken{t: jttBeginArray, v: byte('['), p: js.pos - 1}, nil
	case ']':
		return &jsonToken{t: jttEndArray, v: byte(']'), p: js.pos - 1}, nil
	case ':':
		return &jsonToken{t: jttColon, v: byte(':'), p: js.pos - 1}, nil
	case ',':
		return &jsonToken{t: jttComma, v: byte(','), p: js.pos - 1}, nil
	case '"': // RFC-8259 only allows for double quotes (") not single (')
		return js.scanString()
	default:
		// check if it's a number
		switch {
		case c == '-' || isDigit(c):
			return js.scanNumber(c)
		case c == 't' || c == 'f' || c == 'n':
			// maybe a literal
			return js.scanLiteral(c)
		default:
			return nil, fmt.Errorf("invalid JSON input. Position: %d. Character: %c", js.pos-1, c)
		}
	}
}

// readNextByte attempts to read the next byte from the buffer. If the buffer
// has been exhausted, this function calls readIntoBuf, thus refilling the
// buffer and resetting the read position to 0
func (js *jsonScanner) readNextByte() (byte, error) {
	if js.pos >= len(js.buf) {
		err := js.readIntoBuf()

		if err != nil {
			return 0, err
		}
	}

	b := js.buf[js.pos]
	js.pos++

	return b, nil
}

// readNNextBytes reads n bytes into dst, starting at offset
func (js *jsonScanner) readNNextBytes(dst []byte, n, offset int) error {
	var err error

	for i := 0; i < n; i++ {
		dst[i+offset], err = js.readNextByte()
		if err != nil {
			return err
		}
	}

	return nil
}

// readIntoBuf reads up to 512 bytes from the scanner's io.Reader into the buffer
func (js *jsonScanner) readIntoBuf() error {
	if js.lastReadErr != nil {
		js.buf = js.buf[:0]
		js.pos = 0
		return js.lastReadErr
	}

	if cap(js.buf) == 0 {
		js.buf = make([]byte, 0, 512)
	}

	n, err := js.r.Read(js.buf[:cap(js.buf)])
	if err != nil {
		js.lastReadErr = err
		if n > 0 {
			err = nil
		}
	}
	js.buf = js.buf[:n]
	js.pos = 0

	return err
}

func isWhiteSpace(c byte) bool {
	return c == ' ' || c == '\t' || c == '\r' || c == '\n'
}

func isDigit(c byte) bool {
	return unicode.IsDigit(rune(c))
}

func isValueTerminator(c byte) bool {
	return c == ',' || c == '}' || c == ']' || isWhiteSpace(c)
}

// getu4 decodes the 4-byte hex sequence from the beginning of s, returning the hex value as a rune,
// or it returns -1. Note that the "\u" from the unicode escape sequence should not be present.
// It is copied and lightly modified from the Go JSON decode function at
// https://github.com/golang/go/blob/1b0a0316802b8048d69da49dc23c5a5ab08e8ae8/src/encoding/json/decode.go#L1169-L1188
func getu4(s []byte) rune {
	if len(s) < 4 {
		return -1
	}
	var r rune
	for _, c := range s[:4] {
		switch {
		case '0' <= c && c <= '9':
			c -= '0'
		case 'a' <= c && c <= 'f':
			c = c - 'a' + 10
		case 'A' <= c && c <= 'F':
			c = c - 'A' + 10
		default:
			return -1
		}
		r = r*16 + rune(c)
	}
	return r
}

// scanString reads from an opening '"' to a closing '"' and handles escaped characters
func (js *jsonScanner) scanString() (*jsonToken, error) {
	var b bytes.Buffer
	var c byte
	var err error

	p := js.pos - 1

	for {
		c, err = js.readNextByte()
		if err != nil {
			if errors.Is(err, io.EOF) {
				return nil, errors.New("end of input in JSON string")
			}
			return nil, err
		}

	evalNextChar:
		switch c {
		case '\\':
			c, err = js.readNextByte()
			if err != nil {
				if errors.Is(err, io.EOF) {
					return nil, errors.New("end of input in JSON string")
				}
				return nil, err
			}

		evalNextEscapeChar:
			switch c {
			case '"', '\\', '/':
				b.WriteByte(c)
			case 'b':
				b.WriteByte('\b')
			case 'f':
				b.WriteByte('\f')
			case 'n':
				b.WriteByte('\n')
			case 'r':
				b.WriteByte('\r')
			case 't':
				b.WriteByte('\t')
			case 'u':
				us := make([]byte, 4)
				err = js.readNNextBytes(us, 4, 0)
				if err != nil {
					return nil, fmt.Errorf("invalid unicode sequence in JSON string: %s", us)
				}

				rn := getu4(us)

				// If the rune we just decoded is the high or low value of a possible surrogate pair,
				// try to decode the next sequence as the low value of a surrogate pair. We're
				// expecting the next sequence to be another Unicode escape sequence (e.g. "\uDD1E"),
				// but need to handle cases where the input is not a valid surrogate pair.
				// For more context on unicode surrogate pairs, see:
				// https://www.christianfscott.com/rust-chars-vs-go-runes/
				// https://www.unicode.org/glossary/#high_surrogate_code_point
				if utf16.IsSurrogate(rn) {
					c, err = js.readNextByte()
					if err != nil {
						if errors.Is(err, io.EOF) {
							return nil, errors.New("end of input in JSON string")
						}
						return nil, err
					}

					// If the next value isn't the beginning of a backslash escape sequence, write
					// the Unicode replacement character for the surrogate value and goto the
					// beginning of the next char eval block.
					if c != '\\' {
						b.WriteRune(unicode.ReplacementChar)
						goto evalNextChar
					}

					c, err = js.readNextByte()
					if err != nil {
						if errors.Is(err, io.EOF) {
							return nil, errors.New("end of input in JSON string")
						}
						return nil, err
					}

					// If the next value isn't the beginning of a unicode escape sequence, write the
					// Unicode replacement character for the surrogate value and goto the beginning
					// of the next escape char eval block.
					if c != 'u' {
						b.WriteRune(unicode.ReplacementChar)
						goto evalNextEscapeChar
					}

					err = js.readNNextBytes(us, 4, 0)
					if err != nil {
						return nil, fmt.Errorf("invalid unicode sequence in JSON string: %s", us)
					}

					rn2 := getu4(us)

					// Try to decode the pair of runes as a utf16 surrogate pair. If that fails, write
					// the Unicode replacement character for the surrogate value and the 2nd decoded rune.
					if rnPair := utf16.DecodeRune(rn, rn2); rnPair != unicode.ReplacementChar {
						b.WriteRune(rnPair)
					} else {
						b.WriteRune(unicode.ReplacementChar)
						b.WriteRune(rn2)
					}

					break
				}

				b.WriteRune(rn)
			default:
				return nil, fmt.Errorf("invalid escape sequence in JSON string '\\%c'", c)
			}
		case '"':
			return &jsonToken{t: jttString, v: b.String(), p: p}, nil
		default:
			b.WriteByte(c)
		}
	}
}

// scanLiteral reads an unquoted sequence of characters and determines if it is one of
// three valid JSON literals (true, false, null); if so, it returns the appropriate
// jsonToken; otherwise, it returns an error
func (js *jsonScanner) scanLiteral(first byte) (*jsonToken, error) {
	p := js.pos - 1

	lit := make([]byte, 4)
	lit[0] = first

	err := js.readNNextBytes(lit, 3, 1)
	if err != nil {
		return nil, err
	}

	c5, err := js.readNextByte()

	switch {
	case bytes.Equal([]byte("true"), lit) && (isValueTerminator(c5) || errors.Is(err, io.EOF)):
		js.pos = int(math.Max(0, float64(js.pos-1)))
		return &jsonToken{t: jttBool, v: true, p: p}, nil
	case bytes.Equal([]byte("null"), lit) && (isValueTerminator(c5) || errors.Is(err, io.EOF)):
		js.pos = int(math.Max(0, float64(js.pos-1)))
		return &jsonToken{t: jttNull, v: nil, p: p}, nil
	case bytes.Equal([]byte("fals"), lit):
		if c5 == 'e' {
			c5, err = js.readNextByte()

			if isValueTerminator(c5) || errors.Is(err, io.EOF) {
				js.pos = int(math.Max(0, float64(js.pos-1)))
				return &jsonToken{t: jttBool, v: false, p: p}, nil
			}
		}
	}

	return nil, fmt.Errorf("invalid JSON literal. Position: %d, literal: %s", p, lit)
}

type numberScanState byte

const (
	nssSawLeadingMinus numberScanState = iota
	nssSawLeadingZero
	nssSawIntegerDigits
	nssSawDecimalPoint
	nssSawFractionDigits
	nssSawExponentLetter
	nssSawExponentSign
	nssSawExponentDigits
	nssDone
	nssInvalid
)

// scanNumber reads a JSON number (according to RFC-8259)
func (js *jsonScanner) scanNumber(first byte) (*jsonToken, error) {
	var b bytes.Buffer
	var s numberScanState
	var c byte
	var err error

	t := jttInt64 // assume it's an int64 until the type can be determined
	start := js.pos - 1

	b.WriteByte(first)

	switch first {
	case '-':
		s = nssSawLeadingMinus
	case '0':
		s = nssSawLeadingZero
	default:
		s = nssSawIntegerDigits
	}

	for {
		c, err = js.readNextByte()

		if err != nil && !errors.Is(err, io.EOF) {
			return nil, err
		}

		switch s {
		case nssSawLeadingMinus:
			switch c {
			case '0':
				s = nssSawLeadingZero
				b.WriteByte(c)
			default:
				if isDigit(c) {
					s = nssSawIntegerDigits
					b.WriteByte(c)
				} else {
					s = nssInvalid
				}
			}
		case nssSawLeadingZero:
			switch c {
			case '.':
				s = nssSawDecimalPoint
				b.WriteByte(c)
			case 'e', 'E':
				s = nssSawExponentLetter
				b.WriteByte(c)
			case '}', ']', ',':
				s = nssDone
			default:
				if isWhiteSpace(c) || errors.Is(err, io.EOF) {
					s = nssDone
				} else {
					s = nssInvalid
				}
			}
		case nssSawIntegerDigits:
			switch c {
			case '.':
				s = nssSawDecimalPoint
				b.WriteByte(c)
			case 'e', 'E':
				s = nssSawExponentLetter
				b.WriteByte(c)
			case '}', ']', ',':
				s = nssDone
			default:
				switch {
				case isWhiteSpace(c) || errors.Is(err, io.EOF):
					s = nssDone
				case isDigit(c):
					s = nssSawIntegerDigits
					b.WriteByte(c)
				default:
					s = nssInvalid
				}
			}
		case nssSawDecimalPoint:
			t = jttDouble
			if isDigit(c) {
				s = nssSawFractionDigits
				b.WriteByte(c)
			} else {
				s = nssInvalid
			}
		case nssSawFractionDigits:
			switch c {
			case 'e', 'E':
				s = nssSawExponentLetter
				b.WriteByte(c)
			case '}', ']', ',':
				s = nssDone
			default:
				switch {
				case isWhiteSpace(c) || errors.Is(err, io.EOF):
					s = nssDone
				case isDigit(c):
					s = nssSawFractionDigits
					b.WriteByte(c)
				default:
					s = nssInvalid
				}
			}
		case nssSawExponentLetter:
			t = jttDouble
			switch c {
			case '+', '-':
				s = nssSawExponentSign
				b.WriteByte(c)
			default:
				if isDigit(c) {
					s = nssSawExponentDigits
					b.WriteByte(c)
				} else {
					s = nssInvalid
				}
			}
		case nssSawExponentSign:
			if isDigit(c) {
				s = nssSawExponentDigits
				b.WriteByte(c)
			} else {
				s = nssInvalid
			}
		case nssSawExponentDigits:
			switch c {
			case '}', ']', ',':
				s = nssDone
			default:
				switch {
				case isWhiteSpace(c) || errors.Is(err, io.EOF):
					s = nssDone
				case isDigit(c):
					s = nssSawExponentDigits
					b.WriteByte(c)
				default:
					s = nssInvalid
				}
			}
		}

		switch s {
		case nssInvalid:
			return nil, fmt.Errorf("invalid JSON number. Position: %d", start)
		case nssDone:
			js.pos = int(math.Max(0, float64(js.pos-1)))
			if t != jttDouble {
				v, err := strconv.ParseInt(b.String(), 10, 64)
				if err == nil {
					if v < math.MinInt32 || v > math.MaxInt32 {
						return &jsonToken{t: jttInt64, v: v, p: start}, nil
					}

					return &jsonToken{t: jttInt32, v: int32(v), p: start}, nil
				}
			}

			v, err := strconv.ParseFloat(b.String(), 64)
			if err != nil {
				return nil, err
			}

			return &jsonToken{t: jttDouble, v: v, p: start}, nil
		}
	}
}
