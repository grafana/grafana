// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package hclsyntax

import (
	"fmt"
	"strings"
	"unicode"

	"github.com/apparentlymart/go-textseg/v15/textseg"
	"github.com/hashicorp/hcl/v2"
	"github.com/zclconf/go-cty/cty"
)

func (p *parser) ParseTemplate() (Expression, hcl.Diagnostics) {
	return p.parseTemplate(TokenEOF, false)
}

func (p *parser) parseTemplate(end TokenType, flushHeredoc bool) (Expression, hcl.Diagnostics) {
	exprs, passthru, rng, diags := p.parseTemplateInner(end, flushHeredoc)

	if passthru {
		if len(exprs) != 1 {
			panic("passthru set with len(exprs) != 1")
		}
		return &TemplateWrapExpr{
			Wrapped:  exprs[0],
			SrcRange: rng,
		}, diags
	}

	return &TemplateExpr{
		Parts:    exprs,
		SrcRange: rng,
	}, diags
}

func (p *parser) parseTemplateInner(end TokenType, flushHeredoc bool) ([]Expression, bool, hcl.Range, hcl.Diagnostics) {
	parts, diags := p.parseTemplateParts(end)
	if flushHeredoc {
		flushHeredocTemplateParts(parts) // Trim off leading spaces on lines per the flush heredoc spec
	}
	meldConsecutiveStringLiterals(parts)
	tp := templateParser{
		Tokens:   parts.Tokens,
		SrcRange: parts.SrcRange,
	}
	exprs, exprsDiags := tp.parseRoot()
	diags = append(diags, exprsDiags...)

	passthru := false
	if len(parts.Tokens) == 2 { // one real token and one synthetic "end" token
		if _, isInterp := parts.Tokens[0].(*templateInterpToken); isInterp {
			passthru = true
		}
	}

	return exprs, passthru, parts.SrcRange, diags
}

type templateParser struct {
	Tokens   []templateToken
	SrcRange hcl.Range

	pos int
}

func (p *templateParser) parseRoot() ([]Expression, hcl.Diagnostics) {
	var exprs []Expression
	var diags hcl.Diagnostics

	for {
		next := p.Peek()
		if _, isEnd := next.(*templateEndToken); isEnd {
			break
		}

		expr, exprDiags := p.parseExpr()
		diags = append(diags, exprDiags...)
		exprs = append(exprs, expr)
	}

	return exprs, diags
}

func (p *templateParser) parseExpr() (Expression, hcl.Diagnostics) {
	next := p.Peek()
	switch tok := next.(type) {

	case *templateLiteralToken:
		p.Read() // eat literal
		return &LiteralValueExpr{
			Val:      cty.StringVal(tok.Val),
			SrcRange: tok.SrcRange,
		}, nil

	case *templateInterpToken:
		p.Read() // eat interp
		return tok.Expr, nil

	case *templateIfToken:
		return p.parseIf()

	case *templateForToken:
		return p.parseFor()

	case *templateEndToken:
		p.Read() // eat erroneous token
		return errPlaceholderExpr(tok.SrcRange), hcl.Diagnostics{
			{
				// This is a particularly unhelpful diagnostic, so callers
				// should attempt to pre-empt it and produce a more helpful
				// diagnostic that is context-aware.
				Severity: hcl.DiagError,
				Summary:  "Unexpected end of template",
				Detail:   "The control directives within this template are unbalanced.",
				Subject:  &tok.SrcRange,
			},
		}

	case *templateEndCtrlToken:
		p.Read() // eat erroneous token
		return errPlaceholderExpr(tok.SrcRange), hcl.Diagnostics{
			{
				Severity: hcl.DiagError,
				Summary:  fmt.Sprintf("Unexpected %s directive", tok.Name()),
				Detail:   "The control directives within this template are unbalanced.",
				Subject:  &tok.SrcRange,
			},
		}

	default:
		// should never happen, because above should be exhaustive
		panic(fmt.Sprintf("unhandled template token type %T", next))
	}
}

