// Copyright 2020-2021 Dolthub, Inc.
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

package similartext

import (
	"fmt"
	"reflect"
	"strings"
)

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// DistanceForStrings returns the edit distance between source and target.
// It has a runtime proportional to len(source) * len(target) and memory use
// proportional to len(target).
// Taken (simplified, for strings and with default options) from:
// https://github.com/texttheater/golang-levenshtein
func distanceForStrings(source, target string) int {
	height := len(source) + 1
	width := len(target) + 1
	matrix := make([][]int, 2)

	for i := 0; i < 2; i++ {
		matrix[i] = make([]int, width)
		matrix[i][0] = i
	}
	for j := 1; j < width; j++ {
		matrix[0][j] = j
	}

	for i := 1; i < height; i++ {
		cur := matrix[i%2]
		prev := matrix[(i-1)%2]
		cur[0] = i
		for j := 1; j < width; j++ {
			delCost := prev[j] + 1
			matchSubCost := prev[j-1]
			if source[i-1] != target[j-1] {
				matchSubCost += 2
			}
			insCost := cur[j-1] + 1
			cur[j] = min(delCost, min(matchSubCost, insCost))
		}
	}
	return matrix[(height-1)%2][width-1]
}

// MaxDistanceIgnored is the maximum Levenshtein distance from which
// we won't consider a string similar at all and thus will be ignored.
var DistanceSkipped = 3

// Find returns a string with suggestions for name(s) in `names`
// similar to the string `src` until a max distance of `DistanceSkipped`.
func Find(names []string, src string) string {
	if len(src) == 0 {
		return ""
	}

	minDistance := -1
	matchMap := make(map[int][]string)

	for _, name := range names {
		dist := distanceForStrings(name, src)
		if dist >= DistanceSkipped {
			continue
		}

		if minDistance == -1 || dist < minDistance {
			minDistance = dist
		}

		matchMap[dist] = append(matchMap[dist], name)
	}

	if len(matchMap) == 0 {
		return ""
	}

	return fmt.Sprintf(", maybe you mean %s?",
		strings.Join(matchMap[minDistance], " or "))
}

// FindFromMap does the same as Find but taking a map instead
// of a string array as first argument.
func FindFromMap(names interface{}, src string) string {
	rnames := reflect.ValueOf(names)
	if rnames.Kind() != reflect.Map {
		panic("Implementation error: non map used as first argument " +
			"to FindFromMap")
	}

	t := rnames.Type()
	if t.Key().Kind() != reflect.String {
		panic("Implementation error: non string key for map used as " +
			"first argument to FindFromMap")
	}

	var namesList []string
	for _, kv := range rnames.MapKeys() {
		namesList = append(namesList, kv.String())
	}

	return Find(namesList, src)
}
