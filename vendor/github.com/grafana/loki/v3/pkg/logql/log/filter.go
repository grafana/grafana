package log

import (
	"bytes"
	"fmt"
	"unicode"
	"unicode/utf8"

	"github.com/grafana/regexp"
	"github.com/grafana/regexp/syntax"

	"github.com/prometheus/prometheus/model/labels"

	"github.com/grafana/loki/v3/pkg/logql/log/pattern"
	"github.com/grafana/loki/v3/pkg/util"
)

// LineMatchType is an enum for line matching types.
type LineMatchType int

// Possible LineMatchTypes.
const (
	LineMatchEqual LineMatchType = iota
	LineMatchNotEqual
	LineMatchRegexp
	LineMatchNotRegexp
	LineMatchPattern
	LineMatchNotPattern
)

func (t LineMatchType) String() string {
	switch t {
	case LineMatchEqual:
		return "|="
	case LineMatchNotEqual:
		return "!="
	case LineMatchRegexp:
		return "|~"
	case LineMatchNotRegexp:
		return "!~"
	case LineMatchPattern:
		return "|>"
	case LineMatchNotPattern:
		return "!>"
	default:
		return ""
	}
}

// Checker is an interface that matches against the input line or regexp.
type Checker interface {
	Test(line []byte, caseInsensitive bool, equal bool) bool
	TestRegex(reg *regexp.Regexp) bool
}

// Matcher is a interface to match log lines against a Checker.
// This works in the opposite direction of Filterer. Whereas Filterer.Filter
// checks if an input log line satisfies the filter, Matcher.Matches checks if
// a filter satisfies an input log line (or regexp).
type Matcher interface {
	Matches(test Checker) bool
}

// Filterer is a interface to filter log lines.
type Filterer interface {
	Filter(line []byte) bool
	ToStage() Stage
}

type MatcherFilterer interface {
	Matcher
	Filterer
}

type wrapper struct {
	Filterer
	Matcher
}

func (w wrapper) IsMatcher() bool {
	return w.Matcher != nil
}

func (w wrapper) IsFilterer() bool {
	return w.Filterer != nil
}

func WrapFilterer(f Filterer) MatcherFilterer {
	return wrapper{Filterer: f}
}

func WrapMatcher(m Matcher) MatcherFilterer {
	return wrapper{Matcher: m}
}

// LineFilterFunc is a syntax sugar for creating line filter from a function
type FiltererFunc func(line []byte) bool

func (f FiltererFunc) Filter(line []byte) bool {
	return f(line)
}

type trueFilter struct{}

func (trueFilter) Filter(_ []byte) bool { return true }
func (trueFilter) ToStage() Stage       { return NoopStage }

// Matches implements Matcher
func (trueFilter) Matches(_ Checker) bool { return true }

// TrueFilter is a filter that returns and matches all log lines whatever their content.
var TrueFilter = trueFilter{}

func isTrueFilter(f MatcherFilterer) bool {
	if f == TrueFilter {
		return true
	}

	if _, ok := f.(trueFilter); ok {
		return true
	}

	if wrap, ok := f.(wrapper); ok {
		if wrap.IsFilterer() {
			if _, ok = wrap.Filterer.(trueFilter); ok {
				return true
			}
		}
		// Otherwise, it's a matcher
		if _, ok = wrap.Matcher.(trueFilter); ok {
			return true
		}
	}

	return false
}

type existsFilter struct{}

func (e existsFilter) Filter(line []byte) bool {
	return len(line) > 0
}

func (e existsFilter) ToStage() Stage {
	return StageFunc{
		process: func(_ int64, line []byte, _ *LabelsBuilder) ([]byte, bool) {
			return line, e.Filter(line)
		},
	}
}

// Matches implements Matcher
func (e existsFilter) Matches(_ Checker) bool { return true }

// ExistsFilter is a filter that returns and matches when a line has any characters.
var ExistsFilter = existsFilter{}

type notFilter struct {
	MatcherFilterer
}

func (n notFilter) Filter(line []byte) bool {
	return !n.MatcherFilterer.Filter(line)
}

