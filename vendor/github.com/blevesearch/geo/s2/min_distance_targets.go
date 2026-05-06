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

// minDistance implements distance interface to find closest distance types.
type minDistance s1.ChordAngle

func (m minDistance) chordAngle() s1.ChordAngle { return s1.ChordAngle(m) }
func (m minDistance) zero() distance            { return minDistance(0) }
func (m minDistance) negative() distance        { return minDistance(s1.NegativeChordAngle) }
func (m minDistance) infinity() distance        { return minDistance(s1.InfChordAngle()) }
func (m minDistance) less(other distance) bool  { return m.chordAngle() < other.chordAngle() }
func (m minDistance) sub(other distance) distance {
	return minDistance(m.chordAngle() - other.chordAngle())
}
func (m minDistance) chordAngleBound() s1.ChordAngle {
	return m.chordAngle().Expanded(m.chordAngle().MaxAngleError())
}

// updateDistance updates its own value if the other value is less() than it is,
// and reports if it updated.
func (m minDistance) updateDistance(dist distance) (distance, bool) {
	if dist.less(m) {
		m = minDistance(dist.chordAngle())
		return m, true
	}
	return m, false
}

func (m minDistance) fromChordAngle(o s1.ChordAngle) distance {
	return minDistance(o)
}

// MinDistanceToPointTarget is a type for computing the minimum distance to a Point.
type MinDistanceToPointTarget struct {
	point Point
	dist  distance
}

// NewMinDistanceToPointTarget returns a new target for the given Point.
func NewMinDistanceToPointTarget(point Point) *MinDistanceToPointTarget {
	m := minDistance(0)
	return &MinDistanceToPointTarget{point: point, dist: &m}
}

func (m *MinDistanceToPointTarget) capBound() Cap {
	return CapFromCenterChordAngle(m.point, s1.ChordAngle(0))
}

func (m *MinDistanceToPointTarget) updateDistanceToPoint(p Point, dist distance) (distance, bool) {
	var ok bool
	dist, ok = dist.updateDistance(minDistance(ChordAngleBetweenPoints(p, m.point)))
	return dist, ok
}

func (m *MinDistanceToPointTarget) updateDistanceToEdge(edge Edge, dist distance) (distance, bool) {
	if d, ok := UpdateMinDistance(m.point, edge.V0, edge.V1, dist.chordAngle()); ok {
		dist, _ = dist.updateDistance(minDistance(d))
		return dist, true
	}
	return dist, false
}

func (m *MinDistanceToPointTarget) updateDistanceToCell(cell Cell, dist distance) (distance, bool) {
	var ok bool
	dist, ok = dist.updateDistance(minDistance(cell.Distance(m.point)))
	return dist, ok
}

func (m *MinDistanceToPointTarget) visitContainingShapes(index *ShapeIndex, v shapePointVisitorFunc) bool {
	// For furthest points, we visit the polygons whose interior contains
	// the antipode of the target point. These are the polygons whose
	// distance to the target is maxDistance.zero()
	q := NewContainsPointQuery(index, VertexModelSemiOpen)
	return q.visitContainingShapes(m.point, func(shape Shape) bool {
		return v(shape, m.point)
	})
}

func (m *MinDistanceToPointTarget) setMaxError(maxErr s1.ChordAngle) bool { return false }
func (m *MinDistanceToPointTarget) maxBruteForceIndexSize() int           { return 30 }
func (m *MinDistanceToPointTarget) distance() distance                    { return m.dist }

// ----------------------------------------------------------

// MinDistanceToEdgeTarget is a type for computing the minimum distance to an Edge.
type MinDistanceToEdgeTarget struct {
	e    Edge
	dist distance
}

// NewMinDistanceToEdgeTarget returns a new target for the given Edge.
func NewMinDistanceToEdgeTarget(e Edge) *MinDistanceToEdgeTarget {
	m := minDistance(0)
	return &MinDistanceToEdgeTarget{e: e, dist: m}
}

// capBound returns a Cap that bounds the antipode of the target. (This
// is the set of points whose maxDistance to the target is maxDistance.zero)
func (m *MinDistanceToEdgeTarget) capBound() Cap {
	// The following computes a radius equal to half the edge length in an
	// efficient and numerically stable way.
	d2 := float64(ChordAngleBetweenPoints(m.e.V0, m.e.V1))
	r2 := (0.5 * d2) / (1 + math.Sqrt(1-0.25*d2))
	return CapFromCenterChordAngle(Point{m.e.V0.Add(m.e.V1.Vector).Normalize()}, s1.ChordAngleFromSquaredLength(r2))
}

func (m *MinDistanceToEdgeTarget) updateDistanceToPoint(p Point, dist distance) (distance, bool) {
	if d, ok := UpdateMinDistance(p, m.e.V0, m.e.V1, dist.chordAngle()); ok {
		dist, _ = dist.updateDistance(minDistance(d))
		return dist, true
	}
	return dist, false
}

