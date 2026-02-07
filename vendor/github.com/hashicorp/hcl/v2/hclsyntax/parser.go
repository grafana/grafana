// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package hclsyntax

import (
	"bytes"
	"fmt"
	"strconv"
	"unicode/utf8"

	"github.com/apparentlymart/go-textseg/v15/textseg"
	"github.com/hashicorp/hcl/v2"
	"github.com/zclconf/go-cty/cty"
)

type parser struct {
	*peeker

	// set to true if any recovery is attempted. The parser can use this
	// to attempt to reduce error noise by suppressing "bad token" errors
	// in recovery mode, assuming that the recovery heuristics have failed
	// in this case and left the peeker in a wrong place.
	recovery bool
}

func (p *parser) ParseBody(end TokenType) (*Body, hcl.Diagnostics) {
	attrs := Attributes{}
	blocks := Blocks{}
	var diags hcl.Diagnostics

	startRange := p.PrevRange()
	var endRange hcl.Range

Token:
	for {
		next := p.Peek()
		if next.Type == end {
			endRange = p.NextRange()
			p.Read()
			break Token
		}

		switch next.Type {
		case TokenNewline:
			p.Read()
			continue
		case TokenIdent:
			item, itemDiags := p.ParseBodyItem()
			diags = append(diags, itemDiags...)
			switch titem := item.(type) {
			case *Block:
				blocks = append(blocks, titem)
			case *Attribute:
				if existing, exists := attrs[titem.Name]; exists {
					diags = append(diags, &hcl.Diagnostic{
						Severity: hcl.DiagError,
						Summary:  "Attribute redefined",
						Detail: fmt.Sprintf(
							"The argument %q was already set at %s. Each argument may be set only once.",
							titem.Name, existing.NameRange.String(),
						),
						Subject: &titem.NameRange,
					})
				} else {
					attrs[titem.Name] = titem
				}
			default:
				// This should never happen for valid input, but may if a
				// syntax error was detected in ParseBodyItem that prevented
				// it from even producing a partially-broken item. In that
				// case, it would've left at least one error in the diagnostics
				// slice we already dealt with above.
				//
				// We'll assume ParseBodyItem attempted recovery to leave
				// us in a reasonable position to try parsing the next item.
				continue
			}
		default:
			bad := p.Read()
			if !p.recovery {
				switch bad.Type {
				case TokenOQuote:
					diags = append(diags, &hcl.Diagnostic{
						Severity: hcl.DiagError,
						Summary:  "Invalid argument name",
						Detail:   "Argument names must not be quoted.",
						Subject:  &bad.Range,
					})
				case TokenEOF:
					switch end {
					case TokenCBrace:
						// If we're looking for a closing brace then we're parsing a block
						diags = append(diags, &hcl.Diagnostic{
							Severity: hcl.DiagError,
							Summary:  "Unclosed configuration block",
							Detail:   "There is no closing brace for this block before the end of the file. This may be caused by incorrect brace nesting elsewhere in this file.",
							Subject:  &startRange,
						})
					default:
						// The only other "end" should itself be TokenEOF (for
						// the top-level body) and so we shouldn't get here,
						// but we'll return a generic error message anyway to
						// be resilient.
						diags = append(diags, &hcl.Diagnostic{
							Severity: hcl.DiagError,
							Summary:  "Unclosed configuration body",
							Detail:   "Found end of file before the end of this configuration body.",
							Subject:  &startRange,
						})
					}
				default:
					diags = append(diags, &hcl.Diagnostic{
						Severity: hcl.DiagError,
						Summary:  "Argument or block definition required",
						Detail:   "An argument or block definition is required here.",
						Subject:  &bad.Range,
					})
				}
			}
			endRange = p.PrevRange() // arbitrary, but somewhere inside the body means better diagnostics

			p.recover(end) // attempt to recover to the token after the end of this body
			break Token
		}
	}

	return &Body{
		Attributes: attrs,
		Blocks:     blocks,

		SrcRange: hcl.RangeBetween(startRange, endRange),
		EndRange: hcl.Range{
			Filename: endRange.Filename,
			Start:    endRange.End,
			End:      endRange.End,
		},
	}, diags
}

func (p *parser) ParseBodyItem() (Node, hcl.Diagnostics) {
	ident := p.Read()
	if ident.Type != TokenIdent {
		p.recoverAfterBodyItem()
		return nil, hcl.Diagnostics{
			{
				Severity: hcl.DiagError,
				Summary:  "Argument or block definition required",
				Detail:   "An argument or block definition is required here.",
				Subject:  &ident.Range,
			},
		}
	}

	next := p.Peek()

	switch next.Type {
	case TokenEqual:
		return p.finishParsingBodyAttribute(ident, false)
	case TokenOQuote, TokenOBrace, TokenIdent:
		return p.finishParsingBodyBlock(ident)
	default:
		p.recoverAfterBodyItem()
		return nil, hcl.Diagnostics{
			{
				Severity: hcl.DiagError,
				Summary:  "Argument or block definition required",
				Detail:   "An argument or block definition is required here. To set an argument, use the equals sign \"=\" to introduce the argument value.",
				Subject:  &ident.Range,
			},
		}
	}
}

// parseSingleAttrBody is a weird variant of ParseBody that deals with the
// body of a nested block containing only one attribute value all on a single
// line, like foo { bar = baz } . It expects to find a single attribute item
// immediately followed by the end token type with no intervening newlines.
func (p *parser) parseSingleAttrBody(end TokenType) (*Body, hcl.Diagnostics) {
	ident := p.Read()
	if ident.Type != TokenIdent {
		p.recoverAfterBodyItem()
		return nil, hcl.Diagnostics{
			{
				Severity: hcl.DiagError,
				Summary:  "Argument or block definition required",
				Detail:   "An argument or block definition is required here.",
				Subject:  &ident.Range,
			},
		}
	}

	var attr *Attribute
	var diags hcl.Diagnostics

	next := p.Peek()

	switch next.Type {
	case TokenEqual:
		node, attrDiags := p.finishParsingBodyAttribute(ident, true)
		diags = append(diags, attrDiags...)
		attr = node.(*Attribute)
	case TokenOQuote, TokenOBrace, TokenIdent:
		p.recoverAfterBodyItem()
		return nil, hcl.Diagnostics{
			{
				Severity: hcl.DiagError,
				Summary:  "Argument definition required",
				Detail:   fmt.Sprintf("A single-line block definition can contain only a single argument. If you meant to define argument %q, use an equals sign to assign it a value. To define a nested block, place it on a line of its own within its parent block.", ident.Bytes),
				Subject:  hcl.RangeBetween(ident.Range, next.Range).Ptr(),
			},
		}
	default:
		p.recoverAfterBodyItem()
		return nil, hcl.Diagnostics{
			{
				Severity: hcl.DiagError,
				Summary:  "Argument or block definition required",
				Detail:   "An argument or block definition is required here. To set an argument, use the equals sign \"=\" to introduce the argument value.",
				Subject:  &ident.Range,
			},
		}
	}

	return &Body{
		Attributes: Attributes{
			string(ident.Bytes): attr,
		},

		SrcRange: attr.SrcRange,
		EndRange: hcl.Range{
			Filename: attr.SrcRange.Filename,
			Start:    attr.SrcRange.End,
			End:      attr.SrcRange.End,
		},
	}, diags

}

func (p *parser) finishParsingBodyAttribute(ident Token, singleLine bool) (Node, hcl.Diagnostics) {
	eqTok := p.Read() // eat equals token
	if eqTok.Type != TokenEqual {
		// should never happen if caller behaves
		panic("finishParsingBodyAttribute called with next not equals")
	}

	var endRange hcl.Range

	expr, diags := p.ParseExpression()
	if p.recovery && diags.HasErrors() {
		// recovery within expressions tends to be tricky, so we've probably
		// landed somewhere weird. We'll try to reset to the start of a body
		// item so parsing can continue.
		endRange = p.PrevRange()
		p.recoverAfterBodyItem()
	} else {
		endRange = p.PrevRange()
		if !singleLine {
			end := p.Peek()
			if end.Type != TokenNewline && end.Type != TokenEOF {
				if !p.recovery {
					summary := "Missing newline after argument"
					detail := "An argument definition must end with a newline."

					if end.Type == TokenComma {
						summary = "Unexpected comma after argument"
						detail = "Argument definitions must be separated by newlines, not commas. " + detail
					}

					diags = append(diags, &hcl.Diagnostic{
						Severity: hcl.DiagError,
						Summary:  summary,
						Detail:   detail,
						Subject:  &end.Range,
						Context:  hcl.RangeBetween(ident.Range, end.Range).Ptr(),
					})
				}
				endRange = p.PrevRange()
				p.recoverAfterBodyItem()
			} else {
				endRange = p.PrevRange()
				p.Read() // eat newline
			}
		}
	}

	return &Attribute{
		Name: string(ident.Bytes),
		Expr: expr,

		SrcRange:    hcl.RangeBetween(ident.Range, endRange),
		NameRange:   ident.Range,
		EqualsRange: eqTok.Range,
	}, diags
}

