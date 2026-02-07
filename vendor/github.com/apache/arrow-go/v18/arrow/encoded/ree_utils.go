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

package encoded

import (
	"math"
	"sort"

	"github.com/apache/arrow-go/v18/arrow"
)

// FindPhysicalIndex performs a binary search on the run-ends to return
// the appropriate physical offset into the values/run-ends that corresponds
// with the logical index provided when called. If the array's logical offset
// is provided, this is equivalent to calling FindPhysicalOffset.
//
// For example, an array with run-ends [10, 20, 30, 40, 50] and a logicalIdx
// of 25 will return the value 2. This returns the smallest offset
// whose run-end is greater than the logicalIdx requested, which would
// also be the index into the values that contains the correct value.
//
// This function assumes it receives Run End Encoded array data
func FindPhysicalIndex(arr arrow.ArrayData, logicalIdx int) int {
	data := arr.Children()[0]
	if data.Len() == 0 {
		return 0
	}

	switch data.DataType().ID() {
	case arrow.INT16:
		runEnds := arrow.Int16Traits.CastFromBytes(data.Buffers()[1].Bytes())
		runEnds = runEnds[data.Offset() : data.Offset()+data.Len()]
		return sort.Search(len(runEnds), func(i int) bool { return runEnds[i] > int16(logicalIdx) })
	case arrow.INT32:
		runEnds := arrow.Int32Traits.CastFromBytes(data.Buffers()[1].Bytes())
		runEnds = runEnds[data.Offset() : data.Offset()+data.Len()]
		return sort.Search(len(runEnds), func(i int) bool { return runEnds[i] > int32(logicalIdx) })
	case arrow.INT64:
		runEnds := arrow.Int64Traits.CastFromBytes(data.Buffers()[1].Bytes())
		runEnds = runEnds[data.Offset() : data.Offset()+data.Len()]
		return sort.Search(len(runEnds), func(i int) bool { return runEnds[i] > int64(logicalIdx) })
	default:
		panic("only int16, int32, and int64 are allowed for the run-ends")
	}
}

// FindPhysicalOffset performs a binary search on the run-ends to return
// the appropriate physical offset into the values/run-ends that corresponds
// with the logical offset defined in the array.
//
// For example, an array with run-ends [10, 20, 30, 40, 50] and a logical
// offset of 25 will return the value 2. This returns the smallest offset
// whose run-end is greater than the logical offset, which would also be the
// offset index into the values that contains the correct value.
//
// This function assumes it receives Run End Encoded array data
func FindPhysicalOffset(arr arrow.ArrayData) int {
	return FindPhysicalIndex(arr, arr.Offset())
}

// GetPhysicalLength returns the physical number of values which are in
// the passed in RunEndEncoded array data. This will take into account
// the offset and length of the array as reported in the array data
// (so that it properly handles slices).
//
// This function assumes it receives Run End Encoded array data
func GetPhysicalLength(arr arrow.ArrayData) int {
	if arr.Len() == 0 {
		return 0
	}

	data := arr.Children()[0]
	physicalOffset := FindPhysicalOffset(arr)
	start, length := data.Offset()+physicalOffset, data.Len()-physicalOffset
	offset := arr.Offset() + arr.Len() - 1

	switch data.DataType().ID() {
	case arrow.INT16:
		runEnds := arrow.Int16Traits.CastFromBytes(data.Buffers()[1].Bytes())
		runEnds = runEnds[start : start+length]
		return sort.Search(len(runEnds), func(i int) bool { return runEnds[i] > int16(offset) }) + 1
	case arrow.INT32:
		runEnds := arrow.Int32Traits.CastFromBytes(data.Buffers()[1].Bytes())
		runEnds = runEnds[start : start+length]
		return sort.Search(len(runEnds), func(i int) bool { return runEnds[i] > int32(offset) }) + 1
	case arrow.INT64:
		runEnds := arrow.Int64Traits.CastFromBytes(data.Buffers()[1].Bytes())
		runEnds = runEnds[start : start+length]
		return sort.Search(len(runEnds), func(i int) bool { return runEnds[i] > int64(offset) }) + 1
	default:
		panic("arrow/rle: can only get rle.PhysicalLength for int16/int32/int64 run ends array")
	}
}

