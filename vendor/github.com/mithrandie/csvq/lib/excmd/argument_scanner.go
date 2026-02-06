package excmd

import (
	"bytes"
	"errors"
	"unicode"

	"github.com/mithrandie/csvq/lib/parser"
)

type ArgumentScanner struct {
	src         []rune
	srcPos      int
	text        bytes.Buffer
	elementType ElementType

	err error
}

func (s *ArgumentScanner) Init(src string) *ArgumentScanner {
	s.src = []rune(src)
	s.srcPos = 0
	s.text.Reset()
	s.elementType = 0
	s.err = nil
	return s
}

func (s *ArgumentScanner) Err() error {
	return s.err
}

func (s *ArgumentScanner) Text() string {
	return s.text.String()
}

func (s *ArgumentScanner) ElementType() ElementType {
	return s.elementType
}

func (s *ArgumentScanner) peek() rune {
	if len(s.src) <= s.srcPos {
		return EOF
	}

	return s.src[s.srcPos]
}

func (s *ArgumentScanner) next() rune {
	ch := s.peek()
	if ch == EOF {
		return ch
	}

	s.srcPos++
	return ch
}

func (s *ArgumentScanner) Scan() bool {
	s.text.Reset()

	switch s.peek() {
	case EOF:
		return false
	case parser.VariableSign:
		s.next()

		switch s.peek() {
		case parser.EnvironmentVariableSign:
			s.next()
			s.elementType = EnvironmentVariable
		case parser.RuntimeInformationSign:
			s.next()
			s.elementType = RuntimeInformation
		default:
			s.elementType = Variable
		}

		if s.elementType == EnvironmentVariable && s.peek() == '`' {
			s.scanQuotedEnvironmentVariable(s.next())
		} else {
			s.scanVariable()
		}

		if s.text.Len() < 1 {
			s.err = errors.New("invalid variable symbol")
		}
	case parser.ExternalCommandSign:
		s.next()

		s.elementType = CsvqExpression
		if s.peek() != parser.BeginExpression {
			s.err = errors.New("invalid command symbol")
		} else {
			s.next()
			s.scanCsvqExpression()
		}
	default:
		s.elementType = FixedString
		s.scanString()
	}

	return s.err == nil
}

func (s *ArgumentScanner) scanQuotedEnvironmentVariable(quote rune) {
	for {
		ch := s.next()
		if ch == EOF {
			s.err = errors.New("environment variable not terminated")
			break
		}

		if ch == quote {
			break
		}

		if ch == '\\' {
			switch s.peek() {
			case '\\', quote:
				ch = s.next()
			}
		}
		s.text.WriteRune(ch)
	}
}

func (s *ArgumentScanner) scanString() {
	for {
		ch := s.peek()
		if ch == parser.VariableSign || ch == parser.ExternalCommandSign || ch == EOF {
			break
		}

		if ch != '\\' {
			s.text.WriteRune(s.next())
			continue
		}

		s.next()
		switch s.peek() {
		case parser.VariableSign, parser.ExternalCommandSign:
			s.text.WriteRune(s.next())
		default:
			s.text.WriteRune('\\')
		}
	}
}

func (s *ArgumentScanner) scanVariable() {
	for s.isVariableRune(s.peek()) {
		s.text.WriteRune(s.next())
	}
}

func (s *ArgumentScanner) isVariableRune(ch rune) bool {
	return ch == '_' || unicode.IsLetter(ch) || unicode.IsDigit(ch)
}

func (s *ArgumentScanner) scanCsvqExpression() {
	for {
		ch := s.next()
		if ch == EOF {
			s.err = errors.New("command not terminated")
			break
		}

		if ch == parser.EndExpression {
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
