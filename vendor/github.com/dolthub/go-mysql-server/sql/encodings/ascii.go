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

// Ascii represents the `ascii` character set encoding.
var Ascii Encoder = &RangeMap{
	inputEntries: [][]rangeMapEntry{
		{
			{
				inputRange:  rangeBounds{{0, 127}},
				outputRange: rangeBounds{{0, 127}},
				inputMults:  []int{1},
				outputMults: []int{1},
			},
		},
		nil,
		nil,
		nil,
	},
	outputEntries: [][]rangeMapEntry{
		{
			{
				inputRange:  rangeBounds{{0, 127}},
				outputRange: rangeBounds{{0, 127}},
				inputMults:  []int{1},
				outputMults: []int{1},
			},
		},
		nil,
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
	},
	toLower: map[rune]rune{
		65: 97,
		66: 98,
		67: 99,
		68: 100,
		69: 101,
		70: 102,
		71: 103,
		72: 104,
		73: 105,
		74: 106,
		75: 107,
		76: 108,
		77: 109,
		78: 110,
		79: 111,
		80: 112,
		81: 113,
		82: 114,
		83: 115,
		84: 116,
		85: 117,
		86: 118,
		87: 119,
		88: 120,
		89: 121,
		90: 122,
	},
}
