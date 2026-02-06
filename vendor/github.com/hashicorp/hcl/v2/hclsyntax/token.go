// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package hclsyntax

import (
	"bytes"
	"fmt"

	"github.com/apparentlymart/go-textseg/v15/textseg"
	"github.com/hashicorp/hcl/v2"
)

// Token represents a sequence of bytes from some HCL code that has been
// tagged with a type and its range within the source file.
type Token struct {
	Type  TokenType
	Bytes []byte
	Range hcl.Range
}

// Tokens is a slice of Token.
type Tokens []Token

// TokenType is an enumeration used for the Type field on Token.
type TokenType rune

const (
	// Single-character tokens are represented by their own character, for
	// convenience in producing these within the scanner. However, the values
	// are otherwise arbitrary and just intended to be mnemonic for humans
	// who might see them in debug output.

	TokenOBrace   TokenType = '{'
	TokenCBrace   TokenType = '}'
	TokenOBrack   TokenType = '['
	TokenCBrack   TokenType = ']'
	TokenOParen   TokenType = '('
	TokenCParen   TokenType = ')'
	TokenOQuote   TokenType = '«'
	TokenCQuote   TokenType = '»'
	TokenOHeredoc TokenType = 'H'
	TokenCHeredoc TokenType = 'h'

	TokenStar    TokenType = '*'
	TokenSlash   TokenType = '/'
	TokenPlus    TokenType = '+'
	TokenMinus   TokenType = '-'
	TokenPercent TokenType = '%'

	TokenEqual         TokenType = '='
	TokenEqualOp       TokenType = '≔'
	TokenNotEqual      TokenType = '≠'
	TokenLessThan      TokenType = '<'
	TokenLessThanEq    TokenType = '≤'
	TokenGreaterThan   TokenType = '>'
	TokenGreaterThanEq TokenType = '≥'

	TokenAnd  TokenType = '∧'
	TokenOr   TokenType = '∨'
	TokenBang TokenType = '!'

	TokenDot   TokenType = '.'
	TokenComma TokenType = ','

	TokenDoubleColon TokenType = '⸬'
	TokenEllipsis    TokenType = '…'
	TokenFatArrow    TokenType = '⇒'

	TokenQuestion TokenType = '?'
	TokenColon    TokenType = ':'

	TokenTemplateInterp  TokenType = '∫'
	TokenTemplateControl TokenType = 'λ'
	TokenTemplateSeqEnd  TokenType = '∎'

	TokenQuotedLit TokenType = 'Q' // might contain backslash escapes
	TokenStringLit TokenType = 'S' // cannot contain backslash escapes
	TokenNumberLit TokenType = 'N'
	TokenIdent     TokenType = 'I'

	TokenComment TokenType = 'C'

	TokenNewline TokenType = '\n'
	TokenEOF     TokenType = '␄'

	// The rest are not used in the language but recognized by the scanner so
	// we can generate good diagnostics in the parser when users try to write
	// things that might work in other languages they are familiar with, or
	// simply make incorrect assumptions about the HCL language.

	TokenBitwiseAnd    TokenType = '&'
	TokenBitwiseOr     TokenType = '|'
	TokenBitwiseNot    TokenType = '~'
	TokenBitwiseXor    TokenType = '^'
	TokenStarStar      TokenType = '➚'
	TokenApostrophe    TokenType = '\''
	TokenBacktick      TokenType = '`'
	TokenSemicolon     TokenType = ';'
	TokenTabs          TokenType = '␉'
	TokenInvalid       TokenType = '�'
	TokenBadUTF8       TokenType = '💩'
	TokenQuotedNewline TokenType = '␤'

	// TokenNil is a placeholder for when a token is required but none is
	// available, e.g. when reporting errors. The scanner will never produce
	// this as part of a token stream.
	TokenNil TokenType = '\x00'
)

func (t TokenType) GoString() string {
	return fmt.Sprintf("hclsyntax.%s", t.String())
}

type scanMode int

const (
	scanNormal scanMode = iota
	scanTemplate
	scanIdentOnly
)

type tokenAccum struct {
	Filename  string
	Bytes     []byte
	Pos       hcl.Pos
	Tokens    []Token
	StartByte int
}

func (f *tokenAccum) emitToken(ty TokenType, startOfs, endOfs int) {
	// Walk through our buffer to figure out how much we need to adjust
	// the start pos to get our end pos.

	start := f.Pos
	start.Column += startOfs + f.StartByte - f.Pos.Byte // Safe because only ASCII spaces can be in the offset
	start.Byte = startOfs + f.StartByte

	end := start
	end.Byte = endOfs + f.StartByte
	b := f.Bytes[startOfs:endOfs]
	for len(b) > 0 {
		advance, seq, _ := textseg.ScanGraphemeClusters(b, true)
		if (len(seq) == 1 && seq[0] == '\n') || (len(seq) == 2 && seq[0] == '\r' && seq[1] == '\n') {
			end.Line++
			end.Column = 1
		} else {
			end.Column++
		}
		b = b[advance:]
	}

	f.Pos = end

	f.Tokens = append(f.Tokens, Token{
		Type:  ty,
		Bytes: f.Bytes[startOfs:endOfs],
		Range: hcl.Range{
			Filename: f.Filename,
			Start:    start,
			End:      end,
		},
	})
}

type heredocInProgress struct {
	Marker      []byte
	StartOfLine bool
}

func tokenOpensFlushHeredoc(tok Token) bool {
	if tok.Type != TokenOHeredoc {
		return false
	}
	return bytes.HasPrefix(tok.Bytes, []byte{'<', '<', '-'})
}

