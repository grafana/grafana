// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package hclwrite

import (
	"github.com/hashicorp/hcl/v2/hclsyntax"
)

// format rewrites tokens within the given sequence, in-place, to adjust the
// whitespace around their content to achieve canonical formatting.
func format(tokens Tokens) {
	// Formatting is a multi-pass process. More details on the passes below,
	// but this is the overview:
	// - adjust the leading space on each line to create appropriate
	//   indentation
	// - adjust spaces between tokens in a single cell using a set of rules
	// - adjust the leading space in the "assign" and "comment" cells on each
	//   line to vertically align with neighboring lines.
	// All of these steps operate in-place on the given tokens, so a caller
	// may collect a flat sequence of all of the tokens underlying an AST
	// and pass it here and we will then indirectly modify the AST itself.
	// Formatting must change only whitespace. Specifically, that means
	// changing the SpacesBefore attribute on a token while leaving the
	// other token attributes unchanged.

	lines := linesForFormat(tokens)
	formatIndent(lines)
	formatSpaces(lines)
	formatCells(lines)
}

func formatIndent(lines []formatLine) {
	// Our methodology for indents is to take the input one line at a time
	// and count the bracketing delimiters on each line. If a line has a net
	// increase in open brackets, we increase the indent level by one and
	// remember how many new openers we had. If the line has a net _decrease_,
	// we'll compare it to the most recent number of openers and decrease the
	// dedent level by one each time we pass an indent level remembered
	// earlier.
	// The "indent stack" used here allows for us to recognize degenerate
	// input where brackets are not symmetrical within lines and avoid
	// pushing things too far left or right, creating confusion.

	// We'll start our indent stack at a reasonable capacity to minimize the
	// chance of us needing to grow it; 10 here means 10 levels of indent,
	// which should be more than enough for reasonable HCL uses.
	indents := make([]int, 0, 10)

	for i := range lines {
		line := &lines[i]
		if len(line.lead) == 0 {
			continue
		}

		if line.lead[0].Type == hclsyntax.TokenNewline {
			// Never place spaces before a newline
			line.lead[0].SpacesBefore = 0
			continue
		}

		netBrackets := 0
		for _, token := range line.lead {
			netBrackets += tokenBracketChange(token)
			if token.Type == hclsyntax.TokenOHeredoc {
				break
			}
		}

		for _, token := range line.assign {
			netBrackets += tokenBracketChange(token)
		}

		switch {
		case netBrackets > 0:
			line.lead[0].SpacesBefore = 2 * len(indents)
			indents = append(indents, netBrackets)
		case netBrackets < 0:
			closed := -netBrackets
			for closed > 0 && len(indents) > 0 {
				switch {

				case closed > indents[len(indents)-1]:
					closed -= indents[len(indents)-1]
					indents = indents[:len(indents)-1]

				case closed < indents[len(indents)-1]:
					indents[len(indents)-1] -= closed
					closed = 0

				default:
					indents = indents[:len(indents)-1]
					closed = 0
				}
			}
			line.lead[0].SpacesBefore = 2 * len(indents)
		default:
			line.lead[0].SpacesBefore = 2 * len(indents)
		}
	}
}

func formatSpaces(lines []formatLine) {
	// placeholder token used when we don't have a token but we don't want
	// to pass a real "nil" and complicate things with nil pointer checks
	nilToken := &Token{
		Type:         hclsyntax.TokenNil,
		Bytes:        []byte{},
		SpacesBefore: 0,
	}

	for _, line := range lines {
		for i, token := range line.lead {
			var before, after *Token
			if i > 0 {
				before = line.lead[i-1]
			} else {
				before = nilToken
			}
			if i < (len(line.lead) - 1) {
				after = line.lead[i+1]
			} else {
				continue
			}
			if spaceAfterToken(token, before, after) {
				after.SpacesBefore = 1
			} else {
				after.SpacesBefore = 0
			}
		}
		for i, token := range line.assign {
			if i == 0 {
				// first token in "assign" always has one space before to
				// separate the equals sign from what it's assigning.
				token.SpacesBefore = 1
			}

			var before, after *Token
			if i > 0 {
				before = line.assign[i-1]
			} else {
				before = nilToken
			}
			if i < (len(line.assign) - 1) {
				after = line.assign[i+1]
			} else {
				continue
			}
			if spaceAfterToken(token, before, after) {
				after.SpacesBefore = 1
			} else {
				after.SpacesBefore = 0
			}
		}

	}
}

