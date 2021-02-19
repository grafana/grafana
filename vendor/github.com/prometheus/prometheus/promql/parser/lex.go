// Copyright 2015 The Prometheus Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package parser

import (
	"fmt"
	"strings"
	"unicode"
	"unicode/utf8"
)

// Item represents a token or text string returned from the scanner.
type Item struct {
	Typ ItemType // The type of this Item.
	Pos Pos      // The starting position, in bytes, of this Item in the input string.
	Val string   // The value of this Item.
}

// String returns a descriptive string for the Item.
func (i Item) String() string {
	switch {
	case i.Typ == EOF:
		return "EOF"
	case i.Typ == ERROR:
		return i.Val
	case i.Typ == IDENTIFIER || i.Typ == METRIC_IDENTIFIER:
		return fmt.Sprintf("%q", i.Val)
	case i.Typ.IsKeyword():
		return fmt.Sprintf("<%s>", i.Val)
	case i.Typ.IsOperator():
		return fmt.Sprintf("<op:%s>", i.Val)
	case i.Typ.IsAggregator():
		return fmt.Sprintf("<aggr:%s>", i.Val)
	case len(i.Val) > 10:
		return fmt.Sprintf("%.10q...", i.Val)
	}
	return fmt.Sprintf("%q", i.Val)
}

// IsOperator returns true if the Item corresponds to a arithmetic or set operator.
// Returns false otherwise.
func (i ItemType) IsOperator() bool { return i > operatorsStart && i < operatorsEnd }

// IsAggregator returns true if the Item belongs to the aggregator functions.
// Returns false otherwise
func (i ItemType) IsAggregator() bool { return i > aggregatorsStart && i < aggregatorsEnd }

// IsAggregatorWithParam returns true if the Item is an aggregator that takes a parameter.
// Returns false otherwise
func (i ItemType) IsAggregatorWithParam() bool {
	return i == TOPK || i == BOTTOMK || i == COUNT_VALUES || i == QUANTILE
}

// IsKeyword returns true if the Item corresponds to a keyword.
// Returns false otherwise.
func (i ItemType) IsKeyword() bool { return i > keywordsStart && i < keywordsEnd }

// IsComparisonOperator returns true if the Item corresponds to a comparison operator.
// Returns false otherwise.
func (i ItemType) IsComparisonOperator() bool {
	switch i {
	case EQLC, NEQ, LTE, LSS, GTE, GTR:
		return true
	default:
		return false
	}
}

// IsSetOperator returns whether the Item corresponds to a set operator.
func (i ItemType) IsSetOperator() bool {
	switch i {
	case LAND, LOR, LUNLESS:
		return true
	}
	return false
}

type ItemType int

// This is a list of all keywords in PromQL.
// When changing this list, make sure to also change
// the maybe_label grammar rule in the generated parser
// to avoid misinterpretation of labels as keywords.
var key = map[string]ItemType{
	// Operators.
	"and":    LAND,
	"or":     LOR,
	"unless": LUNLESS,

	// Aggregators.
	"sum":          SUM,
	"avg":          AVG,
	"count":        COUNT,
	"min":          MIN,
	"max":          MAX,
	"group":        GROUP,
	"stddev":       STDDEV,
	"stdvar":       STDVAR,
	"topk":         TOPK,
	"bottomk":      BOTTOMK,
	"count_values": COUNT_VALUES,
	"quantile":     QUANTILE,

	// Keywords.
	"offset":      OFFSET,
	"by":          BY,
	"without":     WITHOUT,
	"on":          ON,
	"ignoring":    IGNORING,
	"group_left":  GROUP_LEFT,
	"group_right": GROUP_RIGHT,
	"bool":        BOOL,
}

