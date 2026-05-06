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
	"fmt"
	"strconv"
	"unicode/utf8"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/array"
	"github.com/apache/arrow-go/v18/arrow/bitutil"
	"github.com/apache/arrow-go/v18/arrow/compute/exec"
	"github.com/apache/arrow-go/v18/arrow/float16"
	"github.com/apache/arrow-go/v18/internal/bitutils"
)

func validateUtf8Fsb(input *exec.ArraySpan) error {
	var (
		inputData = input.Buffers[1].Buf
		width     = int64(input.Type.(*arrow.FixedSizeBinaryType).ByteWidth)
		bitmap    = input.Buffers[0].Buf
	)

	return bitutils.VisitBitBlocksShort(bitmap, input.Offset, input.Len,
		func(pos int64) error {
			pos += input.Offset
			beg := pos * width
			end := (pos + 1) * width
			if !utf8.Valid(inputData[beg:end]) {
				return fmt.Errorf("%w: invalid UTF8 bytes: %x", arrow.ErrInvalid, inputData[beg:end])
			}
			return nil
		}, func() error { return nil })
}

func validateUtf8[OffsetT int32 | int64](input *exec.ArraySpan) error {
	var (
		inputOffsets = exec.GetSpanOffsets[OffsetT](input, 1)
		inputData    = input.Buffers[2].Buf
		bitmap       = input.Buffers[0].Buf
	)

	return bitutils.VisitBitBlocksShort(bitmap, input.Offset, input.Len,
		func(pos int64) error {
			v := inputData[inputOffsets[pos]:inputOffsets[pos+1]]
			if !utf8.Valid(v) {
				return fmt.Errorf("%w: invalid UTF8 bytes: %x", arrow.ErrInvalid, v)
			}
			return nil
		}, func() error { return nil })
}

func CastFsbToFsb(ctx *exec.KernelCtx, batch *exec.ExecSpan, out *exec.ExecResult) error {
	inputWidth := batch.Values[0].Array.Type.(*arrow.FixedSizeBinaryType).ByteWidth
	outputWidth := ctx.State.(CastState).ToType.(*arrow.FixedSizeBinaryType).ByteWidth

	if inputWidth != outputWidth {
		return fmt.Errorf("%w: failed casting from %s to %s: widths must match",
			arrow.ErrInvalid, batch.Values[0].Array.Type, out.Type)
	}

	return ZeroCopyCastExec(ctx, batch, out)
}

func CastBinaryToBinary[InOffsetsT, OutOffsetsT int32 | int64](ctx *exec.KernelCtx, batch *exec.ExecSpan, out *exec.ExecResult) error {
	opts := ctx.State.(CastState)
	input := &batch.Values[0].Array

	if !input.Type.(arrow.BinaryDataType).IsUtf8() && out.Type.(arrow.BinaryDataType).IsUtf8() && !opts.AllowInvalidUtf8 {
		if err := validateUtf8[InOffsetsT](input); err != nil {
			return err
		}
	}

	// start with a zero-copy cast, then change the indices to the
	// expected size
	if err := ZeroCopyCastExec(ctx, batch, out); err != nil {
		return err
	}

	switch {
	case SizeOf[InOffsetsT]() == SizeOf[OutOffsetsT]():
		// offsets are the same width, nothing more to do
		return nil
	case SizeOf[InOffsetsT]() > SizeOf[OutOffsetsT]():
		// downcast from int64 -> int32
		inputOffsets := exec.GetSpanOffsets[InOffsetsT](input, 1)

		// binary offsets are ascending, so it's enough to check
		// the last one for overflow
		if inputOffsets[input.Len] > InOffsetsT(MaxOf[OutOffsetsT]()) {
			return fmt.Errorf("%w: failed casting from %s to %s: input array too large",
				arrow.ErrInvalid, input.Type, out.Type)
		}

		buf := ctx.Allocate(out.Type.(arrow.OffsetsDataType).OffsetTypeTraits().BytesRequired(int(out.Len + out.Offset + 1)))
		out.Buffers[1].WrapBuffer(buf)

		outOffsets := exec.GetSpanOffsets[OutOffsetsT](out, 1)

		castNumericUnsafe(arrow.INT64, arrow.INT32,
			arrow.GetBytes(inputOffsets), arrow.GetBytes(outOffsets), len(inputOffsets))
		return nil
	default:
		// upcast from int32 -> int64
		buf := ctx.Allocate(out.Type.(arrow.OffsetsDataType).OffsetTypeTraits().BytesRequired(int(out.Len + out.Offset + 1)))
		out.Buffers[1].WrapBuffer(buf)

		inputOffsets := exec.GetSpanOffsets[InOffsetsT](input, 1)
		outOffsets := exec.GetSpanOffsets[OutOffsetsT](out, 1)

		castNumericUnsafe(arrow.INT32, arrow.INT64,
			arrow.GetBytes(inputOffsets), arrow.GetBytes(outOffsets), len(inputOffsets))
		return nil
	}
}

