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
	"bytes"
	"fmt"
	"sort"
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
// ( ident | "(" fullIdent ")" ) { "." ident } "=" constant ";"
func (o *Option) parse(p *Parser) error {
	pos, tok, lit := p.nextIdentifier()
	if tLEFTPAREN == tok {
		pos, tok, lit = p.nextIdentifier()
		if tok != tIDENT {
			if !isKeyword(tok) {
				return p.unexpected(lit, "option full identifier", o)
			}
		}
		pos, tok, _ = p.next()
		if tok != tRIGHTPAREN {
			return p.unexpected(lit, "option full identifier closing )", o)
		}
		o.Name = fmt.Sprintf("(%s)", lit)
	} else {
		if tCOMMENT == tok {
			nc := newComment(pos, lit)
			if o.Comment != nil {
				o.Comment.Merge(nc)
			} else {
				o.Comment = nc
			}
			return o.parse(p)
		}
		// non full ident
		if tIDENT != tok {
			if !isKeyword(tok) {
				return p.unexpected(lit, "option identifier", o)
			}
		}
		o.Name = lit
	}
	pos, tok, lit = p.next()
	if tDOT == tok {
		// extend identifier
		pos, tok, lit = p.nextIdent(true) // keyword allowed as start
		if tok != tIDENT {
			if !isKeyword(tok) {
				return p.unexpected(lit, "option postfix identifier", o)
			}
		}
		o.Name = fmt.Sprintf("%s.%s", o.Name, lit)
		pos, tok, lit = p.next()
	}
	if tEQUALS != tok {
		return p.unexpected(lit, "option value assignment =", o)
	}
	r := p.peekNonWhitespace()
	var err error
	// values of an option can have illegal escape sequences
	// for the standard Go scanner used by this package.
	p.ignoreIllegalEscapesWhile(func() {
		if '{' == r {
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
	return err
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

// Literal represents intLit,floatLit,strLit or boolLit or a nested structure thereof.
type Literal struct {
	Position scanner.Position
	Source   string
	IsString bool

	// It not nil then the entry is actually a comment with line(s)
	// modelled this way because Literal is not an elementContainer
	Comment *Comment

	// The rune use to delimit the string value (only valid iff IsString)
	QuoteRune rune

	// literal value can be an array literal value (even nested)
	Array []*Literal

	// literal value can be a map of literals (even nested)
	// DEPRECATED: use OrderedMap instead
	Map map[string]*Literal

	// literal value can be a map of literals (even nested)
	// this is done as pairs of name keys and literal values so the original ordering is preserved
	OrderedMap LiteralMap
}

var emptyRune rune

// LiteralMap is like a map of *Literal but preserved the ordering.
// Can be iterated yielding *NamedLiteral values.
type LiteralMap []*NamedLiteral

// Get returns a Literal from the map.
func (m LiteralMap) Get(key string) (*Literal, bool) {
	for _, each := range m {
		if each.Name == key {
			// exit on the first match
			return each.Literal, true
		}
	}
	return new(Literal), false
}

// SourceRepresentation returns the source (use the same rune that was used to delimit the string).
func (l Literal) SourceRepresentation() string {
	var buf bytes.Buffer
	if l.IsString {
		if l.QuoteRune == emptyRune {
			buf.WriteRune('"')
		} else {
			buf.WriteRune(l.QuoteRune)
		}
	}
	buf.WriteString(l.Source)
	if l.IsString {
		if l.QuoteRune == emptyRune {
			buf.WriteRune('"')
		} else {
			buf.WriteRune(l.QuoteRune)
		}
	}
	return buf.String()
}

// parse expects to read a literal constant after =.
func (l *Literal) parse(p *Parser) error {
	pos, tok, lit := p.next()
	// handle special element inside literal, a comment line
	if isComment(lit) {
		nc := newComment(pos, lit)
		if l.Comment == nil {
			l.Comment = nc
		} else {
			l.Comment.Merge(nc)
		}
		// continue with remaining entries
		return l.parse(p)
	}
	if tok == tLEFTSQUARE {
		// collect array elements
		array := []*Literal{}

		// if it's an empty array, consume the close bracket, set the Array to
		// an empty array, and return
		r := p.peekNonWhitespace()
		if ']' == r {
			pos, _, _ := p.next()
			l.Array = array
			l.IsString = false
			l.Position = pos
			return nil
		}

		for {
			e := new(Literal)
			if err := e.parse(p); err != nil {
				return err
			}
			array = append(array, e)
			_, tok, lit := p.next()
			if tok == tCOMMA {
				continue
			}
			if tok == tRIGHTSQUARE {
				break
			}
			return p.unexpected(lit, ", or ]", l)
		}
		l.Array = array
		l.IsString = false
		l.Position = pos
		return nil
	}
	if tLEFTCURLY == tok {
		l.Position, l.Source, l.IsString = pos, "", false
		constants, err := parseAggregateConstants(p, l)
		if err != nil {
			return nil
		}
		l.OrderedMap = LiteralMap(constants)
		return nil
	}
	if "-" == lit {
		// negative number
		if err := l.parse(p); err != nil {
			return err
		}
		// modify source and position
		l.Position, l.Source = pos, "-"+l.Source
		return nil
	}
	source := lit
	iss := isString(lit)
	if iss {
		source, l.QuoteRune = unQuote(source)
	}
	l.Position, l.Source, l.IsString = pos, source, iss

	// peek for multiline strings
	for {
		pos, tok, lit := p.next()
		if isString(lit) {
			line, _ := unQuote(lit)
			l.Source += line
		} else {
			p.nextPut(pos, tok, lit)
			break
		}
	}
	return nil
}

// NamedLiteral associates a name with a Literal
type NamedLiteral struct {
	*Literal
	Name string
	// PrintsColon is true when the Name must be printed with a colon suffix
	PrintsColon bool
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

// flatten the maps of each literal, recursively
// this func exists for deprecated Option.AggregatedConstants.
func collectAggregatedConstants(m map[string]*Literal) (list []*NamedLiteral) {
	for k, v := range m {
		if v.Map != nil {
			sublist := collectAggregatedConstants(v.Map)
			for _, each := range sublist {
				list = append(list, &NamedLiteral{
					Name:        k + "." + each.Name,
					PrintsColon: true,
					Literal:     each.Literal,
				})
			}
		} else {
			list = append(list, &NamedLiteral{
				Name:        k,
				PrintsColon: true,
				Literal:     v,
			})
		}
	}
	// sort list by position of literal
	sort.Sort(byPosition(list))
	return
}

type byPosition []*NamedLiteral

func (b byPosition) Less(i, j int) bool {
	return b[i].Literal.Position.Line < b[j].Literal.Position.Line
}
func (b byPosition) Len() int      { return len(b) }
func (b byPosition) Swap(i, j int) { b[i], b[j] = b[j], b[i] }

func parseAggregateConstants(p *Parser, container interface{}) (list []*NamedLiteral, err error) {
	for {
		pos, tok, lit := p.nextIdentifier()
		if tRIGHTSQUARE == tok {
			p.nextPut(pos, tok, lit)
			// caller has checked for open square ; will consume rightsquare, rightcurly and semicolon
			return
		}
		if tRIGHTCURLY == tok {
			return
		}
		if tSEMICOLON == tok {
			// just consume it
			continue
			//return
		}
		if tCOMMENT == tok {
			// assign to last parsed literal
			// TODO: see TestUseOfSemicolonsInAggregatedConstants
			continue
		}
		if tCOMMA == tok {
			if len(list) == 0 {
				err = p.unexpected(lit, "non-empty option aggregate key", container)
				return
			}
			continue
		}
		if tIDENT != tok && !isKeyword(tok) {
			err = p.unexpected(lit, "option aggregate key", container)
			return
		}
		// workaround issue #59 TODO
		if isString(lit) && len(list) > 0 {
			// concatenate with previous constant
			s, _ := unQuote(lit)
			list[len(list)-1].Source += s
			continue
		}
		key := lit
		printsColon := false
		// expect colon, aggregate or plain literal
		pos, tok, lit = p.next()
		if tCOLON == tok {
			// consume it
			printsColon = true
			pos, tok, lit = p.next()
		}
		// see if nested aggregate is started
		if tLEFTCURLY == tok {
			nested, fault := parseAggregateConstants(p, container)
			if fault != nil {
				err = fault
				return
			}

			// create the map
			m := map[string]*Literal{}
			for _, each := range nested {
				m[each.Name] = each.Literal
			}
			list = append(list, &NamedLiteral{
				Name:        key,
				PrintsColon: printsColon,
				Literal:     &Literal{Map: m, OrderedMap: LiteralMap(nested)}})
			continue
		}
		// no aggregate, put back token
		p.nextPut(pos, tok, lit)
		// now we see plain literal
		l := new(Literal)
		l.Position = pos
		if err = l.parse(p); err != nil {
			return
		}
		list = append(list, &NamedLiteral{Name: key, Literal: l, PrintsColon: printsColon})
	}
}

func (o *Option) parent(v Visitee) { o.Parent = v }
