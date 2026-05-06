/*
 *
 * Copyright 2021 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

// Package matcher contains types that need to be shared between code under
// google.golang.org/grpc/xds/... and the rest of gRPC.
package matcher

import (
	"errors"
	"fmt"
	"regexp"
	"strings"

	v3matcherpb "github.com/envoyproxy/go-control-plane/envoy/type/matcher/v3"
	"google.golang.org/grpc/internal/grpcutil"
)

// StringMatcher contains match criteria for matching a string, and is an
// internal representation of the `StringMatcher` proto defined at
// https://github.com/envoyproxy/envoy/blob/main/api/envoy/type/matcher/v3/string.proto.
type StringMatcher struct {
	// Since these match fields are part of a `oneof` in the corresponding xDS
	// proto, only one of them is expected to be set.
	exactMatch    *string
	prefixMatch   *string
	suffixMatch   *string
	regexMatch    *regexp.Regexp
	containsMatch *string
	// If true, indicates the exact/prefix/suffix/contains matching should be
	// case insensitive. This has no effect on the regex match.
	ignoreCase bool
}

// Match returns true if input matches the criteria in the given StringMatcher.
func (sm StringMatcher) Match(input string) bool {
	switch {
	case sm.exactMatch != nil:
		if sm.ignoreCase {
			input = strings.ToLower(input)
		}
		return input == *sm.exactMatch
	case sm.prefixMatch != nil:
		if sm.ignoreCase {
			input = strings.ToLower(input)
		}
		return strings.HasPrefix(input, *sm.prefixMatch)
	case sm.suffixMatch != nil:
		if sm.ignoreCase {
			input = strings.ToLower(input)
		}
		return strings.HasSuffix(input, *sm.suffixMatch)
	case sm.containsMatch != nil:
		if sm.ignoreCase {
			input = strings.ToLower(input)
		}
		return strings.Contains(input, *sm.containsMatch)
	case sm.regexMatch != nil:
		return grpcutil.FullMatchWithRegex(sm.regexMatch, input)
	}
	return false
}

// newStrPtr allocates a new string that holds the value of input and returns a
// pointer to it. ignoreCase controls if a lower case version of input is used.
func newStrPtr(input *string, ignoreCase bool) *string {
	if input == nil {
		return nil
	}

	s := new(string)
	if ignoreCase {
		*s = strings.ToLower(*input)
	} else {
		*s = *input
	}
	return s
}

// StringMatcherFromProto is a helper function to create a StringMatcher from
// the corresponding StringMatcher proto.
//
// Returns a non-nil error if matcherProto is invalid.
func StringMatcherFromProto(matcherProto *v3matcherpb.StringMatcher) (StringMatcher, error) {
	if matcherProto == nil {
		return StringMatcher{}, errors.New("input StringMatcher proto is nil")
	}

	matcher := StringMatcher{ignoreCase: matcherProto.GetIgnoreCase()}
	switch mt := matcherProto.GetMatchPattern().(type) {
	case *v3matcherpb.StringMatcher_Exact:
		matcher.exactMatch = newStrPtr(&mt.Exact, matcher.ignoreCase)
	case *v3matcherpb.StringMatcher_Prefix:
		if matcherProto.GetPrefix() == "" {
			return StringMatcher{}, errors.New("empty prefix is not allowed in StringMatcher")
		}
		matcher.prefixMatch = newStrPtr(&mt.Prefix, matcher.ignoreCase)
	case *v3matcherpb.StringMatcher_Suffix:
		if matcherProto.GetSuffix() == "" {
			return StringMatcher{}, errors.New("empty suffix is not allowed in StringMatcher")
		}
		matcher.suffixMatch = newStrPtr(&mt.Suffix, matcher.ignoreCase)
	case *v3matcherpb.StringMatcher_SafeRegex:
		regex := matcherProto.GetSafeRegex().GetRegex()
		re, err := regexp.Compile(regex)
		if err != nil {
			return StringMatcher{}, fmt.Errorf("safe_regex matcher %q is invalid", regex)
		}
		matcher.regexMatch = re
	case *v3matcherpb.StringMatcher_Contains:
		if matcherProto.GetContains() == "" {
			return StringMatcher{}, errors.New("empty contains is not allowed in StringMatcher")
		}
		matcher.containsMatch = newStrPtr(&mt.Contains, matcher.ignoreCase)
	default:
		return StringMatcher{}, fmt.Errorf("unrecognized string matcher: %+v", matcherProto)
	}
	return matcher, nil
}

// NewExactStringMatcher creates a string matcher that requires the input string
// to exactly match the pattern specified here. The match will be case
// insensitive if ignore_case is true.
func NewExactStringMatcher(pattern string, ignoreCase bool) StringMatcher {
	return StringMatcher{
		exactMatch: newStrPtr(&pattern, ignoreCase),
		ignoreCase: ignoreCase,
	}
}

// NewPrefixStringMatcher creates a string matcher that requires the input
// string to contain the prefix specified here. The match will be case
// insensitive if ignore_case is true.
func NewPrefixStringMatcher(prefix string, ignoreCase bool) StringMatcher {
	return StringMatcher{
		prefixMatch: newStrPtr(&prefix, ignoreCase),
		ignoreCase:  ignoreCase,
	}
}

// NewSuffixStringMatcher creates a string matcher that requires the input
// string to contain the suffix specified here. The match will be case
// insensitive if ignore_case is true.
func NewSuffixStringMatcher(suffix string, ignoreCase bool) StringMatcher {
	return StringMatcher{
		suffixMatch: newStrPtr(&suffix, ignoreCase),
		ignoreCase:  ignoreCase,
	}
}

// NewContainsStringMatcher creates a string matcher that requires the input
// string to contain the pattern specified here. The match will be case
// insensitive if ignore_case is true.
func NewContainsStringMatcher(pattern string, ignoreCase bool) StringMatcher {
	return StringMatcher{
		containsMatch: newStrPtr(&pattern, ignoreCase),
		ignoreCase:    ignoreCase,
	}
}

// NewRegexStringMatcher creates a string matcher that requires the input string
// to match the regular expression specified here.
func NewRegexStringMatcher(regex *regexp.Regexp) StringMatcher {
	return StringMatcher{
		regexMatch: regex,
	}
}

// ExactMatch returns the value of the configured exact match or an empty string
// if exact match criteria was not specified.
func (sm StringMatcher) ExactMatch() string {
	if sm.exactMatch != nil {
		return *sm.exactMatch
	}
	return ""
}

// Equal returns true if other and sm are equivalent to each other.
func (sm StringMatcher) Equal(other StringMatcher) bool {
	if sm.ignoreCase != other.ignoreCase {
		return false
	}

	if (sm.exactMatch != nil) != (other.exactMatch != nil) ||
		(sm.prefixMatch != nil) != (other.prefixMatch != nil) ||
		(sm.suffixMatch != nil) != (other.suffixMatch != nil) ||
		(sm.regexMatch != nil) != (other.regexMatch != nil) ||
		(sm.containsMatch != nil) != (other.containsMatch != nil) {
		return false
	}

	switch {
	case sm.exactMatch != nil:
		return *sm.exactMatch == *other.exactMatch
	case sm.prefixMatch != nil:
		return *sm.prefixMatch == *other.prefixMatch
	case sm.suffixMatch != nil:
		return *sm.suffixMatch == *other.suffixMatch
	case sm.regexMatch != nil:
		return sm.regexMatch.String() == other.regexMatch.String()
	case sm.containsMatch != nil:
		return *sm.containsMatch == *other.containsMatch
	}
	return true
}
