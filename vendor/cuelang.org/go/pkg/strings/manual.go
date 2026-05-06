// Copyright 2018 The CUE Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Package strings implements simple functions to manipulate UTF-8 encoded
// strings.package strings.
//
// Some of the functions in this package are specifically intended as field
// constraints. For instance, MaxRunes as used in this CUE program
//
//	import "strings"
//
//	myString: strings.MaxRunes(5)
//
// specifies that the myString should be at most 5 code points.
package strings

import (
	"fmt"
	"strings"
	"unicode"
)

// ByteAt reports the ith byte of the underlying strings or byte.
func ByteAt(b []byte, i int) (byte, error) {
	if i < 0 || i >= len(b) {
		return 0, fmt.Errorf("index out of range")
	}
	return b[i], nil
}

// ByteSlice reports the bytes of the underlying string data from the start
// index up to but not including the end index.
func ByteSlice(b []byte, start, end int) ([]byte, error) {
	if start < 0 || start > end || end > len(b) {
		return nil, fmt.Errorf("index out of range")
	}
	return b[start:end], nil
}

// Runes returns the Unicode code points of the given string.
func Runes(s string) []rune {
	return []rune(s)
}

// MinRunes reports whether the number of runes (Unicode codepoints) in a string
// is at least a certain minimum. MinRunes can be used a a field constraint to
// except all strings for which this property holds.
func MinRunes(s string, min int) bool {
	// TODO: CUE strings cannot be invalid UTF-8. In case this changes, we need
	// to use the following conversion to count properly:
	// s, _ = unicodeenc.UTF8.NewDecoder().String(s)
	return len([]rune(s)) >= min
}

// MaxRunes reports whether the number of runes (Unicode codepoints) in a string
// exceeds a certain maximum. MaxRunes can be used a a field constraint to
// except all strings for which this property holds
func MaxRunes(s string, max int) bool {
	// See comment in MinRunes implementation.
	return len([]rune(s)) <= max
}

// ToTitle returns a copy of the string s with all Unicode letters that begin
// words mapped to their title case.
func ToTitle(s string) string {
	// Use a closure here to remember state.
	// Hackish but effective. Depends on Map scanning in order and calling
	// the closure once per rune.
	prev := ' '
	return strings.Map(
		func(r rune) rune {
			if unicode.IsSpace(prev) {
				prev = r
				return unicode.ToTitle(r)
			}
			prev = r
			return r
		},
		s)
}

// ToCamel returns a copy of the string s with all Unicode letters that begin
// words mapped to lower case.
func ToCamel(s string) string {
	// Use a closure here to remember state.
	// Hackish but effective. Depends on Map scanning in order and calling
	// the closure once per rune.
	prev := ' '
	return strings.Map(
		func(r rune) rune {
			if unicode.IsSpace(prev) {
				prev = r
				return unicode.ToLower(r)
			}
			prev = r
			return r
		},
		s)
}

// SliceRunes returns a string of the underlying string data from the start index
// up to but not including the end index.
func SliceRunes(s string, start, end int) (string, error) {
	runes := []rune(s)
	if start < 0 || start > end || end > len(runes) {
		return "", fmt.Errorf("index out of range")
	}
	return string(runes[start:end]), nil
}
