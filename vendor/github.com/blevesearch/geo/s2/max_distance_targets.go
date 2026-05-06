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

// maxDistance implements distance as the supplementary distance (Pi - x) to find
// results that are the furthest using the distance related algorithms.
type maxDistance s1.ChordAngle

func (m maxDistance) chordAngle() s1.ChordAngle { return s1.ChordAngle(m) }
func (m maxDistance) zero() distance            { return maxDistance(s1.StraightChordAngle) }
func (m maxDistance) negative() distance        { return maxDistance(s1.InfChordAngle()) }
func (m maxDistance) infinity() distance        { return maxDistance(s1.NegativeChordAngle) }
func (m maxDistance) less(other distance) bool  { return m.chordAngle() > other.chordAngle() }
func (m maxDistance) sub(other distance) distance {
	return maxDistance(m.chordAngle() + other.chordAngle())
}
func (m maxDistance) chordAngleBound() s1.ChordAngle {
	return s1.StraightChordAngle - m.chordAngle()
}
func (m maxDistance) updateDistance(dist distance) (distance, bool) {
	if dist.less(m) {
		m = maxDistance(dist.chordAngle())
		return m, true
	}
	return m, false
}

func (m maxDistance) fromChordAngle(o s1.ChordAngle) distance {
	return maxDistance(o)
}

// MaxDistanceToPointTarget is used for computing the maximum distance to a Point.
type MaxDistanceToPointTarget struct {
	point Point
	dist  distance
}

// NewMaxDistanceToPointTarget returns a new target for the given Point.
func NewMaxDistanceToPointTarget(point Point) *MaxDistanceToPointTarget {
	m := maxDistance(0)
	return &MaxDistanceToPointTarget{point: point, dist: &m}
}

func (m *MaxDistanceToPointTarget) capBound() Cap {
	return CapFromCenterChordAngle(Point{m.point.Mul(-1)}, (s1.ChordAngle(0)))
}

func (m *MaxDistanceToPointTarget) updateDistanceToPoint(p Point, dist distance) (distance, bool) {
	return dist.updateDistance(maxDistance(ChordAngleBetweenPoints(p, m.point)))
}

func (m *MaxDistanceToPointTarget) updateDistanceToEdge(edge Edge, dist distance) (distance, bool) {
	if d, ok := UpdateMaxDistance(m.point, edge.V0, edge.V1, dist.chordAngle()); ok {
		dist, _ = dist.updateDistance(maxDistance(d))
		return dist, true
	}
	return dist, false
}

func (m *MaxDistanceToPointTarget) updateDistanceToCell(cell Cell, dist distance) (distance, bool) {
	return dist.updateDistance(maxDistance(cell.MaxDistance(m.point)))
}

func (m *MaxDistanceToPointTarget) visitContainingShapes(index *ShapeIndex, v shapePointVisitorFunc) bool {
	// For furthest points, we visit the polygons whose interior contains
	// the antipode of the target point. These are the polygons whose
	// distance to the target is maxDistance.zero()
	q := NewContainsPointQuery(index, VertexModelSemiOpen)
	return q.visitContainingShapes(Point{m.point.Mul(-1)}, func(shape Shape) bool {
		return v(shape, m.point)
	})
}

func (m *MaxDistanceToPointTarget) setMaxError(maxErr s1.ChordAngle) bool { return false }
func (m *MaxDistanceToPointTarget) maxBruteForceIndexSize() int           { return 30 }
func (m *MaxDistanceToPointTarget) distance() distance                    { return m.dist }

// MaxDistanceToEdgeTarget is used for computing the maximum distance to an Edge.
type MaxDistanceToEdgeTarget struct {
	e    Edge
	dist distance
}

// NewMaxDistanceToEdgeTarget returns a new target for the given Edge.
func NewMaxDistanceToEdgeTarget(e Edge) *MaxDistanceToEdgeTarget {
	m := maxDistance(0)
	return &MaxDistanceToEdgeTarget{e: e, dist: m}
}

// capBound returns a Cap that bounds the antipode of the target. (This
// is the set of points whose maxDistance to the target is maxDistance.zero)
func (m *MaxDistanceToEdgeTarget) capBound() Cap {
	// The following computes a radius equal to half the edge length in an
	// efficient and numerically stable way.
	d2 := float64(ChordAngleBetweenPoints(m.e.V0, m.e.V1))
	r2 := (0.5 * d2) / (1 + math.Sqrt(1-0.25*d2))
	return CapFromCenterChordAngle(Point{m.e.V0.Add(m.e.V1.Vector).Mul(-1).Normalize()}, s1.ChordAngleFromSquaredLength(r2))
}

