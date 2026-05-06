//go:generate go run valid_asm.go -out valid_amd64.s -stubs valid_amd64.go
package ascii

import (
	"github.com/segmentio/asm/ascii"
)

// Valid returns true if b contains only ASCII characters.
func Valid(b []byte) bool {
	return ascii.Valid(b)
}

// ValidBytes returns true if b is an ASCII character.
func ValidByte(b byte) bool {
	return ascii.ValidByte(b)
}

// ValidBytes returns true if b is an ASCII character.
func ValidRune(r rune) bool {
	return ascii.ValidRune(r)
}

// ValidString returns true if s contains only ASCII characters.
func ValidString(s string) bool {
	return ascii.ValidString(s)
}
