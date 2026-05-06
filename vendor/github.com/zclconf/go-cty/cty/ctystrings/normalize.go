package ctystrings

import (
	"golang.org/x/text/unicode/norm"
)

// Normalize applies NFC normalization to the given string, returning the
// transformed string.
//
// This function achieves the same effect as wrapping a string in a value
// using [cty.StringVal] and then unwrapping it again using [Value.AsString].
func Normalize(str string) string {
	return norm.NFC.String(str)
}
