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
	"time"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/bitutil"
	"github.com/apache/arrow-go/v18/arrow/compute/exec"
	"github.com/apache/arrow-go/v18/arrow/decimal128"
	"github.com/apache/arrow-go/v18/arrow/decimal256"
	"github.com/apache/arrow-go/v18/arrow/internal/debug"
	"github.com/apache/arrow-go/v18/arrow/scalar"
)

// scalar kernel that ignores (assumed all-null inputs) and returns null
func NullToNullExec(_ *exec.KernelCtx, _ *exec.ExecSpan, _ *exec.ExecResult) error {
	return nil
}

func NullExecKernel(nargs int) exec.ScalarKernel {
	in := make([]exec.InputType, nargs)
	for i := range in {
		in[i] = exec.NewIDInput(arrow.NULL)
	}
	return exec.NewScalarKernel(in, exec.NewOutputType(arrow.Null), NullToNullExec, nil)
}

func GetArithmeticFunctionTimeDuration(op ArithmeticOp) []exec.ScalarKernel {
	mult := (time.Hour * 24)
	return []exec.ScalarKernel{exec.NewScalarKernel([]exec.InputType{
		exec.NewExactInput(arrow.FixedWidthTypes.Time32s),
		exec.NewExactInput(&arrow.DurationType{Unit: arrow.Second})}, OutputFirstType,
		timeDurationOp[arrow.Time32, arrow.Time32, arrow.Duration](int64(mult.Seconds()), op), nil),
		exec.NewScalarKernel([]exec.InputType{
			exec.NewExactInput(arrow.FixedWidthTypes.Time32ms),
			exec.NewExactInput(&arrow.DurationType{Unit: arrow.Millisecond})}, OutputFirstType,
			timeDurationOp[arrow.Time32, arrow.Time32, arrow.Duration](int64(mult.Milliseconds()), op), nil),
		exec.NewScalarKernel([]exec.InputType{
			exec.NewExactInput(arrow.FixedWidthTypes.Time64us),
			exec.NewExactInput(&arrow.DurationType{Unit: arrow.Microsecond})}, OutputFirstType,
			timeDurationOp[arrow.Time64, arrow.Time64, arrow.Duration](int64(mult.Microseconds()), op), nil),
		exec.NewScalarKernel([]exec.InputType{
			exec.NewExactInput(arrow.FixedWidthTypes.Time64ns),
			exec.NewExactInput(&arrow.DurationType{Unit: arrow.Nanosecond})}, OutputFirstType,
			timeDurationOp[arrow.Time64, arrow.Time64, arrow.Duration](int64(mult.Nanoseconds()), op), nil)}
}

func GetDecimalBinaryKernels(op ArithmeticOp) []exec.ScalarKernel {
	var outType exec.OutputType
	switch op {
	case OpAdd, OpSub, OpAddChecked, OpSubChecked:
		outType = exec.NewComputedOutputType(resolveDecimalAddOrSubtractType)
	case OpMul, OpMulChecked:
		outType = exec.NewComputedOutputType(resolveDecimalMultiplyOutput)
	case OpDiv, OpDivChecked:
		outType = exec.NewComputedOutputType(resolveDecimalDivideOutput)
	}

	in128, in256 := exec.NewIDInput(arrow.DECIMAL128), exec.NewIDInput(arrow.DECIMAL256)
	exec128, exec256 := getArithmeticDecimal[decimal128.Num](op), getArithmeticDecimal[decimal256.Num](op)
	return []exec.ScalarKernel{
		exec.NewScalarKernel([]exec.InputType{in128, in128}, outType, exec128, nil),
		exec.NewScalarKernel([]exec.InputType{in256, in256}, outType, exec256, nil),
	}
}

func GetArithmeticBinaryKernels(op ArithmeticOp) []exec.ScalarKernel {
	kernels := make([]exec.ScalarKernel, 0)
	for _, ty := range numericTypes {
		kernels = append(kernels, exec.NewScalarKernel(
			[]exec.InputType{exec.NewExactInput(ty), exec.NewExactInput(ty)},
			exec.NewOutputType(ty), ArithmeticExecSameType(ty.ID(), op), nil))
	}

	return append(kernels, NullExecKernel(2))
}

