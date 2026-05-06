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
	"math"

	"github.com/golang/geo/s1"
)

const maxQueryResults = math.MaxInt32

// queryOptions represents the set of all configurable parameters used by all of
// the Query types. Most of these fields have non-zero defaults, so initialization
// is handled within each Query type. All of the exported methods accept user
// supplied sets of options to set or adjust as necessary.
//
// Several of the defaults depend on the distance interface type being used
// (e.g. minDistance, maxDistance, etc.)
//
// If a user sets an option value that a given query type doesn't use, it is ignored.
type queryOptions struct {
	// maxResults specifies that at most MaxResults edges should be returned.
	// This must be at least 1.
	//
	// The default value is to return all results.
	maxResults int

	// distanceLimit specifies that only edges whose distance to the target is
	// within this distance should be returned.
	//
	// Note that edges whose distance is exactly equal to this are
	// not returned. In most cases this doesn't matter (since distances are
	// not computed exactly in the first place), but if such edges are needed
	// then you can retrieve them by specifying the distance as the next
	// largest representable distance. i.e. distanceLimit.Successor().
	//
	// The default value is the infinity value, such that all results will be
	// returned.
	distanceLimit s1.ChordAngle

	// maxError specifies that edges up to MaxError further away than the true
	// closest edges may be substituted in the result set, as long as such
	// edges satisfy all the remaining search criteria (such as DistanceLimit).
	// This option only has an effect if MaxResults is also specified;
	// otherwise all edges closer than MaxDistance will always be returned.
	//
	// Note that this does not affect how the distance between edges is
	// computed; it simply gives the algorithm permission to stop the search
	// early as soon as the best possible improvement drops below MaxError.
	//
	// This can be used to implement distance predicates efficiently. For
	// example, to determine whether the minimum distance is less than D, set
	// MaxResults == 1 and MaxDistance == MaxError == D. This causes
	// the algorithm to terminate as soon as it finds any edge whose distance
	// is less than D, rather than continuing to search for an edge that is
	// even closer.
	//
	// The default value is zero.
	maxError s1.ChordAngle

	// includeInteriors specifies that polygon interiors should be included
	// when measuring distances. In other words, polygons that contain the target
	// should have a distance of zero. (For targets consisting of multiple connected
	// components, the distance is zero if any component is contained.) This
	// is indicated in the results by returning a (ShapeID, EdgeID) pair
	// with EdgeID == -1, i.e. this value denotes the polygons's interior.
	//
	// Note that for efficiency, any polygon that intersects the target may or
	// may not have an EdgeID == -1 result. Such results are optional
	// because in that case the distance to the polygon is already zero.
	//
	// The default value is true.
	includeInteriors bool

	// specifies that distances should be computed by examining every edge
	// rather than using the ShapeIndex.
	//
	// TODO(roberts): When optimized is implemented, update the default to false.
	// The default value is true.
	useBruteForce bool

	// region specifies that results must intersect the given Region.
	//
	// Note that if you want to set the region to a disc around a target
	// point, it is faster to use a PointTarget with distanceLimit set
	// instead. You can also set a distance limit and also require that results
	// lie within a given rectangle.
	//
	// The default is nil (no region limits).
	region Region
}

// UseBruteForce sets or disables the use of brute force in a query.
func (q *queryOptions) UseBruteForce(x bool) *queryOptions {
	q.useBruteForce = x
	return q
}

// IncludeInteriors specifies whether polygon interiors should be
// included when measuring distances.
func (q *queryOptions) IncludeInteriors(x bool) *queryOptions {
	q.includeInteriors = x
	return q
}

// MaxError specifies that edges up to dist away than the true
// matching edges may be substituted in the result set, as long as such
// edges satisfy all the remaining search criteria (such as DistanceLimit).
// This option only has an effect if MaxResults is also specified;
// otherwise all edges closer than MaxDistance will always be returned.
func (q *queryOptions) MaxError(x s1.ChordAngle) *queryOptions {
	q.maxError = x
	return q
}

// MaxResults specifies that at most MaxResults edges should be returned.
// This must be at least 1.
func (q *queryOptions) MaxResults(x int) *queryOptions {
	// TODO(roberts): What should be done if the value is <= 0?
	q.maxResults = int(x)
	return q
}

// DistanceLimit specifies that only edges whose distance to the target is
// within, this distance should be returned. Edges whose distance is equal
// are not returned.
//
// To include values that are equal, specify the limit with the next largest
// representable distance such as limit.Successor(), or set the option with
// Furthest/ClosestInclusiveDistanceLimit.
func (q *queryOptions) DistanceLimit(x s1.ChordAngle) *queryOptions {
	q.distanceLimit = x
	return q
}

// ClosestInclusiveDistanceLimit sets the distance limit such that results whose
// distance is exactly equal to the limit are also returned.
func (q *queryOptions) ClosestInclusiveDistanceLimit(limit s1.ChordAngle) *queryOptions {
	q.distanceLimit = limit.Successor()
	return q
}

// FurthestInclusiveDistanceLimit sets the distance limit such that results whose
// distance is exactly equal to the limit are also returned.
func (q *queryOptions) FurthestInclusiveDistanceLimit(limit s1.ChordAngle) *queryOptions {
	q.distanceLimit = limit.Predecessor()
	return q
}

// ClosestConservativeDistanceLimit sets the distance limit such that results
// also incorporates the error in distance calculations. This ensures that all
// edges whose true distance is less than or equal to limit will be returned
// (along with some edges whose true distance is slightly greater).
//
// Algorithms that need to do exact distance comparisons can use this
// option to find a set of candidate edges that can then be filtered
// further (e.g., using CompareDistance).
func (q *queryOptions) ClosestConservativeDistanceLimit(limit s1.ChordAngle) *queryOptions {
	q.distanceLimit = limit.Expanded(minUpdateDistanceMaxError(limit))
	return q
}

// FurthestConservativeDistanceLimit sets the distance limit such that results
// also incorporates the error in distance calculations. This ensures that all
// edges whose true distance is greater than or equal to limit will be returned
// (along with some edges whose true distance is slightly less).
func (q *queryOptions) FurthestConservativeDistanceLimit(limit s1.ChordAngle) *queryOptions {
	q.distanceLimit = limit.Expanded(-minUpdateDistanceMaxError(limit))
	return q
}

// newQueryOptions returns a set of options using the given distance type
// with the proper default values.
func newQueryOptions(d distance) *queryOptions {
	return &queryOptions{
		maxResults:       maxQueryResults,
		distanceLimit:    d.infinity().chordAngle(),
		maxError:         0,
		includeInteriors: true,
		useBruteForce:    false,
		region:           nil,
	}
}
