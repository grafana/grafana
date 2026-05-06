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

// Utf8mb4_zh_0900_as_cs_RuneWeight returns the weight of a given rune based on its relational sort order from
// the `utf8mb4_zh_0900_as_cs` collation.
func Utf8mb4_zh_0900_as_cs_RuneWeight(r rune) int32 {
	weight, ok := utf8mb4_zh_0900_as_cs_Weights()[r]
	if ok {
		return weight
	} else if r >= 9003 && r <= 9214 {
		return r - 7093
	} else if r >= 9475 && r <= 9632 {
		return r - 7299
	} else if r >= 9676 && r <= 9775 {
		return r - 7297
	} else if r >= 9872 && r <= 9983 {
		return r - 7314
	} else if r >= 9984 && r <= 10087 {
		return r - 7288
	} else if r >= 10496 && r <= 10626 {
		return r - 7600
	} else if r >= 10765 && r <= 10867 {
		return r - 7629
	} else if r >= 10872 && r <= 10971 {
		return r - 7632
	} else if r >= 10974 && r <= 11123 {
		return r - 7632
	} else if r >= 10240 && r <= 10495 {
		return r - 6652
	} else if r >= 118784 && r <= 119029 {
		return r - 114626
	} else if r >= 127024 && r <= 127123 {
		return r - 122325
	} else if r >= 127744 && r <= 128511 {
		return r - 122863
	} else if r >= 128512 && r <= 128722 {
		return r - 122781
	} else if r >= 128768 && r <= 128883 {
		return r - 122806
	} else if r >= 120832 && r <= 121343 {
		return r - 114521
	} else if r >= 173824 && r <= 173980 {
		return r - 95465
	} else if r >= 173983 && r <= 174151 {
		return r - 95466
	} else if r >= 174255 && r <= 174601 {
		return r - 95469
	} else if r >= 174616 && r <= 174748 {
		return r - 95471
	} else if r >= 174751 && r <= 175800 {
		return r - 95472
	} else if r >= 175825 && r <= 176033 {
		return r - 95474
	} else if r >= 176036 && r <= 176224 {
		return r - 95475
	} else if r >= 176441 && r <= 176687 {
		return r - 95481
	} else if r >= 176690 && r <= 176847 {
		return r - 95482
	} else if r >= 177172 && r <= 177333 {
		return r - 95496
	} else if r >= 177423 && r <= 177591 {
		return r - 95500
	} else if r >= 177984 && r <= 178205 {
		return r - 95533
	} else if r >= 178258 && r <= 181499 {
		return r - 95536
	} else if r >= 181502 && r <= 181804 {
		return r - 95537
	} else if r >= 181807 && r <= 182564 {
		return r - 95538
	} else if r >= 182567 && r <= 183245 {
		return r - 95539
	} else if r >= 183248 && r <= 183842 {
		return r - 95540
	} else if r >= 183845 && r <= 183969 {
		return r - 95541
	} else if r >= 5121 && r <= 5499 {
		return r + 91703
	} else if r >= 5543 && r <= 5740 {
		return r + 91711
	} else if r >= 92160 && r <= 92728 {
		return r + 6025
	} else if r >= 124928 && r <= 125124 {
		return r - 26144
	} else if r >= 44033 && r <= 44619 {
		return r + 55022
	} else if r >= 44620 && r <= 45207 {
		return r + 55025
	} else if r >= 45209 && r <= 45795 {
		return r + 55030
	} else if r >= 45797 && r <= 46383 {
		return r + 55035
	} else if r >= 46384 && r <= 46971 {
		return r + 55038
	} else if r >= 46973 && r <= 47559 {
		return r + 55043
	} else if r >= 47561 && r <= 48147 {
		return r + 55048
	} else if r >= 48149 && r <= 48735 {
		return r + 55053
	} else if r >= 48736 && r <= 49323 {
		return r + 55056
	} else if r >= 49325 && r <= 49911 {
		return r + 55061
	} else if r >= 49912 && r <= 50499 {
		return r + 55064
	} else if r >= 50501 && r <= 50864 {
		return r + 55069
	} else if r >= 50865 && r <= 51087 {
		return r + 55070
	} else if r >= 51089 && r <= 51452 {
		return r + 55075
	} else if r >= 51453 && r <= 51675 {
		return r + 55076
	} else if r >= 51676 && r <= 52263 {
		return r + 55079
	} else if r >= 52281 && r <= 52851 {
		return r + 55085
	} else if r >= 52853 && r <= 53439 {
		return r + 55090
	} else if r >= 53441 && r <= 54027 {
		return r + 55095
	} else if r >= 54029 && r <= 54615 {
		return r + 55100
	} else if r >= 54617 && r <= 55203 {
		return r + 55105
	} else if r >= 40960 && r <= 42124 {
		return r + 70267
	} else if r >= 113664 && r <= 113770 {
		return r - 590
	} else if r >= 65664 && r <= 65786 {
		return r + 47815
	} else if r >= 67073 && r <= 67382 {
		return r + 46530
	} else if r >= 73728 && r <= 74338 {
		return r + 40649
	} else if r >= 74339 && r <= 74451 {
		return r + 40651
	} else if r >= 74455 && r <= 74649 {
		return r + 40649
	} else if r >= 74881 && r <= 75075 {
		return r + 40419
	} else if r >= 77825 && r <= 78894 {
		return r + 37671
	} else if r >= 82944 && r <= 83526 {
		return r + 33680
	} else if r >= 94209 && r <= 101119 {
		return r + 22999
	} else if r >= 57344 && r <= 63743 {
		return r + 68431
	} else if r >= 66046 && r <= 66175 {
		return r + 66413
	} else if r >= 66928 && r <= 67071 {
		return r + 65787
	} else if r >= 67432 && r <= 67583 {
		return r + 65446
	} else if r >= 68864 && r <= 69215 {
		return r + 64576
	} else if r >= 69248 && r <= 69631 {
		return r + 64545
	} else if r >= 70517 && r <= 70655 {
		return r + 63861
	} else if r >= 70874 && r <= 71039 {
		return r + 63687
	} else if r >= 71488 && r <= 71839 {
		return r + 63380
	} else if r >= 71936 && r <= 72383 {
		return r + 63296
	} else if r >= 72442 && r <= 72703 {
		return r + 63239
	} else if r >= 72887 && r <= 73727 {
		return r + 63074
	} else if r >= 74651 && r <= 74751 {
		return r + 62152
	} else if r >= 75076 && r <= 77823 {
		return r + 61840
	} else if r >= 78896 && r <= 82943 {
		return r + 60769
	} else if r >= 83528 && r <= 92159 {
		return r + 60186
	} else if r >= 93072 && r <= 93951 {
		return r + 59411
	} else if r >= 101120 && r <= 110591 {
		return r + 52365
	} else if r >= 110595 && r <= 113663 {
		return r + 52363
	} else if r >= 113828 && r <= 118783 {
		return r + 52216
	} else if r >= 119366 && r <= 119551 {
		return r + 51669
	} else if r >= 119666 && r <= 119807 {
		return r + 51564
	} else if r >= 121520 && r <= 122879 {
		return r + 49896
	} else if r >= 122923 && r <= 124927 {
		return r + 49858
	} else if r >= 125280 && r <= 126463 {
		return r + 49558
	} else if r >= 126706 && r <= 126975 {
		return r + 49415
	} else if r >= 127570 && r <= 127743 {
		return r + 48940
	} else if r >= 129473 && r <= 131071 {
		return r + 47510
	} else if r >= 183970 && r <= 194559 {
		return r - 5334
	} else if r >= 195103 && r <= 917504 {
		return r - 5876
	} else if r >= 917632 && r <= 917759 {
		return r - 5973
	} else if r >= 918001 && r <= 1114111 {
		return r - 6213
	} else if r >= 917760 && r <= 917999 {
		return 0
	} else {
		return 2147483647
	}
}