func GetDecimalUnaryKernels(op ArithmeticOp) []exec.ScalarKernel {
	outType := OutputFirstType
	in128 := exec.NewIDInput(arrow.DECIMAL128)
	in256 := exec.NewIDInput(arrow.DECIMAL256)

	exec128, exec256 := getArithmeticDecimal[decimal128.Num](op), getArithmeticDecimal[decimal256.Num](op)
	return []exec.ScalarKernel{
		exec.NewScalarKernel([]exec.InputType{in128}, outType, exec128, nil),
		exec.NewScalarKernel([]exec.InputType{in256}, outType, exec256, nil),
	}
}

func GetArithmeticUnaryKernels(op ArithmeticOp) []exec.ScalarKernel {
	kernels := make([]exec.ScalarKernel, 0)
	for _, ty := range numericTypes {
		kernels = append(kernels, exec.NewScalarKernel(
			[]exec.InputType{exec.NewExactInput(ty)}, exec.NewOutputType(ty),
			ArithmeticExec(ty.ID(), ty.ID(), op), nil))
	}

	return append(kernels, NullExecKernel(1))
}

func GetArithmeticUnarySignedKernels(op ArithmeticOp) []exec.ScalarKernel {
	kernels := make([]exec.ScalarKernel, 0)
	for _, ty := range append(signedIntTypes, floatingTypes...) {
		kernels = append(kernels, exec.NewScalarKernel(
			[]exec.InputType{exec.NewExactInput(ty)}, exec.NewOutputType(ty),
			ArithmeticExec(ty.ID(), ty.ID(), op), nil))
	}

	return append(kernels, NullExecKernel(1))
}

func GetArithmeticUnaryFloatingPointKernels(op ArithmeticOp) []exec.ScalarKernel {
	kernels := make([]exec.ScalarKernel, 0)
	for _, ty := range floatingTypes {
		kernels = append(kernels, exec.NewScalarKernel(
			[]exec.InputType{exec.NewExactInput(ty)}, exec.NewOutputType(ty),
			ArithmeticExec(ty.ID(), ty.ID(), op), nil))
	}

	return append(kernels, NullExecKernel(1))
}

func GetArithmeticFloatingPointKernels(op ArithmeticOp) []exec.ScalarKernel {
	kernels := make([]exec.ScalarKernel, 0)
	for _, ty := range floatingTypes {
		in := exec.NewExactInput(ty)
		kernels = append(kernels, exec.NewScalarKernel(
			[]exec.InputType{in, in}, exec.NewOutputType(ty),
			ArithmeticExecSameType(ty.ID(), op), nil))
	}

	return append(kernels, NullExecKernel(2))
}

func GetArithmeticUnaryFixedIntOutKernels(otype arrow.DataType, op ArithmeticOp) []exec.ScalarKernel {
	kernels := make([]exec.ScalarKernel, 0)

	out := exec.NewOutputType(otype)
	for _, ty := range numericTypes {
		otype := otype
		out := out
		if arrow.IsFloating(ty.ID()) {
			otype = ty
			out = exec.NewOutputType(ty)
		}

		kernels = append(kernels, exec.NewScalarKernel(
			[]exec.InputType{exec.NewExactInput(ty)}, out,
			ArithmeticExec(ty.ID(), otype.ID(), op), nil))
	}

	kernels = append(kernels, exec.NewScalarKernel(
		[]exec.InputType{exec.NewIDInput(arrow.DECIMAL128)},
		exec.NewOutputType(arrow.PrimitiveTypes.Int64),
		getArithmeticDecimal[decimal128.Num](op), nil))
	kernels = append(kernels, exec.NewScalarKernel(
		[]exec.InputType{exec.NewIDInput(arrow.DECIMAL256)},
		exec.NewOutputType(arrow.PrimitiveTypes.Int64),
		getArithmeticDecimal[decimal256.Num](op), nil))

	return append(kernels, NullExecKernel(1))
}

type BitwiseOp int8

const (
	OpBitAnd BitwiseOp = iota
	OpBitOr
	OpBitXor
)

