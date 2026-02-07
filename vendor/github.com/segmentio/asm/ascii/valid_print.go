package ascii

import "github.com/segmentio/asm/internal/unsafebytes"

// ValidPrint returns true if b contains only printable ASCII characters.
func ValidPrint(b []byte) bool {
	return ValidPrintString(unsafebytes.String(b))
}

// ValidPrintBytes returns true if b is an ASCII character.
func ValidPrintByte(b byte) bool {
	return 0x20 <= b && b <= 0x7e
}

// ValidPrintBytes returns true if b is an ASCII character.
func ValidPrintRune(r rune) bool {
	return 0x20 <= r && r <= 0x7e
}
