// Adapted from https://github.com/go-logfmt/logfmt/ but []byte as parameter instead
// Original license is MIT.
package logfmt

import (
	"bytes"
	"fmt"
	"unicode/utf8"
)

// A Decoder reads and decodes logfmt records from an input stream.
type Decoder struct {
	pos   int
	key   []byte
	value []byte
	line  []byte
	err   error
}

// NewDecoder returns a new decoder that reads from r.
//
// The decoder introduces its own buffering and may read data from r beyond
// the logfmt records requested.
func NewDecoder(line []byte) *Decoder {
	dec := &Decoder{line: line}
	return dec
}

func (dec *Decoder) Reset(line []byte) {
	dec.pos = 0
	dec.line = line
	dec.err = nil
}

func (dec *Decoder) EOL() bool {
	return dec.pos >= len(dec.line)
}

// ScanKeyval advances the Decoder to the next key/value pair of the current
// record, which can then be retrieved with the Key and Value methods. It
// returns false when decoding stops, either by reaching the end of the
// current record or an error.
func (dec *Decoder) ScanKeyval() bool {
	dec.key, dec.value = nil, nil

	line := dec.line

	// garbage
	for p, c := range line[dec.pos:] {
		if c > ' ' {
			dec.pos += p
			goto key
		}
	}
	dec.pos = len(line)
	return false

key:
	const invalidKeyError = "invalid key"

	start, multibyte := dec.pos, false
	for p, c := range line[dec.pos:] {
		switch {
		case c == '=':
			dec.pos += p
			if dec.pos > start {
				dec.key = line[start:dec.pos]
				if multibyte && bytes.ContainsRune(dec.key, utf8.RuneError) {
					dec.syntaxError(invalidKeyError)
					goto skip_value
				}
			}
			if dec.key == nil {
				dec.unexpectedByte(c)
				goto skip_value
			}
			goto equal
		case c == '"':
			dec.pos += p
			dec.unexpectedByte(c)
			goto skip_value
		case c <= ' ':
			dec.pos += p
			if dec.pos > start {
				dec.key = line[start:dec.pos]
				if multibyte && bytes.ContainsRune(dec.key, utf8.RuneError) {
					dec.syntaxError(invalidKeyError)
					return false
				}
			}
			return true
		case c >= utf8.RuneSelf:
			multibyte = true
		}
	}
	dec.pos = len(line)
	if dec.pos > start {
		dec.key = line[start:dec.pos]
		if multibyte && bytes.ContainsRune(dec.key, utf8.RuneError) {
			dec.syntaxError(invalidKeyError)
			return false
		}
	}
	return true

equal:
	dec.pos++
	if dec.pos >= len(line) {
		return true
	}
	switch c := line[dec.pos]; {
	case c <= ' ':
		return true
	case c == '"':
		goto qvalue
	}

	// value
	start = dec.pos
	for p, c := range line[dec.pos:] {
		switch {
		case c == '=' || c == '"':
			dec.pos += p
			dec.unexpectedByte(c)
			goto skip_value
		case c <= ' ':
			dec.pos += p
			if dec.pos > start {
				dec.value = line[start:dec.pos]
			}
			return true
		}
	}
	dec.pos = len(line)
	if dec.pos > start {
		dec.value = line[start:dec.pos]
	}
	return true

skip_value:
	for p, c := range line[dec.pos:] {
		if c <= ' ' {
			dec.pos += p
			return false
		}
	}

	dec.pos = len(line)
	return false

qvalue:
	const (
		untermQuote  = "unterminated quoted value"
		invalidQuote = "invalid quoted value"
	)

	hasEsc, esc := false, false
	start = dec.pos
	for p, c := range line[dec.pos+1:] {
		switch {
		case esc:
			esc = false
		case c == '\\':
			hasEsc, esc = true, true
		case c == '"':
			dec.pos += p + 2
			if hasEsc {
				v, ok := unquoteBytes(line[start:dec.pos])
				if !ok {
					dec.syntaxError(invalidQuote)
					return false
				}
				dec.value = v
			} else {
				start++
				end := dec.pos - 1
				if end > start {
					dec.value = line[start:end]
				}
			}
			return true
		}
	}
	dec.pos = len(line)
	dec.syntaxError(untermQuote)
	return false
}

// Key returns the most recent key found by a call to ScanKeyval. The returned
// slice may point to internal buffers and is only valid until the next call
// to ScanRecord.  It does no allocation.
func (dec *Decoder) Key() []byte {
	return dec.key
}

// Value returns the most recent value found by a call to ScanKeyval. The
// returned slice may point to internal buffers and is only valid until the
// next call to ScanRecord.  It does no allocation when the value has no
// escape sequences.
func (dec *Decoder) Value() []byte {
	return dec.value
}

// Err returns the first non-EOF error that was encountered by the Scanner.
func (dec *Decoder) Err() error {
	return dec.err
}

func (dec *Decoder) syntaxError(msg string) {
	dec.err = &SyntaxError{
		Msg: msg,
		Pos: dec.pos + 1,
	}
}

func (dec *Decoder) unexpectedByte(c byte) {
	dec.err = &SyntaxError{
		Msg: fmt.Sprintf("unexpected %q", c),
		Pos: dec.pos + 1,
	}
}

// A SyntaxError represents a syntax error in the logfmt input stream.
type SyntaxError struct {
	Msg string
	Pos int
}

func (e *SyntaxError) Error() string {
	return fmt.Sprintf("logfmt syntax error at pos %d : %s", e.Pos, e.Msg)
}
