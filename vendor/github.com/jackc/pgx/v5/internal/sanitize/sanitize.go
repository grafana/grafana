package sanitize

import (
	"bytes"
	"encoding/hex"
	"fmt"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode/utf8"
)

// Part is either a string or an int. A string is raw SQL. An int is a
// argument placeholder.
type Part any

type Query struct {
	Parts []Part
}

// utf.DecodeRune returns the utf8.RuneError for errors. But that is actually rune U+FFFD -- the unicode replacement
// character. utf8.RuneError is not an error if it is also width 3.
//
// https://github.com/jackc/pgx/issues/1380
const replacementcharacterwidth = 3

const maxBufSize = 16384 // 16 Ki

var bufPool = &pool[*bytes.Buffer]{
	new: func() *bytes.Buffer {
		return &bytes.Buffer{}
	},
	reset: func(b *bytes.Buffer) bool {
		n := b.Len()
		b.Reset()
		return n < maxBufSize
	},
}

var null = []byte("null")

func (q *Query) Sanitize(args ...any) (string, error) {
	argUse := make([]bool, len(args))
	buf := bufPool.get()
	defer bufPool.put(buf)

	for _, part := range q.Parts {
		switch part := part.(type) {
		case string:
			buf.WriteString(part)
		case int:
			argIdx := part - 1
			var p []byte
			if argIdx < 0 {
				return "", fmt.Errorf("first sql argument must be > 0")
			}

			if argIdx >= len(args) {
				return "", fmt.Errorf("insufficient arguments")
			}

			// Prevent SQL injection via Line Comment Creation
			// https://github.com/jackc/pgx/security/advisories/GHSA-m7wr-2xf7-cm9p
			buf.WriteByte(' ')

			arg := args[argIdx]
			switch arg := arg.(type) {
			case nil:
				p = null
			case int64:
				p = strconv.AppendInt(buf.AvailableBuffer(), arg, 10)
			case float64:
				p = strconv.AppendFloat(buf.AvailableBuffer(), arg, 'f', -1, 64)
			case bool:
				p = strconv.AppendBool(buf.AvailableBuffer(), arg)
			case []byte:
				p = QuoteBytes(buf.AvailableBuffer(), arg)
			case string:
				p = QuoteString(buf.AvailableBuffer(), arg)
			case time.Time:
				p = arg.Truncate(time.Microsecond).
					AppendFormat(buf.AvailableBuffer(), "'2006-01-02 15:04:05.999999999Z07:00:00'")
			default:
				return "", fmt.Errorf("invalid arg type: %T", arg)
			}
			argUse[argIdx] = true

			buf.Write(p)

			// Prevent SQL injection via Line Comment Creation
			// https://github.com/jackc/pgx/security/advisories/GHSA-m7wr-2xf7-cm9p
			buf.WriteByte(' ')
		default:
			return "", fmt.Errorf("invalid Part type: %T", part)
		}
	}

	for i, used := range argUse {
		if !used {
			return "", fmt.Errorf("unused argument: %d", i)
		}
	}
	return buf.String(), nil
}

func NewQuery(sql string) (*Query, error) {
	query := &Query{}
	query.init(sql)

	return query, nil
}

var sqlLexerPool = &pool[*sqlLexer]{
	new: func() *sqlLexer {
		return &sqlLexer{}
	},
	reset: func(sl *sqlLexer) bool {
		*sl = sqlLexer{}
		return true
	},
}

func (q *Query) init(sql string) {
	parts := q.Parts[:0]
	if parts == nil {
		// dirty, but fast heuristic to preallocate for ~90% usecases
		n := strings.Count(sql, "$") + strings.Count(sql, "--") + 1
		parts = make([]Part, 0, n)
	}

	l := sqlLexerPool.get()
	defer sqlLexerPool.put(l)

	l.src = sql
	l.stateFn = rawState
	l.parts = parts

	for l.stateFn != nil {
		l.stateFn = l.stateFn(l)
	}

	q.Parts = l.parts
}

