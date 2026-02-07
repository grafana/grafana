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

//go:build go1.18

package kernels

import (
	"bytes"
	"fmt"
	"sort"
	"unsafe"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/bitutil"
	"github.com/apache/arrow-go/v18/arrow/compute/exec"
	"github.com/apache/arrow-go/v18/arrow/decimal128"
	"github.com/apache/arrow-go/v18/arrow/decimal256"
	"github.com/apache/arrow-go/v18/arrow/float16"
	"github.com/apache/arrow-go/v18/arrow/internal/debug"
	"github.com/apache/arrow-go/v18/arrow/memory"
)

type RunEndEncodeState struct {
	RunEndType arrow.DataType
}

func (RunEndEncodeState) TypeName() string {
	return "RunEndEncodeOptions"
}

type RunEndsType interface {
	int16 | int32 | int64
}

func readFixedWidthVal[V arrow.FixedWidthType](inputValidity, inputValues []byte, offset int64, out *V) bool {
	sz := int64(unsafe.Sizeof(*out))
	*out = *(*V)(unsafe.Pointer(&inputValues[offset*sz]))
	return bitutil.BitIsSet(inputValidity, int(offset))
}

func writeFixedWidthVal[V arrow.FixedWidthType](result *exec.ExecResult, offset int64, valid bool, value V) {
	if len(result.Buffers[0].Buf) != 0 {
		bitutil.SetBitTo(result.Buffers[0].Buf, int(offset), valid)
	}

	arr := arrow.GetData[V](result.Buffers[1].Buf)
	arr[offset] = value
}

func readBoolVal(inputValidity, inputValues []byte, offset int64, out *bool) bool {
	*out = bitutil.BitIsSet(inputValues, int(offset))
	return bitutil.BitIsSet(inputValidity, int(offset))
}

func writeBoolVal(result *exec.ExecResult, offset int64, valid bool, value bool) {
	if len(result.Buffers[0].Buf) != 0 {
		bitutil.SetBitTo(result.Buffers[0].Buf, int(offset), valid)
	}
	bitutil.SetBitTo(result.Buffers[1].Buf, int(offset), value)
}

type runEndEncodeLoopFixedWidth[R RunEndsType, V arrow.FixedWidthType | bool] struct {
	inputLen, inputOffset int64
	inputValidity         []byte
	inputValues           []byte
	valueType             arrow.DataType

	readValue  func(inputValidity, inputValues []byte, offset int64, out *V) bool
	writeValue func(*exec.ExecResult, int64, bool, V)
}

func (re *runEndEncodeLoopFixedWidth[R, V]) WriteEncodedRuns(out *exec.ExecResult) int64 {
	outputRunEnds := arrow.GetData[R](out.Children[0].Buffers[1].Buf)

	readOffset := re.inputOffset
	var currentRun V
	curRunValid := re.readValue(re.inputValidity, re.inputValues, readOffset, &currentRun)
	readOffset++

	var writeOffset int64
	var value V
	for readOffset < re.inputOffset+re.inputLen {
		valid := re.readValue(re.inputValidity, re.inputValues, readOffset, &value)
		if valid != curRunValid || value != currentRun {
			// close the current run by writing it out
			re.writeValue(&out.Children[1], writeOffset, curRunValid, currentRun)
			runEnd := R(readOffset - re.inputOffset)
			outputRunEnds[writeOffset] = runEnd
			writeOffset++
			curRunValid, currentRun = valid, value
		}
		readOffset++
	}

	re.writeValue(&out.Children[1], writeOffset, curRunValid, currentRun)
	outputRunEnds[writeOffset] = R(re.inputLen)
	return writeOffset + 1
}

func (re *runEndEncodeLoopFixedWidth[R, V]) CountNumberOfRuns() (numValid, numOutput int64) {
	offset := re.inputOffset
	var currentRun V
	curRunValid := re.readValue(re.inputValidity, re.inputValues, offset, &currentRun)
	offset++

	if curRunValid {
		numValid = 1
	}
	numOutput = 1

	var value V
	for offset < re.inputOffset+re.inputLen {
		valid := re.readValue(re.inputValidity, re.inputValues, offset, &value)
		offset++
		// new run
		if valid != curRunValid || value != currentRun {
			currentRun = value
			curRunValid = valid

			numOutput++
			if valid {
				numValid++
			}
		}
	}
	return
}

