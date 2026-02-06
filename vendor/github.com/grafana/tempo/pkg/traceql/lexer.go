package traceql

import (
	"errors"
	"strconv"
	"strings"
	"text/scanner"
	"time"
	"unicode"

	"github.com/prometheus/common/model"
)

const escapeRunes = `\"`

var tokens = map[string]int{
	",":                   COMMA,
	".":                   DOT,
	"{":                   OPEN_BRACE,
	"}":                   CLOSE_BRACE,
	"(":                   OPEN_PARENS,
	")":                   CLOSE_PARENS,
	"=":                   EQ,
	"!=":                  NEQ,
	"=~":                  RE,
	"!~":                  NRE, // also "not sibling"
	">":                   GT,
	">=":                  GTE,
	"<":                   LT,
	"<=":                  LTE,
	"+":                   ADD,
	"-":                   SUB,
	"/":                   DIV,
	"%":                   MOD,
	"*":                   MUL,
	"^":                   POW,
	"true":                TRUE,
	"false":               FALSE,
	"nil":                 NIL,
	"ok":                  STATUS_OK,
	"error":               STATUS_ERROR,
	"unset":               STATUS_UNSET,
	"unspecified":         KIND_UNSPECIFIED,
	"internal":            KIND_INTERNAL,
	"server":              KIND_SERVER,
	"client":              KIND_CLIENT,
	"producer":            KIND_PRODUCER,
	"consumer":            KIND_CONSUMER,
	"&&":                  AND,
	"||":                  OR,
	"!":                   NOT,
	"|":                   PIPE,
	">>":                  DESC,
	"<<":                  ANCE,
	"~":                   SIBL,
	"!>":                  NOT_CHILD,
	"!<":                  NOT_PARENT,
	"!>>":                 NOT_DESC,
	"!<<":                 NOT_ANCE,
	"&~":                  UNION_SIBL,
	"&>":                  UNION_CHILD,
	"&<":                  UNION_PARENT,
	"&>>":                 UNION_DESC,
	"&<<":                 UNION_ANCE,
	"duration":            IDURATION,
	"childCount":          CHILDCOUNT,
	"name":                NAME,
	"status":              STATUS,
	"statusMessage":       STATUS_MESSAGE,
	"kind":                KIND,
	"rootName":            ROOTNAME,
	"rootServiceName":     ROOTSERVICENAME,
	"rootService":         ROOTSERVICE,
	"traceDuration":       TRACEDURATION,
	"nestedSetLeft":       NESTEDSETLEFT,
	"nestedSetRight":      NESTEDSETRIGHT,
	"nestedSetParent":     NESTEDSETPARENT,
	"id":                  ID,
	"traceID":             TRACE_ID,
	"spanID":              SPAN_ID,
	"parentID":            PARENT_ID,
	"timeSinceStart":      TIMESINCESTART,
	"version":             VERSION,
	"parent":              PARENT,
	"parent.":             PARENT_DOT,
	"resource.":           RESOURCE_DOT,
	"span.":               SPAN_DOT,
	"trace:":              TRACE_COLON,
	"span:":               SPAN_COLON,
	"event:":              EVENT_COLON,
	"link:":               LINK_COLON,
	"instrumentation:":    INSTRUMENTATION_COLON,
	"event.":              EVENT_DOT,
	"link.":               LINK_DOT,
	"instrumentation.":    INSTRUMENTATION_DOT,
	"count":               COUNT,
	"avg":                 AVG,
	"max":                 MAX,
	"min":                 MIN,
	"sum":                 SUM,
	"by":                  BY,
	"coalesce":            COALESCE,
	"select":              SELECT,
	"rate":                RATE,
	"count_over_time":     COUNT_OVER_TIME,
	"min_over_time":       MIN_OVER_TIME,
	"max_over_time":       MAX_OVER_TIME,
	"avg_over_time":       AVG_OVER_TIME,
	"sum_over_time":       SUM_OVER_TIME,
	"quantile_over_time":  QUANTILE_OVER_TIME,
	"histogram_over_time": HISTOGRAM_OVER_TIME,
	"compare":             COMPARE,
	"topk":                TOPK,
	"bottomk":             BOTTOMK,
	"with":                WITH,
}

