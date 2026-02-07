// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package hclwrite

import (
	"bytes"
	"io"

	"github.com/apparentlymart/go-textseg/v15/textseg"
	"github.com/hashicorp/hcl/v2"
	"github.com/hashicorp/hcl/v2/hclsyntax"
)

// Token is a single sequence of bytes annotated with a type. It is similar
// in purpose to hclsyntax.Token, but discards the source position information
// since that is not useful in code generation.
type Token struct {
	Type  hclsyntax.TokenType
	Bytes []byte

	// We record the number of spaces before each token so that we can
	// reproduce the exact layout of the original file when we're making
	// surgical changes in-place. When _new_ code is created it will always
	// be in the canonical style, but we preserve layout of existing code.
	SpacesBefore int
}

// asHCLSyntax returns the receiver expressed as an incomplete hclsyntax.Token.
// A complete token is not possible since we don't have source location
// information here, and so this method is unexported so we can be sure it will
// only be used for internal purposes where we know the range isn't important.
//
// This is primarily intended to allow us to re-use certain functionality from
// hclsyntax rather than re-implementing it against our own token type here.
func (t *Token) asHCLSyntax() hclsyntax.Token {
	return hclsyntax.Token{
		Type:  t.Type,
		Bytes: t.Bytes,
		Range: hcl.Range{
			Filename: "<invalid>",
		},
	}
}

// Tokens is a flat list of tokens.
type Tokens []*Token

func (ts Tokens) Bytes() []byte {
	buf := &bytes.Buffer{}
	//nolint:errcheck // FIXME: Propogate errors upward.
	ts.WriteTo(buf)
	return buf.Bytes()
}

func (ts Tokens) testValue() string {
	return string(ts.Bytes())
}

// Columns returns the number of columns (grapheme clusters) the token sequence
// occupies. The result is not meaningful if there are newline or single-line
// comment tokens in the sequence.
func (ts Tokens) Columns() int {
	ret := 0
	for _, token := range ts {
		ret += token.SpacesBefore // spaces are always worth one column each
		ct, _ := textseg.TokenCount(token.Bytes, textseg.ScanGraphemeClusters)
		ret += ct
	}
	return ret
}

// WriteTo takes an io.Writer and writes the bytes for each token to it,
// along with the spacing that separates each token. In other words, this
// allows serializing the tokens to a file or other such byte stream.
func (ts Tokens) WriteTo(wr io.Writer) (int64, error) {
	// We know we're going to be writing a lot of small chunks of repeated
	// space characters, so we'll prepare a buffer of these that we can
	// easily pass to wr.Write without any further allocation.
	spaces := make([]byte, 40)
	for i := range spaces {
		spaces[i] = ' '
	}

	var n int64
	var err error
	for _, token := range ts {
		if err != nil {
			return n, err
		}

		for spacesBefore := token.SpacesBefore; spacesBefore > 0; spacesBefore -= len(spaces) {
			thisChunk := spacesBefore
			if thisChunk > len(spaces) {
				thisChunk = len(spaces)
			}
			var thisN int
			thisN, err = wr.Write(spaces[:thisChunk])
			n += int64(thisN)
			if err != nil {
				return n, err
			}
		}

		var thisN int
		thisN, err = wr.Write(token.Bytes)
		n += int64(thisN)
	}

	return n, err
}

func (ts Tokens) walkChildNodes(w internalWalkFunc) {
	// Unstructured tokens have no child nodes
}

func (ts Tokens) BuildTokens(to Tokens) Tokens {
	return append(to, ts...)
}

// ObjectAttrTokens represents the raw tokens for the name and value of
// one attribute in an object constructor expression.
//
// This is defined primarily for use with function TokensForObject. See
// that function's documentation for more information.
type ObjectAttrTokens struct {
	Name  Tokens
	Value Tokens
}

func newIdentToken(name string) *Token {
	return &Token{
		Type:  hclsyntax.TokenIdent,
		Bytes: []byte(name),
	}
}
