// Copyright 2015 Google Inc. All rights reserved.
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

// This file implements functions for various S2 measurements.

import "math"

// A Metric is a measure for cells. It is used to describe the shape and size
// of cells. They are useful for deciding which cell level to use in order to
// satisfy a given condition (e.g. that cell vertices must be no further than
// "x" apart). You can use the Value(level) method to compute the corresponding
// length or area on the unit sphere for cells at a given level. The minimum
// and maximum bounds are valid for cells at all levels, but they may be
// somewhat conservative for very large cells (e.g. face cells).
type Metric struct {
	// Dim is either 1 or 2, for a 1D or 2D metric respectively.
	Dim int
	// Deriv is the scaling factor for the metric.
	Deriv float64
}

// Defined metrics.
// Of the projection methods defined in C++, Go only supports the quadratic projection.

// Each cell is bounded by four planes passing through its four edges and
// the center of the sphere. These metrics relate to the angle between each
// pair of opposite bounding planes, or equivalently, between the planes
// corresponding to two different s-values or two different t-values.
var (
	MinAngleSpanMetric = Metric{1, 4.0 / 3}
	AvgAngleSpanMetric = Metric{1, math.Pi / 2}
	MaxAngleSpanMetric = Metric{1, 1.704897179199218452}
)

// The width of geometric figure is defined as the distance between two
// parallel bounding lines in a given direction. For cells, the minimum
// width is always attained between two opposite edges, and the maximum
// width is attained between two opposite vertices. However, for our
// purposes we redefine the width of a cell as the perpendicular distance
// between a pair of opposite edges. A cell therefore has two widths, one
// in each direction. The minimum width according to this definition agrees
// with the classic geometric one, but the maximum width is different. (The
// maximum geometric width corresponds to MaxDiag defined below.)
//
// The average width in both directions for all cells at level k is approximately
// AvgWidthMetric.Value(k).
//
// The width is useful for bounding the minimum or maximum distance from a
// point on one edge of a cell to the closest point on the opposite edge.
// For example, this is useful when growing regions by a fixed distance.
var (
	MinWidthMetric = Metric{1, 2 * math.Sqrt2 / 3}
	AvgWidthMetric = Metric{1, 1.434523672886099389}
	MaxWidthMetric = Metric{1, MaxAngleSpanMetric.Deriv}
)

// The edge length metrics can be used to bound the minimum, maximum,
// or average distance from the center of one cell to the center of one of
// its edge neighbors. In particular, it can be used to bound the distance
// between adjacent cell centers along the space-filling Hilbert curve for
// cells at any given level.
var (
	MinEdgeMetric = Metric{1, 2 * math.Sqrt2 / 3}
	AvgEdgeMetric = Metric{1, 1.459213746386106062}
	MaxEdgeMetric = Metric{1, MaxAngleSpanMetric.Deriv}

	// MaxEdgeAspect is the maximum edge aspect ratio over all cells at any level,
	// where the edge aspect ratio of a cell is defined as the ratio of its longest
	// edge length to its shortest edge length.
	MaxEdgeAspect = 1.442615274452682920

	MinAreaMetric = Metric{2, 8 * math.Sqrt2 / 9}
	AvgAreaMetric = Metric{2, 4 * math.Pi / 6}
	MaxAreaMetric = Metric{2, 2.635799256963161491}
)

// The maximum diagonal is also the maximum diameter of any cell,
// and also the maximum geometric width (see the comment for widths). For
// example, the distance from an arbitrary point to the closest cell center
// at a given level is at most half the maximum diagonal length.
var (
	MinDiagMetric = Metric{1, 8 * math.Sqrt2 / 9}
	AvgDiagMetric = Metric{1, 2.060422738998471683}
	MaxDiagMetric = Metric{1, 2.438654594434021032}

	// MaxDiagAspect is the maximum diagonal aspect ratio over all cells at any
	// level, where the diagonal aspect ratio of a cell is defined as the ratio
	// of its longest diagonal length to its shortest diagonal length.
	MaxDiagAspect = math.Sqrt(3)
)

// Value returns the value of the metric at the given level.
func (m Metric) Value(level int) float64 {
	return math.Ldexp(m.Deriv, -m.Dim*level)
}

// MinLevel returns the minimum level such that the metric is at most
// the given value, or maxLevel (30) if there is no such level.
//
// For example, MinLevel(0.1) returns the minimum level such that all cell diagonal
// lengths are 0.1 or smaller. The returned value is always a valid level.
//
// In C++, this is called GetLevelForMaxValue.
func (m Metric) MinLevel(val float64) int {
	if val < 0 {
		return maxLevel
	}

	level := -(math.Ilogb(val/m.Deriv) >> uint(m.Dim-1))
	if level > maxLevel {
		level = maxLevel
	}
	if level < 0 {
		level = 0
	}
	return level
}

// MaxLevel returns the maximum level such that the metric is at least
// the given value, or zero if there is no such level.
//
// For example, MaxLevel(0.1) returns the maximum level such that all cells have a
// minimum width of 0.1 or larger. The returned value is always a valid level.
//
// In C++, this is called GetLevelForMinValue.
func (m Metric) MaxLevel(val float64) int {
	if val <= 0 {
		return maxLevel
	}

	level := math.Ilogb(m.Deriv/val) >> uint(m.Dim-1)
	if level > maxLevel {
		level = maxLevel
	}
	if level < 0 {
		level = 0
	}
	return level
}

// ClosestLevel returns the level at which the metric has approximately the given
// value. The return value is always a valid level. For example,
// AvgEdgeMetric.ClosestLevel(0.1) returns the level at which the average cell edge
// length is approximately 0.1.
func (m Metric) ClosestLevel(val float64) int {
	x := math.Sqrt2
	if m.Dim == 2 {
		x = 2
	}
	return m.MinLevel(x * val)
}