// ItemTypeStr is the default string representations for common Items. It does not
// imply that those are the only character sequences that can be lexed to such an Item.
var ItemTypeStr = map[ItemType]string{
	LEFT_PAREN:    "(",
	RIGHT_PAREN:   ")",
	LEFT_BRACE:    "{",
	RIGHT_BRACE:   "}",
	LEFT_BRACKET:  "[",
	RIGHT_BRACKET: "]",
	COMMA:         ",",
	EQL:           "=",
	COLON:         ":",
	SEMICOLON:     ";",
	BLANK:         "_",
	TIMES:         "x",
	SPACE:         "<space>",

	SUB:       "-",
	ADD:       "+",
	MUL:       "*",
	MOD:       "%",
	DIV:       "/",
	EQLC:      "==",
	NEQ:       "!=",
	LTE:       "<=",
	LSS:       "<",
	GTE:       ">=",
	GTR:       ">",
	EQL_REGEX: "=~",
	NEQ_REGEX: "!~",
	POW:       "^",
}

func init() {
	// Add keywords to Item type strings.
	for s, ty := range key {
		ItemTypeStr[ty] = s
	}
	// Special numbers.
	key["inf"] = NUMBER
	key["nan"] = NUMBER
}

func (i ItemType) String() string {
	if s, ok := ItemTypeStr[i]; ok {
		return s
	}
	return fmt.Sprintf("<Item %d>", i)
}

func (i Item) desc() string {
	if _, ok := ItemTypeStr[i.Typ]; ok {
		return i.String()
	}
	if i.Typ == EOF {
		return i.Typ.desc()
	}
	return fmt.Sprintf("%s %s", i.Typ.desc(), i)
}

func (i ItemType) desc() string {
	switch i {
	case ERROR:
		return "error"
	case EOF:
		return "end of input"
	case COMMENT:
		return "comment"
	case IDENTIFIER:
		return "identifier"
	case METRIC_IDENTIFIER:
		return "metric identifier"
	case STRING:
		return "string"
	case NUMBER:
		return "number"
	case DURATION:
		return "duration"
	}
	return fmt.Sprintf("%q", i)
}

const eof = -1

// stateFn represents the state of the scanner as a function that returns the next state.
type stateFn func(*Lexer) stateFn

// Pos is the position in a string.
// Negative numbers indicate undefined positions.
type Pos int

// Lexer holds the state of the scanner.
type Lexer struct {
	input       string  // The string being scanned.
	state       stateFn // The next lexing function to enter.
	pos         Pos     // Current position in the input.
	start       Pos     // Start position of this Item.
	width       Pos     // Width of last rune read from input.
	lastPos     Pos     // Position of most recent Item returned by NextItem.
	itemp       *Item   // Pointer to where the next scanned item should be placed.
	scannedItem bool    // Set to true every time an item is scanned.

	parenDepth  int  // Nesting depth of ( ) exprs.
	braceOpen   bool // Whether a { is opened.
	bracketOpen bool // Whether a [ is opened.
	gotColon    bool // Whether we got a ':' after [ was opened.
	stringOpen  rune // Quote rune of the string currently being read.

	// seriesDesc is set when a series description for the testing
	// language is lexed.
	seriesDesc bool
}

// next returns the next rune in the input.
func (l *Lexer) next() rune {
	if int(l.pos) >= len(l.input) {
		l.width = 0
		return eof
	}
	r, w := utf8.DecodeRuneInString(l.input[l.pos:])
	l.width = Pos(w)
	l.pos += l.width
	return r
}

// peek returns but does not consume the next rune in the input.
func (l *Lexer) peek() rune {
	r := l.next()
	l.backup()
	return r
}

// backup steps back one rune. Can only be called once per call of next.
func (l *Lexer) backup() {
	l.pos -= l.width
}

// emit passes an Item back to the client.
func (l *Lexer) emit(t ItemType) {
	*l.itemp = Item{t, l.start, l.input[l.start:l.pos]}
	l.start = l.pos
	l.scannedItem = true
}

// ignore skips over the pending input before this point.
func (l *Lexer) ignore() {
	l.start = l.pos
}

