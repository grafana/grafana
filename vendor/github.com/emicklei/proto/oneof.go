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

// Oneof is a field alternate.
type Oneof struct {
	Position scanner.Position
	Comment  *Comment
	Name     string
	Elements []Visitee
	Parent   Visitee
}

// addElement is part of elementContainer
func (o *Oneof) addElement(v Visitee) {
	v.parent(o)
	o.Elements = append(o.Elements, v)
}

// elements is part of elementContainer
func (o *Oneof) elements() []Visitee {
	return o.Elements
}

// takeLastComment is part of elementContainer
// removes and returns the last element of the list if it is a Comment.
func (o *Oneof) takeLastComment(expectedOnLine int) (last *Comment) {
	last, o.Elements = takeLastCommentIfEndsOnLine(o.Elements, expectedOnLine)
	return last
}

// parse expects:
// oneofName "{" { oneofField | emptyStatement } "}"
func (o *Oneof) parse(p *Parser) error {
	pos, tok, lit := p.next()
	if tok != tIDENT {
		if !isKeyword(tok) {
			return p.unexpected(lit, "oneof identifier", o)
		}
	}
	o.Name = lit
	consumeCommentFor(p, o)
	pos, tok, lit = p.next()
	if tok != tLEFTCURLY {
		return p.unexpected(lit, "oneof opening {", o)
	}
	for {
		pos, tok, lit = p.nextTypeName()
		switch tok {
		case tCOMMENT:
			if com := mergeOrReturnComment(o.elements(), lit, pos); com != nil { // not merged?
				o.addElement(com)
			}
		case tIDENT:
			f := newOneOfField()
			f.Position = pos
			f.Comment, o.Elements = takeLastCommentIfEndsOnLine(o.elements(), pos.Line-1) // TODO call takeLastComment instead?
			f.Type = lit
			if err := parseFieldAfterType(f.Field, p, f); err != nil {
				return err
			}
			o.addElement(f)
		case tGROUP:
			g := new(Group)
			g.Position = pos
			g.Comment, o.Elements = takeLastCommentIfEndsOnLine(o.elements(), pos.Line-1)
			if err := g.parse(p); err != nil {
				return err
			}
			o.addElement(g)
		case tOPTION:
			opt := new(Option)
			opt.Position = pos
			opt.Comment, o.Elements = takeLastCommentIfEndsOnLine(o.elements(), pos.Line-1)
			if err := opt.parse(p); err != nil {
				return err
			}
			o.addElement(opt)
		case tSEMICOLON:
			maybeScanInlineComment(p, o)
			// continue
		default:
			goto done
		}
	}
done:
	if tok != tRIGHTCURLY {
		return p.unexpected(lit, "oneof closing }", o)
	}
	return nil
}

// Accept dispatches the call to the visitor.
func (o *Oneof) Accept(v Visitor) {
	v.VisitOneof(o)
}

// Doc is part of Documented
func (o *Oneof) Doc() *Comment {
	return o.Comment
}

// OneOfField is part of Oneof.
type OneOfField struct {
	*Field
}

func newOneOfField() *OneOfField { return &OneOfField{Field: new(Field)} }

// Accept dispatches the call to the visitor.
func (o *OneOfField) Accept(v Visitor) {
	v.VisitOneofField(o)
}

// Doc is part of Documented
// Note: although Doc() is defined on Field, it must be implemented here as well.
func (o *OneOfField) Doc() *Comment {
	return o.Comment
}

func (o *Oneof) parent(v Visitee) { o.Parent = v }
