package option

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"unicode"

	"github.com/mithrandie/go-text"
	txjson "github.com/mithrandie/go-text/json"
)

func EscapeString(s string) string {
	runes := []rune(s)
	var buf bytes.Buffer

	for _, r := range runes {
		switch r {
		case '\a':
			buf.WriteString("\\a")
		case '\b':
			buf.WriteString("\\b")
		case '\f':
			buf.WriteString("\\f")
		case '\n':
			buf.WriteString("\\n")
		case '\r':
			buf.WriteString("\\r")
		case '\t':
			buf.WriteString("\\t")
		case '\v':
			buf.WriteString("\\v")
		case '\'':
			buf.WriteString("\\'")
		case '\\':
			buf.WriteString("\\\\")
		default:
			buf.WriteRune(r)
		}
	}
	return buf.String()
}

func UnescapeString(s string, quote rune) string {
	runes := []rune(s)
	var buf bytes.Buffer

	escaped := false
	quoteRune := rune(0)
	for _, r := range runes {
		if 0 < quoteRune {
			buf.WriteRune(quoteRune)
			if r == quoteRune {
				quoteRune = 0
				continue
			}
			quoteRune = 0
		}

		if escaped {
			switch r {
			case 'a':
				buf.WriteRune('\a')
			case 'b':
				buf.WriteRune('\b')
			case 'f':
				buf.WriteRune('\f')
			case 'n':
				buf.WriteRune('\n')
			case 'r':
				buf.WriteRune('\r')
			case 't':
				buf.WriteRune('\t')
			case 'v':
				buf.WriteRune('\v')
			case '"', '\'', '\\':
				buf.WriteRune(r)
			default:
				buf.WriteRune('\\')
				buf.WriteRune(r)
			}
			escaped = false
			continue
		}

		switch r {
		case '\\':
			escaped = true
		case quote:
			quoteRune = r
		default:
			buf.WriteRune(r)
		}
	}
	if escaped {
		buf.WriteRune('\\')
	}

	return buf.String()
}

func EscapeIdentifier(s string) string {
	runes := []rune(s)
	var buf bytes.Buffer

	for _, r := range runes {
		switch r {
		case '\a':
			buf.WriteString("\\a")
		case '\b':
			buf.WriteString("\\b")
		case '\f':
			buf.WriteString("\\f")
		case '\n':
			buf.WriteString("\\n")
		case '\r':
			buf.WriteString("\\r")
		case '\t':
			buf.WriteString("\\t")
		case '\v':
			buf.WriteString("\\v")
		case '`':
			buf.WriteString("\\`")
		case '\\':
			buf.WriteString("\\\\")
		default:
			buf.WriteRune(r)
		}
	}
	return buf.String()
}

func UnescapeIdentifier(s string, quote rune) string {
	runes := []rune(s)
	var buf bytes.Buffer

	escaped := false
	quoteRune := rune(0)
	for _, r := range runes {
		if 0 < quoteRune {
			buf.WriteRune(quoteRune)
			if r == quoteRune {
				quoteRune = 0
				continue
			}
			quoteRune = 0
		}

		if escaped {
			switch r {
			case 'a':
				buf.WriteRune('\a')
			case 'b':
				buf.WriteRune('\b')
			case 'f':
				buf.WriteRune('\f')
			case 'n':
				buf.WriteRune('\n')
			case 'r':
				buf.WriteRune('\r')
			case 't':
				buf.WriteRune('\t')
			case 'v':
				buf.WriteRune('\v')
			case '"', '`', '\\':
				buf.WriteRune(r)
			default:
				buf.WriteRune('\\')
				buf.WriteRune(r)
			}
			escaped = false
			continue
		}

		switch r {
		case '\\':
			escaped = true
		case quote:
			quoteRune = r
		default:
			buf.WriteRune(r)
		}
	}
	if escaped {
		buf.WriteRune('\\')
	}

	return buf.String()
}

func QuoteString(s string) string {
	return "'" + EscapeString(s) + "'"
}

func QuoteIdentifier(s string) string {
	return "`" + EscapeIdentifier(s) + "`"
}

func VariableSymbol(s string) string {
	return VariableSign + s
}

func FlagSymbol(s string) string {
	return FlagSign + s
}

func EnvironmentVariableSymbol(s string) string {
	if MustBeEnclosed(s) {
		s = QuoteIdentifier(s)
	}
	return EnvironmentVariableSign + s
}

func EnclosedEnvironmentVariableSymbol(s string) string {
	return EnvironmentVariableSign + QuoteIdentifier(s)
}

func MustBeEnclosed(s string) bool {
	if len(s) == 0 {
		return false
	}

	runes := []rune(s)

	if runes[0] != '_' && !unicode.IsLetter(runes[0]) {
		return true
	}

	for i := 1; i < len(runes); i++ {
		if s[i] != '_' && !unicode.IsLetter(runes[i]) && !unicode.IsDigit(runes[i]) {
			return true
		}
	}
	return false
}

func RuntimeInformationSymbol(s string) string {
	return RuntimeInformationSign + s
}