type lexer struct {
	scanner.Scanner
	expr   *RootExpr
	parser *yyParserImpl
	errs   []*ParseError

	parsingAttribute bool
	currentScope     int
}

func (l *lexer) Lex(lval *yySymType) int {
	// if we are currently parsing an attribute and the next rune suggests that
	//  this attribute will end, then return a special token indicating that the attribute is
	//  done parsing
	if l.parsingAttribute && !isAttributeRune(l.Peek()) {
		l.parsingAttribute = false
		return END_ATTRIBUTE
	}

	if l.parsingAttribute {
		// parse out any scopes here
		scopeToken, ok := tryScopeAttribute(&l.Scanner, l.currentScope)
		if ok {
			l.currentScope = scopeToken
			return scopeToken
		}

		var err error
		lval.staticStr, err = parseAttribute(&l.Scanner)
		if err != nil {
			l.Error(err.Error())
			return 0
		}
		return IDENTIFIER
	}

	r := l.Scan()
	// now that we know we're not parsing an attribute, let's look for everything else
	switch r {
	case scanner.EOF:
		return 0

	case scanner.String, scanner.RawString:
		var err error
		lval.staticStr, err = strconv.Unquote(l.TokenText())
		if err != nil {
			l.Error(err.Error())
			return 0
		}
		return STRING

	case scanner.Int:
		numberText := l.TokenText()

		// first try to parse as duration
		duration, ok := tryScanDuration(numberText, &l.Scanner)
		if ok {
			lval.staticDuration = duration
			return DURATION
		}

		// if we can't then just try an int
		var err error
		lval.staticInt, err = strconv.Atoi(numberText)
		if err != nil {
			l.Error(err.Error())
			return 0
		}
		return INTEGER

	case scanner.Float:
		numberText := l.TokenText()

		// first try to parse as duration
		duration, ok := tryScanDuration(numberText, &l.Scanner)
		if ok {
			lval.staticDuration = duration
			return DURATION
		}

		var err error
		lval.staticFloat, err = strconv.ParseFloat(numberText, 64)
		if err != nil {
			l.Error(err.Error())
			return 0
		}
		return FLOAT
	}

	// look for combination tokens starting with 2 and working up til there is no match
	// this is only to disamgiguate tokens with common prefixes. it will not find 3+ token combinations
	// with no valid prefixes
	multiTok := -1
	tokStrNext := l.TokenText()
	for {
		tokStrNext = tokStrNext + string(l.Peek())
		tok, ok := tokens[tokStrNext]
		if ok {
			multiTok = tok
			l.Next()
			continue
		}
		break
	}

	if multiTok == PARENT_DOT ||
		multiTok == SPAN_DOT ||
		multiTok == RESOURCE_DOT ||
		multiTok == SPAN_COLON ||
		multiTok == TRACE_COLON ||
		multiTok == EVENT_COLON ||
		multiTok == LINK_COLON ||
		multiTok == INSTRUMENTATION_COLON ||
		multiTok == EVENT_DOT ||
		multiTok == LINK_DOT ||
		multiTok == INSTRUMENTATION_DOT {

		l.currentScope = multiTok
	}

	// did we find a combination token?
	if multiTok != -1 {
		l.parsingAttribute = startsAttribute(multiTok)
		return multiTok
	}

	// no combination tokens, see if the current text is a known token
	if tok, ok := tokens[l.TokenText()]; ok {
		l.parsingAttribute = startsAttribute(tok)
		return tok
	}

	// default to an identifier
	lval.staticStr = l.TokenText()
	return IDENTIFIER
}

func (l *lexer) Error(msg string) {
	l.errs = append(l.errs, newParseError(msg, l.Line, l.Column))
}

func parseAttribute(s *scanner.Scanner) (string, error) {
	var sb strings.Builder
	r := s.Peek()
	for {
		if r == '"' {
			// consume quoted attribute parts
			str, err := parseQuotedAtrribute(s)
			if err != nil {
				return "", err
			}
			sb.WriteString(str)
		} else if isAttributeRune(r) {
			// if outside quote consume everything until we find a character that ends the attribute.
			sb.WriteRune(s.Next())
		} else {
			break
		}

		r = s.Peek()
	}

	return sb.String(), nil
}

