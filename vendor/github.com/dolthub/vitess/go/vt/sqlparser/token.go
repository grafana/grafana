/*
Copyright 2019 The Vitess Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package sqlparser

import (
	"bytes"
	"fmt"
	"io"
	"strconv"
	"strings"
	"unicode"

	"github.com/dolthub/vitess/go/bytes2"
	"github.com/dolthub/vitess/go/sqltypes"
	"github.com/dolthub/vitess/go/vt/vterrors"
)

const (
	defaultBufSize = 4096
	eofChar        = 0x100
	backtickQuote  = uint16('`')
	doubleQuote    = uint16('"')
	singleQuote    = uint16('\'')
)

type tokenAndValue struct {
	value []byte
	token int
}

// Tokenizer is the struct used to generate SQL
// tokens for the parser.
type Tokenizer struct {
	ParseTree Statement
	LastError error
	InStream  io.Reader
	// stringLiteralQuotes holds the characters that are treated as string literal quotes. This always includes the
	// single quote char. When ANSI_QUOTES SQL mode is NOT enabled, this also contains the double quote character.
	stringLiteralQuotes map[uint16]struct{}
	// identifierQuotes holds the characters that are treated as identifier quotes. This always includes
	// the backtick char. When the ANSI_QUOTES SQL mode is enabled, it also includes the double quote char.
	identifierQuotes     map[uint16]struct{}
	specialComment       *Tokenizer
	digestedTokens       []tokenAndValue
	queryBuf             []byte
	buf                  []byte
	lastToken            []byte
	lastNonNilToken      []byte
	nesting              int
	bufPos               int
	bufSize              int
	specialCommentEndPos int
	posVarIndex          int
	Position             int
	OldPosition          int
	lastTyp              int
	lastChar             uint16
	stopped              bool
	// If true, the parser should collaborate to set `stopped` on this
	// tokenizer after a statement is parsed. From that point forward, the
	// tokenizer will return EOF, instead of new tokens. `ParseOne` uses
	// this to parse the first delimited statement and then return the
	// trailer.
	stopAfterFirstStmt   bool
	potentialAccountName bool
	multi                bool
	SkipSpecialComments  bool
	AllowComments        bool
	PipesAsConcat        bool
}

var defaultIdQuotes = map[uint16]struct{}{backtickQuote: {}}
var defaultStrLitQuotes = map[uint16]struct{}{doubleQuote: {}, singleQuote: {}}
var ansiIdQuotes = map[uint16]struct{}{backtickQuote: {}, doubleQuote: {}}
var ansiStrLitQuotes = map[uint16]struct{}{singleQuote: {}}

// NewStringTokenizer creates a new Tokenizer for the
// sql string.
func NewStringTokenizer(sql string) *Tokenizer {
	buf := []byte(sql)
	return &Tokenizer{
		buf:                 buf,
		bufSize:             len(buf),
		identifierQuotes:    defaultIdQuotes,
		stringLiteralQuotes: defaultStrLitQuotes,
	}
}

// NewStringTokenizerForAnsiQuotes creates a new Tokenizer for the specified |sql| string, configured for
// ANSI_QUOTES SQL mode, meaning that any double quotes will be interpreted as quotes around an identifier,
// not around a string literal.
func NewStringTokenizerForAnsiQuotes(sql string) *Tokenizer {
	buf := []byte(sql)
	return &Tokenizer{
		buf:                 buf,
		bufSize:             len(buf),
		identifierQuotes:    map[uint16]struct{}{backtickQuote: {}, doubleQuote: {}},
		stringLiteralQuotes: map[uint16]struct{}{singleQuote: {}},
	}
}

// NewTokenizer creates a new Tokenizer reading a sql string from the io.Reader, using the
// default parser options.
func NewTokenizer(r io.Reader) *Tokenizer {
	return &Tokenizer{
		InStream:            r,
		buf:                 make([]byte, defaultBufSize),
		identifierQuotes:    map[uint16]struct{}{backtickQuote: {}},
		stringLiteralQuotes: map[uint16]struct{}{doubleQuote: {}, singleQuote: {}},
	}
}

// KeywordString returns the string corresponding to the given keyword
func KeywordString(id int) string {
	str, ok := keywordStrings[id]
	if !ok {
		return ""
	}
	return str
}

// Lex returns the next token from the Tokenizer.
// This function is used by go yacc.
func (tkn *Tokenizer) Lex(lval *yySymType) int {
	typ, val := tkn.Scan()
	for typ == COMMENT {
		if tkn.AllowComments {
			break
		}
		typ, val = tkn.Scan()
	}
	lval.bytes = val
	tkn.lastToken = val
	tkn.lastTyp = typ
	if val != nil {
		tkn.lastNonNilToken = val
	}
	return typ
}

// Error is called by go yacc if there's a parsing error.
func (tkn *Tokenizer) Error(err string) {
	buf := &bytes2.Buffer{}

	position := tkn.Position
	// Adjust the position in case we've read ahead any tokens
	if len(tkn.digestedTokens) > 0 {
		for _, tokenAndValue := range tkn.digestedTokens {
			position -= len(tokenAndValue.value) + 1
		}
	}

	if tkn.lastNonNilToken != nil {
		fmt.Fprintf(buf, "%s at position %v near '%s'", err, position, tkn.lastNonNilToken)
	} else {
		fmt.Fprintf(buf, "%s at position %v", err, position)
	}
	tkn.LastError = vterrors.SyntaxError{Message: buf.String(), Position: position, Statement: string(tkn.buf)}

	// Try and re-sync to the next statement
	tkn.skipStatement()
}

// digestToken stores a token and its value for later retrieval when necessary for additional look-ahead
func (tkn *Tokenizer) digestToken(token int, value []byte) {
	tkn.digestedTokens = append(tkn.digestedTokens, tokenAndValue{token: token, value: value})
}

// digestedToken returns the first digested token and removes it from the list of digested tokens
func (tkn *Tokenizer) digestedToken() (token int, value []byte) {
	if tkn.digestedTokens == nil || len(tkn.digestedTokens) == 0 {
		panic("popDigestedToken called with no digested tokens")
	}
	length := len(tkn.digestedTokens)
	tokenAndValue := tkn.digestedTokens[length-1]
	tkn.digestedTokens = tkn.digestedTokens[0 : length-1]

	if len(tkn.digestedTokens) == 0 {
		tkn.digestedTokens = nil
	}
	return tokenAndValue.token, tokenAndValue.value
}

// Scan scans the tokenizer for the next token and returns
// the token type and an optional value.
func (tkn *Tokenizer) Scan() (int, []byte) {
	if tkn.stopped {
		return 0, nil
	}

	if tkn.digestedTokens != nil {
		return tkn.digestedToken()
	}

	tkn.OldPosition = tkn.Position

	if tkn.specialComment != nil {
		// Enter specialComment scan mode.
		// for scanning such kind of comment: /*! MySQL-specific code */
		tok, val := tkn.specialComment.Scan()
		tkn.Position = tkn.specialComment.Position

		if tok != 0 {
			// return the specialComment scan result as the result
			return tok, val
		}

		// reset the position to what it was when we originally finished parsing the special comment
		tkn.Position = tkn.specialCommentEndPos

		// leave specialComment scan mode after all stream consumed.
		tkn.specialComment = nil
	}

	if tkn.potentialAccountName {
		defer func() {
			tkn.potentialAccountName = false
		}()
	}

	if tkn.lastChar == 0 {
		tkn.next()
	}

	tkn.skipBlank()
	switch ch := tkn.lastChar; {
	case isLetter(ch):
		tkn.next()
		if ch == 'X' || ch == 'x' {
			if tkn.lastChar == '\'' {
				tkn.next()
				return tkn.scanHex()
			}
		}
		if ch == 'B' || ch == 'b' {
			if tkn.lastChar == '\'' {
				tkn.next()
				return tkn.scanBitLiteral()
			}
		}
		return tkn.scanIdentifier(byte(ch), false)
	case ch == '@':
		tkn.next()
		if tkn.potentialAccountName {
			return int('@'), nil
		}
		isDbSystemVariable := false
		if ch == '@' && tkn.lastChar == '@' {
			isDbSystemVariable = true
		}
		return tkn.scanIdentifier(byte(ch), isDbSystemVariable)
	case isDigit(ch):
		typ, res := tkn.scanNumber(false)
		if typ != LEX_ERROR {
			return typ, res
		}
		// LEX_ERROR is returned from scanNumber iff we see an unexpected character, so try to parse as an identifier
		// Additionally, if we saw a decimal at any point, throw the LEX_ERROR we received before
		for _, c := range res {
			if c == '.' {
				return typ, res
			}
		}
		typ1, res1 := tkn.scanIdentifier(byte(tkn.lastChar), false)
		return typ1, append(res, res1[1:]...) // Concatenate the two partial symbols
	case ch == ':':
		return tkn.scanColonPrefixToken()
	case ch == ';':
		if tkn.multi {
			// In multi mode, ';' is treated as EOF. So, we don't advance.
			// Repeated calls to Scan will keep returning 0 until ParseNext
			// forces the advance.
			return 0, nil
		}
		tkn.next()
		return ';', nil
	case ch == eofChar:
		return 0, nil
	default:
		tkn.next()
		switch ch {
		case '=', ',', '(', ')', '+', '*', '%', '^', '~':
			return int(ch), nil
		case '&':
			if tkn.lastChar == '&' {
				tkn.next()
				return AND, nil
			}
			return int(ch), nil
		case '|':
			if tkn.lastChar == '|' {
				tkn.next()
				if tkn.PipesAsConcat {
					return CONCAT, nil
				}
				return OR, nil
			}
			return int(ch), nil
		case '?':
			tkn.posVarIndex++
			buf := new(bytes2.Buffer)
			fmt.Fprintf(buf, ":v%d", tkn.posVarIndex)
			return VALUE_ARG, buf.Bytes()
		case '.':
			if isDigit(tkn.lastChar) {
				return tkn.scanNumber(true)
			}
			return int(ch), nil
		case '/':
			switch tkn.lastChar {
			case '/':
				tkn.next()
				return tkn.scanCommentType1("//")
			case '*':
				tkn.next()
				if tkn.lastChar == '!' && !tkn.SkipSpecialComments {
					return tkn.scanMySQLSpecificComment()
				}
				return tkn.scanCommentType2()
			default:
				return int(ch), nil
			}
		case '#':
			return tkn.scanCommentType1("#")
		case '-':
			switch tkn.lastChar {
			case '-':
				tkn.next()
				return tkn.scanCommentType1("--")
			case '>':
				tkn.next()
				if tkn.lastChar == '>' {
					tkn.next()
					return JSON_UNQUOTE_EXTRACT_OP, nil
				}
				return JSON_EXTRACT_OP, nil
			}
			return int(ch), nil
		case '<':
			switch tkn.lastChar {
			case '>':
				tkn.next()
				return NE, nil
			case '<':
				tkn.next()
				return SHIFT_LEFT, nil
			case '=':
				tkn.next()
				switch tkn.lastChar {
				case '>':
					tkn.next()
					return NULL_SAFE_EQUAL, nil
				default:
					return LE, nil
				}
			default:
				return int(ch), nil
			}
		case '>':
			switch tkn.lastChar {
			case '=':
				tkn.next()
				return GE, nil
			case '>':
				tkn.next()
				return SHIFT_RIGHT, nil
			default:
				return int(ch), nil
			}
		case '!':
			if tkn.lastChar == '=' {
				tkn.next()
				return NE, nil
			}
			return int(ch), nil
		case contains(tkn.stringLiteralQuotes, ch):
			return tkn.scanString(ch, STRING)
		case contains(tkn.identifierQuotes, ch):
			return tkn.scanLiteralIdentifier(ch)
		default:
			return LEX_ERROR, []byte{byte(ch)}
		}
	}
}

