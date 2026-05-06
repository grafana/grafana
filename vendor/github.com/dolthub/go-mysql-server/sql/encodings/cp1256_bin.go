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

// Cp1256_bin_RuneWeight returns the weight of a given rune based on its relational sort order from
// the `cp1256_bin` collation.
func Cp1256_bin_RuneWeight(r rune) int32 {
	weight, ok := cp1256_bin_Weights[r]
	if ok {
		return weight
	} else if r >= 0 && r <= 127 {
		return r + 0
	} else {
		return 2147483647
	}
}

// cp1256_bin_Weights contain a map from rune to weight for the `cp1256_bin` collation. The
// map primarily contains mappings that have a random order. Mappings that fit into a sequential range (and are long
// enough) are defined in the calling function to save space.
var cp1256_bin_Weights = map[rune]int32{
	8364: 128,
	1662: 129,
	8218: 130,
	402:  131,
	8222: 132,
	8230: 133,
	8224: 134,
	8225: 135,
	710:  136,
	8240: 137,
	8249: 138,
	338:  139,
	1670: 140,
	1688: 141,
	1711: 142,
	8216: 143,
	8217: 144,
	8220: 145,
	8221: 146,
	8226: 147,
	8211: 148,
	8212: 149,
	8482: 150,
	8250: 151,
	339:  152,
	8204: 153,
	8205: 154,
	160:  155,
	1548: 156,
	162:  157,
	163:  158,
	164:  159,
	165:  160,
	166:  161,
	167:  162,
	168:  163,
	169:  164,
	171:  165,
	172:  166,
	173:  167,
	174:  168,
	175:  169,
	176:  170,
	177:  171,
	178:  172,
	179:  173,
	180:  174,
	181:  175,
	182:  176,
	183:  177,
	184:  178,
	185:  179,
	1563: 180,
	187:  181,
	188:  182,
	189:  183,
	190:  184,
	1567: 185,
	1569: 186,
	1570: 187,
	1571: 188,
	1572: 189,
	1573: 190,
	1574: 191,
	1575: 192,
	1576: 193,
	1577: 194,
	1578: 195,
	1579: 196,
	1580: 197,
	1581: 198,
	1582: 199,
	1583: 200,
	1584: 201,
	1585: 202,
	1586: 203,
	1587: 204,
	1588: 205,
	1589: 206,
	1590: 207,
	215:  208,
	1591: 209,
	1592: 210,
	1593: 211,
	1594: 212,
	1600: 213,
	1601: 214,
	1602: 215,
	1603: 216,
	224:  217,
	1604: 218,
	226:  219,
	1605: 220,
	1606: 221,
	1607: 222,
	1608: 223,
	231:  224,
	232:  225,
	233:  226,
	234:  227,
	235:  228,
	1609: 229,
	1610: 230,
	238:  231,
	239:  232,
	1611: 233,
	1612: 234,
	1613: 235,
	1614: 236,
	244:  237,
	1615: 238,
	1616: 239,
	247:  240,
	1617: 241,
	249:  242,
	1618: 243,
	251:  244,
	252:  245,
	8206: 246,
	8207: 247,
}
