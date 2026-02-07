// Copyright 2022 Dolthub, Inc.
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

package encodings

// Ascii_bin_RuneWeight returns the weight of a given rune based on its relational sort order from
// the `ascii_bin` collation.
func Ascii_bin_RuneWeight(r rune) int32 {
	if r >= 0 && r <= 127 {
		return r
	} else {
		return 2147483647
	}
}
