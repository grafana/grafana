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

// Extensions declare that a range of field numbers in a message are available for third-party extensions.
// proto2 only
type Extensions struct {
	Position      scanner.Position
	Comment       *Comment
	Ranges        []Range
	InlineComment *Comment
	Parent        Visitee
}

// inlineComment is part of commentInliner.
func (e *Extensions) inlineComment(c *Comment) {
	e.InlineComment = c
}

// Accept dispatches the call to the visitor.
func (e *Extensions) Accept(v Visitor) {
	v.VisitExtensions(e)
}

// parse expects ranges
func (e *Extensions) parse(p *Parser) error {
	list, err := parseRanges(p, e)
	if err != nil {
		return err
	}
	e.Ranges = list
	return nil
}

// parent is part of elementContainer
func (e *Extensions) parent(p Visitee) { e.Parent = p }
