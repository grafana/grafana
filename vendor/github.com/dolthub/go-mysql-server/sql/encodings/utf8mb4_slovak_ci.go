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

// Utf8mb4_slovak_ci_RuneWeight returns the weight of a given rune based on its relational sort order from
// the `utf8mb4_slovak_ci` collation.
func Utf8mb4_slovak_ci_RuneWeight(r rune) int32 {
	weight, ok := common_utf_slovak_ci_Weights()[r]
	if ok {
		return weight
	} else if r >= 9003 && r <= 9168 {
		return r - 8070
	} else if r >= 9475 && r <= 9632 {
		return r - 8323
	} else if r >= 10496 && r <= 10626 {
		return r - 8775
	} else if r >= 10765 && r <= 10867 {
		return r - 8800
	} else if r >= 10872 && r <= 10971 {
		return r - 8803
	} else if r >= 10240 && r <= 10495 {
		return r - 8022
	} else if r >= 5121 && r <= 5499 {
		return r + 552
	} else if r >= 5543 && r <= 5740 {
		return r + 560
	} else if r >= 40960 && r <= 42124 {
		return r - 34149
	} else if r >= 20241 && r <= 20358 {
		return r - 11992
	} else if r >= 20416 && r <= 20523 {
		return r - 11992
	} else if r >= 20524 && r <= 20698 {
		return r - 11992
	} else if r >= 21571 && r <= 21693 {
		return r - 11992
	} else if r >= 21694 && r <= 21895 {
		return r - 11992
	} else if r >= 22121 && r <= 22230 {
		return r - 11992
	} else if r >= 22320 && r <= 22592 {
		return r - 11992
	} else if r >= 22900 && r <= 23375 {
		return r - 11991
	} else if r >= 23665 && r <= 23833 {
		return r - 11991
	} else if r >= 23889 && r <= 23994 {
		return r - 11991
	} else if r >= 24062 && r <= 24177 {
		return r - 11991
	} else if r >= 24605 && r <= 24724 {
		return r - 11990
	} else if r >= 25164 && r <= 25289 {
		return r - 11990
	} else if r >= 25343 && r <= 25467 {
		return r - 11990
	} else if r >= 25505 && r <= 25754 {
		return r - 11990
	} else if r >= 25797 && r <= 25902 {
		return r - 11990
	} else if r >= 26793 && r <= 27138 {
		return r - 11987
	} else if r >= 27156 && r <= 27347 {
		return r - 11987
	} else if r >= 28187 && r <= 28316 {
		return r - 11987
	} else if r >= 28452 && r <= 28651 {
		return r - 11987
	} else if r >= 28671 && r <= 28778 {
		return r - 11987
	} else if r >= 28890 && r <= 29001 {
		return r - 11987
	} else if r >= 30466 && r <= 30682 {
		return r - 11987
	} else if r >= 30707 && r <= 30827 {
		return r - 11987
	} else if r >= 31521 && r <= 31680 {
		return r - 11987
	} else if r >= 31681 && r <= 31806 {
		return r - 11987
	} else if r >= 32048 && r <= 32160 {
		return r - 11987
	} else if r >= 32415 && r <= 32565 {
		return r - 11987
	} else if r >= 32908 && r <= 33240 {
		return r - 11987
	} else if r >= 33402 && r <= 33509 {
		return r - 11987
	} else if r >= 33591 && r <= 33737 {
		return r - 11987
	} else if r >= 33880 && r <= 34030 {
		return r - 11987
	} else if r >= 34045 && r <= 34253 {
		return r - 11987
	} else if r >= 34411 && r <= 34746 {
		return r - 11987
	} else if r >= 34747 && r <= 34847 {
		return r - 11987
	} else if r >= 35328 && r <= 35498 {
		return r - 11987
	} else if r >= 35744 && r <= 35894 {
		return r - 11987
	} else if r >= 36336 && r <= 36522 {
		return r - 11987
	} else if r >= 36791 && r <= 36899 {
		return r - 11987
	} else if r >= 37429 && r <= 37636 {
		return r - 11987
	} else if r >= 37707 && r <= 38020 {
		return r - 11987
	} else if r >= 38021 && r <= 38262 {
		return r - 11987
	} else if r >= 39410 && r <= 39530 {
		return r - 11987
	} else if r >= 39792 && r <= 40023 {
		return r - 11987
	} else if r >= 40060 && r <= 40164 {
		return r - 11987
	} else if r >= 40165 && r <= 40372 {
		return r - 11987
	} else if r >= 13312 && r <= 19893 {
		return r + 15583
	} else if r >= 1970 && r <= 2304 {
		return r + 33723
	} else if r >= 6517 && r <= 6623 {
		return r + 30534
	} else if r >= 6657 && r <= 7423 {
		return r + 30502
	} else if r >= 7533 && r <= 7679 {
		return r + 30394
	} else if r >= 11022 && r <= 11903 {
		return r + 27432
	} else if r >= 42183 && r <= 55295 {
		return r - 2617
	} else if r >= 57345 && r <= 63743 {
		return r - 4665
	} else if r >= 64107 && r <= 64255 {
		return r - 5026
	} else if r >= 65536 && r <= 1114111 {
		return 59409
	} else {
		return 2147483647
	}
}