func (re *runEndEncodeLoopFixedWidth[R, V]) PreallocOutput(ctx *exec.KernelCtx, numOutput int64, out *exec.ExecResult) {
	runEndsBuffer := ctx.Allocate(int(numOutput) * int(SizeOf[R]()))
	var validityBuffer *memory.Buffer
	if len(re.inputValidity) > 0 {
		validityBuffer = ctx.AllocateBitmap(numOutput)
	}

	var valueBuffer *memory.Buffer
	bufSpec := re.valueType.Layout().Buffers[1]
	if bufSpec.Kind == arrow.KindBitmap {
		valueBuffer = ctx.AllocateBitmap(numOutput)
	} else {
		valueBuffer = ctx.Allocate(int(numOutput) * bufSpec.ByteWidth)
	}

	reeType := arrow.RunEndEncodedOf(arrow.GetDataType[R](), re.valueType)
	out.Release()

	*out = exec.ExecResult{
		Type:   reeType,
		Len:    re.inputLen,
		Nulls:  0,
		Offset: 0,
		Children: []exec.ArraySpan{
			{
				Type: reeType.RunEnds(),
				Len:  numOutput,
			},
			{
				Type: reeType.Encoded(),
				Len:  numOutput,
			},
		},
	}

	out.Children[0].Buffers[1].WrapBuffer(runEndsBuffer)
	if validityBuffer != nil {
		out.Children[1].Buffers[0].WrapBuffer(validityBuffer)
	}
	out.Children[1].Buffers[1].WrapBuffer(valueBuffer)
}

type runEndEncodeFSB[R RunEndsType] struct {
	inputLen, inputOffset      int64
	inputValidity, inputValues []byte
	valueType                  arrow.DataType
	width                      int
}

func (re *runEndEncodeFSB[R]) readValue(idx int64) ([]byte, bool) {
	if len(re.inputValidity) > 0 && bitutil.BitIsNotSet(re.inputValidity, int(idx)) {
		return nil, false
	}

	start, end := idx*int64(re.width), (idx+1)*int64(re.width)
	return re.inputValues[start:end], true
}

func (re *runEndEncodeFSB[R]) CountNumberOfRuns() (numValid, numOutput int64) {
	offset := re.inputOffset
	currentRun, curRunValid := re.readValue(offset)
	offset++

	if curRunValid {
		numValid++
	}
	numOutput = 1

	for offset < re.inputOffset+re.inputLen {
		value, valid := re.readValue(offset)
		offset++
		if valid != curRunValid || !bytes.Equal(value, currentRun) {
			currentRun, curRunValid = value, valid
			numOutput++
			if valid {
				numValid++
			}
		}
	}
	return
}

func (re *runEndEncodeFSB[R]) PreallocOutput(ctx *exec.KernelCtx, numOutput int64, out *exec.ExecResult) {
	runEndsBuffer := ctx.Allocate(int(numOutput) * int(SizeOf[R]()))
	var validityBuffer *memory.Buffer
	if len(re.inputValidity) > 0 {
		validityBuffer = ctx.AllocateBitmap(numOutput)
	}

	valueBuffer := ctx.Allocate(re.width * int(numOutput))
	reeType := arrow.RunEndEncodedOf(arrow.GetDataType[R](), re.valueType)
	out.Release()

	*out = exec.ExecResult{
		Type:   reeType,
		Len:    re.inputLen,
		Nulls:  0,
		Offset: 0,
		Children: []exec.ArraySpan{
			{
				Type: reeType.RunEnds(),
				Len:  numOutput,
			},
			{
				Type: reeType.Encoded(),
				Len:  numOutput,
			},
		},
	}

	out.Children[0].Buffers[1].WrapBuffer(runEndsBuffer)
	if validityBuffer != nil {
		out.Children[1].Buffers[0].WrapBuffer(validityBuffer)
	}
	out.Children[1].Buffers[1].WrapBuffer(valueBuffer)
}

