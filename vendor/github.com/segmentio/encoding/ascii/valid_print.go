//go:generate go run valid_print_asm.go -out valid_print_amd64.s -stubs valid_print_amd64.go
package ascii

import (
	"github.com/segmentio/asm/ascii"
)

// Valid returns true if b contains only printable ASCII characters.
func ValidPrint(b []byte) bool {
	return ascii.ValidPrint(b)
}

// ValidBytes returns true if b is an ASCII character.
func ValidPrintByte(b byte) bool {
	return ascii.ValidPrintByte(b)
}

// ValidBytes returns true if b is an ASCII character.
func ValidPrintRune(r rune) bool {
	return ascii.ValidPrintRune(r)
}

// ValidString returns true if s contains only printable ASCII characters.
func ValidPrintString(s string) bool {
	return ascii.ValidPrintString(s)
}
