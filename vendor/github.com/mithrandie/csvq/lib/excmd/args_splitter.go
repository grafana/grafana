package excmd

import (
	"bytes"
	"errors"
	"unicode"

	"github.com/mithrandie/csvq/lib/parser"
)

type ArgsSplitter struct {
	src    []rune
	srcPos int
	text   bytes.Buffer

	err error
}

func (s *ArgsSplitter) Init(src string) *ArgsSplitter {
	s.src = []rune(src)
	s.srcPos = 0
	s.text.Reset()
	s.err = nil
	return s
}

func (s *ArgsSplitter) Err() error {
	return s.err
}

func (s *ArgsSplitter) Text() string {
	return s.text.String()
}

func (s *ArgsSplitter) peek() rune {
	if len(s.src) <= s.srcPos {
		return EOF
	}

	return s.src[s.srcPos]
}

func (s *ArgsSplitter) next() rune {
	ch := s.peek()
	if ch == EOF {
		return ch
	}

	s.srcPos++
	return ch
}

func (s *ArgsSplitter) Scan() bool {
	for unicode.IsSpace(s.peek()) {
		s.next()
	}

	ch := s.next()
	s.text.Reset()

	switch ch {
	case EOF:
		return false
	case parser.VariableSign:
		s.text.WriteRune(ch)

		if s.peek() == parser.EnvironmentVariableSign {
			s.text.WriteRune(s.next())
			if s.peek() == '`' {
				s.text.WriteRune(s.next())
				s.scanQuotedVariable('`')
			} else {
				s.scanString()
			}
		} else {
			s.scanString()
		}
	case parser.ExternalCommandSign:
		s.text.WriteRune(ch)
		if s.peek() != parser.BeginExpression {
			s.err = errors.New("invalid command symbol")
		} else {
			s.text.WriteRune(s.next())
			s.scanExternalCommand()
		}
	case '"', '\'':
		s.text.WriteRune(ch)
		s.scanQuotedString(ch)
	default:
		s.text.WriteRune(ch)
		s.scanString()
	}

	return s.err == nil
}

func (s *ArgsSplitter) scanQuotedVariable(quote rune) {
	for {
		ch := s.next()
		if ch == EOF {
			s.err = errors.New("environment variable not terminated")
			break
		}

		s.text.WriteRune(ch)

		if ch == quote {
			break
		}

		if ch == '\\' {
			switch s.peek() {
			case '\\', quote:
				s.text.WriteRune(s.next())
			}
		}
	}
}

func (s *ArgsSplitter) scanQuotedString(quote rune) {
	for {
		ch := s.next()
		if ch == EOF {
			s.err = errors.New("string not terminated")
			break
		}

		if ch == '\\' {
			switch s.peek() {
			case '\\', quote:
				s.text.WriteRune(ch)
				ch = s.next()
			}
		} else if ch == quote {
			s.text.WriteRune(ch)
			if s.peek() == quote {
				ch = s.next()
			} else {
				break
			}
		}

		s.text.WriteRune(ch)
	}
}

func (s *ArgsSplitter) scanString() {
	for {
		if s.peek() == EOF || unicode.IsSpace(s.peek()) {
			break
		}
		s.text.WriteRune(s.next())
	}
}

func (s *ArgsSplitter) scanExternalCommand() {
	for {
		ch := s.next()
		if ch == EOF {
			s.err = errors.New("command not terminated")
			break
		}

		if ch == parser.EndExpression {
			s.text.WriteRune(ch)
			break
		}

		if ch == '\\' {
			switch s.peek() {
			case parser.BeginExpression, parser.EndExpression:
				ch = s.next()
			}
		}
		s.text.WriteRune(ch)
	}
}
