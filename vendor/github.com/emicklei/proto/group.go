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

// Group represents a (proto2 only) group.
// https://developers.google.com/protocol-buffers/docs/reference/proto2-spec#group_field
type Group struct {
	Position scanner.Position
	Comment  *Comment
	Name     string
	Optional bool
	Repeated bool
	Required bool
	Sequence int
	Elements []Visitee
	Parent   Visitee
}

// Accept dispatches the call to the visitor.
func (g *Group) Accept(v Visitor) {
	v.VisitGroup(g)
}

// addElement is part of elementContainer
func (g *Group) addElement(v Visitee) {
	v.parent(g)
	g.Elements = append(g.Elements, v)
}

// elements is part of elementContainer
func (g *Group) elements() []Visitee {
	return g.Elements
}

// Doc is part of Documented
func (g *Group) Doc() *Comment {
	return g.Comment
}

// takeLastComment is part of elementContainer
// removes and returns the last element of the list if it is a Comment.
func (g *Group) takeLastComment(expectedOnLine int) (last *Comment) {
	last, g.Elements = takeLastCommentIfEndsOnLine(g.Elements, expectedOnLine)
	return
}

// parse expects:
// groupName "=" fieldNumber { messageBody }
func (g *Group) parse(p *Parser) error {
	_, tok, lit := p.next()
	if tok != tIDENT {
		if !isKeyword(tok) {
			return p.unexpected(lit, "group name", g)
		}
	}
	g.Name = lit
	_, tok, lit = p.next()
	if tok != tEQUALS {
		return p.unexpected(lit, "group =", g)
	}
	i, err := p.nextInteger()
	if err != nil {
		return p.unexpected(lit, "group sequence number", g)
	}
	g.Sequence = i
	consumeCommentFor(p, g)
	_, tok, lit = p.next()
	if tok != tLEFTCURLY {
		return p.unexpected(lit, "group opening {", g)
	}
	return parseMessageBody(p, g)
}

func (g *Group) parent(v Visitee) { g.Parent = v }