func (p *parser) finishParsingBodyBlock(ident Token) (Node, hcl.Diagnostics) {
	var blockType = string(ident.Bytes)
	var diags hcl.Diagnostics
	var labels []string
	var labelRanges []hcl.Range

	var oBrace Token

Token:
	for {
		tok := p.Peek()

		switch tok.Type {

		case TokenOBrace:
			oBrace = p.Read()
			break Token

		case TokenOQuote:
			label, labelRange, labelDiags := p.parseQuotedStringLiteral()
			diags = append(diags, labelDiags...)
			labels = append(labels, label)
			labelRanges = append(labelRanges, labelRange)
			// parseQuoteStringLiteral recovers up to the closing quote
			// if it encounters problems, so we can continue looking for
			// more labels and eventually the block body even.

		case TokenIdent:
			tok = p.Read() // eat token
			label, labelRange := string(tok.Bytes), tok.Range
			labels = append(labels, label)
			labelRanges = append(labelRanges, labelRange)

		default:
			switch tok.Type {
			case TokenEqual:
				diags = append(diags, &hcl.Diagnostic{
					Severity: hcl.DiagError,
					Summary:  "Invalid block definition",
					Detail:   "The equals sign \"=\" indicates an argument definition, and must not be used when defining a block.",
					Subject:  &tok.Range,
					Context:  hcl.RangeBetween(ident.Range, tok.Range).Ptr(),
				})
			case TokenNewline:
				diags = append(diags, &hcl.Diagnostic{
					Severity: hcl.DiagError,
					Summary:  "Invalid block definition",
					Detail:   "A block definition must have block content delimited by \"{\" and \"}\", starting on the same line as the block header.",
					Subject:  &tok.Range,
					Context:  hcl.RangeBetween(ident.Range, tok.Range).Ptr(),
				})
			default:
				if !p.recovery {
					diags = append(diags, &hcl.Diagnostic{
						Severity: hcl.DiagError,
						Summary:  "Invalid block definition",
						Detail:   "Either a quoted string block label or an opening brace (\"{\") is expected here.",
						Subject:  &tok.Range,
						Context:  hcl.RangeBetween(ident.Range, tok.Range).Ptr(),
					})
				}
			}

			p.recoverAfterBodyItem()

			return &Block{
				Type:   blockType,
				Labels: labels,
				Body: &Body{
					SrcRange: ident.Range,
					EndRange: ident.Range,
				},

				TypeRange:       ident.Range,
				LabelRanges:     labelRanges,
				OpenBraceRange:  ident.Range, // placeholder
				CloseBraceRange: ident.Range, // placeholder
			}, diags
		}
	}

	// Once we fall out here, the peeker is pointed just after our opening
	// brace, so we can begin our nested body parsing.
	var body *Body
	var bodyDiags hcl.Diagnostics
	switch p.Peek().Type {
	case TokenNewline, TokenEOF, TokenCBrace:
		body, bodyDiags = p.ParseBody(TokenCBrace)
	default:
		// Special one-line, single-attribute block parsing mode.
		body, bodyDiags = p.parseSingleAttrBody(TokenCBrace)
		switch p.Peek().Type {
		case TokenCBrace:
			p.Read() // the happy path - just consume the closing brace
		case TokenComma:
			// User seems to be trying to use the object-constructor
			// comma-separated style, which isn't permitted for blocks.
			diags = append(diags, &hcl.Diagnostic{
				Severity: hcl.DiagError,
				Summary:  "Invalid single-argument block definition",
				Detail:   "Single-line block syntax can include only one argument definition. To define multiple arguments, use the multi-line block syntax with one argument definition per line.",
				Subject:  p.Peek().Range.Ptr(),
			})
			p.recover(TokenCBrace)
		case TokenNewline:
			// We don't allow weird mixtures of single and multi-line syntax.
			diags = append(diags, &hcl.Diagnostic{
				Severity: hcl.DiagError,
				Summary:  "Invalid single-argument block definition",
				Detail:   "An argument definition on the same line as its containing block creates a single-line block definition, which must also be closed on the same line. Place the block's closing brace immediately after the argument definition.",
				Subject:  p.Peek().Range.Ptr(),
			})
			p.recover(TokenCBrace)
		default:
			// Some other weird thing is going on. Since we can't guess a likely
			// user intent for this one, we'll skip it if we're already in
			// recovery mode.
			if !p.recovery {
				switch p.Peek().Type {
				case TokenEOF:
					diags = append(diags, &hcl.Diagnostic{
						Severity: hcl.DiagError,
						Summary:  "Unclosed configuration block",
						Detail:   "There is no closing brace for this block before the end of the file. This may be caused by incorrect brace nesting elsewhere in this file.",
						Subject:  oBrace.Range.Ptr(),
						Context:  hcl.RangeBetween(ident.Range, oBrace.Range).Ptr(),
					})
				default:
					diags = append(diags, &hcl.Diagnostic{
						Severity: hcl.DiagError,
						Summary:  "Invalid single-argument block definition",
						Detail:   "A single-line block definition must end with a closing brace immediately after its single argument definition.",
						Subject:  p.Peek().Range.Ptr(),
					})
				}
			}
			p.recover(TokenCBrace)
		}
	}
	diags = append(diags, bodyDiags...)
	cBraceRange := p.PrevRange()

	eol := p.Peek()
	if eol.Type == TokenNewline || eol.Type == TokenEOF {
		p.Read() // eat newline
	} else {
		if !p.recovery {
			diags = append(diags, &hcl.Diagnostic{
				Severity: hcl.DiagError,
				Summary:  "Missing newline after block definition",
				Detail:   "A block definition must end with a newline.",
				Subject:  &eol.Range,
				Context:  hcl.RangeBetween(ident.Range, eol.Range).Ptr(),
			})
		}
		p.recoverAfterBodyItem()
	}

	// We must never produce a nil body, since the caller may attempt to
	// do analysis of a partial result when there's an error, so we'll
	// insert a placeholder if we otherwise failed to produce a valid
	// body due to one of the syntax error paths above.
	if body == nil && diags.HasErrors() {
		body = &Body{
			SrcRange: hcl.RangeBetween(oBrace.Range, cBraceRange),
			EndRange: cBraceRange,
		}
	}

	return &Block{
		Type:   blockType,
		Labels: labels,
		Body:   body,

		TypeRange:       ident.Range,
		LabelRanges:     labelRanges,
		OpenBraceRange:  oBrace.Range,
		CloseBraceRange: cBraceRange,
	}, diags
}

func (p *parser) ParseExpression() (Expression, hcl.Diagnostics) {
	return p.parseTernaryConditional()
}

func (p *parser) parseTernaryConditional() (Expression, hcl.Diagnostics) {
	// The ternary conditional operator (.. ? .. : ..) behaves somewhat
	// like a binary operator except that the "symbol" is itself
	// an expression enclosed in two punctuation characters.
	// The middle expression is parsed as if the ? and : symbols
	// were parentheses. The "rhs" (the "false expression") is then
	// treated right-associatively so it behaves similarly to the
	// middle in terms of precedence.

	startRange := p.NextRange()
	var condExpr, trueExpr, falseExpr Expression
	var diags hcl.Diagnostics

	condExpr, condDiags := p.parseBinaryOps(binaryOps)
	diags = append(diags, condDiags...)
	if p.recovery && condDiags.HasErrors() {
		return condExpr, diags
	}

	questionMark := p.Peek()
	if questionMark.Type != TokenQuestion {
		return condExpr, diags
	}

	p.Read() // eat question mark

	trueExpr, trueDiags := p.ParseExpression()
	diags = append(diags, trueDiags...)
	if p.recovery && trueDiags.HasErrors() {
		return condExpr, diags
	}

	colon := p.Peek()
	if colon.Type != TokenColon {
		diags = append(diags, &hcl.Diagnostic{
			Severity: hcl.DiagError,
			Summary:  "Missing false expression in conditional",
			Detail:   "The conditional operator (...?...:...) requires a false expression, delimited by a colon.",
			Subject:  &colon.Range,
			Context:  hcl.RangeBetween(startRange, colon.Range).Ptr(),
		})
		return condExpr, diags
	}

	p.Read() // eat colon

	falseExpr, falseDiags := p.ParseExpression()
	diags = append(diags, falseDiags...)
	if p.recovery && falseDiags.HasErrors() {
		return condExpr, diags
	}

	return &ConditionalExpr{
		Condition:   condExpr,
		TrueResult:  trueExpr,
		FalseResult: falseExpr,

		SrcRange: hcl.RangeBetween(startRange, falseExpr.Range()),
	}, diags
}

