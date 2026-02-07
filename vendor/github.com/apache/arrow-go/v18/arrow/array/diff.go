// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package array

import (
	"fmt"
	"strings"

	"github.com/apache/arrow-go/v18/arrow"
)

// Edit represents one entry in the edit script to compare two arrays.
type Edit struct {
	Insert    bool
	RunLength int64
}

// Edits is a slice of Edit structs that represents an edit script to compare two arrays.
// When applied to the base array, it produces the target array.
// Each element of "insert" determines whether an element was inserted into (true)
// or deleted from (false) base. Each insertion or deletion is followed by a run of
// elements which are unchanged from base to target; the length of this run is stored
// in RunLength. (Note that the edit script begins and ends with a run of shared
// elements but both fields of the struct must have the same length. To accommodate this
// the first element of "insert" should be ignored.)
//
// For example for base "hlloo" and target "hello", the edit script would be
// [
//
//	{"insert": false, "run_length": 1}, // leading run of length 1 ("h")
//	{"insert": true, "run_length": 3}, // insert("e") then a run of length 3 ("llo")
//	{"insert": false, "run_length": 0} // delete("o") then an empty run
//
// ]
type Edits []Edit

// String returns a simple string representation of the edit script.
func (e Edits) String() string {
	return fmt.Sprintf("%v", []Edit(e))
}

// UnifiedDiff returns a string representation of the diff of base and target in Unified Diff format.
func (e Edits) UnifiedDiff(base, target arrow.Array) string {
	var s strings.Builder
	baseIndex := int64(0)
	targetIndex := int64(0)
	wrotePosition := false
	for i := 0; i < len(e); i++ {
		if i > 0 {
			if !wrotePosition {
				s.WriteString(fmt.Sprintf("@@ -%d, +%d @@\n", baseIndex, targetIndex))
				wrotePosition = true
			}
			if e[i].Insert {
				s.WriteString(fmt.Sprintf("+%v\n", stringAt(target, targetIndex)))
				targetIndex++
			} else {
				s.WriteString(fmt.Sprintf("-%v\n", stringAt(base, baseIndex)))
				baseIndex++
			}
		}
		for j := int64(0); j < e[i].RunLength; j++ {
			baseIndex++
			targetIndex++
			wrotePosition = false
		}
	}
	return s.String()
}

func stringAt(arr arrow.Array, i int64) string {
	if arr.IsNull(int(i)) {
		return "null"
	}
	dt := arr.DataType()
	switch {
	case arrow.TypeEqual(dt, arrow.PrimitiveTypes.Float32):
		return fmt.Sprintf("%f", arr.(*Float32).Value(int(i)))
	case arrow.TypeEqual(dt, arrow.PrimitiveTypes.Float64):
		return fmt.Sprintf("%f", arr.(*Float64).Value(int(i)))
	case arrow.TypeEqual(dt, arrow.PrimitiveTypes.Date32):
		return arr.(*Date32).Value(int(i)).FormattedString()
	case arrow.TypeEqual(dt, arrow.PrimitiveTypes.Date64):
		return arr.(*Date64).Value(int(i)).FormattedString()
	case arrow.TypeEqual(dt, arrow.FixedWidthTypes.Timestamp_s):
		return arr.(*Timestamp).Value(int(i)).ToTime(arrow.Second).String()
	case arrow.TypeEqual(dt, arrow.FixedWidthTypes.Timestamp_ms):
		return arr.(*Timestamp).Value(int(i)).ToTime(arrow.Millisecond).String()
	case arrow.TypeEqual(dt, arrow.FixedWidthTypes.Timestamp_us):
		return arr.(*Timestamp).Value(int(i)).ToTime(arrow.Microsecond).String()
	case arrow.TypeEqual(dt, arrow.FixedWidthTypes.Timestamp_ns):
		return arr.(*Timestamp).Value(int(i)).ToTime(arrow.Nanosecond).String()
	}
	s := NewSlice(arr, i, i+1)
	defer s.Release()
	st, _ := s.MarshalJSON()
	return strings.Trim(string(st[1:len(st)-1]), "\n")
}

