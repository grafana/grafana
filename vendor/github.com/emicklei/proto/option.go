// Copyright (c) 2017 Ernest Micklei
//
// MIT License
//
// Permission is hereby granted, free of charge, to any person obtaining
// a copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to
// permit persons to whom the Software is furnished to do so, subject to
// the following conditions:
//
// The above copyright notice and this permission notice shall be
// included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
// LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
// OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

package proto

import (
	"fmt"
	"text/scanner"
)

// Option is a protoc compiler option
type Option struct {
	Position   scanner.Position
	Comment    *Comment
	Name       string
	Constant   Literal
	IsEmbedded bool
	// AggregatedConstants is DEPRECATED. These Literals are populated into Constant.OrderedMap
	AggregatedConstants []*NamedLiteral
	InlineComment       *Comment
	Parent              Visitee
}

// parse reads an Option body
// ( ident | //... | "(" fullIdent ")" ) { "." ident } "=" constant ";"
func (o *Option) parse(p *Parser) error {
	consumeOptionComments(o, p)

	if err := o.parseOptionName(p); err != nil {
		return err
	}
	// check for =
	pos, tok, lit := p.next()
	if tEQUALS != tok {
		return p.unexpected(lit, "option value assignment =", o)
	}
	// parse value
	r := p.peekNonWhitespace()
	var err error
	// values of an option can have illegal escape sequences
	// for the standard Go scanner used by this package.
	p.ignoreIllegalEscapesWhile(func() {
		if r == '{' {
			// aggregate
			p.next() // consume {
			err = o.parseAggregate(p)
		} else {
			// non aggregate
			l := new(Literal)
			l.Position = pos
			if e := l.parse(p); e != nil {
				err = e
			}
			o.Constant = *l
		}
	})
	consumeOptionComments(o, p)
	return err
}

// https://protobuf.dev/reference/protobuf/proto3-spec/#option
func (o *Option) parseOptionName(p *Parser) error {
	name := ""
	for {
		pos, tok, lit := p.nextIdent(true)
		switch tok {
		case tDOT:
			name += "."
		case tIDENT:
			name += lit
		case tLEFTPAREN:
			// check for dot
			dot := "" // none
			if p.peekNonWhitespace() == '.' {
				p.next() // consume dot
				dot = "."
			}
			_, tok, lit = p.nextFullIdent(true)
			if tok != tIDENT {
				return p.unexpected(lit, "option name", o)
			}
			// check for closing parenthesis
			_, tok, _ = p.next()
			if tok != tRIGHTPAREN {
				return p.unexpected(lit, "option full identifier closing )", o)
			}
			name = fmt.Sprintf("%s(%s%s)", name, dot, lit)
		default:
			// put it back
			p.nextPut(pos, tok, lit)
			goto done
		}
	}
done:
	o.Name = name
	return nil
}

// inlineComment is part of commentInliner.
func (o *Option) inlineComment(c *Comment) {
	o.InlineComment = c
}

// Accept dispatches the call to the visitor.
func (o *Option) Accept(v Visitor) {
	v.VisitOption(o)
}

// Doc is part of Documented
func (o *Option) Doc() *Comment {
	return o.Comment
}

// parseAggregate reads options written using aggregate syntax.
// tLEFTCURLY { has been consumed
func (o *Option) parseAggregate(p *Parser) error {
	constants, err := parseAggregateConstants(p, o)
	literalMap := map[string]*Literal{}
	for _, each := range constants {
		literalMap[each.Name] = each.Literal
	}
	o.Constant = Literal{Map: literalMap, OrderedMap: constants, Position: o.Position}

	// reconstruct the old, deprecated field
	o.AggregatedConstants = collectAggregatedConstants(literalMap)
	return err
}

func (o *Option) parent(v Visitee) { o.Parent = v }