// parseBinaryOps calls itself recursively to work through all of the
// operator precedence groups, and then eventually calls parseExpressionTerm
// for each operand.
func (p *parser) parseBinaryOps(ops []map[TokenType]*Operation) (Expression, hcl.Diagnostics) {
	if len(ops) == 0 {
		// We've run out of operators, so now we'll just try to parse a term.
		return p.parseExpressionWithTraversals()
	}

	thisLevel := ops[0]
	remaining := ops[1:]

	var lhs, rhs Expression
	var operation *Operation
	var diags hcl.Diagnostics

	// Parse a term that might be the first operand of a binary
	// operation or it might just be a standalone term.
	// We won't know until we've parsed it and can look ahead
	// to see if there's an operator token for this level.
	lhs, lhsDiags := p.parseBinaryOps(remaining)
	diags = append(diags, lhsDiags...)
	if p.recovery && lhsDiags.HasErrors() {
		return lhs, diags
	}

	// We'll keep eating up operators until we run out, so that operators
	// with the same precedence will combine in a left-associative manner:
	// a+b+c => (a+b)+c, not a+(b+c)
	//
	// Should we later want to have right-associative operators, a way
	// to achieve that would be to call back up to ParseExpression here
	// instead of iteratively parsing only the remaining operators.
	for {
		next := p.Peek()
		var newOp *Operation
		var ok bool
		if newOp, ok = thisLevel[next.Type]; !ok {
			break
		}

		// Are we extending an expression started on the previous iteration?
		if operation != nil {
			lhs = &BinaryOpExpr{
				LHS: lhs,
				Op:  operation,
				RHS: rhs,

				SrcRange: hcl.RangeBetween(lhs.Range(), rhs.Range()),
			}
		}

		operation = newOp
		p.Read() // eat operator token
		var rhsDiags hcl.Diagnostics
		rhs, rhsDiags = p.parseBinaryOps(remaining)
		diags = append(diags, rhsDiags...)
		if p.recovery && rhsDiags.HasErrors() {
			return lhs, diags
		}
	}

	if operation == nil {
		return lhs, diags
	}

	return &BinaryOpExpr{
		LHS: lhs,
		Op:  operation,
		RHS: rhs,

		SrcRange: hcl.RangeBetween(lhs.Range(), rhs.Range()),
	}, diags
}

func (p *parser) parseExpressionWithTraversals() (Expression, hcl.Diagnostics) {
	term, diags := p.parseExpressionTerm()
	ret, moreDiags := p.parseExpressionTraversals(term)
	diags = append(diags, moreDiags...)
	return ret, diags
}

func (p *parser) parseExpressionTraversals(from Expression) (Expression, hcl.Diagnostics) {
	var diags hcl.Diagnostics
	ret := from

Traversal:
	for {
		next := p.Peek()

		switch next.Type {
		case TokenDot:
			// Attribute access or splat
			dot := p.Read()
			attrTok := p.Peek()

			switch attrTok.Type {
			case TokenIdent:
				attrTok = p.Read() // eat token
				name := string(attrTok.Bytes)
				rng := hcl.RangeBetween(dot.Range, attrTok.Range)
				step := hcl.TraverseAttr{
					Name:     name,
					SrcRange: rng,
				}

				ret = makeRelativeTraversal(ret, step, rng)

			case TokenNumberLit:
				// This is a weird form we inherited from HIL, allowing numbers
				// to be used as attributes as a weird way of writing [n].
				// This was never actually a first-class thing in HIL, but
				// HIL tolerated sequences like .0. in its variable names and
				// calling applications like Terraform exploited that to
				// introduce indexing syntax where none existed.
				numTok := p.Read() // eat token
				attrTok = numTok

				// This syntax is ambiguous if multiple indices are used in
				// succession, like foo.0.1.baz: that actually parses as
				// a fractional number 0.1. Since we're only supporting this
				// syntax for compatibility with legacy Terraform
				// configurations, and Terraform does not tend to have lists
				// of lists, we'll choose to reject that here with a helpful
				// error message, rather than failing later because the index
				// isn't a whole number.
				if dotIdx := bytes.IndexByte(numTok.Bytes, '.'); dotIdx >= 0 {
					first := numTok.Bytes[:dotIdx]
					second := numTok.Bytes[dotIdx+1:]
					diags = append(diags, &hcl.Diagnostic{
						Severity: hcl.DiagError,
						Summary:  "Invalid legacy index syntax",
						Detail:   fmt.Sprintf("When using the legacy index syntax, chaining two indexes together is not permitted. Use the proper index syntax instead, like [%s][%s].", first, second),
						Subject:  &attrTok.Range,
					})
					rng := hcl.RangeBetween(dot.Range, numTok.Range)
					step := hcl.TraverseIndex{
						Key:      cty.DynamicVal,
						SrcRange: rng,
					}
					ret = makeRelativeTraversal(ret, step, rng)
					break
				}

				numVal, numDiags := p.numberLitValue(numTok)
				diags = append(diags, numDiags...)

				rng := hcl.RangeBetween(dot.Range, numTok.Range)
				step := hcl.TraverseIndex{
					Key:      numVal,
					SrcRange: rng,
				}

				ret = makeRelativeTraversal(ret, step, rng)

			case TokenStar:
				// "Attribute-only" splat expression.
				// (This is a kinda weird construct inherited from HIL, which
				// behaves a bit like a [*] splat except that it is only able
				// to do attribute traversals into each of its elements,
				// whereas foo[*] can support _any_ traversal.
				marker := p.Read() // eat star
				trav := make(hcl.Traversal, 0, 1)
				var firstRange, lastRange hcl.Range
				firstRange = p.NextRange()
				lastRange = marker.Range
				for p.Peek().Type == TokenDot {
					dot := p.Read()

					if p.Peek().Type == TokenNumberLit {
						// Continuing the "weird stuff inherited from HIL"
						// theme, we also allow numbers as attribute names
						// inside splats and interpret them as indexing
						// into a list, for expressions like:
						// foo.bar.*.baz.0.foo
						numTok := p.Read()

						// Weird special case if the user writes something
						// like foo.bar.*.baz.0.0.foo, where 0.0 parses
						// as a number.
						if dotIdx := bytes.IndexByte(numTok.Bytes, '.'); dotIdx >= 0 {
							first := numTok.Bytes[:dotIdx]
							second := numTok.Bytes[dotIdx+1:]
							diags = append(diags, &hcl.Diagnostic{
								Severity: hcl.DiagError,
								Summary:  "Invalid legacy index syntax",
								Detail:   fmt.Sprintf("When using the legacy index syntax, chaining two indexes together is not permitted. Use the proper index syntax with a full splat expression [*] instead, like [%s][%s].", first, second),
								Subject:  &attrTok.Range,
							})
							trav = append(trav, hcl.TraverseIndex{
								Key:      cty.DynamicVal,
								SrcRange: hcl.RangeBetween(dot.Range, numTok.Range),
							})
							lastRange = numTok.Range
							continue
						}

						numVal, numDiags := p.numberLitValue(numTok)
						diags = append(diags, numDiags...)
						trav = append(trav, hcl.TraverseIndex{
							Key:      numVal,
							SrcRange: hcl.RangeBetween(dot.Range, numTok.Range),
						})
						lastRange = numTok.Range
						continue
					}

					if p.Peek().Type != TokenIdent {
						if !p.recovery {
							if p.Peek().Type == TokenStar {
								diags = append(diags, &hcl.Diagnostic{
									Severity: hcl.DiagError,
									Summary:  "Nested splat expression not allowed",
									Detail:   "A splat expression (*) cannot be used inside another attribute-only splat expression.",
									Subject:  p.Peek().Range.Ptr(),
								})
							} else {
								diags = append(diags, &hcl.Diagnostic{
									Severity: hcl.DiagError,
									Summary:  "Invalid attribute name",
									Detail:   "An attribute name is required after a dot.",
									Subject:  &attrTok.Range,
								})
							}
						}
						p.setRecovery()
						continue Traversal
					}

					attrTok := p.Read()
					trav = append(trav, hcl.TraverseAttr{
						Name:     string(attrTok.Bytes),
						SrcRange: hcl.RangeBetween(dot.Range, attrTok.Range),
					})
					lastRange = attrTok.Range
				}

				itemExpr := &AnonSymbolExpr{
					SrcRange: hcl.RangeBetween(dot.Range, marker.Range),
				}
				var travExpr Expression
				if len(trav) == 0 {
					travExpr = itemExpr
				} else {
					travExpr = &RelativeTraversalExpr{
						Source:    itemExpr,
						Traversal: trav,
						SrcRange:  hcl.RangeBetween(firstRange, lastRange),
					}
				}

				ret = &SplatExpr{
					Source: ret,
					Each:   travExpr,
					Item:   itemExpr,

					SrcRange:    hcl.RangeBetween(from.Range(), lastRange),
					MarkerRange: hcl.RangeBetween(dot.Range, marker.Range),
				}

			default:
				diags = append(diags, &hcl.Diagnostic{
					Severity: hcl.DiagError,
					Summary:  "Invalid attribute name",
					Detail:   "An attribute name is required after a dot.",
					Subject:  &attrTok.Range,
				})
				// This leaves the peeker in a bad place, so following items
				// will probably be misparsed until we hit something that
				// allows us to re-sync.
				//
				// Returning an ExprSyntaxError allows us to pass more information
				// about the invalid expression to the caller, which can then
				// use this for example for completions that happen after typing
				// a dot in an editor.
				ret = &ExprSyntaxError{
					Placeholder: cty.DynamicVal,
					ParseDiags:  diags,
					SrcRange:    hcl.RangeBetween(from.Range(), dot.Range),
				}

				p.setRecovery()
			}

		case TokenOBrack:
			// Indexing of a collection.
			// This may or may not be a hcl.Traverser, depending on whether
			// the key value is something constant.

			open := p.Read()
			switch p.Peek().Type {
			case TokenStar:
				// This is a full splat expression, like foo[*], which consumes
				// the rest of the traversal steps after it using a recursive
				// call to this function.
				p.Read() // consume star
				close := p.Read()
				if close.Type != TokenCBrack && !p.recovery {
					diags = append(diags, &hcl.Diagnostic{
						Severity: hcl.DiagError,
						Summary:  "Missing close bracket on splat index",
						Detail:   "The star for a full splat operator must be immediately followed by a closing bracket (\"]\").",
						Subject:  &close.Range,
					})
					close = p.recover(TokenCBrack)
				}
				// Splat expressions use a special "anonymous symbol"  as a
				// placeholder in an expression to be evaluated once for each
				// item in the source expression.
				itemExpr := &AnonSymbolExpr{
					SrcRange: hcl.RangeBetween(open.Range, close.Range),
				}
				// Now we'll recursively call this same function to eat any
				// remaining traversal steps against the anonymous symbol.
				travExpr, nestedDiags := p.parseExpressionTraversals(itemExpr)
				diags = append(diags, nestedDiags...)

				ret = &SplatExpr{
					Source: ret,
					Each:   travExpr,
					Item:   itemExpr,

					SrcRange:    hcl.RangeBetween(from.Range(), travExpr.Range()),
					MarkerRange: hcl.RangeBetween(open.Range, close.Range),
				}

			default:

				var close Token
				p.PushIncludeNewlines(false) // arbitrary newlines allowed in brackets
				keyExpr, keyDiags := p.ParseExpression()
				diags = append(diags, keyDiags...)
				if p.recovery && keyDiags.HasErrors() {
					close = p.recover(TokenCBrack)
				} else {
					close = p.Read()
					if close.Type != TokenCBrack && !p.recovery {
						diags = append(diags, &hcl.Diagnostic{
							Severity: hcl.DiagError,
							Summary:  "Missing close bracket on index",
							Detail:   "The index operator must end with a closing bracket (\"]\").",
							Subject:  &close.Range,
						})
						close = p.recover(TokenCBrack)
					}
				}
				p.PopIncludeNewlines()

				if lit, isLit := keyExpr.(*LiteralValueExpr); isLit {
					litKey, _ := lit.Value(nil)
					rng := hcl.RangeBetween(open.Range, close.Range)
					step := hcl.TraverseIndex{
						Key:      litKey,
						SrcRange: rng,
					}
					ret = makeRelativeTraversal(ret, step, rng)
				} else if tmpl, isTmpl := keyExpr.(*TemplateExpr); isTmpl && tmpl.IsStringLiteral() {
					litKey, _ := tmpl.Value(nil)
					rng := hcl.RangeBetween(open.Range, close.Range)
					step := hcl.TraverseIndex{
						Key:      litKey,
						SrcRange: rng,
					}
					ret = makeRelativeTraversal(ret, step, rng)
				} else {
					rng := hcl.RangeBetween(open.Range, close.Range)
					ret = &IndexExpr{
						Collection: ret,
						Key:        keyExpr,

						SrcRange:     hcl.RangeBetween(from.Range(), rng),
						OpenRange:    open.Range,
						BracketRange: rng,
					}
				}
			}

		default:
			break Traversal
		}
	}

	return ret, diags
}