func (p *templateParser) parseIf() (Expression, hcl.Diagnostics) {
	open := p.Read()
	openIf, isIf := open.(*templateIfToken)
	if !isIf {
		// should never happen if caller is behaving
		panic("parseIf called with peeker not pointing at if token")
	}

	var ifExprs, elseExprs []Expression
	var diags hcl.Diagnostics
	var endifRange hcl.Range

	currentExprs := &ifExprs
Token:
	for {
		next := p.Peek()
		if end, isEnd := next.(*templateEndToken); isEnd {
			diags = append(diags, &hcl.Diagnostic{
				Severity: hcl.DiagError,
				Summary:  "Unexpected end of template",
				Detail: fmt.Sprintf(
					"The if directive at %s is missing its corresponding endif directive.",
					openIf.SrcRange,
				),
				Subject: &end.SrcRange,
			})
			return errPlaceholderExpr(end.SrcRange), diags
		}
		if end, isCtrlEnd := next.(*templateEndCtrlToken); isCtrlEnd {
			p.Read() // eat end directive

			switch end.Type {

			case templateElse:
				if currentExprs == &ifExprs {
					currentExprs = &elseExprs
					continue Token
				}

				diags = append(diags, &hcl.Diagnostic{
					Severity: hcl.DiagError,
					Summary:  "Unexpected else directive",
					Detail: fmt.Sprintf(
						"Already in the else clause for the if started at %s.",
						openIf.SrcRange,
					),
					Subject: &end.SrcRange,
				})

			case templateEndIf:
				endifRange = end.SrcRange
				break Token

			default:
				diags = append(diags, &hcl.Diagnostic{
					Severity: hcl.DiagError,
					Summary:  fmt.Sprintf("Unexpected %s directive", end.Name()),
					Detail: fmt.Sprintf(
						"Expecting an endif directive for the if started at %s.",
						openIf.SrcRange,
					),
					Subject: &end.SrcRange,
				})
			}

			return errPlaceholderExpr(end.SrcRange), diags
		}

		expr, exprDiags := p.parseExpr()
		diags = append(diags, exprDiags...)
		*currentExprs = append(*currentExprs, expr)
	}

	if len(ifExprs) == 0 {
		ifExprs = append(ifExprs, &LiteralValueExpr{
			Val: cty.StringVal(""),
			SrcRange: hcl.Range{
				Filename: openIf.SrcRange.Filename,
				Start:    openIf.SrcRange.End,
				End:      openIf.SrcRange.End,
			},
		})
	}
	if len(elseExprs) == 0 {
		elseExprs = append(elseExprs, &LiteralValueExpr{
			Val: cty.StringVal(""),
			SrcRange: hcl.Range{
				Filename: endifRange.Filename,
				Start:    endifRange.Start,
				End:      endifRange.Start,
			},
		})
	}

	trueExpr := &TemplateExpr{
		Parts:    ifExprs,
		SrcRange: hcl.RangeBetween(ifExprs[0].Range(), ifExprs[len(ifExprs)-1].Range()),
	}
	falseExpr := &TemplateExpr{
		Parts:    elseExprs,
		SrcRange: hcl.RangeBetween(elseExprs[0].Range(), elseExprs[len(elseExprs)-1].Range()),
	}

	return &ConditionalExpr{
		Condition:   openIf.CondExpr,
		TrueResult:  trueExpr,
		FalseResult: falseExpr,

		SrcRange: hcl.RangeBetween(openIf.SrcRange, endifRange),
	}, diags
}

