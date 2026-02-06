//go:generate go run equal_fold_asm.go -out equal_fold_amd64.s -stubs equal_fold_amd64.go
package ascii

import (
	"github.com/segmentio/asm/ascii"
)

// EqualFold is a version of bytes.EqualFold designed to work on ASCII input
// instead of UTF-8.
//
// When the program has guarantees that the input is composed of ASCII
// characters only, it allows for greater optimizations.
func EqualFold(a, b []byte) bool {
	return ascii.EqualFold(a, b)
}

func HasPrefixFold(s, prefix []byte) bool {
	return ascii.HasPrefixFold(s, prefix)
}

func HasSuffixFold(s, suffix []byte) bool {
	return ascii.HasSuffixFold(s, suffix)
}

// EqualFoldString is a version of strings.EqualFold designed to work on ASCII
// input instead of UTF-8.
//
// When the program has guarantees that the input is composed of ASCII
// characters only, it allows for greater optimizations.
func EqualFoldString(a, b string) bool {
	return ascii.EqualFoldString(a, b)
}

func HasPrefixFoldString(s, prefix string) bool {
	return ascii.HasPrefixFoldString(s, prefix)
}

func HasSuffixFoldString(s, suffix string) bool {
	return ascii.HasSuffixFoldString(s, suffix)
}