func bitwiseKernelOp(op BitwiseOp) exec.ArrayKernelExec {
	var fn func([]byte, []byte, int64, int64, []byte, int64, int64)
	switch op {
	case OpBitOr:
		fn = bitutil.BitmapOr
	case OpBitAnd:
		fn = bitutil.BitmapAnd
	case OpBitXor:
		fn = bitutil.BitmapXor
	}

	arrayArray := func(left, right *exec.ArraySpan, out *exec.ExecResult) error {
		bits := int64(left.Type.(arrow.FixedWidthDataType).BitWidth())
		fn(left.Buffers[1].Buf, right.Buffers[1].Buf,
			bits*left.Offset, bits*right.Offset,
			out.Buffers[1].Buf, bits*out.Offset, bits*left.Len)
		return nil
	}

	arrayScalar := func(arr *exec.ArraySpan, sc scalar.Scalar, out *exec.ExecResult) error {
		if !sc.IsValid() {
			// no work to be done, everything is null
			return nil
		}

		val := sc.(scalar.PrimitiveScalar).Data()
		byteWidth := int64(len(val))
		bitWidth := byteWidth * 8
		arrBuf := arr.Buffers[1].Buf[byteWidth*arr.Offset:]
		outBuf := out.Buffers[1].Buf[byteWidth*out.Offset:]

		for i := int64(0); i < arr.Len; i++ {
			fn(arrBuf, val, 0, 0, outBuf, 0, bitWidth)
			arrBuf, outBuf = arrBuf[byteWidth:], outBuf[byteWidth:]
		}
		return nil
	}

	return func(_ *exec.KernelCtx, batch *exec.ExecSpan, out *exec.ExecResult) error {
		if batch.Values[0].IsArray() {
			if batch.Values[1].IsArray() {
				return arrayArray(&batch.Values[0].Array, &batch.Values[1].Array, out)
			}
			return arrayScalar(&batch.Values[0].Array, batch.Values[1].Scalar, out)
		}

		if batch.Values[1].IsArray() {
			return arrayScalar(&batch.Values[1].Array, batch.Values[0].Scalar, out)
		}

		debug.Assert(false, "should be unreachable")
		return fmt.Errorf("%w: scalar binary with two scalars?", arrow.ErrInvalid)
	}
}

func GetBitwiseBinaryKernels(op BitwiseOp) []exec.ScalarKernel {
	kernels := make([]exec.ScalarKernel, 0)
	for _, ty := range intTypes {
		ex := bitwiseKernelOp(op)
		inType := exec.NewExactInput(ty)
		kernels = append(kernels, exec.NewScalarKernel([]exec.InputType{
			inType, inType}, exec.NewOutputType(ty), ex, nil))
	}
	return append(kernels, NullExecKernel(2))
}

func bitwiseNot[T arrow.IntType | arrow.UintType](_ *exec.KernelCtx, arg T, _ *error) T {
	return ^arg
}

func getBitwiseNotExec(ty arrow.DataType) exec.ArrayKernelExec {
	switch ty.ID() {
	case arrow.INT8, arrow.UINT8:
		return ScalarUnaryNotNull(bitwiseNot[uint8])
	case arrow.INT16, arrow.UINT16:
		return ScalarUnaryNotNull(bitwiseNot[uint16])
	case arrow.INT32, arrow.UINT32:
		return ScalarUnaryNotNull(bitwiseNot[uint32])
	case arrow.INT64, arrow.UINT64:
		return ScalarUnaryNotNull(bitwiseNot[uint64])
	}
	panic("only integral types for bitwise not kernels")
}

func GetBitwiseUnaryKernels() []exec.ScalarKernel {
	kernels := make([]exec.ScalarKernel, 0)
	for _, ty := range intTypes {
		ex := getBitwiseNotExec(ty)
		kernels = append(kernels, exec.NewScalarKernel(
			[]exec.InputType{exec.NewExactInput(ty)}, exec.NewOutputType(ty),
			ex, nil))
	}
	return append(kernels, NullExecKernel(1))
}

type ShiftDir int8

const (
	ShiftLeft ShiftDir = iota
	ShiftRight
)

