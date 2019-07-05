// Copyright 2015-2019 Brett Vickers.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package etree

import (
	"bufio"
	"io"
	"strings"
	"unicode/utf8"
)

// A simple stack
type stack struct {
	data []interface{}
}

func (s *stack) empty() bool {
	return len(s.data) == 0
}

func (s *stack) push(value interface{}) {
	s.data = append(s.data, value)
}

func (s *stack) pop() interface{} {
	value := s.data[len(s.data)-1]
	s.data[len(s.data)-1] = nil
	s.data = s.data[:len(s.data)-1]
	return value
}

func (s *stack) peek() interface{} {
	return s.data[len(s.data)-1]
}

// A fifo is a simple first-in-first-out queue.
type fifo struct {
	data       []interface{}
	head, tail int
}

func (f *fifo) add(value interface{}) {
	if f.len()+1 >= len(f.data) {
		f.grow()
	}
	f.data[f.tail] = value
	if f.tail++; f.tail == len(f.data) {
		f.tail = 0
	}
}

func (f *fifo) remove() interface{} {
	value := f.data[f.head]
	f.data[f.head] = nil
	if f.head++; f.head == len(f.data) {
		f.head = 0
	}
	return value
}

func (f *fifo) len() int {
	if f.tail >= f.head {
		return f.tail - f.head
	}
	return len(f.data) - f.head + f.tail
}

func (f *fifo) grow() {
	c := len(f.data) * 2
	if c == 0 {
		c = 4
	}
	buf, count := make([]interface{}, c), f.len()
	if f.tail >= f.head {
		copy(buf[0:count], f.data[f.head:f.tail])
	} else {
		hindex := len(f.data) - f.head
		copy(buf[0:hindex], f.data[f.head:])
		copy(buf[hindex:count], f.data[:f.tail])
	}
	f.data, f.head, f.tail = buf, 0, count
}

// countReader implements a proxy reader that counts the number of
// bytes read from its encapsulated reader.
type countReader struct {
	r     io.Reader
	bytes int64
}

func newCountReader(r io.Reader) *countReader {
	return &countReader{r: r}
}

func (cr *countReader) Read(p []byte) (n int, err error) {
	b, err := cr.r.Read(p)
	cr.bytes += int64(b)
	return b, err
}

// countWriter implements a proxy writer that counts the number of
// bytes written by its encapsulated writer.
type countWriter struct {
	w     io.Writer
	bytes int64
}

func newCountWriter(w io.Writer) *countWriter {
	return &countWriter{w: w}
}

func (cw *countWriter) Write(p []byte) (n int, err error) {
	b, err := cw.w.Write(p)
	cw.bytes += int64(b)
	return b, err
}

// isWhitespace returns true if the byte slice contains only
// whitespace characters.
func isWhitespace(s string) bool {
	for i := 0; i < len(s); i++ {
		if c := s[i]; c != ' ' && c != '\t' && c != '\n' && c != '\r' {
			return false
		}
	}
	return true
}

// spaceMatch returns true if namespace a is the empty string
// or if namespace a equals namespace b.
func spaceMatch(a, b string) bool {
	switch {
	case a == "":
		return true
	default:
		return a == b
	}
}

// spaceDecompose breaks a namespace:tag identifier at the ':'
// and returns the two parts.
func spaceDecompose(str string) (space, key string) {
	colon := strings.IndexByte(str, ':')
	if colon == -1 {
		return "", str
	}
	return str[:colon], str[colon+1:]
}

// Strings used by indentCRLF and indentLF
const (
	indentSpaces = "\r\n                                                                "
	indentTabs   = "\r\n\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t"
)

// indentCRLF returns a CRLF newline followed by n copies of the first
// non-CRLF character in the source string.
func indentCRLF(n int, source string) string {
	switch {
	case n < 0:
		return source[:2]
	case n < len(source)-1:
		return source[:n+2]
	default:
		return source + strings.Repeat(source[2:3], n-len(source)+2)
	}
}

// indentLF returns a LF newline followed by n copies of the first non-LF
// character in the source string.
func indentLF(n int, source string) string {
	switch {
	case n < 0:
		return source[1:2]
	case n < len(source)-1:
		return source[1 : n+2]
	default:
		return source[1:] + strings.Repeat(source[2:3], n-len(source)+2)
	}
}

// nextIndex returns the index of the next occurrence of sep in s,
// starting from offset.  It returns -1 if the sep string is not found.
func nextIndex(s, sep string, offset int) int {
	switch i := strings.Index(s[offset:], sep); i {
	case -1:
		return -1
	default:
		return offset + i
	}
}

// isInteger returns true if the string s contains an integer.
func isInteger(s string) bool {
	for i := 0; i < len(s); i++ {
		if (s[i] < '0' || s[i] > '9') && !(i == 0 && s[i] == '-') {
			return false
		}
	}
	return true
}

type escapeMode byte

const (
	escapeNormal escapeMode = iota
	escapeCanonicalText
	escapeCanonicalAttr
)

// escapeString writes an escaped version of a string to the writer.
func escapeString(w *bufio.Writer, s string, m escapeMode) {
	var esc []byte
	last := 0
	for i := 0; i < len(s); {
		r, width := utf8.DecodeRuneInString(s[i:])
		i += width
		switch r {
		case '&':
			esc = []byte("&amp;")
		case '<':
			esc = []byte("&lt;")
		case '>':
			if m == escapeCanonicalAttr {
				continue
			}
			esc = []byte("&gt;")
		case '\'':
			if m != escapeNormal {
				continue
			}
			esc = []byte("&apos;")
		case '"':
			if m == escapeCanonicalText {
				continue
			}
			esc = []byte("&quot;")
		case '\t':
			if m != escapeCanonicalAttr {
				continue
			}
			esc = []byte("&#x9;")
		case '\n':
			if m != escapeCanonicalAttr {
				continue
			}
			esc = []byte("&#xA;")
		case '\r':
			if m == escapeNormal {
				continue
			}
			esc = []byte("&#xD;")
		default:
			if !isInCharacterRange(r) || (r == 0xFFFD && width == 1) {
				esc = []byte("\uFFFD")
				break
			}
			continue
		}
		w.WriteString(s[last : i-width])
		w.Write(esc)
		last = i
	}
	w.WriteString(s[last:])
}

func isInCharacterRange(r rune) bool {
	return r == 0x09 ||
		r == 0x0A ||
		r == 0x0D ||
		r >= 0x20 && r <= 0xD7FF ||
		r >= 0xE000 && r <= 0xFFFD ||
		r >= 0x10000 && r <= 0x10FFFF
}
