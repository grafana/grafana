package dateparse

import (
	"strconv"
	"strings"
)

type predicate func(char rune) bool

func isChar(a rune) predicate { return func(b rune) bool { return a == b } }

func takeAtMost(count int, str string, match predicate) (captured, rest string) {
	var result strings.Builder
	for i, ch := range str {
		if i == count {
			rest = trimPrefix(i, str)
			break
		}
		if !match(ch) {
			return result.String(), trimPrefix(i, str)
		}
		result.WriteRune(ch)
	}
	return result.String(), rest
}

func takeAll(str string, match predicate) (captured, rest string) {
	return takeAtMost(-1, str, match)
}

func takeNumberAtMostNChars(n int, chars string) (num uint, rest string, err error) {
	numChars, rest := takeAtMost(n, chars, isNumeral)
	parsedNum, err := strconv.ParseUint(numChars, 10, 32)
	if err != nil {
		return 0, "", err
	}
	return uint(parsedNum), rest, nil
}

func takeAllSpaces(str string) (rest string) {
	_, rest = takeAll(str, isChar(' '))
	return rest
}

func takeNumber(chars string) (num uint, rest string, err error) {
	numChars, rest := takeAll(chars, isNumeral)
	parsedNum, err := strconv.ParseUint(numChars, 10, 32)
	if err != nil {
		return 0, "", err
	}
	return uint(parsedNum), rest, nil
}

func isNumeral(r rune) bool {
	switch r {
	case '0', '1', '2', '3', '4', '5', '6', '7', '8', '9':
		return true
	}
	return false
}