func (n notFilter) ToStage() Stage {
	return StageFunc{
		process: func(_ int64, line []byte, _ *LabelsBuilder) ([]byte, bool) {
			return line, n.Filter(line)
		},
	}
}

func (n notFilter) Matches(test Checker) bool {
	return !n.MatcherFilterer.Matches(test)
}

// NewNotFilter creates a new filter which matches only if the base filter doesn't match.
// If the base filter is a `or` it will recursively simplify with `and` operations.
func NewNotFilter(base MatcherFilterer) MatcherFilterer {
	// not(a|b) = not(a) and not(b) , and operation can't benefit from this optimization because both legs always needs to be executed.
	if or, ok := base.(orFilter); ok {
		return NewAndFilter(NewNotFilter(or.left), NewNotFilter(or.right))
	}
	return notFilter{MatcherFilterer: base}
}

type andFilter struct {
	left  MatcherFilterer
	right MatcherFilterer
}

// NewAndFilter creates a new filter which matches only if left and right matches.
func NewAndFilter(left MatcherFilterer, right MatcherFilterer) MatcherFilterer {
	// Make sure we take care of panics in case a nil or noop filter is passed.
	if right == nil || isTrueFilter(right) {
		return left
	}

	if left == nil || isTrueFilter(left) {
		return right
	}

	return andFilter{
		left:  left,
		right: right,
	}
}

func (a andFilter) Filter(line []byte) bool {
	return a.left.Filter(line) && a.right.Filter(line)
}

func (a andFilter) ToStage() Stage {
	return StageFunc{
		process: func(_ int64, line []byte, _ *LabelsBuilder) ([]byte, bool) {
			return line, a.Filter(line)
		},
	}
}

func (a andFilter) Matches(test Checker) bool {
	return a.left.Matches(test) && a.right.Matches(test)
}

type andFilters struct {
	filters []Filterer
}

// NewAndFilters creates a new filter which matches only if all filters match
func NewAndFilters(filters []Filterer) Filterer {
	var containsFilterAcc *containsAllFilter
	regexpFilters := make([]Filterer, 0)
	n := 0
	for _, filter := range filters {
		// Make sure we take care of panics in case a nil or noop filter is passed.
		if !(filter == nil || isTrueFilter(WrapFilterer(filter))) {
			switch c := filter.(type) {
			case *containsFilter:
				// Start accumulating contains filters.
				if containsFilterAcc == nil {
					containsFilterAcc = &containsAllFilter{}
				}

				// Join all contain filters.
				containsFilterAcc.Add(*c)
			case regexpFilter:
				regexpFilters = append(regexpFilters, c)

			default:
				// Finish accumulating contains filters.
				if containsFilterAcc != nil {
					filters[n] = containsFilterAcc
					n++
					containsFilterAcc = nil
				}

				// Keep filter
				filters[n] = filter
				n++
			}
		}
	}
	filters = filters[:n]

	if containsFilterAcc != nil {
		filters = append(filters, containsFilterAcc)
	}

	// Push regex filters to end
	if len(regexpFilters) > 0 {
		filters = append(filters, regexpFilters...)
	}

	if len(filters) == 0 {
		return TrueFilter
	} else if len(filters) == 1 {
		return filters[0]
	}

	return andFilters{
		filters: filters,
	}
}

func (a andFilters) Filter(line []byte) bool {
	for _, filter := range a.filters {
		if !filter.Filter(line) {
			return false
		}
	}
	return true
}

func (a andFilters) ToStage() Stage {
	return StageFunc{
		process: func(_ int64, line []byte, _ *LabelsBuilder) ([]byte, bool) {
			return line, a.Filter(line)
		},
	}
}

type orFilter struct {
	left  MatcherFilterer
	right MatcherFilterer
}

// newOrFilter creates a new filter which matches only if left or right matches.
func newOrFilter(left MatcherFilterer, right MatcherFilterer) MatcherFilterer {
	if left == nil || isTrueFilter(left) {
		return right
	}

	if right == nil || isTrueFilter(right) {
		return left
	}

	return orFilter{
		left:  left,
		right: right,
	}
}

