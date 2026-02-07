package ascii

import "github.com/segmentio/asm/internal/unsafebytes"

// Valid returns true if b contains only ASCII characters.
func Valid(b []byte) bool {
	return ValidString(unsafebytes.String(b))
}

// ValidBytes returns true if b is an ASCII character.
func ValidByte(b byte) bool {
	return b <= 0x7f
}

// ValidBytes returns true if b is an ASCII character.
func ValidRune(r rune) bool {
	return r <= 0x7f
}
