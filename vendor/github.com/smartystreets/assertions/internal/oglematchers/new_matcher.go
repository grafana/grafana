// Copyright 2015 Aaron Jacobs. All Rights Reserved.
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

// Create a matcher with the given description and predicate function, which
// will be invoked to handle calls to Matchers.
//
// Using this constructor may be a convenience over defining your own type that
// implements Matcher if you do not need any logic in your Description method.
func NewMatcher(
	predicate func(interface{}) error,
	description string) Matcher {
	return &predicateMatcher{
		predicate:   predicate,
		description: description,
	}
}

type predicateMatcher struct {
	predicate   func(interface{}) error
	description string
}

func (pm *predicateMatcher) Matches(c interface{}) error {
	return pm.predicate(c)
}

func (pm *predicateMatcher) Description() string {
	return pm.description
}
