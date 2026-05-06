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

// Swe7_swedish_ci_RuneWeight returns the weight of a given rune based on its relational sort order from
// the `swe7_swedish_ci` collation.
func Swe7_swedish_ci_RuneWeight(r rune) int32 {
	weight, ok := swe7_swedish_ci_Weights[r]
	if ok {
		return weight
	} else {
		return 2147483647
	}
}

// swe7_swedish_ci_Weights contain a map from rune to weight for the `swe7_swedish_ci` collation. The
// map primarily contains mappings that have a random order. Mappings that fit into a sequential range (and are long
// enough) are defined in the calling function to save space.
var swe7_swedish_ci_Weights = map[rune]int32{
	0:   0,
	1:   1,
	2:   2,
	3:   3,
	4:   4,
	5:   5,
	6:   6,
	7:   7,
	8:   8,
	9:   9,
	10:  10,
	11:  11,
	12:  12,
	13:  13,
	14:  14,
	15:  15,
	16:  16,
	17:  17,
	18:  18,
	19:  19,
	20:  20,
	21:  21,
	22:  22,
	23:  23,
	24:  24,
	25:  25,
	26:  26,
	27:  27,
	28:  28,
	29:  29,
	30:  30,
	31:  31,
	32:  32,
	33:  33,
	34:  34,
	35:  35,
	36:  36,
	37:  37,
	38:  38,
	39:  39,
	40:  40,
	41:  41,
	42:  42,
	43:  43,
	44:  44,
	45:  45,
	46:  46,
	47:  47,
	48:  48,
	49:  49,
	50:  50,
	51:  51,
	52:  52,
	53:  53,
	54:  54,
	55:  55,
	56:  56,
	57:  57,
	58:  58,
	59:  59,
	60:  60,
	61:  61,
	62:  62,
	63:  63,
	65:  64,
	97:  64,
	66:  65,
	98:  65,
	67:  66,
	99:  66,
	68:  67,
	100: 67,
	69:  68,
	101: 68,
	201: 68,
	233: 68,
	70:  69,
	102: 69,
	71:  70,
	103: 70,
	72:  71,
	104: 71,
	73:  72,
	105: 72,
	74:  73,
	106: 73,
	75:  74,
	107: 74,
	76:  75,
	108: 75,
	77:  76,
	109: 76,
	78:  77,
	110: 77,
	79:  78,
	111: 78,
	80:  79,
	112: 79,
	81:  80,
	113: 80,
	82:  81,
	114: 81,
	83:  82,
	115: 82,
	84:  83,
	116: 83,
	85:  84,
	117: 84,
	86:  85,
	118: 85,
	87:  86,
	119: 86,
	88:  87,
	120: 87,
	89:  88,
	121: 88,
	220: 88,
	252: 88,
	90:  89,
	122: 89,
	197: 90,
	229: 90,
	196: 91,
	228: 91,
	214: 92,
	246: 92,
	95:  93,
}
