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
	"math"
	"math/bits"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/compute/exec"
	"github.com/apache/arrow-go/v18/arrow/decimal128"
	"github.com/apache/arrow-go/v18/arrow/decimal256"
	"github.com/apache/arrow-go/v18/arrow/internal/debug"
	"github.com/apache/arrow-go/v18/internal/utils"
	"golang.org/x/exp/constraints"
)

type ArithmeticOp int8

const (
	OpAdd ArithmeticOp = iota
	OpSub
	OpMul
	OpDiv
	OpAbsoluteValue
	OpNegate
	// NO SIMD for the following yet
	OpSqrt
	OpPower
	OpSin
	OpCos
	OpTan
	OpAsin
	OpAcos
	OpAtan
	OpAtan2
	OpLn
	OpLog10
	OpLog2
	OpLog1p
	OpLogb
	// End NO SIMD
	OpSign

	// Checked versions will not use SIMD except for float32/float64 impls
	OpAddChecked
	OpSubChecked
	OpMulChecked
	OpDivChecked
	OpAbsoluteValueChecked
	OpNegateChecked
	// No SIMD impls for the rest of these yet
	OpSqrtChecked
	OpPowerChecked
	OpSinChecked
	OpCosChecked
	OpTanChecked
	OpAsinChecked
	OpAcosChecked
	OpLnChecked
	OpLog10Checked
	OpLog2Checked
	OpLog1pChecked
	OpLogbChecked
)

func mulWithOverflow[T arrow.IntType | arrow.UintType](a, b T) (T, error) {
	min, max := MinOf[T](), MaxOf[T]()
	switch {
	case a > 0:
		if b > 0 {
			if a > (max / b) {
				return 0, errOverflow
			}
		} else {
			if b < (min / a) {
				return 0, errOverflow
			}
		}
	case b > 0:
		if a < (min / b) {
			return 0, errOverflow
		}
	default:
		if (a != 0) && (b < (max / a)) {
			return 0, errOverflow
		}
	}

	return a * b, nil
}

func getGoArithmeticBinary[OutT, Arg0T, Arg1T arrow.NumericType](op func(a Arg0T, b Arg1T, e *error) OutT) binaryOps[OutT, Arg0T, Arg1T] {
	return binaryOps[OutT, Arg0T, Arg1T]{
		arrArr: func(_ *exec.KernelCtx, left []Arg0T, right []Arg1T, out []OutT) error {
			var err error
			for i := range out {
				out[i] = op(left[i], right[i], &err)
			}
			return err
		},
		arrScalar: func(_ *exec.KernelCtx, left []Arg0T, right Arg1T, out []OutT) error {
			var err error
			for i := range out {
				out[i] = op(left[i], right, &err)
			}
			return err
		},
		scalarArr: func(_ *exec.KernelCtx, left Arg0T, right []Arg1T, out []OutT) error {
			var err error
			for i := range out {
				out[i] = op(left, right[i], &err)
			}
			return err
		},
	}
}

var (
	errOverflow      = fmt.Errorf("%w: overflow", arrow.ErrInvalid)
	errDivByZero     = fmt.Errorf("%w: divide by zero", arrow.ErrInvalid)
	errNegativeSqrt  = fmt.Errorf("%w: square root of negative number", arrow.ErrInvalid)
	errNegativePower = fmt.Errorf("%w: integers to negative integer powers are not allowed", arrow.ErrInvalid)
	errDomainErr     = fmt.Errorf("%w: domain error", arrow.ErrInvalid)
	errLogZero       = fmt.Errorf("%w: logarithm of zero", arrow.ErrInvalid)
	errLogNeg        = fmt.Errorf("%w: logarithm of negative number", arrow.ErrInvalid)
)

