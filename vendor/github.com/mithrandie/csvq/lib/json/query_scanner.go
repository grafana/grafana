package json

import (
	"errors"
	"strings"
	"unicode"

	"github.com/mithrandie/go-text/json"
)

const AliasSpecifier = "AS"

type QueryScanner struct {
	src    []rune
	srcPos int
	offset int

	column int

	err error
}

func (s *QueryScanner) Init(src string) *QueryScanner {
	s.src = []rune(src)
	s.srcPos = 0
	s.offset = 0
	s.column = 0

	return s
}

func (s *QueryScanner) peek() rune {
	if len(s.src) <= s.srcPos {
		return EOF
	}
	return s.src[s.srcPos]
}

func (s *QueryScanner) next() rune {
	ch := s.peek()
	if ch == EOF {
		return ch
	}

	s.srcPos++
	s.offset++
	s.column++
	return ch
}

func (s *QueryScanner) runes() []rune {
	return s.src[(s.srcPos - s.offset):s.srcPos]
}

func (s *QueryScanner) literal() string {
	return string(s.runes())
}

func (s *QueryScanner) trimQuotes() string {
	runes := s.runes()
	quote := runes[0]
	switch quote {
	case '"', '\'', '`':
		if 1 < len(runes) && runes[0] == quote && runes[len(runes)-1] == quote {
			runes = runes[1:(len(runes) - 1)]
		}
	}
	return string(runes)
}

func (s *QueryScanner) Scan() (QueryToken, error) {
	ch := s.skipSpaces()

	s.offset = 0
	s.next()

	token := ch
	literal := string(ch)
	column := s.column

	switch {
	case s.isDecimal(ch):
		s.scanDecimal()
		literal = s.literal()
		token = PATH_INDEX
	case s.isIdentRune(ch):
		s.scanIdentifier()
		literal = s.literal()

		if strings.EqualFold(AliasSpecifier, literal) {
			token = AS
		} else {
			token = PATH_IDENTIFIER
		}
	default:
		switch ch {
		case EOF:
			break
		case '"', '\'', '`':
			s.scanString(ch)
			literal, _ = json.Unescape(s.trimQuotes())
			token = PATH_IDENTIFIER
		}
	}

	return QueryToken{Token: int(token), Literal: literal, Column: column}, s.err
}

func (s *QueryScanner) skipSpaces() rune {
	for unicode.IsSpace(s.peek()) {
		s.next()
	}
	return s.peek()
}

func (s *QueryScanner) isDecimal(ch rune) bool {
	return '0' <= ch && ch <= '9'
}

func (s *QueryScanner) isIdentRune(ch rune) bool {
	return ch == '_' || ch == '$' || unicode.IsLetter(ch) || unicode.IsDigit(ch)
}

func (s *QueryScanner) scanIdentifier() {
	for s.isIdentRune(s.peek()) {
		s.next()
	}
}

func (s *QueryScanner) scanString(quote rune) {
	for {
		ch := s.next()
		if ch == EOF {
			s.err = errors.New("string not terminated")
			break
		}

		if ch == quote {
			break
		}

		if ch == '\\' {
			switch s.peek() {
			case quote:
				s.next()
			}
		}
	}
}

func (s *QueryScanner) scanDecimal() {
	for s.isDecimal(s.peek()) {
		s.next()
	}
}
