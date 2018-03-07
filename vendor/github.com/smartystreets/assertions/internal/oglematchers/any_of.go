// Copyright 2011 Aaron Jacobs. All Rights Reserved.
// Author: aaronjjacobs@gmail.com (Aaron Jacobs)
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

package oglematchers

import (
	"errors"
	"fmt"
	"reflect"
	"strings"
)

// AnyOf accepts a set of values S and returns a matcher that follows the
// algorithm below when considering a candidate c:
//
//  1. If there exists a value m in S such that m implements the Matcher
//     interface and m matches c, return true.
//
//  2. Otherwise, if there exists a value v in S such that v does not implement
//     the Matcher interface and the matcher Equals(v) matches c, return true.
//
//  3. Otherwise, if there is a value m in S such that m implements the Matcher
//     interface and m returns a fatal error for c, return that fatal error.
//
//  4. Otherwise, return false.
//
// This is akin to a logical OR operation for matchers, with non-matchers x
// being treated as Equals(x).
func AnyOf(vals ...interface{}) Matcher {
	// Get ahold of a type variable for the Matcher interface.
	var dummy *Matcher
	matcherType := reflect.TypeOf(dummy).Elem()

	// Create a matcher for each value, or use the value itself if it's already a
	// matcher.
	wrapped := make([]Matcher, len(vals))
	for i, v := range vals {
		t := reflect.TypeOf(v)
		if t != nil && t.Implements(matcherType) {
			wrapped[i] = v.(Matcher)
		} else {
			wrapped[i] = Equals(v)
		}
	}

	return &anyOfMatcher{wrapped}
}

type anyOfMatcher struct {
	wrapped []Matcher
}

func (m *anyOfMatcher) Description() string {
	wrappedDescs := make([]string, len(m.wrapped))
	for i, matcher := range m.wrapped {
		wrappedDescs[i] = matcher.Description()
	}

	return fmt.Sprintf("or(%s)", strings.Join(wrappedDescs, ", "))
}

func (m *anyOfMatcher) Matches(c interface{}) (err error) {
	err = errors.New("")

	// Try each matcher in turn.
	for _, matcher := range m.wrapped {
		wrappedErr := matcher.Matches(c)

		// Return immediately if there's a match.
		if wrappedErr == nil {
			err = nil
			return
		}

		// Note the fatal error, if any.
		if _, isFatal := wrappedErr.(*FatalError); isFatal {
			err = wrappedErr
		}
	}

	return
}