// makeRelativeTraversal takes an expression and a traverser and returns
// a traversal expression that combines the two. If the given expression
// is already a traversal, it is extended in place (mutating it) and
// returned. If it isn't, a new RelativeTraversalExpr is created and returned.
func makeRelativeTraversal(expr Expression, next hcl.Traverser, rng hcl.Range) Expression {
	switch texpr := expr.(type) {
	case *ScopeTraversalExpr:
		texpr.Traversal = append(texpr.Traversal, next)
		texpr.SrcRange = hcl.RangeBetween(texpr.SrcRange, rng)
		return texpr
	case *RelativeTraversalExpr:
		texpr.Traversal = append(texpr.Traversal, next)
		texpr.SrcRange = hcl.RangeBetween(texpr.SrcRange, rng)
		return texpr
	default:
		return &RelativeTraversalExpr{
			Source:    expr,
			Traversal: hcl.Traversal{next},
			SrcRange:  hcl.RangeBetween(expr.Range(), rng),
		}
	}
}

func (p *parser) parseExpressionTerm() (Expression, hcl.Diagnostics) {
	start := p.Peek()

	switch start.Type {
	case TokenOParen:
		oParen := p.Read() // eat open paren

		p.PushIncludeNewlines(false)

		expr, diags := p.ParseExpression()
		if diags.HasErrors() {
			// attempt to place the peeker after our closing paren
			// before we return, so that the next parser has some
			// chance of finding a valid expression.
			p.recover(TokenCParen)
			p.PopIncludeNewlines()
			return expr, diags
		}

		close := p.Peek()
		if close.Type != TokenCParen {
			diags = append(diags, &hcl.Diagnostic{
				Severity: hcl.DiagError,
				Summary:  "Unbalanced parentheses",
				Detail:   "Expected a closing parenthesis to terminate the expression.",
				Subject:  &close.Range,
				Context:  hcl.RangeBetween(start.Range, close.Range).Ptr(),
			})
			p.setRecovery()
		}

		cParen := p.Read() // eat closing paren
		p.PopIncludeNewlines()

		// Our parser's already taken care of the precedence effect of the
		// parentheses by considering them to be a kind of "term", but we
		// still need to include the parentheses in our AST so we can give
		// an accurate representation of the source range that includes the
		// open and closing parentheses.
		expr = &ParenthesesExpr{
			Expression: expr,
			SrcRange:   hcl.RangeBetween(oParen.Range, cParen.Range),
		}

		return expr, diags

	case TokenNumberLit:
		tok := p.Read() // eat number token

		numVal, diags := p.numberLitValue(tok)
		return &LiteralValueExpr{
			Val:      numVal,
			SrcRange: tok.Range,
		}, diags

	case TokenIdent:
		tok := p.Read() // eat identifier token

		if p.Peek().Type == TokenOParen || p.Peek().Type == TokenDoubleColon {
			return p.finishParsingFunctionCall(tok)
		}

		name := string(tok.Bytes)
		switch name {
		case "true":
			return &LiteralValueExpr{
				Val:      cty.True,
				SrcRange: tok.Range,
			}, nil
		case "false":
			return &LiteralValueExpr{
				Val:      cty.False,
				SrcRange: tok.Range,
			}, nil
		case "null":
			return &LiteralValueExpr{
				Val:      cty.NullVal(cty.DynamicPseudoType),
				SrcRange: tok.Range,
			}, nil
		default:
			return &ScopeTraversalExpr{
				Traversal: hcl.Traversal{
					hcl.TraverseRoot{
						Name:     name,
						SrcRange: tok.Range,
					},
				},
				SrcRange: tok.Range,
			}, nil
		}

	case TokenOQuote, TokenOHeredoc:
		open := p.Read() // eat opening marker
		closer := p.oppositeBracket(open.Type)
		exprs, passthru, _, diags := p.parseTemplateInner(closer, tokenOpensFlushHeredoc(open))

		closeRange := p.PrevRange()

		if passthru {
			if len(exprs) != 1 {
				panic("passthru set with len(exprs) != 1")
			}
			return &TemplateWrapExpr{
				Wrapped:  exprs[0],
				SrcRange: hcl.RangeBetween(open.Range, closeRange),
			}, diags
		}

		return &TemplateExpr{
			Parts:    exprs,
			SrcRange: hcl.RangeBetween(open.Range, closeRange),
		}, diags

	case TokenMinus:
		tok := p.Read() // eat minus token

		// Important to use parseExpressionWithTraversals rather than parseExpression
		// here, otherwise we can capture a following binary expression into
		// our negation.
		// e.g. -46+5 should parse as (-46)+5, not -(46+5)
		operand, diags := p.parseExpressionWithTraversals()
		return &UnaryOpExpr{
			Op:  OpNegate,
			Val: operand,

			SrcRange:    hcl.RangeBetween(tok.Range, operand.Range()),
			SymbolRange: tok.Range,
		}, diags

	case TokenBang:
		tok := p.Read() // eat bang token

		// Important to use parseExpressionWithTraversals rather than parseExpression
		// here, otherwise we can capture a following binary expression into
		// our negation.
		operand, diags := p.parseExpressionWithTraversals()
		return &UnaryOpExpr{
			Op:  OpLogicalNot,
			Val: operand,

			SrcRange:    hcl.RangeBetween(tok.Range, operand.Range()),
			SymbolRange: tok.Range,
		}, diags

	case TokenOBrack:
		return p.parseTupleCons()

	case TokenOBrace:
		return p.parseObjectCons()

	default:
		var diags hcl.Diagnostics
		if !p.recovery {
			switch start.Type {
			case TokenEOF:
				diags = append(diags, &hcl.Diagnostic{
					Severity: hcl.DiagError,
					Summary:  "Missing expression",
					Detail:   "Expected the start of an expression, but found the end of the file.",
					Subject:  &start.Range,
				})
			default:
				diags = append(diags, &hcl.Diagnostic{
					Severity: hcl.DiagError,
					Summary:  "Invalid expression",
					Detail:   "Expected the start of an expression, but found an invalid expression token.",
					Subject:  &start.Range,
				})
			}
		}
		p.setRecovery()

		// Return a placeholder so that the AST is still structurally sound
		// even in the presence of parse errors.
		return &LiteralValueExpr{
			Val:      cty.DynamicVal,
			SrcRange: start.Range,
		}, diags
	}
}