func getGoArithmeticOpIntegral[InT, OutT arrow.UintType | arrow.IntType](op ArithmeticOp) exec.ArrayKernelExec {
	switch op {
	case OpAdd:
		return ScalarBinary(getGoArithmeticBinary(func(a, b InT, _ *error) OutT { return OutT(a + b) }))
	case OpSub:
		return ScalarBinary(getGoArithmeticBinary(func(a, b InT, _ *error) OutT { return OutT(a - b) }))
	case OpMul:
		return ScalarBinary(getGoArithmeticBinary(func(a, b InT, _ *error) OutT { return OutT(a * b) }))
	case OpDiv:
		return ScalarBinaryNotNull(func(_ *exec.KernelCtx, a, b InT, e *error) OutT {
			if b == 0 {
				*e = errDivByZero
				return 0
			}
			return OutT(a / b)
		})
	case OpAbsoluteValue:
		if ones := ^InT(0); ones < 0 {
			shiftBy := (SizeOf[InT]() * 8) - 1
			return ScalarUnary(func(_ *exec.KernelCtx, arg []InT, out []OutT) error {
				// get abs without branching
				for i, v := range arg {
					// right shift (sign check)
					mask := v >> shiftBy
					// add the mask '+' and '-' balance
					v = v + mask
					// invert and return
					out[i] = OutT(v ^ mask)
				}
				return nil
			})
		}

		if SizeOf[InT]() == SizeOf[OutT]() {
			return ScalarUnary(func(_ *exec.KernelCtx, arg []InT, out []OutT) error {
				in, output := arrow.GetBytes(arg), arrow.GetBytes(out)
				copy(output, in)
				return nil
			})
		} else {
			return ScalarUnary(func(_ *exec.KernelCtx, arg []InT, out []OutT) error {
				DoStaticCast(arg, out)
				return nil
			})
		}
	case OpNegate:
		return ScalarUnary(func(_ *exec.KernelCtx, arg []InT, out []OutT) error {
			for i, v := range arg {
				out[i] = OutT(-v)
			}
			return nil
		})
	case OpSign:
		if ^InT(0) < 0 {
			var neg int8 = -1
			return ScalarUnary(func(_ *exec.KernelCtx, arg []InT, out []OutT) error {
				neg := OutT(neg)
				for i, v := range arg {
					switch {
					case v > 0:
						out[i] = 1
					case v < 0:
						out[i] = neg
					default:
						out[i] = 0
					}
				}
				return nil
			})
		}
		return ScalarUnary(func(_ *exec.KernelCtx, arg []InT, out []OutT) error {
			for i, v := range arg {
				if v > 0 {
					out[i] = 1
				} else {
					out[i] = 0
				}
			}
			return nil
		})
	case OpPower:
		return ScalarBinary(getGoArithmeticBinary(func(a, b InT, err *error) OutT {
			if b < 0 {
				*err = errNegativePower
				return 0
			}
			// integer power
			var (
				base        = uint64(a)
				exp         = uint64(b)
				pow  uint64 = 1
			)

			// right to left 0(logn) power
			for exp != 0 {
				if exp&1 != 0 {
					pow *= base
				}
				base *= base
				exp >>= 1
			}
			return OutT(pow)
		}))
	case OpAddChecked:
		shiftBy := (SizeOf[InT]() * 8) - 1
		// ie: uint32 does a >> 31 at the end, int32 does >> 30
		if ^InT(0) < 0 {
			shiftBy--
		}
		return ScalarBinaryNotNull(func(_ *exec.KernelCtx, a, b InT, e *error) (out OutT) {
			out = OutT(a + b)
			// see math/bits/bits.go Add64 for explanation of logic
			carry := (OutT(a&b) | (OutT(a|b) &^ out)) >> shiftBy
			if carry > 0 {
				*e = errOverflow
			}
			return
		})
	case OpSubChecked:
		shiftBy := (SizeOf[InT]() * 8) - 1
		// ie: uint32 does a >> 31 at the end, int32 does >> 30
		if ^InT(0) < 0 {
			shiftBy--
		}
		return ScalarBinaryNotNull(func(_ *exec.KernelCtx, a, b InT, e *error) (out OutT) {
			out = OutT(a - b)
			// see math/bits/bits.go Sub64 for explanation of bit logic
			carry := (OutT(^a&b) | (^OutT(a^b) & out)) >> shiftBy
			if carry > 0 {
				*e = errOverflow
			}
			return
		})
	case OpMulChecked:
		return ScalarBinary(getGoArithmeticBinary(func(a, b InT, e *error) (out OutT) {
			o, err := mulWithOverflow(a, b)
			if err != nil {
				*e = err
			}
			return OutT(o)
		}))
	case OpDivChecked:
		return ScalarBinaryNotNull(func(_ *exec.KernelCtx, a, b InT, e *error) (out OutT) {
			if b == 0 {
				*e = errDivByZero
				return
			}
			return OutT(a / b)
		})
	case OpAbsoluteValueChecked:
		if ones := ^InT(0); ones < 0 {
			shiftBy := (SizeOf[InT]() * 8) - 1
			min := MinOf[InT]()
			return ScalarUnary(func(_ *exec.KernelCtx, arg []InT, out []OutT) error {
				for i, v := range arg {
					if v == min {
						return errOverflow
					}

					// right shift (sign check)
					mask := v >> shiftBy
					// add the mask '+' and '-' balance
					v = v + mask
					// invert and return
					out[i] = OutT(v ^ mask)
				}
				return nil
			})
		}
		if SizeOf[InT]() == SizeOf[OutT]() {
			return ScalarUnary(func(_ *exec.KernelCtx, arg []InT, out []OutT) error {
				in, output := arrow.GetBytes(arg), arrow.GetBytes(out)
				copy(output, in)
				return nil
			})
		} else {
			return ScalarUnary(func(_ *exec.KernelCtx, arg []InT, out []OutT) error {
				DoStaticCast(arg, out)
				return nil
			})
		}
	case OpNegateChecked:
		if ones := ^InT(0); ones < 0 {
			min := MinOf[InT]()
			// signed
			return ScalarUnary(func(_ *exec.KernelCtx, arg []InT, out []OutT) error {
				for i, v := range arg {
					if v != min {
						out[i] = OutT(-v)
					} else {
						return errOverflow
					}
				}
				return nil
			})
		}
	case OpPowerChecked:
		return ScalarBinaryNotNull(func(_ *exec.KernelCtx, base, exp InT, e *error) OutT {
			if exp < 0 {
				*e = errNegativePower
				return 0
			} else if exp == 0 {
				return 1
			}

			// left to right 0(logn) power with overflow checks
			var (
				overflow bool
				bitmask      = uint64(1) << (63 - bits.LeadingZeros64(uint64(exp)))
				pow      InT = 1
				err      error
			)

			for bitmask != 0 {
				pow, err = mulWithOverflow(pow, pow)
				overflow = overflow || (err != nil)
				if uint64(exp)&bitmask != 0 {
					pow, err = mulWithOverflow(pow, base)
					overflow = overflow || (err != nil)
				}
				bitmask >>= 1
			}
			if overflow {
				*e = errOverflow
			}
			return OutT(pow)
		})
	}
	debug.Assert(false, "invalid arithmetic op")
	return nil
}

