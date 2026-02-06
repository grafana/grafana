package jsonexpr

import (
	"bufio"
	"fmt"
	"io"
	"strconv"
	"text/scanner"
)

type Scanner struct {
	buf   *bufio.Reader
	data  []interface{}
	err   error
	debug bool
}

func NewScanner(r io.Reader, debug bool) *Scanner {
	return &Scanner{
		buf:   bufio.NewReader(r),
		debug: debug,
	}
}

func (sc *Scanner) Error(s string) {
	sc.err = fmt.Errorf(s)
	fmt.Printf("syntax error: %s\n", s)
}

func (sc *Scanner) Reduced(rule, state int, lval *JSONExprSymType) bool {
	if sc.debug {
		fmt.Printf("rule: %v; state %v; lval: %v\n", rule, state, lval)
	}
	return false
}

func (sc *Scanner) Lex(lval *JSONExprSymType) int {
	return sc.lex(lval)
}

func (sc *Scanner) lex(lval *JSONExprSymType) int {
	for {
		r := sc.read()

		if r == 0 {
			return 0
		}
		if isWhitespace(r) {
			continue
		}

		if isDigit(r) {
			sc.unread()
			val, err := sc.scanInt()
			if err != nil {
				sc.err = fmt.Errorf(err.Error())
				return 0
			}

			lval.int = val
			return INDEX
		}

		switch true {
		case r == '[':
			return LSB
		case r == ']':
			return RSB
		case r == '.':
			return DOT
		case isStartIdentifier(r):
			sc.unread()
			lval.field = sc.scanField()
			return FIELD
		case r == '"':
			sc.unread()
			lval.str = sc.scanStr()
			return STRING
		default:
			sc.err = fmt.Errorf("unexpected char %c", r)
			return 0
		}
	}
}

func isStartIdentifier(r rune) bool {
	return (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || r == '_'
}

func isIdentifier(r rune) bool {
	return isStartIdentifier(r) || (r >= '0' && r <= '9')
}

func (sc *Scanner) scanField() string {
	var str []rune

	for {
		r := sc.read()
		if !isIdentifier(r) || isEndOfInput(r) {
			sc.unread()
			break
		}

		str = append(str, r)
	}
	return string(str)
}

func (sc *Scanner) scanStr() string {
	var str []rune
	//begin with ", end with "
	r := sc.read()
	if r != '"' {
		sc.err = fmt.Errorf("unexpected char %c", r)
		return ""
	}

	for {
		r := sc.read()
		if isEndOfInput(r) {
			break
		}

		if r == '"' || r == ']' {
			break
		}
		str = append(str, r)
	}
	return string(str)
}

func (sc *Scanner) scanInt() (int, error) {
	var number []rune

	for {
		r := sc.read()
		if r == '.' && len(number) > 0 {
			return 0, fmt.Errorf("cannot use float as array index")
		}

		if isWhitespace(r) || r == '.' || r == ']' {
			sc.unread()
			break
		}

		if !isDigit(r) {
			return 0, fmt.Errorf("non-integer value: %c", r)
		}

		number = append(number, r)
	}

	return strconv.Atoi(string(number))
}

// input is either terminated by EOF or null byte
func isEndOfInput(r rune) bool {
	return r == scanner.EOF || r == rune(0)
}

func (sc *Scanner) read() rune {
	ch, _, _ := sc.buf.ReadRune()
	return ch
}

func (sc *Scanner) unread() { _ = sc.buf.UnreadRune() }

func isWhitespace(ch rune) bool { return ch == ' ' || ch == '\t' || ch == '\n' }

func isDigit(r rune) bool {
	return r >= '0' && r <= '9'
}
