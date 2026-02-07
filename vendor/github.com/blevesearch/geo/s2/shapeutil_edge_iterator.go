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

// EdgeIterator is an iterator that advances through all edges in an ShapeIndex.
// This is different to the ShapeIndexIterator, which advances through the cells in the
// ShapeIndex.
type EdgeIterator struct {
	index    *ShapeIndex
	shapeID  int32
	numEdges int32
	edgeID   int32
}

// NewEdgeIterator creates a new edge iterator for the given index.
func NewEdgeIterator(index *ShapeIndex) *EdgeIterator {
	e := &EdgeIterator{
		index:   index,
		shapeID: -1,
		edgeID:  -1,
	}

	e.Next()
	return e
}

// ShapeID returns the current shape ID.
func (e *EdgeIterator) ShapeID() int32 { return e.shapeID }

// EdgeID returns the current edge ID.
func (e *EdgeIterator) EdgeID() int32 { return e.edgeID }

// ShapeEdgeID returns the current (shapeID, edgeID).
func (e *EdgeIterator) ShapeEdgeID() ShapeEdgeID { return ShapeEdgeID{e.shapeID, e.edgeID} }

// Edge returns the current edge.
func (e *EdgeIterator) Edge() Edge {
	return e.index.Shape(e.shapeID).Edge(int(e.edgeID))
}

// Done reports if the iterator is positioned at or after the last index edge.
func (e *EdgeIterator) Done() bool { return e.shapeID >= int32(len(e.index.shapes)) }

// Next positions the iterator at the next index edge.
func (e *EdgeIterator) Next() {
	e.edgeID++
	for ; e.edgeID >= e.numEdges; e.edgeID++ {
		e.shapeID++
		if e.shapeID >= int32(len(e.index.shapes)) {
			break
		}
		shape := e.index.Shape(e.shapeID)
		if shape == nil {
			e.numEdges = 0
		} else {
			e.numEdges = int32(shape.NumEdges())
		}
		e.edgeID = -1
	}
}