func shiftKernelSignedImpl[T arrow.IntType, Unsigned arrow.UintType](dir ShiftDir, checked bool) exec.ArrayKernelExec {
	errShift := fmt.Errorf("%w: shift amount must be >= 0 and less than precision of type", arrow.ErrInvalid)
	maxShift := T(8*SizeOf[T]() - 1)

	switch dir {
	case ShiftLeft:
		if checked {
			return ScalarBinaryNotNull(func(_ *exec.KernelCtx, lhs, rhs T, e *error) T {
				if rhs < 0 || rhs >= maxShift {
					*e = errShift
					return lhs
				}
				return T(Unsigned(lhs) << Unsigned(rhs))
			})
		}

		return ScalarBinaryNotNull(func(_ *exec.KernelCtx, lhs, rhs T, _ *error) T {
			if rhs < 0 || rhs >= maxShift {
				return lhs
			}

			return T(Unsigned(lhs) << Unsigned(rhs))
		})
	case ShiftRight:
		if checked {
			return ScalarBinaryNotNull(func(_ *exec.KernelCtx, lhs, rhs T, e *error) T {
				if rhs < 0 || rhs >= maxShift {
					*e = errShift
					return lhs
				}
				return lhs >> rhs
			})
		}

		return ScalarBinaryNotNull(func(_ *exec.KernelCtx, lhs, rhs T, e *error) T {
			if rhs < 0 || rhs >= maxShift {
				return lhs
			}
			return lhs >> rhs
		})
	}
	return nil
}

func shiftKernelUnsignedImpl[T arrow.UintType](dir ShiftDir, checked bool) exec.ArrayKernelExec {
	errShift := fmt.Errorf("%w: shift amount must be >= 0 and less than precision of type", arrow.ErrInvalid)
	maxShift := T(8 * SizeOf[T]())

	switch dir {
	case ShiftLeft:
		if checked {
			return ScalarBinaryNotNull(func(_ *exec.KernelCtx, lhs, rhs T, e *error) T {
				if rhs < 0 || rhs >= maxShift {
					*e = errShift
					return lhs
				}
				return lhs << rhs
			})
		}

		return ScalarBinaryNotNull(func(_ *exec.KernelCtx, lhs, rhs T, _ *error) T {
			if rhs < 0 || rhs >= maxShift {
				return lhs
			}
			return lhs << rhs
		})
	case ShiftRight:
		if checked {
			return ScalarBinaryNotNull(func(_ *exec.KernelCtx, lhs, rhs T, e *error) T {
				if rhs < 0 || rhs >= maxShift {
					*e = errShift
					return lhs
				}
				return lhs >> rhs
			})
		}

		return ScalarBinaryNotNull(func(_ *exec.KernelCtx, lhs, rhs T, _ *error) T {
			if rhs < 0 || rhs >= maxShift {
				return lhs
			}
			return lhs >> rhs
		})
	}
	return nil
}

func shiftKernel(dir ShiftDir, checked bool, ty arrow.Type) exec.ArrayKernelExec {
	switch ty {
	case arrow.INT8:
		return shiftKernelSignedImpl[int8, uint8](dir, checked)
	case arrow.UINT8:
		return shiftKernelUnsignedImpl[uint8](dir, checked)
	case arrow.INT16:
		return shiftKernelSignedImpl[int16, uint16](dir, checked)
	case arrow.UINT16:
		return shiftKernelUnsignedImpl[uint16](dir, checked)
	case arrow.INT32:
		return shiftKernelSignedImpl[int32, uint32](dir, checked)
	case arrow.UINT32:
		return shiftKernelUnsignedImpl[uint32](dir, checked)
	case arrow.INT64:
		return shiftKernelSignedImpl[int64, uint64](dir, checked)
	case arrow.UINT64:
		return shiftKernelUnsignedImpl[uint64](dir, checked)
	}
	panic("invalid type for shift kernels")
}

func GetShiftKernels(dir ShiftDir, checked bool) []exec.ScalarKernel {
	kernels := make([]exec.ScalarKernel, 0)
	for _, ty := range intTypes {
		inType := exec.NewExactInput(ty)
		ex := shiftKernel(dir, checked, ty.ID())
		kernels = append(kernels, exec.NewScalarKernel(
			[]exec.InputType{inType, inType}, exec.NewOutputType(ty),
			ex, nil))
	}
	return append(kernels, NullExecKernel(2))
}
