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
	"bytes"
	"fmt"
	"math"
	"reflect"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/encoded"
	"github.com/apache/arrow-go/v18/arrow/internal/debug"
	"github.com/apache/arrow-go/v18/arrow/memory"
	"github.com/apache/arrow-go/v18/internal/json"
	"github.com/apache/arrow-go/v18/internal/utils"
)

// RunEndEncoded represents an array containing two children:
// an array of int32 values defining the ends of each run of values
// and an array of values
type RunEndEncoded struct {
	array

	ends   arrow.Array
	values arrow.Array
}

func NewRunEndEncodedArray(runEnds, values arrow.Array, logicalLength, offset int) *RunEndEncoded {
	data := NewData(arrow.RunEndEncodedOf(runEnds.DataType(), values.DataType()), logicalLength,
		[]*memory.Buffer{nil}, []arrow.ArrayData{runEnds.Data(), values.Data()}, 0, offset)
	defer data.Release()
	return NewRunEndEncodedData(data)
}

func NewRunEndEncodedData(data arrow.ArrayData) *RunEndEncoded {
	r := &RunEndEncoded{}
	r.refCount.Add(1)
	r.setData(data.(*Data))
	return r
}

func (r *RunEndEncoded) Values() arrow.Array     { return r.values }
func (r *RunEndEncoded) RunEndsArr() arrow.Array { return r.ends }

func (r *RunEndEncoded) Retain() {
	r.array.Retain()
	r.values.Retain()
	r.ends.Retain()
}

func (r *RunEndEncoded) Release() {
	r.array.Release()
	r.values.Release()
	r.ends.Release()
}

// LogicalValuesArray returns an array holding the values of each
// run, only over the range of run values inside the logical offset/length
// range of the parent array.
//
// # Example
//
// For this array:
//
//	RunEndEncoded: { Offset: 150, Length: 1500 }
//	    RunEnds: [ 1, 2, 4, 6, 10, 1000, 1750, 2000 ]
//	    Values:  [ "a", "b", "c", "d", "e", "f", "g", "h" ]
//
// LogicalValuesArray will return the following array:
//
//	[ "f", "g" ]
//
// This is because the offset of 150 tells it to skip the values until
// "f" which corresponds with the logical offset (the run from 10 - 1000),
// and stops after "g" because the length + offset goes to 1650 which is
// within the run from 1000 - 1750, corresponding to the "g" value.
//
// # Note
//
// The return from this needs to be Released.
func (r *RunEndEncoded) LogicalValuesArray() arrow.Array {
	physOffset := r.GetPhysicalOffset()
	physLength := r.GetPhysicalLength()
	data := NewSliceData(r.data.Children()[1], int64(physOffset), int64(physOffset+physLength))
	defer data.Release()
	return MakeFromData(data)
}

// LogicalRunEndsArray returns an array holding the logical indexes
// of each run end, only over the range of run end values relative
// to the logical offset/length range of the parent array.
//
// For arrays with an offset, this is not a slice of the existing
// internal run ends array. Instead a new array is created with run-ends
// that are adjusted so the new array can have an offset of 0. As a result
// this method can be expensive to call for an array with a non-zero offset.
//
// # Example
//
// For this array:
//
//	RunEndEncoded: { Offset: 150, Length: 1500 }
//	    RunEnds: [ 1, 2, 4, 6, 10, 1000, 1750, 2000 ]
//	    Values:  [ "a", "b", "c", "d", "e", "f", "g", "h" ]
//
// LogicalRunEndsArray will return the following array:
//
//	[ 850, 1500 ]
//
// This is because the offset of 150 tells us to skip all run-ends less
// than 150 (by finding the physical offset), and we adjust the run-ends
// accordingly (1000 - 150 = 850). The logical length of the array is 1500,
// so we know we don't want to go past the 1750 run end. Thus the last
// run-end is determined by doing: min(1750 - 150, 1500) = 1500.
//
// # Note
//
// The return from this needs to be Released
func (r *RunEndEncoded) LogicalRunEndsArray(mem memory.Allocator) arrow.Array {
	physOffset := r.GetPhysicalOffset()
	physLength := r.GetPhysicalLength()

	if r.data.offset == 0 {
		data := NewSliceData(r.data.childData[0], 0, int64(physLength))
		defer data.Release()
		return MakeFromData(data)
	}

	bldr := NewBuilder(mem, r.data.childData[0].DataType())
	defer bldr.Release()
	bldr.Resize(physLength)

	switch e := r.ends.(type) {
	case *Int16:
		for _, v := range e.Int16Values()[physOffset : physOffset+physLength] {
			v -= int16(r.data.offset)
			v = int16(utils.Min(int(v), r.data.length))
			bldr.(*Int16Builder).Append(v)
		}
	case *Int32:
		for _, v := range e.Int32Values()[physOffset : physOffset+physLength] {
			v -= int32(r.data.offset)
			v = int32(utils.Min(int(v), r.data.length))
			bldr.(*Int32Builder).Append(v)
		}
	case *Int64:
		for _, v := range e.Int64Values()[physOffset : physOffset+physLength] {
			v -= int64(r.data.offset)
			v = int64(utils.Min(int(v), r.data.length))
			bldr.(*Int64Builder).Append(v)
		}
	}

	return bldr.NewArray()
}