// contains searches the specified map |m| for the target key |x|, and returns the same value of |x| if it is found.
// If the target value, |x|, is NOT found, zero is returned. The target value is returned, instead of a boolean, so
// that this function can be directly used inside the switch statement above that switches on a uint16 value.
func contains(m map[uint16]struct{}, x uint16) uint16 {
	if _, ok := m[x]; ok {
		return x
	}
	return 0
}

// skipStatement scans until end of statement.
func (tkn *Tokenizer) skipStatement() int {
	for {
		typ, _ := tkn.Scan()
		if typ == 0 || typ == ';' || typ == LEX_ERROR {
			return typ
		}
	}
}

func (tkn *Tokenizer) skipBlank() {
	ch := tkn.lastChar
	for ch == ' ' || ch == '\n' || ch == '\r' || ch == '\t' {
		tkn.next()
		ch = tkn.lastChar
	}
}

func (tkn *Tokenizer) scanIdentifier(firstByte byte, isDbSystemVariable bool) (int, []byte) {
	buffer := &bytes2.Buffer{}
	buffer.WriteByte(firstByte)
	if isDbSystemVariable {
		buffer.WriteByte(byte(tkn.lastChar))
		tkn.next()
	}
	for isLetter(tkn.lastChar) || isDigit(tkn.lastChar) || (isDbSystemVariable && isCarat(tkn.lastChar)) {
		buffer.WriteByte(byte(tkn.lastChar))
		tkn.next()
	}

	// special case for user variables with backticks
	if firstByte == '@' && tkn.lastChar == '`' {
		buffer.WriteByte(byte(tkn.lastChar))
		tkn.next()
		for isLetter(tkn.lastChar) || isDigit(tkn.lastChar) || isCarat(tkn.lastChar) || unicode.IsSpace(rune(tkn.lastChar)) {
			buffer.WriteByte(byte(tkn.lastChar))
			if tkn.lastChar == '`' {
				tkn.next()
				break
			}
			tkn.next()
		}
	}

	if tkn.lastChar == '@' {
		tkn.potentialAccountName = true
	}
	lowered := bytes.ToLower(buffer.Bytes())
	loweredStr := string(lowered)
	keywordID, found := keywords[loweredStr]
	if found {
		// Some tokens require special handling to avoid conflicts in the grammar.
		// This means we're doing additional look-ahead just for these special tokens.
		switch keywordID {
		case FOR:
			token, val := tkn.Scan()
			switch token {
			case SYSTEM_TIME:
				return FOR_SYSTEM_TIME, append(buffer.Bytes(), append([]byte{' '}, val...)...)
			case VERSION:
				return FOR_VERSION, append(buffer.Bytes(), append([]byte{' '}, val...)...)
			default:
				tkn.digestToken(token, val)
				return FOR, buffer.Bytes()
			}
		case NOT:
			token, val := tkn.Scan()
			switch token {
			case ENFORCED:
				return NOT_ENFORCED, append(buffer.Bytes(), append([]byte{' '}, val...)...)
			default:
				tkn.digestToken(token, val)
				return NOT, buffer.Bytes()
			}
		}

		return keywordID, buffer.Bytes()
	}

	return ID, buffer.Bytes()
}