// ChainOrMatcherFilterer is a syntax sugar to chain multiple `or` filters. (1 or many)
func ChainOrMatcherFilterer(curr, new MatcherFilterer) MatcherFilterer {
	if curr == nil {
		return new
	}
	return newOrFilter(curr, new)
}

// ChainOrFilter is a syntax sugar to chain multiple `or` filters. (1 or many)
func ChainOrFilter(curr, new Filterer) Filterer {
	return ChainOrMatcherFilterer(WrapFilterer(curr), WrapFilterer(new))
}

func (a orFilter) Filter(line []byte) bool {
	return a.left.Filter(line) || a.right.Filter(line)
}

func (a orFilter) ToStage() Stage {
	return StageFunc{
		process: func(_ int64, line []byte, _ *LabelsBuilder) ([]byte, bool) {
			return line, a.Filter(line)
		},
	}
}

// Matches implements Matcher
func (a orFilter) Matches(test Checker) bool {
	return a.left.Matches(test) || a.right.Matches(test)
}

type regexpFilter struct {
	*regexp.Regexp

	orig string
}

// newRegexpFilter creates a new line filter for a given regexp.
// If match is false the filter is the negation of the regexp.
func newRegexpFilter(re string, orig string, match bool) (MatcherFilterer, error) {
	reg, err := regexp.Compile(re)
	if err != nil {
		return nil, err
	}
	f := regexpFilter{Regexp: reg, orig: orig}
	if match {
		return f, nil
	}
	return NewNotFilter(f), nil
}

func (r regexpFilter) Filter(line []byte) bool {
	return r.Match(line)
}

func (r regexpFilter) ToStage() Stage {
	return StageFunc{
		process: func(_ int64, line []byte, _ *LabelsBuilder) ([]byte, bool) {
			return line, r.Filter(line)
		},
	}
}

func (r regexpFilter) Matches(test Checker) bool {
	return test.TestRegex(r.Regexp)
}

func (r regexpFilter) String() string {
	return r.orig
}

type equalFilter struct {
	match           []byte
	caseInsensitive bool
}

func (l equalFilter) Filter(line []byte) bool {
	if len(l.match) != len(line) {
		return false
	}

	return contains(line, l.match, l.caseInsensitive)
}

func (l equalFilter) ToStage() Stage {
	return StageFunc{
		process: func(_ int64, line []byte, _ *LabelsBuilder) ([]byte, bool) {
			return line, l.Filter(line)
		},
	}
}

func (l equalFilter) Matches(test Checker) bool {
	return test.Test(l.match, l.caseInsensitive, true)
}

func (l equalFilter) String() string {
	return string(l.match)
}

func newEqualFilter(match []byte, caseInsensitive bool) MatcherFilterer {
	return equalFilter{match, caseInsensitive}
}

type containsFilter struct {
	match           []byte
	caseInsensitive bool
}

func (l *containsFilter) Filter(line []byte) bool {
	return contains(line, l.match, l.caseInsensitive)
}

func contains(line, substr []byte, caseInsensitive bool) bool {
	if !caseInsensitive {
		return bytes.Contains(line, substr)
	}
	return containsLower(line, substr)
}

func containsLower(line, substr []byte) bool {
	if len(substr) == 0 {
		return true
	}
	if len(substr) > len(line) {
		return false
	}
	j := 0
	for len(line) > 0 {
		// ascii fast case
		if c := line[0]; c < utf8.RuneSelf && substr[j] < utf8.RuneSelf {
			if c == substr[j] || c+'a'-'A' == substr[j] || c == substr[j]+'a'-'A' {
				j++
				if j == len(substr) {
					return true
				}
				line = line[1:]
				continue
			}
			line = line[1:]
			j = 0
			continue
		}
		// unicode slow case
		lr, lwid := utf8.DecodeRune(line)
		mr, mwid := utf8.DecodeRune(substr[j:])
		if lr == mr || mr == unicode.To(unicode.LowerCase, lr) {
			j += mwid
			if j == len(substr) {
				return true
			}
			line = line[lwid:]
			continue
		}
		line = line[lwid:]
		j = 0
	}
	return false
}