// accept consumes the next rune if it's from the valid set.
func (l *Lexer) accept(valid string) bool {
	if strings.ContainsRune(valid, l.next()) {
		return true
	}
	l.backup()
	return false
}

// acceptRun consumes a run of runes from the valid set.
func (l *Lexer) acceptRun(valid string) {
	for strings.ContainsRune(valid, l.next()) {
		// consume
	}
	l.backup()
}

// errorf returns an error token and terminates the scan by passing
// back a nil pointer that will be the next state, terminating l.NextItem.
func (l *Lexer) errorf(format string, args ...interface{}) stateFn {
	*l.itemp = Item{ERROR, l.start, fmt.Sprintf(format, args...)}
	l.scannedItem = true

	return nil
}

// NextItem writes the next item to the provided address.
func (l *Lexer) NextItem(itemp *Item) {
	l.scannedItem = false
	l.itemp = itemp

	if l.state != nil {
		for !l.scannedItem {
			l.state = l.state(l)
		}
	} else {
		l.emit(EOF)
	}

	l.lastPos = l.itemp.Pos
}

// Lex creates a new scanner for the input string.
func Lex(input string) *Lexer {
	l := &Lexer{
		input: input,
		state: lexStatements,
	}
	return l
}

// lineComment is the character that starts a line comment.
const lineComment = "#"

// lexStatements is the top-level state for lexing.
func lexStatements(l *Lexer) stateFn {
	if l.braceOpen {
		return lexInsideBraces
	}
	if strings.HasPrefix(l.input[l.pos:], lineComment) {
		return lexLineComment
	}

	switch r := l.next(); {
	case r == eof:
		if l.parenDepth != 0 {
			return l.errorf("unclosed left parenthesis")
		} else if l.bracketOpen {
			return l.errorf("unclosed left bracket")
		}
		l.emit(EOF)
		return nil
	case r == ',':
		l.emit(COMMA)
	case isSpace(r):
		return lexSpace
	case r == '*':
		l.emit(MUL)
	case r == '/':
		l.emit(DIV)
	case r == '%':
		l.emit(MOD)
	case r == '+':
		l.emit(ADD)
	case r == '-':
		l.emit(SUB)
	case r == '^':
		l.emit(POW)
	case r == '=':
		if t := l.peek(); t == '=' {
			l.next()
			l.emit(EQLC)
		} else if t == '~' {
			return l.errorf("unexpected character after '=': %q", t)
		} else {
			l.emit(EQL)
		}
	case r == '!':
		if t := l.next(); t == '=' {
			l.emit(NEQ)
		} else {
			return l.errorf("unexpected character after '!': %q", t)
		}
	case r == '<':
		if t := l.peek(); t == '=' {
			l.next()
			l.emit(LTE)
		} else {
			l.emit(LSS)
		}
	case r == '>':
		if t := l.peek(); t == '=' {
			l.next()
			l.emit(GTE)
		} else {
			l.emit(GTR)
		}
	case isDigit(r) || (r == '.' && isDigit(l.peek())):
		l.backup()
		return lexNumberOrDuration
	case r == '"' || r == '\'':
		l.stringOpen = r
		return lexString
	case r == '`':
		l.stringOpen = r
		return lexRawString
	case isAlpha(r) || r == ':':
		if !l.bracketOpen {
			l.backup()
			return lexKeywordOrIdentifier
		}
		if l.gotColon {
			return l.errorf("unexpected colon %q", r)
		}
		l.emit(COLON)
		l.gotColon = true
	case r == '(':
		l.emit(LEFT_PAREN)
		l.parenDepth++
		return lexStatements
	case r == ')':
		l.emit(RIGHT_PAREN)
		l.parenDepth--
		if l.parenDepth < 0 {
			return l.errorf("unexpected right parenthesis %q", r)
		}
		return lexStatements
	case r == '{':
		l.emit(LEFT_BRACE)
		l.braceOpen = true
		return lexInsideBraces
	case r == '[':
		if l.bracketOpen {
			return l.errorf("unexpected left bracket %q", r)
		}
		l.gotColon = false
		l.emit(LEFT_BRACKET)
		if isSpace(l.peek()) {
			skipSpaces(l)
		}
		l.bracketOpen = true
		return lexDuration
	case r == ']':
		if !l.bracketOpen {
			return l.errorf("unexpected right bracket %q", r)
		}
		l.emit(RIGHT_BRACKET)
		l.bracketOpen = false

	default:
		return l.errorf("unexpected character: %q", r)
	}
	return lexStatements
}

