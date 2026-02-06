// Copyright 2020 The Prometheus Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package labels

import (
	"slices"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/grafana/regexp"
	"github.com/grafana/regexp/syntax"
	"golang.org/x/text/unicode/norm"
)

const (
	maxSetMatches = 256

	// The minimum number of alternate values a regex should have to trigger
	// the optimization done by optimizeEqualOrPrefixStringMatchers() and so use a map
	// to match values instead of iterating over a list. This value has
	// been computed running BenchmarkOptimizeEqualStringMatchers.
	minEqualMultiStringMatcherMapThreshold = 16
)

type FastRegexMatcher struct {
	// Under some conditions, re is nil because the expression is never parsed.
	// We store the original string to be able to return it in GetRegexString().
	reString string
	re       *regexp.Regexp

	setMatches    []string
	stringMatcher StringMatcher
	prefix        string
	suffix        string
	contains      []string

	// matchString is the "compiled" function to run by MatchString().
	matchString func(string) bool
}

func NewFastRegexMatcher(v string) (*FastRegexMatcher, error) {
	m := &FastRegexMatcher{
		reString: v,
	}

	m.stringMatcher, m.setMatches = optimizeAlternatingLiterals(v)
	if m.stringMatcher != nil {
		// If we already have a string matcher, we don't need to parse the regex
		// or compile the matchString function. This also avoids the behavior in
		// compileMatchStringFunction where it prefers to use setMatches when
		// available, even if the string matcher is faster.
		m.matchString = m.stringMatcher.Matches
	} else {
		parsed, err := syntax.Parse(v, syntax.Perl|syntax.DotNL)
		if err != nil {
			return nil, err
		}
		// Simplify the syntax tree to run faster.
		parsed = parsed.Simplify()
		m.re, err = regexp.Compile("^(?s:" + parsed.String() + ")$")
		if err != nil {
			return nil, err
		}
		if parsed.Op == syntax.OpConcat {
			m.prefix, m.suffix, m.contains = optimizeConcatRegex(parsed)
		}
		if matches, caseSensitive := findSetMatches(parsed); caseSensitive {
			m.setMatches = matches
		}
		m.stringMatcher = stringMatcherFromRegexp(parsed)
		m.matchString = m.compileMatchStringFunction()
	}

	return m, nil
}

// compileMatchStringFunction returns the function to run by MatchString().
func (m *FastRegexMatcher) compileMatchStringFunction() func(string) bool {
	// If the only optimization available is the string matcher, then we can just run it.
	if len(m.setMatches) == 0 && m.prefix == "" && m.suffix == "" && len(m.contains) == 0 && m.stringMatcher != nil {
		return m.stringMatcher.Matches
	}

	return func(s string) bool {
		if len(m.setMatches) != 0 {
			for _, match := range m.setMatches {
				if match == s {
					return true
				}
			}
			return false
		}
		if m.prefix != "" && !strings.HasPrefix(s, m.prefix) {
			return false
		}
		if m.suffix != "" && !strings.HasSuffix(s, m.suffix) {
			return false
		}
		if len(m.contains) > 0 && !containsInOrder(s, m.contains) {
			return false
		}
		if m.stringMatcher != nil {
			return m.stringMatcher.Matches(s)
		}
		return m.re.MatchString(s)
	}
}

// IsOptimized returns true if any fast-path optimization is applied to the
// regex matcher.
func (m *FastRegexMatcher) IsOptimized() bool {
	return len(m.setMatches) > 0 || m.stringMatcher != nil || m.prefix != "" || m.suffix != "" || len(m.contains) > 0
}

// findSetMatches extract equality matches from a regexp.
// Returns nil if we can't replace the regexp by only equality matchers or the regexp contains
// a mix of case sensitive and case insensitive matchers.
func findSetMatches(re *syntax.Regexp) (matches []string, caseSensitive bool) {
	clearBeginEndText(re)

	return findSetMatchesInternal(re, "")
}