func (l containsFilter) ToStage() Stage {
	return StageFunc{
		process: func(_ int64, line []byte, _ *LabelsBuilder) ([]byte, bool) {
			return line, l.Filter(line)
		},
	}
}

// Matches implements Matcher
func (l containsFilter) Matches(test Checker) bool {
	return test.Test(l.match, l.caseInsensitive, false)
}

func (l containsFilter) String() string {
	return string(l.match)
}

// newContainsFilter creates a contains filter that checks if a log line contains a match.
func newContainsFilter(match []byte, caseInsensitive bool) MatcherFilterer {
	if len(match) == 0 {
		return TrueFilter
	}
	if caseInsensitive {
		match = bytes.ToLower(match)
	}
	return &containsFilter{
		match:           match,
		caseInsensitive: caseInsensitive,
	}
}

type containsAllFilter struct {
	matches []containsFilter
}

func (f *containsAllFilter) Add(filter containsFilter) {
	f.matches = append(f.matches, filter)
}

func (f *containsAllFilter) Empty() bool {
	return len(f.matches) == 0
}

func (f containsAllFilter) Filter(line []byte) bool {
	for _, m := range f.matches {
		if !contains(line, m.match, m.caseInsensitive) {
			return false
		}
	}
	return true
}

func (f containsAllFilter) ToStage() Stage {
	return StageFunc{
		process: func(_ int64, line []byte, _ *LabelsBuilder) ([]byte, bool) {
			return line, f.Filter(line)
		},
	}
}

func (f containsAllFilter) Matches(test Checker) bool {
	for _, m := range f.matches {
		if !test.Test(m.match, m.caseInsensitive, false) {
			return false
		}
	}
	return true
}

// NewFilter creates a new line filter from a match string and type.
func NewFilter(match string, mt LineMatchType) (Filterer, error) {
	switch mt {
	case LineMatchRegexp:
		return parseRegexpFilter(match, true, false)
	case LineMatchNotRegexp:
		return parseRegexpFilter(match, false, false)
	case LineMatchEqual:
		return newContainsFilter([]byte(match), false), nil
	case LineMatchNotEqual:
		return NewNotFilter(newContainsFilter([]byte(match), false)), nil
	case LineMatchPattern:
		return newPatternFilterer([]byte(match), true)
	case LineMatchNotPattern:
		return newPatternFilterer([]byte(match), false)
	default:
		return nil, fmt.Errorf("unknown matcher: %v", match)
	}
}

// NewLabelFilter creates a new filter that has label regex semantics
func NewLabelFilter(match string, mt labels.MatchType) (Filterer, error) {
	switch mt {
	case labels.MatchRegexp:
		return parseRegexpFilter(match, true, true)
	case labels.MatchNotRegexp:
		return parseRegexpFilter(match, false, true)
	case labels.MatchEqual:
		return newEqualFilter([]byte(match), false), nil
	case labels.MatchNotEqual:
		return NewNotFilter(newEqualFilter([]byte(match), false)), nil
	default:
		return nil, fmt.Errorf("unknown matcher: %v", match)
	}
}

// parseRegexpFilter parses a regexp and attempt to simplify it with only literal filters.
// If not possible it will returns the original regexp filter.
func parseRegexpFilter(re string, match bool, isLabel bool) (MatcherFilterer, error) {
	reg, err := syntax.Parse(re, syntax.Perl)
	if err != nil {
		return nil, err
	}
	reg = reg.Simplify()

	// attempt to improve regex with tricks
	filter, ok := defaultRegexSimplifier.Simplify(reg, isLabel)
	if !ok {
		util.AllNonGreedy(reg)
		regex := reg.String()
		if isLabel {
			// label regexes are anchored to
			// the beginning and ending of lines
			regex = "^(?:" + regex + ")$"
		}
		return newRegexpFilter(regex, re, match)
	}

	if match {
		return filter, nil
	}
	return NewNotFilter(filter), nil
}

type Simplifier interface {
	Simplify(reg *syntax.Regexp, isLabel bool) (Filterer, bool)
}

type NewMatcherFiltererFunc func(match []byte, caseInsensitive bool) MatcherFilterer