func CastFsbToBinary[OffsetsT int32 | int64](ctx *exec.KernelCtx, batch *exec.ExecSpan, out *exec.ExecResult) error {
	opts := ctx.State.(CastState)
	input := &batch.Values[0].Array

	if out.Type.(arrow.BinaryDataType).IsUtf8() && !opts.AllowInvalidUtf8 {
		if err := validateUtf8Fsb(input); err != nil {
			return err
		}
	}

	// check for overflow
	maxOffset := int64(MaxOf[OffsetsT]())
	width := OffsetsT(input.Type.(*arrow.FixedSizeBinaryType).ByteWidth)
	if (int64(width) * input.Len) > maxOffset {
		return fmt.Errorf("%w: failed casting from %s to %s: input array too large",
			arrow.ErrInvalid, input.Type, out.Type)
	}

	out.Len = input.Len
	out.Nulls = input.Nulls
	if input.Offset == out.Offset {
		out.Buffers[0].SetBuffer(input.GetBuffer(0))
	} else {
		out.Buffers[0].WrapBuffer(ctx.AllocateBitmap(input.Len))
		bitutil.CopyBitmap(input.Buffers[0].Buf, int(input.Offset), int(input.Len), out.Buffers[0].Buf, int(out.Offset))
	}

	// this buffer is preallocated
	offsets := exec.GetSpanOffsets[OffsetsT](out, 1)
	offsets[0] = OffsetsT(input.Offset) * width
	for i := 0; i < int(input.Len); i++ {
		offsets[i+1] = offsets[i] + width
	}

	if len(input.Buffers[1].Buf) > 0 {
		out.Buffers[2] = input.Buffers[1]
	}

	return nil
}

func addBinaryToBinaryCast[InOffsetT, OutOffsetT int32 | int64](inType arrow.Type, outType exec.OutputType) exec.ScalarKernel {
	return exec.NewScalarKernel([]exec.InputType{exec.NewIDInput(inType)},
		outType, CastBinaryToBinary[InOffsetT, OutOffsetT], nil)
}

func addToBinaryKernels[OffsetsT int32 | int64](outType exec.OutputType, kernels []exec.ScalarKernel) []exec.ScalarKernel {
	return append(kernels,
		addBinaryToBinaryCast[int32, OffsetsT](arrow.STRING, outType),
		addBinaryToBinaryCast[int32, OffsetsT](arrow.BINARY, outType),
		addBinaryToBinaryCast[int64, OffsetsT](arrow.LARGE_STRING, outType),
		addBinaryToBinaryCast[int64, OffsetsT](arrow.LARGE_BINARY, outType),
		exec.NewScalarKernel([]exec.InputType{exec.NewIDInput(arrow.FIXED_SIZE_BINARY)},
			outType, CastFsbToBinary[OffsetsT], nil),
	)
}

func GetFsbCastKernels() []exec.ScalarKernel {
	outputType := exec.NewComputedOutputType(resolveOutputFromOptions)
	out := GetCommonCastKernels(arrow.FIXED_SIZE_BINARY, outputType)
	kernel := exec.NewScalarKernel([]exec.InputType{exec.NewIDInput(arrow.FIXED_SIZE_BINARY)},
		OutputFirstType, CastFsbToFsb, nil)
	kernel.NullHandling = exec.NullComputedNoPrealloc
	return append(out, kernel)
}