func (re *runEndEncodeFSB[R]) WriteEncodedRuns(out *exec.ExecResult) int64 {
	outputRunEnds := arrow.GetData[R](out.Children[0].Buffers[1].Buf)
	outputValues := out.Children[1].Buffers[1].Buf

	readOffset := re.inputOffset
	currentRun, curRunValid := re.readValue(readOffset)
	readOffset++

	var writeOffset int64
	validityBuf := out.Children[1].Buffers[0].Buf
	setValidity := func(valid bool) {}
	if len(validityBuf) > 0 {
		setValidity = func(valid bool) {
			bitutil.SetBitTo(validityBuf, int(writeOffset), valid)
		}
	}

	writeValue := func(valid bool, value []byte) {
		setValidity(valid)
		start := writeOffset * int64(re.width)
		copy(outputValues[start:], value)
	}

	for readOffset < re.inputOffset+re.inputLen {
		value, valid := re.readValue(readOffset)

		if valid != curRunValid || !bytes.Equal(value, currentRun) {
			writeValue(curRunValid, currentRun)
			runEnd := R(readOffset - re.inputOffset)
			outputRunEnds[writeOffset] = runEnd
			writeOffset++
			curRunValid, currentRun = valid, value
		}

		readOffset++
	}

	writeValue(curRunValid, currentRun)
	outputRunEnds[writeOffset] = R(re.inputLen)
	return writeOffset + 1
}

type runEndEncodeLoopBinary[R RunEndsType, O int32 | int64] struct {
	inputLen, inputOffset      int64
	inputValidity, inputValues []byte
	offsetValues               []O
	valueType                  arrow.DataType

	estimatedValuesLen int64
}

func (re *runEndEncodeLoopBinary[R, O]) readValue(idx int64) ([]byte, bool) {
	if len(re.inputValidity) > 0 && bitutil.BitIsNotSet(re.inputValidity, int(idx+re.inputOffset)) {
		return nil, false
	}

	start, end := re.offsetValues[idx], re.offsetValues[idx+1]
	return re.inputValues[start:end], true
}

func (re *runEndEncodeLoopBinary[R, O]) CountNumberOfRuns() (numValid, numOutput int64) {
	re.estimatedValuesLen = 0
	// re.offsetValues already accounts for the input.Offset so we don't
	// need to use it as the initial value for `offset` here.
	var offset int64
	currentRun, curRunValid := re.readValue(offset)
	offset++

	if curRunValid {
		numValid = 1
		re.estimatedValuesLen += int64(len(currentRun))
	}
	numOutput = 1

	for offset < re.inputLen {
		value, valid := re.readValue(offset)
		offset++
		// new run
		if valid != curRunValid || !bytes.Equal(value, currentRun) {
			if valid {
				re.estimatedValuesLen += int64(len(value))
			}

			currentRun = value
			curRunValid = valid

			numOutput++
			if valid {
				numValid++
			}
		}
	}
	return
}

func (re *runEndEncodeLoopBinary[R, O]) PreallocOutput(ctx *exec.KernelCtx, numOutput int64, out *exec.ExecResult) {
	runEndsBuffer := ctx.Allocate(int(numOutput) * int(SizeOf[R]()))
	var validityBuffer *memory.Buffer
	if len(re.inputValidity) > 0 {
		validityBuffer = ctx.AllocateBitmap(numOutput)
	}

	valueBuffer := ctx.Allocate(int(re.estimatedValuesLen))
	offsetsBuffer := ctx.Allocate(int(numOutput+1) * int(SizeOf[O]()))

	reeType := arrow.RunEndEncodedOf(arrow.GetDataType[R](), re.valueType)
	*out = exec.ExecResult{
		Type:   reeType,
		Len:    re.inputLen,
		Nulls:  0,
		Offset: 0,
		Children: []exec.ArraySpan{
			{
				Type: reeType.RunEnds(),
				Len:  numOutput,
			},
			{
				Type: reeType.Encoded(),
				Len:  numOutput,
			},
		},
	}

	out.Children[0].Buffers[1].WrapBuffer(runEndsBuffer)
	if validityBuffer != nil {
		out.Children[1].Buffers[0].WrapBuffer(validityBuffer)
	}
	out.Children[1].Buffers[1].WrapBuffer(offsetsBuffer)
	out.Children[1].Buffers[2].WrapBuffer(valueBuffer)
}

