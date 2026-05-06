// Copyright 2023 Dolthub, Inc.
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

// Utf8mb3_unicode_520_ci_RuneWeight returns the weight of a given rune based on its relational sort order from
// the `utf8mb3_unicode_520_ci` collation.
func Utf8mb3_unicode_520_ci_RuneWeight(r rune) int32 {
	weight, ok := utf8mb3_unicode_520_ci_Weights()[r]
	if ok {
		return weight
	} else if r >= 9003 && r <= 9192 {
		return r - 7802
	} else if r >= 9475 && r <= 9632 {
		return r - 8031
	} else if r >= 9676 && r <= 9775 {
		return r - 8031
	} else if r >= 10496 && r <= 10626 {
		return r - 8365
	} else if r >= 10765 && r <= 10867 {
		return r - 8390
	} else if r >= 10872 && r <= 10971 {
		return r - 8393
	} else if r >= 10974 && r <= 11084 {
		return r - 8394
	} else if r >= 10240 && r <= 10495 {
		return r - 7533
	} else if r >= 5121 && r <= 5499 {
		return r + 2686
	} else if r >= 5543 && r <= 5740 {
		return r + 2694
	} else if r >= 40960 && r <= 42124 {
		return r - 31455
	} else if r >= 20241 && r <= 20352 {
		return r - 9252
	} else if r >= 20416 && r <= 20523 {
		return r - 9252
	} else if r >= 20524 && r <= 20698 {
		return r - 9252
	} else if r >= 21571 && r <= 21693 {
		return r - 9252
	} else if r >= 21694 && r <= 21838 {
		return r - 9252
	} else if r >= 22121 && r <= 22230 {
		return r - 9252
	} else if r >= 22320 && r <= 22592 {
		return r - 9252
	} else if r >= 22900 && r <= 23138 {
		return r - 9251
	} else if r >= 23139 && r <= 23336 {
		return r - 9251
	} else if r >= 23665 && r <= 23833 {
		return r - 9251
	} else if r >= 23889 && r <= 23994 {
		return r - 9251
	} else if r >= 24062 && r <= 24177 {
		return r - 9251
	} else if r >= 25164 && r <= 25289 {
		return r - 9250
	} else if r >= 25343 && r <= 25467 {
		return r - 9250
	} else if r >= 25797 && r <= 25902 {
		return r - 9250
	} else if r >= 26793 && r <= 27138 {
		return r - 9247
	} else if r >= 27156 && r <= 27347 {
		return r - 9247
	} else if r >= 28187 && r <= 28316 {
		return r - 9247
	} else if r >= 28452 && r <= 28651 {
		return r - 9247
	} else if r >= 28890 && r <= 29001 {
		return r - 9247
	} else if r >= 30707 && r <= 30827 {
		return r - 9247
	} else if r >= 31521 && r <= 31630 {
		return r - 9247
	} else if r >= 31681 && r <= 31806 {
		return r - 9247
	} else if r >= 32415 && r <= 32565 {
		return r - 9247
	} else if r >= 32908 && r <= 33240 {
		return r - 9247
	} else if r >= 33402 && r <= 33509 {
		return r - 9247
	} else if r >= 33619 && r <= 33737 {
		return r - 9247
	} else if r >= 33880 && r <= 34030 {
		return r - 9247
	} else if r >= 34045 && r <= 34253 {
		return r - 9247
	} else if r >= 34411 && r <= 34681 {
		return r - 9247
	} else if r >= 34747 && r <= 34847 {
		return r - 9247
	} else if r >= 35328 && r <= 35498 {
		return r - 9247
	} else if r >= 35744 && r <= 35894 {
		return r - 9247
	} else if r >= 36336 && r <= 36522 {
		return r - 9247
	} else if r >= 36791 && r <= 36899 {
		return r - 9247
	} else if r >= 37495 && r <= 37636 {
		return r - 9247
	} else if r >= 37707 && r <= 38020 {
		return r - 9247
	} else if r >= 38021 && r <= 38262 {
		return r - 9247
	} else if r >= 39410 && r <= 39530 {
		return r - 9247
	} else if r >= 39792 && r <= 40023 {
		return r - 9247
	} else if r >= 40060 && r <= 40164 {
		return r - 9247
	} else if r >= 40165 && r <= 40372 {
		return r - 9247
	} else if r >= 13312 && r <= 15261 {
		return r + 18323
	} else if r >= 15262 && r <= 16408 {
		return r + 18323
	} else if r >= 16442 && r <= 19893 {
		return r + 18323
	} else if r >= 2111 && r <= 2303 {
		return r + 36198
	} else if r >= 11098 && r <= 11263 {
		return r + 28650
	} else if r >= 42893 && r <= 43002 {
		return r - 2605
	} else if r >= 43744 && r <= 43967 {
		return r - 3217
	} else if r >= 44026 && r <= 55215 {
		return r - 3273
	} else if r >= 57344 && r <= 63743 {
		return r - 5393
	} else {
		return 2147483647
	}
}