func formatCells(lines []formatLine) {
	chainStart := -1
	maxColumns := 0

	// We'll deal with the "assign" cell first, since moving that will
	// also impact the "comment" cell.
	closeAssignChain := func(i int) {
		for _, chainLine := range lines[chainStart:i] {
			columns := chainLine.lead.Columns()
			spaces := (maxColumns - columns) + 1
			chainLine.assign[0].SpacesBefore = spaces
		}
		chainStart = -1
		maxColumns = 0
	}
	for i, line := range lines {
		if line.assign == nil {
			if chainStart != -1 {
				closeAssignChain(i)
			}
		} else {
			if chainStart == -1 {
				chainStart = i
			}
			columns := line.lead.Columns()
			if columns > maxColumns {
				maxColumns = columns
			}
		}
	}
	if chainStart != -1 {
		closeAssignChain(len(lines))
	}

	// Now we'll deal with the comments
	closeCommentChain := func(i int) {
		for _, chainLine := range lines[chainStart:i] {
			columns := chainLine.lead.Columns() + chainLine.assign.Columns()
			spaces := (maxColumns - columns) + 1
			chainLine.comment[0].SpacesBefore = spaces
		}
		chainStart = -1
		maxColumns = 0
	}
	for i, line := range lines {
		if line.comment == nil {
			if chainStart != -1 {
				closeCommentChain(i)
			}
		} else {
			if chainStart == -1 {
				chainStart = i
			}
			columns := line.lead.Columns() + line.assign.Columns()
			if columns > maxColumns {
				maxColumns = columns
			}
		}
	}
	if chainStart != -1 {
		closeCommentChain(len(lines))
	}
}

