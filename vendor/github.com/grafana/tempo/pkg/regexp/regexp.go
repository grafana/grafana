package regexp

import (
	"fmt"
	"regexp"
	"unsafe"

	"github.com/prometheus/prometheus/model/labels"
)

// in order to prevent building an enormous map on extremely high cardinality fields we institute a max
// this number is not tuned. on extremely high cardinality fields memoization is wasteful b/c we rarely
// see the same value 2x. this is all overhead. on lower cardinality fields with an expensive regex memoization
// is very effective at speeding up queries.
const maxMemoize = 1000

type Regexp struct {
	matchers    []*labels.FastRegexMatcher
	matches     map[string]bool
	shouldMatch bool
}

func NewRegexp(regexps []string, shouldMatch bool) (*Regexp, error) {
	matchers := make([]*labels.FastRegexMatcher, 0, len(regexps))

	for _, r := range regexps {
		m, err := labels.NewFastRegexMatcher(r)
		if err != nil {
			return nil, err
		}
		matchers = append(matchers, m)
	}

	// only memoize if there's a unoptimized matcher
	// TODO: should we limit memoization to N values?
	var matches map[string]bool
	for _, m := range matchers {
		if shouldMemoize(m) {
			matches = make(map[string]bool)
			break
		}
	}

	return &Regexp{
		matchers:    matchers,
		matches:     matches,
		shouldMatch: shouldMatch,
	}, nil
}

func (r *Regexp) Match(b []byte) bool {
	return r.MatchString(unsafe.String(unsafe.SliceData(b), len(b)))
}

func (r *Regexp) MatchString(s string) bool {
	// if we're memoizing check existing matches
	if r.matches != nil {
		if matched, ok := r.matches[s]; ok {
			return matched
		}
	}

	matched := false
	for _, m := range r.matchers {
		if m.MatchString(s) == r.shouldMatch {
			matched = true
			break
		}
	}

	if r.matches != nil && len(r.matches) < maxMemoize {
		r.matches[s] = matched
	}

	return matched
}

func (r *Regexp) Reset() {
	if r.matches != nil {
		clear(r.matches)
	}
}

func (r *Regexp) String() string {
	var strings string
	for _, m := range r.matchers {
		strings += fmt.Sprintf("%s, ", m.GetRegexString())
	}

	return strings
}

// shouldMemoize returns true if we believe that memoizing this regex would be faster
// the evaluating it directly. see thoughts below.
func shouldMemoize(m *labels.FastRegexMatcher) bool {
	// matches labels.FastRegexMatcher
	type cheatToSeeInternals struct {
		reString string
		re       *regexp.Regexp

		setMatches    []string
		stringMatcher labels.StringMatcher
		prefix        string
		suffix        string
		contains      []string

		matchString func(string) bool
	}

	cheat := (*cheatToSeeInternals)(unsafe.Pointer(m))

	// TODO: research and improve this. we're making a guess on whether an optimization will improve the regex
	// performance enough that its faster to not memoize. See compileMatchStringFunction() in the labels
	// package. maybe there's even a way to do this dynamically?
	return cheat.stringMatcher == nil && // a stringMatcher definitively rejects or accepts. if a string matcher is present the regex will never be executed
		len(cheat.setMatches) == 0 && // setMatches definitively reject or accept. if len != 0 the regex will never be executed, but perhaps if there are a very large # of setMatches we prefer memoizing anyway?
		cheat.prefix == "" && // prefix and suffix _do not_ prevent the regex from executing, but they are quick to evaluate and tend to nicely filter down.
		cheat.suffix == "" // perhaps a length requirement would be an improvement? i.e. require a prefix or suffix of at least 3 chars?
	// len(cheat.contains) == 0 // in testing, it was faster to memoize with a contains filter. perhaps if the filters are long enough we don't memoize?
}
