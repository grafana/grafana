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

// Service defines a set of RPC calls.
type Service struct {
	Position scanner.Position
	Comment  *Comment
	Name     string
	Elements []Visitee
	Parent   Visitee
}

// Accept dispatches the call to the visitor.
func (s *Service) Accept(v Visitor) {
	v.VisitService(s)
}

// Doc is part of Documented
func (s *Service) Doc() *Comment {
	return s.Comment
}

// addElement is part of elementContainer
func (s *Service) addElement(v Visitee) {
	v.parent(s)
	s.Elements = append(s.Elements, v)
}

// elements is part of elementContainer
func (s *Service) elements() []Visitee {
	return s.Elements
}

// takeLastComment is part of elementContainer
// removes and returns the last elements of the list if it is a Comment.
func (s *Service) takeLastComment(expectedOnLine int) (last *Comment) {
	last, s.Elements = takeLastCommentIfEndsOnLine(s.Elements, expectedOnLine)
	return
}

// parse continues after reading "service"
func (s *Service) parse(p *Parser) error {
	pos, tok, lit := p.nextIdentifier()
	if tok != tIDENT {
		if !isKeyword(tok) {
			return p.unexpected(lit, "service identifier", s)
		}
	}
	s.Name = lit
	consumeCommentFor(p, s)
	pos, tok, lit = p.next()
	if tok != tLEFTCURLY {
		return p.unexpected(lit, "service opening {", s)
	}
	for {
		pos, tok, lit = p.next()
		switch tok {
		case tCOMMENT:
			if com := mergeOrReturnComment(s.Elements, lit, pos); com != nil { // not merged?
				s.addElement(com)
			}
		case tOPTION:
			opt := new(Option)
			opt.Position = pos
			opt.Comment, s.Elements = takeLastCommentIfEndsOnLine(s.elements(), pos.Line-1)
			if err := opt.parse(p); err != nil {
				return err
			}
			s.addElement(opt)
		case tRPC:
			rpc := new(RPC)
			rpc.Position = pos
			rpc.Comment, s.Elements = takeLastCommentIfEndsOnLine(s.Elements, pos.Line-1)
			err := rpc.parse(p)
			if err != nil {
				return err
			}
			s.addElement(rpc)
			maybeScanInlineComment(p, s)
		case tSEMICOLON:
			maybeScanInlineComment(p, s)
		case tRIGHTCURLY:
			goto done
		default:
			return p.unexpected(lit, "service comment|rpc", s)
		}
	}
done:
	return nil
}

func (s *Service) parent(v Visitee) { s.Parent = v }

// RPC represents an rpc entry in a message.
type RPC struct {
	Position       scanner.Position
	Comment        *Comment
	Name           string
	RequestType    string
	StreamsRequest bool
	ReturnsType    string
	StreamsReturns bool
	Elements       []Visitee
	InlineComment  *Comment
	Parent         Visitee

	// Options field is DEPRECATED, use Elements instead.
	Options []*Option
}

// Accept dispatches the call to the visitor.
func (r *RPC) Accept(v Visitor) {
	v.VisitRPC(r)
}

// Doc is part of Documented
func (r *RPC) Doc() *Comment {
	return r.Comment
}

// inlineComment is part of commentInliner.
func (r *RPC) inlineComment(c *Comment) {
	r.InlineComment = c
}

// parse continues after reading "rpc"
func (r *RPC) parse(p *Parser) error {
	pos, tok, lit := p.next()
	if tok != tIDENT {
		return p.unexpected(lit, "rpc method", r)
	}
	r.Name = lit
	pos, tok, lit = p.next()
	if tok != tLEFTPAREN {
		return p.unexpected(lit, "rpc type opening (", r)
	}
	pos, tok, lit = p.nextTypeName()
	if tSTREAM == tok {
		r.StreamsRequest = true
		pos, tok, lit = p.nextTypeName()
	}
	if tok != tIDENT {
		return p.unexpected(lit, "rpc stream | request type", r)
	}
	r.RequestType = lit
	pos, tok, lit = p.next()
	if tok != tRIGHTPAREN {
		return p.unexpected(lit, "rpc type closing )", r)
	}
	pos, tok, lit = p.next()
	if tok != tRETURNS {
		return p.unexpected(lit, "rpc returns", r)
	}
	pos, tok, lit = p.next()
	if tok != tLEFTPAREN {
		return p.unexpected(lit, "rpc type opening (", r)
	}
	pos, tok, lit = p.nextTypeName()
	if tSTREAM == tok {
		r.StreamsReturns = true
		pos, tok, lit = p.nextTypeName()
	}
	if tok != tIDENT {
		return p.unexpected(lit, "rpc stream | returns type", r)
	}
	r.ReturnsType = lit
	pos, tok, lit = p.next()
	if tok != tRIGHTPAREN {
		return p.unexpected(lit, "rpc type closing )", r)
	}
	pos, tok, lit = p.next()
	if tSEMICOLON == tok {
		p.nextPut(pos, tok, lit) // allow for inline comment parsing
		return nil
	}
	if tLEFTCURLY == tok {
		// parse options
		for {
			pos, tok, lit = p.next()
			if tRIGHTCURLY == tok {
				break
			}
			if isComment(lit) {
				if com := mergeOrReturnComment(r.elements(), lit, pos); com != nil { // not merged?
					r.addElement(com)
					continue
				}
			}
			if tSEMICOLON == tok {
				maybeScanInlineComment(p, r)
				continue
			}
			if tOPTION == tok {
				o := new(Option)
				o.Position = pos
				if err := o.parse(p); err != nil {
					return err
				}
				r.addElement(o)
			}
		}
	}
	return nil
}

// addElement is part of elementContainer
func (r *RPC) addElement(v Visitee) {
	v.parent(r)
	r.Elements = append(r.Elements, v)
	// handle deprecated field
	if option, ok := v.(*Option); ok {
		r.Options = append(r.Options, option)
	}
}

// elements is part of elementContainer
func (r *RPC) elements() []Visitee {
	return r.Elements
}

func (r *RPC) takeLastComment(expectedOnLine int) (last *Comment) {
	last, r.Elements = takeLastCommentIfEndsOnLine(r.Elements, expectedOnLine)
	return
}

func (r *RPC) parent(v Visitee) { r.Parent = v }
