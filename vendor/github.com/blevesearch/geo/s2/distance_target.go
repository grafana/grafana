// Copyright 2019 Google Inc. All rights reserved.
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

import (
	"github.com/blevesearch/geo/s1"
)

// The distance interface represents a set of common methods used by algorithms
// that compute distances between various S2 types.
type distance interface {
	// chordAngle returns this type as a ChordAngle.
	chordAngle() s1.ChordAngle

	// fromChordAngle is used to type convert a ChordAngle to this type.
	// This is to work around needing to be clever in parts of the code
	// where a distanceTarget interface method expects distances, but the
	// user only supplies a ChordAngle, and we need to dynamically cast it
	// to an appropriate distance interface types.
	fromChordAngle(o s1.ChordAngle) distance

	// zero returns a zero distance.
	zero() distance
	// negative returns a value smaller than any valid value.
	negative() distance
	// infinity returns a value larger than any valid value.
	infinity() distance

	// less is similar to the Less method in Sort. To get minimum values,
	// this would be a less than type operation. For maximum, this would
	// be a greater than type operation.
	less(other distance) bool

	// sub subtracts the other value from this one and returns the new value.
	// This is done as a method and not simple mathematical operation to
	// allow closest and furthest to implement this in opposite ways.
	sub(other distance) distance

	// chordAngleBound reports the upper bound on a ChordAngle corresponding
	// to this distance. For example, if distance measures WGS84 ellipsoid
	// distance then the corresponding angle needs to be 0.56% larger.
	chordAngleBound() s1.ChordAngle

	// updateDistance may update the value this distance represents
	// based on the given input. The updated value and a boolean reporting
	// if the value was changed are returned.
	updateDistance(other distance) (distance, bool)
}

// distanceTarget is an interface that represents a geometric type to which distances
// are measured.
//
// For example, there are implementations that measure distances to a Point,
// an Edge, a Cell, a CellUnion, and even to an arbitrary collection of geometry
// stored in ShapeIndex.
//
// The distanceTarget types are provided for the benefit of types that measure
// distances and/or find nearby geometry, such as ClosestEdgeQuery, FurthestEdgeQuery,
// ClosestPointQuery, and ClosestCellQuery, etc.
type distanceTarget interface {
	// capBound returns a Cap that bounds the set of points whose distance to the
	// target is distance.zero().
	capBound() Cap

	// updateDistanceToPoint updates the distance if the distance to
	// the point P is within than the given dist.
	// The boolean reports if the value was updated.
	updateDistanceToPoint(p Point, dist distance) (distance, bool)

	// updateDistanceToEdge updates the distance if the distance to
	// the edge E is within than the given dist.
	// The boolean reports if the value was updated.
	updateDistanceToEdge(e Edge, dist distance) (distance, bool)

	// updateDistanceToCell updates the distance if the distance to the cell C
	// (including its interior) is within than the given dist.
	// The boolean reports if the value was updated.
	updateDistanceToCell(c Cell, dist distance) (distance, bool)

	// setMaxError potentially updates the value of MaxError, and reports if
	// the specific type supports altering it. Whenever one of the
	// updateDistanceTo... methods above returns true, the returned distance
	// is allowed to be up to maxError larger than the true minimum distance.
	// In other words, it gives this target object permission to terminate its
	// distance calculation as soon as it has determined that (1) the minimum
	// distance is less than minDist and (2) the best possible further
	// improvement is less than maxError.
	//
	// If the target takes advantage of maxError to optimize its distance
	// calculation, this method must return true. (Most target types will
	// default to return false.)
	setMaxError(maxErr s1.ChordAngle) bool

	// maxBruteForceIndexSize reports the maximum number of indexed objects for
	// which it is faster to compute the distance by brute force (e.g., by testing
	// every edge) rather than by using an index.
	//
	// The following method is provided as a convenience for types that compute
	// distances to a collection of indexed geometry, such as ClosestEdgeQuery
	// and ClosestPointQuery.
	//
	// Types that do not support this should return a -1.
	maxBruteForceIndexSize() int

	// distance returns an instance of the underlying distance type this
	// target uses. This is to work around the use of Templates in the C++.
	distance() distance

	// visitContainingShapes finds all polygons in the given index that
	// completely contain a connected component of the target geometry. (For
	// example, if the target consists of 10 points, this method finds
	// polygons that contain any of those 10 points.) For each such polygon,
	// the visit function is called with the Shape of the polygon along with
	// a point of the target geometry that is contained by that polygon.
	//
	// Optionally, any polygon that intersects the target geometry may also be
	// returned.  In other words, this method returns all polygons that
	// contain any connected component of the target, along with an arbitrary
	// subset of the polygons that intersect the target.
	//
	// For example, suppose that the index contains two abutting polygons
	// A and B. If the target consists of two points "a" contained by A and
	// "b" contained by B, then both A and B are returned. But if the target
	// consists of the edge "ab", then any subset of {A, B} could be returned
	// (because both polygons intersect the target but neither one contains
	// the edge "ab").
	//
	// If the visit function returns false, this method terminates early and
	// returns false as well. Otherwise returns true.
	//
	// NOTE(roberts): This method exists only for the purpose of implementing
	// edgeQuery IncludeInteriors efficiently.
	visitContainingShapes(index *ShapeIndex, v shapePointVisitorFunc) bool
}

// shapePointVisitorFunc defines a type of function the visitContainingShapes can call.
type shapePointVisitorFunc func(containingShape Shape, targetPoint Point) bool
