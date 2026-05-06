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
	"unsafe"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/bitutil"
	"github.com/apache/arrow-go/v18/arrow/compute/exec"
	"github.com/apache/arrow-go/v18/arrow/internal/debug"
	"github.com/apache/arrow-go/v18/arrow/memory"
	"github.com/apache/arrow-go/v18/arrow/scalar"
	"github.com/apache/arrow-go/v18/internal/bitutils"
	"golang.org/x/exp/constraints"
)

// ScalarUnary returns a kernel for performing a unary operation on
// FixedWidth types which is implemented using the passed in function
// which will receive a slice containing the raw input data along with
// a slice to populate for the output data.
//
// Note that bool is not included in arrow.FixedWidthType since it is
// represented as a bitmap, not as a slice of bool.
func ScalarUnary[OutT, Arg0T arrow.FixedWidthType](op func(*exec.KernelCtx, []Arg0T, []OutT) error) exec.ArrayKernelExec {
	return func(ctx *exec.KernelCtx, in *exec.ExecSpan, out *exec.ExecResult) error {
		arg0 := in.Values[0].Array
		inData := exec.GetSpanValues[Arg0T](&arg0, 1)
		outData := exec.GetSpanValues[OutT](out, 1)
		return op(ctx, inData, outData)
	}
}

// ScalarUnaryNotNull is for generating a kernel to operate only on the
// non-null values in the input array. The zerovalue of the output type
// is used for any null input values.
func ScalarUnaryNotNull[OutT, Arg0T arrow.FixedWidthType](op func(*exec.KernelCtx, Arg0T, *error) OutT) exec.ArrayKernelExec {
	return func(ctx *exec.KernelCtx, in *exec.ExecSpan, out *exec.ExecResult) error {
		var (
			arg0     = &in.Values[0].Array
			arg0Data = exec.GetSpanValues[Arg0T](arg0, 1)
			outPos   = 0
			def      OutT
			outData  = exec.GetSpanValues[OutT](out, 1)
			bitmap   = arg0.Buffers[0].Buf
			err      error
		)

		bitutils.VisitBitBlocks(bitmap, arg0.Offset, arg0.Len,
			func(pos int64) {
				outData[outPos] = op(ctx, arg0Data[pos], &err)
				outPos++
			}, func() {
				outData[outPos] = def
				outPos++
			})
		return err
	}
}

// ScalarUnaryBoolOutput is like ScalarUnary only it is for cases of boolean
// output. The function should take in a slice of the input type and a slice
// of bytes to fill with the output boolean bitmap.
func ScalarUnaryBoolOutput[Arg0T arrow.FixedWidthType](op func(*exec.KernelCtx, []Arg0T, []byte) error) exec.ArrayKernelExec {
	return func(ctx *exec.KernelCtx, in *exec.ExecSpan, out *exec.ExecResult) error {
		arg0 := in.Values[0].Array
		inData := exec.GetSpanValues[Arg0T](&arg0, 1)
		return op(ctx, inData, out.Buffers[1].Buf)
	}
}

// ScalarUnaryNotNullBinaryArgBoolOut creates a unary kernel that accepts
// a binary type input (Binary [offset int32], String [offset int32],
// LargeBinary [offset int64], LargeString [offset int64]) and returns
// a boolean output which is never null.
//
// It implements the handling to iterate the offsets and values calling
// the provided function on each byte slice. The provided default value
// will be used as the output for elements of the input that are null.
func ScalarUnaryNotNullBinaryArgBoolOut[OffsetT int32 | int64](defVal bool, op func(*exec.KernelCtx, []byte, *error) bool) exec.ArrayKernelExec {
	return func(ctx *exec.KernelCtx, in *exec.ExecSpan, out *exec.ExecResult) error {
		var (
			arg0        = in.Values[0].Array
			outData     = out.Buffers[1].Buf
			outPos      = 0
			arg0Offsets = exec.GetSpanOffsets[OffsetT](&arg0, 1)
			arg0Data    = arg0.Buffers[2].Buf
			bitmap      = arg0.Buffers[0].Buf
			err         error
		)

		bitutils.VisitBitBlocks(bitmap, arg0.Offset, arg0.Len,
			func(pos int64) {
				v := arg0Data[arg0Offsets[pos]:arg0Offsets[pos+1]]
				bitutil.SetBitTo(outData, int(out.Offset)+outPos, op(ctx, v, &err))
				outPos++
			}, func() {
				bitutil.SetBitTo(outData, int(out.Offset)+outPos, defVal)
				outPos++
			})
		return err
	}
}

