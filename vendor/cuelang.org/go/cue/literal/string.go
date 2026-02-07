// Copyright 2019 CUE Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package literal

import (
	"errors"
	"strings"
	"unicode"
	"unicode/utf8"
)

var (
	errSyntax            = errors.New("invalid syntax")
	errInvalidWhitespace = errors.New("invalid string: invalid whitespace")
	errMissingNewline    = errors.New(
		"invalid string: opening quote of multiline string must be followed by newline")
	errUnmatchedQuote = errors.New("invalid string: unmatched quote")
	// TODO: making this an error is optional according to RFC 4627. But we
	// could make it not an error if this ever results in an issue.
	errSurrogate          = errors.New("unmatched surrogate pair")
	errEscapedLastNewline = errors.New("last newline of multiline string cannot be escaped")
)

// Unquote interprets s as a single- or double-quoted, single- or multi-line
// string, possibly with custom escape delimiters, returning the string value
// that s quotes.
func Unquote(s string) (string, error) {
	info, nStart, _, err := ParseQuotes(s, s)
	if err != nil {
		return "", err
	}
	s = s[nStart:]
	return info.Unquote(s)
}

// QuoteInfo describes the type of quotes used for a string.
type QuoteInfo struct {
	quote      string
	whitespace string
	numHash    int
	multiline  bool
	char       byte
	numChar    byte
}

// IsDouble reports whether the literal uses double quotes.
func (q QuoteInfo) IsDouble() bool {
	return q.char == '"'
}

// IsMulti reports whether a multi-line string was parsed.
func (q QuoteInfo) IsMulti() bool {
	return q.multiline
}

// Whitespace returns prefix whitespace for multiline strings.
func (q QuoteInfo) Whitespace() string {
	return q.whitespace
}

// ParseQuotes checks if the opening quotes in start matches the ending quotes
// in end and reports its type as q or an error if they do not matching or are
// invalid. nStart indicates the number of bytes used for the opening quote.
func ParseQuotes(start, end string) (q QuoteInfo, nStart, nEnd int, err error) {
	for i, c := range start {
		if c != '#' {
			break
		}
		q.numHash = i + 1
	}
	s := start[q.numHash:]
	switch s[0] {
	case '"', '\'':
		q.char = s[0]
		if len(s) > 3 && s[1] == s[0] && s[2] == s[0] {
			switch s[3] {
			case '\n':
				q.quote = start[:3+q.numHash]
			case '\r':
				if len(s) > 4 && s[4] == '\n' {
					q.quote = start[:4+q.numHash]
					break
				}
				fallthrough
			default:
				return q, 0, 0, errMissingNewline
			}
			q.multiline = true
			q.numChar = 3
			nStart = len(q.quote) + 1 // add whitespace later
		} else {
			q.quote = start[:1+q.numHash]
			q.numChar = 1
			nStart = len(q.quote)
		}
	default:
		return q, 0, 0, errSyntax
	}
	quote := start[:int(q.numChar)+q.numHash]
	for i := 0; i < len(quote); i++ {
		if j := len(end) - i - 1; j < 0 || quote[i] != end[j] {
			return q, 0, 0, errUnmatchedQuote
		}
	}
	if q.multiline {
		i := len(end) - len(quote)
		for i > 0 {
			r, size := utf8.DecodeLastRuneInString(end[:i])
			if r == '\n' || !unicode.IsSpace(r) {
				break
			}
			i -= size
		}
		q.whitespace = end[i : len(end)-len(quote)]

		if len(start) > nStart && start[nStart] != '\n' {
			if !strings.HasPrefix(start[nStart:], q.whitespace) {
				return q, 0, 0, errInvalidWhitespace
			}
			nStart += len(q.whitespace)
		}
	}

	return q, nStart, int(q.numChar) + q.numHash, nil
}

