// Copyright 2023 Google Inc. All rights reserved.
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

const laxPolylineTypeTag = 4

// LaxPolyline represents a polyline. It is similar to Polyline except
// that adjacent vertices are allowed to be identical or antipodal, and
// the representation is slightly more compact.
//
// Polylines may have any number of vertices, but note that polylines with
// fewer than 2 vertices do not define any edges. (To create a polyline
// consisting of a single degenerate edge, either repeat the same vertex twice
// or use LaxClosedPolyline.
type LaxPolyline struct {
	vertices []Point
}

// LaxPolylineFromPoints constructs a LaxPolyline from the given points.
func LaxPolylineFromPoints(vertices []Point) *LaxPolyline {
	return &LaxPolyline{
		vertices: append([]Point(nil), vertices...),
	}
}

// LaxPolylineFromPolyline converts the given Polyline into a LaxPolyline.
func LaxPolylineFromPolyline(p Polyline) *LaxPolyline {
	return LaxPolylineFromPoints(p)
}

func (l *LaxPolyline) NumEdges() int                     { return maxInt(0, len(l.vertices)-1) }
func (l *LaxPolyline) Edge(e int) Edge                   { return Edge{l.vertices[e], l.vertices[e+1]} }
func (l *LaxPolyline) ReferencePoint() ReferencePoint    { return OriginReferencePoint(false) }
func (l *LaxPolyline) NumChains() int                    { return minInt(1, l.NumEdges()) }
func (l *LaxPolyline) Chain(i int) Chain                 { return Chain{0, l.NumEdges()} }
func (l *LaxPolyline) ChainEdge(i, j int) Edge           { return Edge{l.vertices[j], l.vertices[j+1]} }
func (l *LaxPolyline) ChainPosition(e int) ChainPosition { return ChainPosition{0, e} }
func (l *LaxPolyline) Dimension() int                    { return 1 }
func (l *LaxPolyline) IsEmpty() bool                     { return defaultShapeIsEmpty(l) }
func (l *LaxPolyline) IsFull() bool                      { return defaultShapeIsFull(l) }
func (l *LaxPolyline) typeTag() typeTag                  { return typeTagLaxPolyline }
func (l *LaxPolyline) privateInterface()                 {}

// TODO(roberts):
// Add Encode/Decode support
// Add EncodedLaxPolyline type