func (re *runEndEncodeLoopBinary[R, O]) WriteEncodedRuns(out *exec.ExecResult) int64 {
	outputRunEnds := arrow.GetData[R](out.Children[0].Buffers[1].Buf)
	outputOffsets := exec.GetSpanOffsets[O](&out.Children[1], 1)
	outputValues := out.Children[1].Buffers[2].Buf

	// re.offsetValues already accounts for the input.offset so we don't
	// need to initialize readOffset to re.inputOffset
	var readOffset int64
	currentRun, curRunValid := re.readValue(readOffset)
	readOffset++

	var writeOffset, valueOffset int64
	validityBuf := out.Children[1].Buffers[0].Buf
	setValidity := func(valid bool) {}
	if len(validityBuf) > 0 {
		setValidity = func(valid bool) {
			bitutil.SetBitTo(validityBuf, int(writeOffset), valid)
		}
	}

	outputOffsets[0], outputOffsets = 0, outputOffsets[1:]

	writeValue := func(valid bool, value []byte) {
		setValidity(valid)
		valueOffset += int64(copy(outputValues[valueOffset:], value))
		outputOffsets[writeOffset] = O(valueOffset)
	}

	for readOffset < re.inputLen {
		value, valid := re.readValue(readOffset)

		if valid != curRunValid || !bytes.Equal(value, currentRun) {
			writeValue(curRunValid, currentRun)
			runEnd := R(readOffset)
			outputRunEnds[writeOffset] = runEnd
			writeOffset++
			curRunValid, currentRun = valid, value
		}
		readOffset++
	}

	writeValue(curRunValid, currentRun)
	outputRunEnds[writeOffset] = R(re.inputLen)
	return writeOffset + 1
}

func validateRunEndType[R RunEndsType](length int64) error {
	runEndMax := MaxOf[R]()
	if length > int64(runEndMax) {
		return fmt.Errorf("%w: cannot run-end encode arrays with more elements than the run end type can hold: %d",
			arrow.ErrInvalid, runEndMax)
	}
	return nil
}

func createEncoder[R RunEndsType, V arrow.FixedWidthType](input *exec.ArraySpan) *runEndEncodeLoopFixedWidth[R, V] {
	return &runEndEncodeLoopFixedWidth[R, V]{
		inputLen:      input.Len,
		inputOffset:   input.Offset,
		inputValidity: input.Buffers[0].Buf,
		inputValues:   input.Buffers[1].Buf,
		valueType:     input.Type,
		readValue:     readFixedWidthVal[V],
		writeValue:    writeFixedWidthVal[V],
	}
}

func createVarBinaryEncoder[R RunEndsType, O int32 | int64](input *exec.ArraySpan) *runEndEncodeLoopBinary[R, O] {
	return &runEndEncodeLoopBinary[R, O]{
		inputLen:      input.Len,
		inputOffset:   input.Offset,
		inputValidity: input.Buffers[0].Buf,
		inputValues:   input.Buffers[2].Buf,
		// exec.GetSpanOffsets applies input.Offset to the resulting slice
		offsetValues: exec.GetSpanOffsets[O](input, 1),
		valueType:    input.Type,
	}
}

func newEncoder[R RunEndsType](input *exec.ArraySpan) encoder {
	switch input.Type.ID() {
	case arrow.BOOL:
		return &runEndEncodeLoopFixedWidth[R, bool]{
			inputLen:      input.Len,
			inputOffset:   input.Offset,
			inputValidity: input.Buffers[0].Buf,
			inputValues:   input.Buffers[1].Buf,
			valueType:     input.Type,
			readValue:     readBoolVal,
			writeValue:    writeBoolVal,
		}
	// for the other fixed size types, we only need to
	// handle the different physical representations.
	case arrow.INT8, arrow.UINT8:
		return createEncoder[R, uint8](input)
	case arrow.INT16, arrow.UINT16:
		return createEncoder[R, uint16](input)
	case arrow.INT32, arrow.UINT32, arrow.DATE32,
		arrow.TIME32, arrow.INTERVAL_MONTHS:
		return createEncoder[R, uint32](input)
	case arrow.INT64, arrow.UINT64, arrow.DATE64,
		arrow.TIME64, arrow.DURATION, arrow.TIMESTAMP:
		return createEncoder[R, uint64](input)
	case arrow.FLOAT16:
		return createEncoder[R, float16.Num](input)
	case arrow.FLOAT32:
		return createEncoder[R, float32](input)
	case arrow.FLOAT64:
		return createEncoder[R, float64](input)
	case arrow.DECIMAL128:
		return createEncoder[R, decimal128.Num](input)
	case arrow.DECIMAL256:
		return createEncoder[R, decimal256.Num](input)
	case arrow.INTERVAL_DAY_TIME:
		return createEncoder[R, arrow.DayTimeInterval](input)
	case arrow.INTERVAL_MONTH_DAY_NANO:
		return createEncoder[R, arrow.MonthDayNanoInterval](input)
	case arrow.BINARY, arrow.STRING:
		return createVarBinaryEncoder[R, int32](input)
	case arrow.LARGE_BINARY, arrow.LARGE_STRING:
		return createVarBinaryEncoder[R, int64](input)
	case arrow.FIXED_SIZE_BINARY:
		return &runEndEncodeFSB[R]{
			inputLen:      input.Len,
			inputOffset:   input.Offset,
			inputValidity: input.Buffers[0].Buf,
			inputValues:   input.Buffers[1].Buf,
			valueType:     input.Type,
			width:         input.Type.(*arrow.FixedSizeBinaryType).ByteWidth,
		}
	}
	return nil
}

