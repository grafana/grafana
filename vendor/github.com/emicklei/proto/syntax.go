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
	"text/scanner"
)

// Syntax should have value "proto"
type Syntax struct {
	Position      scanner.Position
	Comment       *Comment
	Value         string
	InlineComment *Comment
	Parent        Visitee
}

func (s *Syntax) parse(p *Parser) error {
	if _, tok, lit := p.next(); tok != tEQUALS {
		return p.unexpected(lit, "syntax =", s)
	}
	_, _, lit := p.next()
	if !isString(lit) {
		return p.unexpected(lit, "syntax string constant", s)
	}
	s.Value, _ = unQuote(lit)
	return nil
}

// Accept dispatches the call to the visitor.
func (s *Syntax) Accept(v Visitor) {
	v.VisitSyntax(s)
}

// Doc is part of Documented
func (s *Syntax) Doc() *Comment {
	return s.Comment
}

// inlineComment is part of commentInliner.
func (s *Syntax) inlineComment(c *Comment) {
	s.InlineComment = c
}

func (s *Syntax) parent(v Visitee) { s.Parent = v }