// ScalarUnaryNotNullBinaryArg creates a unary kernel that accepts
// a binary type input (Binary [offset int32], String [offset int32],
// LargeBinary [offset int64], LargeString [offset int64]) and returns
// a FixedWidthType output which is never null.
//
// It implements the handling to iterate the offsets and values calling
// the provided function on each byte slice. The zero value of the OutT
// will be used as the output for elements of the input that are null.
func ScalarUnaryNotNullBinaryArg[OutT arrow.FixedWidthType, OffsetT int32 | int64](op func(*exec.KernelCtx, []byte, *error) OutT) exec.ArrayKernelExec {
	return func(ctx *exec.KernelCtx, in *exec.ExecSpan, out *exec.ExecResult) error {
		var (
			arg0        = &in.Values[0].Array
			outData     = exec.GetSpanValues[OutT](out, 1)
			outPos      = 0
			arg0Offsets = exec.GetSpanOffsets[OffsetT](arg0, 1)
			def         OutT
			arg0Data    = arg0.Buffers[2].Buf
			bitmap      = arg0.Buffers[0].Buf
			err         error
		)

		bitutils.VisitBitBlocks(bitmap, arg0.Offset, arg0.Len,
			func(pos int64) {
				v := arg0Data[arg0Offsets[pos]:arg0Offsets[pos+1]]
				outData[outPos] = op(ctx, v, &err)
				outPos++
			}, func() {
				outData[outPos] = def
				outPos++
			})
		return err
	}
}

// ScalarUnaryBoolArg is like ScalarUnary except it specifically expects a
// function that takes a byte slice since booleans arrays are represented
// as a bitmap.
func ScalarUnaryBoolArg[OutT arrow.FixedWidthType](op func(*exec.KernelCtx, []byte, []OutT) error) exec.ArrayKernelExec {
	return func(ctx *exec.KernelCtx, input *exec.ExecSpan, out *exec.ExecResult) error {
		outData := exec.GetSpanValues[OutT](out, 1)
		return op(ctx, input.Values[0].Array.Buffers[1].Buf, outData)
	}
}

func UnboxScalar[T arrow.FixedWidthType](val scalar.PrimitiveScalar) T {
	return *(*T)(unsafe.Pointer(&val.Data()[0]))
}

func UnboxBinaryScalar(val scalar.BinaryScalar) []byte {
	if !val.IsValid() {
		return nil
	}
	return val.Data()
}

type arrArrFn[OutT, Arg0T, Arg1T arrow.FixedWidthType] func(*exec.KernelCtx, []Arg0T, []Arg1T, []OutT) error
type arrScalarFn[OutT, Arg0T, Arg1T arrow.FixedWidthType] func(*exec.KernelCtx, []Arg0T, Arg1T, []OutT) error
type scalarArrFn[OutT, Arg0T, Arg1T arrow.FixedWidthType] func(*exec.KernelCtx, Arg0T, []Arg1T, []OutT) error

type binaryOps[OutT, Arg0T, Arg1T arrow.FixedWidthType] struct {
	arrArr    arrArrFn[OutT, Arg0T, Arg1T]
	arrScalar arrScalarFn[OutT, Arg0T, Arg1T]
	scalarArr scalarArrFn[OutT, Arg0T, Arg1T]
}

type binaryBoolOps struct {
	arrArr    func(ctx *exec.KernelCtx, lhs, rhs, out bitutil.Bitmap) error
	arrScalar func(ctx *exec.KernelCtx, lhs bitutil.Bitmap, rhs bool, out bitutil.Bitmap) error
	scalarArr func(ctx *exec.KernelCtx, lhs bool, rhs, out bitutil.Bitmap) error
}

func ScalarBinary[OutT, Arg0T, Arg1T arrow.FixedWidthType](ops binaryOps[OutT, Arg0T, Arg1T]) exec.ArrayKernelExec {
	arrayArray := func(ctx *exec.KernelCtx, arg0, arg1 *exec.ArraySpan, out *exec.ExecResult) error {
		var (
			a0      = exec.GetSpanValues[Arg0T](arg0, 1)
			a1      = exec.GetSpanValues[Arg1T](arg1, 1)
			outData = exec.GetSpanValues[OutT](out, 1)
		)
		return ops.arrArr(ctx, a0, a1, outData)
	}

	arrayScalar := func(ctx *exec.KernelCtx, arg0 *exec.ArraySpan, arg1 scalar.Scalar, out *exec.ExecResult) error {
		var (
			a0      = exec.GetSpanValues[Arg0T](arg0, 1)
			a1      = UnboxScalar[Arg1T](arg1.(scalar.PrimitiveScalar))
			outData = exec.GetSpanValues[OutT](out, 1)
		)
		return ops.arrScalar(ctx, a0, a1, outData)
	}

	scalarArray := func(ctx *exec.KernelCtx, arg0 scalar.Scalar, arg1 *exec.ArraySpan, out *exec.ExecResult) error {
		var (
			a0      = UnboxScalar[Arg0T](arg0.(scalar.PrimitiveScalar))
			a1      = exec.GetSpanValues[Arg1T](arg1, 1)
			outData = exec.GetSpanValues[OutT](out, 1)
		)
		return ops.scalarArr(ctx, a0, a1, outData)
	}

	return func(ctx *exec.KernelCtx, batch *exec.ExecSpan, out *exec.ExecResult) error {
		if batch.Values[0].IsArray() {
			if batch.Values[1].IsArray() {
				return arrayArray(ctx, &batch.Values[0].Array, &batch.Values[1].Array, out)
			}
			return arrayScalar(ctx, &batch.Values[0].Array, batch.Values[1].Scalar, out)
		}

		if batch.Values[1].IsArray() {
			return scalarArray(ctx, batch.Values[0].Scalar, &batch.Values[1].Array, out)
		}

		debug.Assert(false, "should be unreachable")
		return fmt.Errorf("%w: scalar binary with two scalars?", arrow.ErrInvalid)
	}
}