func (tkn *Tokenizer) scanHex() (int, []byte) {
	buffer := &bytes2.Buffer{}
	tkn.scanMantissa(16, buffer)
	if tkn.lastChar != singleQuote {
		return LEX_ERROR, buffer.Bytes()
	}
	tkn.next()
	if buffer.Len()%2 != 0 {
		return LEX_ERROR, buffer.Bytes()
	}
	return HEX, buffer.Bytes()
}

func (tkn *Tokenizer) scanBitLiteral() (int, []byte) {
	buffer := &bytes2.Buffer{}
	tkn.scanMantissa(2, buffer)
	if tkn.lastChar != '\'' {
		return LEX_ERROR, buffer.Bytes()
	}
	tkn.next()
	return BIT_LITERAL, buffer.Bytes()
}

// scanLiteralIdentifier scans a quoted identifier. The first byte of the quoted identifier has already
// been read from the tokenizer and is passed in as the |startingChar| parameter. The type of token is
// returned as well as the actual content that was parsed.
func (tkn *Tokenizer) scanLiteralIdentifier(startingChar uint16) (int, []byte) {
	buffer := &bytes2.Buffer{}
	identifierQuoteSeen := false
	for {
		if identifierQuoteSeen {
			if tkn.lastChar != startingChar {
				break
			}
			identifierQuoteSeen = false
			buffer.WriteByte(byte(startingChar))
			tkn.next()
			continue
		}
		// The previous char was not a backtick.
		switch tkn.lastChar {
		case startingChar:
			identifierQuoteSeen = true
		case eofChar:
			// Premature EOF.
			return LEX_ERROR, buffer.Bytes()
		default:
			buffer.WriteByte(byte(tkn.lastChar))
		}
		tkn.next()
	}
	if tkn.lastChar == '@' {
		tkn.potentialAccountName = true
	}
	return ID, buffer.Bytes()
}