// spaceAfterToken decides whether a particular subject token should have a
// space after it when surrounded by the given before and after tokens.
// "before" can be TokenNil, if the subject token is at the start of a sequence.
func spaceAfterToken(subject, before, after *Token) bool {
	switch {

	case after.Type == hclsyntax.TokenNewline || after.Type == hclsyntax.TokenNil:
		// Never add spaces before a newline
		return false

	case subject.Type == hclsyntax.TokenIdent && after.Type == hclsyntax.TokenOParen:
		// Don't split a function name from open paren in a call
		return false

	case (subject.Type == hclsyntax.TokenIdent && after.Type == hclsyntax.TokenDoubleColon) ||
		(subject.Type == hclsyntax.TokenDoubleColon && after.Type == hclsyntax.TokenIdent):
		// Don't split namespace segments in a function call
		return false

	case subject.Type == hclsyntax.TokenDot || after.Type == hclsyntax.TokenDot:
		// Don't use spaces around attribute access dots
		return false

	case after.Type == hclsyntax.TokenComma || after.Type == hclsyntax.TokenEllipsis:
		// No space right before a comma or ... in an argument list
		return false

	case subject.Type == hclsyntax.TokenComma:
		// Always a space after a comma
		return true

	case subject.Type == hclsyntax.TokenQuotedLit || subject.Type == hclsyntax.TokenStringLit || subject.Type == hclsyntax.TokenOQuote || subject.Type == hclsyntax.TokenOHeredoc || after.Type == hclsyntax.TokenQuotedLit || after.Type == hclsyntax.TokenStringLit || after.Type == hclsyntax.TokenCQuote || after.Type == hclsyntax.TokenCHeredoc:
		// No extra spaces within templates
		return false

	case hclsyntax.Keyword([]byte{'i', 'n'}).TokenMatches(subject.asHCLSyntax()) && before.Type == hclsyntax.TokenIdent:
		// This is a special case for inside for expressions where a user
		// might want to use a literal tuple constructor:
		// [for x in [foo]: x]
		// ... in that case, we would normally produce in[foo] thinking that
		// in is a reference, but we'll recognize it as a keyword here instead
		// to make the result less confusing.
		return true

	case after.Type == hclsyntax.TokenOBrack && (subject.Type == hclsyntax.TokenIdent || subject.Type == hclsyntax.TokenNumberLit || tokenBracketChange(subject) < 0):
		return false

	case subject.Type == hclsyntax.TokenBang:
		// No space after a bang
		return false

	case subject.Type == hclsyntax.TokenMinus:
		// Since a minus can either be subtraction or negation, and the latter
		// should _not_ have a space after it, we need to use some heuristics
		// to decide which case this is.
		// We guess that we have a negation if the token before doesn't look
		// like it could be the end of an expression.

		switch before.Type {

		case hclsyntax.TokenNil:
			// Minus at the start of input must be a negation
			return false

		case hclsyntax.TokenOParen, hclsyntax.TokenOBrace, hclsyntax.TokenOBrack, hclsyntax.TokenEqual, hclsyntax.TokenColon, hclsyntax.TokenComma, hclsyntax.TokenQuestion:
			// Minus immediately after an opening bracket or separator must be a negation.
			return false

		case hclsyntax.TokenPlus, hclsyntax.TokenStar, hclsyntax.TokenSlash, hclsyntax.TokenPercent, hclsyntax.TokenMinus:
			// Minus immediately after another arithmetic operator must be negation.
			return false

		case hclsyntax.TokenEqualOp, hclsyntax.TokenNotEqual, hclsyntax.TokenGreaterThan, hclsyntax.TokenGreaterThanEq, hclsyntax.TokenLessThan, hclsyntax.TokenLessThanEq:
			// Minus immediately after another comparison operator must be negation.
			return false

		case hclsyntax.TokenAnd, hclsyntax.TokenOr, hclsyntax.TokenBang:
			// Minus immediately after logical operator doesn't make sense but probably intended as negation.
			return false

		default:
			return true
		}

	case subject.Type == hclsyntax.TokenOBrace || after.Type == hclsyntax.TokenCBrace:
		// Unlike other bracket types, braces have spaces on both sides of them,
		// both in single-line nested blocks foo { bar = baz } and in object
		// constructor expressions foo = { bar = baz }.
		if subject.Type == hclsyntax.TokenOBrace && after.Type == hclsyntax.TokenCBrace {
			// An open brace followed by a close brace is an exception, however.
			// e.g. foo {} rather than foo { }
			return false
		}
		return true

	// In the unlikely event that an interpolation expression is just
	// a single object constructor, we'll put a space between the ${ and
	// the following { to make this more obvious, and then the same
	// thing for the two braces at the end.
	case (subject.Type == hclsyntax.TokenTemplateInterp || subject.Type == hclsyntax.TokenTemplateControl) && after.Type == hclsyntax.TokenOBrace:
		return true
	case subject.Type == hclsyntax.TokenCBrace && after.Type == hclsyntax.TokenTemplateSeqEnd:
		return true

	// Don't add spaces between interpolated items
	case subject.Type == hclsyntax.TokenTemplateSeqEnd && (after.Type == hclsyntax.TokenTemplateInterp || after.Type == hclsyntax.TokenTemplateControl):
		return false

	case tokenBracketChange(subject) > 0:
		// No spaces after open brackets
		return false

	case tokenBracketChange(after) < 0:
		// No spaces before close brackets
		return false

	default:
		// Most tokens are space-separated
		return true

	}
}

