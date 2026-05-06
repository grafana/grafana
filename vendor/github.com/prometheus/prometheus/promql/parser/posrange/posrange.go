// Copyright 2023 The Prometheus Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// posrange is used to report a position in query strings for error
// and warning messages.
package posrange

import "fmt"

// Pos is the position in a string.
// Negative numbers indicate undefined positions.
type Pos int

// PositionRange describes a position in the input string of the parser.
type PositionRange struct {
	Start Pos
	End   Pos
}

// StartPosInput uses the query string to convert the PositionRange into a
// line:col string, indicating when this is not possible if the query is empty
// or the position is invalid. When this is used to convert ParseErr to a string,
// lineOffset is an additional line offset to be added, and is only used inside
// unit tests.
func (p PositionRange) StartPosInput(query string, lineOffset int) string {
	if query == "" {
		return "unknown position"
	}
	pos := int(p.Start)
	if pos < 0 || pos > len(query) {
		return "invalid position"
	}

	lastLineBreak := -1
	line := lineOffset + 1
	for i, c := range query[:pos] {
		if c == '\n' {
			lastLineBreak = i
			line++
		}
	}
	col := pos - lastLineBreak
	return fmt.Sprintf("%d:%d", line, col)
}