func QuoteString(dst []byte, str string) []byte {
	const quote = '\''

	// Preallocate space for the worst case scenario
	dst = slices.Grow(dst, len(str)*2+2)

	// Add opening quote
	dst = append(dst, quote)

	// Iterate through the string without allocating
	for i := 0; i < len(str); i++ {
		if str[i] == quote {
			dst = append(dst, quote, quote)
		} else {
			dst = append(dst, str[i])
		}
	}

	// Add closing quote
	dst = append(dst, quote)

	return dst
}

func QuoteBytes(dst, buf []byte) []byte {
	if len(buf) == 0 {
		return append(dst, `'\x'`...)
	}

	// Calculate required length
	requiredLen := 3 + hex.EncodedLen(len(buf)) + 1

	// Ensure dst has enough capacity
	if cap(dst)-len(dst) < requiredLen {
		newDst := make([]byte, len(dst), len(dst)+requiredLen)
		copy(newDst, dst)
		dst = newDst
	}

	// Record original length and extend slice
	origLen := len(dst)
	dst = dst[:origLen+requiredLen]

	// Add prefix
	dst[origLen] = '\''
	dst[origLen+1] = '\\'
	dst[origLen+2] = 'x'

	// Encode bytes directly into dst
	hex.Encode(dst[origLen+3:len(dst)-1], buf)

	// Add suffix
	dst[len(dst)-1] = '\''

	return dst
}

type sqlLexer struct {
	src     string
	start   int
	pos     int
	nested  int // multiline comment nesting level.
	stateFn stateFn
	parts   []Part
}

type stateFn func(*sqlLexer) stateFn

func rawState(l *sqlLexer) stateFn {
	for {
		r, width := utf8.DecodeRuneInString(l.src[l.pos:])
		l.pos += width

		switch r {
		case 'e', 'E':
			nextRune, width := utf8.DecodeRuneInString(l.src[l.pos:])
			if nextRune == '\'' {
				l.pos += width
				return escapeStringState
			}
		case '\'':
			return singleQuoteState
		case '"':
			return doubleQuoteState
		case '$':
			nextRune, _ := utf8.DecodeRuneInString(l.src[l.pos:])
			if '0' <= nextRune && nextRune <= '9' {
				if l.pos-l.start > 0 {
					l.parts = append(l.parts, l.src[l.start:l.pos-width])
				}
				l.start = l.pos
				return placeholderState
			}
		case '-':
			nextRune, width := utf8.DecodeRuneInString(l.src[l.pos:])
			if nextRune == '-' {
				l.pos += width
				return oneLineCommentState
			}
		case '/':
			nextRune, width := utf8.DecodeRuneInString(l.src[l.pos:])
			if nextRune == '*' {
				l.pos += width
				return multilineCommentState
			}
		case utf8.RuneError:
			if width != replacementcharacterwidth {
				if l.pos-l.start > 0 {
					l.parts = append(l.parts, l.src[l.start:l.pos])
					l.start = l.pos
				}
				return nil
			}
		}
	}
}

func singleQuoteState(l *sqlLexer) stateFn {
	for {
		r, width := utf8.DecodeRuneInString(l.src[l.pos:])
		l.pos += width

		switch r {
		case '\'':
			nextRune, width := utf8.DecodeRuneInString(l.src[l.pos:])
			if nextRune != '\'' {
				return rawState
			}
			l.pos += width
		case utf8.RuneError:
			if width != replacementcharacterwidth {
				if l.pos-l.start > 0 {
					l.parts = append(l.parts, l.src[l.start:l.pos])
					l.start = l.pos
				}
				return nil
			}
		}
	}
}

