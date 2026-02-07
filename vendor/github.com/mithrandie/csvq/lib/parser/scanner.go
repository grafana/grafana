package parser

import (
	"bytes"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"unicode"

	"github.com/mithrandie/csvq/lib/option"

	"github.com/mithrandie/ternary"
)

const (
	EOF = -(iota + 1)
	Uncategorized
)

const (
	TokenFrom   = IDENTIFIER
	TokenTo     = SUBSTITUTION_OP
	KeywordFrom = SELECT
	KeywordTo   = JSON_OBJECT
)

const (
	VariableSign            = '@'
	EnvironmentVariableSign = '%'
	ExternalCommandSign     = '$'
	RuntimeInformationSign  = '#'

	SubstitutionOperator = ":="

	BeginExpression = '{'
	EndExpression   = '}'

	IdentifierDelimiter = ':'
)

var errTokenIsNotKeyword = errors.New("token is not keyword")
var errInvalidConstantSyntax = errors.New("invalid constant syntax")

var comparisonOperators = []string{
	">",
	"<",
	">=",
	"<=",
	"<>",
	"!=",
	"==",
}

var stringOperators = []string{
	"||",
}

var runesNotIncludedInUrl = []rune{
	'{',
	'}',
	'|',
	'\\',
	'^',
	'[',
	']',
	'`',
}

var aggregateFunctions = []string{
	"MIN",
	"MAX",
	"SUM",
	"AVG",
	"STDEV",
	"STDEVP",
	"VARP",
	"MEDIAN",
}

var listFunctions = []string{
	"LISTAGG",
	"JSON_AGG",
}

var analyticFunctions = []string{
	"ROW_NUMBER",
	"RANK",
	"DENSE_RANK",
	"CUME_DIST",
	"PERCENT_RANK",
	"NTILE",
}

var functionsNth = []string{
	"FIRST_VALUE",
	"LAST_VALUE",
	"NTH_VALUE",
}

var functionsWithIgnoreNulls = []string{
	"LAG",
	"LEAD",
}

var ConstantDelimiter = string(IdentifierDelimiter) + string(IdentifierDelimiter)

func TokenLiteral(token int) string {
	if TokenFrom <= token && token <= TokenTo {
		return yyToknames[token-TokenFrom+3]
	}
	return string(rune(token))
}

func KeywordLiteral(token int) (string, error) {
	if KeywordFrom <= token && token <= KeywordTo {
		return yyToknames[token-TokenFrom+3], nil
	}
	return string(rune(token)), errTokenIsNotKeyword
}

type Scanner struct {
	src     []rune
	srcPos  int
	literal bytes.Buffer

	line       int
	char       int
	sourceFile string

	forPrepared bool
	ansiQuotes  bool

	holderOrdinal int
	holderNames   []string
	holderNumber  int
}

func (s *Scanner) Init(src string, sourceFile string, forPrepared bool, ansiQuotes bool) *Scanner {
	s.src = []rune(src)
	s.srcPos = 0
	s.line = 1
	s.char = 0
	s.sourceFile = sourceFile
	s.forPrepared = forPrepared
	s.ansiQuotes = ansiQuotes
	s.holderOrdinal = 0
	s.holderNames = make([]string, 0, 10)
	s.holderNumber = 0
	return s
}

func (s *Scanner) HolderNumber() int {
	return s.holderNumber
}

func (s *Scanner) holderNameExists(name string) bool {
	for _, v := range s.holderNames {
		if name == v {
			return true
		}
	}
	return false
}

func (s *Scanner) peek() rune {
	return s.peekFurtherAhead(1)
}

func (s *Scanner) peekFurtherAhead(n int) rune {
	pos := n - 1 + s.srcPos

	if len(s.src) <= pos {
		return EOF
	}

	return s.src[pos]
}

func (s *Scanner) peekNextLetter(n int) rune {
	for unicode.IsSpace(s.peekFurtherAhead(n)) {
		n = n + 1
	}
	return s.peekFurtherAhead(n)
}