func (p *parser) numberLitValue(tok Token) (cty.Value, hcl.Diagnostics) {
	// The cty.ParseNumberVal is always the same behavior as converting a
	// string to a number, ensuring we always interpret decimal numbers in
	// the same way.
	numVal, err := cty.ParseNumberVal(string(tok.Bytes))
	if err != nil {
		ret := cty.UnknownVal(cty.Number)
		return ret, hcl.Diagnostics{
			{
				Severity: hcl.DiagError,
				Summary:  "Invalid number literal",
				// FIXME: not a very good error message, but convert only
				// gives us "a number is required", so not much help either.
				Detail:  "Failed to recognize the value of this number literal.",
				Subject: &tok.Range,
			},
		}
	}
	return numVal, nil
}

// finishParsingFunctionCall parses a function call assuming that the function
// name was already read, and so the peeker should be pointing at the opening
// parenthesis after the name, or at the double-colon after the initial
// function scope name.
func (p *parser) finishParsingFunctionCall(name Token) (Expression, hcl.Diagnostics) {
	var diags hcl.Diagnostics

	openTok := p.Read()
	if openTok.Type != TokenOParen && openTok.Type != TokenDoubleColon {
		// should never happen if callers behave
		panic("finishParsingFunctionCall called with unsupported next token")
	}

	nameStr := string(name.Bytes)
	nameEndPos := name.Range.End
	for openTok.Type == TokenDoubleColon {
		nextName := p.Read()
		if nextName.Type != TokenIdent {
			diag := hcl.Diagnostic{
				Severity: hcl.DiagError,
				Summary:  "Missing function name",
				Detail:   "Function scope resolution symbol :: must be followed by a function name in this scope.",
				Subject:  &nextName.Range,
				Context:  hcl.RangeBetween(name.Range, nextName.Range).Ptr(),
			}
			diags = append(diags, &diag)
			p.recoverOver(TokenOParen)
			return &ExprSyntaxError{
				ParseDiags:  hcl.Diagnostics{&diag},
				Placeholder: cty.DynamicVal,
				SrcRange:    hcl.RangeBetween(name.Range, nextName.Range),
			}, diags
		}

		// Initial versions of HCLv2 didn't support function namespaces, and
		// so for backward compatibility we just treat namespaced functions
		// as weird names with "::" separators in them, saved as a string
		// to keep the API unchanged. FunctionCallExpr also has some special
		// handling of names containing :: when referring to a function that
		// doesn't exist in EvalContext, to return better error messages
		// when namespaces are used incorrectly.
		nameStr = nameStr + "::" + string(nextName.Bytes)
		nameEndPos = nextName.Range.End

		openTok = p.Read()
	}

	nameRange := hcl.Range{
		Filename: name.Range.Filename,
		Start:    name.Range.Start,
		End:      nameEndPos,
	}

	if openTok.Type != TokenOParen {
		diag := hcl.Diagnostic{
			Severity: hcl.DiagError,
			Summary:  "Missing open parenthesis",
			Detail:   "Function selector must be followed by an open parenthesis to begin the function call.",
			Subject:  &openTok.Range,
			Context:  hcl.RangeBetween(name.Range, openTok.Range).Ptr(),
		}

		diags = append(diags, &diag)
		p.recoverOver(TokenOParen)
		return &ExprSyntaxError{
			ParseDiags:  hcl.Diagnostics{&diag},
			Placeholder: cty.DynamicVal,
			SrcRange:    hcl.RangeBetween(name.Range, openTok.Range),
		}, diags
	}

	var args []Expression
	var expandFinal bool
	var closeTok Token

	// Arbitrary newlines are allowed inside the function call parentheses.
	p.PushIncludeNewlines(false)

Token:
	for {
		tok := p.Peek()

		if tok.Type == TokenCParen {
			closeTok = p.Read() // eat closing paren
			break Token
		}

		arg, argDiags := p.ParseExpression()
		args = append(args, arg)
		diags = append(diags, argDiags...)
		if p.recovery && argDiags.HasErrors() {
			// if there was a parse error in the argument then we've
			// probably been left in a weird place in the token stream,
			// so we'll bail out with a partial argument list.
			recoveredTok := p.recover(TokenCParen)

			// record the recovered token, if one was found
			if recoveredTok.Type == TokenCParen {
				closeTok = recoveredTok
			}
			break Token
		}

		sep := p.Read()
		if sep.Type == TokenCParen {
			closeTok = sep
			break Token
		}

		if sep.Type == TokenEllipsis {
			expandFinal = true

			if p.Peek().Type != TokenCParen {
				if !p.recovery {
					diags = append(diags, &hcl.Diagnostic{
						Severity: hcl.DiagError,
						Summary:  "Missing closing parenthesis",
						Detail:   "An expanded function argument (with ...) must be immediately followed by closing parentheses.",
						Subject:  &sep.Range,
						Context:  hcl.RangeBetween(name.Range, sep.Range).Ptr(),
					})
				}
				closeTok = p.recover(TokenCParen)
			} else {
				closeTok = p.Read() // eat closing paren
			}
			break Token
		}

		if sep.Type != TokenComma {
			switch sep.Type {
			case TokenEOF:
				diags = append(diags, &hcl.Diagnostic{
					Severity: hcl.DiagError,
					Summary:  "Unterminated function call",
					Detail:   "There is no closing parenthesis for this function call before the end of the file. This may be caused by incorrect parenthesis nesting elsewhere in this file.",
					Subject:  hcl.RangeBetween(name.Range, openTok.Range).Ptr(),
				})
			default:
				diags = append(diags, &hcl.Diagnostic{
					Severity: hcl.DiagError,
					Summary:  "Missing argument separator",
					Detail:   "A comma is required to separate each function argument from the next.",
					Subject:  &sep.Range,
					Context:  hcl.RangeBetween(name.Range, sep.Range).Ptr(),
				})
			}
			closeTok = p.recover(TokenCParen)
			break Token
		}

		if p.Peek().Type == TokenCParen {
			// A trailing comma after the last argument gets us in here.
			closeTok = p.Read() // eat closing paren
			break Token
		}

	}

	p.PopIncludeNewlines()

	return &FunctionCallExpr{
		Name: nameStr,
		Args: args,

		ExpandFinal: expandFinal,

		NameRange:       nameRange,
		OpenParenRange:  openTok.Range,
		CloseParenRange: closeTok.Range,
	}, diags
}

func (p *parser) parseTupleCons() (Expression, hcl.Diagnostics) {
	open := p.Read()
	if open.Type != TokenOBrack {
		// Should never happen if callers are behaving
		panic("parseTupleCons called without peeker pointing to open bracket")
	}

	p.PushIncludeNewlines(false)
	defer p.PopIncludeNewlines()

	if forKeyword.TokenMatches(p.Peek()) {
		return p.finishParsingForExpr(open)
	}

	var close Token

	var diags hcl.Diagnostics
	var exprs []Expression

	for {
		next := p.Peek()
		if next.Type == TokenCBrack {
			close = p.Read() // eat closer
			break
		}

		expr, exprDiags := p.ParseExpression()
		exprs = append(exprs, expr)
		diags = append(diags, exprDiags...)

		if p.recovery && exprDiags.HasErrors() {
			// If expression parsing failed then we are probably in a strange
			// place in the token stream, so we'll bail out and try to reset
			// to after our closing bracket to allow parsing to continue.
			close = p.recover(TokenCBrack)
			break
		}

		next = p.Peek()
		if next.Type == TokenCBrack {
			close = p.Read() // eat closer
			break
		}

		if next.Type != TokenComma {
			if !p.recovery {
				switch next.Type {
				case TokenEOF:
					diags = append(diags, &hcl.Diagnostic{
						Severity: hcl.DiagError,
						Summary:  "Unterminated tuple constructor expression",
						Detail:   "There is no corresponding closing bracket before the end of the file. This may be caused by incorrect bracket nesting elsewhere in this file.",
						Subject:  open.Range.Ptr(),
					})
				default:
					diags = append(diags, &hcl.Diagnostic{
						Severity: hcl.DiagError,
						Summary:  "Missing item separator",
						Detail:   "Expected a comma to mark the beginning of the next item.",
						Subject:  &next.Range,
						Context:  hcl.RangeBetween(open.Range, next.Range).Ptr(),
					})
				}
			}
			close = p.recover(TokenCBrack)
			break
		}

		p.Read() // eat comma

	}

	return &TupleConsExpr{
		Exprs: exprs,

		SrcRange:  hcl.RangeBetween(open.Range, close.Range),
		OpenRange: open.Range,
	}, diags
}