type encoder interface {
	CountNumberOfRuns() (numValid, numOutput int64)
	PreallocOutput(*exec.KernelCtx, int64, *exec.ExecResult)
	WriteEncodedRuns(*exec.ExecResult) int64
}

func runEndEncodeImpl[R RunEndsType](ctx *exec.KernelCtx, batch *exec.ExecSpan, out *exec.ExecResult) error {
	// first pass: count the number of runs
	var (
		inputArr      = &batch.Values[0].Array
		inputLen      = inputArr.Len
		numOutputRuns int64
		numValidRuns  int64
		enc           encoder
	)

	if inputLen == 0 {
		reeType := arrow.RunEndEncodedOf(arrow.GetDataType[R](), inputArr.Type)
		*out = exec.ExecResult{
			Type: reeType,
			Children: []exec.ArraySpan{
				{Type: reeType.RunEnds()}, {Type: reeType.Encoded()},
			},
		}
		return nil
	}

	if err := validateRunEndType[R](inputLen); err != nil {
		return err
	}

	enc = newEncoder[R](inputArr)
	numValidRuns, numOutputRuns = enc.CountNumberOfRuns()
	enc.PreallocOutput(ctx, numOutputRuns, out)

	out.Children[1].Nulls = numOutputRuns - numValidRuns

	written := enc.WriteEncodedRuns(out)
	debug.Assert(written == numOutputRuns, "mismatch number of written values")
	return nil
}

func runEndEncodeExec(ctx *exec.KernelCtx, batch *exec.ExecSpan, out *exec.ExecResult) error {
	reeType := ctx.State.(RunEndEncodeState).RunEndType
	switch reeType.ID() {
	case arrow.INT16:
		return runEndEncodeImpl[int16](ctx, batch, out)
	case arrow.INT32:
		return runEndEncodeImpl[int32](ctx, batch, out)
	case arrow.INT64:
		return runEndEncodeImpl[int64](ctx, batch, out)
	}

	return fmt.Errorf("%w: bad run end type %s", arrow.ErrInvalid, reeType)
}

type decodeBool[R RunEndsType] struct {
	inputLen, inputOffset int64
	inputRunEnds          []R

	inputPhysicalOffset int64
	inputValidity       []byte
	inputValues         []byte
	inputValueOffset    int64
}

func (de *decodeBool[R]) PreallocOutput(ctx *exec.KernelCtx, out *exec.ExecResult) {
	*out = exec.ExecResult{
		Type: arrow.FixedWidthTypes.Boolean,
		Len:  de.inputLen,
	}

	if len(de.inputValidity) != 0 {
		out.Buffers[0].WrapBuffer(ctx.AllocateBitmap(de.inputLen))
	}

	out.Buffers[1].WrapBuffer(ctx.AllocateBitmap(de.inputLen))
}

func (de *decodeBool[R]) ExpandAllRuns(out *exec.ExecResult) int64 {
	var (
		writeOffset         int64
		runLength, numValid int64
		outputValues        = out.Buffers[1].Buf
		prevRunEnd          = R(de.inputOffset)
		hasValidity         = len(de.inputValidity) != 0 && len(out.Buffers[0].Buf) != 0
	)

	for i, runEnd := range de.inputRunEnds[de.inputPhysicalOffset:] {
		runLength, prevRunEnd = int64(runEnd-prevRunEnd), runEnd
		// if this run is a null, clear the bits and update writeOffset
		if hasValidity {
			if bitutil.BitIsNotSet(de.inputValidity, int(de.inputValueOffset+de.inputPhysicalOffset)+i) {
				bitutil.SetBitsTo(out.Buffers[0].Buf, writeOffset, runLength, false)
				writeOffset += runLength
				continue
			}

			// if the output has a validity bitmap, update it with 1s
			bitutil.SetBitsTo(out.Buffers[0].Buf, writeOffset, runLength, true)
		}

		// get the value for this run + where to start writing
		value := bitutil.BitIsSet(de.inputValues, int(de.inputValueOffset+de.inputPhysicalOffset)+i)
		bitutil.SetBitsTo(outputValues, writeOffset, runLength, value)
		writeOffset += runLength
		numValid += runLength
	}

	return numValid
}