func float16Formatter(v float16.Num) string                 { return v.String() }
func date32Formatter(v arrow.Date32) string                 { return v.FormattedString() }
func date64Formatter(v arrow.Date64) string                 { return v.FormattedString() }
func numericFormatterSigned[T arrow.IntType](v T) string    { return strconv.FormatInt(int64(v), 10) }
func numericFormatterUnsigned[T arrow.UintType](v T) string { return strconv.FormatUint(uint64(v), 10) }
func float32Formatter(v float32) string                     { return strconv.FormatFloat(float64(v), 'g', -1, 32) }
func float64Formatter(v float64) string                     { return strconv.FormatFloat(v, 'g', -1, 64) }

func boolToStringCastExec(ctx *exec.KernelCtx, batch *exec.ExecSpan, out *exec.ExecResult) error {
	var (
		input = &batch.Values[0].Array
		bldr  = array.NewBuilder(exec.GetAllocator(ctx.Ctx), out.Type).(array.StringLikeBuilder)
	)
	defer bldr.Release()

	bitutils.VisitBitBlocks(input.Buffers[0].Buf, input.Offset, input.Len,
		func(pos int64) {
			bldr.Append(strconv.FormatBool(bitutil.BitIsSet(input.Buffers[1].Buf, int(pos))))
		}, func() { bldr.AppendNull() })

	arr := bldr.NewArray()
	out.TakeOwnership(arr.Data())
	return nil
}

type timeIntrinsic interface {
	arrow.Time32 | arrow.Time64
	FormattedString(arrow.TimeUnit) string
}

func timeToStringCastExec[T timeIntrinsic](ctx *exec.KernelCtx, batch *exec.ExecSpan, out *exec.ExecResult) error {
	var (
		input     = &batch.Values[0].Array
		inputData = exec.GetSpanValues[T](input, 1)
		bldr      = array.NewBuilder(exec.GetAllocator(ctx.Ctx), out.Type).(array.StringLikeBuilder)
		inputType = input.Type.(arrow.TemporalWithUnit)
	)
	defer bldr.Release()

	bitutils.VisitBitBlocks(input.Buffers[0].Buf, input.Offset, input.Len,
		func(pos int64) {
			bldr.Append(inputData[pos].FormattedString(inputType.TimeUnit()))
		}, func() { bldr.AppendNull() })

	arr := bldr.NewArray()
	out.TakeOwnership(arr.Data())
	return nil
}

func numericToStringCastExec[T arrow.IntType | arrow.UintType | arrow.FloatType](formatter func(T) string) exec.ArrayKernelExec {
	return func(ctx *exec.KernelCtx, batch *exec.ExecSpan, out *exec.ExecResult) error {
		var (
			input     = &batch.Values[0].Array
			inputData = exec.GetSpanValues[T](input, 1)
			bldr      = array.NewBuilder(exec.GetAllocator(ctx.Ctx), out.Type).(array.StringLikeBuilder)
		)
		defer bldr.Release()

		bitutils.VisitBitBlocks(input.Buffers[0].Buf, input.Offset, input.Len,
			func(pos int64) {
				bldr.Append(formatter(inputData[pos]))
			}, func() { bldr.AppendNull() })

		arr := bldr.NewArray()
		out.TakeOwnership(arr.Data())
		return nil
	}
}

func castTimestampToString(ctx *exec.KernelCtx, batch *exec.ExecSpan, out *exec.ExecResult) error {
	var (
		input     = &batch.Values[0].Array
		inputData = exec.GetSpanValues[arrow.Timestamp](input, 1)
		inputType = input.Type.(*arrow.TimestampType)
		bldr      = array.NewBuilder(exec.GetAllocator(ctx.Ctx), out.Type).(array.StringLikeBuilder)
	)
	defer bldr.Release()

	toTime, err := inputType.GetToTimeFunc()
	if err != nil {
		return err
	}

	// prealloc
	fmtstring := "2006-01-02 15:04:05"
	switch inputType.Unit {
	case arrow.Millisecond:
		fmtstring += ".000"
	case arrow.Microsecond:
		fmtstring += ".000000"
	case arrow.Nanosecond:
		fmtstring += ".000000000"
	}

	switch inputType.TimeZone {
	case "UTC":
		fmtstring += "Z"
	case "":
	default:
		fmtstring += "-0700"
	}

	strlen := len(fmtstring)
	bldr.Reserve(int(input.Len))
	bldr.ReserveData(int(input.Len-input.Nulls) * strlen)

	bitutils.VisitBitBlocks(input.Buffers[0].Buf, input.Offset, input.Len,
		func(pos int64) {
			bldr.Append(toTime(inputData[pos]).Format(fmtstring))
		},
		func() { bldr.AppendNull() })

	arr := bldr.NewArray()
	out.TakeOwnership(arr.Data())
	return nil
}