// scanColonPrefixToken handles bind variables(e.g. ':v1') and ':=' assignment operator.
func (tkn *Tokenizer) scanColonPrefixToken() (int, []byte) {
	buffer := &bytes2.Buffer{}
	buffer.WriteByte(byte(tkn.lastChar))
	token := VALUE_ARG
	tkn.next()
	if tkn.lastChar == ':' {
		token = LIST_ARG
		buffer.WriteByte(byte(tkn.lastChar))
		tkn.next()
	}
	if !isLetter(tkn.lastChar) {
		switch tkn.lastChar {
		case '=':
			tkn.next()
			return ASSIGNMENT_OP, []byte(":=")
		default:
			// If there isn't a previous error, then return the colon as it may be a valid token
			if tkn.LastError == nil {
				return int(':'), buffer.Bytes()
			}
			return LEX_ERROR, buffer.Bytes()
		}
	}
	for isLetter(tkn.lastChar) || isDigit(tkn.lastChar) || tkn.lastChar == '.' {
		buffer.WriteByte(byte(tkn.lastChar))
		tkn.next()
	}
	// Due to the way this is written to handle bindings, it includes the colon on keywords.
	// This is an issue when it comes to labels, so this is a workaround.
	if buffer.Len() >= 5 && buffer.Bytes()[0] == ':' {
		switch strings.ToLower(string(buffer.Bytes())) {
		case ":begin":
			return BEGIN, []byte("BEGIN")
		case ":loop":
			return LOOP, []byte("LOOP")
		case ":repeat":
			return REPEAT, []byte("REPEAT")
		case ":while":
			return WHILE, []byte("WHILE")
		}
	}
	return token, buffer.Bytes()
}

