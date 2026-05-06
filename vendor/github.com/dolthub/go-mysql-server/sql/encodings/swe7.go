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

// Swe7 represents the `swe7` character set encoding.
var Swe7 Encoder = &RangeMap{
	inputEntries: [][]rangeMapEntry{
		{
			{
				inputRange:  rangeBounds{{0, 63}},
				outputRange: rangeBounds{{0, 63}},
				inputMults:  []int{1},
				outputMults: []int{1},
			},
			{
				inputRange:  rangeBounds{{64, 64}},
				outputRange: rangeBounds{{195, 195}, {137, 137}},
				inputMults:  []int{1},
				outputMults: []int{1, 1},
			},
			{
				inputRange:  rangeBounds{{65, 90}},
				outputRange: rangeBounds{{65, 90}},
				inputMults:  []int{1},
				outputMults: []int{1},
			},
			{
				inputRange:  rangeBounds{{91, 91}},
				outputRange: rangeBounds{{195, 195}, {132, 132}},
				inputMults:  []int{1},
				outputMults: []int{1, 1},
			},
			{
				inputRange:  rangeBounds{{92, 92}},
				outputRange: rangeBounds{{195, 195}, {150, 150}},
				inputMults:  []int{1},
				outputMults: []int{1, 1},
			},
			{
				inputRange:  rangeBounds{{93, 93}},
				outputRange: rangeBounds{{195, 195}, {133, 133}},
				inputMults:  []int{1},
				outputMults: []int{1, 1},
			},
			{
				inputRange:  rangeBounds{{94, 94}},
				outputRange: rangeBounds{{195, 195}, {156, 156}},
				inputMults:  []int{1},
				outputMults: []int{1, 1},
			},
			{
				inputRange:  rangeBounds{{95, 95}},
				outputRange: rangeBounds{{95, 95}},
				inputMults:  []int{1},
				outputMults: []int{1},
			},
			{
				inputRange:  rangeBounds{{96, 96}},
				outputRange: rangeBounds{{195, 195}, {169, 169}},
				inputMults:  []int{1},
				outputMults: []int{1, 1},
			},
			{
				inputRange:  rangeBounds{{97, 122}},
				outputRange: rangeBounds{{97, 122}},
				inputMults:  []int{1},
				outputMults: []int{1},
			},
			{
				inputRange:  rangeBounds{{123, 123}},
				outputRange: rangeBounds{{195, 195}, {164, 164}},
				inputMults:  []int{1},
				outputMults: []int{1, 1},
			},
			{
				inputRange:  rangeBounds{{124, 124}},
				outputRange: rangeBounds{{195, 195}, {182, 182}},
				inputMults:  []int{1},
				outputMults: []int{1, 1},
			},
			{
				inputRange:  rangeBounds{{125, 125}},
				outputRange: rangeBounds{{195, 195}, {165, 165}},
				inputMults:  []int{1},
				outputMults: []int{1, 1},
			},
			{
				inputRange:  rangeBounds{{126, 126}},
				outputRange: rangeBounds{{195, 195}, {188, 188}},
				inputMults:  []int{1},
				outputMults: []int{1, 1},
			},
		},
		nil,
		nil,
		nil,
	},
	outputEntries: [][]rangeMapEntry{
		{
			{
				inputRange:  rangeBounds{{0, 63}},
				outputRange: rangeBounds{{0, 63}},
				inputMults:  []int{1},
				outputMults: []int{1},
			},
			{
				inputRange:  rangeBounds{{65, 90}},
				outputRange: rangeBounds{{65, 90}},
				inputMults:  []int{1},
				outputMults: []int{1},
			},
			{
				inputRange:  rangeBounds{{95, 95}},
				outputRange: rangeBounds{{95, 95}},
				inputMults:  []int{1},
				outputMults: []int{1},
			},
			{
				inputRange:  rangeBounds{{97, 122}},
				outputRange: rangeBounds{{97, 122}},
				inputMults:  []int{1},
				outputMults: []int{1},
			},
		},
		{
			{
				inputRange:  rangeBounds{{64, 64}},
				outputRange: rangeBounds{{195, 195}, {137, 137}},
				inputMults:  []int{1},
				outputMults: []int{1, 1},
			},
			{
				inputRange:  rangeBounds{{91, 91}},
				outputRange: rangeBounds{{195, 195}, {132, 132}},
				inputMults:  []int{1},
				outputMults: []int{1, 1},
			},
			{
				inputRange:  rangeBounds{{92, 92}},
				outputRange: rangeBounds{{195, 195}, {150, 150}},
				inputMults:  []int{1},
				outputMults: []int{1, 1},
			},
			{
				inputRange:  rangeBounds{{93, 93}},
				outputRange: rangeBounds{{195, 195}, {133, 133}},
				inputMults:  []int{1},
				outputMults: []int{1, 1},
			},
			{
				inputRange:  rangeBounds{{94, 94}},
				outputRange: rangeBounds{{195, 195}, {156, 156}},
				inputMults:  []int{1},
				outputMults: []int{1, 1},
			},
			{
				inputRange:  rangeBounds{{96, 96}},
				outputRange: rangeBounds{{195, 195}, {169, 169}},
				inputMults:  []int{1},
				outputMults: []int{1, 1},
			},
			{
				inputRange:  rangeBounds{{123, 123}},
				outputRange: rangeBounds{{195, 195}, {164, 164}},
				inputMults:  []int{1},
				outputMults: []int{1, 1},
			},
			{
				inputRange:  rangeBounds{{124, 124}},
				outputRange: rangeBounds{{195, 195}, {182, 182}},
				inputMults:  []int{1},
				outputMults: []int{1, 1},
			},
			{
				inputRange:  rangeBounds{{125, 125}},
				outputRange: rangeBounds{{195, 195}, {165, 165}},
				inputMults:  []int{1},
				outputMults: []int{1, 1},
			},
			{
				inputRange:  rangeBounds{{126, 126}},
				outputRange: rangeBounds{{195, 195}, {188, 188}},
				inputMults:  []int{1},
				outputMults: []int{1, 1},
			},
		},
		nil,
		nil,
	},
	toUpper: map[rune]rune{
		97:  65,
		98:  66,
		99:  67,
		100: 68,
		101: 69,
		102: 70,
		103: 71,
		104: 72,
		105: 73,
		106: 74,
		107: 75,
		108: 76,
		109: 77,
		110: 78,
		111: 79,
		112: 80,
		113: 81,
		114: 82,
		115: 83,
		116: 84,
		117: 85,
		118: 86,
		119: 87,
		120: 88,
		121: 89,
		122: 90,
		228: 196,
		229: 197,
		233: 201,
		246: 214,
		252: 220,
	},
	toLower: map[rune]rune{
		65:  97,
		66:  98,
		67:  99,
		68:  100,
		69:  101,
		70:  102,
		71:  103,
		72:  104,
		73:  105,
		74:  106,
		75:  107,
		76:  108,
		77:  109,
		78:  110,
		79:  111,
		80:  112,
		81:  113,
		82:  114,
		83:  115,
		84:  116,
		85:  117,
		86:  118,
		87:  119,
		88:  120,
		89:  121,
		90:  122,
		196: 228,
		197: 229,
		201: 233,
		214: 246,
		220: 252,
	},
}
