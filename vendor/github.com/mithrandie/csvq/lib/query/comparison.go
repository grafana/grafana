package query

import (
	"strings"
	"time"
	"unicode/utf8"

	"github.com/mithrandie/csvq/lib/parser"
	"github.com/mithrandie/csvq/lib/value"

	"github.com/mithrandie/ternary"
)

func Is(p1 value.Primary, p2 value.Primary) ternary.Value {
	if value.IsNull(p2) {
		return ternary.ConvertFromBool(value.IsNull(p1))
	}

	return ternary.Equal(p1.Ternary(), p2.Ternary())
}

func Like(p1 value.Primary, p2 value.Primary) ternary.Value {
	if value.IsNull(p1) || value.IsNull(p2) {
		return ternary.UNKNOWN
	}

	s1 := value.ToString(p1)
	if value.IsNull(s1) {
		return ternary.UNKNOWN
	}
	str := strings.ToUpper(s1.(*value.String).Raw())
	value.Discard(s1)

	s2 := value.ToString(p2)
	if value.IsNull(s2) {
		return ternary.UNKNOWN
	}
	pattern := strings.ToUpper(s2.(*value.String).Raw())
	value.Discard(s2)

	if str == pattern {
		return ternary.TRUE
	}
	if len(pattern) < 1 {
		return ternary.FALSE
	}

	return matchText([]rune(str), []rune(pattern))
}

func matchText(text []rune, pattern []rune) ternary.Value {
	anyRunesMinLen, anyRunesMaxLen, searchWord, restPattern := matchCondition(pattern)

	anyRunes := text
	if 0 < len(searchWord) {
		textStr := string(text)
		bidx := strings.Index(textStr, string(searchWord))
		if bidx < 0 {
			return ternary.FALSE
		}

		idx := utf8.RuneCountInString(textStr[:bidx])
		if anyRunesMaxLen < 0 && matchText(text[idx+1:], pattern) == ternary.TRUE {
			return ternary.TRUE
		}
		anyRunes = text[:idx]
	}

	if len(anyRunes) < anyRunesMinLen {
		return ternary.FALSE
	}
	if -1 < anyRunesMaxLen && anyRunesMaxLen < len(anyRunes) {
		return ternary.FALSE
	}

	if len(restPattern) < 1 {
		return ternary.ConvertFromBool(len(anyRunes)+len(searchWord) == len(text))
	}

	return matchText(text[len(anyRunes)+len(searchWord):], restPattern)
}

func matchCondition(pattern []rune) (anyRunesMinLen int, anyRunesMaxLen int, searchWord []rune, restPattern []rune) {
	searchWord = make([]rune, 0, len(pattern)+4)
	patternPos := 0

	escaped := false
	for i := 0; i < len(pattern); i++ {
		r := pattern[i]

		if escaped {
			switch r {
			case '%', '_':
				searchWord = append(searchWord, r)
			default:
				searchWord = append(searchWord, '\\', r)
			}
			patternPos++
			escaped = false
			continue
		}

		if (r == '%' || r == '_') && 0 < len(searchWord) {
			break
		}
		patternPos++

		switch r {
		case '%':
			anyRunesMaxLen = -1
		case '_':
			anyRunesMinLen++
			if -1 < anyRunesMaxLen {
				anyRunesMaxLen++
			}
		case '\\':
			escaped = true
		default:
			searchWord = append(searchWord, r)
		}
	}
	if escaped {
		searchWord = append(searchWord, '\\')
	}

	return anyRunesMinLen, anyRunesMaxLen, searchWord, pattern[patternPos:]
}

func InRowValueList(rowValue value.RowValue, list []value.RowValue, matchType int, operator string, datetimeFormats []string, location *time.Location) (ternary.Value, error) {
	results := make([]ternary.Value, len(list))

	for i, v := range list {
		t, err := value.CompareRowValues(rowValue, v, operator, datetimeFormats, location)
		if err != nil {
			return ternary.FALSE, NewRowValueLengthInListError(i)
		}
		switch matchType {
		case parser.ANY:
			if t == ternary.TRUE {
				return ternary.TRUE, nil
			}
		default: // parser.ALL
			if t == ternary.FALSE {
				return ternary.FALSE, nil
			}
		}

		results[i] = t
	}

	switch matchType {
	case parser.ANY:
		return ternary.Any(results), nil
	default: // parser.ALL
		return ternary.All(results), nil
	}
}

func Any(rowValue value.RowValue, list []value.RowValue, operator string, datetimeFormats []string, location *time.Location) (ternary.Value, error) {
	return InRowValueList(rowValue, list, parser.ANY, operator, datetimeFormats, location)
}

func All(rowValue value.RowValue, list []value.RowValue, operator string, datetimeFormats []string, location *time.Location) (ternary.Value, error) {
	return InRowValueList(rowValue, list, parser.ALL, operator, datetimeFormats, location)
}
