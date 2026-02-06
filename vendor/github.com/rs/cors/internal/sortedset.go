// adapted from github.com/jub0bs/cors
package internal

import (
	"sort"
	"strings"
)

// A SortedSet represents a mathematical set of strings sorted in
// lexicographical order.
// Each element has a unique position ranging from 0 (inclusive)
// to the set's cardinality (exclusive).
// The zero value represents an empty set.
type SortedSet struct {
	m      map[string]int
	maxLen int
}

// NewSortedSet returns a SortedSet that contains all of elems,
// but no other elements.
func NewSortedSet(elems ...string) SortedSet {
	sort.Strings(elems)
	m := make(map[string]int)
	var maxLen int
	i := 0
	for _, s := range elems {
		if _, exists := m[s]; exists {
			continue
		}
		m[s] = i
		i++
		maxLen = max(maxLen, len(s))
	}
	return SortedSet{
		m:      m,
		maxLen: maxLen,
	}
}

// Size returns the cardinality of set.
func (set SortedSet) Size() int {
	return len(set.m)
}

// String sorts joins the elements of set (in lexicographical order)
// with a comma and returns the resulting string.
func (set SortedSet) String() string {
	elems := make([]string, len(set.m))
	for elem, i := range set.m {
		elems[i] = elem // safe indexing, by construction of SortedSet
	}
	return strings.Join(elems, ",")
}

// Accepts reports whether values is a sequence of list-based field values
// whose elements are
//   - all members of set,
//   - sorted in lexicographical order,
//   - unique.
func (set SortedSet) Accepts(values []string) bool {
	var ( // effectively constant
		maxLen = maxOWSBytes + set.maxLen + maxOWSBytes + 1 // +1 for comma
	)
	var (
		posOfLastNameSeen = -1
		name              string
		commaFound        bool
		emptyElements     int
		ok                bool
	)
	for _, s := range values {
		for {
			// As a defense against maliciously long names in s,
			// we process only a small number of s's leading bytes per iteration.
			name, s, commaFound = cutAtComma(s, maxLen)
			name, ok = trimOWS(name, maxOWSBytes)
			if !ok {
				return false
			}
			if name == "" {
				// RFC 9110 requires recipients to tolerate
				// "a reasonable number of empty list elements"; see
				// https://httpwg.org/specs/rfc9110.html#abnf.extension.recipient.
				emptyElements++
				if emptyElements > maxEmptyElements {
					return false
				}
				if !commaFound { // We have now exhausted the names in s.
					break
				}
				continue
			}
			pos, ok := set.m[name]
			if !ok {
				return false
			}
			// The names in s are expected to be sorted in lexicographical order
			// and to each appear at most once.
			// Therefore, the positions (in set) of the names that
			// appear in s should form a strictly increasing sequence.
			// If that's not actually the case, bail out.
			if pos <= posOfLastNameSeen {
				return false
			}
			posOfLastNameSeen = pos
			if !commaFound { // We have now exhausted the names in s.
				break
			}
		}
	}
	return true
}

const (
	maxOWSBytes      = 1  // number of leading/trailing OWS bytes tolerated
	maxEmptyElements = 16 // number of empty list elements tolerated
)

func cutAtComma(s string, n int) (before, after string, found bool) {
	// Note: this implementation draws inspiration from strings.Cut's.
	end := min(len(s), n)
	if i := strings.IndexByte(s[:end], ','); i >= 0 {
		after = s[i+1:] // deal with this first to save one bounds check
		return s[:i], after, true
	}
	return s, "", false
}

// TrimOWS trims up to n bytes of [optional whitespace (OWS)]
// from the start of and/or the end of s.
// If no more than n bytes of OWS are found at the start of s
// and no more than n bytes of OWS are found at the end of s,
// it returns the trimmed result and true.
// Otherwise, it returns the original string and false.
//
// [optional whitespace (OWS)]: https://httpwg.org/specs/rfc9110.html#whitespace
func trimOWS(s string, n int) (trimmed string, ok bool) {
	if s == "" {
		return s, true
	}
	trimmed, ok = trimRightOWS(s, n)
	if !ok {
		return s, false
	}
	trimmed, ok = trimLeftOWS(trimmed, n)
	if !ok {
		return s, false
	}
	return trimmed, true
}

func trimLeftOWS(s string, n int) (string, bool) {
	sCopy := s
	var i int
	for len(s) > 0 {
		if i > n {
			return sCopy, false
		}
		if !(s[0] == ' ' || s[0] == '\t') {
			break
		}
		s = s[1:]
		i++
	}
	return s, true
}

func trimRightOWS(s string, n int) (string, bool) {
	sCopy := s
	var i int
	for len(s) > 0 {
		if i > n {
			return sCopy, false
		}
		last := len(s) - 1
		if !(s[last] == ' ' || s[last] == '\t') {
			break
		}
		s = s[:last]
		i++
	}
	return s, true
}

// TODO: when updating go directive to 1.21 or later,
// use min builtin instead.
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// TODO: when updating go directive to 1.21 or later,
// use max builtin instead.
func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