func ScalarBinaryBools(ops *binaryBoolOps) exec.ArrayKernelExec {
	arrayArray := func(ctx *exec.KernelCtx, arg0, arg1 *exec.ArraySpan, out *exec.ExecResult) error {
		var (
			a0Bm  = bitutil.Bitmap{Data: arg0.Buffers[1].Buf, Offset: arg0.Offset, Len: arg0.Len}
			a1Bm  = bitutil.Bitmap{Data: arg1.Buffers[1].Buf, Offset: arg1.Offset, Len: arg1.Len}
			outBm = bitutil.Bitmap{Data: out.Buffers[1].Buf, Offset: out.Offset, Len: out.Len}
		)

		return ops.arrArr(ctx, a0Bm, a1Bm, outBm)
	}

	arrayScalar := func(ctx *exec.KernelCtx, arg0 *exec.ArraySpan, arg1 scalar.Scalar, out *exec.ExecResult) error {
		var (
			a0Bm  = bitutil.Bitmap{Data: arg0.Buffers[1].Buf, Offset: arg0.Offset, Len: arg0.Len}
			a1    = arg1.(*scalar.Boolean).Value
			outBm = bitutil.Bitmap{Data: out.Buffers[1].Buf, Offset: out.Offset, Len: out.Len}
		)
		return ops.arrScalar(ctx, a0Bm, a1, outBm)
	}

	scalarArray := func(ctx *exec.KernelCtx, arg0 scalar.Scalar, arg1 *exec.ArraySpan, out *exec.ExecResult) error {
		var (
			a0    = arg0.(*scalar.Boolean).Value
			a1Bm  = bitutil.Bitmap{Data: arg1.Buffers[1].Buf, Offset: arg1.Offset, Len: arg1.Len}
			outBm = bitutil.Bitmap{Data: out.Buffers[1].Buf, Offset: out.Offset, Len: out.Len}
		)
		return ops.scalarArr(ctx, a0, a1Bm, outBm)
	}

	return func(ctx *exec.KernelCtx, batch *exec.ExecSpan, out *exec.ExecResult) error {
		if batch.Values[0].IsArray() {
			if batch.Values[1].IsArray() {
				return arrayArray(ctx, &batch.Values[0].Array, &batch.Values[1].Array, out)
			}
			return arrayScalar(ctx, &batch.Values[0].Array, batch.Values[1].Scalar, out)
		}

		if batch.Values[1].IsArray() {
			return scalarArray(ctx, batch.Values[0].Scalar, &batch.Values[1].Array, out)
		}

		debug.Assert(false, "should be unreachable")
		return fmt.Errorf("%w: scalar binary with two scalars?", arrow.ErrInvalid)
	}
}

