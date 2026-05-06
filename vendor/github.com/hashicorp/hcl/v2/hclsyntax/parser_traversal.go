// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package hclsyntax

import (
	"github.com/hashicorp/hcl/v2"
	"github.com/zclconf/go-cty/cty"
)

// ParseTraversalAbs parses an absolute traversal that is assumed to consume
// all of the remaining tokens in the peeker. The usual parser recovery
// behavior is not supported here because traversals are not expected to
// be parsed as part of a larger program.
func (p *parser) ParseTraversalAbs() (hcl.Traversal, hcl.Diagnostics) {
	var ret hcl.Traversal
	var diags hcl.Diagnostics

	// Absolute traversal must always begin with a variable name
	varTok := p.Read()
	if varTok.Type != TokenIdent {
		diags = append(diags, &hcl.Diagnostic{
			Severity: hcl.DiagError,
			Summary:  "Variable name required",
			Detail:   "Must begin with a variable name.",
			Subject:  &varTok.Range,
		})
		return ret, diags
	}

	varName := string(varTok.Bytes)
	ret = append(ret, hcl.TraverseRoot{
		Name:     varName,
		SrcRange: varTok.Range,
	})

	for {
		next := p.Peek()

		if next.Type == TokenEOF {
			return ret, diags
		}

		switch next.Type {
		case TokenDot:
			// Attribute access
			dot := p.Read() // eat dot
			nameTok := p.Read()
			if nameTok.Type != TokenIdent {
				if nameTok.Type == TokenStar {
					diags = append(diags, &hcl.Diagnostic{
						Severity: hcl.DiagError,
						Summary:  "Attribute name required",
						Detail:   "Splat expressions (.*) may not be used here.",
						Subject:  &nameTok.Range,
						Context:  hcl.RangeBetween(varTok.Range, nameTok.Range).Ptr(),
					})
				} else {
					diags = append(diags, &hcl.Diagnostic{
						Severity: hcl.DiagError,
						Summary:  "Attribute name required",
						Detail:   "Dot must be followed by attribute name.",
						Subject:  &nameTok.Range,
						Context:  hcl.RangeBetween(varTok.Range, nameTok.Range).Ptr(),
					})
				}
				return ret, diags
			}

			attrName := string(nameTok.Bytes)
			ret = append(ret, hcl.TraverseAttr{
				Name:     attrName,
				SrcRange: hcl.RangeBetween(dot.Range, nameTok.Range),
			})
		case TokenOBrack:
			// Index
			open := p.Read() // eat open bracket
			next := p.Peek()

			switch next.Type {
			case TokenNumberLit:
				tok := p.Read() // eat number
				numVal, numDiags := p.numberLitValue(tok)
				diags = append(diags, numDiags...)

				close := p.Read()
				if close.Type != TokenCBrack {
					diags = append(diags, &hcl.Diagnostic{
						Severity: hcl.DiagError,
						Summary:  "Unclosed index brackets",
						Detail:   "Index key must be followed by a closing bracket.",
						Subject:  &close.Range,
						Context:  hcl.RangeBetween(open.Range, close.Range).Ptr(),
					})
				}

				ret = append(ret, hcl.TraverseIndex{
					Key:      numVal,
					SrcRange: hcl.RangeBetween(open.Range, close.Range),
				})

				if diags.HasErrors() {
					return ret, diags
				}

			case TokenOQuote:
				str, _, strDiags := p.parseQuotedStringLiteral()
				diags = append(diags, strDiags...)

				close := p.Read()
				if close.Type != TokenCBrack {
					diags = append(diags, &hcl.Diagnostic{
						Severity: hcl.DiagError,
						Summary:  "Unclosed index brackets",
						Detail:   "Index key must be followed by a closing bracket.",
						Subject:  &close.Range,
						Context:  hcl.RangeBetween(open.Range, close.Range).Ptr(),
					})
				}

				ret = append(ret, hcl.TraverseIndex{
					Key:      cty.StringVal(str),
					SrcRange: hcl.RangeBetween(open.Range, close.Range),
				})

				if diags.HasErrors() {
					return ret, diags
				}

			default:
				if next.Type == TokenStar {
					diags = append(diags, &hcl.Diagnostic{
						Severity: hcl.DiagError,
						Summary:  "Attribute name required",
						Detail:   "Splat expressions ([*]) may not be used here.",
						Subject:  &next.Range,
						Context:  hcl.RangeBetween(varTok.Range, next.Range).Ptr(),
					})
				} else {
					diags = append(diags, &hcl.Diagnostic{
						Severity: hcl.DiagError,
						Summary:  "Index value required",
						Detail:   "Index brackets must contain either a literal number or a literal string.",
						Subject:  &next.Range,
						Context:  hcl.RangeBetween(varTok.Range, next.Range).Ptr(),
					})
				}
				return ret, diags
			}

		default:
			diags = append(diags, &hcl.Diagnostic{
				Severity: hcl.DiagError,
				Summary:  "Invalid character",
				Detail:   "Expected an attribute access or an index operator.",
				Subject:  &next.Range,
				Context:  hcl.RangeBetween(varTok.Range, next.Range).Ptr(),
			})
			return ret, diags
		}
	}
}
