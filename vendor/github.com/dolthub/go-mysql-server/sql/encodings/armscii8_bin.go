// Copyright 2025 Dolthub, Inc.
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

// Armscii8_bin_RuneWeight returns the weight of a given rune based on its relational sort order from
// the `armscii8_bin` collation.
func Armscii8_bin_RuneWeight(r rune) int32 {
	weight, ok := armscii8_bin_Weights[r]
	if ok {
		return weight
	} else if r >= 0 && r <= 160 {
		return r + 0
	} else {
		return 2147483647
	}
}

// armscii8_bin_Weights contain a map from rune to weight for the `armscii8_bin` collation. The
// map primarily contains mappings that have a random order. Mappings that fit into a sequential range (and are long
// enough) are defined in the calling function to save space.
var armscii8_bin_Weights = map[rune]int32{
	10049: 161,
	167:   162,
	1417:  163,
	187:   164,
	171:   165,
	8212:  166,
	1373:  167,
	1375:  168,
	8230:  169,
	1372:  170,
	1371:  171,
	1374:  172,
	1329:  173,
	1377:  174,
	1330:  175,
	1378:  176,
	1331:  177,
	1379:  178,
	1332:  179,
	1380:  180,
	1333:  181,
	1381:  182,
	1334:  183,
	1382:  184,
	1335:  185,
	1383:  186,
	1336:  187,
	1384:  188,
	1337:  189,
	1385:  190,
	1338:  191,
	1386:  192,
	1339:  193,
	1387:  194,
	1340:  195,
	1388:  196,
	1341:  197,
	1389:  198,
	1342:  199,
	1390:  200,
	1343:  201,
	1391:  202,
	1344:  203,
	1392:  204,
	1345:  205,
	1393:  206,
	1346:  207,
	1394:  208,
	1347:  209,
	1395:  210,
	1348:  211,
	1396:  212,
	1349:  213,
	1397:  214,
	1350:  215,
	1398:  216,
	1351:  217,
	1399:  218,
	1352:  219,
	1400:  220,
	1353:  221,
	1401:  222,
	1354:  223,
	1402:  224,
	1355:  225,
	1403:  226,
	1356:  227,
	1404:  228,
	1357:  229,
	1405:  230,
	1358:  231,
	1406:  232,
	1359:  233,
	1407:  234,
	1360:  235,
	1408:  236,
	1361:  237,
	1409:  238,
	1362:  239,
	1410:  240,
	1363:  241,
	1411:  242,
	1364:  243,
	1412:  244,
	1365:  245,
	1413:  246,
	1366:  247,
	1414:  248,
	8217:  249,
}
