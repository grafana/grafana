// Copyright 2016, Google Inc.
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are
// met:
//
//     * Redistributions of source code must retain the above copyright
// notice, this list of conditions and the following disclaimer.
//     * Redistributions in binary form must reproduce the above
// copyright notice, this list of conditions and the following disclaimer
// in the documentation and/or other materials provided with the
// distribution.
//     * Neither the name of Google Inc. nor the names of its
// contributors may be used to endorse or promote products derived from
// this software without specific prior written permission.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
// "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
// LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
// A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
// OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
// SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
// LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
// DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
// THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
// (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
// OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

package gax

import (
	"fmt"
	"io"
	"strings"
)

// This parser follows the syntax of path templates, from
// https://github.com/googleapis/googleapis/blob/master/google/api/http.proto.
// The differences are that there is no custom verb, we allow the initial slash
// to be absent, and that we are not strict as
// https://tools.ietf.org/html/rfc6570 about the characters in identifiers and
// literals.

type pathTemplateParser struct {
	r                *strings.Reader
	runeCount        int             // the number of the current rune in the original string
	nextVar          int             // the number to use for the next unnamed variable
	seenName         map[string]bool // names we've seen already
	seenPathWildcard bool            // have we seen "**" already?
}

func parsePathTemplate(template string) (pt *PathTemplate, err error) {
	p := &pathTemplateParser{
		r:        strings.NewReader(template),
		seenName: map[string]bool{},
	}

	// Handle panics with strings like errors.
	// See pathTemplateParser.error, below.
	defer func() {
		if x := recover(); x != nil {
			errmsg, ok := x.(errString)
			if !ok {
				panic(x)
			}
			pt = nil
			err = ParseError{p.runeCount, template, string(errmsg)}
		}
	}()

	segs := p.template()
	// If there is a path wildcard, set its length. We can't do this
	// until we know how many segments we've got all together.
	for i, seg := range segs {
		if _, ok := seg.matcher.(pathWildcardMatcher); ok {
			segs[i].matcher = pathWildcardMatcher(len(segs) - i - 1)
			break
		}
	}
	return &PathTemplate{segments: segs}, nil

}

// Used to indicate errors "thrown" by this parser. We don't use string because
// many parts of the standard library panic with strings.
type errString string

// Terminates parsing immediately with an error.
func (p *pathTemplateParser) error(msg string) {
	panic(errString(msg))
}

// Template = [ "/" ] Segments
func (p *pathTemplateParser) template() []segment {
	var segs []segment
	if p.consume('/') {
		// Initial '/' needs an initial empty matcher.
		segs = append(segs, segment{matcher: labelMatcher("")})
	}
	return append(segs, p.segments("")...)
}

// Segments = Segment { "/" Segment }
func (p *pathTemplateParser) segments(name string) []segment {
	var segs []segment
	for {
		subsegs := p.segment(name)
		segs = append(segs, subsegs...)
		if !p.consume('/') {
			break
		}
	}
	return segs
}

// Segment  = "*" | "**" | LITERAL | Variable
func (p *pathTemplateParser) segment(name string) []segment {
	if p.consume('*') {
		if name == "" {
			name = fmt.Sprintf("$%d", p.nextVar)
			p.nextVar++
		}
		if p.consume('*') {
			if p.seenPathWildcard {
				p.error("multiple '**' disallowed")
			}
			p.seenPathWildcard = true
			// We'll change 0 to the right number at the end.
			return []segment{{name: name, matcher: pathWildcardMatcher(0)}}
		}
		return []segment{{name: name, matcher: wildcardMatcher(0)}}
	}
	if p.consume('{') {
		if name != "" {
			p.error("recursive named bindings are not allowed")
		}
		return p.variable()
	}
	return []segment{{name: name, matcher: labelMatcher(p.literal())}}
}

// Variable = "{" FieldPath [ "=" Segments ] "}"
// "{" is already consumed.
func (p *pathTemplateParser) variable() []segment {
	// Simplification: treat FieldPath as LITERAL, instead of IDENT { '.' IDENT }
	name := p.literal()
	if p.seenName[name] {
		p.error(name + " appears multiple times")
	}
	p.seenName[name] = true
	var segs []segment
	if p.consume('=') {
		segs = p.segments(name)
	} else {
		// "{var}" is equivalent to "{var=*}"
		segs = []segment{{name: name, matcher: wildcardMatcher(0)}}
	}
	if !p.consume('}') {
		p.error("expected '}'")
	}
	return segs
}

// A literal is any sequence of characters other than a few special ones.
// The list of stop characters is not quite the same as in the template RFC.
func (p *pathTemplateParser) literal() string {
	lit := p.consumeUntil("/*}{=")
	if lit == "" {
		p.error("empty literal")
	}
	return lit
}

// Read runes until EOF or one of the runes in stopRunes is encountered.
// If the latter, unread the stop rune. Return the accumulated runes as a string.
func (p *pathTemplateParser) consumeUntil(stopRunes string) string {
	var runes []rune
	for {
		r, ok := p.readRune()
		if !ok {
			break
		}
		if strings.IndexRune(stopRunes, r) >= 0 {
			p.unreadRune()
			break
		}
		runes = append(runes, r)
	}
	return string(runes)
}

// If the next rune is r, consume it and return true.
// Otherwise, leave the input unchanged and return false.
func (p *pathTemplateParser) consume(r rune) bool {
	rr, ok := p.readRune()
	if !ok {
		return false
	}
	if r == rr {
		return true
	}
	p.unreadRune()
	return false
}

// Read the next rune from the input. Return it.
// The second return value is false at EOF.
func (p *pathTemplateParser) readRune() (rune, bool) {
	r, _, err := p.r.ReadRune()
	if err == io.EOF {
		return r, false
	}
	if err != nil {
		p.error(err.Error())
	}
	p.runeCount++
	return r, true
}

// Put the last rune that was read back on the input.
func (p *pathTemplateParser) unreadRune() {
	if err := p.r.UnreadRune(); err != nil {
		p.error(err.Error())
	}
	p.runeCount--
}
