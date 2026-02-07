package syntax

import (
	"strings"
	"text/scanner"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/dustin/go-humanize"
	"github.com/prometheus/common/model"
	"github.com/prometheus/prometheus/util/strutil"

	"github.com/grafana/loki/v3/pkg/logqlmodel"
)

var tokens = map[string]int{
	",":            COMMA,
	".":            DOT,
	"{":            OPEN_BRACE,
	"}":            CLOSE_BRACE,
	"=":            EQ,
	OpTypeNEQ:      NEQ,
	"=~":           RE,
	"!~":           NRE,
	"!>":           NPA,
	"|=":           PIPE_EXACT,
	"|~":           PIPE_MATCH,
	"|>":           PIPE_PATTERN,
	OpPipe:         PIPE,
	OpUnwrap:       UNWRAP,
	"(":            OPEN_PARENTHESIS,
	")":            CLOSE_PARENTHESIS,
	"by":           BY,
	"without":      WITHOUT,
	"bool":         BOOL,
	"[":            OPEN_BRACKET,
	"]":            CLOSE_BRACKET,
	OpLabelReplace: LABEL_REPLACE,
	OpOffset:       OFFSET,
	OpOn:           ON,
	OpIgnoring:     IGNORING,
	OpGroupLeft:    GROUP_LEFT,
	OpGroupRight:   GROUP_RIGHT,

	// binops
	OpTypeOr:     OR,
	OpTypeAnd:    AND,
	OpTypeUnless: UNLESS,
	OpTypeAdd:    ADD,
	OpTypeSub:    SUB,
	OpTypeMul:    MUL,
	OpTypeDiv:    DIV,
	OpTypeMod:    MOD,
	OpTypePow:    POW,
	// comparison binops
	OpTypeCmpEQ: CMP_EQ,
	OpTypeGT:    GT,
	OpTypeGTE:   GTE,
	OpTypeLT:    LT,
	OpTypeLTE:   LTE,

	// parsers
	OpParserTypeJSON:    JSON,
	OpParserTypeRegexp:  REGEXP,
	OpParserTypeLogfmt:  LOGFMT,
	OpParserTypeUnpack:  UNPACK,
	OpParserTypePattern: PATTERN,

	// fmt
	OpFmtLabel: LABEL_FMT,
	OpFmtLine:  LINE_FMT,

	// filter functions
	OpFilterIP:   IP,
	OpDecolorize: DECOLORIZE,

	// drop labels
	OpDrop: DROP,

	// keep labels
	OpKeep: KEEP,
}

var parserFlags = map[string]struct{}{
	OpStrict:    {},
	OpKeepEmpty: {},
}

// functionTokens are tokens that needs to be suffixes with parenthesis
var functionTokens = map[string]int{
	// range vec ops
	OpRangeTypeRate:        RATE,
	OpRangeTypeRateCounter: RATE_COUNTER,
	OpRangeTypeCount:       COUNT_OVER_TIME,
	OpRangeTypeBytesRate:   BYTES_RATE,
	OpRangeTypeBytes:       BYTES_OVER_TIME,
	OpRangeTypeAvg:         AVG_OVER_TIME,
	OpRangeTypeSum:         SUM_OVER_TIME,
	OpRangeTypeMin:         MIN_OVER_TIME,
	OpRangeTypeMax:         MAX_OVER_TIME,
	OpRangeTypeStdvar:      STDVAR_OVER_TIME,
	OpRangeTypeStddev:      STDDEV_OVER_TIME,
	OpRangeTypeQuantile:    QUANTILE_OVER_TIME,
	OpRangeTypeFirst:       FIRST_OVER_TIME,
	OpRangeTypeLast:        LAST_OVER_TIME,
	OpRangeTypeAbsent:      ABSENT_OVER_TIME,
	OpTypeVector:           VECTOR,

	// vec ops
	OpTypeSum:      SUM,
	OpTypeAvg:      AVG,
	OpTypeMax:      MAX,
	OpTypeMin:      MIN,
	OpTypeCount:    COUNT,
	OpTypeStddev:   STDDEV,
	OpTypeStdvar:   STDVAR,
	OpTypeBottomK:  BOTTOMK,
	OpTypeTopK:     TOPK,
	OpTypeSort:     SORT,
	OpTypeSortDesc: SORT_DESC,
	OpLabelReplace: LABEL_REPLACE,

	// conversion Op
	OpConvBytes:           BYTES_CONV,
	OpConvDuration:        DURATION_CONV,
	OpConvDurationSeconds: DURATION_SECONDS_CONV,

	// filterOp
	OpFilterIP: IP,
}

type lexer struct {
	Scanner
	errs    []logqlmodel.ParseError
	builder strings.Builder
}

