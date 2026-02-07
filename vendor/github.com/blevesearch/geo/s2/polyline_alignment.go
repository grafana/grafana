// Copyright 2023 Google Inc. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS-IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//

package s2

import (
	"bytes"
	"fmt"
	"math"
)

// This library provides code to compute vertex alignments between Polylines.
//
// A vertex "alignment" or "warp" between two polylines is a matching between
// pairs of their vertices. Users can imagine pairing each vertex from
// Polyline `a` with at least one other vertex in Polyline `b`. The "cost"
// of an arbitrary alignment is defined as the summed value of the squared
// chordal distance between each pair of points in the warp path. An "optimal
// alignment" for a pair of polylines is defined as the alignment with least
// cost. Note: optimal alignments are not necessarily unique. The standard way
// of computing an optimal alignment between two sequences is the use of the
// `Dynamic Timewarp` algorithm.
//
// We provide three methods for computing (via Dynamic Timewarp) the optimal
// alignment between two Polylines. These methods are performance-sensitive,
// and have been reasonably optimized for space- and time- usage. On modern
// hardware, it is possible to compute exact alignments between 4096x4096
// element polylines in ~70ms, and approximate alignments much more quickly.
//
// The results of an alignment operation are captured in a VertexAlignment
// object. In particular, a VertexAlignment keeps track of the total cost of
// alignment, as well as the warp path (a sequence of pairs of indices into each
// polyline whose vertices are linked together in the optimal alignment)
//
// For a worked example, consider the polylines
//
// a = [(1, 0), (5, 0), (6, 0), (9, 0)] and
// b = [(2, 0), (7, 0), (8, 0)].
//
// The "cost matrix" between these two polylines (using chordal
// distance, .Norm(), as our distance function) looks like this:
//
//        (2, 0)  (7, 0)  (8, 0)
// (1, 0)     1       6       7
// (5, 0)     3       2       3
// (6, 0)     4       1       2
// (9, 0)     7       2       1
//
// The Dynamic Timewarp DP table for this cost matrix has cells defined by
//
// table[i][j] = cost(i,j) + min(table[i-1][j-1], table[i][j-1], table[i-1, j])
//
//        (2, 0)  (7, 0)  (8, 0)
// (1, 0)     1       7      14
// (5, 0)     4       3       7
// (6, 0)     8       4       6
// (9, 0)    15       6       5
//
// Starting at the bottom right corner of the DP table, we can work our way
// backwards to the upper left corner  to recover the reverse of the warp path:
// (3, 2) -> (2, 1) -> (1, 1) -> (0, 0). The VertexAlignment produced containing
// this has alignment_cost = 7 and warp_path = {(0, 0), (1, 1), (2, 1), (3, 2)}.
//
// We also provide methods for performing alignment of multiple sequences. These
// methods return a single, representative polyline from a non-empty collection
// of polylines, for various definitions of "representative."
//
// GetMedoidPolyline() returns a new polyline (point-for-point-equal to some
// existing polyline from the collection) that minimizes the summed vertex
// alignment cost to all other polylines in the collection.
//
// GetConsensusPolyline() returns a new polyline (unlikely to be present in the
// input collection) that represents a "weighted consensus" polyline. This
// polyline is constructed iteratively using the Dynamic Timewarp Barycenter
// Averaging algorithm of F. Petitjean, A. Ketterlin, and P. Gancarski, which
// can be found here:
// https://pdfs.semanticscholar.org/a596/8ca9488199291ffe5473643142862293d69d.pdf

// A columnStride is a [start, end) range of columns in a search window.
// It enables us to lazily fill up our costTable structures by providing bounds
// checked access for reads. We also use them to keep track of structured,
// sparse window matrices by tracking start and end columns for each row.
type columnStride struct {
	start int
	end   int
}

// InRange reports if the given index is in range of this stride.
func (c columnStride) InRange(index int) bool {
	return c.start <= index && index < c.end
}

// allColumnStride returns a columnStride where inRange evaluates to `true` for all
// non-negative inputs less than math.MaxInt.
func allColumnStride() columnStride {
	return columnStride{-1, math.MaxInt}
}