func (p *parser) parseObjectCons() (Expression, hcl.Diagnostics) {
	open := p.Read()
	if open.Type != TokenOBrace {
		// Should never happen if callers are behaving
		panic("parseObjectCons called without peeker pointing to open brace")
	}

	// We must temporarily stop looking at newlines here while we check for
	// a "for" keyword, since for expressions are _not_ newline-sensitive,
	// even though object constructors are.
	p.PushIncludeNewlines(false)
	isFor := forKeyword.TokenMatches(p.Peek())
	p.PopIncludeNewlines()
	if isFor {
		return p.finishParsingForExpr(open)
	}

	p.PushIncludeNewlines(true)
	defer p.PopIncludeNewlines()

	var close Token

	var diags hcl.Diagnostics
	var items []ObjectConsItem

	for {
		next := p.Peek()
		if next.Type == TokenNewline {
			p.Read() // eat newline
			continue
		}

		if next.Type == TokenCBrace {
			close = p.Read() // eat closer
			break
		}

		// Wrapping parens are not explicitly represented in the AST, but
		// we want to use them here to disambiguate intepreting a mapping
		// key as a full expression rather than just a name, and so
		// we'll remember this was present and use it to force the
		// behavior of our final ObjectConsKeyExpr.
		forceNonLiteral := (p.Peek().Type == TokenOParen)

		var key Expression
		var keyDiags hcl.Diagnostics
		key, keyDiags = p.ParseExpression()
		diags = append(diags, keyDiags...)

		if p.recovery && keyDiags.HasErrors() {
			// If expression parsing failed then we are probably in a strange
			// place in the token stream, so we'll bail out and try to reset
			// to after our closing brace to allow parsing to continue.
			close = p.recover(TokenCBrace)
			break
		}

		// We wrap up the key expression in a special wrapper that deals
		// with our special case that naked identifiers as object keys
		// are interpreted as literal strings.
		key = &ObjectConsKeyExpr{
			Wrapped:         key,
			ForceNonLiteral: forceNonLiteral,
		}

		next = p.Peek()
		if next.Type != TokenEqual && next.Type != TokenColon {
			if !p.recovery {
				switch next.Type {
				case TokenNewline, TokenComma:
					diags = append(diags, &hcl.Diagnostic{
						Severity: hcl.DiagError,
						Summary:  "Missing attribute value",
						Detail:   "Expected an attribute value, introduced by an equals sign (\"=\").",
						Subject:  &next.Range,
						Context:  hcl.RangeBetween(open.Range, next.Range).Ptr(),
					})
				case TokenIdent:
					// Although this might just be a plain old missing equals
					// sign before a reference, one way to get here is to try
					// to write an attribute name containing a period followed
					// by a digit, which was valid in HCL1, like this:
					//     foo1.2_bar = "baz"
					// We can't know exactly what the user intended here, but
					// we'll augment our message with an extra hint in this case
					// in case it is helpful.
					diags = append(diags, &hcl.Diagnostic{
						Severity: hcl.DiagError,
						Summary:  "Missing key/value separator",
						Detail:   "Expected an equals sign (\"=\") to mark the beginning of the attribute value. If you intended to given an attribute name containing periods or spaces, write the name in quotes to create a string literal.",
						Subject:  &next.Range,
						Context:  hcl.RangeBetween(open.Range, next.Range).Ptr(),
					})
				case TokenEOF:
					diags = append(diags, &hcl.Diagnostic{
						Severity: hcl.DiagError,
						Summary:  "Unterminated object constructor expression",
						Detail:   "There is no corresponding closing brace before the end of the file. This may be caused by incorrect brace nesting elsewhere in this file.",
						Subject:  open.Range.Ptr(),
					})
				default:
					diags = append(diags, &hcl.Diagnostic{
						Severity: hcl.DiagError,
						Summary:  "Missing key/value separator",
						Detail:   "Expected an equals sign (\"=\") to mark the beginning of the attribute value.",
						Subject:  &next.Range,
						Context:  hcl.RangeBetween(open.Range, next.Range).Ptr(),
					})
				}
			}
			close = p.recover(TokenCBrace)
			break
		}

		p.Read() // eat equals sign or colon

		value, valueDiags := p.ParseExpression()
		diags = append(diags, valueDiags...)

		if p.recovery && valueDiags.HasErrors() {
			// If the value is an ExprSyntaxError, we can add an item with it, even though we will recover afterwards
			// This allows downstream consumers to still retrieve this first invalid item, even though following items
			// won't be parsed. This is useful for supplying completions.
			if exprSyntaxError, ok := value.(*ExprSyntaxError); ok {
				items = append(items, ObjectConsItem{
					KeyExpr:   key,
					ValueExpr: exprSyntaxError,
				})
			}

			// If expression parsing failed then we are probably in a strange
			// place in the token stream, so we'll bail out and try to reset
			// to after our closing brace to allow parsing to continue.
			close = p.recover(TokenCBrace)
			break
		}

		items = append(items, ObjectConsItem{
			KeyExpr:   key,
			ValueExpr: value,
		})

		next = p.Peek()
		if next.Type == TokenCBrace {
			close = p.Read() // eat closer
			break
		}

		if next.Type != TokenComma && next.Type != TokenNewline {
			if !p.recovery {
				switch next.Type {
				case TokenEOF:
					diags = append(diags, &hcl.Diagnostic{
						Severity: hcl.DiagError,
						Summary:  "Unterminated object constructor expression",
						Detail:   "There is no corresponding closing brace before the end of the file. This may be caused by incorrect brace nesting elsewhere in this file.",
						Subject:  open.Range.Ptr(),
					})
				default:
					diags = append(diags, &hcl.Diagnostic{
						Severity: hcl.DiagError,
						Summary:  "Missing attribute separator",
						Detail:   "Expected a newline or comma to mark the beginning of the next attribute.",
						Subject:  &next.Range,
						Context:  hcl.RangeBetween(open.Range, next.Range).Ptr(),
					})
				}
			}
			close = p.recover(TokenCBrace)
			break
		}

		p.Read() // eat comma or newline

	}

	return &ObjectConsExpr{
		Items: items,

		SrcRange:  hcl.RangeBetween(open.Range, close.Range),
		OpenRange: open.Range,
	}, diags
}

