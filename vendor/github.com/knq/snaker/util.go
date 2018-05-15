package snaker

import (
	"regexp"
	"strings"
	"unicode"
)

const (
	// minInitialismLen is the min length of any of the commonInitialisms.
	minInitialismLen = 2

	// maxInitialismLen is the max length of any of the commonInitialisms.
	maxInitialismLen = 5
)

// min returns the minimum of a, b.
func min(a, b int) int {
	if a < b {
		return a
	}

	return b
}

// peekInitialism returns the next longest possible initialism in rs.
func peekInitialism(rs []rune) string {
	// do no work
	if len(rs) < minInitialismLen {
		return ""
	}

	// grab at most next maxInitialismLen uppercase characters
	l := min(len(rs), maxInitialismLen)
	var z []rune
	for i := 0; i < l; i++ {
		if !unicode.IsUpper(rs[i]) {
			break
		}
		z = append(z, rs[i])
	}

	// bail if next few characters were not uppercase.
	if len(z) < minInitialismLen {
		return ""
	}

	// determine if common initialism
	for i := min(maxInitialismLen, len(z)); i >= minInitialismLen; i-- {
		if r := string(z[:i]); commonInitialisms[r] {
			return r
		}
	}

	return ""
}

// isIdentifierChar determines if ch is a valid character for a Go identifier.
//
// see: go/src/go/scanner/scanner.go
func isIdentifierChar(ch rune) bool {
	return 'a' <= ch && ch <= 'z' || 'A' <= ch && ch <= 'Z' || ch == '_' || ch >= 0x80 && unicode.IsLetter(ch) ||
		'0' <= ch && ch <= '9' || ch >= 0x80 && unicode.IsDigit(ch)
}

// replaceBadChars strips characters and character sequences that are invalid
// characters for Go identifiers.
func replaceBadChars(s string) string {
	// strip bad characters
	r := []rune{}
	for _, ch := range s {
		if isIdentifierChar(ch) {
			r = append(r, ch)
		} else {
			r = append(r, '_')
		}
	}

	return string(r)
}

// underscoreRE matches underscores.
var underscoreRE = regexp.MustCompile(`_+`)

// leadingRE matches leading numbers.
var leadingRE = regexp.MustCompile(`^[0-9_]+`)

// toIdentifier cleans up a string so that it is usable as an identifier.
func toIdentifier(s string) string {
	// replace bad chars with _
	s = replaceBadChars(strings.TrimSpace(s))

	// fix 2 or more __ and remove leading numbers/underscores
	s = underscoreRE.ReplaceAllString(s, "_")
	s = leadingRE.ReplaceAllString(s, "_")

	// remove leading/trailing underscores
	s = strings.TrimLeft(s, "_")
	s = strings.TrimRight(s, "_")

	return s
}