func (p *templateParser) parseFor() (Expression, hcl.Diagnostics) {
	open := p.Read()
	openFor, isFor := open.(*templateForToken)
	if !isFor {
		// should never happen if caller is behaving
		panic("parseFor called with peeker not pointing at for token")
	}

	var contentExprs []Expression
	var diags hcl.Diagnostics
	var endforRange hcl.Range

Token:
	for {
		next := p.Peek()
		if end, isEnd := next.(*templateEndToken); isEnd {
			diags = append(diags, &hcl.Diagnostic{
				Severity: hcl.DiagError,
				Summary:  "Unexpected end of template",
				Detail: fmt.Sprintf(
					"The for directive at %s is missing its corresponding endfor directive.",
					openFor.SrcRange,
				),
				Subject: &end.SrcRange,
			})
			return errPlaceholderExpr(end.SrcRange), diags
		}
		if end, isCtrlEnd := next.(*templateEndCtrlToken); isCtrlEnd {
			p.Read() // eat end directive

			switch end.Type {

			case templateElse:
				diags = append(diags, &hcl.Diagnostic{
					Severity: hcl.DiagError,
					Summary:  "Unexpected else directive",
					Detail:   "An else clause is not expected for a for directive.",
					Subject:  &end.SrcRange,
				})

			case templateEndFor:
				endforRange = end.SrcRange
				break Token

			default:
				diags = append(diags, &hcl.Diagnostic{
					Severity: hcl.DiagError,
					Summary:  fmt.Sprintf("Unexpected %s directive", end.Name()),
					Detail: fmt.Sprintf(
						"Expecting an endfor directive corresponding to the for directive at %s.",
						openFor.SrcRange,
					),
					Subject: &end.SrcRange,
				})
			}

			return errPlaceholderExpr(end.SrcRange), diags
		}

		expr, exprDiags := p.parseExpr()
		diags = append(diags, exprDiags...)
		contentExprs = append(contentExprs, expr)
	}

	if len(contentExprs) == 0 {
		contentExprs = append(contentExprs, &LiteralValueExpr{
			Val: cty.StringVal(""),
			SrcRange: hcl.Range{
				Filename: openFor.SrcRange.Filename,
				Start:    openFor.SrcRange.End,
				End:      openFor.SrcRange.End,
			},
		})
	}

	contentExpr := &TemplateExpr{
		Parts:    contentExprs,
		SrcRange: hcl.RangeBetween(contentExprs[0].Range(), contentExprs[len(contentExprs)-1].Range()),
	}

	forExpr := &ForExpr{
		KeyVar: openFor.KeyVar,
		ValVar: openFor.ValVar,

		CollExpr: openFor.CollExpr,
		ValExpr:  contentExpr,

		SrcRange:   hcl.RangeBetween(openFor.SrcRange, endforRange),
		OpenRange:  openFor.SrcRange,
		CloseRange: endforRange,
	}

	return &TemplateJoinExpr{
		Tuple: forExpr,
	}, diags
}

func (p *templateParser) Peek() templateToken {
	return p.Tokens[p.pos]
}

func (p *templateParser) Read() templateToken {
	ret := p.Peek()
	if _, end := ret.(*templateEndToken); !end {
		p.pos++
	}
	return ret
}