func parseQuotedAtrribute(s *scanner.Scanner) (string, error) {
	var sb strings.Builder
	s.Next() // consume first quote
	r := s.Peek()
	for ; r != scanner.EOF; r = s.Peek() {
		if r == '"' {
			s.Next()
			break
		} else if r == '\\' {
			s.Next()
			if strings.ContainsRune(escapeRunes, s.Peek()) {
				sb.WriteRune(s.Peek())
				s.Next()
			} else {
				return "", errors.New("invalid escape sequence")
			}
		} else {
			sb.WriteRune(r)
			s.Next()
		}
	}

	if r == scanner.EOF {
		return "", errors.New(`unexpected EOF, expecting "`)
	}

	return sb.String(), nil
}

func tryScopeAttribute(l *scanner.Scanner, currentScope int) (int, bool) {
	const longestScope = 9 // "resource." is the longest scope

	// copy the scanner to avoid advancing if it's not a scope.
	s := *l
	str := ""
	for s.Peek() != scanner.EOF {
		r := s.Peek()
		if r == '.' { // we've found a scope attribute
			str += string(s.Next())
			break
		}
		if !isAttributeRune(r) { // we can't have a scope with invalid characters, so just bail
			break
		}
		if len(str) > longestScope { // we can't have a scope longer than the longest scope, so just bail
			break
		}

		str += string(s.Next())
	}
	tok := tokens[str]

	if (tok == SPAN_DOT || tok == RESOURCE_DOT) && currentScope == PARENT_DOT {
		// we have found scope attribute so consume the original scanner
		for i := 0; i < len(str); i++ {
			l.Next()
		}

		return tok, true
	}

	return 0, false
}

func tryScanDuration(number string, l *scanner.Scanner) (time.Duration, bool) {
	var sb strings.Builder
	sb.WriteString(number)
	// copy the scanner to avoid advancing it in case it's not a duration.
	s := *l
	consumed := 0
	for r := s.Peek(); r != scanner.EOF && !unicode.IsSpace(r); r = s.Peek() {
		if !unicode.IsNumber(r) && !isDurationRune(r) && r != '.' {
			break
		}
		_, _ = sb.WriteRune(r)
		_ = s.Next()
		consumed++
	}

	if consumed == 0 {
		return 0, false
	}
	// we've found more characters before a whitespace or the end
	d, err := parseDuration(sb.String())
	if err != nil {
		return 0, false
	}
	// we need to consume the scanner, now that we know this is a duration.
	for i := 0; i < consumed; i++ {
		_ = l.Next()
	}
	return d, true
}

func parseDuration(d string) (time.Duration, error) {
	var duration time.Duration
	// Try to parse promql style durations first, to ensure that we support the same duration
	// units as promql
	prometheusDuration, err := model.ParseDuration(d)
	if err != nil {
		// Fall back to standard library's time.ParseDuration if a promql style
		// duration couldn't be parsed.
		duration, err = time.ParseDuration(d)
		if err != nil {
			return 0, err
		}
	} else {
		duration = time.Duration(prometheusDuration)
	}

	return duration, nil
}

func isDurationRune(r rune) bool {
	// "ns", "us" (or "µs"), "ms", "s", "m", "h".
	switch r {
	case 'n', 's', 'u', 'm', 'h', 'µ', 'd', 'w', 'y':
		return true
	default:
		return false
	}
}

func isAttributeRune(r rune) bool {
	if unicode.IsSpace(r) {
		return false
	}

	switch r {
	case scanner.EOF, '{', '}', '(', ')', '=', '~', '!', '<', '>', '&', '|', '^', ',':
		return false
	default:
		return true
	}
}

func startsAttribute(tok int) bool {
	return tok == DOT ||
		tok == RESOURCE_DOT ||
		tok == SPAN_DOT ||
		tok == PARENT_DOT ||
		tok == EVENT_DOT ||
		tok == LINK_DOT ||
		tok == INSTRUMENTATION_DOT
}