func (p *parser) finishParsingForExpr(open Token) (Expression, hcl.Diagnostics) {
	p.PushIncludeNewlines(false)
	defer p.PopIncludeNewlines()
	introducer := p.Read()
	if !forKeyword.TokenMatches(introducer) {
		// Should never happen if callers are behaving
		panic("finishParsingForExpr called without peeker pointing to 'for' identifier")
	}

	var makeObj bool
	var closeType TokenType
	switch open.Type {
	case TokenOBrace:
		makeObj = true
		closeType = TokenCBrace
	case TokenOBrack:
		makeObj = false // making a tuple
		closeType = TokenCBrack
	default:
		// Should never happen if callers are behaving
		panic("finishParsingForExpr called with invalid open token")
	}

	var diags hcl.Diagnostics
	var keyName, valName string

	if p.Peek().Type != TokenIdent {
		if !p.recovery {
			diags = append(diags, &hcl.Diagnostic{
				Severity: hcl.DiagError,
				Summary:  "Invalid 'for' expression",
				Detail:   "For expression requires variable name after 'for'.",
				Subject:  p.Peek().Range.Ptr(),
				Context:  hcl.RangeBetween(open.Range, p.Peek().Range).Ptr(),
			})
		}
		close := p.recover(closeType)
		return &LiteralValueExpr{
			Val:      cty.DynamicVal,
			SrcRange: hcl.RangeBetween(open.Range, close.Range),
		}, diags
	}

	valName = string(p.Read().Bytes)

	if p.Peek().Type == TokenComma {
		// What we just read was actually the key, then.
		keyName = valName
		p.Read() // eat comma

		if p.Peek().Type != TokenIdent {
			if !p.recovery {
				diags = append(diags, &hcl.Diagnostic{
					Severity: hcl.DiagError,
					Summary:  "Invalid 'for' expression",
					Detail:   "For expression requires value variable name after comma.",
					Subject:  p.Peek().Range.Ptr(),
					Context:  hcl.RangeBetween(open.Range, p.Peek().Range).Ptr(),
				})
			}
			close := p.recover(closeType)
			return &LiteralValueExpr{
				Val:      cty.DynamicVal,
				SrcRange: hcl.RangeBetween(open.Range, close.Range),
			}, diags
		}

		valName = string(p.Read().Bytes)
	}

	if !inKeyword.TokenMatches(p.Peek()) {
		if !p.recovery {
			diags = append(diags, &hcl.Diagnostic{
				Severity: hcl.DiagError,
				Summary:  "Invalid 'for' expression",
				Detail:   "For expression requires the 'in' keyword after its name declarations.",
				Subject:  p.Peek().Range.Ptr(),
				Context:  hcl.RangeBetween(open.Range, p.Peek().Range).Ptr(),
			})
		}
		close := p.recover(closeType)
		return &LiteralValueExpr{
			Val:      cty.DynamicVal,
			SrcRange: hcl.RangeBetween(open.Range, close.Range),
		}, diags
	}
	p.Read() // eat 'in' keyword

	collExpr, collDiags := p.ParseExpression()
	diags = append(diags, collDiags...)
	if p.recovery && collDiags.HasErrors() {
		close := p.recover(closeType)
		return &LiteralValueExpr{
			Val:      cty.DynamicVal,
			SrcRange: hcl.RangeBetween(open.Range, close.Range),
		}, diags
	}

	if p.Peek().Type != TokenColon {
		if !p.recovery {
			diags = append(diags, &hcl.Diagnostic{
				Severity: hcl.DiagError,
				Summary:  "Invalid 'for' expression",
				Detail:   "For expression requires a colon after the collection expression.",
				Subject:  p.Peek().Range.Ptr(),
				Context:  hcl.RangeBetween(open.Range, p.Peek().Range).Ptr(),
			})
		}
		close := p.recover(closeType)
		return &LiteralValueExpr{
			Val:      cty.DynamicVal,
			SrcRange: hcl.RangeBetween(open.Range, close.Range),
		}, diags
	}
	p.Read() // eat colon

	var keyExpr, valExpr Expression
	var keyDiags, valDiags hcl.Diagnostics
	valExpr, valDiags = p.ParseExpression()
	if p.Peek().Type == TokenFatArrow {
		// What we just parsed was actually keyExpr
		p.Read() // eat the fat arrow
		keyExpr, keyDiags = valExpr, valDiags

		valExpr, valDiags = p.ParseExpression()
	}
	diags = append(diags, keyDiags...)
	diags = append(diags, valDiags...)
	if p.recovery && (keyDiags.HasErrors() || valDiags.HasErrors()) {
		close := p.recover(closeType)
		return &LiteralValueExpr{
			Val:      cty.DynamicVal,
			SrcRange: hcl.RangeBetween(open.Range, close.Range),
		}, diags
	}

	group := false
	var ellipsis Token
	if p.Peek().Type == TokenEllipsis {
		ellipsis = p.Read()
		group = true
	}

	var condExpr Expression
	var condDiags hcl.Diagnostics
	if ifKeyword.TokenMatches(p.Peek()) {
		p.Read() // eat "if"
		condExpr, condDiags = p.ParseExpression()
		diags = append(diags, condDiags...)
		if p.recovery && condDiags.HasErrors() {
			close := p.recover(p.oppositeBracket(open.Type))
			return &LiteralValueExpr{
				Val:      cty.DynamicVal,
				SrcRange: hcl.RangeBetween(open.Range, close.Range),
			}, diags
		}
	}

	var close Token
	if p.Peek().Type == closeType {
		close = p.Read()
	} else {
		if !p.recovery {
			diags = append(diags, &hcl.Diagnostic{
				Severity: hcl.DiagError,
				Summary:  "Invalid 'for' expression",
				Detail:   "Extra characters after the end of the 'for' expression.",
				Subject:  p.Peek().Range.Ptr(),
				Context:  hcl.RangeBetween(open.Range, p.Peek().Range).Ptr(),
			})
		}
		close = p.recover(closeType)
	}

	if !makeObj {
		if keyExpr != nil {
			diags = append(diags, &hcl.Diagnostic{
				Severity: hcl.DiagError,
				Summary:  "Invalid 'for' expression",
				Detail:   "Key expression is not valid when building a tuple.",
				Subject:  keyExpr.Range().Ptr(),
				Context:  hcl.RangeBetween(open.Range, close.Range).Ptr(),
			})
		}

		if group {
			diags = append(diags, &hcl.Diagnostic{
				Severity: hcl.DiagError,
				Summary:  "Invalid 'for' expression",
				Detail:   "Grouping ellipsis (...) cannot be used when building a tuple.",
				Subject:  &ellipsis.Range,
				Context:  hcl.RangeBetween(open.Range, close.Range).Ptr(),
			})
		}
	} else {
		if keyExpr == nil {
			diags = append(diags, &hcl.Diagnostic{
				Severity: hcl.DiagError,
				Summary:  "Invalid 'for' expression",
				Detail:   "Key expression is required when building an object.",
				Subject:  valExpr.Range().Ptr(),
				Context:  hcl.RangeBetween(open.Range, close.Range).Ptr(),
			})
		}
	}

	return &ForExpr{
		KeyVar:   keyName,
		ValVar:   valName,
		CollExpr: collExpr,
		KeyExpr:  keyExpr,
		ValExpr:  valExpr,
		CondExpr: condExpr,
		Group:    group,

		SrcRange:   hcl.RangeBetween(open.Range, close.Range),
		OpenRange:  open.Range,
		CloseRange: close.Range,
	}, diags
}

// parseQuotedStringLiteral is a helper for parsing quoted strings that
// aren't allowed to contain any interpolations, such as block labels.
func (p *parser) parseQuotedStringLiteral() (string, hcl.Range, hcl.Diagnostics) {
	oQuote := p.Read()
	if oQuote.Type != TokenOQuote {
		return "", oQuote.Range, hcl.Diagnostics{
			{
				Severity: hcl.DiagError,
				Summary:  "Invalid string literal",
				Detail:   "A quoted string is required here.",
				Subject:  &oQuote.Range,
			},
		}
	}

	var diags hcl.Diagnostics
	ret := &bytes.Buffer{}
	var endRange hcl.Range

Token:
	for {
		tok := p.Read()
		switch tok.Type {

		case TokenCQuote:
			endRange = tok.Range
			break Token

		case TokenQuotedLit:
			s, sDiags := ParseStringLiteralToken(tok)
			diags = append(diags, sDiags...)
			ret.WriteString(s)

		case TokenTemplateControl, TokenTemplateInterp:
			which := "$"
			if tok.Type == TokenTemplateControl {
				which = "%"
			}

			diags = append(diags, &hcl.Diagnostic{
				Severity: hcl.DiagError,
				Summary:  "Invalid string literal",
				Detail: fmt.Sprintf(
					"Template sequences are not allowed in this string. To include a literal %q, double it (as \"%s%s\") to escape it.",
					which, which, which,
				),
				Subject: &tok.Range,
				Context: hcl.RangeBetween(oQuote.Range, tok.Range).Ptr(),
			})

			// Now that we're returning an error callers won't attempt to use
			// the result for any real operations, but they might try to use
			// the partial AST for other analyses, so we'll leave a marker
			// to indicate that there was something invalid in the string to
			// help avoid misinterpretation of the partial result
			ret.WriteString(which)
			ret.WriteString("{ ... }")

			p.recover(TokenTemplateSeqEnd) // we'll try to keep parsing after the sequence ends

		case TokenEOF:
			diags = append(diags, &hcl.Diagnostic{
				Severity: hcl.DiagError,
				Summary:  "Unterminated string literal",
				Detail:   "Unable to find the closing quote mark before the end of the file.",
				Subject:  &tok.Range,
				Context:  hcl.RangeBetween(oQuote.Range, tok.Range).Ptr(),
			})
			endRange = tok.Range
			break Token

		default:
			// Should never happen, as long as the scanner is behaving itself
			diags = append(diags, &hcl.Diagnostic{
				Severity: hcl.DiagError,
				Summary:  "Invalid string literal",
				Detail:   "This item is not valid in a string literal.",
				Subject:  &tok.Range,
				Context:  hcl.RangeBetween(oQuote.Range, tok.Range).Ptr(),
			})
			p.recover(TokenCQuote)
			endRange = tok.Range
			break Token

		}

	}

	return ret.String(), hcl.RangeBetween(oQuote.Range, endRange), diags
}