func linesForFormat(tokens Tokens) []formatLine {
	if len(tokens) == 0 {
		return make([]formatLine, 0)
	}

	// first we'll count our lines, so we can allocate the array for them in
	// a single block. (We want to minimize memory pressure in this codepath,
	// so it can be run somewhat-frequently by editor integrations.)
	lineCount := 1 // if there are zero newlines then there is one line
	for _, tok := range tokens {
		if tokenIsNewline(tok) {
			lineCount++
		}
	}

	// To start, we'll just put everything in the "lead" cell on each line,
	// and then do another pass over the lines afterwards to adjust.
	lines := make([]formatLine, lineCount)
	li := 0
	lineStart := 0
	for i, tok := range tokens {
		if tok.Type == hclsyntax.TokenEOF {
			// The EOF token doesn't belong to any line, and terminates the
			// token sequence.
			lines[li].lead = tokens[lineStart:i]
			break
		}

		if tokenIsNewline(tok) {
			lines[li].lead = tokens[lineStart : i+1]
			lineStart = i + 1
			li++
		}
	}

	// If a set of tokens doesn't end in TokenEOF (e.g. because it's a
	// fragment of tokens from the middle of a file) then we might fall
	// out here with a line still pending.
	if lineStart < len(tokens) {
		lines[li].lead = tokens[lineStart:]
		if lines[li].lead[len(lines[li].lead)-1].Type == hclsyntax.TokenEOF {
			lines[li].lead = lines[li].lead[:len(lines[li].lead)-1]
		}
	}

	// Now we'll pick off any trailing comments and attribute assignments
	// to shuffle off into the "comment" and "assign" cells.
	for i := range lines {
		line := &lines[i]

		if len(line.lead) == 0 {
			// if the line is empty then there's nothing for us to do
			// (this should happen only for the final line, because all other
			// lines would have a newline token of some kind)
			continue
		}

		if len(line.lead) > 1 && line.lead[len(line.lead)-1].Type == hclsyntax.TokenComment {
			line.comment = line.lead[len(line.lead)-1:]
			line.lead = line.lead[:len(line.lead)-1]
		}

		for i, tok := range line.lead {
			if i > 0 && tok.Type == hclsyntax.TokenEqual {
				// We only move the tokens into "assign" if the RHS seems to
				// be a whole expression, which we determine by counting
				// brackets. If there's a net positive number of brackets
				// then that suggests we're introducing a multi-line expression.
				netBrackets := 0
				for _, token := range line.lead[i:] {
					netBrackets += tokenBracketChange(token)
				}

				if netBrackets == 0 {
					line.assign = line.lead[i:]
					line.lead = line.lead[:i]
				}
				break
			}
		}
	}

	return lines
}

func tokenIsNewline(tok *Token) bool {
	switch tok.Type {
	case hclsyntax.TokenNewline:
		return true
	case hclsyntax.TokenComment:
		// Single line tokens (# and //) consume their terminating newline,
		// so we need to treat them as newline tokens as well.
		if len(tok.Bytes) > 0 && tok.Bytes[len(tok.Bytes)-1] == '\n' {
			return true
		}
	}
	return false
}

func tokenBracketChange(tok *Token) int {
	switch tok.Type {
	case hclsyntax.TokenOBrace, hclsyntax.TokenOBrack, hclsyntax.TokenOParen, hclsyntax.TokenTemplateControl, hclsyntax.TokenTemplateInterp:
		return 1
	case hclsyntax.TokenCBrace, hclsyntax.TokenCBrack, hclsyntax.TokenCParen, hclsyntax.TokenTemplateSeqEnd:
		return -1
	default:
		return 0
	}
}

// formatLine represents a single line of source code for formatting purposes,
// splitting its tokens into up to three "cells":
//
//   - lead: always present, representing everything up to one of the others
//   - assign: if line contains an attribute assignment, represents the tokens
//     starting at (and including) the equals symbol
//   - comment: if line contains any non-comment tokens and ends with a
//     single-line comment token, represents the comment.
//
// When formatting, the leading spaces of the first tokens in each of these
// cells is adjusted to align vertically their occurences on consecutive
// rows.
type formatLine struct {
	lead    Tokens
	assign  Tokens
	comment Tokens
}