func findSetMatchesInternal(re *syntax.Regexp, base string) (matches []string, caseSensitive bool) {
	switch re.Op {
	case syntax.OpBeginText:
		// Correctly handling the begin text operator inside a regex is tricky,
		// so in this case we fallback to the regex engine.
		return nil, false
	case syntax.OpEndText:
		// Correctly handling the end text operator inside a regex is tricky,
		// so in this case we fallback to the regex engine.
		return nil, false
	case syntax.OpLiteral:
		return []string{base + string(re.Rune)}, isCaseSensitive(re)
	case syntax.OpEmptyMatch:
		if base != "" {
			return []string{base}, isCaseSensitive(re)
		}
	case syntax.OpAlternate:
		return findSetMatchesFromAlternate(re, base)
	case syntax.OpCapture:
		clearCapture(re)
		return findSetMatchesInternal(re, base)
	case syntax.OpConcat:
		return findSetMatchesFromConcat(re, base)
	case syntax.OpCharClass:
		if len(re.Rune)%2 != 0 {
			return nil, false
		}
		var matches []string
		var totalSet int
		for i := 0; i+1 < len(re.Rune); i += 2 {
			totalSet += int(re.Rune[i+1]-re.Rune[i]) + 1
		}
		// limits the total characters that can be used to create matches.
		// In some case like negation [^0-9] a lot of possibilities exists and that
		// can create thousands of possible matches at which points we're better off using regexp.
		if totalSet > maxSetMatches {
			return nil, false
		}
		for i := 0; i+1 < len(re.Rune); i += 2 {
			lo, hi := re.Rune[i], re.Rune[i+1]
			for c := lo; c <= hi; c++ {
				matches = append(matches, base+string(c))
			}
		}
		return matches, isCaseSensitive(re)
	default:
		return nil, false
	}
	return nil, false
}

func findSetMatchesFromConcat(re *syntax.Regexp, base string) (matches []string, matchesCaseSensitive bool) {
	if len(re.Sub) == 0 {
		return nil, false
	}
	clearCapture(re.Sub...)

	matches = []string{base}

	for i := 0; i < len(re.Sub); i++ {
		var newMatches []string
		for j, b := range matches {
			m, caseSensitive := findSetMatchesInternal(re.Sub[i], b)
			if m == nil {
				return nil, false
			}
			if tooManyMatches(newMatches, m...) {
				return nil, false
			}

			// All matches must have the same case sensitivity. If it's the first set of matches
			// returned, we store its sensitivity as the expected case, and then we'll check all
			// other ones.
			if i == 0 && j == 0 {
				matchesCaseSensitive = caseSensitive
			}
			if matchesCaseSensitive != caseSensitive {
				return nil, false
			}

			newMatches = append(newMatches, m...)
		}
		matches = newMatches
	}

	return matches, matchesCaseSensitive
}

func findSetMatchesFromAlternate(re *syntax.Regexp, base string) (matches []string, matchesCaseSensitive bool) {
	for i, sub := range re.Sub {
		found, caseSensitive := findSetMatchesInternal(sub, base)
		if found == nil {
			return nil, false
		}
		if tooManyMatches(matches, found...) {
			return nil, false
		}

		// All matches must have the same case sensitivity. If it's the first set of matches
		// returned, we store its sensitivity as the expected case, and then we'll check all
		// other ones.
		if i == 0 {
			matchesCaseSensitive = caseSensitive
		}
		if matchesCaseSensitive != caseSensitive {
			return nil, false
		}

		matches = append(matches, found...)
	}

	return matches, matchesCaseSensitive
}

// clearCapture removes capture operation as they are not used for matching.
func clearCapture(regs ...*syntax.Regexp) {
	for _, r := range regs {
		// Iterate on the regexp because capture groups could be nested.
		for r.Op == syntax.OpCapture {
			*r = *r.Sub[0]
		}
	}
}

// clearBeginEndText removes the begin and end text from the regexp. Prometheus regexp are anchored to the beginning and end of the string.
func clearBeginEndText(re *syntax.Regexp) {
	// Do not clear begin/end text from an alternate operator because it could
	// change the actual regexp properties.
	if re.Op == syntax.OpAlternate {
		return
	}

	if len(re.Sub) == 0 {
		return
	}
	if len(re.Sub) == 1 {
		if re.Sub[0].Op == syntax.OpBeginText || re.Sub[0].Op == syntax.OpEndText {
			// We need to remove this element. Since it's the only one, we convert into a matcher of an empty string.
			// OpEmptyMatch is regexp's nop operator.
			re.Op = syntax.OpEmptyMatch
			re.Sub = nil
			return
		}
	}
	if re.Sub[0].Op == syntax.OpBeginText {
		re.Sub = re.Sub[1:]
	}
	if re.Sub[len(re.Sub)-1].Op == syntax.OpEndText {
		re.Sub = re.Sub[:len(re.Sub)-1]
	}
}

// isCaseInsensitive tells if a regexp is case insensitive.
// The flag should be check at each level of the syntax tree.
func isCaseInsensitive(reg *syntax.Regexp) bool {
	return (reg.Flags & syntax.FoldCase) != 0
}

