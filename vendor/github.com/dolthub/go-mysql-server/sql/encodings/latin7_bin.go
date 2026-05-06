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

// Latin7_bin_RuneWeight returns the weight of a given rune based on its relational sort order from
// the `latin7_bin` collation.
func Latin7_bin_RuneWeight(r rune) int32 {
	weight, ok := latin7_bin_Weights[r]
	if ok {
		return weight
	} else if r >= 0 && r <= 160 {
		return r + 0
	} else {
		return 2147483647
	}
}

// latin7_bin_Weights contain a map from rune to weight for the `latin7_bin` collation. The
// map primarily contains mappings that have a random order. Mappings that fit into a sequential range (and are long
// enough) are defined in the calling function to save space.
var latin7_bin_Weights = map[rune]int32{
	8221: 161,
	162:  162,
	163:  163,
	164:  164,
	8222: 165,
	166:  166,
	167:  167,
	216:  168,
	169:  169,
	342:  170,
	171:  171,
	172:  172,
	173:  173,
	174:  174,
	198:  175,
	176:  176,
	177:  177,
	178:  178,
	179:  179,
	8220: 180,
	181:  181,
	182:  182,
	183:  183,
	248:  184,
	185:  185,
	343:  186,
	187:  187,
	188:  188,
	189:  189,
	190:  190,
	230:  191,
	260:  192,
	302:  193,
	256:  194,
	262:  195,
	196:  196,
	197:  197,
	280:  198,
	274:  199,
	268:  200,
	201:  201,
	377:  202,
	278:  203,
	290:  204,
	310:  205,
	298:  206,
	315:  207,
	352:  208,
	323:  209,
	325:  210,
	211:  211,
	332:  212,
	213:  213,
	214:  214,
	215:  215,
	370:  216,
	321:  217,
	346:  218,
	362:  219,
	220:  220,
	379:  221,
	381:  222,
	223:  223,
	261:  224,
	303:  225,
	257:  226,
	263:  227,
	228:  228,
	229:  229,
	281:  230,
	275:  231,
	269:  232,
	233:  233,
	378:  234,
	279:  235,
	291:  236,
	311:  237,
	299:  238,
	316:  239,
	353:  240,
	324:  241,
	326:  242,
	243:  243,
	333:  244,
	245:  245,
	246:  246,
	247:  247,
	371:  248,
	322:  249,
	347:  250,
	363:  251,
	252:  252,
	380:  253,
	382:  254,
	8217: 255,
}