type decodeFixedWidth[R RunEndsType] struct {
	inputLen, inputOffset int64
	inputRunEnds          []R

	inputPhysicalOffset int64
	inputValidity       []byte
	inputValues         []byte
	inputValueOffset    int64

	valueType arrow.DataType
}

func (de *decodeFixedWidth[R]) PreallocOutput(ctx *exec.KernelCtx, out *exec.ExecResult) {
	*out = exec.ExecResult{
		Type: de.valueType,
		Len:  de.inputLen,
	}

	if len(de.inputValidity) != 0 {
		out.Buffers[0].WrapBuffer(ctx.AllocateBitmap(de.inputLen))
	}

	out.Buffers[1].WrapBuffer(ctx.Allocate(int(de.inputLen) * de.valueType.(arrow.FixedWidthDataType).Bytes()))
}

func (de *decodeFixedWidth[R]) ExpandAllRuns(out *exec.ExecResult) int64 {
	var (
		writeOffset         int64
		runLength, numValid int64
		outputValues        = out.Buffers[1].Buf
		width               = de.valueType.(arrow.FixedWidthDataType).Bytes()
		inputValues         = de.inputValues[(de.inputValueOffset+de.inputPhysicalOffset)*int64(width):]
		prevRunEnd          = R(de.inputOffset)
		hasValidity         = len(de.inputValidity) != 0 && len(out.Buffers[0].Buf) != 0
	)

	for i, runEnd := range de.inputRunEnds[de.inputPhysicalOffset:] {
		runLength, prevRunEnd = int64(runEnd-prevRunEnd), runEnd
		// if this run is a null, clear the bits and update writeOffset
		if hasValidity {
			if bitutil.BitIsNotSet(de.inputValidity, int(de.inputValueOffset+de.inputPhysicalOffset)+i) {
				bitutil.SetBitsTo(out.Buffers[0].Buf, writeOffset, runLength, false)
				writeOffset += runLength
				continue
			}

			// if the output has a validity bitmap, update it with 1s
			bitutil.SetBitsTo(out.Buffers[0].Buf, writeOffset, runLength, true)
		}

		// get the value for this run + where to start writing
		var (
			value       = inputValues[i*width : (i+1)*width]
			outputStart = writeOffset * int64(width)
		)
		writeOffset += runLength
		numValid += runLength

		// get the slice of our output buffer we want to fill
		// just incrementally duplicate the bytes until we've filled
		// the slice with runLength copies of the value
		outputSlice := outputValues[outputStart : writeOffset*int64(width)]
		copy(outputSlice, value)
		for j := width; j < len(outputSlice); j *= 2 {
			copy(outputSlice[j:], outputSlice[:j])
		}
	}

	return numValid
}

type decodeBinary[R RunEndsType, O int32 | int64] struct {
	inputLen, inputLogicalOffset int64
	inputRunEnds                 []R

	inputPhysicalOffset int64
	inputValuesOffset   int64
	inputValidity       []byte
	inputValues         []byte
	inputOffsets        []O

	valueType arrow.DataType
}

func (de *decodeBinary[R, O]) PreallocOutput(ctx *exec.KernelCtx, out *exec.ExecResult) {
	var (
		runLength  int64
		prevRunEnd = R(de.inputLogicalOffset)
		totalSize  int
	)

	for i, runEnd := range de.inputRunEnds[de.inputPhysicalOffset:] {
		runLength, prevRunEnd = int64(runEnd-prevRunEnd), runEnd

		start := de.inputOffsets[de.inputPhysicalOffset+int64(i)]
		end := de.inputOffsets[de.inputPhysicalOffset+int64(i)+1]

		totalSize += int(end-start) * int(runLength)
	}

	*out = exec.ExecResult{
		Type: de.valueType,
		Len:  de.inputLen,
	}

	if len(de.inputValidity) != 0 {
		out.Buffers[0].WrapBuffer(ctx.AllocateBitmap(de.inputLen))
	}

	out.Buffers[1].WrapBuffer(ctx.Allocate(int(de.inputLen+1) * int(SizeOf[O]())))
	out.Buffers[2].WrapBuffer(ctx.Allocate(totalSize))
}