// isCaseSensitive tells if a regexp is case sensitive.
// The flag should be check at each level of the syntax tree.
func isCaseSensitive(reg *syntax.Regexp) bool {
	return !isCaseInsensitive(reg)
}

// tooManyMatches guards against creating too many set matches.
func tooManyMatches(matches []string, added ...string) bool {
	return len(matches)+len(added) > maxSetMatches
}

func (m *FastRegexMatcher) MatchString(s string) bool {
	return m.matchString(s)
}

func (m *FastRegexMatcher) SetMatches() []string {
	// IMPORTANT: always return a copy, otherwise if the caller manipulate this slice it will
	// also get manipulated in the cached FastRegexMatcher instance.
	return slices.Clone(m.setMatches)
}

func (m *FastRegexMatcher) GetRegexString() string {
	return m.reString
}

// optimizeAlternatingLiterals optimizes a regex of the form
//
//	`literal1|literal2|literal3|...`
//
// this function returns an optimized StringMatcher or nil if the regex
// cannot be optimized in this way, and a list of setMatches up to maxSetMatches.
func optimizeAlternatingLiterals(s string) (StringMatcher, []string) {
	if len(s) == 0 {
		return emptyStringMatcher{}, nil
	}

	estimatedAlternates := strings.Count(s, "|") + 1

	// If there are no alternates, check if the string is a literal
	if estimatedAlternates == 1 {
		if regexp.QuoteMeta(s) == s {
			return &equalStringMatcher{s: s, caseSensitive: true}, []string{s}
		}
		return nil, nil
	}

	multiMatcher := newEqualMultiStringMatcher(true, estimatedAlternates, 0, 0)

	for end := strings.IndexByte(s, '|'); end > -1; end = strings.IndexByte(s, '|') {
		// Split the string into the next literal and the remainder
		subMatch := s[:end]
		s = s[end+1:]

		// break if any of the submatches are not literals
		if regexp.QuoteMeta(subMatch) != subMatch {
			return nil, nil
		}

		multiMatcher.add(subMatch)
	}

	// break if the remainder is not a literal
	if regexp.QuoteMeta(s) != s {
		return nil, nil
	}
	multiMatcher.add(s)

	return multiMatcher, multiMatcher.setMatches()
}

// optimizeConcatRegex returns literal prefix/suffix text that can be safely
// checked against the label value before running the regexp matcher.
func optimizeConcatRegex(r *syntax.Regexp) (prefix, suffix string, contains []string) {
	sub := r.Sub
	clearCapture(sub...)

	// We can safely remove begin and end text matchers respectively
	// at the beginning and end of the regexp.
	if len(sub) > 0 && sub[0].Op == syntax.OpBeginText {
		sub = sub[1:]
	}
	if len(sub) > 0 && sub[len(sub)-1].Op == syntax.OpEndText {
		sub = sub[:len(sub)-1]
	}

	if len(sub) == 0 {
		return
	}

	// Given Prometheus regex matchers are always anchored to the begin/end
	// of the text, if the first/last operations are literals, we can safely
	// treat them as prefix/suffix.
	if sub[0].Op == syntax.OpLiteral && (sub[0].Flags&syntax.FoldCase) == 0 {
		prefix = string(sub[0].Rune)
	}
	if last := len(sub) - 1; sub[last].Op == syntax.OpLiteral && (sub[last].Flags&syntax.FoldCase) == 0 {
		suffix = string(sub[last].Rune)
	}

	// If contains any literal which is not a prefix/suffix, we keep track of
	// all the ones which are case-sensitive.
	for i := 1; i < len(sub)-1; i++ {
		if sub[i].Op == syntax.OpLiteral && (sub[i].Flags&syntax.FoldCase) == 0 {
			contains = append(contains, string(sub[i].Rune))
		}
	}

	return
}

// StringMatcher is a matcher that matches a string in place of a regular expression.
type StringMatcher interface {
	Matches(s string) bool
}

// stringMatcherFromRegexp attempts to replace a common regexp with a string matcher.
// It returns nil if the regexp is not supported.
func stringMatcherFromRegexp(re *syntax.Regexp) StringMatcher {
	clearBeginEndText(re)

	m := stringMatcherFromRegexpInternal(re)
	m = optimizeEqualOrPrefixStringMatchers(m, minEqualMultiStringMatcherMapThreshold)

	return m
}

