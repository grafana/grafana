// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package hclsyntax

import (
	"bytes"
)

type Keyword []byte

var forKeyword = Keyword([]byte{'f', 'o', 'r'})
var inKeyword = Keyword([]byte{'i', 'n'})
var ifKeyword = Keyword([]byte{'i', 'f'})
var elseKeyword = Keyword([]byte{'e', 'l', 's', 'e'})
var endifKeyword = Keyword([]byte{'e', 'n', 'd', 'i', 'f'})
var endforKeyword = Keyword([]byte{'e', 'n', 'd', 'f', 'o', 'r'})

func (kw Keyword) TokenMatches(token Token) bool {
	if token.Type != TokenIdent {
		return false
	}
	return bytes.Equal([]byte(kw), token.Bytes)
}
