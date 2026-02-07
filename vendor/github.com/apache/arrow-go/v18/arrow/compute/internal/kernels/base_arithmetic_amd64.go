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

//go:build go1.18 && !noasm

package kernels

import (
	"unsafe"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/compute/exec"
	"github.com/apache/arrow-go/v18/arrow/internal/debug"
	"golang.org/x/exp/constraints"
	"golang.org/x/sys/cpu"
)

func getAvx2ArithmeticBinaryNumeric[T arrow.NumericType](op ArithmeticOp) binaryOps[T, T, T] {
	typ := arrow.GetType[T]()
	return binaryOps[T, T, T]{
		arrArr: func(_ *exec.KernelCtx, Arg0, Arg1, Out []T) error {
			arithmeticAvx2(typ, op, arrow.GetBytes(Arg0), arrow.GetBytes(Arg1), arrow.GetBytes(Out), len(Arg0))
			return nil
		},
		arrScalar: func(_ *exec.KernelCtx, Arg0 []T, Arg1 T, Out []T) error {
			arithmeticArrScalarAvx2(typ, op, arrow.GetBytes(Arg0), unsafe.Pointer(&Arg1), arrow.GetBytes(Out), len(Arg0))
			return nil
		},
		scalarArr: func(_ *exec.KernelCtx, Arg0 T, Arg1, Out []T) error {
			arithmeticScalarArrAvx2(typ, op, unsafe.Pointer(&Arg0), arrow.GetBytes(Arg1), arrow.GetBytes(Out), len(Arg1))
			return nil
		},
	}
}

func getSSE4ArithmeticBinaryNumeric[T arrow.NumericType](op ArithmeticOp) binaryOps[T, T, T] {
	typ := arrow.GetType[T]()
	return binaryOps[T, T, T]{
		arrArr: func(_ *exec.KernelCtx, Arg0, Arg1, Out []T) error {
			arithmeticSSE4(typ, op, arrow.GetBytes(Arg0), arrow.GetBytes(Arg1), arrow.GetBytes(Out), len(Arg0))
			return nil
		},
		arrScalar: func(_ *exec.KernelCtx, Arg0 []T, Arg1 T, Out []T) error {
			arithmeticArrScalarSSE4(typ, op, arrow.GetBytes(Arg0), unsafe.Pointer(&Arg1), arrow.GetBytes(Out), len(Arg0))
			return nil
		},
		scalarArr: func(_ *exec.KernelCtx, Arg0 T, Arg1, Out []T) error {
			arithmeticScalarArrSSE4(typ, op, unsafe.Pointer(&Arg0), arrow.GetBytes(Arg1), arrow.GetBytes(Out), len(Arg1))
			return nil
		},
	}
}

func getArithmeticOpIntegral[InT, OutT arrow.UintType | arrow.IntType](op ArithmeticOp) exec.ArrayKernelExec {
	if cpu.X86.HasAVX2 {
		switch op {
		case OpAdd, OpSub, OpMul:
			return ScalarBinary(getAvx2ArithmeticBinaryNumeric[InT](op))
		case OpAbsoluteValue, OpNegate:
			typ := arrow.GetType[InT]()
			return ScalarUnary(func(_ *exec.KernelCtx, arg, out []InT) error {
				arithmeticUnaryAvx2(typ, op, arrow.GetBytes(arg), arrow.GetBytes(out), len(arg))
				return nil
			})
		case OpSign:
			inType, outType := arrow.GetType[InT](), arrow.GetType[OutT]()
			return ScalarUnary(func(_ *exec.KernelCtx, arg []InT, out []OutT) error {
				arithmeticUnaryDiffTypesAvx2(inType, outType, op, arrow.GetBytes(arg), arrow.GetBytes(out), len(arg))
				return nil
			})
		}
	} else if cpu.X86.HasSSE42 {
		switch op {
		case OpAdd, OpSub, OpMul:
			return ScalarBinary(getSSE4ArithmeticBinaryNumeric[InT](op))
		case OpAbsoluteValue, OpNegate:
			typ := arrow.GetType[InT]()
			return ScalarUnary(func(ctx *exec.KernelCtx, arg, out []InT) error {
				arithmeticUnarySSE4(typ, op, arrow.GetBytes(arg), arrow.GetBytes(out), len(arg))
				return nil
			})
		case OpSign:
			inType, outType := arrow.GetType[InT](), arrow.GetType[OutT]()
			return ScalarUnary(func(_ *exec.KernelCtx, arg []InT, out []OutT) error {
				arithmeticUnaryDiffTypesSSE4(inType, outType, op, arrow.GetBytes(arg), arrow.GetBytes(out), len(arg))
				return nil
			})
		}
	}

	// no SIMD for POWER or SQRT functions
	// integral checked funcs need to use NotNull versions
	return getGoArithmeticOpIntegral[InT, OutT](op)
}

func getArithmeticOpFloating[InT, OutT constraints.Float](op ArithmeticOp) exec.ArrayKernelExec {
	if cpu.X86.HasAVX2 {
		switch op {
		case OpAdd, OpSub, OpAddChecked, OpSubChecked, OpMul, OpMulChecked:
			if arrow.GetType[InT]() != arrow.GetType[OutT]() {
				debug.Assert(false, "not implemented")
				return nil
			}
			return ScalarBinary(getAvx2ArithmeticBinaryNumeric[InT](op))
		case OpAbsoluteValue, OpAbsoluteValueChecked, OpNegate, OpNegateChecked, OpSign:
			if arrow.GetType[InT]() != arrow.GetType[OutT]() {
				debug.Assert(false, "not implemented")
				return nil
			}
			typ := arrow.GetType[InT]()
			return ScalarUnary(func(_ *exec.KernelCtx, arg, out []InT) error {
				arithmeticUnaryAvx2(typ, op, arrow.GetBytes(arg), arrow.GetBytes(out), len(arg))
				return nil
			})
		}
	} else if cpu.X86.HasSSE42 {
		switch op {
		case OpAdd, OpSub, OpAddChecked, OpSubChecked, OpMul, OpMulChecked:
			if arrow.GetType[InT]() != arrow.GetType[OutT]() {
				debug.Assert(false, "not implemented")
				return nil
			}
			return ScalarBinary(getSSE4ArithmeticBinaryNumeric[InT](op))
		case OpAbsoluteValue, OpAbsoluteValueChecked, OpNegate, OpNegateChecked, OpSign:
			if arrow.GetType[InT]() != arrow.GetType[OutT]() {
				debug.Assert(false, "not implemented")
				return nil
			}
			typ := arrow.GetType[InT]()
			return ScalarUnary(func(_ *exec.KernelCtx, arg, out []InT) error {
				arithmeticUnarySSE4(typ, op, arrow.GetBytes(arg), arrow.GetBytes(out), len(arg))
				return nil
			})
		}
	}

	// no SIMD for POWER or SQRT functions
	return getGoArithmeticOpFloating[InT, OutT](op)
}