func stringMatcherFromRegexpInternal(re *syntax.Regexp) StringMatcher {
	clearCapture(re)

	switch re.Op {
	case syntax.OpBeginText:
		// Correctly handling the begin text operator inside a regex is tricky,
		// so in this case we fallback to the regex engine.
		return nil
	case syntax.OpEndText:
		// Correctly handling the end text operator inside a regex is tricky,
		// so in this case we fallback to the regex engine.
		return nil
	case syntax.OpPlus:
		if re.Sub[0].Op != syntax.OpAnyChar && re.Sub[0].Op != syntax.OpAnyCharNotNL {
			return nil
		}
		return &anyNonEmptyStringMatcher{
			matchNL: re.Sub[0].Op == syntax.OpAnyChar,
		}
	case syntax.OpStar:
		if re.Sub[0].Op != syntax.OpAnyChar && re.Sub[0].Op != syntax.OpAnyCharNotNL {
			return nil
		}

		// If the newline is valid, than this matcher literally match any string (even empty).
		if re.Sub[0].Op == syntax.OpAnyChar {
			return trueMatcher{}
		}

		// Any string is fine (including an empty one), as far as it doesn't contain any newline.
		return anyStringWithoutNewlineMatcher{}
	case syntax.OpQuest:
		// Only optimize for ".?".
		if len(re.Sub) != 1 || (re.Sub[0].Op != syntax.OpAnyChar && re.Sub[0].Op != syntax.OpAnyCharNotNL) {
			return nil
		}

		return &zeroOrOneCharacterStringMatcher{
			matchNL: re.Sub[0].Op == syntax.OpAnyChar,
		}
	case syntax.OpEmptyMatch:
		return emptyStringMatcher{}

	case syntax.OpLiteral:
		return &equalStringMatcher{
			s:             string(re.Rune),
			caseSensitive: !isCaseInsensitive(re),
		}
	case syntax.OpAlternate:
		or := make([]StringMatcher, 0, len(re.Sub))
		for _, sub := range re.Sub {
			m := stringMatcherFromRegexpInternal(sub)
			if m == nil {
				return nil
			}
			or = append(or, m)
		}
		return orStringMatcher(or)
	case syntax.OpConcat:
		clearCapture(re.Sub...)

		if len(re.Sub) == 0 {
			return emptyStringMatcher{}
		}
		if len(re.Sub) == 1 {
			return stringMatcherFromRegexpInternal(re.Sub[0])
		}

		var left, right StringMatcher

		// Let's try to find if there's a first and last any matchers.
		if re.Sub[0].Op == syntax.OpPlus || re.Sub[0].Op == syntax.OpStar || re.Sub[0].Op == syntax.OpQuest {
			left = stringMatcherFromRegexpInternal(re.Sub[0])
			if left == nil {
				return nil
			}
			re.Sub = re.Sub[1:]
		}
		if re.Sub[len(re.Sub)-1].Op == syntax.OpPlus || re.Sub[len(re.Sub)-1].Op == syntax.OpStar || re.Sub[len(re.Sub)-1].Op == syntax.OpQuest {
			right = stringMatcherFromRegexpInternal(re.Sub[len(re.Sub)-1])
			if right == nil {
				return nil
			}
			re.Sub = re.Sub[:len(re.Sub)-1]
		}

		matches, matchesCaseSensitive := findSetMatchesInternal(re, "")

		if len(matches) == 0 && len(re.Sub) == 2 {
			// We have not find fixed set matches. We look for other known cases that
			// we can optimize.
			switch {
			// Prefix is literal.
			case right == nil && re.Sub[0].Op == syntax.OpLiteral:
				right = stringMatcherFromRegexpInternal(re.Sub[1])
				if right != nil {
					matches = []string{string(re.Sub[0].Rune)}
					matchesCaseSensitive = !isCaseInsensitive(re.Sub[0])
				}

			// Suffix is literal.
			case left == nil && re.Sub[1].Op == syntax.OpLiteral:
				left = stringMatcherFromRegexpInternal(re.Sub[0])
				if left != nil {
					matches = []string{string(re.Sub[1].Rune)}
					matchesCaseSensitive = !isCaseInsensitive(re.Sub[1])
				}
			}
		}

		// Ensure we've found some literals to match (optionally with a left and/or right matcher).
		// If not, then this optimization doesn't trigger.
		if len(matches) == 0 {
			return nil
		}

		// Use the right (and best) matcher based on what we've found.
		switch {
		// No left and right matchers (only fixed set matches).
		case left == nil && right == nil:
			// if there's no any matchers on both side it's a concat of literals
			or := make([]StringMatcher, 0, len(matches))
			for _, match := range matches {
				or = append(or, &equalStringMatcher{
					s:             match,
					caseSensitive: matchesCaseSensitive,
				})
			}
			return orStringMatcher(or)

		// Right matcher with 1 fixed set match.
		case left == nil && len(matches) == 1:
			return newLiteralPrefixStringMatcher(matches[0], matchesCaseSensitive, right)

		// Left matcher with 1 fixed set match.
		case right == nil && len(matches) == 1:
			return &literalSuffixStringMatcher{
				left:                left,
				suffix:              matches[0],
				suffixCaseSensitive: matchesCaseSensitive,
			}

		// We found literals in the middle. We can trigger the fast path only if
		// the matches are case sensitive because containsStringMatcher doesn't
		// support case insensitive.
		case matchesCaseSensitive:
			return &containsStringMatcher{
				substrings: matches,
				left:       left,
				right:      right,
			}
		}
	}
	return nil
}