func (r *RunEndEncoded) setData(data *Data) {
	if len(data.childData) != 2 {
		panic(fmt.Errorf("%w: arrow/array: RLE array must have exactly 2 children", arrow.ErrInvalid))
	}
	debug.Assert(data.dtype.ID() == arrow.RUN_END_ENCODED, "invalid type for RunLengthEncoded")
	if !data.dtype.(*arrow.RunEndEncodedType).ValidRunEndsType(data.childData[0].DataType()) {
		panic(fmt.Errorf("%w: arrow/array: run ends array must be int16, int32, or int64", arrow.ErrInvalid))
	}
	if data.childData[0].NullN() > 0 {
		panic(fmt.Errorf("%w: arrow/array: run ends array cannot contain nulls", arrow.ErrInvalid))
	}

	r.array.setData(data)

	r.ends = MakeFromData(r.data.childData[0])
	r.values = MakeFromData(r.data.childData[1])
}

func (r *RunEndEncoded) GetPhysicalOffset() int {
	return encoded.FindPhysicalOffset(r.data)
}

func (r *RunEndEncoded) GetPhysicalLength() int {
	return encoded.GetPhysicalLength(r.data)
}

// GetPhysicalIndex can be used to get the run-encoded value instead of costly LogicalValuesArray
// in the following way:
//
//	r.Values().(valuetype).Value(r.GetPhysicalIndex(i))
func (r *RunEndEncoded) GetPhysicalIndex(i int) int {
	return encoded.FindPhysicalIndex(r.data, i+r.data.offset)
}

// ValueStr will return the str representation of the value at the logical offset i.
func (r *RunEndEncoded) ValueStr(i int) string {
	return r.values.ValueStr(r.GetPhysicalIndex(i))
}

func (r *RunEndEncoded) String() string {
	physOffset := r.GetPhysicalOffset()
	physLength := r.GetPhysicalLength()

	var buf bytes.Buffer
	buf.WriteByte('[')
	for i := physOffset; i < physOffset+physLength; i++ {
		if i != physOffset {
			buf.WriteByte(',')
		}

		value := r.values.GetOneForMarshal(i)
		if byts, ok := value.(json.RawMessage); ok {
			value = string(byts)
		}

		var runEnd int
		switch e := r.ends.GetOneForMarshal(i).(type) {
		case int16:
			runEnd = int(e) - r.data.offset
		case int32:
			runEnd = int(e) - r.data.offset
		case int64:
			runEnd = int(e) - r.data.offset
		}
		fmt.Fprintf(&buf, "{%d -> %v}", runEnd, value)
	}

	buf.WriteByte(']')
	return buf.String()
}

func (r *RunEndEncoded) GetOneForMarshal(i int) interface{} {
	return r.values.GetOneForMarshal(r.GetPhysicalIndex(i))
}

func (r *RunEndEncoded) MarshalJSON() ([]byte, error) {
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	buf.WriteByte('[')
	for i := 0; i < r.Len(); i++ {
		if i != 0 {
			buf.WriteByte(',')
		}
		if err := enc.Encode(r.GetOneForMarshal(i)); err != nil {
			return nil, err
		}
	}
	buf.WriteByte(']')
	return buf.Bytes(), nil
}