// A Window is a sparse binary matrix with specific structural constraints
// on allowed element configurations. It is used in this library to represent
// "search windows" for windowed dynamic timewarping.
//
// Valid Windows require the following structural conditions to hold:
//  1. All rows must consist of a single contiguous stride of `true` values.
//  2. All strides are greater than zero length (i.e. no empty rows).
//  3. The index of the first `true` column in a row must be at least as
//     large as the index of the first `true` column in the previous row.
//  4. The index of the last `true` column in a row must be at least as large
//     as the index of the last `true` column in the previous row.
//  5. strides[0].start = 0 (the first cell is always filled).
//  6. strides[n_rows-1].end = n_cols (the last cell is filled).
//
// Example valid strided_masks (* = filled, . = unfilled)
//
//	  0 1 2 3 4 5
//	0 * * * . . .
//	1 . * * * . .
//	2 . * * * . .
//	3 . . * * * *
//	4 . . * * * *
//
//	  0 1 2 3 4 5
//	0 * * * * . .
//	1 . * * * * .
//	2 . . * * * .
//	3 . . . . * *
//	4 . . . . . *
//
//	  0 1 2 3 4 5
//	0 * * . . . .
//	1 . * . . . .
//	2 . . * * * .
//	3 . . . . . *
//	4 . . . . . *
//
// Example invalid strided_masks:
//
//	0 1 2 3 4 5
//
// 0 * * * . * * <-- more than one continuous run
// 1 . * * * . .
// 2 . * * * . .
// 3 . . * * * *
// 4 . . * * * *
//
//	0 1 2 3 4 5
//
// 0 * * * . . .
// 1 . * * * . .
// 2 . * * * . .
// 3 * * * * * * <-- start index not monotonically increasing
// 4 . . * * * *
//
//	0 1 2 3 4 5
//
// 0 * * * . . .
// 1 . * * * * .
// 2 . * * * . . <-- end index not monotonically increasing
// 3 . . * * * *
// 4 . . * * * *
//
//	0 1 2 3 4 5
//
// 0 . * . . . . <-- does not fill upper left corner
// 1 . * . . . .
// 2 . * . . . .
// 3 . * * * . .
// 4 . . * * * *
type window struct {
	rows    int
	cols    int
	strides []columnStride
}

// windowFromStrides creates a window from the given columnStrides.
func windowFromStrides(strides []columnStride) *window {
	return &window{
		rows:    len(strides),
		cols:    strides[len(strides)-1].end,
		strides: strides,
	}
}

// TODO(rsned): Add windowFromWarpPath

// isValid reports if this windows data represents a valid window.
//
// Valid Windows require the following structural conditions to hold:
//  1. All rows must consist of a single contiguous stride of `true` values.
//  2. All strides are greater than zero length (i.e. no empty rows).
//  3. The index of the first `true` column in a row must be at least as
//     large as the index of the first `true` column in the previous row.
//  4. The index of the last `true` column in a row must be at least as large
//     as the index of the last `true` column in the previous row.
//  5. strides[0].start = 0 (the first cell is always filled).
//  6. strides[n_rows-1].end = n_cols (the last cell is filled).
func (w *window) isValid() bool {
	if w.rows <= 0 || w.cols <= 0 || len(w.strides) == 0 ||
		w.strides[0].start != 0 || w.strides[len(w.strides)-1].end != w.cols {
		return false
	}

	var prev = columnStride{-1, -1}
	for _, curr := range w.strides {
		if curr.end <= curr.start || curr.start < prev.start ||
			curr.end < prev.end {
			return false
		}
		prev = curr
	}
	return true

}

func (w *window) columnStride(row int) columnStride {
	return w.strides[row]
}

func (w *window) checkedColumnStride(row int) columnStride {
	if row < 0 {
		return allColumnStride()
	}
	return w.strides[row]
}

// upsample returns a new, larger window that is an upscaled version of this window.
//
// Used by ApproximateAlignment window expansion step.
func (w *window) upsample(newRows, newCols int) *window {
	// TODO(rsned): What to do if the upsample is actually a downsample.
	// C++ has this as a debug CHECK.
	rowScale := float64(newRows) / float64(w.rows)
	colScale := float64(newCols) / float64(w.cols)
	newStrides := make([]columnStride, newRows)
	var fromStride columnStride
	for row := 0; row < newRows; row++ {
		fromStride = w.strides[int((float64(row)+0.5)/rowScale)]
		newStrides[row] = columnStride{
			start: int(colScale*float64(fromStride.start) + 0.5),
			end:   int(colScale*float64(fromStride.end) + 0.5),
		}
	}
	return windowFromStrides(newStrides)
}

