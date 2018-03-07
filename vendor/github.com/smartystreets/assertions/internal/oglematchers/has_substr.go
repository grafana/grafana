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

// HasSubstr returns a matcher that matches strings containing s as a
// substring.
func HasSubstr(s string) Matcher {
	return NewMatcher(
		func(c interface{}) error { return hasSubstr(s, c) },
		fmt.Sprintf("has substring \"%s\"", s))
}

func hasSubstr(needle string, c interface{}) error {
	v := reflect.ValueOf(c)
	if v.Kind() != reflect.String {
		return NewFatalError("which is not a string")
	}

	// Perform the substring search.
	haystack := v.String()
	if strings.Contains(haystack, needle) {
		return nil
	}

	return errors.New("")
}