func (m *MinDistanceToEdgeTarget) updateDistanceToEdge(edge Edge, dist distance) (distance, bool) {
	if d, ok := updateEdgePairMinDistance(m.e.V0, m.e.V1, edge.V0, edge.V1, dist.chordAngle()); ok {
		dist, _ = dist.updateDistance(minDistance(d))
		return dist, true
	}
	return dist, false
}

func (m *MinDistanceToEdgeTarget) updateDistanceToCell(cell Cell, dist distance) (distance, bool) {
	return dist.updateDistance(minDistance(cell.DistanceToEdge(m.e.V0, m.e.V1)))
}

func (m *MinDistanceToEdgeTarget) visitContainingShapes(index *ShapeIndex, v shapePointVisitorFunc) bool {
	// We test the center of the edge in order to ensure that edge targets AB
	// and BA yield identical results (which is not guaranteed by the API but
	// users might expect).  Other options would be to test both endpoints, or
	// return different results for AB and BA in some cases.
	target := NewMinDistanceToPointTarget(Point{m.e.V0.Add(m.e.V1.Vector).Normalize()})
	return target.visitContainingShapes(index, v)
}

func (m *MinDistanceToEdgeTarget) setMaxError(maxErr s1.ChordAngle) bool { return false }
func (m *MinDistanceToEdgeTarget) maxBruteForceIndexSize() int           { return 30 }
func (m *MinDistanceToEdgeTarget) distance() distance                    { return m.dist }

// ----------------------------------------------------------

// MinDistanceToCellTarget is a type for computing the minimum distance to a Cell.
type MinDistanceToCellTarget struct {
	cell Cell
	dist distance
}

// NewMinDistanceToCellTarget returns a new target for the given Cell.
func NewMinDistanceToCellTarget(cell Cell) *MinDistanceToCellTarget {
	m := minDistance(0)
	return &MinDistanceToCellTarget{cell: cell, dist: m}
}

func (m *MinDistanceToCellTarget) capBound() Cap {
	return m.cell.CapBound()
}

func (m *MinDistanceToCellTarget) updateDistanceToPoint(p Point, dist distance) (distance, bool) {
	return dist.updateDistance(minDistance(m.cell.Distance(p)))
}

func (m *MinDistanceToCellTarget) updateDistanceToEdge(edge Edge, dist distance) (distance, bool) {
	return dist.updateDistance(minDistance(m.cell.DistanceToEdge(edge.V0, edge.V1)))
}

func (m *MinDistanceToCellTarget) updateDistanceToCell(cell Cell, dist distance) (distance, bool) {
	return dist.updateDistance(minDistance(m.cell.DistanceToCell(cell)))
}

func (m *MinDistanceToCellTarget) visitContainingShapes(index *ShapeIndex, v shapePointVisitorFunc) bool {
	// The simplest approach is simply to return the polygons that contain the
	// cell center.  Alternatively, if the index cell is smaller than the target
	// cell then we could return all polygons that are present in the
	// shapeIndexCell, but since the index is built conservatively this may
	// include some polygons that don't quite intersect the cell.  So we would
	// either need to recheck for intersection more accurately, or weaken the
	// VisitContainingShapes contract so that it only guarantees approximate
	// intersection, neither of which seems like a good tradeoff.
	target := NewMinDistanceToPointTarget(m.cell.Center())
	return target.visitContainingShapes(index, v)
}
func (m *MinDistanceToCellTarget) setMaxError(maxErr s1.ChordAngle) bool { return false }
func (m *MinDistanceToCellTarget) maxBruteForceIndexSize() int           { return 30 }
func (m *MinDistanceToCellTarget) distance() distance                    { return m.dist }

// ----------------------------------------------------------

/*
// MinDistanceToCellUnionTarget is a type for computing the minimum distance to a CellUnion.
type MinDistanceToCellUnionTarget struct {
	cu    CellUnion
	query *ClosestCellQuery
	dist  distance
}

// NewMinDistanceToCellUnionTarget returns a new target for the given CellUnion.
func NewMinDistanceToCellUnionTarget(cu CellUnion) *MinDistanceToCellUnionTarget {
	m := minDistance(0)
	return &MinDistanceToCellUnionTarget{cu: cu, dist: m}
}

func (m *MinDistanceToCellUnionTarget) capBound() Cap {
	return m.cu.CapBound()
}

func (m *MinDistanceToCellUnionTarget) updateDistanceToCell(cell Cell, dist distance) (distance, bool) {
	m.query.opts.DistanceLimit = dist.chordAngle()
	target := NewMinDistanceToPointTarget(p)
	r := m.query.findEdge(target)
	if r.ShapeID < 0 {
		return dist, false
	}
	return minDistance(r.Distance), true
}

func (m *MinDistanceToCellUnionTarget) visitContainingShapes(index *ShapeIndex, v shapePointVisitorFunc) bool {
	// We test the center of the edge in order to ensure that edge targets AB
	// and BA yield identical results (which is not guaranteed by the API but
	// users might expect).  Other options would be to test both endpoints, or
	// return different results for AB and BA in some cases.
	target := NewMinDistanceToPointTarget(Point{m.e.V0.Add(m.e.V1.Vector).Normalize()})
	return target.visitContainingShapes(index, v)
}
func (m *MinDistanceToCellUnionTarget) setMaxError(maxErr s1.ChordAngle) bool {
	m.query.opts.MaxError = maxErr
	return true
}
func (m *MinDistanceToCellUnionTarget) maxBruteForceIndexSize() int           { return 30 }
func (m *MinDistanceToCellUnionTarget) distance() distance                    { return m.dist }
*/