// containsStringMatcher matches a string if it contains any of the substrings.
// If left and right are not nil, it's a contains operation where left and right must match.
// If left is nil, it's a hasPrefix operation and right must match.
// Finally, if right is nil it's a hasSuffix operation and left must match.
type containsStringMatcher struct {
	// The matcher that must match the left side. Can be nil.
	left StringMatcher

	// At least one of these strings must match in the "middle", between left and right matchers.
	substrings []string

	// The matcher that must match the right side. Can be nil.
	right StringMatcher
}

func (m *containsStringMatcher) Matches(s string) bool {
	for _, substr := range m.substrings {
		switch {
		case m.right != nil && m.left != nil:
			searchStartPos := 0

			for {
				pos := strings.Index(s[searchStartPos:], substr)
				if pos < 0 {
					break
				}

				// Since we started searching from searchStartPos, we have to add that offset
				// to get the actual position of the substring inside the text.
				pos += searchStartPos

				// If both the left and right matchers match, then we can stop searching because
				// we've found a match.
				if m.left.Matches(s[:pos]) && m.right.Matches(s[pos+len(substr):]) {
					return true
				}

				// Continue searching for another occurrence of the substring inside the text.
				searchStartPos = pos + 1
			}
		case m.left != nil:
			// If we have to check for characters on the left then we need to match a suffix.
			if strings.HasSuffix(s, substr) && m.left.Matches(s[:len(s)-len(substr)]) {
				return true
			}
		case m.right != nil:
			if strings.HasPrefix(s, substr) && m.right.Matches(s[len(substr):]) {
				return true
			}
		}
	}
	return false
}

func newLiteralPrefixStringMatcher(prefix string, prefixCaseSensitive bool, right StringMatcher) StringMatcher {
	if prefixCaseSensitive {
		return &literalPrefixSensitiveStringMatcher{
			prefix: prefix,
			right:  right,
		}
	}

	return &literalPrefixInsensitiveStringMatcher{
		prefix: prefix,
		right:  right,
	}
}

// literalPrefixSensitiveStringMatcher matches a string with the given literal case-sensitive prefix and right side matcher.
type literalPrefixSensitiveStringMatcher struct {
	prefix string

	// The matcher that must match the right side. Can be nil.
	right StringMatcher
}

func (m *literalPrefixSensitiveStringMatcher) Matches(s string) bool {
	if !strings.HasPrefix(s, m.prefix) {
		return false
	}

	// Ensure the right side matches.
	return m.right.Matches(s[len(m.prefix):])
}

// literalPrefixInsensitiveStringMatcher matches a string with the given literal case-insensitive prefix and right side matcher.
type literalPrefixInsensitiveStringMatcher struct {
	prefix string

	// The matcher that must match the right side. Can be nil.
	right StringMatcher
}

func (m *literalPrefixInsensitiveStringMatcher) Matches(s string) bool {
	if !hasPrefixCaseInsensitive(s, m.prefix) {
		return false
	}

	// Ensure the right side matches.
	return m.right.Matches(s[len(m.prefix):])
}

// literalSuffixStringMatcher matches a string with the given literal suffix and left side matcher.
type literalSuffixStringMatcher struct {
	// The matcher that must match the left side. Can be nil.
	left StringMatcher

	suffix              string
	suffixCaseSensitive bool
}

func (m *literalSuffixStringMatcher) Matches(s string) bool {
	// Ensure the suffix matches.
	if m.suffixCaseSensitive && !strings.HasSuffix(s, m.suffix) {
		return false
	}
	if !m.suffixCaseSensitive && !hasSuffixCaseInsensitive(s, m.suffix) {
		return false
	}

	// Ensure the left side matches.
	return m.left.Matches(s[:len(s)-len(m.suffix)])
}