// Diff compares two arrays, returning an edit script which expresses the difference
// between them. The edit script can be applied to the base array to produce the target.
// 'base' is a baseline for comparison.
// 'target' is an array of identical type to base whose elements differ from base's.
func Diff(base, target arrow.Array) (edits Edits, err error) {
	if !arrow.TypeEqual(base.DataType(), target.DataType()) {
		return nil, fmt.Errorf("%w: only taking the diff of like-typed arrays is supported", arrow.ErrNotImplemented)
	}
	switch base.DataType().ID() {
	case arrow.EXTENSION:
		return Diff(base.(ExtensionArray).Storage(), target.(ExtensionArray).Storage())
	case arrow.DICTIONARY:
		return nil, fmt.Errorf("%w: diffing arrays of type %s is not implemented", arrow.ErrNotImplemented, base.DataType())
	case arrow.RUN_END_ENCODED:
		return nil, fmt.Errorf("%w: diffing arrays of type %s is not implemented", arrow.ErrNotImplemented, base.DataType())
	}
	d := newQuadraticSpaceMyersDiff(base, target)
	return d.Diff()
}

// editPoint represents an intermediate state in the comparison of two arrays
type editPoint struct {
	base   int
	target int
}

type quadraticSpaceMyersDiff struct {
	base         arrow.Array
	target       arrow.Array
	finishIndex  int
	editCount    int
	endpointBase []int
	insert       []bool
	baseBegin    int
	targetBegin  int
	baseEnd      int
	targetEnd    int
}

func newQuadraticSpaceMyersDiff(base, target arrow.Array) *quadraticSpaceMyersDiff {
	d := &quadraticSpaceMyersDiff{
		base:         base,
		target:       target,
		finishIndex:  -1,
		editCount:    0,
		endpointBase: []int{},
		insert:       []bool{},
		baseBegin:    0,
		targetBegin:  0,
		baseEnd:      base.Len(),
		targetEnd:    target.Len(),
	}
	d.endpointBase = []int{d.extendFrom(editPoint{d.baseBegin, d.targetBegin}).base}
	if d.baseEnd-d.baseBegin == d.targetEnd-d.targetBegin && d.endpointBase[0] == d.baseEnd {
		// trivial case: base == target
		d.finishIndex = 0
	}
	return d
}

func (d *quadraticSpaceMyersDiff) valuesEqual(baseIndex, targetIndex int) bool {
	baseNull := d.base.IsNull(baseIndex)
	targetNull := d.target.IsNull(targetIndex)
	if baseNull || targetNull {
		return baseNull && targetNull
	}
	return SliceEqual(d.base, int64(baseIndex), int64(baseIndex+1), d.target, int64(targetIndex), int64(targetIndex+1))
}

// increment the position within base and target (the elements skipped in this way were
// present in both sequences)
func (d *quadraticSpaceMyersDiff) extendFrom(p editPoint) editPoint {
	for p.base != d.baseEnd && p.target != d.targetEnd {
		if !d.valuesEqual(p.base, p.target) {
			break
		}
		p.base++
		p.target++
	}
	return p
}

// increment the position within base (the element pointed to was deleted)
// then extend maximally
func (d *quadraticSpaceMyersDiff) deleteOne(p editPoint) editPoint {
	if p.base != d.baseEnd {
		p.base++
	}
	return d.extendFrom(p)
}

// increment the position within target (the element pointed to was inserted)
// then extend maximally
func (d *quadraticSpaceMyersDiff) insertOne(p editPoint) editPoint {
	if p.target != d.targetEnd {
		p.target++
	}
	return d.extendFrom(p)
}

// beginning of a range for storing per-edit state in endpointBase and insert
func storageOffset(editCount int) int {
	return editCount * (editCount + 1) / 2
}

