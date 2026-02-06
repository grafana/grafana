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
	"errors"
	"fmt"
	"io"
	"runtime"
	"strconv"
	"strings"
	"text/scanner"
)

// Parser represents a parser.
type Parser struct {
	debug         bool
	scanner       *scanner.Scanner
	buf           *nextValues
	scannerErrors []error
}

// nextValues is to capture the result of next()
type nextValues struct {
	pos scanner.Position
	tok token
	lit string
}

// NewParser returns a new instance of Parser.
func NewParser(r io.Reader) *Parser {
	s := new(scanner.Scanner)
	s.Init(r)
	s.Mode = scanner.ScanIdents | scanner.ScanFloats | scanner.ScanStrings | scanner.ScanRawStrings | scanner.ScanComments
	p := &Parser{scanner: s}
	s.Error = p.handleScanError
	return p
}

// handleScanError is called from the underlying Scanner
func (p *Parser) handleScanError(s *scanner.Scanner, msg string) {
	p.scannerErrors = append(p.scannerErrors,
		fmt.Errorf("go scanner error at %v = %v", s.Position, msg))
}

// ignoreIllegalEscapesWhile is called for scanning constants of an option.
// Such content can have a syntax that is not acceptable by the Go scanner.
// This temporary installs a handler that ignores only one type of error: illegal char escape
func (p *Parser) ignoreIllegalEscapesWhile(block func()) {
	// during block call change error handler
	p.scanner.Error = func(s *scanner.Scanner, msg string) {
		// this catches both "illegal char escape" <= go1.12 and "invalid char escape" go1.13
		if strings.Contains(msg, "char escape") { // too bad there is no constant for this in scanner pkg
			return
		}
		p.handleScanError(s, msg)
	}
	block()
	// restore
	p.scanner.Error = p.handleScanError
}

// Parse parses a proto definition. May return a parse or scanner error.
func (p *Parser) Parse() (*Proto, error) {
	proto := new(Proto)
	if p.scanner.Filename != "" {
		proto.Filename = p.scanner.Filename
	}
	parseError := proto.parse(p)
	// see if it was a scanner error
	if len(p.scannerErrors) > 0 {
		buf := new(bytes.Buffer)
		for _, each := range p.scannerErrors {
			fmt.Fprintln(buf, each)
		}
		return proto, errors.New(buf.String())
	}
	return proto, parseError
}

// Filename is for reporting. Optional.
func (p *Parser) Filename(f string) {
	p.scanner.Filename = f
}

const stringWithSingleQuote = "'"

// next returns the next token using the scanner or drain the buffer.
func (p *Parser) next() (pos scanner.Position, tok token, lit string) {
	if p.buf != nil {
		// consume buf
		vals := *p.buf
		p.buf = nil
		return vals.pos, vals.tok, vals.lit
	}
	ch := p.scanner.Scan()
	if ch == scanner.EOF {
		return p.scanner.Position, tEOF, ""
	}
	lit = p.scanner.TokenText()
	// single quote needs additional scanning
	if stringWithSingleQuote == lit {
		return p.nextSingleQuotedString()
	}
	return p.scanner.Position, asToken(lit), lit
}

// pre: first single quote has been read
func (p *Parser) nextSingleQuotedString() (pos scanner.Position, tok token, lit string) {
	var ch rune
	p.ignoreErrorsWhile(func() { ch = p.scanner.Scan() })
	if ch == scanner.EOF {
		return p.scanner.Position, tEOF, ""
	}
	// string inside single quote
	lit = p.scanner.TokenText()
	if stringWithSingleQuote == lit {
		// empty single quoted string
		return p.scanner.Position, tIDENT, "''"
	}

	// scan for partial tokens until actual closing single-quote(') token
	for {
		p.ignoreErrorsWhile(func() { ch = p.scanner.Scan() })

		if ch == scanner.EOF {
			return p.scanner.Position, tEOF, ""
		}

		partial := p.scanner.TokenText()
		if partial == "'" {
			break
		}
		lit += partial
	}
	// end quote expected
	if stringWithSingleQuote != p.scanner.TokenText() {
		p.unexpected(lit, "'", p)
	}
	return p.scanner.Position, tIDENT, fmt.Sprintf("'%s'", lit)
}

func (p *Parser) ignoreErrorsWhile(block func()) {
	// during block call change error handler which ignores it all
	p.scanner.Error = func(s *scanner.Scanner, msg string) { return }
	block()
	// restore
	p.scanner.Error = p.handleScanError
}