func (m *MaxDistanceToEdgeTarget) updateDistanceToPoint(p Point, dist distance) (distance, bool) {
	if d, ok := UpdateMaxDistance(p, m.e.V0, m.e.V1, dist.chordAngle()); ok {
		dist, _ = dist.updateDistance(maxDistance(d))
		return dist, true
	}
	return dist, false
}

func (m *MaxDistanceToEdgeTarget) updateDistanceToEdge(edge Edge, dist distance) (distance, bool) {
	if d, ok := updateEdgePairMaxDistance(m.e.V0, m.e.V1, edge.V0, edge.V1, dist.chordAngle()); ok {
		dist, _ = dist.updateDistance(maxDistance(d))
		return dist, true
	}
	return dist, false
}

func (m *MaxDistanceToEdgeTarget) updateDistanceToCell(cell Cell, dist distance) (distance, bool) {
	return dist.updateDistance(maxDistance(cell.MaxDistanceToEdge(m.e.V0, m.e.V1)))
}

func (m *MaxDistanceToEdgeTarget) visitContainingShapes(index *ShapeIndex, v shapePointVisitorFunc) bool {
	// We only need to test one edge point. That is because the method *must*
	// visit a polygon if it fully contains the target, and *is allowed* to
	// visit a polygon if it intersects the target. If the tested vertex is not
	// contained, we know the full edge is not contained; if the tested vertex is
	// contained, then the edge either is fully contained (must be visited) or it
	// intersects (is allowed to be visited). We visit the center of the edge so
	// that edge AB gives identical results to BA.
	target := NewMaxDistanceToPointTarget(Point{m.e.V0.Add(m.e.V1.Vector).Normalize()})
	return target.visitContainingShapes(index, v)
}

func (m *MaxDistanceToEdgeTarget) setMaxError(maxErr s1.ChordAngle) bool { return false }
func (m *MaxDistanceToEdgeTarget) maxBruteForceIndexSize() int           { return 30 }
func (m *MaxDistanceToEdgeTarget) distance() distance                    { return m.dist }

// MaxDistanceToCellTarget is used for computing the maximum distance to a Cell.
type MaxDistanceToCellTarget struct {
	cell Cell
	dist distance
}

// NewMaxDistanceToCellTarget returns a new target for the given Cell.
func NewMaxDistanceToCellTarget(cell Cell) *MaxDistanceToCellTarget {
	m := maxDistance(0)
	return &MaxDistanceToCellTarget{cell: cell, dist: m}
}

func (m *MaxDistanceToCellTarget) capBound() Cap {
	c := m.cell.CapBound()
	return CapFromCenterAngle(Point{c.Center().Mul(-1)}, c.Radius())
}

func (m *MaxDistanceToCellTarget) updateDistanceToPoint(p Point, dist distance) (distance, bool) {
	return dist.updateDistance(maxDistance(m.cell.MaxDistance(p)))
}

func (m *MaxDistanceToCellTarget) updateDistanceToEdge(edge Edge, dist distance) (distance, bool) {
	return dist.updateDistance(maxDistance(m.cell.MaxDistanceToEdge(edge.V0, edge.V1)))
}

func (m *MaxDistanceToCellTarget) updateDistanceToCell(cell Cell, dist distance) (distance, bool) {
	return dist.updateDistance(maxDistance(m.cell.MaxDistanceToCell(cell)))
}

func (m *MaxDistanceToCellTarget) visitContainingShapes(index *ShapeIndex, v shapePointVisitorFunc) bool {
	// We only need to check one point here - cell center is simplest.
	// See comment at MaxDistanceToEdgeTarget's visitContainingShapes.
	target := NewMaxDistanceToPointTarget(m.cell.Center())
	return target.visitContainingShapes(index, v)
}

func (m *MaxDistanceToCellTarget) setMaxError(maxErr s1.ChordAngle) bool { return false }
func (m *MaxDistanceToCellTarget) maxBruteForceIndexSize() int           { return 30 }
func (m *MaxDistanceToCellTarget) distance() distance                    { return m.dist }

// MaxDistanceToShapeIndexTarget is used for computing the maximum distance to a ShapeIndex.
type MaxDistanceToShapeIndexTarget struct {
	index *ShapeIndex
	query *EdgeQuery
	dist  distance
}