// emptyStringMatcher matches an empty string.
type emptyStringMatcher struct{}

func (m emptyStringMatcher) Matches(s string) bool {
	return len(s) == 0
}

// orStringMatcher matches any of the sub-matchers.
type orStringMatcher []StringMatcher

func (m orStringMatcher) Matches(s string) bool {
	for _, matcher := range m {
		if matcher.Matches(s) {
			return true
		}
	}
	return false
}

// equalStringMatcher matches a string exactly and support case insensitive.
type equalStringMatcher struct {
	s             string
	caseSensitive bool
}

func (m *equalStringMatcher) Matches(s string) bool {
	if m.caseSensitive {
		return m.s == s
	}
	return strings.EqualFold(m.s, s)
}

type multiStringMatcherBuilder interface {
	StringMatcher
	add(s string)
	addPrefix(prefix string, prefixCaseSensitive bool, matcher StringMatcher)
	setMatches() []string
}

func newEqualMultiStringMatcher(caseSensitive bool, estimatedSize, estimatedPrefixes, minPrefixLength int) multiStringMatcherBuilder {
	// If the estimated size is low enough, it's faster to use a slice instead of a map.
	if estimatedSize < minEqualMultiStringMatcherMapThreshold && estimatedPrefixes == 0 {
		return &equalMultiStringSliceMatcher{caseSensitive: caseSensitive, values: make([]string, 0, estimatedSize)}
	}

	return &equalMultiStringMapMatcher{
		values:        make(map[string]struct{}, estimatedSize),
		prefixes:      make(map[string][]StringMatcher, estimatedPrefixes),
		minPrefixLen:  minPrefixLength,
		caseSensitive: caseSensitive,
	}
}

// equalMultiStringSliceMatcher matches a string exactly against a slice of valid values.
type equalMultiStringSliceMatcher struct {
	values []string

	caseSensitive bool
}

func (m *equalMultiStringSliceMatcher) add(s string) {
	m.values = append(m.values, s)
}

func (m *equalMultiStringSliceMatcher) addPrefix(_ string, _ bool, _ StringMatcher) {
	panic("not implemented")
}

func (m *equalMultiStringSliceMatcher) setMatches() []string {
	return m.values
}

func (m *equalMultiStringSliceMatcher) Matches(s string) bool {
	if m.caseSensitive {
		for _, v := range m.values {
			if s == v {
				return true
			}
		}
	} else {
		for _, v := range m.values {
			if strings.EqualFold(s, v) {
				return true
			}
		}
	}
	return false
}

// equalMultiStringMapMatcher matches a string exactly against a map of valid values
// or against a set of prefix matchers.
type equalMultiStringMapMatcher struct {
	// values contains values to match a string against. If the matching is case insensitive,
	// the values here must be lowercase.
	values map[string]struct{}
	// prefixes maps strings, all of length minPrefixLen, to sets of matchers to check the rest of the string.
	// If the matching is case insensitive, prefixes are all lowercase.
	prefixes map[string][]StringMatcher
	// minPrefixLen can be zero, meaning there are no prefix matchers.
	minPrefixLen  int
	caseSensitive bool
}

func (m *equalMultiStringMapMatcher) add(s string) {
	if !m.caseSensitive {
		s = toNormalisedLower(s, nil) // Don't pass a stack buffer here - it will always escape to heap.
	}

	m.values[s] = struct{}{}
}

func (m *equalMultiStringMapMatcher) addPrefix(prefix string, prefixCaseSensitive bool, matcher StringMatcher) {
	if m.minPrefixLen == 0 {
		panic("addPrefix called when no prefix length defined")
	}
	if len(prefix) < m.minPrefixLen {
		panic("addPrefix called with a too short prefix")
	}
	if m.caseSensitive != prefixCaseSensitive {
		panic("addPrefix called with a prefix whose case sensitivity is different than the expected one")
	}

	s := prefix[:m.minPrefixLen]
	if !m.caseSensitive {
		s = strings.ToLower(s)
	}

	m.prefixes[s] = append(m.prefixes[s], matcher)
}

func (m *equalMultiStringMapMatcher) setMatches() []string {
	if len(m.values) >= maxSetMatches || len(m.prefixes) > 0 {
		return nil
	}

	matches := make([]string, 0, len(m.values))
	for s := range m.values {
		matches = append(matches, s)
	}
	return matches
}