func (tkn *Tokenizer) scanMantissa(base int, buffer *bytes2.Buffer) {
	for digitVal(tkn.lastChar) < base {
		tkn.consumeNext(buffer)
	}
}

func (tkn *Tokenizer) scanNumber(seenDecimalPoint bool) (int, []byte) {
	token := INTEGRAL
	buffer := &bytes2.Buffer{}
	if seenDecimalPoint {
		token = FLOAT
		buffer.WriteByte('.')
		tkn.scanMantissa(10, buffer)
		goto exponent
	}

	// 0x construct.
	if tkn.lastChar == '0' {
		tkn.consumeNext(buffer)
		if tkn.lastChar == 'x' || tkn.lastChar == 'X' {
			token = HEXNUM
			tkn.consumeNext(buffer)
			tkn.scanMantissa(16, buffer)
			goto exit
		}
	}

	tkn.scanMantissa(10, buffer)

	if tkn.lastChar == '.' {
		token = FLOAT
		tkn.consumeNext(buffer)
		tkn.scanMantissa(10, buffer)
	}

exponent:
	if tkn.lastChar == 'e' || tkn.lastChar == 'E' {
		token = FLOAT
		tkn.consumeNext(buffer)
		if tkn.lastChar == '+' || tkn.lastChar == '-' {
			tkn.consumeNext(buffer)
		}
		tkn.scanMantissa(10, buffer)
	}

exit:
	// A letter cannot immediately follow a number.
	if isLetter(tkn.lastChar) {
		return LEX_ERROR, buffer.Bytes()
	}

	return token, buffer.Bytes()
}