// parseTemplateParts produces a flat sequence of "template tokens", which are
// either literal values (with any "trimming" already applied), interpolation
// sequences, or control flow markers.
//
// A further pass is required on the result to turn it into an AST.
func (p *parser) parseTemplateParts(end TokenType) (*templateParts, hcl.Diagnostics) {
	var parts []templateToken
	var diags hcl.Diagnostics

	startRange := p.NextRange()
	ltrimNext := false
	nextCanTrimPrev := false
	var endRange hcl.Range

Token:
	for {
		next := p.Read()
		if next.Type == end {
			// all done!
			endRange = next.Range
			break
		}

		ltrim := ltrimNext
		ltrimNext = false
		canTrimPrev := nextCanTrimPrev
		nextCanTrimPrev = false

		switch next.Type {
		case TokenStringLit, TokenQuotedLit:
			str, strDiags := ParseStringLiteralToken(next)
			diags = append(diags, strDiags...)

			if ltrim {
				str = strings.TrimLeftFunc(str, unicode.IsSpace)
			}

			parts = append(parts, &templateLiteralToken{
				Val:      str,
				SrcRange: next.Range,
			})
			nextCanTrimPrev = true

		case TokenTemplateInterp:
			// if the opener is ${~ then we want to eat any trailing whitespace
			// in the preceding literal token, assuming it is indeed a literal
			// token.
			if canTrimPrev && len(next.Bytes) == 3 && next.Bytes[2] == '~' && len(parts) > 0 {
				prevExpr := parts[len(parts)-1]
				if lexpr, ok := prevExpr.(*templateLiteralToken); ok {
					lexpr.Val = strings.TrimRightFunc(lexpr.Val, unicode.IsSpace)
				}
			}

			p.PushIncludeNewlines(false)
			expr, exprDiags := p.ParseExpression()
			diags = append(diags, exprDiags...)
			close := p.Peek()
			if close.Type != TokenTemplateSeqEnd {
				if !p.recovery {
					switch close.Type {
					case TokenEOF:
						diags = append(diags, &hcl.Diagnostic{
							Severity: hcl.DiagError,
							Summary:  "Unclosed template interpolation sequence",
							Detail:   "There is no closing brace for this interpolation sequence before the end of the file. This might be caused by incorrect nesting inside the given expression.",
							Subject:  &startRange,
						})
					case TokenColon:
						diags = append(diags, &hcl.Diagnostic{
							Severity: hcl.DiagError,
							Summary:  "Extra characters after interpolation expression",
							Detail:   "Template interpolation doesn't expect a colon at this location. Did you intend this to be a literal sequence to be processed as part of another language? If so, you can escape it by starting with \"$${\" instead of just \"${\".",
							Subject:  &close.Range,
							Context:  hcl.RangeBetween(startRange, close.Range).Ptr(),
						})
					default:
						if (close.Type == TokenCQuote || close.Type == TokenOQuote) && end == TokenCQuote {
							// We'll get here if we're processing a _quoted_
							// template and we find an errant quote inside an
							// interpolation sequence, which suggests that
							// the interpolation sequence is missing its terminator.
							diags = append(diags, &hcl.Diagnostic{
								Severity: hcl.DiagError,
								Summary:  "Unclosed template interpolation sequence",
								Detail:   "There is no closing brace for this interpolation sequence before the end of the quoted template. This might be caused by incorrect nesting inside the given expression.",
								Subject:  &startRange,
							})
						} else {
							diags = append(diags, &hcl.Diagnostic{
								Severity: hcl.DiagError,
								Summary:  "Extra characters after interpolation expression",
								Detail:   "Expected a closing brace to end the interpolation expression, but found extra characters.\n\nThis can happen when you include interpolation syntax for another language, such as shell scripting, but forget to escape the interpolation start token. If this is an embedded sequence for another language, escape it by starting with \"$${\" instead of just \"${\".",
								Subject:  &close.Range,
								Context:  hcl.RangeBetween(startRange, close.Range).Ptr(),
							})
						}
					}
				}
				p.recover(TokenTemplateSeqEnd)
			} else {
				p.Read() // eat closing brace

				// If the closer is ~} then we want to eat any leading
				// whitespace on the next token, if it turns out to be a
				// literal token.
				if len(close.Bytes) == 2 && close.Bytes[0] == '~' {
					ltrimNext = true
				}
			}
			p.PopIncludeNewlines()
			parts = append(parts, &templateInterpToken{
				Expr:     expr,
				SrcRange: hcl.RangeBetween(next.Range, close.Range),
			})

		case TokenTemplateControl:
			// if the opener is %{~ then we want to eat any trailing whitespace
			// in the preceding literal token, assuming it is indeed a literal
			// token.
			if canTrimPrev && len(next.Bytes) == 3 && next.Bytes[2] == '~' && len(parts) > 0 {
				prevExpr := parts[len(parts)-1]
				if lexpr, ok := prevExpr.(*templateLiteralToken); ok {
					lexpr.Val = strings.TrimRightFunc(lexpr.Val, unicode.IsSpace)
				}
			}
			p.PushIncludeNewlines(false)

			kw := p.Peek()
			if kw.Type != TokenIdent {
				if !p.recovery {
					diags = append(diags, &hcl.Diagnostic{
						Severity: hcl.DiagError,
						Summary:  "Invalid template directive",
						Detail:   "A template directive keyword (\"if\", \"for\", etc) is expected at the beginning of a %{ sequence.",
						Subject:  &kw.Range,
						Context:  hcl.RangeBetween(next.Range, kw.Range).Ptr(),
					})
				}
				p.recover(TokenTemplateSeqEnd)
				p.PopIncludeNewlines()
				continue Token
			}
			p.Read() // eat keyword token

			switch {

			case ifKeyword.TokenMatches(kw):
				condExpr, exprDiags := p.ParseExpression()
				diags = append(diags, exprDiags...)
				parts = append(parts, &templateIfToken{
					CondExpr: condExpr,
					SrcRange: hcl.RangeBetween(next.Range, p.NextRange()),
				})

			case elseKeyword.TokenMatches(kw):
				parts = append(parts, &templateEndCtrlToken{
					Type:     templateElse,
					SrcRange: hcl.RangeBetween(next.Range, p.NextRange()),
				})

			case endifKeyword.TokenMatches(kw):
				parts = append(parts, &templateEndCtrlToken{
					Type:     templateEndIf,
					SrcRange: hcl.RangeBetween(next.Range, p.NextRange()),
				})

			case forKeyword.TokenMatches(kw):
				var keyName, valName string
				if p.Peek().Type != TokenIdent {
					if !p.recovery {
						diags = append(diags, &hcl.Diagnostic{
							Severity: hcl.DiagError,
							Summary:  "Invalid 'for' directive",
							Detail:   "For directive requires variable name after 'for'.",
							Subject:  p.Peek().Range.Ptr(),
						})
					}
					p.recover(TokenTemplateSeqEnd)
					p.PopIncludeNewlines()
					continue Token
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
								Summary:  "Invalid 'for' directive",
								Detail:   "For directive requires value variable name after comma.",
								Subject:  p.Peek().Range.Ptr(),
							})
						}
						p.recover(TokenTemplateSeqEnd)
						p.PopIncludeNewlines()
						continue Token
					}

					valName = string(p.Read().Bytes)
				}

				if !inKeyword.TokenMatches(p.Peek()) {
					if !p.recovery {
						diags = append(diags, &hcl.Diagnostic{
							Severity: hcl.DiagError,
							Summary:  "Invalid 'for' directive",
							Detail:   "For directive requires 'in' keyword after names.",
							Subject:  p.Peek().Range.Ptr(),
						})
					}
					p.recover(TokenTemplateSeqEnd)
					p.PopIncludeNewlines()
					continue Token
				}
				p.Read() // eat 'in' keyword

				collExpr, collDiags := p.ParseExpression()
				diags = append(diags, collDiags...)
				parts = append(parts, &templateForToken{
					KeyVar:   keyName,
					ValVar:   valName,
					CollExpr: collExpr,

					SrcRange: hcl.RangeBetween(next.Range, p.NextRange()),
				})

			case endforKeyword.TokenMatches(kw):
				parts = append(parts, &templateEndCtrlToken{
					Type:     templateEndFor,
					SrcRange: hcl.RangeBetween(next.Range, p.NextRange()),
				})

			default:
				if !p.recovery {
					suggestions := []string{"if", "for", "else", "endif", "endfor"}
					given := string(kw.Bytes)
					suggestion := nameSuggestion(given, suggestions)
					if suggestion != "" {
						suggestion = fmt.Sprintf(" Did you mean %q?", suggestion)
					}

					diags = append(diags, &hcl.Diagnostic{
						Severity: hcl.DiagError,
						Summary:  "Invalid template control keyword",
						Detail:   fmt.Sprintf("%q is not a valid template control keyword.%s", given, suggestion),
						Subject:  &kw.Range,
						Context:  hcl.RangeBetween(next.Range, kw.Range).Ptr(),
					})
				}
				p.recover(TokenTemplateSeqEnd)
				p.PopIncludeNewlines()
				continue Token

			}

			close := p.Peek()
			if close.Type != TokenTemplateSeqEnd {
				if !p.recovery {
					diags = append(diags, &hcl.Diagnostic{
						Severity: hcl.DiagError,
						Summary:  fmt.Sprintf("Extra characters in %s marker", kw.Bytes),
						Detail:   "Expected a closing brace to end the sequence, but found extra characters.",
						Subject:  &close.Range,
						Context:  hcl.RangeBetween(startRange, close.Range).Ptr(),
					})
				}
				p.recover(TokenTemplateSeqEnd)
			} else {
				p.Read() // eat closing brace

				// If the closer is ~} then we want to eat any leading
				// whitespace on the next token, if it turns out to be a
				// literal token.
				if len(close.Bytes) == 2 && close.Bytes[0] == '~' {
					ltrimNext = true
				}
			}
			p.PopIncludeNewlines()

		default:
			if !p.recovery {
				diags = append(diags, &hcl.Diagnostic{
					Severity: hcl.DiagError,
					Summary:  "Unterminated template string",
					Detail:   "No closing marker was found for the string.",
					Subject:  &next.Range,
					Context:  hcl.RangeBetween(startRange, next.Range).Ptr(),
				})
			}
			final := p.recover(end)
			endRange = final.Range
			break Token
		}
	}

	if len(parts) == 0 {
		// If a sequence has no content, we'll treat it as if it had an
		// empty string in it because that's what the user probably means
		// if they write "" in configuration.
		parts = append(parts, &templateLiteralToken{
			Val: "",
			SrcRange: hcl.Range{
				// Range is the zero-character span immediately after the
				// opening quote.
				Filename: startRange.Filename,
				Start:    startRange.End,
				End:      startRange.End,
			},
		})
	}

	// Always end with an end token, so the parser can produce diagnostics
	// about unclosed items with proper position information.
	parts = append(parts, &templateEndToken{
		SrcRange: endRange,
	})

	ret := &templateParts{
		Tokens:   parts,
		SrcRange: hcl.RangeBetween(startRange, endRange),
	}

	return ret, diags
}