// ParseStringLiteralToken processes the given token, which must be either a
// TokenQuotedLit or a TokenStringLit, returning the string resulting from
// resolving any escape sequences.
//
// If any error diagnostics are returned, the returned string may be incomplete
// or otherwise invalid.
func ParseStringLiteralToken(tok Token) (string, hcl.Diagnostics) {
	var quoted bool
	switch tok.Type {
	case TokenQuotedLit:
		quoted = true
	case TokenStringLit:
		quoted = false
	default:
		panic("ParseStringLiteralToken can only be used with TokenStringLit and TokenQuotedLit tokens")
	}
	var diags hcl.Diagnostics

	ret := make([]byte, 0, len(tok.Bytes))
	slices := scanStringLit(tok.Bytes, quoted)

	// We will mutate rng constantly as we walk through our token slices below.
	// Any diagnostics must take a copy of this rng rather than simply pointing
	// to it, e.g. by using rng.Ptr() rather than &rng.
	rng := tok.Range
	rng.End = rng.Start

Slices:
	for _, slice := range slices {
		if len(slice) == 0 {
			continue
		}

		// Advance the start of our range to where the previous token ended
		rng.Start = rng.End

		// Advance the end of our range to after our token.
		b := slice
		for len(b) > 0 {
			adv, ch, _ := textseg.ScanGraphemeClusters(b, true)
			rng.End.Byte += adv
			switch ch[0] {
			case '\r', '\n':
				rng.End.Line++
				rng.End.Column = 1
			default:
				rng.End.Column++
			}
			b = b[adv:]
		}

	TokenType:
		switch slice[0] {
		case '\\':
			if !quoted {
				// If we're not in quoted mode then just treat this token as
				// normal. (Slices can still start with backslash even if we're
				// not specifically looking for backslash sequences.)
				break TokenType
			}
			if len(slice) < 2 {
				diags = append(diags, &hcl.Diagnostic{
					Severity: hcl.DiagError,
					Summary:  "Invalid escape sequence",
					Detail:   "Backslash must be followed by an escape sequence selector character.",
					Subject:  rng.Ptr(),
				})
				break TokenType
			}

			switch slice[1] {

			case 'n':
				ret = append(ret, '\n')
				continue Slices
			case 'r':
				ret = append(ret, '\r')
				continue Slices
			case 't':
				ret = append(ret, '\t')
				continue Slices
			case '"':
				ret = append(ret, '"')
				continue Slices
			case '\\':
				ret = append(ret, '\\')
				continue Slices
			case 'u', 'U':
				if slice[1] == 'u' && len(slice) != 6 {
					diags = append(diags, &hcl.Diagnostic{
						Severity: hcl.DiagError,
						Summary:  "Invalid escape sequence",
						Detail:   "The \\u escape sequence must be followed by four hexadecimal digits.",
						Subject:  rng.Ptr(),
					})
					break TokenType
				} else if slice[1] == 'U' && len(slice) != 10 {
					diags = append(diags, &hcl.Diagnostic{
						Severity: hcl.DiagError,
						Summary:  "Invalid escape sequence",
						Detail:   "The \\U escape sequence must be followed by eight hexadecimal digits.",
						Subject:  rng.Ptr(),
					})
					break TokenType
				}

				numHex := string(slice[2:])
				num, err := strconv.ParseUint(numHex, 16, 32)
				if err != nil {
					// Should never happen because the scanner won't match
					// a sequence of digits that isn't valid.
					panic(err)
				}

				r := rune(num)
				l := utf8.RuneLen(r)
				if l == -1 {
					diags = append(diags, &hcl.Diagnostic{
						Severity: hcl.DiagError,
						Summary:  "Invalid escape sequence",
						Detail:   fmt.Sprintf("Cannot encode character U+%04x in UTF-8.", num),
						Subject:  rng.Ptr(),
					})
					break TokenType
				}
				for i := 0; i < l; i++ {
					ret = append(ret, 0)
				}
				rb := ret[len(ret)-l:]
				utf8.EncodeRune(rb, r)

				continue Slices

			default:
				diags = append(diags, &hcl.Diagnostic{
					Severity: hcl.DiagError,
					Summary:  "Invalid escape sequence",
					Detail:   fmt.Sprintf("The symbol %q is not a valid escape sequence selector.", slice[1:]),
					Subject:  rng.Ptr(),
				})
				ret = append(ret, slice[1:]...)
				continue Slices
			}

		case '$', '%':
			if len(slice) != 3 {
				// Not long enough to be our escape sequence, so it's literal.
				break TokenType
			}

			if slice[1] == slice[0] && slice[2] == '{' {
				ret = append(ret, slice[0])
				ret = append(ret, '{')
				continue Slices
			}

			break TokenType
		}

		// If we fall out here or break out of here from the switch above
		// then this slice is just a literal.
		ret = append(ret, slice...)
	}

	return string(ret), diags
}

// setRecovery turns on recovery mode without actually doing any recovery.
// This can be used when a parser knowingly leaves the peeker in a useless
// place and wants to suppress errors that might result from that decision.
func (p *parser) setRecovery() {
	p.recovery = true
}

// recover seeks forward in the token stream until it finds TokenType "end",
// then returns with the peeker pointed at the following token.
//
// If the given token type is a bracketer, this function will additionally
// count nested instances of the brackets to try to leave the peeker at
// the end of the _current_ instance of that bracketer, skipping over any
// nested instances. This is a best-effort operation and may have
// unpredictable results on input with bad bracketer nesting.
func (p *parser) recover(end TokenType) Token {
	start := p.oppositeBracket(end)
	p.recovery = true

	nest := 0
	for {
		tok := p.Read()
		ty := tok.Type
		if end == TokenTemplateSeqEnd && ty == TokenTemplateControl {
			// normalize so that our matching behavior can work, since
			// TokenTemplateControl/TokenTemplateInterp are asymmetrical
			// with TokenTemplateSeqEnd and thus we need to count both
			// openers if that's the closer we're looking for.
			ty = TokenTemplateInterp
		}

		switch ty {
		case start:
			nest++
		case end:
			if nest < 1 {
				return tok
			}

			nest--
		case TokenEOF:
			return tok
		}
	}
}

// recoverOver seeks forward in the token stream until it finds a block
// starting with TokenType "start", then finds the corresponding end token,
// leaving the peeker pointed at the token after that end token.
//
// The given token type _must_ be a bracketer. For example, if the given
// start token is TokenOBrace then the parser will be left at the _end_ of
// the next brace-delimited block encountered, or at EOF if no such block
// is found or it is unclosed.
func (p *parser) recoverOver(start TokenType) {
	end := p.oppositeBracket(start)

	// find the opening bracket first
Token:
	for {
		tok := p.Read()
		switch tok.Type {
		case start, TokenEOF:
			break Token
		}
	}

	// Now use our existing recover function to locate the _end_ of the
	// container we've found.
	p.recover(end)
}

func (p *parser) recoverAfterBodyItem() {
	p.recovery = true
	var open []TokenType

Token:
	for {
		tok := p.Read()

		switch tok.Type {

		case TokenNewline:
			if len(open) == 0 {
				break Token
			}

		case TokenEOF:
			break Token

		case TokenOBrace, TokenOBrack, TokenOParen, TokenOQuote, TokenOHeredoc, TokenTemplateInterp, TokenTemplateControl:
			open = append(open, tok.Type)

		case TokenCBrace, TokenCBrack, TokenCParen, TokenCQuote, TokenCHeredoc:
			opener := p.oppositeBracket(tok.Type)
			for len(open) > 0 && open[len(open)-1] != opener {
				open = open[:len(open)-1]
			}
			if len(open) > 0 {
				open = open[:len(open)-1]
			}

		case TokenTemplateSeqEnd:
			for len(open) > 0 && open[len(open)-1] != TokenTemplateInterp && open[len(open)-1] != TokenTemplateControl {
				open = open[:len(open)-1]
			}
			if len(open) > 0 {
				open = open[:len(open)-1]
			}

		}
	}
}

// oppositeBracket finds the bracket that opposes the given bracketer, or
// NilToken if the given token isn't a bracketer.
//
// "Bracketer", for the sake of this function, is one end of a matching
// open/close set of tokens that establish a bracketing context.
func (p *parser) oppositeBracket(ty TokenType) TokenType {
	switch ty {

	case TokenOBrace:
		return TokenCBrace
	case TokenOBrack:
		return TokenCBrack
	case TokenOParen:
		return TokenCParen
	case TokenOQuote:
		return TokenCQuote
	case TokenOHeredoc:
		return TokenCHeredoc

	case TokenCBrace:
		return TokenOBrace
	case TokenCBrack:
		return TokenOBrack
	case TokenCParen:
		return TokenOParen
	case TokenCQuote:
		return TokenOQuote
	case TokenCHeredoc:
		return TokenOHeredoc

	case TokenTemplateControl:
		return TokenTemplateSeqEnd
	case TokenTemplateInterp:
		return TokenTemplateSeqEnd
	case TokenTemplateSeqEnd:
		// This is ambigous, but we return Interp here because that's
		// what's assumed by the "recover" method.
		return TokenTemplateInterp

	default:
		return TokenNil
	}
}

func errPlaceholderExpr(rng hcl.Range) Expression {
	return &LiteralValueExpr{
		Val:      cty.DynamicVal,
		SrcRange: rng,
	}
}
