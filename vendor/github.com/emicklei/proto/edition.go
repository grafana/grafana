// Copyright (c) 2024 Ernest Micklei
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

type Edition struct {
	Position      scanner.Position
	Comment       *Comment
	Value         string
	InlineComment *Comment
	Parent        Visitee
}

func (e *Edition) parse(p *Parser) error {
	if _, tok, lit := p.next(); tok != tEQUALS {
		return p.unexpected(lit, "edition =", e)
	}
	_, _, lit := p.next()
	if !isString(lit) {
		return p.unexpected(lit, "edition string constant", e)
	}
	e.Value, _ = unQuote(lit)
	return nil
}

// Accept dispatches the call to the visitor.
func (e *Edition) Accept(v Visitor) {
	// v.VisitEdition(e) in v2
}

// Doc is part of Documented
func (e *Edition) Doc() *Comment {
	return e.Comment
}

// inlineComment is part of commentInliner.
func (e *Edition) inlineComment(c *Comment) {
	e.InlineComment = c
}

func (e *Edition) parent(v Visitee) { e.Parent = v }