// nextPut sets the buffer
func (p *Parser) nextPut(pos scanner.Position, tok token, lit string) {
	p.buf = &nextValues{pos, tok, lit}
}

func (p *Parser) unexpected(found, expected string, obj interface{}) error {
	debug := ""
	if p.debug {
		_, file, line, _ := runtime.Caller(1)
		debug = fmt.Sprintf(" at %s:%d (with %#v)", file, line, obj)
	}
	return fmt.Errorf("%v: found %q but expected [%s]%s", p.scanner.Position, found, expected, debug)
}

func (p *Parser) nextInteger() (i int, err error) {
	_, tok, lit := p.next()
	if "-" == lit {
		i, err = p.nextInteger()
		return i * -1, err
	}
	if tok != tNUMBER {
		return 0, errors.New("non integer")
	}
	if strings.HasPrefix(lit, "0x") || strings.HasPrefix(lit, "0X") {
		// hex decode
		i64, err := strconv.ParseInt(lit, 0, 64)
		return int(i64), err
	}
	i, err = strconv.Atoi(lit)
	return
}

// nextIdentifier consumes tokens which may have one or more dot separators (namespaced idents).
func (p *Parser) nextIdentifier() (pos scanner.Position, tok token, lit string) {
	pos, tok, lit = p.nextIdent(false)
	if tDOT == tok {
		// leading dot allowed
		pos, tok, lit = p.nextIdent(false)
		lit = "." + lit
	}
	return
}

func (p *Parser) nextMessageLiteralFieldName() (pos scanner.Position, tok token, lit string) {
	pos, tok, lit = p.nextIdent(true)
	if tok == tLEFTSQUARE {
		pos, tok, lit = p.nextIdent(true)
		_, _, _ = p.next() // consume right square
	}
	return
}

// nextTypeName implements the Packages and Name Resolution for finding the name of the type.
// Valid examples:
// .google.protobuf.Empty
// stream T must return tSTREAM
// optional int32 must return tOPTIONAL
// Bogus must return Bogus
func (p *Parser) nextTypeName() (pos scanner.Position, tok token, lit string) {
	pos, tok, lit = p.next()
	startPos := pos
	fullLit := lit
	// leading dot allowed
	if tDOT == tok {
		pos, tok, lit = p.next()
		fullLit = fmt.Sprintf(".%s", lit)
	}
	// type can be namespaced more
	for {
		r := p.peekNonWhitespace()
		if '.' != r {
			break
		}
		p.next() // consume dot
		pos, tok, lit = p.next()
		fullLit = fmt.Sprintf("%s.%s", fullLit, lit)
		tok = tIDENT
	}
	return startPos, tok, fullLit
}

func (p *Parser) nextIdent(keywordStartAllowed bool) (pos scanner.Position, tok token, lit string) {
	pos, tok, lit = p.next()
	if tIDENT != tok {
		// can be keyword
		if !(isKeyword(tok) && keywordStartAllowed) {
			return
		}
		// proceed with keyword as first literal
	}
	startPos := pos
	fullLit := lit
	// see if identifier is namespaced
	for {
		r := p.peekNonWhitespace()
		if r != '.' {
			break
		}
		p.next() // consume dot
		fullLit += "."
		pos, tok, lit := p.next()
		if tIDENT != tok && !isKeyword(tok) {
			p.nextPut(pos, tok, lit)
			break
		}
		fullLit += lit
	}
	return startPos, tIDENT, fullLit
}

func (p *Parser) peekNonWhitespace() rune {
	r := p.scanner.Peek()
	if r == scanner.EOF {
		return r
	}
	if isWhitespace(r) {
		// consume it
		p.scanner.Next()
		return p.peekNonWhitespace()
	}
	return r
}

// https://protobuf.dev/reference/protobuf/proto3-spec/
func (p *Parser) nextFullIdent(keywordStartAllowed bool) (pos scanner.Position, tok token, lit string) {
	pos, tok, lit = p.next()
	if tIDENT != tok {
		// can be keyword
		if !(isKeyword(tok) && keywordStartAllowed) {
			return
		}
		// proceed with keyword as first literal
	}
	fullIdent := lit
	for {
		r := p.peekNonWhitespace()
		if r != '.' {
			break
		}
		p.next() // consume dot
		pos, tok, lit = p.nextFullIdent(true)
		if tok != tIDENT {
			p.nextPut(pos, tok, lit)
			break
		}
		fullIdent = fmt.Sprintf("%s.%s", fullIdent, lit)
	}
	return pos, tIDENT, fullIdent
}