func doubleQuoteState(l *sqlLexer) stateFn {
	for {
		r, width := utf8.DecodeRuneInString(l.src[l.pos:])
		l.pos += width

		switch r {
		case '"':
			nextRune, width := utf8.DecodeRuneInString(l.src[l.pos:])
			if nextRune != '"' {
				return rawState
			}
			l.pos += width
		case utf8.RuneError:
			if width != replacementcharacterwidth {
				if l.pos-l.start > 0 {
					l.parts = append(l.parts, l.src[l.start:l.pos])
					l.start = l.pos
				}
				return nil
			}
		}
	}
}

// placeholderState consumes a placeholder value. The $ must have already has
// already been consumed. The first rune must be a digit.
func placeholderState(l *sqlLexer) stateFn {
	num := 0

	for {
		r, width := utf8.DecodeRuneInString(l.src[l.pos:])
		l.pos += width

		if '0' <= r && r <= '9' {
			num *= 10
			num += int(r - '0')
		} else {
			l.parts = append(l.parts, num)
			l.pos -= width
			l.start = l.pos
			return rawState
		}
	}
}

func escapeStringState(l *sqlLexer) stateFn {
	for {
		r, width := utf8.DecodeRuneInString(l.src[l.pos:])
		l.pos += width

		switch r {
		case '\\':
			_, width = utf8.DecodeRuneInString(l.src[l.pos:])
			l.pos += width
		case '\'':
			nextRune, width := utf8.DecodeRuneInString(l.src[l.pos:])
			if nextRune != '\'' {
				return rawState
			}
			l.pos += width
		case utf8.RuneError:
			if width != replacementcharacterwidth {
				if l.pos-l.start > 0 {
					l.parts = append(l.parts, l.src[l.start:l.pos])
					l.start = l.pos
				}
				return nil
			}
		}
	}
}

func oneLineCommentState(l *sqlLexer) stateFn {
	for {
		r, width := utf8.DecodeRuneInString(l.src[l.pos:])
		l.pos += width

		switch r {
		case '\\':
			_, width = utf8.DecodeRuneInString(l.src[l.pos:])
			l.pos += width
		case '\n', '\r':
			return rawState
		case utf8.RuneError:
			if width != replacementcharacterwidth {
				if l.pos-l.start > 0 {
					l.parts = append(l.parts, l.src[l.start:l.pos])
					l.start = l.pos
				}
				return nil
			}
		}
	}
}

func multilineCommentState(l *sqlLexer) stateFn {
	for {
		r, width := utf8.DecodeRuneInString(l.src[l.pos:])
		l.pos += width

		switch r {
		case '/':
			nextRune, width := utf8.DecodeRuneInString(l.src[l.pos:])
			if nextRune == '*' {
				l.pos += width
				l.nested++
			}
		case '*':
			nextRune, width := utf8.DecodeRuneInString(l.src[l.pos:])
			if nextRune != '/' {
				continue
			}

			l.pos += width
			if l.nested == 0 {
				return rawState
			}
			l.nested--

		case utf8.RuneError:
			if width != replacementcharacterwidth {
				if l.pos-l.start > 0 {
					l.parts = append(l.parts, l.src[l.start:l.pos])
					l.start = l.pos
				}
				return nil
			}
		}
	}
}

var queryPool = &pool[*Query]{
	new: func() *Query {
		return &Query{}
	},
	reset: func(q *Query) bool {
		n := len(q.Parts)
		q.Parts = q.Parts[:0]
		return n < 64 // drop too large queries
	},
}

// SanitizeSQL replaces placeholder values with args. It quotes and escapes args
// as necessary. This function is only safe when standard_conforming_strings is
// on.
func SanitizeSQL(sql string, args ...any) (string, error) {
	query := queryPool.get()
	query.init(sql)
	defer queryPool.put(query)

	return query.Sanitize(args...)
}

type pool[E any] struct {
	p     sync.Pool
	new   func() E
	reset func(E) bool
}

func (pool *pool[E]) get() E {
	v, ok := pool.p.Get().(E)
	if !ok {
		v = pool.new()
	}

	return v
}

func (p *pool[E]) put(v E) {
	if p.reset(v) {
		p.p.Put(v)
	}
}