func FormatInt(i int, thousandsSeparator string) string {
	return FormatNumber(float64(i), 0, ".", thousandsSeparator, "")
}

func FormatNumber(f float64, precision int, decimalPoint string, thousandsSeparator string, decimalSeparator string) string {
	s := strconv.FormatFloat(f, 'f', precision, 64)

	parts := strings.Split(s, ".")
	intPart := parts[0]
	decPart := ""
	if 1 < len(parts) {
		decPart = parts[1]
	}

	intPlaces := make([]string, 0, (len(intPart)/3)+1)
	intLen := len(intPart)
	for i := intLen / 3; i >= 0; i-- {
		end := intLen - i*3
		if end == 0 {
			continue
		}

		start := intLen - (i+1)*3
		if start < 0 {
			start = 0
		}
		intPlaces = append(intPlaces, intPart[start:end])
	}

	decPlaces := make([]string, 0, (len(decPart)/3)+1)
	for i := 0; i < len(decPart); i = i + 3 {
		end := i + 3
		if len(decPart) < end {
			end = len(decPart)
		}
		decPlaces = append(decPlaces, decPart[i:end])
	}

	formatted := strings.Join(intPlaces, thousandsSeparator)
	if 0 < len(decPlaces) {
		formatted = formatted + decimalPoint + strings.Join(decPlaces, decimalSeparator)
	}

	return formatted
}

func ParseEncoding(s string) (text.Encoding, error) {
	encoding, err := text.ParseEncoding(s)
	if err != nil {
		err = errors.New("encoding must be one of AUTO|UTF8|UTF8M|UTF16|UTF16BE|UTF16LE|UTF16BEM|UTF16LEM|SJIS")
	}
	return encoding, err
}

func ParseLineBreak(s string) (text.LineBreak, error) {
	lb, err := text.ParseLineBreak(s)
	if err != nil {
		err = errors.New("line-break must be one of CRLF|CR|LF")
	}
	return lb, err
}
func ParseDelimiter(s string) (rune, error) {
	r := []rune(UnescapeString(s, '\''))
	if len(r) != 1 {
		return 0, errors.New("delimiter must be one character")
	}
	return r[0], nil
}

func ParseDelimiterPositions(s string) ([]int, bool, error) {
	s = UnescapeString(s, '\'')
	var delimiterPositions []int = nil
	singleLine := false

	if !strings.EqualFold(DelimitAutomatically, s) {
		if strings.HasPrefix(s, "s[") || strings.HasPrefix(s, "S[") {
			singleLine = true
			s = s[1:]
		}
		err := json.Unmarshal([]byte(s), &delimiterPositions)
		if err != nil {
			return delimiterPositions, singleLine, errors.New(fmt.Sprintf("delimiter positions must be %q or a JSON array of integers", DelimitAutomatically))
		}
	}
	return delimiterPositions, singleLine, nil
}

func ParseFormat(s string, et txjson.EscapeType) (Format, txjson.EscapeType, error) {
	var fm Format
	switch strings.ToUpper(s) {
	case "CSV":
		fm = CSV
	case "TSV":
		fm = TSV
	case "FIXED":
		fm = FIXED
	case "JSON":
		fm = JSON
	case "JSONL":
		fm = JSONL
	case "LTSV":
		fm = LTSV
	case "GFM":
		fm = GFM
	case "ORG":
		fm = ORG
	case "BOX":
		fm = BOX
	case "TEXT":
		fm = TEXT
	case "JSONH":
		fm = JSON
		et = txjson.HexDigits
	case "JSONA":
		fm = JSON
		et = txjson.AllWithHexDigits
	default:
		return fm, et, errors.New("format must be one of CSV|TSV|FIXED|JSON|JSONL|LTSV|GFM|ORG|BOX|TEXT")
	}
	return fm, et, nil
}

func ParseJsonEscapeType(s string) (txjson.EscapeType, error) {
	var escape txjson.EscapeType
	switch strings.ToUpper(s) {
	case "BACKSLASH":
		escape = txjson.Backslash
	case "HEX":
		escape = txjson.HexDigits
	case "HEXALL":
		escape = txjson.AllWithHexDigits
	default:
		return escape, errors.New("json escape type must be one of BACKSLASH|HEX|HEXALL")
	}
	return escape, nil
}

func AppendStrIfNotExist(list []string, elem string) []string {
	if len(elem) < 1 {
		return list
	}
	for _, v := range list {
		if elem == v {
			return list
		}
	}
	return append(list, elem)
}

func TextWidth(s string, flags *Flags) int {
	return text.Width(s, flags.ExportOptions.EastAsianEncoding, flags.ExportOptions.CountDiacriticalSign, flags.ExportOptions.CountFormatCode)
}

func RuneWidth(r rune, flags *Flags) int {
	return text.RuneWidth(r, flags.ExportOptions.EastAsianEncoding, flags.ExportOptions.CountDiacriticalSign, flags.ExportOptions.CountFormatCode)
}

func TrimSpace(s string) string {
	if 0 < len(s) && (unicode.IsSpace(rune(s[0])) || unicode.IsSpace(rune(s[len(s)-1]))) {
		s = strings.TrimSpace(s)
	}
	return s
}