func (m *equalMultiStringMapMatcher) Matches(s string) bool {
	if len(m.values) > 0 {
		sNorm := s
		var a [32]byte
		if !m.caseSensitive {
			sNorm = toNormalisedLower(s, a[:])
		}
		if _, ok := m.values[sNorm]; ok {
			return true
		}
	}

	if m.minPrefixLen > 0 && len(s) >= m.minPrefixLen {
		prefix := s[:m.minPrefixLen]
		var a [32]byte
		if !m.caseSensitive {
			prefix = toNormalisedLower(s[:m.minPrefixLen], a[:])
		}
		for _, matcher := range m.prefixes[prefix] {
			if matcher.Matches(s) {
				return true
			}
		}
	}
	return false
}

// toNormalisedLower normalise the input string using "Unicode Normalization Form D" and then convert
// it to lower case.
func toNormalisedLower(s string, a []byte) string {
	for i := 0; i < len(s); i++ {
		c := s[i]
		if c >= utf8.RuneSelf {
			return strings.Map(unicode.ToLower, norm.NFKD.String(s))
		}
		if 'A' <= c && c <= 'Z' {
			return toNormalisedLowerSlow(s, i, a)
		}
	}
	return s
}

// toNormalisedLowerSlow is split from toNormalisedLower because having a call
// to `copy` slows it down even when it is not called.
func toNormalisedLowerSlow(s string, i int, a []byte) string {
	var buf []byte
	if cap(a) > len(s) {
		buf = a[:len(s)]
		copy(buf, s)
	} else {
		buf = []byte(s)
	}
	for ; i < len(s); i++ {
		c := s[i]
		if c >= utf8.RuneSelf {
			return strings.Map(unicode.ToLower, norm.NFKD.String(s))
		}
		if 'A' <= c && c <= 'Z' {
			buf[i] = c + 'a' - 'A'
		}
	}
	return yoloString(buf)
}

// anyStringWithoutNewlineMatcher is a stringMatcher which matches any string
// (including an empty one) as far as it doesn't contain any newline character.
type anyStringWithoutNewlineMatcher struct{}

func (m anyStringWithoutNewlineMatcher) Matches(s string) bool {
	// We need to make sure it doesn't contain a newline. Since the newline is
	// an ASCII character, we can use strings.IndexByte().
	return strings.IndexByte(s, '\n') == -1
}

// anyNonEmptyStringMatcher is a stringMatcher which matches any non-empty string.
type anyNonEmptyStringMatcher struct {
	matchNL bool
}

func (m *anyNonEmptyStringMatcher) Matches(s string) bool {
	if m.matchNL {
		// It's OK if the string contains a newline so we just need to make
		// sure it's non-empty.
		return len(s) > 0
	}

	// We need to make sure it non-empty and doesn't contain a newline.
	// Since the newline is an ASCII character, we can use strings.IndexByte().
	return len(s) > 0 && strings.IndexByte(s, '\n') == -1
}

// zeroOrOneCharacterStringMatcher is a StringMatcher which matches zero or one occurrence
// of any character. The newline character is matches only if matchNL is set to true.
type zeroOrOneCharacterStringMatcher struct {
	matchNL bool
}

func (m *zeroOrOneCharacterStringMatcher) Matches(s string) bool {
	// If there's more than one rune in the string, then it can't match.
	if r, size := utf8.DecodeRuneInString(s); r == utf8.RuneError {
		// Size is 0 for empty strings, 1 for invalid rune.
		// Empty string matches, invalid rune matches if there isn't anything else.
		return size == len(s)
	} else if size < len(s) {
		return false
	}

	// No need to check for the newline if the string is empty or matching a newline is OK.
	if m.matchNL || len(s) == 0 {
		return true
	}

	return s[0] != '\n'
}

// trueMatcher is a stringMatcher which matches any string (always returns true).
type trueMatcher struct{}

func (m trueMatcher) Matches(_ string) bool {
	return true
}