// Unquote unquotes the given string, which should not contain
// the initial quote character(s). It must be terminated with a quote or an
// interpolation start. Escape sequences are expanded and surrogates
// are replaced with the corresponding non-surrogate code points.
func (q QuoteInfo) Unquote(s string) (string, error) {
	if len(s) > 0 && !q.multiline {
		if contains(s, '\n') || contains(s, '\r') {
			return "", errSyntax
		}

		// Is it trivial? Avoid allocation.
		if s[len(s)-1] == q.char && q.numHash == 0 {
			if s := s[:len(s)-1]; isSimple(s, rune(q.char)) {
				return s, nil
			}
		}
	}

	var runeTmp [utf8.UTFMax]byte
	buf := make([]byte, 0, 3*len(s)/2) // Try to avoid more allocations.
	stripNL := false
	wasEscapedNewline := false
	for len(s) > 0 {
		switch s[0] {
		case '\r':
			s = s[1:]
			wasEscapedNewline = false
			continue
		case '\n':
			var err error
			s, err = skipWhitespaceAfterNewline(s[1:], q)
			if err != nil {
				return "", err
			}
			stripNL = true
			wasEscapedNewline = false
			buf = append(buf, '\n')
			continue
		}
		c, multibyte, ss, err := unquoteChar(s, q)
		if surHigh <= c && c < surEnd {
			if c >= surLow {
				return "", errSurrogate
			}
			var cl rune
			cl, _, ss, err = unquoteChar(ss, q)
			if cl < surLow || surEnd <= cl {
				return "", errSurrogate
			}
			c = 0x10000 + (c-surHigh)*0x400 + (cl - surLow)
		}

		if err != nil {
			return "", err
		}

		s = ss
		if c < 0 {
			switch c {
			case escapedNewline:
				var err error
				s, err = skipWhitespaceAfterNewline(s, q)
				if err != nil {
					return "", err
				}
				wasEscapedNewline = true
				continue
			case terminatedByQuote:
				if wasEscapedNewline {
					return "", errEscapedLastNewline
				}
				if stripNL {
					// Strip the last newline, but only if it came from a closing
					// quote.
					buf = buf[:len(buf)-1]
				}
			case terminatedByExpr:
			default:
				panic("unreachable")
			}
			return string(buf), nil
		}
		stripNL = false
		wasEscapedNewline = false
		if c < utf8.RuneSelf || !multibyte {
			buf = append(buf, byte(c))
		} else {
			n := utf8.EncodeRune(runeTmp[:], c)
			buf = append(buf, runeTmp[:n]...)
		}
	}
	// allow unmatched quotes if already checked.
	return "", errUnmatchedQuote
}

func skipWhitespaceAfterNewline(s string, q QuoteInfo) (string, error) {
	switch {
	case !q.multiline:
		// Can't happen because Unquote does an initial check for literal newlines
		// in the non-multiline case, but be defensive.
		fallthrough
	default:
		return "", errInvalidWhitespace
	case strings.HasPrefix(s, q.whitespace):
		s = s[len(q.whitespace):]
	case strings.HasPrefix(s, "\n"):
	case strings.HasPrefix(s, "\r\n"):
	}
	return s, nil
}

const (
	surHigh = 0xD800
	surLow  = 0xDC00
	surEnd  = 0xE000
)

func isSimple(s string, quote rune) bool {
	// TODO(perf): check if using a simple DFA to detect surrogate pairs is
	// faster than converting to code points. At the very least there should
	// be an ASCII fast path.
	for _, r := range s {
		if r == quote || r == '\\' {
			return false
		}
		if surHigh <= r && r < surEnd {
			return false
		}
	}
	return true
}

// contains reports whether the string contains the byte c.
func contains(s string, c byte) bool {
	for i := 0; i < len(s); i++ {
		if s[i] == c {
			return true
		}
	}
	return false
}

const (
	terminatedByQuote = rune(-1)
	terminatedByExpr  = rune(-2)
	escapedNewline    = rune(-3)
)

