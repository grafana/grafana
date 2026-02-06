// Copyright 2023 The Prometheus Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package parse

import (
	"fmt"
	"strings"
	"unicode"
	"unicode/utf8"
)

const (
	eof rune = -1
)

func isReserved(r rune) bool {
	return unicode.IsSpace(r) || strings.ContainsRune("{}!=~,\\\"'`", r)
}

// expectedError is returned when the next rune does not match what is expected.
type expectedError struct {
	position
	input    string
	expected string
}

func (e expectedError) Error() string {
	if e.offsetEnd >= len(e.input) {
		return fmt.Sprintf("%d:%d: unexpected end of input, expected one of '%s'",
			e.columnStart,
			e.columnEnd,
			e.expected,
		)
	}
	return fmt.Sprintf("%d:%d: %s: expected one of '%s'",
		e.columnStart,
		e.columnEnd,
		e.input[e.offsetStart:e.offsetEnd],
		e.expected,
	)
}

// invalidInputError is returned when the next rune in the input does not match
// the grammar of Prometheus-like matchers.
type invalidInputError struct {
	position
	input string
}

func (e invalidInputError) Error() string {
	return fmt.Sprintf("%d:%d: %s: invalid input",
		e.columnStart,
		e.columnEnd,
		e.input[e.offsetStart:e.offsetEnd],
	)
}

// unterminatedError is returned when text in quotes does not have a closing quote.
type unterminatedError struct {
	position
	input string
	quote rune
}

func (e unterminatedError) Error() string {
	return fmt.Sprintf("%d:%d: %s: missing end %c",
		e.columnStart,
		e.columnEnd,
		e.input[e.offsetStart:e.offsetEnd],
		e.quote,
	)
}

// lexer scans a sequence of tokens that match the grammar of Prometheus-like
// matchers. A token is emitted for each call to scan() which returns the
// next token in the input or an error if the input does not conform to the
// grammar. A token can be one of a number of kinds and corresponds to a
// subslice of the input. Once the input has been consumed successive calls to
// scan() return a tokenEOF token.
type lexer struct {
	input  string
	err    error
	start  int // The offset of the current token.
	pos    int // The position of the cursor in the input.
	width  int // The width of the last rune.
	column int // The column offset of the current token.
	cols   int // The number of columns (runes) decoded from the input.
}

// Scans the next token in the input or an error if the input does not
// conform to the grammar. Once the input has been consumed successive
// calls scan() return a tokenEOF token.
func (l *lexer) scan() (token, error) {
	t := token{}
	// Do not attempt to emit more tokens if the input is invalid.
	if l.err != nil {
		return t, l.err
	}
	// Iterate over each rune in the input and either emit a token or an error.
	for r := l.next(); r != eof; r = l.next() {
		switch {
		case r == '{':
			t = l.emit(tokenOpenBrace)
			return t, l.err
		case r == '}':
			t = l.emit(tokenCloseBrace)
			return t, l.err
		case r == ',':
			t = l.emit(tokenComma)
			return t, l.err
		case r == '=' || r == '!':
			l.rewind()
			t, l.err = l.scanOperator()
			return t, l.err
		case r == '"':
			l.rewind()
			t, l.err = l.scanQuoted()
			return t, l.err
		case !isReserved(r):
			l.rewind()
			t, l.err = l.scanUnquoted()
			return t, l.err
		case unicode.IsSpace(r):
			l.skip()
		default:
			l.err = invalidInputError{
				position: l.position(),
				input:    l.input,
			}
			return t, l.err
		}
	}
	return t, l.err
}

func (l *lexer) scanOperator() (token, error) {
	// If the first rune is an '!' then it must be followed with either an
	// '=' or '~' to not match a string or regex.
	if l.accept("!") {
		if l.accept("=") {
			return l.emit(tokenNotEquals), nil
		}
		if l.accept("~") {
			return l.emit(tokenNotMatches), nil
		}
		return token{}, expectedError{
			position: l.position(),
			input:    l.input,
			expected: "=~",
		}
	}
	// If the first rune is an '=' then it can be followed with an optional
	// '~' to match a regex.
	if l.accept("=") {
		if l.accept("~") {
			return l.emit(tokenMatches), nil
		}
		return l.emit(tokenEquals), nil
	}
	return token{}, expectedError{
		position: l.position(),
		input:    l.input,
		expected: "!=",
	}
}

func (l *lexer) scanQuoted() (token, error) {
	if err := l.expect("\""); err != nil {
		return token{}, err
	}
	var isEscaped bool
	for r := l.next(); r != eof; r = l.next() {
		if isEscaped {
			isEscaped = false
		} else if r == '\\' {
			isEscaped = true
		} else if r == '"' {
			l.rewind()
			break
		}
	}
	if err := l.expect("\""); err != nil {
		return token{}, unterminatedError{
			position: l.position(),
			input:    l.input,
			quote:    '"',
		}
	}
	return l.emit(tokenQuoted), nil
}

func (l *lexer) scanUnquoted() (token, error) {
	for r := l.next(); r != eof; r = l.next() {
		if isReserved(r) {
			l.rewind()
			break
		}
	}
	return l.emit(tokenUnquoted), nil
}

// peek the next token in the input or an error if the input does not
// conform to the grammar. Once the input has been consumed successive
// calls peek() return a tokenEOF token.
func (l *lexer) peek() (token, error) {
	start := l.start
	pos := l.pos
	width := l.width
	column := l.column
	cols := l.cols
	// Do not reset l.err because we can return it on the next call to scan().
	defer func() {
		l.start = start
		l.pos = pos
		l.width = width
		l.column = column
		l.cols = cols
	}()
	return l.scan()
}

// position returns the position of the last emitted token.
func (l *lexer) position() position {
	return position{
		offsetStart: l.start,
		offsetEnd:   l.pos,
		columnStart: l.column,
		columnEnd:   l.cols,
	}
}

// accept consumes the next if its one of the valid runes.
// It returns true if the next rune was accepted, otherwise false.
func (l *lexer) accept(valid string) bool {
	if strings.ContainsRune(valid, l.next()) {
		return true
	}
	l.rewind()
	return false
}

// expect consumes the next rune if its one of the valid runes.
// It returns nil if the next rune is valid, otherwise an expectedError
// error.
func (l *lexer) expect(valid string) error {
	if strings.ContainsRune(valid, l.next()) {
		return nil
	}
	l.rewind()
	return expectedError{
		position: l.position(),
		input:    l.input,
		expected: valid,
	}
}

// emits returns the scanned input as a token.
func (l *lexer) emit(kind tokenKind) token {
	t := token{
		kind:     kind,
		value:    l.input[l.start:l.pos],
		position: l.position(),
	}
	l.start = l.pos
	l.column = l.cols
	return t
}

// next returns the next rune in the input or eof.
func (l *lexer) next() rune {
	if l.pos >= len(l.input) {
		l.width = 0
		return eof
	}
	r, width := utf8.DecodeRuneInString(l.input[l.pos:])
	l.width = width
	l.pos += width
	l.cols++
	return r
}

// rewind the last rune in the input. It should not be called more than once
// between consecutive calls of next.
func (l *lexer) rewind() {
	l.pos -= l.width
	// When the next rune in the input is eof the width is zero. This check
	// prevents cols from being decremented when the next rune being accepted
	// is instead eof.
	if l.width > 0 {
		l.cols--
	}
}

// skip the scanned input between start and pos.
func (l *lexer) skip() {
	l.start = l.pos
	l.column = l.cols
}