// dilate returns a new, equal-size window by dilating this window with a square
// structuring element with half-length `radius`. Radius = 1 corresponds to
// a 3x3 square morphological dilation.
//
// Used by ApproximateAlignment window expansion step.
func (w *window) dilate(radius int) *window {
	// This code takes advantage of the fact that the dilation window is square to
	// ensure that we can compute the stride for each output row in constant time.
	// TODO (mrdmnd): a potential optimization might be to combine this method and
	// the Upsample method into a single "Expand" method. For the sake of
	// testing, I haven't done that here, but I think it would be fairly
	// straightforward to do so. This method generally isn't very expensive so it
	// feels unnecessary to combine them.

	newStrides := make([]columnStride, w.rows)
	for row := 0; row < w.rows; row++ {
		prevRow := maxInt(0, row-radius)
		nextRow := minInt(row+radius, w.rows-1)
		newStrides[row] = columnStride{
			start: maxInt(0, w.strides[prevRow].start-radius),
			end:   minInt(w.strides[nextRow].end+radius, w.cols),
		}
	}

	return windowFromStrides(newStrides)
}

// debugString returns a string representation of this window.
func (w *window) debugString() string {
	var buf bytes.Buffer
	for _, row := range w.strides {
		for col := 0; col < w.cols; col++ {
			if row.InRange(col) {
				buf.WriteString(" *")
			} else {
				buf.WriteString(" .")
			}
		}
		buf.WriteString("\n")
	}
	return buf.String()
}

// halfResolution reduces the number of vertices of polyline p by selecting every other
// vertex for inclusion in a new polyline. Specifically, we take even-index
// vertices [0, 2, 4,...]. For an even-length polyline, the last vertex is not
// selected. For an odd-length polyline, the last vertex is selected.
// Constructs and returns a new Polyline in linear time.
func halfResolution(p *Polyline) *Polyline {
	var p2 Polyline
	for i := 0; i < len(*p); i += 2 {
		p2 = append(p2, (*p)[i])
	}

	return &p2
}

// warpPath represents a pairing between vertex
// a.vertex(i) and vertex b.vertex(j) in the optimal alignment.
// The warpPath is defined in forward order, such that the result of
// aligning polylines `a` and `b` is always a warpPath with warpPath[0] = {0,0}
// and warp_path[n] = {len(a) - 1, len(b)- 1}
//
// Note that this DOES NOT define an alignment from a point sequence to an
// edge sequence. That functionality may come at a later date.
type warpPath []warpPair
type warpPair struct{ a, b int }

type vertexAlignment struct {
	// alignmentCost represents the sum of the squared chordal distances
	// between each pair of vertices in the warp path. Specifically,
	// cost = sum_{(i, j) \in path} (a.vertex(i) - b.vertex(j)).Norm();
	// This means that the units of alignment_cost are distance. This is
	// an optimization to avoid the (expensive) atan computation of the true
	// spherical angular distance between the points. All we need to compute
	// vertex alignment is a metric that satisfies the triangle inequality, and
	// chordal distance works as well as spherical s1.Angle distance for
	// this purpose.
	alignmentCost float64
	warpPath      warpPath
}

type costTable [][]float64

func newCostTable(rows, cols int) costTable {
	c := make([][]float64, rows)
	for i := 0; i < rows; i++ {
		c[i] = make([]float64, cols)
	}
	return c
}

func (c costTable) String() string {
	var buf bytes.Buffer
	for i, row := range c {
		buf.WriteString(fmt.Sprintf("%2d: [", i))
		for _, col := range row {
			buf.WriteString(fmt.Sprintf("%0.3f, ", col))
		}
		buf.WriteString("]\n")
	}
	return buf.String()
}

func (c costTable) boundsCheckedTableCost(row, col int, stride columnStride) float64 {
	if row < 0 && col < 0 {
		return 0.0
	} else if row < 0 || col < 0 || !stride.InRange(col) {
		return math.MaxFloat64
	} else {
		return c[row][col]
	}
}

func (c costTable) cost() float64 {
	r := len(c) - 1
	return c[r][len(c[r])-1]
}

// ExactVertexAlignmentCost takes two non-empty polylines as input, and
// returns the *cost* of their optimal alignment. A standard, traditional
// dynamic timewarp algorithm can output both a warp path and a cost, but
// requires quadratic space to reconstruct the path by walking back through the
// Dynamic Programming cost table. If all you really need is the warp cost (i.e.
// you're inducing a similarity metric between Polylines, or something
// equivalent), you can overwrite the DP table and use constant space -
// O(max(A,B)). This method provides that space-efficiency optimization.
func ExactVertexAlignmentCost(a, b *Polyline) float64 {
	aN := len(*a)
	bN := len(*b)
	cost := make([]float64, bN)
	for i := 0; i < bN; i++ {
		cost[i] = math.MaxFloat64
	}
	leftDiagMinCost := 0.0
	for row := 0; row < aN; row++ {
		for col := 0; col < bN; col++ {
			upCost := cost[col]
			cost[col] = math.Min(leftDiagMinCost, upCost) +
				(*a)[row].Sub((*b)[col].Vector).Norm()
			leftDiagMinCost = math.Min(cost[col], upCost)
		}
		leftDiagMinCost = math.MaxFloat64
	}
	return cost[len(cost)-1]
}