func ScalarBinaryNotNull[OutT, Arg0T, Arg1T arrow.FixedWidthType](op func(*exec.KernelCtx, Arg0T, Arg1T, *error) OutT) exec.ArrayKernelExec {
	arrayArray := func(ctx *exec.KernelCtx, arg0, arg1 *exec.ArraySpan, out *exec.ExecResult) (err error) {
		// fast path if one side is entirely null
		if arg0.UpdateNullCount() == arg0.Len || arg1.UpdateNullCount() == arg1.Len {
			return nil
		}

		var (
			a0      = exec.GetSpanValues[Arg0T](arg0, 1)
			a1      = exec.GetSpanValues[Arg1T](arg1, 1)
			outData = exec.GetSpanValues[OutT](out, 1)
			outPos  int64
			def     OutT
		)
		bitutils.VisitTwoBitBlocks(arg0.Buffers[0].Buf, arg1.Buffers[0].Buf, arg0.Offset, arg1.Offset, out.Len,
			func(pos int64) {
				outData[outPos] = op(ctx, a0[pos], a1[pos], &err)
				outPos++
			}, func() {
				outData[outPos] = def
				outPos++
			})
		return
	}

	arrayScalar := func(ctx *exec.KernelCtx, arg0 *exec.ArraySpan, arg1 scalar.Scalar, out *exec.ExecResult) (err error) {
		// fast path if one side is entirely null
		if arg0.UpdateNullCount() == arg0.Len || !arg1.IsValid() {
			return nil
		}

		var (
			a0      = exec.GetSpanValues[Arg0T](arg0, 1)
			outData = exec.GetSpanValues[OutT](out, 1)
			outPos  int64
			def     OutT
		)
		if !arg1.IsValid() {
			return nil
		}

		a1 := UnboxScalar[Arg1T](arg1.(scalar.PrimitiveScalar))
		bitutils.VisitBitBlocks(arg0.Buffers[0].Buf, arg0.Offset, arg0.Len,
			func(pos int64) {
				outData[outPos] = op(ctx, a0[pos], a1, &err)
				outPos++
			}, func() {
				outData[outPos] = def
				outPos++
			})
		return
	}

	scalarArray := func(ctx *exec.KernelCtx, arg0 scalar.Scalar, arg1 *exec.ArraySpan, out *exec.ExecResult) (err error) {
		// fast path if one side is entirely null
		if arg1.UpdateNullCount() == arg1.Len || !arg0.IsValid() {
			return nil
		}

		var (
			a1      = exec.GetSpanValues[Arg1T](arg1, 1)
			outData = exec.GetSpanValues[OutT](out, 1)
			outPos  int64
			def     OutT
		)
		if !arg0.IsValid() {
			return nil
		}

		a0 := UnboxScalar[Arg0T](arg0.(scalar.PrimitiveScalar))
		bitutils.VisitBitBlocks(arg1.Buffers[0].Buf, arg1.Offset, arg1.Len,
			func(pos int64) {
				outData[outPos] = op(ctx, a0, a1[pos], &err)
				outPos++
			}, func() {
				outData[outPos] = def
				outPos++
			})
		return
	}

	return func(ctx *exec.KernelCtx, batch *exec.ExecSpan, out *exec.ExecResult) error {
		if batch.Values[0].IsArray() {
			if batch.Values[1].IsArray() {
				return arrayArray(ctx, &batch.Values[0].Array, &batch.Values[1].Array, out)
			}
			return arrayScalar(ctx, &batch.Values[0].Array, batch.Values[1].Scalar, out)
		}

		if batch.Values[1].IsArray() {
			return scalarArray(ctx, batch.Values[0].Scalar, &batch.Values[1].Array, out)
		}

		debug.Assert(false, "should be unreachable")
		return fmt.Errorf("%w: scalar binary with two scalars?", arrow.ErrInvalid)
	}
}

type binaryBinOp[T arrow.FixedWidthType | bool] func(ctx *exec.KernelCtx, arg0, arg1 []byte) T

func ScalarBinaryBinaryArgsBoolOut(itrFn func(*exec.ArraySpan) exec.ArrayIter[[]byte], op binaryBinOp[bool]) exec.ArrayKernelExec {
	arrArr := func(ctx *exec.KernelCtx, arg0, arg1 *exec.ArraySpan, out *exec.ExecResult) error {
		var (
			arg0It = itrFn(arg0)
			arg1It = itrFn(arg1)
		)

		bitutils.GenerateBitsUnrolled(out.Buffers[1].Buf, out.Offset, out.Len, func() bool {
			return op(ctx, arg0It.Next(), arg1It.Next())
		})
		return nil
	}

	arrScalar := func(ctx *exec.KernelCtx, arg0 *exec.ArraySpan, arg1 scalar.Scalar, out *exec.ExecResult) error {
		var (
			arg0It = itrFn(arg0)
			a1     = UnboxBinaryScalar(arg1.(scalar.BinaryScalar))
		)

		bitutils.GenerateBitsUnrolled(out.Buffers[1].Buf, out.Offset, out.Len, func() bool {
			return op(ctx, arg0It.Next(), a1)
		})
		return nil
	}

	scalarArr := func(ctx *exec.KernelCtx, arg0 scalar.Scalar, arg1 *exec.ArraySpan, out *exec.ExecResult) error {
		var (
			arg1It = itrFn(arg1)
			a0     = UnboxBinaryScalar(arg0.(scalar.BinaryScalar))
		)

		bitutils.GenerateBitsUnrolled(out.Buffers[1].Buf, out.Offset, out.Len, func() bool {
			return op(ctx, a0, arg1It.Next())
		})
		return nil
	}

	return func(ctx *exec.KernelCtx, batch *exec.ExecSpan, out *exec.ExecResult) error {
		if batch.Values[0].IsArray() {
			if batch.Values[1].IsArray() {
				return arrArr(ctx, &batch.Values[0].Array, &batch.Values[1].Array, out)
			}
			return arrScalar(ctx, &batch.Values[0].Array, batch.Values[1].Scalar, out)
		}

		if batch.Values[1].IsArray() {
			return scalarArr(ctx, batch.Values[0].Scalar, &batch.Values[1].Array, out)
		}

		debug.Assert(false, "should be unreachable")
		return fmt.Errorf("%w: scalar binary with two scalars?", arrow.ErrInvalid)
	}
}

// SizeOf determines the size in number of bytes for an integer
// based on the generic value in a way that the compiler should
// be able to easily evaluate and create as a constant.
func SizeOf[T constraints.Integer]() uint {
	x := uint16(1 << 8)
	y := uint32(2 << 16)
	z := uint64(4 << 32)
	return 1 + uint(T(x))>>8 + uint(T(y))>>16 + uint(T(z))>>32
}

