package ascii

import (
	"github.com/segmentio/asm/internal/unsafebytes"
)

// EqualFold is a version of bytes.EqualFold designed to work on ASCII input
// instead of UTF-8.
//
// When the program has guarantees that the input is composed of ASCII
// characters only, it allows for greater optimizations.
func EqualFold(a, b []byte) bool {
	return EqualFoldString(unsafebytes.String(a), unsafebytes.String(b))
}

func HasPrefixFold(s, prefix []byte) bool {
	return len(s) >= len(prefix) && EqualFold(s[:len(prefix)], prefix)
}

func HasSuffixFold(s, suffix []byte) bool {
	return len(s) >= len(suffix) && EqualFold(s[len(s)-len(suffix):], suffix)
}

func HasPrefixFoldString(s, prefix string) bool {
	return len(s) >= len(prefix) && EqualFoldString(s[:len(prefix)], prefix)
}

func HasSuffixFoldString(s, suffix string) bool {
	return len(s) >= len(suffix) && EqualFoldString(s[len(s)-len(suffix):], suffix)
}
