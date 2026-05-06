// Copyright 2019 CUE Authors
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

// Package regexp implements regular expression search.
//
// The syntax of the regular expressions accepted is the same
// general syntax used by Perl, Python, and other languages.
// More precisely, it is the syntax accepted by RE2 and described at
// https://golang.org/s/re2syntax, except for \C.
// For an overview of the syntax, run
//
//	go doc regexp/syntax
//
// The regexp implementation provided by this package is
// guaranteed to run in time linear in the size of the input.
// (This is a property not guaranteed by most open source
// implementations of regular expressions.) For more information
// about this property, see
//
//	https://swtch.com/~rsc/regexp/regexp1.html
//
// or any book about automata theory.
//
// All characters are UTF-8-encoded code points.
//
// The regexp package functions match a regular expression and identify
// the matched text. Their names are matched by this regular expression:
//
//	Find(All)?(Submatch)?
//
// If 'All' is present, the routine matches successive non-overlapping
// matches of the entire expression. Empty matches abutting a preceding
// match are ignored. The return value is a slice containing the successive
// return values of the corresponding non-'All' routine. These routines take
// an extra integer argument, n. If n >= 0, the function returns at most n
// matches/submatches; otherwise, it returns all of them.
//
// If 'Submatch' is present, the return value is a slice identifying the
// successive submatches of the expression. Submatches are matches of
// parenthesized subexpressions (also known as capturing groups) within the
// regular expression, numbered from left to right in order of opening
// parenthesis. Submatch 0 is the match of the entire expression, submatch 1
// the match of the first parenthesized subexpression, and so on.
package regexp

import (
	"regexp"

	"cuelang.org/go/cue/errors"
)

var errNoMatch = errors.New("no match")

// Find returns a list holding the text of the leftmost match in b of the regular expression.
// A return value of bottom indicates no match.
func Find(pattern, s string) (string, error) {
	re, err := regexp.Compile(pattern)
	if err != nil {
		return "", err
	}
	m := re.FindStringIndex(s)
	if m == nil {
		return "", errNoMatch
	}
	return s[m[0]:m[1]], nil
}

// FindAll is the 'All' version of Find; it returns a list of all successive
// matches of the expression, as defined by the 'All' description in the
// package comment.
// A return value of bottom indicates no match.
func FindAll(pattern, s string, n int) ([]string, error) {
	re, err := regexp.Compile(pattern)
	if err != nil {
		return nil, err
	}
	m := re.FindAllString(s, n)
	if m == nil {
		return nil, errNoMatch
	}
	return m, nil
}

// FindAllNamedSubmatch is like FindAllSubmatch, but returns a list of maps
// with the named used in capturing groups. See FindNamedSubmatch for an
// example on how to use named groups.
func FindAllNamedSubmatch(pattern, s string, n int) ([]map[string]string, error) {
	re, err := regexp.Compile(pattern)
	if err != nil {
		return nil, err
	}
	names := re.SubexpNames()
	if len(names) == 0 {
		return nil, errNoNamedGroup
	}
	m := re.FindAllStringSubmatch(s, n)
	if m == nil {
		return nil, errNoMatch
	}
	result := make([]map[string]string, len(m))
	for i, m := range m {
		r := make(map[string]string, len(names)-1)
		for k, name := range names {
			if name != "" {
				r[name] = m[k]
			}
		}
		result[i] = r
	}
	return result, nil
}

var errNoNamedGroup = errors.New("no named groups")

// FindAllSubmatch is the 'All' version of FindSubmatch; it returns a list
// of all successive matches of the expression, as defined by the 'All'
// description in the package comment.
// A return value of bottom indicates no match.
func FindAllSubmatch(pattern, s string, n int) ([][]string, error) {
	re, err := regexp.Compile(pattern)
	if err != nil {
		return nil, err
	}
	m := re.FindAllStringSubmatch(s, n)
	if m == nil {
		return nil, errNoMatch
	}
	return m, nil
}

// FindNamedSubmatch is like FindSubmatch, but returns a map with the names used
// in capturing groups.
//
// Example:
//
//	regexp.FindNamedSubmatch(#"Hello (?P<person>\w*)!"#, "Hello World!")
//
// Output:
//
//	[{person: "World"}]
func FindNamedSubmatch(pattern, s string) (map[string]string, error) {
	re, err := regexp.Compile(pattern)
	if err != nil {
		return nil, err
	}
	names := re.SubexpNames()
	if len(names) == 0 {
		return nil, errNoNamedGroup
	}
	m := re.FindStringSubmatch(s)
	if m == nil {
		return nil, errNoMatch
	}
	r := make(map[string]string, len(names)-1)
	for k, name := range names {
		if name != "" {
			r[name] = m[k]
		}
	}
	return r, nil
}

// FindSubmatch returns a list of lists holding the text of the leftmost
// match of the regular expression in b and the matches, if any, of its
// subexpressions, as defined by the 'Submatch' descriptions in the package
// comment.
// A return value of bottom indicates no match.
func FindSubmatch(pattern, s string) ([]string, error) {
	re, err := regexp.Compile(pattern)
	if err != nil {
		return nil, err
	}
	m := re.FindStringSubmatch(s)
	if m == nil {
		return nil, errNoMatch
	}
	return m, nil
}

// ReplaceAll returns a copy of src, replacing variables in repl with
// corresponding matches drawn from src, according to the following rules.
//
// In the template repl, a variable is denoted by a substring of the form $name
// or ${name}, where name is a non-empty sequence of letters, digits, and
// underscores. A purely numeric name like $1 refers to the submatch with the
// corresponding index; other names refer to capturing parentheses named with
// the (?P<name>...) syntax. A reference to an out of range or unmatched index
// or a name that is not present in the regular expression is replaced with an
// empty slice.
//
// In the $name form, name is taken to be as long as possible: $1x is
// equivalent to ${1x}, not ${1}x, and, $10 is equivalent to ${10}, not ${1}0.
//
// To insert a literal $ in the output, use $$ in the template.
func ReplaceAll(pattern, src, repl string) (string, error) {
	re, err := regexp.Compile(pattern)
	if err != nil {
		return "", err
	}
	return re.ReplaceAllString(src, repl), nil
}

// ReplaceAllLiteral returns a copy of src, replacing matches of the regexp
// pattern with the replacement string repl. The replacement repl is substituted
// directly.
func ReplaceAllLiteral(pattern, src, repl string) (string, error) {
	re, err := regexp.Compile(pattern)
	if err != nil {
		return "", err
	}
	return re.ReplaceAllLiteralString(src, repl), nil
}

// Valid reports whether the given regular expression
// is valid.
func Valid(pattern string) (bool, error) {
	_, err := regexp.Compile(pattern)
	return err == nil, err
}