func getGoArithmeticOpFloating[InT, OutT constraints.Float](op ArithmeticOp) exec.ArrayKernelExec {
	switch op {
	case OpAdd, OpAddChecked:
		return ScalarBinary(getGoArithmeticBinary(func(a, b InT, _ *error) OutT { return OutT(a + b) }))
	case OpSub, OpSubChecked:
		return ScalarBinary(getGoArithmeticBinary(func(a, b InT, _ *error) OutT { return OutT(a - b) }))
	case OpMul, OpMulChecked:
		return ScalarBinary(getGoArithmeticBinary(func(a, b InT, _ *error) OutT { return OutT(a * b) }))
	case OpDiv:
		return ScalarBinaryNotNull(func(_ *exec.KernelCtx, a, b InT, e *error) (out OutT) {
			return OutT(a / b)
		})
	case OpDivChecked:
		return ScalarBinaryNotNull(func(_ *exec.KernelCtx, a, b InT, e *error) (out OutT) {
			if b == 0 {
				*e = errDivByZero
				return
			}
			return OutT(a / b)
		})
	case OpAbsoluteValue, OpAbsoluteValueChecked:
		return ScalarUnary(func(_ *exec.KernelCtx, arg []InT, out []OutT) error {
			for i, v := range arg {
				out[i] = OutT(math.Abs(float64(v)))
			}
			return nil
		})
	case OpNegate, OpNegateChecked:
		return ScalarUnary(func(_ *exec.KernelCtx, arg []InT, out []OutT) error {
			for i, v := range arg {
				out[i] = OutT(-v)
			}
			return nil
		})
	case OpSqrt:
		return ScalarUnary(func(_ *exec.KernelCtx, arg []InT, out []OutT) error {
			for i, v := range arg {
				out[i] = OutT(math.Sqrt(float64(v)))
			}
			return nil
		})
	case OpSqrtChecked:
		return ScalarUnaryNotNull(func(_ *exec.KernelCtx, arg InT, e *error) OutT {
			if arg < 0 {
				*e = errNegativeSqrt
				return OutT(math.NaN())
			}
			return OutT(math.Sqrt(float64(arg)))
		})
	case OpSign:
		return ScalarUnary(func(_ *exec.KernelCtx, arg []InT, out []OutT) error {
			for i, v := range arg {
				switch {
				case math.IsNaN(float64(v)):
					out[i] = OutT(v)
				case v == 0:
					out[i] = 0
				case math.Signbit(float64(v)):
					out[i] = -1
				default:
					out[i] = 1
				}
			}
			return nil
		})
	case OpPower, OpPowerChecked:
		return ScalarBinary(getGoArithmeticBinary(func(a, b InT, _ *error) OutT {
			return OutT(math.Pow(float64(a), float64(b)))
		}))
	case OpSin:
		return ScalarUnary(func(_ *exec.KernelCtx, vals []InT, out []OutT) error {
			for i, v := range vals {
				out[i] = OutT(math.Sin(float64(v)))
			}
			return nil
		})
	case OpSinChecked:
		return ScalarUnaryNotNull(func(_ *exec.KernelCtx, arg InT, e *error) OutT {
			if math.IsInf(float64(arg), 0) {
				*e = errDomainErr
				return OutT(arg)
			}
			return OutT(math.Sin(float64(arg)))
		})
	case OpCos:
		return ScalarUnary(func(_ *exec.KernelCtx, vals []InT, out []OutT) error {
			for i, v := range vals {
				out[i] = OutT(math.Cos(float64(v)))
			}
			return nil
		})
	case OpCosChecked:
		return ScalarUnaryNotNull(func(_ *exec.KernelCtx, arg InT, e *error) OutT {
			if math.IsInf(float64(arg), 0) {
				*e = errDomainErr
				return OutT(arg)
			}
			return OutT(math.Cos(float64(arg)))
		})
	case OpTan:
		return ScalarUnary(func(_ *exec.KernelCtx, vals []InT, out []OutT) error {
			for i, v := range vals {
				out[i] = OutT(math.Tan(float64(v)))
			}
			return nil
		})
	case OpTanChecked:
		return ScalarUnaryNotNull(func(_ *exec.KernelCtx, arg InT, e *error) OutT {
			if math.IsInf(float64(arg), 0) {
				*e = errDomainErr
				return OutT(arg)
			}
			return OutT(math.Tan(float64(arg)))
		})
	case OpAsin:
		return ScalarUnary(func(_ *exec.KernelCtx, vals []InT, out []OutT) error {
			for i, v := range vals {
				out[i] = OutT(math.Asin(float64(v)))
			}
			return nil
		})
	case OpAsinChecked:
		return ScalarUnaryNotNull(func(_ *exec.KernelCtx, arg InT, e *error) OutT {
			if arg < -1 || arg > 1 {
				*e = errDomainErr
				return OutT(arg)
			}
			return OutT(math.Asin(float64(arg)))
		})
	case OpAcos:
		return ScalarUnary(func(_ *exec.KernelCtx, vals []InT, out []OutT) error {
			for i, v := range vals {
				out[i] = OutT(math.Acos(float64(v)))
			}
			return nil
		})
	case OpAcosChecked:
		return ScalarUnaryNotNull(func(_ *exec.KernelCtx, arg InT, e *error) OutT {
			if arg < -1 || arg > 1 {
				*e = errDomainErr
				return OutT(arg)
			}
			return OutT(math.Acos(float64(arg)))
		})
	case OpAtan:
		return ScalarUnary(func(_ *exec.KernelCtx, vals []InT, out []OutT) error {
			for i, v := range vals {
				out[i] = OutT(math.Atan(float64(v)))
			}
			return nil
		})
	case OpAtan2:
		return ScalarBinary(getGoArithmeticBinary(func(a, b InT, _ *error) OutT {
			return OutT(math.Atan2(float64(a), float64(b)))
		}))
	case OpLn:
		return ScalarUnary(func(_ *exec.KernelCtx, vals []InT, out []OutT) error {
			for i, v := range vals {
				out[i] = OutT(math.Log(float64(v)))
			}
			return nil
		})
	case OpLnChecked:
		return ScalarUnaryNotNull(func(_ *exec.KernelCtx, arg InT, e *error) OutT {
			switch {
			case arg == 0:
				*e = errLogZero
				return OutT(arg)
			case arg < 0:
				*e = errLogNeg
				return OutT(arg)
			}

			return OutT(math.Log(float64(arg)))
		})
	case OpLog10:
		return ScalarUnary(func(_ *exec.KernelCtx, vals []InT, out []OutT) error {
			for i, v := range vals {
				out[i] = OutT(math.Log10(float64(v)))
			}
			return nil
		})
	case OpLog10Checked:
		return ScalarUnaryNotNull(func(_ *exec.KernelCtx, arg InT, e *error) OutT {
			switch {
			case arg == 0:
				*e = errLogZero
				return OutT(arg)
			case arg < 0:
				*e = errLogNeg
				return OutT(arg)
			}

			return OutT(math.Log10(float64(arg)))
		})
	case OpLog2:
		return ScalarUnary(func(_ *exec.KernelCtx, vals []InT, out []OutT) error {
			for i, v := range vals {
				out[i] = OutT(math.Log2(float64(v)))
			}
			return nil
		})
	case OpLog2Checked:
		return ScalarUnaryNotNull(func(_ *exec.KernelCtx, arg InT, e *error) OutT {
			switch {
			case arg == 0:
				*e = errLogZero
				return OutT(arg)
			case arg < 0:
				*e = errLogNeg
				return OutT(arg)
			}

			return OutT(math.Log2(float64(arg)))
		})
	case OpLog1p:
		return ScalarUnary(func(_ *exec.KernelCtx, vals []InT, out []OutT) error {
			for i, v := range vals {
				out[i] = OutT(math.Log1p(float64(v)))
			}
			return nil
		})
	case OpLog1pChecked:
		return ScalarUnaryNotNull(func(_ *exec.KernelCtx, arg InT, e *error) OutT {
			switch {
			case arg == -1:
				*e = errLogZero
				return OutT(arg)
			case arg < -1:
				*e = errLogNeg
				return OutT(arg)
			}

			return OutT(math.Log1p(float64(arg)))
		})
	case OpLogb:
		return ScalarBinary(getGoArithmeticBinary(func(x, base InT, _ *error) OutT {
			if x == 0 {
				if base == 0 || base < 0 {
					return OutT(math.NaN())
				} else {
					return OutT(math.Inf(-1))
				}
			} else if x < 0 {
				return OutT(math.NaN())
			}
			return OutT(math.Log(float64(x)) / math.Log(float64(base)))
		}))
	case OpLogbChecked:
		return ScalarBinaryNotNull((func(_ *exec.KernelCtx, x, base InT, e *error) OutT {
			if x == 0 || base == 0 {
				*e = errLogZero
				return OutT(x)
			} else if x < 0 || base < 0 {
				*e = errLogNeg
				return OutT(x)
			}
			return OutT(math.Log(float64(x)) / math.Log(float64(base)))
		}))
	}
	debug.Assert(false, "invalid arithmetic op")
	return nil
}

