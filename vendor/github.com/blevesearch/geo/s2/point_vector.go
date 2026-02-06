// Copyright 2017 Google Inc. All rights reserved.
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

// Shape interface enforcement
var (
	_ Shape = (*PointVector)(nil)
)

// PointVector is a Shape representing a set of Points. Each point
// is represented as a degenerate edge with the same starting and ending
// vertices.
//
// This type is useful for adding a collection of points to an ShapeIndex.
//
// Its methods are on *PointVector due to implementation details of ShapeIndex.
type PointVector []Point

func (p *PointVector) NumEdges() int                     { return len(*p) }
func (p *PointVector) Edge(i int) Edge                   { return Edge{(*p)[i], (*p)[i]} }
func (p *PointVector) ReferencePoint() ReferencePoint    { return OriginReferencePoint(false) }
func (p *PointVector) NumChains() int                    { return len(*p) }
func (p *PointVector) Chain(i int) Chain                 { return Chain{i, 1} }
func (p *PointVector) ChainEdge(i, j int) Edge           { return Edge{(*p)[i], (*p)[j]} }
func (p *PointVector) ChainPosition(e int) ChainPosition { return ChainPosition{e, 0} }
func (p *PointVector) Dimension() int                    { return 0 }
func (p *PointVector) IsEmpty() bool                     { return defaultShapeIsEmpty(p) }
func (p *PointVector) IsFull() bool                      { return defaultShapeIsFull(p) }
func (p *PointVector) typeTag() typeTag                  { return typeTagPointVector }
func (p *PointVector) privateInterface()                 {}
