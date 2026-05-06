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

// Proto represents a .proto definition
type Proto struct {
	Filename string
	Elements []Visitee
}

// Accept dispatches the call to the visitor.
func (proto *Proto) Accept(v Visitor) {
	// As Proto is not (yet) a Visitee, we enumerate its elements instead
	//v.VisitProto(proto)
	for _, each := range proto.Elements {
		each.Accept(v)
	}
}

// addElement is part of elementContainer
func (proto *Proto) addElement(v Visitee) {
	v.parent(proto)
	proto.Elements = append(proto.Elements, v)
}

// elements is part of elementContainer
func (proto *Proto) elements() []Visitee {
	return proto.Elements
}

// takeLastComment is part of elementContainer
// removes and returns the last element of the list if it is a Comment.
func (proto *Proto) takeLastComment(expectedOnLine int) (last *Comment) {
	last, proto.Elements = takeLastCommentIfEndsOnLine(proto.Elements, expectedOnLine)
	return
}

// parse parsers a complete .proto definition source.
func (proto *Proto) parse(p *Parser) error {
	for {
		pos, tok, lit := p.next()
		switch {
		case isComment(lit):
			if com := mergeOrReturnComment(proto.Elements, lit, pos); com != nil { // not merged?
				proto.Elements = append(proto.Elements, com)
			}
		case tOPTION == tok:
			o := new(Option)
			o.Position = pos
			o.Comment, proto.Elements = takeLastCommentIfEndsOnLine(proto.Elements, pos.Line-1)
			if err := o.parse(p); err != nil {
				return err
			}
			proto.addElement(o)
		case tSYNTAX == tok:
			s := new(Syntax)
			s.Position = pos
			s.Comment, proto.Elements = takeLastCommentIfEndsOnLine(proto.Elements, pos.Line-1)
			if err := s.parse(p); err != nil {
				return err
			}
			proto.addElement(s)
		case tIMPORT == tok:
			im := new(Import)
			im.Position = pos
			im.Comment, proto.Elements = takeLastCommentIfEndsOnLine(proto.Elements, pos.Line-1)
			if err := im.parse(p); err != nil {
				return err
			}
			proto.addElement(im)
		case tENUM == tok:
			enum := new(Enum)
			enum.Position = pos
			enum.Comment, proto.Elements = takeLastCommentIfEndsOnLine(proto.Elements, pos.Line-1)
			if err := enum.parse(p); err != nil {
				return err
			}
			proto.addElement(enum)
		case tSERVICE == tok:
			service := new(Service)
			service.Position = pos
			service.Comment, proto.Elements = takeLastCommentIfEndsOnLine(proto.Elements, pos.Line-1)
			err := service.parse(p)
			if err != nil {
				return err
			}
			proto.addElement(service)
		case tPACKAGE == tok:
			pkg := new(Package)
			pkg.Position = pos
			pkg.Comment, proto.Elements = takeLastCommentIfEndsOnLine(proto.Elements, pos.Line-1)
			if err := pkg.parse(p); err != nil {
				return err
			}
			proto.addElement(pkg)
		case tMESSAGE == tok:
			msg := new(Message)
			msg.Position = pos
			msg.Comment, proto.Elements = takeLastCommentIfEndsOnLine(proto.Elements, pos.Line-1)
			if err := msg.parse(p); err != nil {
				return err
			}
			proto.addElement(msg)
		// BEGIN proto2
		case tEXTEND == tok:
			msg := new(Message)
			msg.Position = pos
			msg.Comment, proto.Elements = takeLastCommentIfEndsOnLine(proto.Elements, pos.Line-1)
			msg.IsExtend = true
			if err := msg.parse(p); err != nil {
				return err
			}
			proto.addElement(msg)
		// END proto2
		case tSEMICOLON == tok:
			maybeScanInlineComment(p, proto)
			// continue
		case tEOF == tok:
			goto done
		default:
			return p.unexpected(lit, ".proto element {comment|option|import|syntax|enum|service|package|message}", p)
		}
	}
done:
	return nil
}

func (proto *Proto) parent(v Visitee) {}

// elementContainer unifies types that have elements.
type elementContainer interface {
	addElement(v Visitee)
	elements() []Visitee
	takeLastComment(expectedOnLine int) *Comment
}