func (l *lexer) Lex(lval *exprSymType) int {
	r := l.Scan()

	switch r {
	case '#':
		// Scan until a newline or EOF is encountered
		//nolint:revive
		for next := l.Peek(); !(next == '\n' || next == scanner.EOF); next = l.Next() {
		}

		return l.Lex(lval)

	case scanner.EOF:
		return 0

	case scanner.Int, scanner.Float:
		numberText := l.TokenText()

		duration, ok := tryScanDuration(numberText, &l.Scanner)
		if ok {
			lval.duration = duration
			return DURATION
		}

		bytes, ok := tryScanBytes(numberText, &l.Scanner)
		if ok {
			lval.bytes = bytes
			return BYTES
		}

		lval.str = numberText
		return NUMBER
	case '-': // handle flags and negative durations
		if l.Peek() == '-' {
			if flag, ok := tryScanFlag(&l.Scanner); ok {
				lval.str = flag
				return PARSER_FLAG
			}
		}

		tokenText := l.TokenText()
		if duration, ok := tryScanDuration(tokenText, &l.Scanner); ok {
			lval.duration = duration
			return DURATION
		}

	case scanner.String, scanner.RawString:
		var err error
		tokenText := l.TokenText()
		if !utf8.ValidString(tokenText) {
			l.Error("invalid UTF-8 rune")
			return 0
		}
		lval.str, err = strutil.Unquote(tokenText)
		if err != nil {
			l.Error(err.Error())
			return 0
		}
		return STRING
	}

	// scanning duration tokens
	if r == '[' {
		l.builder.Reset()
		for r := l.Next(); r != scanner.EOF; r = l.Next() {
			if r == ']' {
				i, err := model.ParseDuration(l.builder.String())
				if err != nil {
					l.Error(err.Error())
					return 0
				}
				lval.duration = time.Duration(i)
				return RANGE
			}
			_, _ = l.builder.WriteRune(r)
		}
		l.Error("missing closing ']' in duration")
		return 0
	}

	tokenText := l.TokenText()
	tokenTextLower := strings.ToLower(l.TokenText())
	tokenNext := strings.ToLower(tokenText + string(l.Peek()))

	if tok, ok := functionTokens[tokenNext]; ok {
		// create a copy to advance to the entire token for testing suffix
		sc := l.Scanner
		sc.Next()
		if isFunction(sc) {
			l.Next()
			return tok
		}
	}

	if tok, ok := functionTokens[tokenTextLower]; ok {
		if !isFunction(l.Scanner) {
			lval.str = tokenText
			return IDENTIFIER
		}
		return tok
	}

	if tok, ok := tokens[tokenNext]; ok {
		l.Next()
		return tok
	}

	if tok, ok := tokens[tokenTextLower]; ok {
		return tok
	}

	lval.str = tokenText
	return IDENTIFIER
}

func (l *lexer) Error(msg string) {
	l.errs = append(l.errs, logqlmodel.NewParseError(msg, l.Line, l.Column))
}

// tryScanFlag scans for a parser flag and returns it on success
// it advances the scanner only if a valid flag is found
func tryScanFlag(l *Scanner) (string, bool) {
	var sb strings.Builder
	sb.WriteString(l.TokenText())

	// copy the scanner to avoid advancing it in case it's not a flag
	s := *l
	consumed := 0
	for r := s.Peek(); unicode.IsLetter(r) || r == '-'; r = s.Peek() {
		_, _ = sb.WriteRune(r)
		_ = s.Next()

		consumed++
	}

	flag := sb.String()
	if _, ok := parserFlags[flag]; !ok {
		return "", false
	}

	// consume the scanner
	for i := 0; i < consumed; i++ {
		_ = l.Next()
	}

	return flag, true
}

func tryScanDuration(number string, l *Scanner) (time.Duration, bool) {
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
	durationString := sb.String()
	duration, err := parseDuration(durationString)
	if err != nil {
		return 0, false
	}

	// we need to consume the scanner, now that we know this is a duration.
	for i := 0; i < consumed; i++ {
		_ = l.Next()
	}

	return duration, true
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
	// "ns", "us" (or "µs"), "ms", "s", "m", "h", "d", "w", "y".
	switch r {
	case 'n', 'u', 'µ', 'm', 's', 'h', 'd', 'w', 'y':
		return true
	default:
		return false
	}
}

func tryScanBytes(number string, l *Scanner) (uint64, bool) {
	var sb strings.Builder
	sb.WriteString(number)
	// copy the scanner to avoid advancing it in case it's not a duration.
	s := *l
	consumed := 0
	for r := s.Peek(); r != scanner.EOF && !unicode.IsSpace(r); r = s.Peek() {
		if !unicode.IsNumber(r) && !isBytesSizeRune(r) && r != '.' {
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
	b, err := humanize.ParseBytes(sb.String())
	if err != nil {
		return 0, false
	}
	// we need to consume the scanner, now that we know this is a duration.
	for i := 0; i < consumed; i++ {
		_ = l.Next()
	}
	return b, true
}

func isBytesSizeRune(r rune) bool {
	// Accept: B, kB, MB, GB, TB, PB, KB, KiB, MiB, GiB, TiB, PiB
	// Do not accept: EB, ZB, YB, PiB, ZiB and YiB. They are not supported since the value migh not be represented in an uint64
	switch r {
	case 'B', 'i', 'k', 'K', 'M', 'G', 'T', 'P':
		return true
	default:
		return false
	}
}

// isFunction check if the next runes are either an open parenthesis
// or by/without tokens. This allows to dissociate functions and identifier correctly.
func isFunction(sc Scanner) bool {
	var sb strings.Builder
	sc = trimSpace(sc)
	for r := sc.Next(); r != scanner.EOF; r = sc.Next() {
		sb.WriteRune(r)
		switch strings.ToLower(sb.String()) {
		case "(":
			return true
		case "by", "without":
			sc = trimSpace(sc)
			return sc.Next() == '('
		}
	}
	return false
}

func trimSpace(l Scanner) Scanner {
	for n := l.Peek(); n != scanner.EOF; n = l.Peek() {
		if unicode.IsSpace(n) {
			l.Next()
			continue
		}
		return l
	}
	return l
}