func getNumericToStringCastExec(inType arrow.Type) exec.ArrayKernelExec {
	switch inType {
	case arrow.INT8:
		return numericToStringCastExec(numericFormatterSigned[int8])
	case arrow.UINT8:
		return numericToStringCastExec(numericFormatterUnsigned[uint8])
	case arrow.INT16:
		return numericToStringCastExec(numericFormatterSigned[int16])
	case arrow.UINT16:
		return numericToStringCastExec(numericFormatterUnsigned[uint16])
	case arrow.INT32:
		return numericToStringCastExec(numericFormatterSigned[int32])
	case arrow.UINT32:
		return numericToStringCastExec(numericFormatterUnsigned[uint32])
	case arrow.INT64:
		return numericToStringCastExec(numericFormatterSigned[int64])
	case arrow.UINT64:
		return numericToStringCastExec(numericFormatterUnsigned[uint64])
	case arrow.FLOAT16:
		return numericToStringCastExec(float16Formatter)
	case arrow.FLOAT32:
		return numericToStringCastExec(float32Formatter)
	case arrow.FLOAT64:
		return numericToStringCastExec(float64Formatter)
	case arrow.BOOL:
		return boolToStringCastExec
	case arrow.DATE32:
		return numericToStringCastExec(date32Formatter)
	case arrow.DATE64:
		return numericToStringCastExec(date64Formatter)
	case arrow.TIME32:
		return timeToStringCastExec[arrow.Time32]
	case arrow.TIME64:
		return timeToStringCastExec[arrow.Time64]
	case arrow.TIMESTAMP:
		return castTimestampToString
	}
	panic("unimplemented cast: " + inType.String())
}

func addNumericAndTemporalToStringCasts(outType exec.OutputType, out []exec.ScalarKernel) []exec.ScalarKernel {
	k := exec.NewScalarKernel([]exec.InputType{exec.NewExactInput(arrow.FixedWidthTypes.Boolean)}, outType,
		getNumericToStringCastExec(arrow.BOOL), nil)
	k.NullHandling = exec.NullComputedNoPrealloc
	out = append(out, k)

	for _, dt := range numericTypes {
		k = exec.NewScalarKernel([]exec.InputType{exec.NewExactInput(dt)}, outType,
			getNumericToStringCastExec(dt.ID()), nil)
		k.NullHandling = exec.NullComputedNoPrealloc
		out = append(out, k)
	}

	for _, dt := range []arrow.DataType{arrow.FixedWidthTypes.Date32, arrow.FixedWidthTypes.Date64} {
		k = exec.NewScalarKernel([]exec.InputType{exec.NewExactInput(dt)}, outType,
			getNumericToStringCastExec(dt.ID()), nil)
		k.NullHandling = exec.NullComputedNoPrealloc
		out = append(out, k)
	}

	for _, id := range []arrow.Type{arrow.TIME32, arrow.TIME64, arrow.TIMESTAMP} {
		k = exec.NewScalarKernel([]exec.InputType{exec.NewIDInput(id)}, outType,
			getNumericToStringCastExec(id), nil)
		k.NullHandling = exec.NullComputedNoPrealloc
		out = append(out, k)
	}

	return out
}

func GetToBinaryKernels(outType arrow.DataType) []exec.ScalarKernel {
	if outType.ID() == arrow.FIXED_SIZE_BINARY {
		return nil
	}

	outputType := exec.NewOutputType(outType)
	out := GetCommonCastKernels(outType.ID(), outputType)

	switch outType.ID() {
	case arrow.BINARY:
		return addToBinaryKernels[int32](outputType, out)
	case arrow.LARGE_BINARY:
		return addToBinaryKernels[int64](outputType, out)
	case arrow.STRING:
		out = addToBinaryKernels[int32](outputType, out)
		return addNumericAndTemporalToStringCasts(outputType, out)
	case arrow.LARGE_STRING:
		out = addToBinaryKernels[int64](outputType, out)
		return addNumericAndTemporalToStringCasts(outputType, out)
	}
	return nil
}