func (s *Scanner) next() rune {
	ch := s.peek()
	if ch == EOF {
		return ch
	}

	s.srcPos++
	s.char++

	ch = s.checkNewLine(ch)

	return ch
}

func (s *Scanner) checkNewLine(ch rune) rune {
	if ch != '\r' && ch != '\n' {
		return ch
	}

	if ch == '\r' && s.peek() == '\n' {
		s.srcPos++
	}

	s.line++
	s.char = 0
	return s.src[s.srcPos-1]
}

func (s *Scanner) Scan() (Token, error) {
	for unicode.IsSpace(s.peek()) {
		s.next()
	}

	ch := s.next()
	token := ch
	literal := string(ch)
	quoted := false
	line := s.line
	char := s.char
	var err error

	if s.forPrepared {
		switch ch {
		case '?':
			s.holderOrdinal++
			s.holderNumber++
			return Token{Token: PLACEHOLDER, Literal: literal, HolderOrdinal: s.holderOrdinal, Line: line, Char: char, SourceFile: s.sourceFile}, err
		case ':':
			if s.isIdentRune(s.peek()) {
				s.scanIdentifier(ch)
				holderName := s.literal.String()
				s.holderOrdinal++
				if !s.holderNameExists(holderName) {
					s.holderNames = append(s.holderNames, holderName)
					s.holderNumber++
				}
				return Token{Token: PLACEHOLDER, Literal: holderName, HolderOrdinal: s.holderOrdinal, Line: line, Char: char, SourceFile: s.sourceFile}, err
			}
		}
	}

	switch {
	case s.isDecimal(ch):
		token, err = s.scanNumber(ch)
		literal = s.literal.String()
	case s.isIdentRune(ch):
		s.scanIdentifier(ch)

		literal = s.literal.String()
		if _, e := ternary.ConvertFromString(literal); e == nil {
			token = TERNARY
		} else if t, e := s.searchKeyword(literal); e == nil {
			token = rune(t)
		} else if s.isAggregateFunctions(literal) {
			token = AGGREGATE_FUNCTION
		} else if s.isListaggFunctions(literal) {
			token = LIST_FUNCTION
		} else if s.isAnalyticFunctions(literal) {
			token = ANALYTIC_FUNCTION
		} else if s.isFunctionsNth(literal) {
			token = FUNCTION_NTH
		} else if s.isFunctionsWithIgnoreNulls(literal) {
			token = FUNCTION_WITH_INS
		} else {
			if unicode.IsLetter(ch) && s.peek() == ':' {
				if s.peekFurtherAhead(2) == ':' {
					if s.peekNextLetter(3) == '(' {
						s.next()
						s.next()
						token = TABLE_FUNCTION
					} else {
						s.literal.WriteRune(s.next())
						s.literal.WriteRune(s.next())
						err = s.scanConstant()
						literal = s.literal.String()
						token = CONSTANT
						if err != nil {
							token = Uncategorized
						}
					}
				} else {
					s.literal.WriteRune(s.next())
					s.scanUrl()
					literal = s.literal.String()
					token = URL
				}
			} else {
				token = IDENTIFIER
			}
		}
	case s.isOperatorRune(ch):
		s.scanOperator(ch)

		literal = s.literal.String()
		if s.isComparisonOperators(literal) {
			token = COMPARISON_OP
		} else if s.isStringOperators(literal) {
			token = STRING_OP
		} else if literal == SubstitutionOperator {
			token = SUBSTITUTION_OP
		} else if 1 < len(literal) {
			token = Uncategorized
		}
	case ch == VariableSign:
		switch s.peek() {
		case EnvironmentVariableSign:
			s.next()
			token = ENVIRONMENT_VARIABLE
		case RuntimeInformationSign:
			s.next()
			token = RUNTIME_INFORMATION
		case VariableSign:
			s.next()
			token = FLAG
		default:
			token = VARIABLE
		}

		if token == ENVIRONMENT_VARIABLE && s.peek() == '`' {
			err = s.scanString(s.next())
			literal = option.UnescapeIdentifier(s.literal.String(), '`')
			quoted = true
		} else {
			if s.isIdentRune(s.peek()) {
				s.scanIdentifier(s.next())
				literal = s.literal.String()
			} else {
				literal = ""
			}
		}

		if len(literal) < 1 {
			err = errors.New("invalid variable symbol")
		}
	case ch == ExternalCommandSign:
		s.scanExternalCommand()
		literal = s.literal.String()
		token = EXTERNAL_COMMAND
	case s.isCommentRune(ch):
		s.scanComment()
		return s.Scan()
	case s.isLineCommentRune(ch):
		s.scanLineComment()
		return s.Scan()
	default:
		if ch == '\'' || (!s.ansiQuotes && ch == '"') {
			err = s.scanString(ch)
			literal = option.UnescapeString(s.literal.String(), ch)
			token = STRING
		} else if ch == '`' || (s.ansiQuotes && ch == '"') {
			err = s.scanString(ch)
			literal = option.UnescapeIdentifier(s.literal.String(), ch)
			token = IDENTIFIER
			quoted = true
		}
	}

	return Token{Token: int(token), Literal: literal, Quoted: quoted, Line: line, Char: char, SourceFile: s.sourceFile}, err
}