// lexInsideBraces scans the inside of a vector selector. Keywords are ignored and
// scanned as identifiers.
func lexInsideBraces(l *Lexer) stateFn {
	if strings.HasPrefix(l.input[l.pos:], lineComment) {
		return lexLineComment
	}

	switch r := l.next(); {
	case r == eof:
		return l.errorf("unexpected end of input inside braces")
	case isSpace(r):
		return lexSpace
	case isAlpha(r):
		l.backup()
		return lexIdentifier
	case r == ',':
		l.emit(COMMA)
	case r == '"' || r == '\'':
		l.stringOpen = r
		return lexString
	case r == '`':
		l.stringOpen = r
		return lexRawString
	case r == '=':
		if l.next() == '~' {
			l.emit(EQL_REGEX)
			break
		}
		l.backup()
		l.emit(EQL)
	case r == '!':
		switch nr := l.next(); {
		case nr == '~':
			l.emit(NEQ_REGEX)
		case nr == '=':
			l.emit(NEQ)
		default:
			return l.errorf("unexpected character after '!' inside braces: %q", nr)
		}
	case r == '{':
		return l.errorf("unexpected left brace %q", r)
	case r == '}':
		l.emit(RIGHT_BRACE)
		l.braceOpen = false

		if l.seriesDesc {
			return lexValueSequence
		}
		return lexStatements
	default:
		return l.errorf("unexpected character inside braces: %q", r)
	}
	return lexInsideBraces
}

// lexValueSequence scans a value sequence of a series description.
func lexValueSequence(l *Lexer) stateFn {
	switch r := l.next(); {
	case r == eof:
		return lexStatements
	case isSpace(r):
		l.emit(SPACE)
		lexSpace(l)
	case r == '+':
		l.emit(ADD)
	case r == '-':
		l.emit(SUB)
	case r == 'x':
		l.emit(TIMES)
	case r == '_':
		l.emit(BLANK)
	case isDigit(r) || (r == '.' && isDigit(l.peek())):
		l.backup()
		lexNumber(l)
	case isAlpha(r):
		l.backup()
		// We might lex invalid Items here but this will be caught by the parser.
		return lexKeywordOrIdentifier
	default:
		return l.errorf("unexpected character in series sequence: %q", r)
	}
	return lexValueSequence
}

// lexEscape scans a string escape sequence. The initial escaping character (\)
// has already been seen.
//
// NOTE: This function as well as the helper function digitVal() and associated
// tests have been adapted from the corresponding functions in the "go/scanner"
// package of the Go standard library to work for Prometheus-style strings.
// None of the actual escaping/quoting logic was changed in this function - it
// was only modified to integrate with our lexer.
func lexEscape(l *Lexer) stateFn {
	var n int
	var base, max uint32

	ch := l.next()
	switch ch {
	case 'a', 'b', 'f', 'n', 'r', 't', 'v', '\\', l.stringOpen:
		return lexString
	case '0', '1', '2', '3', '4', '5', '6', '7':
		n, base, max = 3, 8, 255
	case 'x':
		ch = l.next()
		n, base, max = 2, 16, 255
	case 'u':
		ch = l.next()
		n, base, max = 4, 16, unicode.MaxRune
	case 'U':
		ch = l.next()
		n, base, max = 8, 16, unicode.MaxRune
	case eof:
		l.errorf("escape sequence not terminated")
		return lexString
	default:
		l.errorf("unknown escape sequence %#U", ch)
		return lexString
	}

	var x uint32
	for n > 0 {
		d := uint32(digitVal(ch))
		if d >= base {
			if ch == eof {
				l.errorf("escape sequence not terminated")
				return lexString
			}
			l.errorf("illegal character %#U in escape sequence", ch)
			return lexString
		}
		x = x*base + d
		ch = l.next()
		n--
	}

	if x > max || 0xD800 <= x && x < 0xE000 {
		l.errorf("escape sequence is an invalid Unicode code point")
	}
	return lexString
}

