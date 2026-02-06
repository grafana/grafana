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

// Latin1_bin_RuneWeight returns the weight of a given rune based on its relational sort order from
// the `latin1_bin` collation.
func Latin1_bin_RuneWeight(r rune) int32 {
	weight, ok := latin1_bin_Weights[r]
	if ok {
		return weight
	} else if r >= 0 && r <= 127 {
		return r + 0
	} else {
		return 2147483647
	}
}

// latin1_bin_Weights contain a map from rune to weight for the `latin1_bin` collation. The
// map primarily contains mappings that have a random order. Mappings that fit into a sequential range (and are long
// enough) are defined in the calling function to save space.
var latin1_bin_Weights = map[rune]int32{
	8364: 128,
	129:  129,
	8218: 130,
	402:  131,
	8222: 132,
	8230: 133,
	8224: 134,
	8225: 135,
	710:  136,
	8240: 137,
	352:  138,
	8249: 139,
	338:  140,
	141:  141,
	381:  142,
	143:  143,
	144:  144,
	8216: 145,
	8217: 146,
	8220: 147,
	8221: 148,
	8226: 149,
	8211: 150,
	8212: 151,
	732:  152,
	8482: 153,
	353:  154,
	8250: 155,
	339:  156,
	157:  157,
	382:  158,
	376:  159,
	160:  160,
	161:  161,
	162:  162,
	163:  163,
	164:  164,
	165:  165,
	166:  166,
	167:  167,
	168:  168,
	169:  169,
	170:  170,
	171:  171,
	172:  172,
	173:  173,
	174:  174,
	175:  175,
	176:  176,
	177:  177,
	178:  178,
	179:  179,
	180:  180,
	181:  181,
	182:  182,
	183:  183,
	184:  184,
	185:  185,
	186:  186,
	187:  187,
	188:  188,
	189:  189,
	190:  190,
	191:  191,
	192:  192,
	193:  193,
	194:  194,
	195:  195,
	196:  196,
	197:  197,
	198:  198,
	199:  199,
	200:  200,
	201:  201,
	202:  202,
	203:  203,
	204:  204,
	205:  205,
	206:  206,
	207:  207,
	208:  208,
	209:  209,
	210:  210,
	211:  211,
	212:  212,
	213:  213,
	214:  214,
	215:  215,
	216:  216,
	217:  217,
	218:  218,
	219:  219,
	220:  220,
	221:  221,
	222:  222,
	223:  223,
	224:  224,
	225:  225,
	226:  226,
	227:  227,
	228:  228,
	229:  229,
	230:  230,
	231:  231,
	232:  232,
	233:  233,
	234:  234,
	235:  235,
	236:  236,
	237:  237,
	238:  238,
	239:  239,
	240:  240,
	241:  241,
	242:  242,
	243:  243,
	244:  244,
	245:  245,
	246:  246,
	247:  247,
	248:  248,
	249:  249,
	250:  250,
	251:  251,
	252:  252,
	253:  253,
	254:  254,
	255:  255,
}
