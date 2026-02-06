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

// Dec8_bin_RuneWeight returns the weight of a given rune based on its relational sort order from
// the `dec8_bin` collation.
func Dec8_bin_RuneWeight(r rune) int32 {
	weight, ok := dec8_bin_Weights[r]
	if ok {
		return weight
	} else if r >= 0 && r <= 163 {
		return r + 0
	} else {
		return 2147483647
	}
}

// dec8_bin_Weights contain a map from rune to weight for the `dec8_bin` collation. The
// map primarily contains mappings that have a random order. Mappings that fit into a sequential range (and are long
// enough) are defined in the calling function to save space.
var dec8_bin_Weights = map[rune]int32{
	165: 164,
	167: 165,
	164: 166,
	169: 167,
	170: 168,
	171: 169,
	176: 170,
	177: 171,
	178: 172,
	179: 173,
	181: 174,
	182: 175,
	183: 176,
	185: 177,
	186: 178,
	187: 179,
	188: 180,
	189: 181,
	191: 182,
	192: 183,
	193: 184,
	194: 185,
	195: 186,
	196: 187,
	197: 188,
	198: 189,
	199: 190,
	200: 191,
	201: 192,
	202: 193,
	203: 194,
	204: 195,
	205: 196,
	206: 197,
	207: 198,
	209: 199,
	210: 200,
	211: 201,
	212: 202,
	213: 203,
	214: 204,
	338: 205,
	216: 206,
	217: 207,
	218: 208,
	219: 209,
	220: 210,
	376: 211,
	223: 212,
	224: 213,
	225: 214,
	226: 215,
	227: 216,
	228: 217,
	229: 218,
	230: 219,
	231: 220,
	232: 221,
	233: 222,
	234: 223,
	235: 224,
	236: 225,
	237: 226,
	238: 227,
	239: 228,
	241: 229,
	242: 230,
	243: 231,
	244: 232,
	245: 233,
	246: 234,
	339: 235,
	248: 236,
	249: 237,
	250: 238,
	251: 239,
	252: 240,
	255: 241,
}