func (tkn *Tokenizer) scanString(delim uint16, typ int) (int, []byte) {
	var buffer bytes2.Buffer
	for {
		ch := tkn.lastChar
		if ch == eofChar {
			// Unterminated string.
			return LEX_ERROR, buffer.Bytes()
		}

		if ch != delim && ch != '\\' {
			buffer.WriteByte(byte(ch))

			// Scan ahead to the next interesting character.
			start := tkn.bufPos
			for ; tkn.bufPos < tkn.bufSize; tkn.bufPos++ {
				ch = uint16(tkn.buf[tkn.bufPos])
				if ch == delim || ch == '\\' {
					break
				}
			}

			buffer.Write(tkn.buf[start:tkn.bufPos])
			tkn.Position += tkn.bufPos - start

			if tkn.bufPos >= tkn.bufSize {
				// Reached the end of the buffer without finding a delim or
				// escape character.
				tkn.next()
				continue
			}

			tkn.bufPos++
			tkn.Position++
		}
		tkn.next() // Read one past the delim or escape character.

		if ch == '\\' {
			if tkn.lastChar == eofChar {
				// String terminates mid escape character.
				return LEX_ERROR, buffer.Bytes()
			}
			if decodedChar := sqltypes.SQLDecodeMap[byte(tkn.lastChar)]; decodedChar == sqltypes.DontEscape {
				ch = tkn.lastChar
			} else {
				ch = uint16(decodedChar)
			}

		} else if ch == delim && tkn.lastChar != delim {
			// Correctly terminated string, which is not a double delim.
			break
		}

		buffer.WriteByte(byte(ch))
		tkn.next()
	}

	if tkn.lastChar == '@' {
		tkn.potentialAccountName = true
	}

	// mysql strings get auto concatenated, so see if the next token is a string and scan it if so
	tkn.skipBlank()
	if contains(tkn.stringLiteralQuotes, tkn.lastChar) == tkn.lastChar {
		delim := tkn.lastChar
		tkn.next()
		nextTyp, nextStr := tkn.scanString(delim, STRING)
		if nextTyp == STRING {
			return nextTyp, append(buffer.Bytes(), nextStr...)
		} else {
			return LEX_ERROR, buffer.Bytes()
		}
	}

	return typ, buffer.Bytes()
}

func (tkn *Tokenizer) scanCommentType1(prefix string) (int, []byte) {
	buffer := &bytes2.Buffer{}
	buffer.WriteString(prefix)
	for tkn.lastChar != eofChar {
		if tkn.lastChar == '\n' {
			tkn.consumeNext(buffer)
			break
		}
		tkn.consumeNext(buffer)
	}
	return COMMENT, buffer.Bytes()
}

func (tkn *Tokenizer) scanCommentType2() (int, []byte) {
	buffer := &bytes2.Buffer{}
	buffer.WriteString("/*")
	for {
		if tkn.lastChar == '*' {
			tkn.consumeNext(buffer)
			if tkn.lastChar == '/' {
				tkn.consumeNext(buffer)
				break
			}
			continue
		}
		if tkn.lastChar == eofChar {
			return LEX_ERROR, buffer.Bytes()
		}
		tkn.consumeNext(buffer)
	}
	return COMMENT, buffer.Bytes()
}

