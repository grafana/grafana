// Copyright 2012 Aaron Jacobs. All Rights Reserved.
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
	"fmt"
	"reflect"
)

// Return a matcher that matches arrays slices with at least one element that
// matches the supplied argument. If the argument x is not itself a Matcher,
// this is equivalent to Contains(Equals(x)).
func Contains(x interface{}) Matcher {
	var result containsMatcher
	var ok bool

	if result.elementMatcher, ok = x.(Matcher); !ok {
		result.elementMatcher = DeepEquals(x)
	}

	return &result
}

type containsMatcher struct {
	elementMatcher Matcher
}

func (m *containsMatcher) Description() string {
	return fmt.Sprintf("contains: %s", m.elementMatcher.Description())
}

func (m *containsMatcher) Matches(candidate interface{}) error {
	// The candidate must be a slice or an array.
	v := reflect.ValueOf(candidate)
	if v.Kind() != reflect.Slice && v.Kind() != reflect.Array {
		return NewFatalError("which is not a slice or array")
	}

	// Check each element.
	for i := 0; i < v.Len(); i++ {
		elem := v.Index(i)
		if matchErr := m.elementMatcher.Matches(elem.Interface()); matchErr == nil {
			return nil
		}
	}

	return fmt.Errorf("")
}