// digitVal returns the digit value of a rune or 16 in case the rune does not
// represent a valid digit.
func digitVal(ch rune) int {
	switch {
	case '0' <= ch && ch <= '9':
		return int(ch - '0')
	case 'a' <= ch && ch <= 'f':
		return int(ch - 'a' + 10)
	case 'A' <= ch && ch <= 'F':
		return int(ch - 'A' + 10)
	}
	return 16 // Larger than any legal digit val.
}

// skipSpaces skips the spaces until a non-space is encountered.
func skipSpaces(l *Lexer) {
	for isSpace(l.peek()) {
		l.next()
	}
	l.ignore()
}

// lexString scans a quoted string. The initial quote has already been seen.
func lexString(l *Lexer) stateFn {
Loop:
	for {
		switch l.next() {
		case '\\':
			return lexEscape
		case utf8.RuneError:
			l.errorf("invalid UTF-8 rune")
			return lexString
		case eof, '\n':
			return l.errorf("unterminated quoted string")
		case l.stringOpen:
			break Loop
		}
	}
	l.emit(STRING)
	return lexStatements
}

// lexRawString scans a raw quoted string. The initial quote has already been seen.
func lexRawString(l *Lexer) stateFn {
Loop:
	for {
		switch l.next() {
		case utf8.RuneError:
			l.errorf("invalid UTF-8 rune")
			return lexRawString
		case eof:
			l.errorf("unterminated raw string")
			return lexRawString
		case l.stringOpen:
			break Loop
		}
	}
	l.emit(STRING)
	return lexStatements
}

// lexSpace scans a run of space characters. One space has already been seen.
func lexSpace(l *Lexer) stateFn {
	for isSpace(l.peek()) {
		l.next()
	}
	l.ignore()
	return lexStatements
}

// lexLineComment scans a line comment. Left comment marker is known to be present.
func lexLineComment(l *Lexer) stateFn {
	l.pos += Pos(len(lineComment))
	for r := l.next(); !isEndOfLine(r) && r != eof; {
		r = l.next()
	}
	l.backup()
	l.emit(COMMENT)
	return lexStatements
}

func lexDuration(l *Lexer) stateFn {
	if l.scanNumber() {
		return l.errorf("missing unit character in duration")
	}
	if !acceptRemainingDuration(l) {
		return l.errorf("bad duration syntax: %q", l.input[l.start:l.pos])
	}
	l.backup()
	l.emit(DURATION)
	return lexStatements
}

// lexNumber scans a number: decimal, hex, oct or float.
func lexNumber(l *Lexer) stateFn {
	if !l.scanNumber() {
		return l.errorf("bad number syntax: %q", l.input[l.start:l.pos])
	}
	l.emit(NUMBER)
	return lexStatements
}

// lexNumberOrDuration scans a number or a duration Item.
func lexNumberOrDuration(l *Lexer) stateFn {
	if l.scanNumber() {
		l.emit(NUMBER)
		return lexStatements
	}
	// Next two chars must be a valid unit and a non-alphanumeric.
	if acceptRemainingDuration(l) {
		l.backup()
		l.emit(DURATION)
		return lexStatements
	}
	return l.errorf("bad number or duration syntax: %q", l.input[l.start:l.pos])
}

