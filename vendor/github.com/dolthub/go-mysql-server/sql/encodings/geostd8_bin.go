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

// Geostd8_bin_RuneWeight returns the weight of a given rune based on its relational sort order from
// the `geostd8_bin` collation.
func Geostd8_bin_RuneWeight(r rune) int32 {
	weight, ok := geostd8_bin_Weights[r]
	if ok {
		return weight
	} else if r >= 0 && r <= 127 {
		return r + 0
	} else {
		return 2147483647
	}
}

// geostd8_bin_Weights contain a map from rune to weight for the `geostd8_bin` collation. The
// map primarily contains mappings that have a random order. Mappings that fit into a sequential range (and are long
// enough) are defined in the calling function to save space.
var geostd8_bin_Weights = map[rune]int32{
	8364: 128,
	8218: 129,
	8222: 130,
	8230: 131,
	8224: 132,
	8225: 133,
	8240: 134,
	8249: 135,
	8216: 136,
	8217: 137,
	8220: 138,
	8221: 139,
	8226: 140,
	8211: 141,
	8212: 142,
	8250: 143,
	160:  144,
	161:  145,
	162:  146,
	163:  147,
	164:  148,
	165:  149,
	166:  150,
	167:  151,
	168:  152,
	169:  153,
	170:  154,
	171:  155,
	172:  156,
	173:  157,
	174:  158,
	175:  159,
	176:  160,
	177:  161,
	178:  162,
	179:  163,
	180:  164,
	181:  165,
	182:  166,
	183:  167,
	184:  168,
	185:  169,
	186:  170,
	187:  171,
	188:  172,
	189:  173,
	190:  174,
	191:  175,
	4304: 176,
	4305: 177,
	4306: 178,
	4307: 179,
	4308: 180,
	4309: 181,
	4310: 182,
	4337: 183,
	4311: 184,
	4312: 185,
	4313: 186,
	4314: 187,
	4315: 188,
	4316: 189,
	4338: 190,
	4317: 191,
	4318: 192,
	4319: 193,
	4320: 194,
	4321: 195,
	4322: 196,
	4339: 197,
	4323: 198,
	4324: 199,
	4325: 200,
	4326: 201,
	4327: 202,
	4328: 203,
	4329: 204,
	4330: 205,
	4331: 206,
	4332: 207,
	4333: 208,
	4334: 209,
	4340: 210,
	4335: 211,
	4336: 212,
	4341: 213,
	8470: 214,
}
