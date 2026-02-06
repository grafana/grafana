// Package querytext is the old query parser and parameter substitute process.
// Do not use on new code.
//
// This package is not subject to any API compatibility guarantee.
package querytext

import (
	"bytes"
	"io"
	"strconv"
)

type parser struct {
	r          *bytes.Reader
	w          bytes.Buffer
	paramCount int
	paramMax   int

	// using map as a set
	namedParams map[string]bool
}

func (p *parser) next() (rune, bool) {
	ch, _, err := p.r.ReadRune()
	if err != nil {
		if err != io.EOF {
			panic(err)
		}
		return 0, false
	}
	return ch, true
}

func (p *parser) unread() {
	err := p.r.UnreadRune()
	if err != nil {
		panic(err)
	}
}

func (p *parser) write(ch rune) {
	p.w.WriteRune(ch)
}

type stateFunc func(*parser) stateFunc

// ParseParams rewrites the query from using "?" placeholders
// to using "@pN" parameter names that SQL Server will accept.
//
// This function and package is not subject to any API compatibility guarantee.
func ParseParams(query string) (string, int) {
	p := &parser{
		r:           bytes.NewReader([]byte(query)),
		namedParams: map[string]bool{},
	}
	state := parseNormal
	for state != nil {
		state = state(p)
	}
	return p.w.String(), p.paramMax + len(p.namedParams)
}

func parseNormal(p *parser) stateFunc {
	for {
		ch, ok := p.next()
		if !ok {
			return nil
		}
		if ch == '?' {
			return parseOrdinalParameter
		} else if ch == '$' || ch == ':' {
			ch2, ok := p.next()
			if !ok {
				p.write(ch)
				return nil
			}
			p.unread()
			if ch2 >= '0' && ch2 <= '9' {
				return parseOrdinalParameter
			} else if 'a' <= ch2 && ch2 <= 'z' || 'A' <= ch2 && ch2 <= 'Z' {
				return parseNamedParameter
			}
		}
		p.write(ch)
		switch ch {
		case '\'':
			return parseQuote
		case '"':
			return parseDoubleQuote
		case '[':
			return parseBracket
		case '-':
			return parseLineComment
		case '/':
			return parseComment
		}
	}
}

func parseOrdinalParameter(p *parser) stateFunc {
	var paramN int
	var ok bool
	for {
		var ch rune
		ch, ok = p.next()
		if ok && ch >= '0' && ch <= '9' {
			paramN = paramN*10 + int(ch-'0')
		} else {
			break
		}
	}
	if ok {
		p.unread()
	}
	if paramN == 0 {
		p.paramCount++
		paramN = p.paramCount
	}
	if paramN > p.paramMax {
		p.paramMax = paramN
	}
	p.w.WriteString("@p")
	p.w.WriteString(strconv.Itoa(paramN))
	if !ok {
		return nil
	}
	return parseNormal
}

func parseNamedParameter(p *parser) stateFunc {
	var paramName string
	var ok bool
	for {
		var ch rune
		ch, ok = p.next()
		if ok && (ch >= '0' && ch <= '9' || 'a' <= ch && ch <= 'z' || 'A' <= ch && ch <= 'Z') {
			paramName = paramName + string(ch)
		} else {
			break
		}
	}
	if ok {
		p.unread()
	}
	p.namedParams[paramName] = true
	p.w.WriteString("@")
	p.w.WriteString(paramName)
	if !ok {
		return nil
	}
	return parseNormal
}

func parseQuote(p *parser) stateFunc {
	for {
		ch, ok := p.next()
		if !ok {
			return nil
		}
		p.write(ch)
		if ch == '\'' {
			return parseNormal
		}
	}
}

func parseDoubleQuote(p *parser) stateFunc {
	for {
		ch, ok := p.next()
		if !ok {
			return nil
		}
		p.write(ch)
		if ch == '"' {
			return parseNormal
		}
	}
}

func parseBracket(p *parser) stateFunc {
	for {
		ch, ok := p.next()
		if !ok {
			return nil
		}
		p.write(ch)
		if ch == ']' {
			ch, ok = p.next()
			if !ok {
				return nil
			}
			if ch != ']' {
				p.unread()
				return parseNormal
			}
			p.write(ch)
		}
	}
}

func parseLineComment(p *parser) stateFunc {
	ch, ok := p.next()
	if !ok {
		return nil
	}
	if ch != '-' {
		p.unread()
		return parseNormal
	}
	p.write(ch)
	for {
		ch, ok = p.next()
		if !ok {
			return nil
		}
		p.write(ch)
		if ch == '\n' {
			return parseNormal
		}
	}
}

func parseComment(p *parser) stateFunc {
	var nested int
	ch, ok := p.next()
	if !ok {
		return nil
	}
	if ch != '*' {
		p.unread()
		return parseNormal
	}
	p.write(ch)
	for {
		ch, ok = p.next()
		if !ok {
			return nil
		}
		p.write(ch)
		for ch == '*' {
			ch, ok = p.next()
			if !ok {
				return nil
			}
			p.write(ch)
			if ch == '/' {
				if nested == 0 {
					return parseNormal
				} else {
					nested--
				}
			}
		}
		for ch == '/' {
			ch, ok = p.next()
			if !ok {
				return nil
			}
			p.write(ch)
			if ch == '*' {
				nested++
			}
		}
	}
}
