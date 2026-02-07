// Copyright 2014 Google Inc. All rights reserved.
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

// A Region represents a two-dimensional region on the unit sphere.
//
// The purpose of this interface is to allow complex regions to be
// approximated as simpler regions. The interface is restricted to methods
// that are useful for computing approximations.
type Region interface {
	// CapBound returns a bounding spherical cap. This is not guaranteed to be exact.
	CapBound() Cap

	// RectBound returns a bounding latitude-longitude rectangle that contains
	// the region. The bounds are not guaranteed to be tight.
	RectBound() Rect

	// ContainsCell reports whether the region completely contains the given region.
	// It returns false if containment could not be determined.
	ContainsCell(c Cell) bool

	// IntersectsCell reports whether the region intersects the given cell or
	// if intersection could not be determined. It returns false if the region
	// does not intersect.
	IntersectsCell(c Cell) bool

	// ContainsPoint reports whether the region contains the given point or not.
	// The point should be unit length, although some implementations may relax
	// this restriction.
	ContainsPoint(p Point) bool

	// CellUnionBound returns a small collection of CellIDs whose union covers
	// the region. The cells are not sorted, may have redundancies (such as cells
	// that contain other cells), and may cover much more area than necessary.
	//
	// This method is not intended for direct use by client code. Clients
	// should typically use Covering, which has options to control the size and
	// accuracy of the covering. Alternatively, if you want a fast covering and
	// don't care about accuracy, consider calling FastCovering (which returns a
	// cleaned-up version of the covering computed by this method).
	//
	// CellUnionBound implementations should attempt to return a small
	// covering (ideally 4 cells or fewer) that covers the region and can be
	// computed quickly. The result is used by RegionCoverer as a starting
	// point for further refinement.
	CellUnionBound() []CellID
}

// Enforce Region interface satisfaction.
var (
	_ Region = Cap{}
	_ Region = Cell{}
	_ Region = (*CellUnion)(nil)
	_ Region = (*Loop)(nil)
	_ Region = Point{}
	_ Region = (*Polygon)(nil)
	_ Region = (*Polyline)(nil)
	_ Region = Rect{}
)