// ExactVertexAlignment takes two non-empty polylines as input, and returns
// the VertexAlignment corresponding to the optimal alignment between them. This
// method is quadratic O(A*B) in both space and time complexity.
func ExactVertexAlignment(a, b *Polyline) *vertexAlignment {
	aN := len(*a)
	bN := len(*b)
	strides := make([]columnStride, aN)
	for i := 0; i < aN; i++ {
		strides[i] = columnStride{start: 0, end: bN}
	}
	w := windowFromStrides(strides)

	return dynamicTimewarp(a, b, w)
}

// Perform dynamic timewarping by filling in the DP table on cells that are
// inside our search window. For an exact (all-squares) evaluation, this
// incurs bounds checking overhead - we don't need to ensure that we're inside
// the appropriate cells in the window, because it's guaranteed. Structuring
// the program to reuse code for both the EXACT and WINDOWED cases by
// abstracting EXACT as a window with full-covering strides is done for
// maintainability reasons. One potential optimization here might be to overload
// this function to skip bounds checking when the window is full.
//
// As a note of general interest, the Dynamic Timewarp algorithm as stated here
// prefers shorter warp paths, when two warp paths might be equally costly. This
// is because it favors progressing in the sequences simultaneously due to the
// equal weighting of a diagonal step in the cost table with a horizontal or
// vertical step. This may be counterintuitive, but represents the standard
// implementation of this algorithm. TODO(user) - future implementations could
// allow weights on the lookup costs to mitigate this.
//
// This is the hottest routine in the whole package, please be careful to
// profile any future changes made here.
//
// This method takes time proportional to the number of cells in the window,
// which can range from O(max(a, b)) cells (best) to O(a*b) cells (worst)
func dynamicTimewarp(a, b *Polyline, w *window) *vertexAlignment {
	rows := len(*a)
	cols := len(*b)
	costs := newCostTable(rows, cols)

	var curr columnStride
	prev := allColumnStride()

	for row := 0; row < rows; row++ {
		curr = w.columnStride(row)
		for col := curr.start; col < curr.end; col++ {
			// The total cost up to (row,col) is the minimum of the cost up, down,
			// left and the distance between the points in row and col. We use
			// the distance between the points, as we are trying to minimize the
			// distance between the two polylines.
			dCost := costs.boundsCheckedTableCost(row-1, col-1, prev)
			uCost := costs.boundsCheckedTableCost(row-1, col-0, prev)
			lCost := costs.boundsCheckedTableCost(row-0, col-1, curr)

			costs[row][col] = minFloat64(dCost, uCost, lCost) +
				(*a)[row].Sub((*b)[col].Vector).Norm()
		}
		prev = curr
	}

	// Now we walk back through the cost table and build up the warp path.
	// Somewhat surprisingly, it is faster to recover the path this way than it
	// is to save the comparisons from the computation we *already did* to get the
	// direction we came from. The author speculates that this behavior is
	// assignment-cost-related: to persist direction, we have to do extra
	// stores/loads of "directional" information, and the extra assignment cost
	// this incurs is larger than the cost to simply redo the comparisons.
	// It's probably worth revisiting this assumption in the future.
	// As it turns out, the following code ends up effectively free.
	warpPath := make([]warpPair, 0, maxInt(rows, cols))
	row := rows - 1
	col := cols - 1
	curr = w.checkedColumnStride(row)
	prev = w.checkedColumnStride(row - 1)
	for row >= 0 && col >= 0 {
		warpPath = append(warpPath, warpPair{row, col})
		dCost := costs.boundsCheckedTableCost(row-1, col-1, prev)
		uCost := costs.boundsCheckedTableCost(row-1, col-0, prev)
		lCost := costs.boundsCheckedTableCost(row-0, col-1, curr)

		if dCost <= uCost && dCost <= lCost {
			row -= 1
			col -= 1
			curr = w.checkedColumnStride(row)
			prev = w.checkedColumnStride(row - 1)
		} else if uCost <= lCost {
			row -= 1
			curr = w.checkedColumnStride(row)
			prev = w.checkedColumnStride(row - 1)
		} else {
			col -= 1
		}
	}

	// TODO(rsned): warpPath.reverse
	return &vertexAlignment{alignmentCost: costs.cost(), warpPath: warpPath}
}

// TODO(rsned): Differences from C++
// ApproxVertexAlignment/Cost
// MedoidPolyline / Options
// ConsensusPolyline / Options
