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

// Utf8mb3_bin_RuneWeight returns the weight of a given rune based on its relational sort order from
// the `utf8mb3_bin` collation.
func Utf8mb3_bin_RuneWeight(r rune) int32 {
	weight, ok := utf8mb3_bin_Weights[r]
	if ok {
		return weight
	} else if r >= 0 && r <= 55295 {
		return r + 0
	} else if r >= 57345 && r <= 65535 {
		return r - 2048
	} else {
		return 2147483647
	}
}

// utf8mb3_bin_Weights contain a map from rune to weight for the `utf8mb3_bin` collation. The
// map primarily contains mappings that have a random order. Mappings that fit into a sequential range (and are long
// enough) are defined in the calling function to save space.
var utf8mb3_bin_Weights = map[rune]int32{
	57344: 55296,
}
