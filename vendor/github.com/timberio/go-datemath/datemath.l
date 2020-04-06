/*
This file is used with golex to generate a lexer that has a signature compatible with goyacc.

Many constants referred to below are defined by goyacc when creating template.y.go

See https://godoc.org/modernc.org/golex for more about golex
*/

%{

package datemath

import (
	"bytes"
	"fmt"
	"strconv"
)

const (
	// 0 is expected by the goyacc generated parser to indicate EOF
	eofCode = 0
)

// lexer holds the state of the lexer
type lexer struct {
	src *bytes.Reader

	buf     []byte
	current byte

	pos int

	errors []string
}

func newLexer(b []byte) *lexer {
	l := &lexer{
		src: bytes.NewReader(b),
	}
	// queue up a byte
	l.next()
	return l
}

func (l *lexer) Error(s string) {
	l.errors = append(l.errors, fmt.Sprintf("%s at character %d starting with %q", s, l.pos, string(l.buf)))
}

func (l *lexer) next() {
	if l.current != 0 {
		l.buf = append(l.buf, l.current)
	}
	l.current = 0
	if b, err := l.src.ReadByte(); err == nil {
		l.current = b
	}
	l.pos++
}
func (l *lexer) Lex(lval *yySymType) int {
%}

/* give some regular expressions more semantic names for use below */
eof \0

/* tell golex how to determine the current start condition */
%yyt l.startCondition
/* tell golex how to determine the current byte */
%yyc l.current
/* tell golex how to advance to the next byte */
%yyn l.next()

%%
	// runs before each token is parsed
	l.buf = l.buf[:0]

[0-9]
  i, err := strconv.ParseInt(string(l.buf), 10, 0)
  if err != nil {
    panic(fmt.Sprintf("could not parse digit as number: %s", err))
  }
  lval.i = int(i)
  return tDIGIT

"now"
  return tNOW

"+"
	return tPLUS

"-"
	return tMINUS

":"
	return tCOLON

"||"
	return tPIPES

"/"
  return tBACKSLASH

[yMwdbhHms]
  switch l.buf[0] {
    case 'y':
      lval.unit = timeUnitYear
    case 'M':
      lval.unit = timeUnitMonth
    case 'w':
      lval.unit = timeUnitWeek
    case 'b':
      lval.unit = timeUnitBusinessDay
    case 'd':
      lval.unit = timeUnitDay
    case 'h', 'H':
      lval.unit = timeUnitHour
    case 'm':
      lval.unit = timeUnitMinute
    case 's':
      lval.unit = timeUnitSecond
    default:
        panic(fmt.Sprintf("unknown time unit: %q", l.buf[0]))
  }
	return tUNIT

\.
	return tDOT

"T"
	return tTIME_DELIMITER

"Z"
	return tUTC

{eof}
	return eofCode

.
  return tINVALID_TOKEN

%%

// should never get here
panic("scanner internal error")
}