func (s *Scanner) scanString(quote rune) error {
	s.literal.Reset()

	for {
		ch := s.next()

		if ch == EOF {
			return errors.New("literal not terminated")
		}

		if ch == quote {
			if s.peek() == quote {
				s.literal.WriteRune(ch)
				ch = s.next()
			} else {
				break
			}
		}

		if ch == '\\' {
			switch s.peek() {
			case '\\', quote:
				s.literal.WriteRune(ch)
				ch = s.next()
			}
		}
		s.literal.WriteRune(ch)
	}
	return nil
}

func (s *Scanner) scanIdentifier(head rune) {
	s.literal.Reset()

	s.literal.WriteRune(head)
	for s.isIdentRune(s.peek()) {
		s.literal.WriteRune(s.next())
	}
}

func (s *Scanner) scanConstant() error {
	if !s.isIdentRune(s.peek()) {
		return errInvalidConstantSyntax
	}
	s.literal.WriteRune(s.next())
	for s.isIdentRune(s.peek()) {
		s.literal.WriteRune(s.next())
	}
	return nil
}

func (s *Scanner) scanUrl() int {
	oldPos := s.srcPos
	for !unicode.IsSpace(s.peek()) && !s.isRuneNotIncludedInUrl(s.peek()) && s.peek() != EOF {
		s.literal.WriteRune(s.next())
	}
	return s.srcPos - oldPos
}

func (s *Scanner) isRuneNotIncludedInUrl(ch rune) bool {
	for _, r := range runesNotIncludedInUrl {
		if r == ch {
			return true
		}
	}
	return false
}

func (s *Scanner) isIdentRune(ch rune) bool {
	return ch == '_' || unicode.IsLetter(ch) || unicode.IsDigit(ch)
}

func (s *Scanner) isDecimal(ch rune) bool {
	return '0' <= ch && ch <= '9'
}

func (s *Scanner) scanNumber(head rune) (rune, error) {
	s.literal.Reset()
	var numType rune = INTEGER

	s.literal.WriteRune(head)
	for s.isDecimal(s.peek()) {
		s.literal.WriteRune(s.next())
	}

	if s.peek() == '.' {
		numType = FLOAT

		s.literal.WriteRune(s.next())
		for s.isDecimal(s.peek()) {
			s.literal.WriteRune(s.next())
		}
	}

	if s.peek() == 'e' || s.peek() == 'E' {
		numType = FLOAT

		s.literal.WriteRune(s.next())
		if s.peek() == '+' || s.peek() == '-' {
			s.literal.WriteRune(s.next())
		}
		for s.isDecimal(s.peek()) {
			s.literal.WriteRune(s.next())
		}
	}

	if numType == INTEGER {
		if _, err := strconv.ParseInt(s.literal.String(), 10, 64); err == nil {
			return numType, nil
		}
		numType = FLOAT
	}

	if _, err := strconv.ParseFloat(s.literal.String(), 64); err == nil {
		return numType, nil
	}

	return numType, errors.New(fmt.Sprintf("cound not convert %q to a number", s.literal.String()))
}

