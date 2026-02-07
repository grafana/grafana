// Copyright 2020 CUE Authors
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

package literal

import "strings"

// IndentTabs takes a quoted string and reindents it for the given indentation.
// If a string is not a multiline string it will return the string as is.
func IndentTabs(s string, n int) string {
	indent := tabs(n)

	qi, _, _, err := ParseQuotes(s, s)
	if err != nil || !qi.multiline || qi.whitespace == indent {
		return s
	}

	search := "\n" + qi.whitespace
	replace := "\n" + indent

	return strings.ReplaceAll(s, search, replace)
}