// flushHeredocTemplateParts modifies in-place the line-leading literal strings
// to apply the flush heredoc processing rule: find the line with the smallest
// number of whitespace characters as prefix and then trim that number of
// characters from all of the lines.
//
// This rule is applied to static tokens rather than to the rendered result,
// so interpolating a string with leading whitespace cannot affect the chosen
// prefix length.
func flushHeredocTemplateParts(parts *templateParts) {
	if len(parts.Tokens) == 0 {
		// Nothing to do
		return
	}

	const maxInt = int((^uint(0)) >> 1)

	minSpaces := maxInt
	newline := true
	var adjust []*templateLiteralToken
	for _, ttok := range parts.Tokens {
		if newline {
			newline = false
			var spaces int
			if lit, ok := ttok.(*templateLiteralToken); ok {
				orig := lit.Val
				trimmed := strings.TrimLeftFunc(orig, unicode.IsSpace)
				// If a token is entirely spaces and ends with a newline
				// then it's a "blank line" and thus not considered for
				// space-prefix-counting purposes.
				if len(trimmed) == 0 && strings.HasSuffix(orig, "\n") {
					spaces = maxInt
				} else {
					spaceBytes := len(lit.Val) - len(trimmed)
					spaces, _ = textseg.TokenCount([]byte(orig[:spaceBytes]), textseg.ScanGraphemeClusters)
					adjust = append(adjust, lit)
				}
			} else if _, ok := ttok.(*templateEndToken); ok {
				break // don't process the end token since it never has spaces before it
			}
			if spaces < minSpaces {
				minSpaces = spaces
			}
		}
		if lit, ok := ttok.(*templateLiteralToken); ok {
			if strings.HasSuffix(lit.Val, "\n") {
				newline = true // The following token, if any, begins a new line
			}
		}
	}

	for _, lit := range adjust {
		// Since we want to count space _characters_ rather than space _bytes_,
		// we can't just do a straightforward slice operation here and instead
		// need to hunt for the split point with a scanner.
		valBytes := []byte(lit.Val)
		spaceByteCount := 0
		for i := 0; i < minSpaces; i++ {
			adv, _, _ := textseg.ScanGraphemeClusters(valBytes, true)
			spaceByteCount += adv
			valBytes = valBytes[adv:]
		}
		lit.Val = lit.Val[spaceByteCount:]
		lit.SrcRange.Start.Column += minSpaces
		lit.SrcRange.Start.Byte += spaceByteCount
	}
}