func timeDurationOp[OutT, Arg0T, Arg1T ~int32 | ~int64](multiple int64, op ArithmeticOp) exec.ArrayKernelExec {
	switch op {
	case OpAdd:
		return ScalarBinary(getGoArithmeticBinary(func(a Arg0T, b Arg1T, e *error) OutT {
			result := OutT(a) + OutT(b)
			if result < 0 || multiple <= int64(result) {
				*e = fmt.Errorf("%w: %d is not within acceptable range of [0, %d) s", arrow.ErrInvalid, result, multiple)
			}
			return result
		}))
	case OpSub:
		return ScalarBinary(getGoArithmeticBinary(func(a Arg0T, b Arg1T, e *error) OutT {
			result := OutT(a) - OutT(b)
			if result < 0 || multiple <= int64(result) {
				*e = fmt.Errorf("%w: %d is not within acceptable range of [0, %d) s", arrow.ErrInvalid, result, multiple)
			}
			return result
		}))
	case OpAddChecked:
		shiftBy := (SizeOf[OutT]() * 8) - 1
		// ie: uint32 does a >> 31 at the end, int32 does >> 30
		if ^OutT(0) < 0 {
			shiftBy--
		}
		return ScalarBinary(getGoArithmeticBinary(func(a Arg0T, b Arg1T, e *error) (result OutT) {
			left, right := OutT(a), OutT(b)
			result = left + right
			carry := ((left & right) | ((left | right) &^ result)) >> shiftBy
			if carry > 0 {
				*e = errOverflow
				return
			}
			if result < 0 || multiple <= int64(result) {
				*e = fmt.Errorf("%w: %d is not within acceptable range of [0, %d) s", arrow.ErrInvalid, result, multiple)
			}
			return
		}))
	case OpSubChecked:
		shiftBy := (SizeOf[OutT]() * 8) - 1
		// ie: uint32 does a >> 31 at the end, int32 does >> 30
		if ^OutT(0) < 0 {
			shiftBy--
		}
		return ScalarBinary(getGoArithmeticBinary(func(a Arg0T, b Arg1T, e *error) (result OutT) {
			left, right := OutT(a), OutT(b)
			result = left - right
			carry := ((^left & right) | (^(left ^ right) & result)) >> shiftBy
			if carry > 0 {
				*e = errOverflow
				return
			}
			if result < 0 || multiple <= int64(result) {
				*e = fmt.Errorf("%w: %d is not within acceptable range of [0, %d) s", arrow.ErrInvalid, result, multiple)
			}
			return
		}))
	}
	return nil
}