// MinOf returns the minimum value for a given type since there is not
// currently a generic way to do this with Go generics yet.
func MinOf[T constraints.Integer]() T {
	if ones := ^T(0); ones < 0 {
		return ones << (8*SizeOf[T]() - 1)
	}
	return 0
}

// MaxOf determines the max value for a given type since there is not
// currently a generic way to do this for Go generics yet as all of the
// math.Max/Min values are constants.
func MaxOf[T constraints.Integer]() T {
	ones := ^T(0)
	if ones < 0 {
		return ones ^ (ones << (8*SizeOf[T]() - 1))
	}
	return ones
}

func getSafeMinSameSign[I, O constraints.Integer]() I {
	if SizeOf[I]() > SizeOf[O]() {
		return I(MinOf[O]())
	}
	return MinOf[I]()
}

func getSafeMaxSameSign[I, O constraints.Integer]() I {
	if SizeOf[I]() > SizeOf[O]() {
		return I(MaxOf[O]())
	}
	return MaxOf[I]()
}

func getSafeMaxSignedUnsigned[I constraints.Signed, O constraints.Unsigned]() I {
	if SizeOf[I]() <= SizeOf[O]() {
		return MaxOf[I]()
	}
	return I(MaxOf[O]())
}

func getSafeMaxUnsignedSigned[I constraints.Unsigned, O constraints.Signed]() I {
	if SizeOf[I]() < SizeOf[O]() {
		return MaxOf[I]()
	}
	return I(MaxOf[O]())
}

func getSafeMinMaxSigned[T constraints.Signed](target arrow.Type) (min, max T) {
	switch target {
	case arrow.UINT8:
		min, max = 0, getSafeMaxSignedUnsigned[T, uint8]()
	case arrow.UINT16:
		min, max = 0, getSafeMaxSignedUnsigned[T, uint16]()
	case arrow.UINT32:
		min, max = 0, getSafeMaxSignedUnsigned[T, uint32]()
	case arrow.UINT64:
		min, max = 0, getSafeMaxSignedUnsigned[T, uint64]()
	case arrow.INT8:
		min = getSafeMinSameSign[T, int8]()
		max = getSafeMaxSameSign[T, int8]()
	case arrow.INT16:
		min = getSafeMinSameSign[T, int16]()
		max = getSafeMaxSameSign[T, int16]()
	case arrow.INT32:
		min = getSafeMinSameSign[T, int32]()
		max = getSafeMaxSameSign[T, int32]()
	case arrow.INT64:
		min = getSafeMinSameSign[T, int64]()
		max = getSafeMaxSameSign[T, int64]()
	}
	return
}

func getSafeMinMaxUnsigned[T constraints.Unsigned](target arrow.Type) (min, max T) {
	min = 0
	switch target {
	case arrow.UINT8:
		max = getSafeMaxSameSign[T, uint8]()
	case arrow.UINT16:
		max = getSafeMaxSameSign[T, uint16]()
	case arrow.UINT32:
		max = getSafeMaxSameSign[T, uint32]()
	case arrow.UINT64:
		max = getSafeMaxSameSign[T, uint64]()
	case arrow.INT8:
		max = getSafeMaxUnsignedSigned[T, int8]()
	case arrow.INT16:
		max = getSafeMaxUnsignedSigned[T, int16]()
	case arrow.INT32:
		max = getSafeMaxUnsignedSigned[T, int32]()
	case arrow.INT64:
		max = getSafeMaxUnsignedSigned[T, int64]()
	}
	return
}

func intsCanFit(data *exec.ArraySpan, target arrow.Type) error {
	if !arrow.IsInteger(target) {
		return fmt.Errorf("%w: target type is not an integer type %s", arrow.ErrInvalid, target)
	}

	switch data.Type.ID() {
	case arrow.INT8:
		min, max := getSafeMinMaxSigned[int8](target)
		return intsInRange(data, min, max)
	case arrow.UINT8:
		min, max := getSafeMinMaxUnsigned[uint8](target)
		return intsInRange(data, min, max)
	case arrow.INT16:
		min, max := getSafeMinMaxSigned[int16](target)
		return intsInRange(data, min, max)
	case arrow.UINT16:
		min, max := getSafeMinMaxUnsigned[uint16](target)
		return intsInRange(data, min, max)
	case arrow.INT32:
		min, max := getSafeMinMaxSigned[int32](target)
		return intsInRange(data, min, max)
	case arrow.UINT32:
		min, max := getSafeMinMaxUnsigned[uint32](target)
		return intsInRange(data, min, max)
	case arrow.INT64:
		min, max := getSafeMinMaxSigned[int64](target)
		return intsInRange(data, min, max)
	case arrow.UINT64:
		min, max := getSafeMinMaxUnsigned[uint64](target)
		return intsInRange(data, min, max)
	default:
		return fmt.Errorf("%w: invalid type for int bounds checking", arrow.ErrInvalid)
	}
}

