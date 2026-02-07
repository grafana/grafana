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

// Utf8mb4_is_0900_as_cs_RuneWeight returns the weight of a given rune based on its relational sort order from
// the `utf8mb4_is_0900_as_cs` collation.
func Utf8mb4_is_0900_as_cs_RuneWeight(r rune) int32 {
	weight, ok := utf8mb4_is_0900_as_cs_Weights()[r]
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
	} else if r >= 5121 && r <= 5499 {
		return r + 10864
	} else if r >= 5543 && r <= 5740 {
		return r + 10872
	} else if r >= 92160 && r <= 92728 {
		return r - 74814
	} else if r >= 124928 && r <= 125124 {
		return r - 106983
	} else if r >= 44033 && r <= 44619 {
		return r - 25817
	} else if r >= 44620 && r <= 45207 {
		return r - 25814
	} else if r >= 45209 && r <= 45795 {
		return r - 25809
	} else if r >= 45797 && r <= 46383 {
		return r - 25804
	} else if r >= 46384 && r <= 46971 {
		return r - 25801
	} else if r >= 46973 && r <= 47559 {
		return r - 25796
	} else if r >= 47561 && r <= 48147 {
		return r - 25791
	} else if r >= 48149 && r <= 48735 {
		return r - 25786
	} else if r >= 48736 && r <= 49323 {
		return r - 25783
	} else if r >= 49325 && r <= 49911 {
		return r - 25778
	} else if r >= 49912 && r <= 50499 {
		return r - 25775
	} else if r >= 50501 && r <= 50864 {
		return r - 25770
	} else if r >= 50865 && r <= 51087 {
		return r - 25769
	} else if r >= 51089 && r <= 51452 {
		return r - 25764
	} else if r >= 51453 && r <= 51675 {
		return r - 25763
	} else if r >= 51676 && r <= 52263 {
		return r - 25760
	} else if r >= 52281 && r <= 52851 {
		return r - 25754
	} else if r >= 52853 && r <= 53439 {
		return r - 25749
	} else if r >= 53441 && r <= 54027 {
		return r - 25744
	} else if r >= 54029 && r <= 54615 {
		return r - 25739
	} else if r >= 54617 && r <= 55203 {
		return r - 25734
	} else if r >= 40960 && r <= 42124 {
		return r - 10572
	} else if r >= 113664 && r <= 113770 {
		return r - 81429
	} else if r >= 65664 && r <= 65786 {
		return r - 33024
	} else if r >= 67073 && r <= 67382 {
		return r - 34309
	} else if r >= 73728 && r <= 74338 {
		return r - 40190
	} else if r >= 74339 && r <= 74451 {
		return r - 40188
	} else if r >= 74455 && r <= 74649 {
		return r - 40190
	} else if r >= 74881 && r <= 75075 {
		return r - 40420
	} else if r >= 77825 && r <= 78894 {
		return r - 43168
	} else if r >= 82944 && r <= 83526 {
		return r - 47159
	} else if r >= 94209 && r <= 101119 {
		return r - 57840
	} else if r >= 22900 && r <= 23000 {
		return r + 23424
	} else if r >= 25797 && r <= 25903 {
		return r + 23475
	} else if r >= 26793 && r <= 26900 {
		return r + 23504
	} else if r >= 27156 && r <= 27304 {
		return r + 23504
	} else if r >= 31521 && r <= 31631 {
		return r + 23581
	} else if r >= 31690 && r <= 31806 {
		return r + 23582
	} else if r >= 32416 && r <= 32566 {
		return r + 23587
	} else if r >= 33087 && r <= 33240 {
		return r + 23609
	} else if r >= 33880 && r <= 34030 {
		return r + 23623
	} else if r >= 34149 && r <= 34253 {
		return r + 23623
	} else if r >= 35329 && r <= 35488 {
		return r + 23639
	} else if r >= 35745 && r <= 35895 {
		return r + 23640
	} else if r >= 36337 && r <= 36523 {
		return r + 23654
	} else if r >= 36791 && r <= 36899 {
		return r + 23663
	} else if r >= 37707 && r <= 37881 {
		return r + 23673
	} else if r >= 37910 && r <= 38021 {
		return r + 23673
	} else if r >= 38022 && r <= 38263 {
		return r + 23674
	} else if r >= 39423 && r <= 39530 {
		return r + 23710
	} else if r >= 39792 && r <= 40000 {
		return r + 23721
	} else if r >= 40061 && r <= 40165 {
		return r + 23722
	} else if r >= 40190 && r <= 40295 {
		return r + 23723
	} else if r >= 13312 && r <= 13470 {
		return r + 51373
	} else if r >= 13590 && r <= 14062 {
		return r + 51373
	} else if r >= 14077 && r <= 14209 {
		return r + 51373
	} else if r >= 14210 && r <= 14383 {
		return r + 51373
	} else if r >= 14651 && r <= 14894 {
		return r + 51373
	} else if r >= 14957 && r <= 15076 {
		return r + 51373
	} else if r >= 15262 && r <= 15384 {
		return r + 51373
	} else if r >= 15439 && r <= 15667 {
		return r + 51373
	} else if r >= 15767 && r <= 16044 {
		return r + 51373
	} else if r >= 16156 && r <= 16380 {
		return r + 51373
	} else if r >= 16688 && r <= 16898 {
		return r + 51373
	} else if r >= 16936 && r <= 17056 {
		return r + 51373
	} else if r >= 17242 && r <= 17365 {
		return r + 51373
	} else if r >= 17516 && r <= 17707 {
		return r + 51373
	} else if r >= 17772 && r <= 17879 {
		return r + 51373
	} else if r >= 17974 && r <= 18110 {
		return r + 51373
	} else if r >= 18120 && r <= 18837 {
		return r + 51373
	} else if r >= 18919 && r <= 19054 {
		return r + 51373
	} else if r >= 19123 && r <= 19251 {
		return r + 51373
	} else if r >= 19252 && r <= 19406 {
		return r + 51373
	} else if r >= 19407 && r <= 19662 {
		return r + 51373
	} else if r >= 131072 && r <= 131362 {
		return r - 59805
	} else if r >= 131363 && r <= 132380 {
		return r - 59805
	} else if r >= 132428 && r <= 132666 {
		return r - 59805
	} else if r >= 132667 && r <= 133124 {
		return r - 59805
	} else if r >= 133125 && r <= 133342 {
		return r - 59805
	} else if r >= 133343 && r <= 133676 {
		return r - 59805
	} else if r >= 133677 && r <= 133987 {
		return r - 59805
	} else if r >= 133988 && r <= 136420 {
		return r - 59805
	} else if r >= 136421 && r <= 136872 {
		return r - 59805
	} else if r >= 136939 && r <= 137672 {
		return r - 59805
	} else if r >= 137673 && r <= 138008 {
		return r - 59805
	} else if r >= 138009 && r <= 138507 {
		return r - 59805
	} else if r >= 138508 && r <= 138724 {
		return r - 59805
	} else if r >= 138727 && r <= 139651 {
		return r - 59805
	} else if r >= 139680 && r <= 140081 {
		return r - 59805
	} else if r >= 140082 && r <= 141012 {
		return r - 59805
	} else if r >= 141013 && r <= 141379 {
		return r - 59805
	} else if r >= 141386 && r <= 142092 {
		return r - 59805
	} else if r >= 142093 && r <= 142321 {
		return r - 59805
	} else if r >= 142322 && r <= 143370 {
		return r - 59805
	} else if r >= 143371 && r <= 144056 {
		return r - 59805
	} else if r >= 144057 && r <= 144223 {
		return r - 59805
	} else if r >= 144341 && r <= 144493 {
		return r - 59805
	} else if r >= 144494 && r <= 145059 {
		return r - 59805
	} else if r >= 145060 && r <= 145575 {
		return r - 59805
	} else if r >= 145576 && r <= 146061 {
		return r - 59805
	} else if r >= 146062 && r <= 146170 {
		return r - 59805
	} else if r >= 146171 && r <= 146620 {
		return r - 59805
	} else if r >= 146719 && r <= 147153 {
		return r - 59805
	} else if r >= 147154 && r <= 147294 {
		return r - 59805
	} else if r >= 147343 && r <= 148067 {
		return r - 59805
	} else if r >= 148068 && r <= 148205 {
		return r - 59805
	} else if r >= 148206 && r <= 148395 {
		return r - 59805
	} else if r >= 148396 && r <= 149000 {
		return r - 59805
	} else if r >= 149001 && r <= 149301 {
		return r - 59805
	} else if r >= 149302 && r <= 149524 {
		return r - 59805
	} else if r >= 149525 && r <= 150582 {
		return r - 59805
	} else if r >= 150675 && r <= 151457 {
		return r - 59805
	} else if r >= 151481 && r <= 151620 {
		return r - 59805
	} else if r >= 151621 && r <= 151794 {
		return r - 59805
	} else if r >= 151860 && r <= 152136 {
		return r - 59805
	} else if r >= 152137 && r <= 152605 {
		return r - 59805
	} else if r >= 152606 && r <= 153126 {
		return r - 59805
	} else if r >= 153127 && r <= 153242 {
		return r - 59805
	} else if r >= 153286 && r <= 153980 {
		return r - 59805
	} else if r >= 153981 && r <= 154279 {
		return r - 59805
	} else if r >= 154280 && r <= 154539 {
		return r - 59805
	} else if r >= 154540 && r <= 154752 {
		return r - 59805
	} else if r >= 154832 && r <= 155526 {
		return r - 59805
	} else if r >= 155527 && r <= 156122 {
		return r - 59805
	} else if r >= 156232 && r <= 156377 {
		return r - 59805
	} else if r >= 156378 && r <= 156478 {
		return r - 59805
	} else if r >= 156479 && r <= 156890 {
		return r - 59805
	} else if r >= 156964 && r <= 157096 {
		return r - 59805
	} else if r >= 157097 && r <= 157607 {
		return r - 59805
	} else if r >= 157622 && r <= 158524 {
		return r - 59805
	} else if r >= 158525 && r <= 158774 {
		return r - 59805
	} else if r >= 158775 && r <= 158933 {
		return r - 59805
	} else if r >= 158934 && r <= 159083 {
		return r - 59805
	} else if r >= 159084 && r <= 159532 {
		return r - 59805
	} else if r >= 159533 && r <= 159665 {
		return r - 59805
	} else if r >= 159666 && r <= 159954 {
		return r - 59805
	} else if r >= 159955 && r <= 160714 {
		return r - 59805
	} else if r >= 160715 && r <= 161383 {
		return r - 59805
	} else if r >= 161384 && r <= 161966 {
		return r - 59805
	} else if r >= 161967 && r <= 162150 {
		return r - 59805
	} else if r >= 162151 && r <= 162984 {
		return r - 59805
	} else if r >= 162985 && r <= 163538 {
		return r - 59805
	} else if r >= 163632 && r <= 165330 {
		return r - 59805
	} else if r >= 165358 && r <= 165678 {
		return r - 59805
	} else if r >= 165679 && r <= 166906 {
		return r - 59805
	} else if r >= 166907 && r <= 167287 {
		return r - 59805
	} else if r >= 167288 && r <= 168261 {
		return r - 59805
	} else if r >= 168262 && r <= 168415 {
		return r - 59805
	} else if r >= 168475 && r <= 168970 {
		return r - 59805
	} else if r >= 168971 && r <= 169110 {
		return r - 59805
	} else if r >= 169111 && r <= 169398 {
		return r - 59805
	} else if r >= 169399 && r <= 170800 {
		return r - 59805
	} else if r >= 170801 && r <= 172238 {
		return r - 59805
	} else if r >= 172294 && r <= 172558 {
		return r - 59805
	} else if r >= 172559 && r <= 172689 {
		return r - 59805
	} else if r >= 172690 && r <= 172946 {
		return r - 59805
	} else if r >= 172947 && r <= 173568 {
		return r - 59805
	} else if r >= 173569 && r <= 173782 {
		return r - 59805
	} else if r >= 173825 && r <= 177972 {
		return r - 59846
	} else if r >= 177985 && r <= 178205 {
		return r - 59857
	} else if r >= 178209 && r <= 183969 {
		return r - 59859
	} else if r >= 57344 && r <= 63743 {
		return r + 68426
	} else if r >= 66046 && r <= 66175 {
		return r + 66408
	} else if r >= 66928 && r <= 67071 {
		return r + 65782
	} else if r >= 67432 && r <= 67583 {
		return r + 65441
	} else if r >= 68864 && r <= 69215 {
		return r + 64571
	} else if r >= 69248 && r <= 69631 {
		return r + 64540
	} else if r >= 70517 && r <= 70655 {
		return r + 63856
	} else if r >= 70874 && r <= 71039 {
		return r + 63682
	} else if r >= 71488 && r <= 71839 {
		return r + 63375
	} else if r >= 71936 && r <= 72383 {
		return r + 63291
	} else if r >= 72442 && r <= 72703 {
		return r + 63234
	} else if r >= 72887 && r <= 73727 {
		return r + 63069
	} else if r >= 74651 && r <= 74751 {
		return r + 62147
	} else if r >= 75076 && r <= 77823 {
		return r + 61835
	} else if r >= 78896 && r <= 82943 {
		return r + 60764
	} else if r >= 83528 && r <= 92159 {
		return r + 60181
	} else if r >= 93072 && r <= 93951 {
		return r + 59406
	} else if r >= 101120 && r <= 110591 {
		return r + 52360
	} else if r >= 110595 && r <= 113663 {
		return r + 52358
	} else if r >= 113828 && r <= 118783 {
		return r + 52211
	} else if r >= 119366 && r <= 119551 {
		return r + 51664
	} else if r >= 119666 && r <= 119807 {
		return r + 51559
	} else if r >= 121520 && r <= 122879 {
		return r + 49891
	} else if r >= 122923 && r <= 124927 {
		return r + 49853
	} else if r >= 125280 && r <= 126463 {
		return r + 49553
	} else if r >= 126706 && r <= 126975 {
		return r + 49410
	} else if r >= 127570 && r <= 127743 {
		return r + 48935
	} else if r >= 129473 && r <= 131071 {
		return r + 47505
	} else if r >= 183970 && r <= 194559 {
		return r - 5339
	} else if r >= 195103 && r <= 917504 {
		return r - 5881
	} else if r >= 917632 && r <= 917759 {
		return r - 5978
	} else if r >= 918001 && r <= 1114111 {
		return r - 6218
	} else if r >= 917760 && r <= 917999 {
		return 0
	} else {
		return 2147483647
	}
}
