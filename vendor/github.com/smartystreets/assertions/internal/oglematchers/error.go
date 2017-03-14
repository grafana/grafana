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

// Error returns a matcher that matches non-nil values implementing the
// built-in error interface for whom the return value of Error() matches the
// supplied matcher.
//
// For example:
//
//     err := errors.New("taco burrito")
//
//     Error(Equals("taco burrito"))  // matches err
//     Error(HasSubstr("taco"))       // matches err
//     Error(HasSubstr("enchilada"))  // doesn't match err
//
func Error(m Matcher) Matcher {
	return &errorMatcher{m}
}

type errorMatcher struct {
	wrappedMatcher Matcher
}

func (m *errorMatcher) Description() string {
	return "error " + m.wrappedMatcher.Description()
}

func (m *errorMatcher) Matches(c interface{}) error {
	// Make sure that c is an error.
	e, ok := c.(error)
	if !ok {
		return NewFatalError("which is not an error")
	}

	// Pass on the error text to the wrapped matcher.
	return m.wrappedMatcher.Matches(e.Error())
}