// unquoteChar decodes the first character or byte in the escaped string.
// It returns four values:
//
//  1. value, the decoded Unicode code point or byte value if non-negative, or
//     one of the following special values:
//     - terminatedByQuote indicates terminated by quotes
//     - terminatedByExpr means terminated by \(
//     - escapedNewline means that the line-termination character was quoted and should be omitted
//  2. multibyte, a boolean indicating whether the decoded character requires a multibyte UTF-8 representation;
//  3. tail, the remainder of the string after the character; and
//  4. an error that will be nil if the character is syntactically valid.
//
// The second argument, kind, specifies the type of literal being parsed
// and therefore which kind of escape sequences are permitted.
// For kind 's' only JSON escapes and \u{ are permitted.
// For kind 'b' also hexadecimal and octal escape sequences are permitted.
//
// The third argument, quote, specifies that an ASCII quoting character that
// is not permitted in the output.
func unquoteChar(s string, info QuoteInfo) (value rune, multibyte bool, tail string, err error) {
	// easy cases
	switch c := s[0]; {
	case c == info.char && info.char != 0:
		for i := 1; byte(i) < info.numChar; i++ {
			if i >= len(s) || s[i] != info.char {
				return rune(info.char), false, s[1:], nil
			}
		}
		for i := 0; i < info.numHash; i++ {
			if i+int(info.numChar) >= len(s) || s[i+int(info.numChar)] != '#' {
				return rune(info.char), false, s[1:], nil
			}
		}
		if ln := int(info.numChar) + info.numHash; len(s) != ln {
			// TODO: terminating quote in middle of string
			return 0, false, s[ln:], errSyntax
		}
		return terminatedByQuote, false, "", nil
	case c >= utf8.RuneSelf:
		// TODO: consider handling surrogate values. These are discarded by
		// DecodeRuneInString. It is technically correct to disallow it, but
		// some JSON parsers allow this anyway.
		r, size := utf8.DecodeRuneInString(s)
		return r, true, s[size:], nil
	case c != '\\':
		return rune(s[0]), false, s[1:], nil
	}

	if len(s) <= 1+info.numHash {
		return '\\', false, s[1:], nil
	}
	for i := 1; i <= info.numHash && i < len(s); i++ {
		if s[i] != '#' {
			return '\\', false, s[1:], nil
		}
	}

	c := s[1+info.numHash]
	s = s[2+info.numHash:]

	switch c {
	case 'a':
		value = '\a'
	case 'b':
		value = '\b'
	case 'f':
		value = '\f'
	case 'n':
		value = '\n'
	case 'r':
		value = '\r'
	case 't':
		value = '\t'
	case 'v':
		value = '\v'
	case '/':
		value = '/'
	case 'x', 'u', 'U':
		n := 0
		switch c {
		case 'x':
			n = 2
		case 'u':
			n = 4
		case 'U':
			n = 8
		}
		var v rune
		if len(s) < n {
			err = errSyntax
			return
		}
		for j := 0; j < n; j++ {
			x, ok := unhex(s[j])
			if !ok {
				err = errSyntax
				return
			}
			v = v<<4 | x
		}
		s = s[n:]
		if c == 'x' {
			if info.char == '"' {
				err = errSyntax
				return
			}
			// single-byte string, possibly not UTF-8
			value = v
			break
		}
		if v > utf8.MaxRune {
			err = errSyntax
			return
		}
		value = v
		multibyte = true
	case '0', '1', '2', '3', '4', '5', '6', '7':
		if info.char == '"' {
			err = errSyntax
			return
		}
		v := rune(c) - '0'
		if len(s) < 2 {
			err = errSyntax
			return
		}
		for j := 0; j < 2; j++ { // one digit already; two more
			x := rune(s[j]) - '0'
			if x < 0 || x > 7 {
				err = errSyntax
				return
			}
			v = (v << 3) | x
		}
		s = s[2:]
		if v > 255 {
			err = errSyntax
			return
		}
		value = v
	case '\\':
		value = '\\'
	case '\'', '"':
		// TODO: should we allow escaping of quotes regardless?
		if c != info.char {
			err = errSyntax
			return
		}
		value = rune(c)
	case '(':
		if s != "" {
			// TODO: terminating quote in middle of string
			return 0, false, s, errSyntax
		}
		value = terminatedByExpr
	case '\r':
		if len(s) == 0 || s[0] != '\n' {
			err = errSyntax
			return
		}
		s = s[1:]
		value = escapedNewline
	case '\n':
		value = escapedNewline
	default:
		err = errSyntax
		return
	}
	tail = s
	return
}

func unhex(b byte) (v rune, ok bool) {
	c := rune(b)
	switch {
	case '0' <= c && c <= '9':
		return c - '0', true
	case 'a' <= c && c <= 'f':
		return c - 'a' + 10, true
	case 'A' <= c && c <= 'F':
		return c - 'A' + 10, true
	}
	return
}