// optimizeEqualOrPrefixStringMatchers optimize a specific case where all matchers are made by an
// alternation (orStringMatcher) of strings checked for equality (equalStringMatcher) or
// with a literal prefix (literalPrefixSensitiveStringMatcher or literalPrefixInsensitiveStringMatcher).
//
// In this specific case, when we have many strings to match against we can use a map instead
// of iterating over the list of strings.
func optimizeEqualOrPrefixStringMatchers(input StringMatcher, threshold int) StringMatcher {
	var (
		caseSensitive    bool
		caseSensitiveSet bool
		numValues        int
		numPrefixes      int
		minPrefixLength  int
	)

	// Analyse the input StringMatcher to count the number of occurrences
	// and ensure all of them have the same case sensitivity.
	analyseEqualMatcherCallback := func(matcher *equalStringMatcher) bool {
		// Ensure we don't have mixed case sensitivity.
		if caseSensitiveSet && caseSensitive != matcher.caseSensitive {
			return false
		} else if !caseSensitiveSet {
			caseSensitive = matcher.caseSensitive
			caseSensitiveSet = true
		}

		numValues++
		return true
	}

	analysePrefixMatcherCallback := func(prefix string, prefixCaseSensitive bool, _ StringMatcher) bool {
		// Ensure we don't have mixed case sensitivity.
		if caseSensitiveSet && caseSensitive != prefixCaseSensitive {
			return false
		} else if !caseSensitiveSet {
			caseSensitive = prefixCaseSensitive
			caseSensitiveSet = true
		}
		if numPrefixes == 0 || len(prefix) < minPrefixLength {
			minPrefixLength = len(prefix)
		}

		numPrefixes++
		return true
	}

	if !findEqualOrPrefixStringMatchers(input, analyseEqualMatcherCallback, analysePrefixMatcherCallback) {
		return input
	}

	// If the number of values and prefixes found is less than the threshold, then we should skip the optimization.
	if (numValues + numPrefixes) < threshold {
		return input
	}

	// Parse again the input StringMatcher to extract all values and storing them.
	// We can skip the case sensitivity check because we've already checked it and
	// if the code reach this point then it means all matchers have the same case sensitivity.
	multiMatcher := newEqualMultiStringMatcher(caseSensitive, numValues, numPrefixes, minPrefixLength)

	// Ignore the return value because we already iterated over the input StringMatcher
	// and it was all good.
	findEqualOrPrefixStringMatchers(input, func(matcher *equalStringMatcher) bool {
		multiMatcher.add(matcher.s)
		return true
	}, func(prefix string, _ bool, matcher StringMatcher) bool {
		multiMatcher.addPrefix(prefix, caseSensitive, matcher)
		return true
	})

	return multiMatcher
}

// findEqualOrPrefixStringMatchers analyze the input StringMatcher and calls the equalMatcherCallback for each
// equalStringMatcher found, and prefixMatcherCallback for each literalPrefixSensitiveStringMatcher and literalPrefixInsensitiveStringMatcher found.
//
// Returns true if and only if the input StringMatcher is *only* composed by an alternation of equalStringMatcher and/or
// literal prefix matcher. Returns false if prefixMatcherCallback is nil and a literal prefix matcher is encountered.
func findEqualOrPrefixStringMatchers(input StringMatcher, equalMatcherCallback func(matcher *equalStringMatcher) bool, prefixMatcherCallback func(prefix string, prefixCaseSensitive bool, matcher StringMatcher) bool) bool {
	orInput, ok := input.(orStringMatcher)
	if !ok {
		return false
	}

	for _, m := range orInput {
		switch casted := m.(type) {
		case orStringMatcher:
			if !findEqualOrPrefixStringMatchers(m, equalMatcherCallback, prefixMatcherCallback) {
				return false
			}

		case *equalStringMatcher:
			if !equalMatcherCallback(casted) {
				return false
			}

		case *literalPrefixSensitiveStringMatcher:
			if prefixMatcherCallback == nil || !prefixMatcherCallback(casted.prefix, true, casted) {
				return false
			}

		case *literalPrefixInsensitiveStringMatcher:
			if prefixMatcherCallback == nil || !prefixMatcherCallback(casted.prefix, false, casted) {
				return false
			}

		default:
			// It's not an equal or prefix string matcher, so we have to stop searching
			// cause this optimization can't be applied.
			return false
		}
	}

	return true
}

func hasPrefixCaseInsensitive(s, prefix string) bool {
	return len(s) >= len(prefix) && strings.EqualFold(s[0:len(prefix)], prefix)
}

func hasSuffixCaseInsensitive(s, suffix string) bool {
	return len(s) >= len(suffix) && strings.EqualFold(s[len(s)-len(suffix):], suffix)
}

func containsInOrder(s string, contains []string) bool {
	// Optimization for the case we only have to look for 1 substring.
	if len(contains) == 1 {
		return strings.Contains(s, contains[0])
	}

	return containsInOrderMulti(s, contains)
}

func containsInOrderMulti(s string, contains []string) bool {
	offset := 0

	for _, substr := range contains {
		at := strings.Index(s[offset:], substr)
		if at == -1 {
			return false
		}

		offset += at + len(substr)
	}

	return true
}
