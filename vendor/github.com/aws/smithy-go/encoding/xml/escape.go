// Copyright 2009 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Copied and modified from Go 1.14 stdlib's encoding/xml

package xml

import (
	"unicode/utf8"
)

// Copied from Go 1.14 stdlib's encoding/xml
var (
	escQuot = []byte("&#34;") // shorter than "&quot;"
	escApos = []byte("&#39;") // shorter than "&apos;"
	escAmp  = []byte("&amp;")
	escLT   = []byte("&lt;")
	escGT   = []byte("&gt;")
	escTab  = []byte("&#x9;")
	escNL   = []byte("&#xA;")
	escCR   = []byte("&#xD;")
	escFFFD = []byte("\uFFFD") // Unicode replacement character

	// Additional Escapes
	escNextLine = []byte("&#x85;")
	escLS       = []byte("&#x2028;")
)

// Decide whether the given rune is in the XML Character Range, per
// the Char production of https://www.xml.com/axml/testaxml.htm,
// Section 2.2 Characters.
func isInCharacterRange(r rune) (inrange bool) {
	return r == 0x09 ||
		r == 0x0A ||
		r == 0x0D ||
		r >= 0x20 && r <= 0xD7FF ||
		r >= 0xE000 && r <= 0xFFFD ||
		r >= 0x10000 && r <= 0x10FFFF
}

// TODO: When do we need to escape the string?
// Based on encoding/xml escapeString from the Go Standard Library.
// https://golang.org/src/encoding/xml/xml.go
func escapeString(e writer, s string) {
	var esc []byte
	last := 0
	for i := 0; i < len(s); {
		r, width := utf8.DecodeRuneInString(s[i:])
		i += width
		switch r {
		case '"':
			esc = escQuot
		case '\'':
			esc = escApos
		case '&':
			esc = escAmp
		case '<':
			esc = escLT
		case '>':
			esc = escGT
		case '\t':
			esc = escTab
		case '\n':
			esc = escNL
		case '\r':
			esc = escCR
		case '\u0085':
			// Not escaped by stdlib
			esc = escNextLine
		case '\u2028':
			// Not escaped by stdlib
			esc = escLS
		default:
			if !isInCharacterRange(r) || (r == 0xFFFD && width == 1) {
				esc = escFFFD
				break
			}
			continue
		}
		e.WriteString(s[last : i-width])
		e.Write(esc)
		last = i
	}
	e.WriteString(s[last:])
}

// escapeText writes to w the properly escaped XML equivalent
// of the plain text data s. If escapeNewline is true, newline
// characters will be escaped.
//
// Based on encoding/xml escapeText from the Go Standard Library.
// https://golang.org/src/encoding/xml/xml.go
func escapeText(e writer, s []byte) {
	var esc []byte
	last := 0
	for i := 0; i < len(s); {
		r, width := utf8.DecodeRune(s[i:])
		i += width
		switch r {
		case '"':
			esc = escQuot
		case '\'':
			esc = escApos
		case '&':
			esc = escAmp
		case '<':
			esc = escLT
		case '>':
			esc = escGT
		case '\t':
			esc = escTab
		case '\n':
			// This always escapes newline, which is different than stdlib's optional
			// escape of new line.
			esc = escNL
		case '\r':
			esc = escCR
		case '\u0085':
			// Not escaped by stdlib
			esc = escNextLine
		case '\u2028':
			// Not escaped by stdlib
			esc = escLS
		default:
			if !isInCharacterRange(r) || (r == 0xFFFD && width == 1) {
				esc = escFFFD
				break
			}
			continue
		}
		e.Write(s[last : i-width])
		e.Write(esc)
		last = i
	}
	e.Write(s[last:])
}
