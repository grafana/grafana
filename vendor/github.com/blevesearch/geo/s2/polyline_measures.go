// Copyright 2018 Google Inc. All rights reserved.
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

// This file defines various measures for polylines on the sphere. These are
// low-level methods that work directly with arrays of Points. They are used to
// implement the methods in various other measures files.

import (
	"github.com/golang/geo/r3"
	"github.com/golang/geo/s1"
)

// polylineLength returns the length of the given Polyline.
// It returns 0 for polylines with fewer than two vertices.
func polylineLength(p []Point) s1.Angle {
	var length s1.Angle

	for i := 1; i < len(p); i++ {
		length += p[i-1].Distance(p[i])
	}
	return length
}

// polylineCentroid returns the true centroid of the polyline multiplied by the
// length of the polyline. The result is not unit length, so you may wish to
// normalize it.
//
// Scaling by the Polyline length makes it easy to compute the centroid
// of several Polylines (by simply adding up their centroids).
//
// Note that for degenerate Polylines (e.g., AA) this returns Point(0, 0, 0).
// (This answer is correct; the result of this function is a line integral over
// the polyline, whose value is always zero if the polyline is degenerate.)
func polylineCentroid(p []Point) Point {
	var centroid r3.Vector
	for i := 1; i < len(p); i++ {
		centroid = centroid.Add(EdgeTrueCentroid(p[i-1], p[i]).Vector)
	}
	return Point{centroid}
}