func arrayRunEndEncodedEqual(l, r *RunEndEncoded) bool {
	// types were already checked before getting here, so we know
	// the encoded types are equal
	mr := encoded.NewMergedRuns([2]arrow.Array{l, r})
	for mr.Next() {
		lIndex := mr.IndexIntoArray(0)
		rIndex := mr.IndexIntoArray(1)
		if !SliceEqual(l.values, lIndex, lIndex+1, r.values, rIndex, rIndex+1) {
			return false
		}
	}
	return true
}

func arrayRunEndEncodedApproxEqual(l, r *RunEndEncoded, opt equalOption) bool {
	// types were already checked before getting here, so we know
	// the encoded types are equal
	mr := encoded.NewMergedRuns([2]arrow.Array{l, r})
	for mr.Next() {
		lIndex := mr.IndexIntoArray(0)
		rIndex := mr.IndexIntoArray(1)
		if !sliceApproxEqual(l.values, lIndex, lIndex+1, r.values, rIndex, rIndex+1, opt) {
			return false
		}
	}
	return true
}

type RunEndEncodedBuilder struct {
	builder

	dt        arrow.DataType
	runEnds   Builder
	values    Builder
	maxRunEnd uint64

	// currently, mixing AppendValueFromString & UnmarshalOne is unsupported
	lastUnmarshalled interface{}
	unmarshalled     bool // tracks if Unmarshal was called (in case lastUnmarshalled is nil)
	lastStr          *string
}

func NewRunEndEncodedBuilder(mem memory.Allocator, runEnds, encoded arrow.DataType) *RunEndEncodedBuilder {
	dt := arrow.RunEndEncodedOf(runEnds, encoded)
	if !dt.ValidRunEndsType(runEnds) {
		panic("arrow/ree: invalid runEnds type for run length encoded array")
	}

	var maxEnd uint64
	switch runEnds.ID() {
	case arrow.INT16:
		maxEnd = math.MaxInt16
	case arrow.INT32:
		maxEnd = math.MaxInt32
	case arrow.INT64:
		maxEnd = math.MaxInt64
	}
	reb := &RunEndEncodedBuilder{
		builder:          builder{mem: mem},
		dt:               dt,
		runEnds:          NewBuilder(mem, runEnds),
		values:           NewBuilder(mem, encoded),
		maxRunEnd:        maxEnd,
		lastUnmarshalled: nil,
	}
	reb.refCount.Add(1)
	return reb
}

func (b *RunEndEncodedBuilder) Type() arrow.DataType {
	return b.dt
}

func (b *RunEndEncodedBuilder) Release() {
	debug.Assert(b.refCount.Load() > 0, "too many releases")

	if b.refCount.Add(-1) == 0 {
		b.values.Release()
		b.runEnds.Release()
	}
}

func (b *RunEndEncodedBuilder) addLength(n uint64) {
	if uint64(b.length)+n > b.maxRunEnd {
		panic(fmt.Errorf("%w: %s array length must fit be less than %d", arrow.ErrInvalid, b.dt, b.maxRunEnd))
	}

	b.length += int(n)
}

func (b *RunEndEncodedBuilder) finishRun() {
	b.lastUnmarshalled = nil
	b.lastStr = nil
	b.unmarshalled = false
	if b.length == 0 {
		return
	}

	switch bldr := b.runEnds.(type) {
	case *Int16Builder:
		bldr.Append(int16(b.length))
	case *Int32Builder:
		bldr.Append(int32(b.length))
	case *Int64Builder:
		bldr.Append(int64(b.length))
	}
}

func (b *RunEndEncodedBuilder) ValueBuilder() Builder { return b.values }

func (b *RunEndEncodedBuilder) Append(n uint64) {
	b.finishRun()
	b.addLength(n)
}

func (b *RunEndEncodedBuilder) AppendRuns(runs []uint64) {
	for _, r := range runs {
		b.finishRun()
		b.addLength(r)
	}
}

func (b *RunEndEncodedBuilder) ContinueRun(n uint64) {
	b.addLength(n)
}

func (b *RunEndEncodedBuilder) AppendNull() {
	b.finishRun()
	b.values.AppendNull()
	b.addLength(1)
}

func (b *RunEndEncodedBuilder) AppendNulls(n int) {
	for i := 0; i < n; i++ {
		b.AppendNull()
	}
}

func (b *RunEndEncodedBuilder) NullN() int {
	return UnknownNullCount
}