func (de *decodeBinary[R, O]) ExpandAllRuns(out *exec.ExecResult) int64 {
	var (
		writeOffset, valueWriteOffset int64
		runLength, numValid           int64
		outputOffsets                 = exec.GetSpanOffsets[O](out, 1)
		outputValues                  = out.Buffers[2].Buf
		prevRunEnd                    = R(de.inputLogicalOffset)
		hasValidity                   = len(de.inputValidity) != 0 && len(out.Buffers[0].Buf) != 0
	)

	for i, runEnd := range de.inputRunEnds[de.inputPhysicalOffset:] {
		runLength, prevRunEnd = int64(runEnd-prevRunEnd), runEnd

		// if this run is a null, clear the bits and update writeOffset
		if hasValidity && bitutil.BitIsNotSet(de.inputValidity, int(de.inputValuesOffset+de.inputPhysicalOffset)+i) {
			bitutil.SetBitsTo(out.Buffers[0].Buf, writeOffset, runLength, false)
		} else {
			numValid += runLength
			if hasValidity {
				bitutil.SetBitsTo(out.Buffers[0].Buf, writeOffset, runLength, true)
			}
		}

		// get the value for this run + where to start writing
		// de.inputOffsets already accounts for inputOffset so we don't
		// need to add it here, we can just use the physicaloffset and that's
		// sufficient to get the correct values.
		var (
			start = de.inputOffsets[de.inputPhysicalOffset+int64(i)]
			end   = de.inputOffsets[de.inputPhysicalOffset+int64(i)+1]
			value = de.inputValues[start:end]

			outputValueEnd = valueWriteOffset + int64(len(value)*int(runLength))
		)

		// get the slice of our output buffer we want to fill
		// just incrementally duplicate the bytes until we've filled
		// the slice with runLength copies of the value
		outputSlice := outputValues[valueWriteOffset:outputValueEnd]
		copy(outputSlice, value)
		for j := len(value); j < len(outputSlice); j *= 2 {
			copy(outputSlice[j:], outputSlice[:j])
		}

		for j := int64(0); j < runLength; j++ {
			outputOffsets[writeOffset+j] = O(valueWriteOffset)
			valueWriteOffset += int64(len(value))
		}

		writeOffset += runLength
	}

	outputOffsets[writeOffset] = O(valueWriteOffset)
	return numValid
}

type decoder interface {
	PreallocOutput(*exec.KernelCtx, *exec.ExecResult)
	ExpandAllRuns(*exec.ExecResult) int64
}

func newDecoder[R RunEndsType](input *exec.ArraySpan) decoder {
	logicalOffset := R(input.Offset)
	runEnds := exec.GetSpanValues[R](&input.Children[0], 1)
	physicalOffset := sort.Search(len(runEnds), func(i int) bool { return runEnds[i] > logicalOffset })

	switch dt := input.Children[1].Type.(type) {
	case *arrow.BooleanType:
		return &decodeBool[R]{
			inputLen:            input.Len,
			inputOffset:         input.Offset,
			inputValidity:       input.Children[1].Buffers[0].Buf,
			inputValues:         input.Children[1].Buffers[1].Buf,
			inputValueOffset:    input.Children[1].Offset,
			inputPhysicalOffset: int64(physicalOffset),
			inputRunEnds:        runEnds,
		}
	case *arrow.BinaryType, *arrow.StringType:
		return &decodeBinary[R, int32]{
			inputLen:            input.Len,
			inputLogicalOffset:  input.Offset,
			inputRunEnds:        runEnds,
			inputPhysicalOffset: int64(physicalOffset),
			inputValuesOffset:   input.Children[1].Offset,
			inputValidity:       input.Children[1].Buffers[0].Buf,
			inputValues:         input.Children[1].Buffers[2].Buf,
			inputOffsets:        exec.GetSpanOffsets[int32](&input.Children[1], 1),
			valueType:           input.Children[1].Type,
		}
	case *arrow.LargeBinaryType, *arrow.LargeStringType:
		return &decodeBinary[R, int64]{
			inputLen:            input.Len,
			inputLogicalOffset:  input.Offset,
			inputRunEnds:        runEnds,
			inputPhysicalOffset: int64(physicalOffset),
			inputValuesOffset:   input.Children[1].Offset,
			inputValidity:       input.Children[1].Buffers[0].Buf,
			inputValues:         input.Children[1].Buffers[2].Buf,
			inputOffsets:        exec.GetSpanOffsets[int64](&input.Children[1], 1),
			valueType:           input.Children[1].Type,
		}
	case arrow.FixedWidthDataType:
		return &decodeFixedWidth[R]{
			inputLen:            input.Len,
			inputOffset:         input.Offset,
			inputRunEnds:        runEnds,
			inputPhysicalOffset: int64(physicalOffset),
			inputValidity:       input.Children[1].Buffers[0].Buf,
			inputValues:         input.Children[1].Buffers[1].Buf,
			inputValueOffset:    input.Children[1].Offset,
			valueType:           dt,
		}
	}

	return nil
}