// meldConsecutiveStringLiterals simplifies the AST output by combining a
// sequence of string literal tokens into a single string literal. This must be
// performed after any whitespace trimming operations.
func meldConsecutiveStringLiterals(parts *templateParts) {
	if len(parts.Tokens) == 0 {
		return
	}

	// Loop over all tokens starting at the second element, as we want to join
	// pairs of consecutive string literals.
	i := 1
	for i < len(parts.Tokens) {
		if prevLiteral, ok := parts.Tokens[i-1].(*templateLiteralToken); ok {
			if literal, ok := parts.Tokens[i].(*templateLiteralToken); ok {
				// The current and previous tokens are both literals: combine
				prevLiteral.Val = prevLiteral.Val + literal.Val
				prevLiteral.SrcRange.End = literal.SrcRange.End

				// Remove the current token from the slice
				parts.Tokens = append(parts.Tokens[:i], parts.Tokens[i+1:]...)

				// Continue without moving forward in the slice
				continue
			}
		}

		// Try the next pair of tokens
		i++
	}
}

type templateParts struct {
	Tokens   []templateToken
	SrcRange hcl.Range
}

// templateToken is a higher-level token that represents a single atom within
// the template language. Our template parsing first raises the raw token
// stream to a sequence of templateToken, and then transforms the result into
// an expression tree.
type templateToken interface {
	templateToken() templateToken
}

type templateLiteralToken struct {
	Val      string
	SrcRange hcl.Range
	isTemplateToken
}

type templateInterpToken struct {
	Expr     Expression
	SrcRange hcl.Range
	isTemplateToken
}

type templateIfToken struct {
	CondExpr Expression
	SrcRange hcl.Range
	isTemplateToken
}

type templateForToken struct {
	KeyVar   string // empty if ignoring key
	ValVar   string
	CollExpr Expression
	SrcRange hcl.Range
	isTemplateToken
}

type templateEndCtrlType int

const (
	templateEndIf templateEndCtrlType = iota
	templateElse
	templateEndFor
)

type templateEndCtrlToken struct {
	Type     templateEndCtrlType
	SrcRange hcl.Range
	isTemplateToken
}

func (t *templateEndCtrlToken) Name() string {
	switch t.Type {
	case templateEndIf:
		return "endif"
	case templateElse:
		return "else"
	case templateEndFor:
		return "endfor"
	default:
		// should never happen
		panic("invalid templateEndCtrlType")
	}
}

type templateEndToken struct {
	SrcRange hcl.Range
	isTemplateToken
}

type isTemplateToken [0]int

func (t isTemplateToken) templateToken() templateToken {
	return t
}