func (s *Scanner) scanOperator(head rune) {
	s.literal.Reset()

	s.literal.WriteRune(head)
	for s.isOperatorRune(s.peek()) {
		s.literal.WriteRune(s.next())
	}
}

func (s *Scanner) isOperatorRune(ch rune) bool {
	switch ch {
	case '=', '>', '<', '!', '|', ':':
		return true
	}
	return false
}

func (s *Scanner) searchKeyword(str string) (int, error) {
	for i := KeywordFrom; i <= KeywordTo; i++ {
		if strings.EqualFold(TokenLiteral(i), str) {
			return i, nil
		}
	}
	return IDENTIFIER, errors.New(fmt.Sprintf("%q is not a keyword", str))
}

func (s *Scanner) isAggregateFunctions(str string) bool {
	for _, v := range aggregateFunctions {
		if strings.EqualFold(v, str) {
			return true
		}
	}
	return false
}

func (s *Scanner) isListaggFunctions(str string) bool {
	for _, v := range listFunctions {
		if strings.EqualFold(v, str) {
			return true
		}
	}
	return false
}

func (s *Scanner) isAnalyticFunctions(str string) bool {
	for _, v := range analyticFunctions {
		if strings.EqualFold(v, str) {
			return true
		}
	}
	return false
}

func (s *Scanner) isFunctionsNth(str string) bool {
	for _, v := range functionsNth {
		if strings.EqualFold(v, str) {
			return true
		}
	}
	return false
}

func (s *Scanner) isFunctionsWithIgnoreNulls(str string) bool {
	for _, v := range functionsWithIgnoreNulls {
		if strings.EqualFold(v, str) {
			return true
		}
	}
	return false
}

func (s *Scanner) isComparisonOperators(str string) bool {
	for _, v := range comparisonOperators {
		if v == str {
			return true
		}
	}
	return false
}

func (s *Scanner) isStringOperators(str string) bool {
	for _, v := range stringOperators {
		if v == str {
			return true
		}
	}
	return false
}

func (s *Scanner) isCommentRune(ch rune) bool {
	if ch == '/' && s.peek() == '*' {
		s.next()
		return true
	}
	return false
}

func (s *Scanner) scanComment() {
	for {
		ch := s.next()
		if ch == EOF {
			break
		} else if ch == '*' {
			if s.peek() == '/' {
				s.next()
				break
			}
		}
	}
}

func (s *Scanner) isLineCommentRune(ch rune) bool {
	if ch == '-' && s.peek() == '-' {
		s.next()
		return true
	}
	return false
}

func (s *Scanner) scanLineComment() {
	for {
		ch := s.peek()
		if ch == '\r' || ch == '\n' || ch == EOF {
			break
		}
		s.next()
	}
}

func (s *Scanner) scanExternalCommand() {
	s.literal.Reset()

	for {
		ch := s.peek()
		if ch == ';' || ch == EOF {
			break
		}

		s.literal.WriteRune(s.next())

		if ch == '"' || ch == '\'' || ch == '`' {
			s.scanExternalCommandQuotedString(ch)
			continue
		}

		if ch == ExternalCommandSign && s.peek() == BeginExpression {
			s.literal.WriteRune(s.next())
			s.scanExternalCommandCSVQExpression()
		}
	}
}

func (s *Scanner) scanExternalCommandQuotedString(quote rune) {
	for {
		ch := s.peek()

		if ch == EOF {
			break
		}

		s.literal.WriteRune(s.next())

		if ch == quote {
			break
		}

		if ch == '\\' {
			switch s.peek() {
			case '\\', quote:
				s.literal.WriteRune(s.next())
			}
		}
	}
}

func (s *Scanner) scanExternalCommandCSVQExpression() {
	for {
		ch := s.peek()

		if ch == EOF {
			break
		}

		s.literal.WriteRune(s.next())

		if ch == EndExpression {
			break
		}

		if ch == '\\' {
			switch s.peek() {
			case '\\', BeginExpression, EndExpression:
				s.literal.WriteRune(s.next())
			}
		}
	}
}