// ----------------------------------------------------------

// MinDistanceToShapeIndexTarget is a type for computing the minimum distance to a ShapeIndex.
type MinDistanceToShapeIndexTarget struct {
	index *ShapeIndex
	query *EdgeQuery
	dist  distance
}

// NewMinDistanceToShapeIndexTarget returns a new target for the given ShapeIndex.
func NewMinDistanceToShapeIndexTarget(index *ShapeIndex) *MinDistanceToShapeIndexTarget {
	m := minDistance(0)
	return &MinDistanceToShapeIndexTarget{
		index: index,
		dist:  m,
		query: NewClosestEdgeQuery(index, NewClosestEdgeQueryOptions()),
	}
}

func (m *MinDistanceToShapeIndexTarget) capBound() Cap {
	// TODO(roberts): Depends on ShapeIndexRegion existing.
	// c := makeS2ShapeIndexRegion(m.index).CapBound()
	// return CapFromCenterRadius(Point{c.Center.Mul(-1)}, c.Radius())
	panic("not implemented yet")
}

func (m *MinDistanceToShapeIndexTarget) updateDistanceToPoint(p Point, dist distance) (distance, bool) {
	m.query.opts.distanceLimit = dist.chordAngle()
	target := NewMinDistanceToPointTarget(p)
	r := m.query.findEdge(target, m.query.opts)
	if r.shapeID < 0 {
		return dist, false
	}
	return r.distance, true
}

func (m *MinDistanceToShapeIndexTarget) updateDistanceToEdge(edge Edge, dist distance) (distance, bool) {
	m.query.opts.distanceLimit = dist.chordAngle()
	target := NewMinDistanceToEdgeTarget(edge)
	r := m.query.findEdge(target, m.query.opts)
	if r.shapeID < 0 {
		return dist, false
	}
	return r.distance, true
}

func (m *MinDistanceToShapeIndexTarget) updateDistanceToCell(cell Cell, dist distance) (distance, bool) {
	m.query.opts.distanceLimit = dist.chordAngle()
	target := NewMinDistanceToCellTarget(cell)
	r := m.query.findEdge(target, m.query.opts)
	if r.shapeID < 0 {
		return dist, false
	}
	return r.distance, true
}

// For target types consisting of multiple connected components (such as this one),
// this method should return the polygons containing the antipodal reflection of
// *any* connected component. (It is sufficient to test containment of one vertex per
// connected component, since this allows us to also return any polygon whose
// boundary has distance.zero() to the target.)
func (m *MinDistanceToShapeIndexTarget) visitContainingShapes(index *ShapeIndex, v shapePointVisitorFunc) bool {
	// It is sufficient to find the set of chain starts in the target index
	// (i.e., one vertex per connected component of edges) that are contained by
	// the query index, except for one special case to handle full polygons.
	//
	// TODO(roberts): Do this by merge-joining the two ShapeIndexes.
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
			target := NewMinDistanceToPointTarget(shape.ChainEdge(c, 0).V0)
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
			target := NewMinDistanceToPointTarget(ref.Point)
			if !target.visitContainingShapes(index, v) {
				return false
			}
		}
	}
	return true
}

func (m *MinDistanceToShapeIndexTarget) setMaxError(maxErr s1.ChordAngle) bool {
	m.query.opts.maxError = maxErr
	return true
}
func (m *MinDistanceToShapeIndexTarget) maxBruteForceIndexSize() int { return 25 }
func (m *MinDistanceToShapeIndexTarget) distance() distance          { return m.dist }
func (m *MinDistanceToShapeIndexTarget) setIncludeInteriors(b bool) {
	m.query.opts.includeInteriors = b
}
func (m *MinDistanceToShapeIndexTarget) setUseBruteForce(b bool) { m.query.opts.useBruteForce = b }

// TODO(roberts): Remaining methods
//
// func (m *MinDistanceToShapeIndexTarget) capBound() Cap {
// CellUnionTarget
