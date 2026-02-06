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
	"errors"
	"fmt"
	"strconv"
	"unicode/utf8"
)

type tokenKind int

const (
	tokenEOF tokenKind = iota
	tokenOpenBrace
	tokenCloseBrace
	tokenComma
	tokenEquals
	tokenNotEquals
	tokenMatches
	tokenNotMatches
	tokenQuoted
	tokenUnquoted
)

func (k tokenKind) String() string {
	switch k {
	case tokenOpenBrace:
		return "OpenBrace"
	case tokenCloseBrace:
		return "CloseBrace"
	case tokenComma:
		return "Comma"
	case tokenEquals:
		return "Equals"
	case tokenNotEquals:
		return "NotEquals"
	case tokenMatches:
		return "Matches"
	case tokenNotMatches:
		return "NotMatches"
	case tokenQuoted:
		return "Quoted"
	case tokenUnquoted:
		return "Unquoted"
	default:
		return "EOF"
	}
}

type token struct {
	kind  tokenKind
	value string
	position
}

// isEOF returns true if the token is an end of file token.
func (t token) isEOF() bool {
	return t.kind == tokenEOF
}

// isOneOf returns true if the token is one of the specified kinds.
func (t token) isOneOf(kinds ...tokenKind) bool {
	for _, k := range kinds {
		if k == t.kind {
			return true
		}
	}
	return false
}

// unquote the value in token. If unquoted returns it unmodified.
func (t token) unquote() (string, error) {
	if t.kind == tokenQuoted {
		unquoted, err := strconv.Unquote(t.value)
		if err != nil {
			return "", err
		}
		if !utf8.ValidString(unquoted) {
			return "", errors.New("quoted string contains invalid UTF-8 code points")
		}
		return unquoted, nil
	}
	return t.value, nil
}

func (t token) String() string {
	return fmt.Sprintf("(%s) '%s'", t.kind, t.value)
}

type position struct {
	offsetStart int // The start position in the input.
	offsetEnd   int // The end position in the input.
	columnStart int // The column number.
	columnEnd   int // The end of the column.
}