func runEndDecodeImpl[R RunEndsType](ctx *exec.KernelCtx, batch *exec.ExecSpan, out *exec.ExecResult) error {
	inputArr := &batch.Values[0].Array

	if inputArr.Len == 0 {
		return nil
	}

	dec := newDecoder[R](inputArr)
	dec.PreallocOutput(ctx, out)
	out.Nulls = inputArr.Len - dec.ExpandAllRuns(out)
	return nil
}

func runEndDecodeExec(ctx *exec.KernelCtx, batch *exec.ExecSpan, out *exec.ExecResult) error {
	reeType := batch.Values[0].Type().(*arrow.RunEndEncodedType)
	switch reeType.RunEnds().ID() {
	case arrow.INT16:
		return runEndDecodeImpl[int16](ctx, batch, out)
	case arrow.INT32:
		return runEndDecodeImpl[int32](ctx, batch, out)
	case arrow.INT64:
		return runEndDecodeImpl[int64](ctx, batch, out)
	}

	return fmt.Errorf("%w: bad run end type %s", arrow.ErrInvalid, reeType.RunEnds())
}

func runEndEncodeOutputTypeResolver(ctx *exec.KernelCtx, inputTypes []arrow.DataType) (arrow.DataType, error) {
	reeType := ctx.State.(RunEndEncodeState).RunEndType
	return arrow.RunEndEncodedOf(reeType, inputTypes[0]), nil
}

func runEndDecodeOutputTypeResolver(ctx *exec.KernelCtx, inputTypes []arrow.DataType) (arrow.DataType, error) {
	reeType := inputTypes[0].(*arrow.RunEndEncodedType)
	return reeType.Encoded(), nil
}

func GetRunEndEncodeKernels() (encodeKns, decodeKns []exec.VectorKernel) {
	baseEncode := exec.VectorKernel{
		NullHandling:        exec.NullNoOutput,
		MemAlloc:            exec.MemNoPrealloc,
		CanExecuteChunkWise: true,
		ExecFn:              runEndEncodeExec,
		OutputChunked:       true,
	}

	baseDecode := exec.VectorKernel{
		NullHandling:        exec.NullNoOutput,
		MemAlloc:            exec.MemNoPrealloc,
		CanExecuteChunkWise: true,
		ExecFn:              runEndDecodeExec,
		OutputChunked:       true,
	}

	baseEncode.Init = exec.OptionsInit[RunEndEncodeState]

	encodeKns, decodeKns = make([]exec.VectorKernel, 0), make([]exec.VectorKernel, 0)
	addKernel := func(ty arrow.Type) {
		baseEncode.Signature = &exec.KernelSignature{
			InputTypes: []exec.InputType{exec.NewIDInput(ty)},
			OutType:    exec.NewComputedOutputType(runEndEncodeOutputTypeResolver),
		}
		encodeKns = append(encodeKns, baseEncode)

		baseDecode.Signature = &exec.KernelSignature{
			InputTypes: []exec.InputType{exec.NewMatchedInput(
				exec.RunEndEncoded(exec.Integer(), exec.SameTypeID(ty)))},
			OutType: exec.NewComputedOutputType(runEndDecodeOutputTypeResolver),
		}
		decodeKns = append(decodeKns, baseDecode)
	}

	for _, ty := range primitiveTypes {
		addKernel(ty.ID())
	}
	addKernel(arrow.BOOL)

	nonPrimitiveSupported := []arrow.Type{
		arrow.FLOAT16, arrow.DECIMAL128, arrow.DECIMAL256,
		arrow.TIME32, arrow.TIME64, arrow.TIMESTAMP,
		arrow.INTERVAL_DAY_TIME, arrow.INTERVAL_MONTHS,
		arrow.INTERVAL_MONTH_DAY_NANO,
		arrow.FIXED_SIZE_BINARY,
	}

	for _, ty := range nonPrimitiveSupported {
		addKernel(ty)
	}

	return
}
