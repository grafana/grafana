// Copyright 2018 The CUE Authors
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

package strconv

import "cuelang.org/go/cue/literal"

// Unquote interprets s as a single-quoted, double-quoted,
// or backquoted CUE string literal, returning the string value
// that s quotes.
func Unquote(s string) (string, error) {
	return literal.Unquote(s)
}

// TODO: replace parsing functions with parsing to apd
