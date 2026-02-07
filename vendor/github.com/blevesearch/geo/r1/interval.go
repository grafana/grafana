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

package r1

import (
	"fmt"
	"math"
)

// Interval represents a closed interval on ℝ.
// Zero-length intervals (where Lo == Hi) represent single points.
// If Lo > Hi then the interval is empty.
type Interval struct {
	Lo, Hi float64
}

// EmptyInterval returns an empty interval.
func EmptyInterval() Interval { return Interval{1, 0} }

// IntervalFromPoint returns an interval representing a single point.
func IntervalFromPoint(p float64) Interval { return Interval{p, p} }

// IsEmpty reports whether the interval is empty.
func (i Interval) IsEmpty() bool { return i.Lo > i.Hi }

// Equal returns true iff the interval contains the same points as oi.
func (i Interval) Equal(oi Interval) bool {
	return i == oi || i.IsEmpty() && oi.IsEmpty()
}

// Center returns the midpoint of the interval.
// It is undefined for empty intervals.
func (i Interval) Center() float64 { return 0.5 * (i.Lo + i.Hi) }

// Length returns the length of the interval.
// The length of an empty interval is negative.
func (i Interval) Length() float64 { return i.Hi - i.Lo }

// Contains returns true iff the interval contains p.
func (i Interval) Contains(p float64) bool { return i.Lo <= p && p <= i.Hi }

// ContainsInterval returns true iff the interval contains oi.
func (i Interval) ContainsInterval(oi Interval) bool {
	if oi.IsEmpty() {
		return true
	}
	return i.Lo <= oi.Lo && oi.Hi <= i.Hi
}

// InteriorContains returns true iff the interval strictly contains p.
func (i Interval) InteriorContains(p float64) bool {
	return i.Lo < p && p < i.Hi
}

// InteriorContainsInterval returns true iff the interval strictly contains oi.
func (i Interval) InteriorContainsInterval(oi Interval) bool {
	if oi.IsEmpty() {
		return true
	}
	return i.Lo < oi.Lo && oi.Hi < i.Hi
}

// Intersects returns true iff the interval contains any points in common with oi.
func (i Interval) Intersects(oi Interval) bool {
	if i.Lo <= oi.Lo {
		return oi.Lo <= i.Hi && oi.Lo <= oi.Hi // oi.Lo ∈ i and oi is not empty
	}
	return i.Lo <= oi.Hi && i.Lo <= i.Hi // i.Lo ∈ oi and i is not empty
}

// InteriorIntersects returns true iff the interior of the interval contains any points in common with oi, including the latter's boundary.
func (i Interval) InteriorIntersects(oi Interval) bool {
	return oi.Lo < i.Hi && i.Lo < oi.Hi && i.Lo < i.Hi && oi.Lo <= oi.Hi
}

// Intersection returns the interval containing all points common to i and j.
func (i Interval) Intersection(j Interval) Interval {
	// Empty intervals do not need to be special-cased.
	return Interval{
		Lo: math.Max(i.Lo, j.Lo),
		Hi: math.Min(i.Hi, j.Hi),
	}
}

// AddPoint returns the interval expanded so that it contains the given point.
func (i Interval) AddPoint(p float64) Interval {
	if i.IsEmpty() {
		return Interval{p, p}
	}
	if p < i.Lo {
		return Interval{p, i.Hi}
	}
	if p > i.Hi {
		return Interval{i.Lo, p}
	}
	return i
}

// ClampPoint returns the closest point in the interval to the given point "p".
// The interval must be non-empty.
func (i Interval) ClampPoint(p float64) float64 {
	return math.Max(i.Lo, math.Min(i.Hi, p))
}

// Expanded returns an interval that has been expanded on each side by margin.
// If margin is negative, then the function shrinks the interval on
// each side by margin instead. The resulting interval may be empty. Any
// expansion of an empty interval remains empty.
func (i Interval) Expanded(margin float64) Interval {
	if i.IsEmpty() {
		return i
	}
	return Interval{i.Lo - margin, i.Hi + margin}
}

// Union returns the smallest interval that contains this interval and the given interval.
func (i Interval) Union(other Interval) Interval {
	if i.IsEmpty() {
		return other
	}
	if other.IsEmpty() {
		return i
	}
	return Interval{math.Min(i.Lo, other.Lo), math.Max(i.Hi, other.Hi)}
}

func (i Interval) String() string { return fmt.Sprintf("[%.7f, %.7f]", i.Lo, i.Hi) }

const (
	// epsilon is a small number that represents a reasonable level of noise between two
	// values that can be considered to be equal.
	epsilon = 1e-15
	// dblEpsilon is a smaller number for values that require more precision.
	// This is the C++ DBL_EPSILON equivalent.
	dblEpsilon = 2.220446049250313e-16
)

// ApproxEqual reports whether the interval can be transformed into the
// given interval by moving each endpoint a small distance.
// The empty interval is considered to be positioned arbitrarily on the
// real line, so any interval with a small enough length will match
// the empty interval.
func (i Interval) ApproxEqual(other Interval) bool {
	if i.IsEmpty() {
		return other.Length() <= 2*epsilon
	}
	if other.IsEmpty() {
		return i.Length() <= 2*epsilon
	}
	return math.Abs(other.Lo-i.Lo) <= epsilon &&
		math.Abs(other.Hi-i.Hi) <= epsilon
}

// DirectedHausdorffDistance returns the Hausdorff distance to the given interval. For two
// intervals x and y, this distance is defined as
//
//	h(x, y) = max_{p in x} min_{q in y} d(p, q).
func (i Interval) DirectedHausdorffDistance(other Interval) float64 {
	if i.IsEmpty() {
		return 0
	}
	if other.IsEmpty() {
		return math.Inf(1)
	}
	return math.Max(0, math.Max(i.Hi-other.Hi, other.Lo-i.Lo))
}
