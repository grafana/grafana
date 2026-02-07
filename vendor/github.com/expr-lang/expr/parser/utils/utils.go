package utils

import (
	"unicode"
	"unicode/utf8"
)

func IsValidIdentifier(str string) bool {
	if len(str) == 0 {
		return false
	}
	h, w := utf8.DecodeRuneInString(str)
	if !IsAlphabetic(h) {
		return false
	}
	for _, r := range str[w:] {
		if !IsAlphaNumeric(r) {
			return false
		}
	}
	return true
}

func IsSpace(r rune) bool {
	return unicode.IsSpace(r)
}

func IsAlphaNumeric(r rune) bool {
	return IsAlphabetic(r) || unicode.IsDigit(r)
}

func IsAlphabetic(r rune) bool {
	return r == '_' || r == '$' || unicode.IsLetter(r)
}
