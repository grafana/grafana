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

// transformDescription returns a matcher that is equivalent to the supplied
// one, except that it has the supplied description instead of the one attached
// to the existing matcher.
func transformDescription(m Matcher, newDesc string) Matcher {
	return &transformDescriptionMatcher{newDesc, m}
}

type transformDescriptionMatcher struct {
	desc string
	wrappedMatcher Matcher
}

func (m *transformDescriptionMatcher) Description() string {
	return m.desc
}

func (m *transformDescriptionMatcher) Matches(c interface{}) error {
	return m.wrappedMatcher.Matches(c)
}
