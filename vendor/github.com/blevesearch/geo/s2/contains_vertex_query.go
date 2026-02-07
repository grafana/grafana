// Copyright 2017 Google Inc. All rights reserved.
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

package s2

// ContainsVertexQuery is used to track the edges entering and leaving the
// given vertex of a Polygon in order to be able to determine if the point is
// contained by the Polygon.
//
// Point containment is defined according to the semi-open boundary model
// which means that if several polygons tile the region around a vertex,
// then exactly one of those polygons contains that vertex.
type ContainsVertexQuery struct {
	target  Point
	edgeMap map[Point]int
}

// NewContainsVertexQuery returns a new query for the given vertex whose
// containment will be determined.
func NewContainsVertexQuery(target Point) *ContainsVertexQuery {
	return &ContainsVertexQuery{
		target:  target,
		edgeMap: make(map[Point]int),
	}
}

// AddEdge adds the edge between target and v with the given direction.
// (+1 = outgoing, -1 = incoming, 0 = degenerate).
func (q *ContainsVertexQuery) AddEdge(v Point, direction int) {
	q.edgeMap[v] += direction
}

// ContainsVertex reports a +1 if the target vertex is contained, -1 if it is
// not contained, and 0 if the incident edges consisted of matched sibling pairs.
func (q *ContainsVertexQuery) ContainsVertex() int {
	// Find the unmatched edge that is immediately clockwise from Ortho(P).
	refDir := q.target.referenceDir()

	bestPoint := refDir
	bestDir := 0

	for k, v := range q.edgeMap {
		if v == 0 {
			continue // This is a "matched" edge.
		}
		if OrderedCCW(refDir, bestPoint, k, q.target) {
			bestPoint = k
			bestDir = v
		}
	}
	return bestDir
}
