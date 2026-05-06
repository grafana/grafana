// Copyright 2020 Google Inc. All rights reserved.
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

// A RegionUnion represents a union of possibly overlapping regions.
// It is convenient for computing a covering of a set of regions.
type RegionUnion []Region

// CapBound returns a bounding cap for this RegionUnion.
func (ru RegionUnion) CapBound() Cap { return ru.RectBound().CapBound() }

// RectBound returns a bounding latitude-longitude rectangle for this RegionUnion.
func (ru RegionUnion) RectBound() Rect {
	ret := EmptyRect()
	for _, reg := range ru {
		ret = ret.Union(reg.RectBound())
	}
	return ret
}

// ContainsCell reports whether the given Cell is contained by this RegionUnion.
func (ru RegionUnion) ContainsCell(c Cell) bool {
	for _, reg := range ru {
		if reg.ContainsCell(c) {
			return true
		}
	}
	return false
}

// IntersectsCell reports whether this RegionUnion intersects the given cell.
func (ru RegionUnion) IntersectsCell(c Cell) bool {
	for _, reg := range ru {
		if reg.IntersectsCell(c) {
			return true
		}
	}
	return false
}

// ContainsPoint reports whether this RegionUnion contains the Point.
func (ru RegionUnion) ContainsPoint(p Point) bool {
	for _, reg := range ru {
		if reg.ContainsPoint(p) {
			return true
		}
	}
	return false
}

// CellUnionBound computes a covering of the RegionUnion.
func (ru RegionUnion) CellUnionBound() []CellID {
	return ru.CapBound().CellUnionBound()
}