func SubtractDate32(op ArithmeticOp) exec.ArrayKernelExec {
	const secondsPerDay = 86400
	switch op {
	case OpSub:
		return ScalarBinary(getGoArithmeticBinary(func(a, b arrow.Time32, e *error) (result arrow.Duration) {
			return arrow.Duration((a - b) * secondsPerDay)
		}))
	case OpSubChecked:
		return ScalarBinary(getGoArithmeticBinary(func(a, b arrow.Time32, e *error) (result arrow.Duration) {
			result = arrow.Duration(a) - arrow.Duration(b)
			val, ok := utils.Mul64(int64(result), secondsPerDay)
			if !ok {
				*e = errOverflow
			}
			return arrow.Duration(val)
		}))
	}
	panic("invalid op for subtractDate32")
}

type decOps[T decimal128.Num | decimal256.Num] struct {
	Add  func(T, T) T
	Sub  func(T, T) T
	Div  func(T, T) T
	Mul  func(T, T) T
	Abs  func(T) T
	Neg  func(T) T
	Sign func(T) int
}

var dec128Ops = decOps[decimal128.Num]{
	Add: func(a, b decimal128.Num) decimal128.Num { return a.Add(b) },
	Sub: func(a, b decimal128.Num) decimal128.Num { return a.Sub(b) },
	Mul: func(a, b decimal128.Num) decimal128.Num { return a.Mul(b) },
	Div: func(a, b decimal128.Num) decimal128.Num {
		a, _ = a.Div(b)
		return a
	},
	Abs:  func(a decimal128.Num) decimal128.Num { return a.Abs() },
	Neg:  func(a decimal128.Num) decimal128.Num { return a.Negate() },
	Sign: func(a decimal128.Num) int { return a.Sign() },
}