func intsInRange[T arrow.IntType | arrow.UintType](data *exec.ArraySpan, lowerBound, upperBound T) error {
	if MinOf[T]() >= lowerBound && MaxOf[T]() <= upperBound {
		return nil
	}

	isOutOfBounds := func(val T) bool {
		return val < lowerBound || val > upperBound
	}
	isOutOfBoundsMaybeNull := func(val T, isValid bool) bool {
		return isValid && (val < lowerBound || val > upperBound)
	}
	getError := func(val T) error {
		return fmt.Errorf("%w: integer value %d not in range: %d to %d",
			arrow.ErrInvalid, val, lowerBound, upperBound)
	}

	values := exec.GetSpanValues[T](data, 1)
	bitmap := data.Buffers[0].Buf

	bitCounter := bitutils.NewOptionalBitBlockCounter(bitmap, data.Offset, data.Len)
	pos, offsetPos := 0, data.Offset
	for pos < int(data.Len) {
		block := bitCounter.NextBlock()
		outOfBounds := false

		if block.Popcnt == block.Len {
			// fast path: branchless
			i := 0
			for chunk := 0; chunk < int(block.Len)/8; chunk++ {
				for j := 0; j < 8; j++ {
					outOfBounds = outOfBounds || isOutOfBounds(values[i])
					i++
				}
			}
			for ; i < int(block.Len); i++ {
				outOfBounds = outOfBounds || isOutOfBounds(values[i])
			}
		} else if block.Popcnt > 0 {
			// values may be null, only bounds check non-null vals
			i := 0
			for chunk := 0; chunk < int(block.Len)/8; chunk++ {
				for j := 0; j < 8; j++ {
					outOfBounds = outOfBounds || isOutOfBoundsMaybeNull(
						values[i], bitutil.BitIsSet(bitmap, int(offsetPos)+i))
					i++
				}
			}
			for ; i < int(block.Len); i++ {
				outOfBounds = outOfBounds || isOutOfBoundsMaybeNull(
					values[i], bitutil.BitIsSet(bitmap, int(offsetPos)+i))
			}
		}
		if outOfBounds {
			if data.Nulls > 0 {
				for i := 0; i < int(block.Len); i++ {
					if isOutOfBoundsMaybeNull(values[i], bitutil.BitIsSet(bitmap, int(offsetPos)+i)) {
						return getError(values[i])
					}
				}
			} else {
				for i := 0; i < int(block.Len); i++ {
					if isOutOfBounds(values[i]) {
						return getError(values[i])
					}
				}
			}
		}

		values = values[block.Len:]
		pos += int(block.Len)
		offsetPos += int64(block.Len)
	}
	return nil
}

type numeric interface {
	arrow.IntType | arrow.UintType | constraints.Float
}

func memCpySpan[T numeric](in, out *exec.ArraySpan) {
	inData := exec.GetSpanValues[T](in, 1)
	outData := exec.GetSpanValues[T](out, 1)
	copy(outData, inData)
}

func castNumberMemCpy(in, out *exec.ArraySpan) {
	switch in.Type.ID() {
	case arrow.INT8:
		memCpySpan[int8](in, out)
	case arrow.UINT8:
		memCpySpan[uint8](in, out)
	case arrow.INT16:
		memCpySpan[int16](in, out)
	case arrow.UINT16:
		memCpySpan[uint16](in, out)
	case arrow.INT32:
		memCpySpan[int32](in, out)
	case arrow.UINT32:
		memCpySpan[uint32](in, out)
	case arrow.INT64:
		memCpySpan[int64](in, out)
	case arrow.UINT64:
		memCpySpan[uint64](in, out)
	case arrow.FLOAT32:
		memCpySpan[float32](in, out)
	case arrow.FLOAT64:
		memCpySpan[float64](in, out)
	}
}

func castNumberToNumberUnsafe(in, out *exec.ArraySpan) {
	if in.Type.ID() == out.Type.ID() {
		castNumberMemCpy(in, out)
		return
	}

	inputOffset := in.Type.(arrow.FixedWidthDataType).Bytes() * int(in.Offset)
	outputOffset := out.Type.(arrow.FixedWidthDataType).Bytes() * int(out.Offset)
	castNumericUnsafe(in.Type.ID(), out.Type.ID(), in.Buffers[1].Buf[inputOffset:], out.Buffers[1].Buf[outputOffset:], int(in.Len))
}

func MaxDecimalDigitsForInt(id arrow.Type) (int32, error) {
	switch id {
	case arrow.INT8, arrow.UINT8:
		return 3, nil
	case arrow.INT16, arrow.UINT16:
		return 5, nil
	case arrow.INT32, arrow.UINT32:
		return 10, nil
	case arrow.INT64:
		return 19, nil
	case arrow.UINT64:
		return 20, nil
	}
	return -1, fmt.Errorf("%w: not an integer type: %s", arrow.ErrInvalid, id)
}

func ResolveOutputFromOptions(ctx *exec.KernelCtx, _ []arrow.DataType) (arrow.DataType, error) {
	opts := ctx.State.(CastState)
	return opts.ToType, nil
}

var OutputTargetType = exec.NewComputedOutputType(ResolveOutputFromOptions)

