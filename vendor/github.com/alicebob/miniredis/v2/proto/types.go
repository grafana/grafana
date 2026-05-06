package proto

import (
	"fmt"
	"strings"
)

// Byte-safe string
func String(s string) string {
	return fmt.Sprintf("$%d\r\n%s\r\n", len(s), s)
}

// Inline string
func Inline(s string) string {
	return inline('+', s)
}

// Error
func Error(s string) string {
	return inline('-', s)
}

func inline(r rune, s string) string {
	return fmt.Sprintf("%s%s\r\n", string(r), s)
}

// Int
func Int(n int) string {
	return fmt.Sprintf(":%d\r\n", n)
}

// Float
func Float(n float64) string {
	return fmt.Sprintf(",%g\r\n", n)
}

const (
	Nil      = "$-1\r\n"
	NilResp3 = "_\r\n"
	NilList  = "*-1\r\n"
)

// Array assembles the args in a list. Args should be raw redis commands.
// Example: Array(String("foo"), String("bar"))
func Array(args ...string) string {
	return fmt.Sprintf("*%d\r\n", len(args)) + strings.Join(args, "")
}

// Push assembles the args for push-data. Args should be raw redis commands.
// Example: Push(String("foo"), String("bar"))
func Push(args ...string) string {
	return fmt.Sprintf(">%d\r\n", len(args)) + strings.Join(args, "")
}

// Strings is a helper to build 1 dimensional string arrays.
func Strings(args ...string) string {
	var strings []string
	for _, a := range args {
		strings = append(strings, String(a))
	}
	return Array(strings...)
}

// Ints is a helper to build 1 dimensional int arrays.
func Ints(args ...int) string {
	var ints []string
	for _, a := range args {
		ints = append(ints, Int(a))
	}
	return Array(ints...)
}

// Map assembles the args in a map. Args should be raw redis commands.
// Must be an even number of arguments.
// Example: Map(String("foo"), String("bar"))
func Map(args ...string) string {
	return fmt.Sprintf("%%%d\r\n", len(args)/2) + strings.Join(args, "")
}

// StringMap is is a wrapper to get a map of (bulk)strings.
func StringMap(args ...string) string {
	var strings []string
	for _, a := range args {
		strings = append(strings, String(a))
	}
	return Map(strings...)
}

// Set assembles the args in a map. Args should be raw redis commands.
// Example: Set(String("foo"), String("bar"))
func Set(args ...string) string {
	return fmt.Sprintf("~%d\r\n", len(args)) + strings.Join(args, "")
}

// StringSet is is a wrapper to get a set of (bulk)strings.
func StringSet(args ...string) string {
	var strings []string
	for _, a := range args {
		strings = append(strings, String(a))
	}
	return Set(strings...)
}
