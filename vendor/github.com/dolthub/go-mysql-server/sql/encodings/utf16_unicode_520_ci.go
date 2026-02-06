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

// Utf16_unicode_520_ci_RuneWeight returns the weight of a given rune based on its relational sort order from
// the `utf16_unicode_520_ci` collation.
func Utf16_unicode_520_ci_RuneWeight(r rune) int32 {
	weight, ok := common_utf_unicode_520_ci_Weights()[r]
	if ok {
		return weight
	} else if r >= 9003 && r <= 9192 {
		return r - 7758
	} else if r >= 9475 && r <= 9632 {
		return r - 7987
	} else if r >= 9676 && r <= 9775 {
		return r - 7987
	} else if r >= 10496 && r <= 10626 {
		return r - 8321
	} else if r >= 10765 && r <= 10867 {
		return r - 8346
	} else if r >= 10872 && r <= 10971 {
		return r - 8349
	} else if r >= 10974 && r <= 11084 {
		return r - 8350
	} else if r >= 10240 && r <= 10495 {
		return r - 7489
	} else if r >= 118784 && r <= 119029 {
		return r - 115474
	} else if r >= 127024 && r <= 127123 {
		return r - 123185
	} else if r >= 5121 && r <= 5499 {
		return r + 3811
	} else if r >= 5543 && r <= 5740 {
		return r + 3819
	} else if r >= 40960 && r <= 42124 {
		return r - 30284
	} else if r >= 65664 && r <= 65786 {
		return r - 53409
	} else if r >= 73728 && r <= 74606 {
		return r - 61076
	} else if r >= 77825 && r <= 78894 {
		return r - 64293
	} else if r >= 22900 && r <= 23000 {
		return r - 5365
	} else if r >= 25797 && r <= 25902 {
		return r - 5364
	} else if r >= 26793 && r <= 26900 {
		return r - 5361
	} else if r >= 27156 && r <= 27304 {
		return r - 5361
	} else if r >= 31521 && r <= 31630 {
		return r - 5361
	} else if r >= 31690 && r <= 31806 {
		return r - 5361
	} else if r >= 32415 && r <= 32565 {
		return r - 5361
	} else if r >= 33087 && r <= 33240 {
		return r - 5361
	} else if r >= 33880 && r <= 34030 {
		return r - 5361
	} else if r >= 34149 && r <= 34253 {
		return r - 5361
	} else if r >= 35328 && r <= 35488 {
		return r - 5361
	} else if r >= 35744 && r <= 35894 {
		return r - 5361
	} else if r >= 36337 && r <= 36522 {
		return r - 5361
	} else if r >= 36791 && r <= 36899 {
		return r - 5361
	} else if r >= 37707 && r <= 37881 {
		return r - 5361
	} else if r >= 37910 && r <= 38020 {
		return r - 5361
	} else if r >= 38021 && r <= 38262 {
		return r - 5361
	} else if r >= 39423 && r <= 39530 {
		return r - 5361
	} else if r >= 39792 && r <= 40000 {
		return r - 5361
	} else if r >= 40060 && r <= 40164 {
		return r - 5361
	} else if r >= 40190 && r <= 40295 {
		return r - 5361
	} else if r >= 13312 && r <= 13470 {
		return r + 22209
	} else if r >= 13590 && r <= 14062 {
		return r + 22209
	} else if r >= 14077 && r <= 14209 {
		return r + 22209
	} else if r >= 14210 && r <= 14383 {
		return r + 22209
	} else if r >= 14651 && r <= 14894 {
		return r + 22209
	} else if r >= 14957 && r <= 15076 {
		return r + 22209
	} else if r >= 15262 && r <= 15384 {
		return r + 22209
	} else if r >= 15439 && r <= 15667 {
		return r + 22209
	} else if r >= 15767 && r <= 16044 {
		return r + 22209
	} else if r >= 16156 && r <= 16380 {
		return r + 22209
	} else if r >= 16688 && r <= 16898 {
		return r + 22209
	} else if r >= 16936 && r <= 17056 {
		return r + 22209
	} else if r >= 17242 && r <= 17365 {
		return r + 22209
	} else if r >= 17516 && r <= 17707 {
		return r + 22209
	} else if r >= 17772 && r <= 17879 {
		return r + 22209
	} else if r >= 17974 && r <= 18110 {
		return r + 22209
	} else if r >= 18120 && r <= 18837 {
		return r + 22209
	} else if r >= 18919 && r <= 19054 {
		return r + 22209
	} else if r >= 19123 && r <= 19251 {
		return r + 22209
	} else if r >= 19252 && r <= 19406 {
		return r + 22209
	} else if r >= 19407 && r <= 19662 {
		return r + 22209
	} else if r >= 2111 && r <= 2303 {
		return r + 40187
	} else if r >= 11098 && r <= 11263 {
		return r + 32639
	} else if r >= 42893 && r <= 43002 {
		return r + 1384
	} else if r >= 43744 && r <= 43967 {
		return r + 772
	} else if r >= 44026 && r <= 55215 {
		return r + 716
	} else if r >= 57344 && r <= 63743 {
		return r - 1404
	} else if r >= 66046 && r <= 66175 {
		return r - 3390
	} else if r >= 66730 && r <= 67583 {
		return r - 3779
	} else if r >= 67680 && r <= 67839 {
		return r - 3865
	} else if r >= 67904 && r <= 68095 {
		return r - 3921
	} else if r >= 68224 && r <= 68351 {
		return r - 4018
	} else if r >= 68480 && r <= 68607 {
		return r - 4136
	} else if r >= 68682 && r <= 69215 {
		return r - 4209
	} else if r >= 69248 && r <= 69759 {
		return r - 4240
	} else if r >= 69827 && r <= 73727 {
		return r - 4306
	} else if r >= 74608 && r <= 74751 {
		return r - 5185
	} else if r >= 74868 && r <= 77823 {
		return r - 5288
	} else if r >= 78896 && r <= 118783 {
		return r - 6359
	} else if r >= 119366 && r <= 119551 {
		return r - 6895
	} else if r >= 119666 && r <= 119807 {
		return r - 7000
	} else if r >= 120832 && r <= 126975 {
		return r - 7996
	} else if r >= 127124 && r <= 127231 {
		return r - 8140
	} else if r >= 127377 && r <= 127487 {
		return r - 8203
	} else if r >= 127561 && r <= 194559 {
		return r - 8247
	} else if r >= 195103 && r <= 917504 {
		return r - 8789
	} else if r >= 917632 && r <= 917759 {
		return r - 8886
	} else if r >= 918001 && r <= 1114111 {
		return r - 9126
	} else if r >= 917760 && r <= 917999 {
		return 9
	} else {
		return 2147483647
	}
}
