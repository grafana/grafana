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

// WedgeRel enumerates the possible relation between two wedges A and B.
type WedgeRel int

// Define the different possible relationships between two wedges.
//
// Given an edge chain (x0, x1, x2), the wedge at x1 is the region to the
// left of the edges. More precisely, it is the set of all rays from x1x0
// (inclusive) to x1x2 (exclusive) in the *clockwise* direction.
const (
	WedgeEquals              WedgeRel = iota // A and B are equal.
	WedgeProperlyContains                    // A is a strict superset of B.
	WedgeIsProperlyContained                 // A is a strict subset of B.
	WedgeProperlyOverlaps                    // A-B, B-A, and A intersect B are non-empty.
	WedgeIsDisjoint                          // A and B are disjoint.
)

// WedgeRelation reports the relation between two non-empty wedges
// A=(a0, ab1, a2) and B=(b0, ab1, b2).
func WedgeRelation(a0, ab1, a2, b0, b2 Point) WedgeRel {
	// There are 6 possible edge orderings at a shared vertex (all
	// of these orderings are circular, i.e. abcd == bcda):
	//
	//  (1) a2 b2 b0 a0: A contains B
	//  (2) a2 a0 b0 b2: B contains A
	//  (3) a2 a0 b2 b0: A and B are disjoint
	//  (4) a2 b0 a0 b2: A and B intersect in one wedge
	//  (5) a2 b2 a0 b0: A and B intersect in one wedge
	//  (6) a2 b0 b2 a0: A and B intersect in two wedges
	//
	// We do not distinguish between 4, 5, and 6.
	// We pay extra attention when some of the edges overlap.  When edges
	// overlap, several of these orderings can be satisfied, and we take
	// the most specific.
	if a0 == b0 && a2 == b2 {
		return WedgeEquals
	}

	// Cases 1, 2, 5, and 6
	if OrderedCCW(a0, a2, b2, ab1) {
		// The cases with this vertex ordering are 1, 5, and 6,
		if OrderedCCW(b2, b0, a0, ab1) {
			return WedgeProperlyContains
		}

		// We are in case 5 or 6, or case 2 if a2 == b2.
		if a2 == b2 {
			return WedgeIsProperlyContained
		}
		return WedgeProperlyOverlaps

	}
	// We are in case 2, 3, or 4.
	if OrderedCCW(a0, b0, b2, ab1) {
		return WedgeIsProperlyContained
	}

	if OrderedCCW(a0, b0, a2, ab1) {
		return WedgeIsDisjoint
	}
	return WedgeProperlyOverlaps
}

// WedgeContains reports whether non-empty wedge A=(a0, ab1, a2) contains B=(b0, ab1, b2).
// Equivalent to WedgeRelation == WedgeProperlyContains || WedgeEquals.
func WedgeContains(a0, ab1, a2, b0, b2 Point) bool {
	// For A to contain B (where each loop interior is defined to be its left
	// side), the CCW edge order around ab1 must be a2 b2 b0 a0.  We split
	// this test into two parts that test three vertices each.
	return OrderedCCW(a2, b2, b0, ab1) && OrderedCCW(b0, a0, a2, ab1)
}

// WedgeIntersects reports whether non-empty wedge A=(a0, ab1, a2) intersects B=(b0, ab1, b2).
// Equivalent but faster than WedgeRelation != WedgeIsDisjoint
func WedgeIntersects(a0, ab1, a2, b0, b2 Point) bool {
	// For A not to intersect B (where each loop interior is defined to be
	// its left side), the CCW edge order around ab1 must be a0 b2 b0 a2.
	// Note that it's important to write these conditions as negatives
	// (!OrderedCCW(a,b,c,o) rather than Ordered(c,b,a,o)) to get correct
	// results when two vertices are the same.
	return !OrderedCCW(a0, b2, b0, ab1) || !OrderedCCW(b0, a2, a0, ab1)
}
