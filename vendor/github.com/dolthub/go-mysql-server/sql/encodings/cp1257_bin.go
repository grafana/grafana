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

// Cp1257_bin_RuneWeight returns the weight of a given rune based on its relational sort order from
// the `cp1257_bin` collation.
func Cp1257_bin_RuneWeight(r rune) int32 {
	weight, ok := cp1257_bin_Weights[r]
	if ok {
		return weight
	} else if r >= 0 && r <= 127 {
		return r + 0
	} else {
		return 2147483647
	}
}

// cp1257_bin_Weights contain a map from rune to weight for the `cp1257_bin` collation. The
// map primarily contains mappings that have a random order. Mappings that fit into a sequential range (and are long
// enough) are defined in the calling function to save space.
var cp1257_bin_Weights = map[rune]int32{
	8364: 128,
	8218: 129,
	8222: 130,
	8230: 131,
	8224: 132,
	8225: 133,
	8240: 134,
	8249: 135,
	168:  136,
	711:  137,
	184:  138,
	8216: 139,
	8217: 140,
	8220: 141,
	8221: 142,
	8226: 143,
	8211: 144,
	8212: 145,
	8482: 146,
	8250: 147,
	175:  148,
	731:  149,
	160:  150,
	162:  151,
	163:  152,
	164:  153,
	166:  154,
	167:  155,
	216:  156,
	169:  157,
	342:  158,
	171:  159,
	172:  160,
	173:  161,
	174:  162,
	198:  163,
	176:  164,
	177:  165,
	178:  166,
	179:  167,
	180:  168,
	181:  169,
	182:  170,
	183:  171,
	248:  172,
	185:  173,
	343:  174,
	187:  175,
	188:  176,
	189:  177,
	190:  178,
	230:  179,
	260:  180,
	302:  181,
	256:  182,
	262:  183,
	196:  184,
	197:  185,
	280:  186,
	274:  187,
	268:  188,
	201:  189,
	377:  190,
	278:  191,
	290:  192,
	310:  193,
	298:  194,
	315:  195,
	352:  196,
	323:  197,
	325:  198,
	211:  199,
	332:  200,
	213:  201,
	214:  202,
	215:  203,
	370:  204,
	321:  205,
	346:  206,
	362:  207,
	220:  208,
	379:  209,
	381:  210,
	223:  211,
	261:  212,
	303:  213,
	257:  214,
	263:  215,
	228:  216,
	229:  217,
	281:  218,
	275:  219,
	269:  220,
	233:  221,
	378:  222,
	279:  223,
	291:  224,
	311:  225,
	299:  226,
	316:  227,
	353:  228,
	324:  229,
	326:  230,
	243:  231,
	333:  232,
	245:  233,
	246:  234,
	247:  235,
	371:  236,
	322:  237,
	347:  238,
	363:  239,
	252:  240,
	380:  241,
	382:  242,
	729:  243,
}
