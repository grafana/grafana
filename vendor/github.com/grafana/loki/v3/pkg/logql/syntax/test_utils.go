package syntax

import (
	"testing"

	"github.com/prometheus/prometheus/model/labels"
	"github.com/stretchr/testify/require"

	"github.com/grafana/loki/v3/pkg/logql/log"
)

// AssertExpressions function removes FastRegexMatchers from all Regexp matchers to allow simple objects comparison.
// See removeFastRegexMatcherFromExpr function for the details.
func AssertExpressions(t *testing.T, expected, actual Expr) {
	require.Equal(t, removeFastRegexMatcherFromExpr(expected), removeFastRegexMatcherFromExpr(actual))
}

// AssertMatchers function removes FastRegexMatchers from all Regexp matchers to allow simple objects comparison.
func AssertMatchers(t *testing.T, expected, actual []*labels.Matcher) {
	require.Equal(t, RemoveFastRegexMatchers(expected), RemoveFastRegexMatchers(actual))
}

// RemoveFastRegexMatchers iterates over the matchers and recreates the matchers
// without *FastRegexMatcher, because Prometheus labels matcher sets a new instance each time it's created,
// and it prevents simple object assertions.
func RemoveFastRegexMatchers(matchers []*labels.Matcher) []*labels.Matcher {
	result := make([]*labels.Matcher, 0, len(matchers))
	for _, matcher := range matchers {
		if matcher.Type == labels.MatchNotRegexp || matcher.Type == labels.MatchRegexp {
			matcher = &labels.Matcher{Type: matcher.Type, Name: matcher.Name, Value: matcher.Value}
		}
		result = append(result, matcher)
	}
	return result
}

func removeFastRegexMatcherFromExpr(expr Expr) Expr {
	if expr == nil {
		return nil
	}
	expr.Walk(func(e Expr) {
		switch typed := e.(type) {
		case *MatchersExpr:
			typed.Mts = RemoveFastRegexMatchers(typed.Mts)
		case *LabelFilterExpr:
			typed.LabelFilterer = removeFastRegexMatcherFromLabelFilterer(typed.LabelFilterer)
		case *LogRange:
			if typed.Unwrap == nil {
				return
			}
			cleaned := make([]log.LabelFilterer, 0, len(typed.Unwrap.PostFilters))
			for _, filter := range typed.Unwrap.PostFilters {
				cleaned = append(cleaned, removeFastRegexMatcherFromLabelFilterer(filter))
			}
			typed.Unwrap.PostFilters = cleaned
		default:
			return
		}
	})
	return expr
}

func removeFastRegexMatcherFromLabelFilterer(filterer log.LabelFilterer) log.LabelFilterer {
	if filterer == nil {
		return nil
	}
	switch typed := filterer.(type) {
	case *log.LineFilterLabelFilter:
		typed.Matcher = RemoveFastRegexMatchers([]*labels.Matcher{typed.Matcher})[0]
	case *log.BinaryLabelFilter:
		typed.Left = removeFastRegexMatcherFromLabelFilterer(typed.Left)
		typed.Right = removeFastRegexMatcherFromLabelFilterer(typed.Left)
	}
	return filterer
}