var OutputFirstType = exec.NewComputedOutputType(func(_ *exec.KernelCtx, args []arrow.DataType) (arrow.DataType, error) {
	return args[0], nil
})

var OutputLastType = exec.NewComputedOutputType(func(_ *exec.KernelCtx, args []arrow.DataType) (arrow.DataType, error) {
	return args[len(args)-1], nil
})

func resolveDecimalBinaryOpOutput(types []arrow.DataType, resolver func(prec1, scale1, prec2, scale2 int32) (prec, scale int32)) (arrow.DataType, error) {
	leftType, rightType := types[0].(arrow.DecimalType), types[1].(arrow.DecimalType)
	debug.Assert(leftType.ID() == rightType.ID(), "decimal binary ops should have casted to the same type")

	prec, scale := resolver(leftType.GetPrecision(), leftType.GetScale(),
		rightType.GetPrecision(), rightType.GetScale())

	return arrow.NewDecimalType(leftType.ID(), prec, scale)
}

func resolveDecimalAddOrSubtractType(_ *exec.KernelCtx, args []arrow.DataType) (arrow.DataType, error) {
	return resolveDecimalBinaryOpOutput(args,
		func(prec1, scale1, prec2, scale2 int32) (prec int32, scale int32) {
			debug.Assert(scale1 == scale2, "decimal operations should use the same scale")
			scale = scale1
			prec = exec.Max(prec1-scale1, prec2-scale2) + scale + 1
			return
		})
}

func resolveDecimalMultiplyOutput(_ *exec.KernelCtx, args []arrow.DataType) (arrow.DataType, error) {
	return resolveDecimalBinaryOpOutput(args,
		func(prec1, scale1, prec2, scale2 int32) (prec int32, scale int32) {
			scale = scale1 + scale2
			prec = prec1 + prec2 + 1
			return
		})
}

func resolveDecimalDivideOutput(_ *exec.KernelCtx, args []arrow.DataType) (arrow.DataType, error) {
	return resolveDecimalBinaryOpOutput(args,
		func(prec1, scale1, prec2, scale2 int32) (prec int32, scale int32) {
			debug.Assert(scale1 >= scale2, "when dividing decimal values numerator scale should be greater/equal to denom scale")
			scale = scale1 - scale2
			prec = prec1
			return
		})
}

func resolveTemporalOutput(_ *exec.KernelCtx, args []arrow.DataType) (arrow.DataType, error) {
	debug.Assert(args[0].ID() == args[1].ID(), "should only be used on the same types")
	leftType, rightType := args[0].(*arrow.TimestampType), args[1].(*arrow.TimestampType)
	debug.Assert(leftType.Unit == rightType.Unit, "should match units")

	if (leftType.TimeZone == "" || rightType.TimeZone == "") && (leftType.TimeZone != rightType.TimeZone) {
		return nil, fmt.Errorf("%w: subtraction of zoned and non-zoned times is ambiguous (%s, %s)",
			arrow.ErrInvalid, leftType.TimeZone, rightType.TimeZone)
	}

	return &arrow.DurationType{Unit: rightType.Unit}, nil
}

var OutputResolveTemporal = exec.NewComputedOutputType(resolveTemporalOutput)

type validityBuilder struct {
	mem    memory.Allocator
	buffer *memory.Buffer

	data       []byte
	bitLength  int
	falseCount int
}

func (v *validityBuilder) Resize(n int64) {
	if v.buffer == nil {
		v.buffer = memory.NewResizableBuffer(v.mem)
	}

	v.buffer.ResizeNoShrink(int(bitutil.BytesForBits(n)))
	v.data = v.buffer.Bytes()
}

func (v *validityBuilder) Reserve(n int64) {
	if v.buffer == nil {
		v.buffer = memory.NewResizableBuffer(v.mem)
	}

	v.buffer.Reserve(v.buffer.Cap() + int(bitutil.BytesForBits(n)))
	v.data = v.buffer.Buf()
}

func (v *validityBuilder) UnsafeAppend(val bool) {
	bitutil.SetBitTo(v.data, v.bitLength, val)
	if !val {
		v.falseCount++
	}
	v.bitLength++
}

func (v *validityBuilder) UnsafeAppendN(n int64, val bool) {
	bitutil.SetBitsTo(v.data, int64(v.bitLength), n, val)
	if !val {
		v.falseCount += int(n)
	}
	v.bitLength += int(n)
}

func (v *validityBuilder) Append(val bool) {
	v.Reserve(1)
	v.UnsafeAppend(val)
}

func (v *validityBuilder) AppendN(n int64, val bool) {
	v.Reserve(n)
	v.UnsafeAppendN(n, val)
}

func (v *validityBuilder) Finish() (buf *memory.Buffer) {
	if v.bitLength > 0 {
		v.buffer.Resize(int(bitutil.BytesForBits(int64(v.bitLength))))
	}

	v.bitLength, v.falseCount = 0, 0
	buf = v.buffer
	v.buffer = nil
	return
}

type execBufBuilder struct {
	mem    memory.Allocator
	buffer *memory.Buffer
	data   []byte
	sz     int
}

