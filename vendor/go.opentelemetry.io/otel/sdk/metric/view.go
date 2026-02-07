// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

package metric // import "go.opentelemetry.io/otel/sdk/metric"

import (
	"errors"
	"regexp"
	"strings"

	"go.opentelemetry.io/otel/internal/global"
)

var (
	errMultiInst = errors.New("name replacement for multiple instruments")
	errEmptyView = errors.New("no criteria provided for view")

	emptyView = func(Instrument) (Stream, bool) { return Stream{}, false }
)

// View is an override to the default behavior of the SDK. It defines how data
// should be collected for certain instruments. It returns true and the exact
// Stream to use for matching Instruments. Otherwise, if the view does not
// match, false is returned.
type View func(Instrument) (Stream, bool)

// NewView returns a View that applies the Stream mask for all instruments that
// match criteria. The returned View will only apply mask if all non-zero-value
// fields of criteria match the corresponding Instrument passed to the view. If
// no criteria are provided, all field of criteria are their zero-values, a
// view that matches no instruments is returned. If you need to match a
// zero-value field, create a View directly.
//
// The Name field of criteria supports wildcard pattern matching. The "*"
// wildcard is recognized as matching zero or more characters, and "?" is
// recognized as matching exactly one character. For example, a pattern of "*"
// matches all instrument names.
//
// The Stream mask only applies updates for non-zero-value fields. By default,
// the Instrument the View matches against will be use for the Name,
// Description, and Unit of the returned Stream and no Aggregation or
// AttributeFilter are set. All non-zero-value fields of mask are used instead
// of the default. If you need to zero out an Stream field returned from a
// View, create a View directly.
func NewView(criteria Instrument, mask Stream) View {
	if criteria.IsEmpty() {
		global.Error(
			errEmptyView, "dropping view",
			"mask", mask,
		)
		return emptyView
	}

	var matchFunc func(Instrument) bool
	if strings.ContainsAny(criteria.Name, "*?") {
		if mask.Name != "" {
			global.Error(
				errMultiInst, "dropping view",
				"criteria", criteria,
				"mask", mask,
			)
			return emptyView
		}

		// Handle branching here in NewView instead of criteria.matches so
		// criteria.matches remains inlinable for the simple case.
		pattern := regexp.QuoteMeta(criteria.Name)
		pattern = "^" + pattern + "$"
		pattern = strings.ReplaceAll(pattern, `\?`, ".")
		pattern = strings.ReplaceAll(pattern, `\*`, ".*")
		re := regexp.MustCompile(pattern)
		matchFunc = func(i Instrument) bool {
			return re.MatchString(i.Name) &&
				criteria.matchesDescription(i) &&
				criteria.matchesKind(i) &&
				criteria.matchesUnit(i) &&
				criteria.matchesScope(i)
		}
	} else {
		matchFunc = criteria.matches
	}

	var agg Aggregation
	if mask.Aggregation != nil {
		agg = mask.Aggregation.copy()
		if err := agg.err(); err != nil {
			global.Error(
				err, "not using aggregation with view",
				"criteria", criteria,
				"mask", mask,
			)
			agg = nil
		}
	}

	return func(i Instrument) (Stream, bool) {
		if matchFunc(i) {
			return Stream{
				Name:                              nonZero(mask.Name, i.Name),
				Description:                       nonZero(mask.Description, i.Description),
				Unit:                              nonZero(mask.Unit, i.Unit),
				Aggregation:                       agg,
				AttributeFilter:                   mask.AttributeFilter,
				ExemplarReservoirProviderSelector: mask.ExemplarReservoirProviderSelector,
			}, true
		}
		return Stream{}, false
	}
}

// nonZero returns v if it is non-zero-valued, otherwise alt.
func nonZero[T comparable](v, alt T) T {
	var zero T
	if v != zero {
		return v
	}
	return alt
}