// NewMaxDistanceToShapeIndexTarget returns a new target for the given ShapeIndex.
func NewMaxDistanceToShapeIndexTarget(index *ShapeIndex) *MaxDistanceToShapeIndexTarget {
	m := maxDistance(0)
	return &MaxDistanceToShapeIndexTarget{
		index: index,
		dist:  m,
		query: NewFurthestEdgeQuery(index, NewFurthestEdgeQueryOptions()),
	}
}

// capBound returns a Cap that bounds the antipode of the target. This
// is the set of points whose maxDistance to the target is maxDistance.zero()
func (m *MaxDistanceToShapeIndexTarget) capBound() Cap {
	// TODO(roberts): Depends on ShapeIndexRegion
	// c := makeShapeIndexRegion(m.index).CapBound()
	// return CapFromCenterRadius(Point{c.Center.Mul(-1)}, c.Radius())
	panic("not implemented yet")
}

func (m *MaxDistanceToShapeIndexTarget) updateDistanceToPoint(p Point, dist distance) (distance, bool) {
	m.query.opts.distanceLimit = dist.chordAngle()
	target := NewMaxDistanceToPointTarget(p)
	r := m.query.findEdge(target, m.query.opts)
	if r.shapeID < 0 {
		return dist, false
	}
	return r.distance, true
}

func (m *MaxDistanceToShapeIndexTarget) updateDistanceToEdge(edge Edge, dist distance) (distance, bool) {
	m.query.opts.distanceLimit = dist.chordAngle()
	target := NewMaxDistanceToEdgeTarget(edge)
	r := m.query.findEdge(target, m.query.opts)
	if r.shapeID < 0 {
		return dist, false
	}
	return r.distance, true
}

func (m *MaxDistanceToShapeIndexTarget) updateDistanceToCell(cell Cell, dist distance) (distance, bool) {
	m.query.opts.distanceLimit = dist.chordAngle()
	target := NewMaxDistanceToCellTarget(cell)
	r := m.query.findEdge(target, m.query.opts)
	if r.shapeID < 0 {
		return dist, false
	}
	return r.distance, true
}

// visitContainingShapes returns the polygons containing the antipodal
// reflection of *any* connected component for target types consisting of
// multiple connected components. It is sufficient to test containment of
// one vertex per connected component, since this allows us to also return
// any polygon whose boundary has distance.zero() to the target.
func (m *MaxDistanceToShapeIndexTarget) visitContainingShapes(index *ShapeIndex, v shapePointVisitorFunc) bool {
	// It is sufficient to find the set of chain starts in the target index
	// (i.e., one vertex per connected component of edges) that are contained by
	// the query index, except for one special case to handle full polygons.
	//
	// TODO(roberts): Do this by merge-joining the two ShapeIndexes and share
	// the code with BooleanOperation.
	for _, shape := range m.index.shapes {
		numChains := shape.NumChains()
		// Shapes that don't have any edges require a special case (below).
		testedPoint := false
		for c := 0; c < numChains; c++ {
			chain := shape.Chain(c)
			if chain.Length == 0 {
				continue
			}
			testedPoint = true
			target := NewMaxDistanceToPointTarget(shape.ChainEdge(c, 0).V0)
			if !target.visitContainingShapes(index, v) {
				return false
			}
		}
		if !testedPoint {
			// Special case to handle full polygons.
			ref := shape.ReferencePoint()
			if !ref.Contained {
				continue
			}
			target := NewMaxDistanceToPointTarget(ref.Point)
			if !target.visitContainingShapes(index, v) {
				return false
			}
		}
	}
	return true
}

func (m *MaxDistanceToShapeIndexTarget) setMaxError(maxErr s1.ChordAngle) bool {
	m.query.opts.maxError = maxErr
	return true
}
func (m *MaxDistanceToShapeIndexTarget) maxBruteForceIndexSize() int { return 30 }
func (m *MaxDistanceToShapeIndexTarget) distance() distance          { return m.dist }
func (m *MaxDistanceToShapeIndexTarget) setIncludeInteriors(b bool) {
	m.query.opts.includeInteriors = b
}
func (m *MaxDistanceToShapeIndexTarget) setUseBruteForce(b bool) { m.query.opts.useBruteForce = b }

// TODO(roberts): Remaining methods
//
// func (m *MaxDistanceToShapeIndexTarget) capBound() Cap {
// CellUnionTarget