func getRunEnds(arr arrow.ArrayData) func(int64) int64 {
	switch arr.DataType().ID() {
	case arrow.INT16:
		runEnds := arrow.Int16Traits.CastFromBytes(arr.Buffers()[1].Bytes())
		runEnds = runEnds[arr.Offset() : arr.Offset()+arr.Len()]
		return func(i int64) int64 { return int64(runEnds[i]) }
	case arrow.INT32:
		runEnds := arrow.Int32Traits.CastFromBytes(arr.Buffers()[1].Bytes())
		runEnds = runEnds[arr.Offset() : arr.Offset()+arr.Len()]
		return func(i int64) int64 { return int64(runEnds[i]) }
	case arrow.INT64:
		runEnds := arrow.Int64Traits.CastFromBytes(arr.Buffers()[1].Bytes())
		runEnds = runEnds[arr.Offset() : arr.Offset()+arr.Len()]
		return func(i int64) int64 { return int64(runEnds[i]) }
	default:
		panic("only int16, int32, and int64 are allowed for the run-ends")
	}
}

// MergedRuns is used to take two Run End Encoded arrays and iterate
// them, finding the correct physical indices to correspond with the
// runs.
type MergedRuns struct {
	inputs       [2]arrow.Array
	runIndex     [2]int64
	inputRunEnds [2]func(int64) int64
	runEnds      [2]int64
	logicalLen   int
	logicalPos   int
	mergedEnd    int64
}

// NewMergedRuns takes two RunEndEncoded arrays and returns a MergedRuns
// object that will allow iterating over the physical indices of the runs.
func NewMergedRuns(inputs [2]arrow.Array) *MergedRuns {
	if len(inputs) == 0 {
		return &MergedRuns{logicalLen: 0}
	}

	mr := &MergedRuns{inputs: inputs, logicalLen: inputs[0].Len()}
	for i, in := range inputs {
		if in.DataType().ID() != arrow.RUN_END_ENCODED {
			panic("arrow/rle: NewMergedRuns can only be called with RunLengthEncoded arrays")
		}
		if in.Len() != mr.logicalLen {
			panic("arrow/rle: can only merge runs of RLE arrays of the same length")
		}

		mr.inputRunEnds[i] = getRunEnds(in.Data().Children()[0])
		// initialize the runIndex at the physical offset - 1 so the first
		// call to Next will increment it to the correct initial offset
		// since the initial state is logicalPos == 0 and mergedEnd == 0
		mr.runIndex[i] = int64(FindPhysicalOffset(in.Data())) - 1
	}

	return mr
}

// Next returns true if there are more values/runs to iterate and false
// when one of the arrays has reached the end.
func (mr *MergedRuns) Next() bool {
	mr.logicalPos = int(mr.mergedEnd)
	if mr.isEnd() {
		return false
	}

	for i := range mr.inputs {
		if mr.logicalPos == int(mr.runEnds[i]) {
			mr.runIndex[i]++
		}
	}
	mr.findMergedRun()

	return true
}

// IndexIntoBuffer returns the physical index into the value buffer of
// the passed in array index (ie: 0 for the first array and 1 for the second)
// this takes into account the offset of the array so it is the true physical
// index into the value *buffer* in the child.
func (mr *MergedRuns) IndexIntoBuffer(id int) int64 {
	return mr.runIndex[id] + int64(mr.inputs[id].Data().Children()[1].Offset())
}

// IndexIntoArray is like IndexIntoBuffer but it doesn't take into account
// the array offset and instead is the index that can be used with the .Value
// method on the array to get the correct value.
func (mr *MergedRuns) IndexIntoArray(id int) int64 { return mr.runIndex[id] }

// RunLength returns the logical length of the current merged run being looked at.
func (mr *MergedRuns) RunLength() int64 { return mr.mergedEnd - int64(mr.logicalPos) }

// AccumulatedRunLength returns the logical run end of the current merged run.
func (mr *MergedRuns) AccumulatedRunLength() int64 { return mr.mergedEnd }

func (mr *MergedRuns) findMergedRun() {
	mr.mergedEnd = int64(math.MaxInt64)
	for i, in := range mr.inputs {
		// logical indices of the end of the run we are currently in each input
		mr.runEnds[i] = int64(mr.inputRunEnds[i](mr.runIndex[i]) - int64(in.Data().Offset()))
		// the logical length may end in the middle of a run, in case the array was sliced
		if mr.logicalLen < int(mr.runEnds[i]) {
			mr.runEnds[i] = int64(mr.logicalLen)
		}
		if mr.runEnds[i] < mr.mergedEnd {
			mr.mergedEnd = mr.runEnds[i]
		}
	}
}

func (mr *MergedRuns) isEnd() bool { return mr.logicalPos == mr.logicalLen }