type RegexSimplifier struct {
	newContainsFilter NewMatcherFiltererFunc
	newEqualFilter    NewMatcherFiltererFunc
}

var defaultRegexSimplifier = NewRegexSimplifier(newContainsFilter, newEqualFilter)

func NewRegexSimplifier(
	newContainsFilter NewMatcherFiltererFunc,
	newEqualFilter NewMatcherFiltererFunc,
) *RegexSimplifier {
	return &RegexSimplifier{
		newContainsFilter: newContainsFilter,
		newEqualFilter:    newEqualFilter,
	}
}

// Simplify a regexp expression by replacing it, when possible, with a succession of literal filters.
// For example `(foo|bar)` will be replaced by  `containsFilter(foo) or containsFilter(bar)`
func (s *RegexSimplifier) Simplify(reg *syntax.Regexp, isLabel bool) (MatcherFilterer, bool) {
	switch reg.Op {
	case syntax.OpAlternate:
		return s.simplifyAlternate(reg, isLabel)
	case syntax.OpConcat:
		return s.simplifyConcat(reg, nil)
	case syntax.OpCapture:
		util.ClearCapture(reg)
		return s.Simplify(reg, isLabel)
	case syntax.OpLiteral:
		if isLabel {
			return s.newEqualFilter([]byte(string(reg.Rune)), util.IsCaseInsensitive(reg)), true
		}
		return s.newContainsFilter([]byte(string(reg.Rune)), util.IsCaseInsensitive(reg)), true
	case syntax.OpStar:
		if reg.Sub[0].Op == syntax.OpAnyCharNotNL {
			return TrueFilter, true
		}
	case syntax.OpPlus:
		if len(reg.Sub) == 1 && reg.Sub[0].Op == syntax.OpAnyCharNotNL { // simplify ".+"
			return ExistsFilter, true
		}
	case syntax.OpEmptyMatch:
		return TrueFilter, true
	}
	return nil, false
}

// simplifyAlternate simplifies, when possible, alternate regexp expressions such as:
// (foo|bar) or (foo|(bar|buzz)).
func (s *RegexSimplifier) simplifyAlternate(reg *syntax.Regexp, isLabel bool) (MatcherFilterer, bool) {
	util.ClearCapture(reg.Sub...)
	// attempt to simplify the first leg
	f, ok := s.Simplify(reg.Sub[0], isLabel)
	if !ok {
		return nil, false
	}
	// merge the rest of the legs
	for i := 1; i < len(reg.Sub); i++ {
		f2, ok := s.Simplify(reg.Sub[i], isLabel)
		if !ok {
			return nil, false
		}
		f = newOrFilter(f, f2)
	}
	return f, true
}

// simplifyConcat attempt to simplify concat operations.
// Concat operations are either literal and star such as foo.* .*foo.* .*foo
// which is a literalFilter.
// Or a literal and alternates operation (see simplifyConcatAlternate), which represent a multiplication of alternates.
// Anything else is rejected.
func (s *RegexSimplifier) simplifyConcat(reg *syntax.Regexp, baseLiteral []byte) (MatcherFilterer, bool) {
	util.ClearCapture(reg.Sub...)
	// remove empty match as we don't need them for filtering
	i := 0
	for _, r := range reg.Sub {
		if r.Op == syntax.OpEmptyMatch {
			continue
		}
		reg.Sub[i] = r
		i++
	}
	reg.Sub = reg.Sub[:i]
	// we support only simplication of concat operation with 3 sub expressions.
	// for instance .*foo.*bar contains 4 subs (.*+foo+.*+bar) and can't be simplified.
	if len(reg.Sub) > 3 {
		return nil, false
	}

	var curr MatcherFilterer
	var ok bool
	literals := 0
	var baseLiteralIsCaseInsensitive bool
	for _, sub := range reg.Sub {
		if sub.Op == syntax.OpLiteral {
			// only one literal is allowed.
			if literals != 0 {
				return nil, false
			}
			literals++
			baseLiteral = append(baseLiteral, []byte(string(sub.Rune))...)
			baseLiteralIsCaseInsensitive = util.IsCaseInsensitive(sub)
			continue
		}
		// if we have an alternate we must also have a base literal to apply the concatenation with.
		if sub.Op == syntax.OpAlternate && baseLiteral != nil {
			if curr, ok = s.simplifyConcatAlternate(sub, baseLiteral, curr, baseLiteralIsCaseInsensitive); !ok {
				return nil, false
			}
			continue
		}
		if sub.Op == syntax.OpStar && sub.Sub[0].Op == syntax.OpAnyCharNotNL {
			continue
		}
		return nil, false
	}

	// if we have a filter from concat alternates.
	if curr != nil {
		return curr, true
	}

	// if we have only a concat with literals.
	if baseLiteral != nil {
		return s.newContainsFilter(baseLiteral, baseLiteralIsCaseInsensitive), true
	}

	return nil, false
}