// checkInvalidTokens does a simple pass across the given tokens and generates
// diagnostics for tokens that should _never_ appear in HCL source. This
// is intended to avoid the need for the parser to have special support
// for them all over.
//
// Returns a diagnostics with no errors if everything seems acceptable.
// Otherwise, returns zero or more error diagnostics, though tries to limit
// repetition of the same information.
func checkInvalidTokens(tokens Tokens) hcl.Diagnostics {
	var diags hcl.Diagnostics

	toldBitwise := 0
	toldExponent := 0
	toldBacktick := 0
	toldApostrophe := 0
	toldSemicolon := 0
	toldTabs := 0
	toldBadUTF8 := 0

	for _, tok := range tokens {
		tokRange := func() *hcl.Range {
			r := tok.Range
			return &r
		}

		switch tok.Type {
		case TokenBitwiseAnd, TokenBitwiseOr, TokenBitwiseXor, TokenBitwiseNot:
			if toldBitwise < 4 {
				var suggestion string
				switch tok.Type {
				case TokenBitwiseAnd:
					suggestion = " Did you mean boolean AND (\"&&\")?"
				case TokenBitwiseOr:
					suggestion = " Did you mean boolean OR (\"||\")?"
				case TokenBitwiseNot:
					suggestion = " Did you mean boolean NOT (\"!\")?"
				}

				diags = append(diags, &hcl.Diagnostic{
					Severity: hcl.DiagError,
					Summary:  "Unsupported operator",
					Detail:   fmt.Sprintf("Bitwise operators are not supported.%s", suggestion),
					Subject:  tokRange(),
				})
				toldBitwise++
			}
		case TokenStarStar:
			if toldExponent < 1 {
				diags = append(diags, &hcl.Diagnostic{
					Severity: hcl.DiagError,
					Summary:  "Unsupported operator",
					Detail:   "\"**\" is not a supported operator. Exponentiation is not supported as an operator.",
					Subject:  tokRange(),
				})

				toldExponent++
			}
		case TokenBacktick:
			// Only report for alternating (even) backticks, so we won't report both start and ends of the same
			// backtick-quoted string.
			if (toldBacktick % 2) == 0 {
				diags = append(diags, &hcl.Diagnostic{
					Severity: hcl.DiagError,
					Summary:  "Invalid character",
					Detail:   "The \"`\" character is not valid. To create a multi-line string, use the \"heredoc\" syntax, like \"<<EOT\".",
					Subject:  tokRange(),
				})
			}
			if toldBacktick <= 2 {
				toldBacktick++
			}
		case TokenApostrophe:
			if (toldApostrophe % 2) == 0 {
				newDiag := &hcl.Diagnostic{
					Severity: hcl.DiagError,
					Summary:  "Invalid character",
					Detail:   "Single quotes are not valid. Use double quotes (\") to enclose strings.",
					Subject:  tokRange(),
				}
				diags = append(diags, newDiag)
			}
			if toldApostrophe <= 2 {
				toldApostrophe++
			}
		case TokenSemicolon:
			if toldSemicolon < 1 {
				diags = append(diags, &hcl.Diagnostic{
					Severity: hcl.DiagError,
					Summary:  "Invalid character",
					Detail:   "The \";\" character is not valid. Use newlines to separate arguments and blocks, and commas to separate items in collection values.",
					Subject:  tokRange(),
				})

				toldSemicolon++
			}
		case TokenTabs:
			if toldTabs < 1 {
				diags = append(diags, &hcl.Diagnostic{
					Severity: hcl.DiagError,
					Summary:  "Invalid character",
					Detail:   "Tab characters may not be used. The recommended indentation style is two spaces per indent.",
					Subject:  tokRange(),
				})

				toldTabs++
			}
		case TokenBadUTF8:
			if toldBadUTF8 < 1 {
				diags = append(diags, &hcl.Diagnostic{
					Severity: hcl.DiagError,
					Summary:  "Invalid character encoding",
					Detail:   "All input files must be UTF-8 encoded. Ensure that UTF-8 encoding is selected in your editor.",
					Subject:  tokRange(),
				})

				toldBadUTF8++
			}
		case TokenQuotedNewline:
			diags = append(diags, &hcl.Diagnostic{
				Severity: hcl.DiagError,
				Summary:  "Invalid multi-line string",
				Detail:   "Quoted strings may not be split over multiple lines. To produce a multi-line string, either use the \\n escape to represent a newline character or use the \"heredoc\" multi-line template syntax.",
				Subject:  tokRange(),
			})
		case TokenInvalid:
			chars := string(tok.Bytes)
			switch chars {
			case "“", "”":
				diags = append(diags, &hcl.Diagnostic{
					Severity: hcl.DiagError,
					Summary:  "Invalid character",
					Detail:   "\"Curly quotes\" are not valid here. These can sometimes be inadvertently introduced when sharing code via documents or discussion forums. It might help to replace the character with a \"straight quote\".",
					Subject:  tokRange(),
				})
			default:
				diags = append(diags, &hcl.Diagnostic{
					Severity: hcl.DiagError,
					Summary:  "Invalid character",
					Detail:   "This character is not used within the language.",
					Subject:  tokRange(),
				})
			}
		}
	}
	return diags
}

var utf8BOM = []byte{0xef, 0xbb, 0xbf}

// stripUTF8BOM checks whether the given buffer begins with a UTF-8 byte order
// mark (0xEF 0xBB 0xBF) and, if so, returns a truncated slice with the same
// backing array but with the BOM skipped.
//
// If there is no BOM present, the given slice is returned verbatim.
func stripUTF8BOM(src []byte) []byte {
	if bytes.HasPrefix(src, utf8BOM) {
		return src[3:]
	}
	return src
}