var dec256Ops = decOps[decimal256.Num]{
	Add: func(a, b decimal256.Num) decimal256.Num { return a.Add(b) },
	Sub: func(a, b decimal256.Num) decimal256.Num { return a.Sub(b) },
	Mul: func(a, b decimal256.Num) decimal256.Num { return a.Mul(b) },
	Div: func(a, b decimal256.Num) decimal256.Num {
		a, _ = a.Div(b)
		return a
	},
	Abs:  func(a decimal256.Num) decimal256.Num { return a.Abs() },
	Neg:  func(a decimal256.Num) decimal256.Num { return a.Negate() },
	Sign: func(a decimal256.Num) int { return a.Sign() },
}

func getArithmeticOpDecimalImpl[T decimal128.Num | decimal256.Num](op ArithmeticOp, fns decOps[T]) exec.ArrayKernelExec {
	if op >= OpAddChecked {
		op -= OpAddChecked // decimal128/256 checked is the same as unchecked
	}

	switch op {
	case OpAdd:
		return ScalarBinaryNotNull(func(_ *exec.KernelCtx, arg0, arg1 T, _ *error) T {
			return fns.Add(arg0, arg1)
		})
	case OpSub:
		return ScalarBinaryNotNull(func(_ *exec.KernelCtx, arg0, arg1 T, _ *error) T {
			return fns.Sub(arg0, arg1)
		})
	case OpMul:
		return ScalarBinaryNotNull(func(_ *exec.KernelCtx, arg0, arg1 T, _ *error) T {
			return fns.Mul(arg0, arg1)
		})
	case OpDiv:
		var z T
		return ScalarBinaryNotNull(func(_ *exec.KernelCtx, arg0, arg1 T, e *error) (out T) {
			if arg1 == z {
				*e = errDivByZero
				return
			}
			return fns.Div(arg0, arg1)
		})
	case OpAbsoluteValue:
		return ScalarUnaryNotNull(func(_ *exec.KernelCtx, arg T, _ *error) T {
			return fns.Abs(arg)
		})
	case OpNegate:
		return ScalarUnaryNotNull(func(_ *exec.KernelCtx, arg T, _ *error) T {
			return fns.Neg(arg)
		})
	case OpSign:
		return ScalarUnaryNotNull(func(_ *exec.KernelCtx, arg T, _ *error) int64 {
			return int64(fns.Sign(arg))
		})
	}
	debug.Assert(false, "unimplemented arithmetic op")
	return nil
}