// simplifyConcatAlternate simplifies concat alternate operations.
// A concat alternate is found when a concat operation has a sub alternate and is preceded by a literal.
// For instance bar|b|buzz is expressed as b(ar|(?:)|uzz) => b concat alternate(ar,(?:),uzz).
// (?:) being an OpEmptyMatch and b being the literal to concat all alternates (ar,(?:),uzz) with.
func (s *RegexSimplifier) simplifyConcatAlternate(reg *syntax.Regexp, literal []byte, curr MatcherFilterer, baseLiteralIsCaseInsensitive bool) (MatcherFilterer, bool) {
	for _, alt := range reg.Sub {
		// we should not consider the case where baseLiteral is not marked as case insensitive
		// and alternate expression is marked as case insensitive. For example, for the original expression
		// f|f(?i)oo the extracted expression would be "f (?:)|(?i:OO)" i.e. f with empty match
		// and fOO. For fOO, we can't initialize containsFilter with caseInsensitve variable as either true or false
		isAltCaseInsensitive := util.IsCaseInsensitive(alt)
		if !baseLiteralIsCaseInsensitive && isAltCaseInsensitive {
			return nil, false
		}
		switch alt.Op {
		case syntax.OpEmptyMatch:
			curr = ChainOrMatcherFilterer(curr, s.newContainsFilter(literal, baseLiteralIsCaseInsensitive))
		case syntax.OpLiteral:
			// concat the root literal with the alternate one.
			altBytes := []byte(string(alt.Rune))
			altLiteral := make([]byte, 0, len(literal)+len(altBytes))
			altLiteral = append(altLiteral, literal...)
			altLiteral = append(altLiteral, altBytes...)
			curr = ChainOrMatcherFilterer(curr, s.newContainsFilter(altLiteral, baseLiteralIsCaseInsensitive))
		case syntax.OpConcat:
			f, ok := s.simplifyConcat(alt, literal)
			if !ok {
				return nil, false
			}
			curr = ChainOrMatcherFilterer(curr, f)
		case syntax.OpStar:
			if alt.Sub[0].Op != syntax.OpAnyCharNotNL {
				return nil, false
			}
			curr = ChainOrMatcherFilterer(curr, s.newContainsFilter(literal, baseLiteralIsCaseInsensitive))
		default:
			return nil, false
		}
	}
	if curr != nil {
		return curr, true
	}
	return nil, false
}

type patternFilter struct {
	matcher *pattern.Matcher
	pattern []byte
}

func newPatternFilterer(p []byte, match bool) (MatcherFilterer, error) {
	m, err := pattern.ParseLineFilter(p)
	if err != nil {
		return nil, err
	}
	filter := &patternFilter{
		matcher: m,
		pattern: p,
	}
	if !match {
		return NewNotFilter(filter), nil
	}
	return filter, nil
}

func (f *patternFilter) Filter(line []byte) bool { return f.matcher.Test(line) }

func (f *patternFilter) Matches(test Checker) bool {
	return test.Test(f.pattern, false, false)
}

func (f *patternFilter) ToStage() Stage {
	return StageFunc{
		process: func(_ int64, line []byte, _ *LabelsBuilder) ([]byte, bool) {
			return line, f.Filter(line)
		},
	}
}