func (bldr *execBufBuilder) reserve(additional int) {
	if bldr.buffer == nil {
		bldr.buffer = memory.NewResizableBuffer(bldr.mem)
	}

	mincap := bldr.sz + additional
	if mincap <= cap(bldr.data) {
		return
	}
	bldr.buffer.ResizeNoShrink(mincap)
	bldr.data = bldr.buffer.Buf()
}

func (bldr *execBufBuilder) unsafeAppend(data []byte) {
	copy(bldr.data[bldr.sz:], data)
	bldr.sz += len(data)
}

func (bldr *execBufBuilder) finish() (buf *memory.Buffer) {
	if bldr.buffer == nil {
		buf = memory.NewBufferBytes(nil)
		return
	}
	bldr.buffer.Resize(bldr.sz)
	buf = bldr.buffer
	bldr.buffer, bldr.sz = nil, 0
	return
}

type bufferBuilder[T arrow.FixedWidthType] struct {
	execBufBuilder
	zero T
}

func newBufferBuilder[T arrow.FixedWidthType](mem memory.Allocator) *bufferBuilder[T] {
	return &bufferBuilder[T]{
		execBufBuilder: execBufBuilder{
			mem: mem,
		},
	}
}

func (b *bufferBuilder[T]) reserve(additional int) {
	b.execBufBuilder.reserve(additional * int(unsafe.Sizeof(b.zero)))
}

func (b *bufferBuilder[T]) unsafeAppend(value T) {
	b.execBufBuilder.unsafeAppend(arrow.GetBytes([]T{value}))
}

func (b *bufferBuilder[T]) unsafeAppendSlice(values []T) {
	b.execBufBuilder.unsafeAppend(arrow.GetBytes(values))
}

func (b *bufferBuilder[T]) len() int { return b.sz / int(unsafe.Sizeof(b.zero)) }

func (b *bufferBuilder[T]) cap() int {
	return cap(b.data) / int(unsafe.Sizeof(b.zero))
}

func checkIndexBoundsImpl[T arrow.IntType | arrow.UintType](values *exec.ArraySpan, upperLimit uint64) error {
	// for unsigned integers, if the values array is larger
	// than the maximum index value, then there's no need to bounds check
	isSigned := !arrow.IsUnsignedInteger(values.Type.ID())
	if !isSigned && upperLimit > uint64(MaxOf[T]()) {
		return nil
	}

	valuesData := exec.GetSpanValues[T](values, 1)
	bitmap := values.Buffers[0].Buf
	isOutOfBounds := func(val T) bool {
		return ((isSigned && val < 0) || val >= 0 && uint64(val) >= upperLimit)
	}
	return bitutils.VisitSetBitRuns(bitmap, values.Offset, values.Len,
		func(pos, length int64) error {
			outOfBounds := false
			for i := int64(0); i < length; i++ {
				outOfBounds = outOfBounds || isOutOfBounds(valuesData[pos+i])
			}
			if outOfBounds {
				for i := int64(0); i < length; i++ {
					if isOutOfBounds(valuesData[pos+i]) {
						return fmt.Errorf("%w: %d out of bounds",
							arrow.ErrIndex, valuesData[pos+i])
					}
				}
			}
			return nil
		})
}

func checkIndexBounds(values *exec.ArraySpan, upperLimit uint64) error {
	switch values.Type.ID() {
	case arrow.INT8:
		return checkIndexBoundsImpl[int8](values, upperLimit)
	case arrow.UINT8:
		return checkIndexBoundsImpl[uint8](values, upperLimit)
	case arrow.INT16:
		return checkIndexBoundsImpl[int16](values, upperLimit)
	case arrow.UINT16:
		return checkIndexBoundsImpl[uint16](values, upperLimit)
	case arrow.INT32:
		return checkIndexBoundsImpl[int32](values, upperLimit)
	case arrow.UINT32:
		return checkIndexBoundsImpl[uint32](values, upperLimit)
	case arrow.INT64:
		return checkIndexBoundsImpl[int64](values, upperLimit)
	case arrow.UINT64:
		return checkIndexBoundsImpl[uint64](values, upperLimit)
	default:
		return fmt.Errorf("%w: invalid index type for bounds checking", arrow.ErrInvalid)
	}
}

func checkIndexBoundsChunked(values *arrow.Chunked, upperLimit uint64) error {
	var span exec.ArraySpan
	for _, v := range values.Chunks() {
		span.SetMembers(v.Data())
		if err := checkIndexBounds(&span, upperLimit); err != nil {
			return err
		}
	}
	return nil
}

func packBits(vals [32]uint32, out []byte) {
	const batchSize = 32
	for i := 0; i < batchSize; i += 8 {
		out[0] = byte(vals[i] | vals[i+1]<<1 | vals[i+2]<<2 | vals[i+3]<<3 |
			vals[i+4]<<4 | vals[i+5]<<5 | vals[i+6]<<6 | vals[i+7]<<7)
		out = out[1:]
	}
}