func (tkn *Tokenizer) scanMySQLSpecificComment() (int, []byte) {
	buffer := &bytes2.Buffer{}
	buffer.WriteString("/*!")
	tkn.next()

	foundStartPos := false
	startOffset := 0
	digitCount := 0

	for {
		if tkn.lastChar == '*' {
			tkn.consumeNext(buffer)
			if tkn.lastChar == '/' {
				tkn.consumeNext(buffer)
				tkn.specialCommentEndPos = tkn.Position
				break
			}
			continue
		}
		if tkn.lastChar == eofChar {
			return LEX_ERROR, buffer.Bytes()
		}
		tkn.consumeNext(buffer)

		// Already found special comment starting point
		if foundStartPos {
			continue
		}

		// Haven't reached character count
		if digitCount < 5 {
			if isDigit(tkn.lastChar) {
				// Increase digit count
				digitCount++
				continue
			} else {
				// Provided less than 5 digits, but force this to move on
				digitCount = 5
			}
		}

		// If no longer counting digits, ignore spaces until first non-space character
		if unicode.IsSpace(rune(tkn.lastChar)) {
			continue
		}

		// Found start of subexpression
		startOffset = tkn.Position - 1
		foundStartPos = true
	}
	_, sql := ExtractMysqlComment(buffer.String())

	tkn.specialComment = NewStringTokenizer(sql)
	tkn.specialComment.Position = startOffset

	return tkn.Scan()
}

func (tkn *Tokenizer) consumeNext(buffer *bytes2.Buffer) {
	if tkn.lastChar == eofChar {
		// This should never happen.
		panic("unexpected EOF")
	}
	buffer.WriteByte(byte(tkn.lastChar))
	tkn.next()
}

func (tkn *Tokenizer) next() {
	if tkn.bufPos >= tkn.bufSize && tkn.InStream != nil {
		// Try and refill the buffer
		var err error
		tkn.bufPos = 0
		if tkn.bufSize, err = tkn.InStream.Read(tkn.buf); err != io.EOF && err != nil {
			tkn.LastError = err
		}

		// In multi mode (parseNext), we need to keep track of the contents of the current statement string so that
		// lexer offsets work properly on statements that need them
		if tkn.multi {
			tkn.queryBuf = append(tkn.queryBuf, tkn.buf...)
		}
	}

	if tkn.bufPos >= tkn.bufSize {
		if tkn.lastChar != eofChar {
			tkn.Position++
			tkn.lastChar = eofChar
		}
	} else {
		tkn.Position++
		tkn.lastChar = uint16(tkn.buf[tkn.bufPos])
		tkn.bufPos++
	}
}

// reset clears any internal state.
func (tkn *Tokenizer) reset() {
	tkn.ParseTree = nil
	tkn.specialComment = nil
	tkn.posVarIndex = 0
	tkn.nesting = 0
	bufLeft := len(tkn.buf) - tkn.bufPos
	if len(tkn.queryBuf) > bufLeft {
		tkn.queryBuf = tkn.queryBuf[len(tkn.queryBuf)-bufLeft:]
	}
	tkn.Position = 0
	tkn.OldPosition = 0
}

func isLetter(ch uint16) bool {
	return 'a' <= ch && ch <= 'z' || 'A' <= ch && ch <= 'Z' || ch == '_'
}

func isCarat(ch uint16) bool {
	return ch == '.' || ch == '\'' || ch == '"' || ch == '`'
}

func digitVal(ch uint16) int {
	switch {
	case '0' <= ch && ch <= '9':
		return int(ch) - '0'
	case 'a' <= ch && ch <= 'f':
		return int(ch) - 'a' + 10
	case 'A' <= ch && ch <= 'F':
		return int(ch) - 'A' + 10
	}
	return 16 // larger than any legal digit val
}

func isDigit(ch uint16) bool {
	return '0' <= ch && ch <= '9'
}

// mustAtoi converts the string into an integer, by using strconv.atoi, and returns the result. If any errors are
// encountered, it registers a parsing error with |yylex|.
func mustAtoi(yylex yyLexer, s string) int {
	i, err := strconv.Atoi(s)
	if err != nil {
		yylex.Error(fmt.Sprintf("unable to parse integer from string '%s'", s))
	}
	return i
}
