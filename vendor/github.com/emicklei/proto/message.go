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

// Message consists of a message name and a message body.
type Message struct {
	Position scanner.Position
	Comment  *Comment
	Name     string
	IsExtend bool
	Elements []Visitee
	Parent   Visitee
}

func (m *Message) groupName() string {
	if m.IsExtend {
		return "extend"
	}
	return "message"
}

// parse expects ident { messageBody
func (m *Message) parse(p *Parser) error {
	_, tok, lit := p.nextIdentifier()
	if tok != tIDENT {
		if !isKeyword(tok) {
			return p.unexpected(lit, m.groupName()+" identifier", m)
		}
	}
	m.Name = lit
	consumeCommentFor(p, m)
	_, tok, lit = p.next()
	if tok != tLEFTCURLY {
		return p.unexpected(lit, m.groupName()+" opening {", m)
	}
	return parseMessageBody(p, m)
}

// parseMessageBody parses elements after {. It consumes the closing }
func parseMessageBody(p *Parser, c elementContainer) error {
	var (
		pos scanner.Position
		tok token
		lit string
	)
	for {
		pos, tok, lit = p.next()
		switch {
		case isComment(lit):
			if com := mergeOrReturnComment(c.elements(), lit, pos); com != nil { // not merged?
				c.addElement(com)
			}
		case tENUM == tok:
			e := new(Enum)
			e.Position = pos
			e.Comment = c.takeLastComment(pos.Line - 1)
			if err := e.parse(p); err != nil {
				return err
			}
			c.addElement(e)
		case tMESSAGE == tok:
			msg := new(Message)
			msg.Position = pos
			msg.Comment = c.takeLastComment(pos.Line - 1)
			if err := msg.parse(p); err != nil {
				return err
			}
			c.addElement(msg)
		case tOPTION == tok:
			o := new(Option)
			o.Position = pos
			o.Comment = c.takeLastComment(pos.Line - 1)
			if err := o.parse(p); err != nil {
				return err
			}
			c.addElement(o)
		case tONEOF == tok:
			o := new(Oneof)
			o.Position = pos
			o.Comment = c.takeLastComment(pos.Line - 1)
			if err := o.parse(p); err != nil {
				return err
			}
			c.addElement(o)
		case tMAP == tok:
			f := newMapField()
			f.Position = pos
			f.Comment = c.takeLastComment(pos.Line - 1)
			if err := f.parse(p); err != nil {
				return err
			}
			c.addElement(f)
		case tRESERVED == tok:
			r := new(Reserved)
			r.Position = pos
			r.Comment = c.takeLastComment(pos.Line - 1)
			if err := r.parse(p); err != nil {
				return err
			}
			c.addElement(r)
		// BEGIN proto2
		case tOPTIONAL == tok || tREPEATED == tok || tREQUIRED == tok:
			// look ahead
			prevTok := tok
			pos, tok, lit = p.next()
			if tGROUP == tok {
				g := new(Group)
				g.Position = pos
				g.Comment = c.takeLastComment(pos.Line - 1)
				g.Optional = prevTok == tOPTIONAL
				g.Repeated = prevTok == tREPEATED
				g.Required = prevTok == tREQUIRED
				if err := g.parse(p); err != nil {
					return err
				}
				c.addElement(g)
			} else {
				// not a group, will be tFIELD
				p.nextPut(pos, tok, lit)
				f := newNormalField()
				f.Type = lit
				f.Position = pos
				f.Comment = c.takeLastComment(pos.Line - 1)
				f.Optional = prevTok == tOPTIONAL
				f.Repeated = prevTok == tREPEATED
				f.Required = prevTok == tREQUIRED
				if err := f.parse(p); err != nil {
					return err
				}
				c.addElement(f)
			}
		case tGROUP == tok:
			g := new(Group)
			g.Position = pos
			g.Comment = c.takeLastComment(pos.Line - 1)
			if err := g.parse(p); err != nil {
				return err
			}
			c.addElement(g)
		case tEXTENSIONS == tok:
			e := new(Extensions)
			e.Position = pos
			e.Comment = c.takeLastComment(pos.Line - 1)
			if err := e.parse(p); err != nil {
				return err
			}
			c.addElement(e)
		case tEXTEND == tok:
			e := new(Message)
			e.Position = pos
			e.Comment = c.takeLastComment(pos.Line - 1)
			e.IsExtend = true
			if err := e.parse(p); err != nil {
				return err
			}
			c.addElement(e)
		// END proto2 only
		case tRIGHTCURLY == tok || tEOF == tok:
			goto done
		case tSEMICOLON == tok:
			maybeScanInlineComment(p, c)
			// continue
		default:
			// tFIELD
			p.nextPut(pos, tok, lit)
			f := newNormalField()
			f.Position = pos
			f.Comment = c.takeLastComment(pos.Line - 1)
			if err := f.parse(p); err != nil {
				return err
			}
			c.addElement(f)
		}
	}
done:
	if tok != tRIGHTCURLY {
		return p.unexpected(lit, "extend|message|group closing }", c)
	}
	return nil
}

// Accept dispatches the call to the visitor.
func (m *Message) Accept(v Visitor) {
	v.VisitMessage(m)
}

// addElement is part of elementContainer
func (m *Message) addElement(v Visitee) {
	v.parent(m)
	m.Elements = append(m.Elements, v)
}

// elements is part of elementContainer
func (m *Message) elements() []Visitee {
	return m.Elements
}

func (m *Message) takeLastComment(expectedOnLine int) (last *Comment) {
	last, m.Elements = takeLastCommentIfEndsOnLine(m.Elements, expectedOnLine)
	return
}

// Doc is part of Documented
func (m *Message) Doc() *Comment {
	return m.Comment
}

func (m *Message) parent(v Visitee) { m.Parent = v }