func getArithmeticDecimal[T decimal128.Num | decimal256.Num](op ArithmeticOp) exec.ArrayKernelExec {
	var def T
	switch any(def).(type) {
	case decimal128.Num:
		return getArithmeticOpDecimalImpl(op, dec128Ops)
	case decimal256.Num:
		return getArithmeticOpDecimalImpl(op, dec256Ops)
	}
	panic("should never get here")
}

func ArithmeticExecSameType(ty arrow.Type, op ArithmeticOp) exec.ArrayKernelExec {
	switch ty {
	case arrow.INT8:
		return getArithmeticOpIntegral[int8, int8](op)
	case arrow.UINT8:
		return getArithmeticOpIntegral[uint8, uint8](op)
	case arrow.INT16:
		return getArithmeticOpIntegral[int16, int16](op)
	case arrow.UINT16:
		return getArithmeticOpIntegral[uint16, uint16](op)
	case arrow.INT32, arrow.TIME32:
		return getArithmeticOpIntegral[int32, int32](op)
	case arrow.UINT32:
		return getArithmeticOpIntegral[uint32, uint32](op)
	case arrow.INT64, arrow.TIME64, arrow.DATE64, arrow.TIMESTAMP, arrow.DURATION:
		return getArithmeticOpIntegral[int64, int64](op)
	case arrow.UINT64:
		return getArithmeticOpIntegral[uint64, uint64](op)
	case arrow.FLOAT32:
		return getArithmeticOpFloating[float32, float32](op)
	case arrow.FLOAT64:
		return getArithmeticOpFloating[float64, float64](op)
	}
	debug.Assert(false, "invalid arithmetic type")
	return nil
}