// given edit_count and index, augment endpointBase[index] with the corresponding
// position in target (which is only implicitly represented in editCount, index)
func (d *quadraticSpaceMyersDiff) getEditPoint(editCount, index int) editPoint {
	insertionsMinusDeletions := 2*(index-storageOffset(editCount)) - editCount
	maximalBase := d.endpointBase[index]
	maximalTarget := min(d.targetBegin+((maximalBase-d.baseBegin)+insertionsMinusDeletions), d.targetEnd)
	return editPoint{maximalBase, maximalTarget}
}

func (d *quadraticSpaceMyersDiff) Next() {
	d.editCount++
	if len(d.endpointBase) < storageOffset(d.editCount+1) {
		d.endpointBase = append(d.endpointBase, make([]int, storageOffset(d.editCount+1)-len(d.endpointBase))...)
	}
	if len(d.insert) < storageOffset(d.editCount+1) {
		d.insert = append(d.insert, make([]bool, storageOffset(d.editCount+1)-len(d.insert))...)
	}
	previousOffset := storageOffset(d.editCount - 1)
	currentOffset := storageOffset(d.editCount)

	// try deleting from base first
	for i, iOut := 0, 0; i < d.editCount; i, iOut = i+1, iOut+1 {
		previousEndpoint := d.getEditPoint(d.editCount-1, i+previousOffset)
		d.endpointBase[iOut+currentOffset] = d.deleteOne(previousEndpoint).base
	}

	// check if inserting from target could do better
	for i, iOut := 0, 1; i < d.editCount; i, iOut = i+1, iOut+1 {
		// retrieve the previously computed best endpoint for (editCount, iOut)
		// for comparison with the best endpoint achievable with an insertion
		endpointAfterDeletion := d.getEditPoint(d.editCount, iOut+currentOffset)

		previousEndpoint := d.getEditPoint(d.editCount-1, i+previousOffset)
		endpointAfterInsertion := d.insertOne(previousEndpoint)

		if endpointAfterInsertion.base-endpointAfterDeletion.base >= 0 {
			// insertion was more efficient; keep it and mark the insertion in insert
			d.insert[iOut+currentOffset] = true
			d.endpointBase[iOut+currentOffset] = endpointAfterInsertion.base
		}
	}

	finish := editPoint{d.baseEnd, d.targetEnd}
	for iOut := 0; iOut < d.editCount+1; iOut++ {
		if d.getEditPoint(d.editCount, iOut+currentOffset) == finish {
			d.finishIndex = iOut + currentOffset
			return
		}
	}
}

func (d *quadraticSpaceMyersDiff) Done() bool {
	return d.finishIndex != -1
}

func (d *quadraticSpaceMyersDiff) GetEdits() (Edits, error) {
	if !d.Done() {
		panic("GetEdits called but Done() = false")
	}

	length := d.editCount + 1
	edits := make(Edits, length)
	index := d.finishIndex
	endpoint := d.getEditPoint(d.editCount, d.finishIndex)

	for i := d.editCount; i > 0; i-- {
		insert := d.insert[index]
		edits[i].Insert = insert
		insertionsMinusDeletions := (endpoint.base - d.baseBegin) - (endpoint.target - d.targetBegin)
		if insert {
			insertionsMinusDeletions++
		} else {
			insertionsMinusDeletions--
		}
		index = (i-1-insertionsMinusDeletions)/2 + storageOffset(i-1)

		// endpoint of previous edit
		previous := d.getEditPoint(i-1, index)
		in := 0
		if insert {
			in = 1
		}
		edits[i].RunLength = int64(endpoint.base - previous.base - (1 - in))
		endpoint = previous
	}
	edits[0].Insert = false
	edits[0].RunLength = int64(endpoint.base - d.baseBegin)

	return edits, nil
}

func (d *quadraticSpaceMyersDiff) Diff() (edits Edits, err error) {
	for !d.Done() {
		d.Next()
	}
	return d.GetEdits()
}