func (b *RunEndEncodedBuilder) AppendEmptyValue() {
	b.AppendNull()
}

func (b *RunEndEncodedBuilder) AppendEmptyValues(n int) {
	b.AppendNulls(n)
}

func (b *RunEndEncodedBuilder) Reserve(n int) {
	b.values.Reserve(n)
	b.runEnds.Reserve(n)
}

func (b *RunEndEncodedBuilder) Resize(n int) {
	b.values.Resize(n)
	b.runEnds.Resize(n)
}

func (b *RunEndEncodedBuilder) NewRunEndEncodedArray() *RunEndEncoded {
	data := b.newData()
	defer data.Release()
	return NewRunEndEncodedData(data)
}

func (b *RunEndEncodedBuilder) NewArray() arrow.Array {
	return b.NewRunEndEncodedArray()
}

func (b *RunEndEncodedBuilder) newData() (data *Data) {
	b.finishRun()
	values := b.values.NewArray()
	defer values.Release()
	runEnds := b.runEnds.NewArray()
	defer runEnds.Release()

	data = NewData(
		b.dt, b.length, []*memory.Buffer{},
		[]arrow.ArrayData{runEnds.Data(), values.Data()}, 0, 0)
	b.reset()
	return
}

// AppendValueFromString can't be used in conjunction with UnmarshalOne
func (b *RunEndEncodedBuilder) AppendValueFromString(s string) error {
	// we don't support mixing AppendValueFromString & UnmarshalOne
	if b.unmarshalled {
		return fmt.Errorf("%w: mixing AppendValueFromString & UnmarshalOne not yet implemented", arrow.ErrNotImplemented)
	}

	if s == NullValueStr {
		b.AppendNull()
		return nil
	}

	if b.lastStr != nil && s == *b.lastStr {
		b.ContinueRun(1)
		return nil
	}

	b.Append(1)
	lastStr := s
	b.lastStr = &lastStr
	return b.ValueBuilder().AppendValueFromString(s)
}

// UnmarshalOne can't be used in conjunction with AppendValueFromString
func (b *RunEndEncodedBuilder) UnmarshalOne(dec *json.Decoder) error {
	// we don't support mixing AppendValueFromString & UnmarshalOne
	if b.lastStr != nil {
		return fmt.Errorf("%w: mixing AppendValueFromString & UnmarshalOne not yet implemented", arrow.ErrNotImplemented)
	}

	var value interface{}
	if err := dec.Decode(&value); err != nil {
		return err
	}

	// if we unmarshalled the same value as the previous one, we want to
	// continue the run. However, there's an edge case. At the start of
	// unmarshalling, lastUnmarshalled will be nil, but we might get
	// nil as the first value we unmarshal. In that case we want to
	// make sure we add a new run instead. We can detect that case by
	// checking that the number of runEnds matches the number of values
	// we have, which means no matter what we have to start a new run
	if reflect.DeepEqual(value, b.lastUnmarshalled) && (value != nil || b.runEnds.Len() != b.values.Len()) {
		b.ContinueRun(1)
		return nil
	}

	data, err := json.Marshal(value)
	if err != nil {
		return err
	}

	b.Append(1)
	b.lastUnmarshalled = value
	b.unmarshalled = true
	return b.ValueBuilder().UnmarshalOne(json.NewDecoder(bytes.NewReader(data)))
}

// Unmarshal can't be used in conjunction with AppendValueFromString (as it calls UnmarshalOne)
func (b *RunEndEncodedBuilder) Unmarshal(dec *json.Decoder) error {
	b.finishRun()
	for dec.More() {
		if err := b.UnmarshalOne(dec); err != nil {
			return err
		}
	}
	return nil
}

// UnmarshalJSON can't be used in conjunction with AppendValueFromString (as it calls UnmarshalOne)
func (b *RunEndEncodedBuilder) UnmarshalJSON(data []byte) error {
	dec := json.NewDecoder(bytes.NewReader(data))
	t, err := dec.Token()
	if err != nil {
		return err
	}

	if delim, ok := t.(json.Delim); !ok || delim != '[' {
		return fmt.Errorf("list builder must unpack from json array, found %s", delim)
	}

	return b.Unmarshal(dec)
}

var (
	_ arrow.Array = (*RunEndEncoded)(nil)
	_ Builder     = (*RunEndEncodedBuilder)(nil)
)
