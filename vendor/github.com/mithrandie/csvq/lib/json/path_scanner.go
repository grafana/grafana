package json

import (
	"bytes"
)

const (
	PathSeparator = '.'
	PathEscape    = '\\'
)

const EOF = -1

type PathScanner struct {
	src    []rune
	srcPos int
	offset int

	column int
}

func (s *PathScanner) Init(src string) *PathScanner {
	s.src = []rune(src)
	s.srcPos = 0
	s.offset = 0
	s.column = 0

	return s
}

func (s *PathScanner) peek() rune {
	if len(s.src) <= s.srcPos {
		return EOF
	}
	return s.src[s.srcPos]
}

func (s *PathScanner) next() rune {
	ch := s.peek()
	if ch == EOF {
		return ch
	}

	s.srcPos++
	s.offset++
	s.column++
	return ch
}

func (s *PathScanner) runes() []rune {
	return s.src[(s.srcPos - s.offset):s.srcPos]
}

func (s *PathScanner) literal() string {
	return string(s.runes())
}

func (s *PathScanner) Scan() PathToken {
	s.offset = 0
	ch := s.next()

	token := ch
	literal := string(ch)
	column := s.column

	switch ch {
	case EOF, PathSeparator:
		break
	default:
		s.scanObjectMember()
		literal = s.unescapeObjectMember(s.literal())
		token = OBJECT_PATH
	}

	return PathToken{Token: int(token), Literal: literal, Column: column}
}

func (s *PathScanner) scanObjectMember() {
ScanObjectMember:
	for {
		switch s.peek() {
		case EOF, PathSeparator:
			break ScanObjectMember
		case PathEscape:
			s.next()
		}

		s.next()
	}
}

func (s *PathScanner) unescapeObjectMember(src string) string {
	runes := []rune(src)
	var buf bytes.Buffer

	escaped := false
	for _, r := range runes {
		if escaped {
			switch r {
			case PathSeparator, PathEscape:
				buf.WriteRune(r)
			default:
				buf.WriteRune(PathEscape)
				buf.WriteRune(r)
			}
			escaped = false
			continue
		}

		if r == PathEscape {
			escaped = true
			continue
		}

		buf.WriteRune(r)
	}
	if escaped {
		buf.WriteRune(PathEscape)
	}

	return buf.String()
}