func acceptRemainingDuration(l *Lexer) bool {
	// Next two char must be a valid duration.
	if !l.accept("smhdwy") {
		return false
	}
	// Support for ms. Bad units like hs, ys will be caught when we actually
	// parse the duration.
	l.accept("s")
	// Next char can be another number then a unit.
	for l.accept("0123456789") {
		for l.accept("0123456789") {
		}
		// y is no longer in the list as it should always come first in
		// durations.
		if !l.accept("smhdw") {
			return false
		}
		// Support for ms. Bad units like hs, ys will be caught when we actually
		// parse the duration.
		l.accept("s")
	}
	return !isAlphaNumeric(l.next())
}

// scanNumber scans numbers of different formats. The scanned Item is
// not necessarily a valid number. This case is caught by the parser.
func (l *Lexer) scanNumber() bool {
	digits := "0123456789"
	// Disallow hexadecimal in series descriptions as the syntax is ambiguous.
	if !l.seriesDesc && l.accept("0") && l.accept("xX") {
		digits = "0123456789abcdefABCDEF"
	}
	l.acceptRun(digits)
	if l.accept(".") {
		l.acceptRun(digits)
	}
	if l.accept("eE") {
		l.accept("+-")
		l.acceptRun("0123456789")
	}
	// Next thing must not be alphanumeric unless it's the times token
	// for series repetitions.
	if r := l.peek(); (l.seriesDesc && r == 'x') || !isAlphaNumeric(r) {
		return true
	}
	return false
}

// lexIdentifier scans an alphanumeric identifier. The next character
// is known to be a letter.
func lexIdentifier(l *Lexer) stateFn {
	for isAlphaNumeric(l.next()) {
		// absorb
	}
	l.backup()
	l.emit(IDENTIFIER)
	return lexStatements
}

// lexKeywordOrIdentifier scans an alphanumeric identifier which may contain
// a colon rune. If the identifier is a keyword the respective keyword Item
// is scanned.
func lexKeywordOrIdentifier(l *Lexer) stateFn {
Loop:
	for {
		switch r := l.next(); {
		case isAlphaNumeric(r) || r == ':':
			// absorb.
		default:
			l.backup()
			word := l.input[l.start:l.pos]
			if kw, ok := key[strings.ToLower(word)]; ok {
				l.emit(kw)
			} else if !strings.Contains(word, ":") {
				l.emit(IDENTIFIER)
			} else {
				l.emit(METRIC_IDENTIFIER)
			}
			break Loop
		}
	}
	if l.seriesDesc && l.peek() != '{' {
		return lexValueSequence
	}
	return lexStatements
}

func isSpace(r rune) bool {
	return r == ' ' || r == '\t' || r == '\n' || r == '\r'
}

// isEndOfLine reports whether r is an end-of-line character.
func isEndOfLine(r rune) bool {
	return r == '\r' || r == '\n'
}

// isAlphaNumeric reports whether r is an alphabetic, digit, or underscore.
func isAlphaNumeric(r rune) bool {
	return isAlpha(r) || isDigit(r)
}

// isDigit reports whether r is a digit. Note: we cannot use unicode.IsDigit()
// instead because that also classifies non-Latin digits as digits. See
// https://github.com/prometheus/prometheus/issues/939.
func isDigit(r rune) bool {
	return '0' <= r && r <= '9'
}

// isAlpha reports whether r is an alphabetic or underscore.
func isAlpha(r rune) bool {
	return r == '_' || ('a' <= r && r <= 'z') || ('A' <= r && r <= 'Z')
}

// isLabel reports whether the string can be used as label.
func isLabel(s string) bool {
	if len(s) == 0 || !isAlpha(rune(s[0])) {
		return false
	}
	for _, c := range s[1:] {
		if !isAlphaNumeric(c) {
			return false
		}
	}
	return true
}