func arithmeticExec[InT arrow.IntType | arrow.UintType](oty arrow.Type, op ArithmeticOp) exec.ArrayKernelExec {
	switch oty {
	case arrow.INT8:
		return getArithmeticOpIntegral[InT, int8](op)
	case arrow.UINT8:
		return getArithmeticOpIntegral[InT, uint8](op)
	case arrow.INT16:
		return getArithmeticOpIntegral[InT, int16](op)
	case arrow.UINT16:
		return getArithmeticOpIntegral[InT, uint16](op)
	case arrow.INT32, arrow.TIME32:
		return getArithmeticOpIntegral[InT, int32](op)
	case arrow.UINT32:
		return getArithmeticOpIntegral[InT, uint32](op)
	case arrow.INT64, arrow.TIME64, arrow.DATE64, arrow.TIMESTAMP, arrow.DURATION:
		return getArithmeticOpIntegral[InT, int64](op)
	case arrow.UINT64:
		return getArithmeticOpIntegral[InT, uint64](op)
	}
	debug.Assert(false, "arithmetic integral to floating not implemented")
	return nil
}

func ArithmeticExec(ity, oty arrow.Type, op ArithmeticOp) exec.ArrayKernelExec {
	if ity == oty {
		return ArithmeticExecSameType(ity, op)
	}

	switch ity {
	case arrow.INT8:
		return arithmeticExec[int8](oty, op)
	case arrow.UINT8:
		return arithmeticExec[uint8](oty, op)
	case arrow.INT16:
		return arithmeticExec[int16](oty, op)
	case arrow.UINT16:
		return arithmeticExec[uint16](oty, op)
	case arrow.INT32, arrow.TIME32:
		return arithmeticExec[int32](oty, op)
	case arrow.UINT32:
		return arithmeticExec[uint32](oty, op)
	case arrow.INT64, arrow.TIME64, arrow.DATE64, arrow.TIMESTAMP, arrow.DURATION:
		return arithmeticExec[int64](oty, op)
	case arrow.UINT64:
		return arithmeticExec[uint64](oty, op)
	case arrow.FLOAT32:
		if oty == arrow.FLOAT32 {
			return getArithmeticOpFloating[float32, float32](op)
		}
		return getArithmeticOpFloating[float32, float64](op)
	case arrow.FLOAT64:
		if oty == arrow.FLOAT32 {
			return getArithmeticOpFloating[float64, float32](op)
		}
		return getArithmeticOpFloating[float64, float64](op)
	}
	return nil
}
