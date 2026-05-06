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
	"unsafe"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/bitutil"
	"github.com/apache/arrow-go/v18/arrow/compute/exec"
	"github.com/apache/arrow-go/v18/arrow/decimal128"
	"github.com/apache/arrow-go/v18/arrow/decimal256"
	"github.com/apache/arrow-go/v18/arrow/internal/debug"
	"github.com/apache/arrow-go/v18/internal/bitutils"
	"golang.org/x/exp/constraints"
)

func CastIntToInt(ctx *exec.KernelCtx, batch *exec.ExecSpan, out *exec.ExecResult) error {
	opts := ctx.State.(CastOptions)
	if !opts.AllowIntOverflow {
		if err := intsCanFit(&batch.Values[0].Array, out.Type.ID()); err != nil {
			return err
		}
	}
	castNumberToNumberUnsafe(&batch.Values[0].Array, out)
	return nil
}

func CastFloatingToFloating(_ *exec.KernelCtx, batch *exec.ExecSpan, out *exec.ExecResult) error {
	castNumberToNumberUnsafe(&batch.Values[0].Array, out)
	return nil
}

func CastFloatingToInteger(ctx *exec.KernelCtx, batch *exec.ExecSpan, out *exec.ExecResult) error {
	opts := ctx.State.(CastOptions)
	castNumberToNumberUnsafe(&batch.Values[0].Array, out)
	if !opts.AllowFloatTruncate {
		return checkFloatToIntTrunc(&batch.Values[0].Array, out)
	}
	return nil
}

func CastIntegerToFloating(ctx *exec.KernelCtx, batch *exec.ExecSpan, out *exec.ExecResult) error {
	opts := ctx.State.(CastOptions)
	if !opts.AllowFloatTruncate {
		if err := checkIntToFloatTrunc(&batch.Values[0].Array, out.Type.ID()); err != nil {
			return err
		}
	}
	castNumberToNumberUnsafe(&batch.Values[0].Array, out)
	return nil
}

type decimal[T decimal128.Num | decimal256.Num] interface {
	Less(T) bool
	GreaterEqual(T) bool
	LowBits() uint64
}

func decimalToIntImpl[InT decimal128.Num | decimal256.Num, OutT arrow.IntType | arrow.UintType](allowOverflow bool, min, max InT, v decimal[InT], err *error) OutT {
	if !allowOverflow && (v.Less(min) || v.GreaterEqual(max)) {
		debug.Log("integer value out of bounds from decimal")
		*err = fmt.Errorf("%w: integer value out of bounds", arrow.ErrInvalid)
		return OutT(0)
	}
	return OutT(v.LowBits())
}

func CastDecimal256ToInteger[T arrow.IntType | arrow.UintType](ctx *exec.KernelCtx, batch *exec.ExecSpan, out *exec.ExecResult) error {
	var (
		opts       = ctx.State.(CastState)
		inputType  = batch.Values[0].Type().(*arrow.Decimal256Type)
		inScale    = inputType.Scale
		ex         exec.ArrayKernelExec
		minLowBits = uint64(MinOf[T]())
		minHiBits  int64
		max        = decimal256.FromU64(uint64(MaxOf[T]()))
	)

	if MinOf[T]() < 0 {
		minHiBits = -1
	}
	min := decimal256.New(uint64(minHiBits), uint64(minHiBits), uint64(minHiBits), minLowBits)
	if opts.AllowDecimalTruncate {
		if inScale < 0 {
			ex = ScalarUnaryNotNull(func(_ *exec.KernelCtx, val decimal256.Num, err *error) T {
				v := val.IncreaseScaleBy(-inScale)
				return decimalToIntImpl[decimal256.Num, T](opts.AllowIntOverflow, min, max, v, err)
			})
		} else {
			ex = ScalarUnaryNotNull(func(_ *exec.KernelCtx, val decimal256.Num, err *error) T {
				v := val.ReduceScaleBy(inScale, true)
				return decimalToIntImpl[decimal256.Num, T](opts.AllowIntOverflow, min, max, v, err)
			})
		}
	} else {
		ex = ScalarUnaryNotNull(func(_ *exec.KernelCtx, val decimal256.Num, err *error) T {
			v, e := val.Rescale(inScale, 0)
			if e != nil {
				*err = fmt.Errorf("%w: %s", arrow.ErrInvalid, e)
				return T(0)
			}
			return decimalToIntImpl[decimal256.Num, T](opts.AllowIntOverflow, min, max, v, err)
		})
	}

	return ex(ctx, batch, out)
}

func CastDecimal128ToInteger[T arrow.IntType | arrow.UintType](ctx *exec.KernelCtx, batch *exec.ExecSpan, out *exec.ExecResult) error {
	var (
		opts       = ctx.State.(CastState)
		inputType  = batch.Values[0].Type().(*arrow.Decimal128Type)
		inScale    = inputType.Scale
		ex         exec.ArrayKernelExec
		minLowBits = uint64(MinOf[T]())
		minHiBits  int64
		max        = decimal128.FromU64(uint64(MaxOf[T]()))
	)

	if MinOf[T]() < 0 {
		minHiBits = -1
	}
	min := decimal128.New(minHiBits, minLowBits)
	if opts.AllowDecimalTruncate {
		if inScale < 0 {
			ex = ScalarUnaryNotNull(func(_ *exec.KernelCtx, val decimal128.Num, err *error) T {
				v := val.IncreaseScaleBy(-inScale)
				return decimalToIntImpl[decimal128.Num, T](opts.AllowIntOverflow, min, max, v, err)
			})
		} else {
			ex = ScalarUnaryNotNull(func(_ *exec.KernelCtx, val decimal128.Num, err *error) T {
				v := val.ReduceScaleBy(inScale, true)
				return decimalToIntImpl[decimal128.Num, T](opts.AllowIntOverflow, min, max, v, err)
			})
		}
	} else {
		ex = ScalarUnaryNotNull(func(_ *exec.KernelCtx, val decimal128.Num, err *error) T {
			v, e := val.Rescale(inScale, 0)
			if e != nil {
				*err = fmt.Errorf("%w: %s", arrow.ErrInvalid, e)
				return T(0)
			}
			return decimalToIntImpl[decimal128.Num, T](opts.AllowIntOverflow, min, max, v, err)
		})
	}

	return ex(ctx, batch, out)
}

func integerToDecimal128[T arrow.IntType | arrow.UintType](inType arrow.Type, outScale int32) exec.ArrayKernelExec {
	var getDecimal func(v T) decimal128.Num
	switch inType {
	case arrow.UINT8, arrow.UINT16, arrow.UINT32, arrow.UINT64:
		getDecimal = func(v T) decimal128.Num { return decimal128.FromU64(uint64(v)) }
	default:
		getDecimal = func(v T) decimal128.Num { return decimal128.FromI64(int64(v)) }
	}
	return ScalarUnaryNotNull(func(_ *exec.KernelCtx, val T, err *error) decimal128.Num {
		out, e := getDecimal(val).Rescale(0, outScale)
		if e != nil {
			*err = e
		}
		return out
	})
}

func integerToDecimal256[T arrow.IntType | arrow.UintType](inType arrow.Type, outScale int32) exec.ArrayKernelExec {
	var getDecimal func(v T) decimal256.Num
	switch inType {
	case arrow.UINT8, arrow.UINT16, arrow.UINT32, arrow.UINT64:
		getDecimal = func(v T) decimal256.Num { return decimal256.FromU64(uint64(v)) }
	default:
		getDecimal = func(v T) decimal256.Num { return decimal256.FromI64(int64(v)) }
	}
	return ScalarUnaryNotNull(func(_ *exec.KernelCtx, val T, err *error) decimal256.Num {
		out, e := getDecimal(val).Rescale(0, outScale)
		if e != nil {
			*err = e
		}
		return out
	})
}

func CastIntegerToDecimal[OutT decimal128.Num | decimal256.Num, Arg0 arrow.IntType | arrow.UintType](ctx *exec.KernelCtx, batch *exec.ExecSpan, out *exec.ExecResult) error {
	var (
		precision, scale int32
		executor         exec.ArrayKernelExec
	)
	switch dt := out.Type.(type) {
	case *arrow.Decimal128Type:
		precision = dt.Precision
		scale = dt.Scale
		executor = integerToDecimal128[Arg0](batch.Values[0].Array.Type.ID(), scale)
	case *arrow.Decimal256Type:
		precision = dt.Precision
		scale = dt.Scale
		executor = integerToDecimal256[Arg0](batch.Values[0].Array.Type.ID(), scale)
	}

	if scale < 0 {
		return fmt.Errorf("%w: scale must be non-negative", arrow.ErrInvalid)
	}

	minPrecision, err := MaxDecimalDigitsForInt(batch.Values[0].Type().ID())
	if err != nil {
		return err
	}

	minPrecision += scale
	if precision < minPrecision {
		return fmt.Errorf("%w: precision is not great enough for result. It should be at least %d",
			arrow.ErrInvalid, minPrecision)
	}

	return executor(ctx, batch, out)
}

func getCastIntToDecimal[T decimal128.Num | decimal256.Num](inType arrow.Type) exec.ArrayKernelExec {
	switch inType {
	case arrow.UINT8:
		return CastIntegerToDecimal[T, uint8]
	case arrow.INT8:
		return CastIntegerToDecimal[T, int8]
	case arrow.UINT16:
		return CastIntegerToDecimal[T, uint16]
	case arrow.INT16:
		return CastIntegerToDecimal[T, int16]
	case arrow.UINT32:
		return CastIntegerToDecimal[T, uint32]
	case arrow.INT32:
		return CastIntegerToDecimal[T, int32]
	case arrow.UINT64:
		return CastIntegerToDecimal[T, uint64]
	case arrow.INT64:
		return CastIntegerToDecimal[T, int64]
	}
	debug.Assert(false, "invalid integer type")
	return nil
}

func unsafeUpscaleDecimal256Out(inputType arrow.Type, by int32) exec.ArrayKernelExec {
	if inputType == arrow.DECIMAL128 {
		return ScalarUnaryNotNull(func(_ *exec.KernelCtx, val decimal128.Num, err *error) decimal256.Num {
			return decimal256.FromDecimal128(val).IncreaseScaleBy(by)
		})
	}
	return ScalarUnaryNotNull(func(_ *exec.KernelCtx, val decimal256.Num, err *error) decimal256.Num {
		return val.IncreaseScaleBy(by)
	})
}

func unsafeUpscaleDecimal128Out(inputType arrow.Type, by int32) exec.ArrayKernelExec {
	if inputType == arrow.DECIMAL128 {
		return ScalarUnaryNotNull(func(_ *exec.KernelCtx, val decimal128.Num, err *error) decimal128.Num {
			return val.IncreaseScaleBy(by)
		})
	}
	return ScalarUnaryNotNull(func(_ *exec.KernelCtx, val decimal256.Num, err *error) decimal128.Num {
		vals := val.IncreaseScaleBy(by).Array()
		return decimal128.New(int64(vals[1]), vals[0])
	})
}

func unsafeDownscaleDecimal256Out(inputType arrow.Type, by int32) exec.ArrayKernelExec {
	if inputType == arrow.DECIMAL128 {
		return ScalarUnaryNotNull(func(_ *exec.KernelCtx, val decimal128.Num, err *error) decimal256.Num {
			return decimal256.FromDecimal128(val).ReduceScaleBy(by, false)
		})
	}
	return ScalarUnaryNotNull(func(_ *exec.KernelCtx, val decimal256.Num, err *error) decimal256.Num {
		return val.ReduceScaleBy(by, false)
	})
}

func unsafeDownscaleDecimal128Out(inputType arrow.Type, by int32) exec.ArrayKernelExec {
	if inputType == arrow.DECIMAL128 {
		return ScalarUnaryNotNull(func(_ *exec.KernelCtx, val decimal128.Num, err *error) decimal128.Num {
			return val.ReduceScaleBy(by, false)
		})
	}
	return ScalarUnaryNotNull(func(_ *exec.KernelCtx, val decimal256.Num, err *error) decimal128.Num {
		vals := val.ReduceScaleBy(by, false).Array()
		return decimal128.New(int64(vals[1]), vals[0])
	})
}

func safeRescaleDecimal256Out(inputType arrow.Type, outScale, outPrecision, inScale int32) exec.ArrayKernelExec {
	if inputType == arrow.DECIMAL128 {
		return ScalarUnaryNotNull(func(_ *exec.KernelCtx, val decimal128.Num, err *error) decimal256.Num {
			out, e := decimal256.FromDecimal128(val).Rescale(inScale, outScale)
			if e != nil {
				*err = fmt.Errorf("%w: %s", arrow.ErrInvalid, *err)
				return decimal256.Num{}
			}

			if out.FitsInPrecision(outPrecision) {
				return out
			}

			*err = fmt.Errorf("%w: decimal value does not fit in precision", arrow.ErrInvalid)
			return decimal256.Num{}
		})
	}
	return ScalarUnaryNotNull(func(_ *exec.KernelCtx, val decimal256.Num, err *error) decimal256.Num {
		out, e := val.Rescale(inScale, outScale)
		if e != nil {
			*err = fmt.Errorf("%w: %s", arrow.ErrInvalid, *err)
			return decimal256.Num{}
		}

		if out.FitsInPrecision(outPrecision) {
			return out
		}

		*err = fmt.Errorf("%w: decimal value does not fit in precision", arrow.ErrInvalid)
		return decimal256.Num{}
	})
}

func safeRescaleDecimal128Out(inputType arrow.Type, outScale, outPrecision, inScale int32) exec.ArrayKernelExec {
	if inputType == arrow.DECIMAL128 {
		return ScalarUnaryNotNull(func(_ *exec.KernelCtx, val decimal128.Num, err *error) decimal128.Num {
			out, e := val.Rescale(inScale, outScale)
			if e != nil {
				*err = fmt.Errorf("%w: %s", arrow.ErrInvalid, *err)
				return decimal128.Num{}
			}

			if out.FitsInPrecision(outPrecision) {
				return out
			}

			*err = fmt.Errorf("%w: decimal value does not fit in precision", arrow.ErrInvalid)
			return decimal128.Num{}
		})
	}
	return ScalarUnaryNotNull(func(_ *exec.KernelCtx, val decimal256.Num, err *error) decimal128.Num {
		out, e := val.Rescale(inScale, outScale)
		if e != nil {
			*err = fmt.Errorf("%w: %s", arrow.ErrInvalid, *err)
			return decimal128.Num{}
		}

		if out.FitsInPrecision(outPrecision) {
			arr := out.Array()
			return decimal128.New(int64(arr[1]), arr[0])
		}

		*err = fmt.Errorf("%w: decimal value does not fit in precision", arrow.ErrInvalid)
		return decimal128.Num{}
	})
}

func CastDecimalToDecimal(ctx *exec.KernelCtx, batch *exec.ExecSpan, out *exec.ExecResult) error {
	var (
		opts              = ctx.State.(CastState)
		inType            = batch.Values[0].Type()
		outType           = out.Type
		inScale, outScale int32
		outPrecision      int32
	)

	switch dt := inType.(type) {
	case *arrow.Decimal128Type:
		inScale = dt.Scale
	case *arrow.Decimal256Type:
		inScale = dt.Scale
	}

	switch dt := outType.(type) {
	case *arrow.Decimal128Type:
		outScale = dt.Scale
		outPrecision = dt.Precision
	case *arrow.Decimal256Type:
		outScale = dt.Scale
		outPrecision = dt.Precision
	}

	if opts.AllowDecimalTruncate {
		if inScale < outScale {
			// unsafe upscale
			if outType.ID() == arrow.DECIMAL128 {
				ex := unsafeUpscaleDecimal128Out(inType.ID(), outScale-inScale)
				return ex(ctx, batch, out)
			}
			ex := unsafeUpscaleDecimal256Out(inType.ID(), outScale-inScale)
			return ex(ctx, batch, out)
		} else {
			// unsafe downscale
			if outType.ID() == arrow.DECIMAL128 {
				ex := unsafeDownscaleDecimal128Out(inType.ID(), inScale-outScale)
				return ex(ctx, batch, out)
			}
			ex := unsafeDownscaleDecimal256Out(inType.ID(), inScale-outScale)
			return ex(ctx, batch, out)
		}
	}

	// safe rescale
	if outType.ID() == arrow.DECIMAL128 {
		ex := safeRescaleDecimal128Out(inType.ID(), outScale, outPrecision, inScale)
		return ex(ctx, batch, out)
	}
	ex := safeRescaleDecimal256Out(inType.ID(), outScale, outPrecision, inScale)
	return ex(ctx, batch, out)
}

func CastFloat32ToDecimal(ctx *exec.KernelCtx, batch *exec.ExecSpan, out *exec.ExecResult) error {
	var (
		prec, scale int32
		allowTrunc  bool
		executor    exec.ArrayKernelExec
		opts        = ctx.State.(CastState)
	)

	allowTrunc = opts.AllowDecimalTruncate
	switch dt := out.Type.(type) {
	case *arrow.Decimal128Type:
		prec, scale = dt.Precision, dt.Scale
		executor = ScalarUnaryNotNull(func(_ *exec.KernelCtx, v float32, err *error) decimal128.Num {
			out, e := decimal128.FromFloat32(v, prec, scale)
			if e == nil {
				return out
			}

			if !allowTrunc {
				*err = fmt.Errorf("%w: %s", arrow.ErrInvalid, e)
			}
			return decimal128.Num{}
		})
	case *arrow.Decimal256Type:
		prec, scale = dt.Precision, dt.Scale
		executor = ScalarUnaryNotNull(func(_ *exec.KernelCtx, v float32, err *error) decimal256.Num {
			out, e := decimal256.FromFloat32(v, prec, scale)
			if e == nil {
				return out
			}

			if !allowTrunc {
				*err = fmt.Errorf("%w: %s", arrow.ErrInvalid, e)
			}
			return decimal256.Num{}
		})
	}

	return executor(ctx, batch, out)
}

func CastFloat64ToDecimal(ctx *exec.KernelCtx, batch *exec.ExecSpan, out *exec.ExecResult) error {
	var (
		prec, scale int32
		allowTrunc  bool
		executor    exec.ArrayKernelExec
		opts        = ctx.State.(CastState)
	)

	allowTrunc = opts.AllowDecimalTruncate
	switch dt := out.Type.(type) {
	case *arrow.Decimal128Type:
		prec, scale = dt.Precision, dt.Scale
		executor = ScalarUnaryNotNull(func(_ *exec.KernelCtx, v float64, err *error) decimal128.Num {
			out, e := decimal128.FromFloat64(v, prec, scale)
			if e == nil {
				return out
			}

			if !allowTrunc {
				*err = fmt.Errorf("%w: %s", arrow.ErrInvalid, e)
			}
			return decimal128.Num{}
		})
	case *arrow.Decimal256Type:
		prec, scale = dt.Precision, dt.Scale
		executor = ScalarUnaryNotNull(func(_ *exec.KernelCtx, v float64, err *error) decimal256.Num {
			out, e := decimal256.FromFloat64(v, prec, scale)
			if e == nil {
				return out
			}

			if !allowTrunc {
				*err = fmt.Errorf("%w: %s", arrow.ErrInvalid, e)
			}
			return decimal256.Num{}
		})
	}

	return executor(ctx, batch, out)
}

func CastDecimalToFloating[OutT constraints.Float](ctx *exec.KernelCtx, batch *exec.ExecSpan, out *exec.ExecResult) error {
	var (
		executor exec.ArrayKernelExec
	)

	switch dt := batch.Values[0].Array.Type.(type) {
	case *arrow.Decimal128Type:
		scale := dt.Scale
		executor = ScalarUnaryNotNull(func(_ *exec.KernelCtx, v decimal128.Num, err *error) OutT {
			return OutT(v.ToFloat64(scale))
		})
	case *arrow.Decimal256Type:
		scale := dt.Scale
		executor = ScalarUnaryNotNull(func(_ *exec.KernelCtx, v decimal256.Num, err *error) OutT {
			return OutT(v.ToFloat64(scale))
		})
	}

	return executor(ctx, batch, out)
}

func boolToNum[T numeric](_ *exec.KernelCtx, in []byte, out []T) error {
	var (
		zero T
		one  = T(1)
	)

	for i := range out {
		if bitutil.BitIsSet(in, i) {
			out[i] = one
		} else {
			out[i] = zero
		}
	}
	return nil
}

func checkFloatTrunc[InT constraints.Float, OutT arrow.IntType | arrow.UintType](in, out *exec.ArraySpan) error {
	wasTrunc := func(out OutT, in InT) bool {
		return InT(out) != in
	}
	wasTruncMaybeNull := func(out OutT, in InT, isValid bool) bool {
		return isValid && (InT(out) != in)
	}
	getError := func(val InT) error {
		return fmt.Errorf("%w: float value %f was truncated converting to %s",
			arrow.ErrInvalid, val, out.Type)
	}

	inData := exec.GetSpanValues[InT](in, 1)
	outData := exec.GetSpanValues[OutT](out, 1)

	bitmap := in.Buffers[0].Buf
	bitCounter := bitutils.NewOptionalBitBlockCounter(bitmap, in.Offset, in.Len)
	pos, offsetPos := int64(0), int64(0)
	for pos < in.Len {
		block := bitCounter.NextBlock()
		outOfBounds := false
		if block.Popcnt == block.Len {
			// fast path: branchless
			for i := 0; i < int(block.Len); i++ {
				outOfBounds = outOfBounds || wasTrunc(outData[i], inData[i])
			}
		} else if block.Popcnt > 0 {
			// must only bounds check non-null
			for i := 0; i < int(block.Len); i++ {
				outOfBounds = outOfBounds || wasTruncMaybeNull(outData[i], inData[i], bitutil.BitIsSet(bitmap, int(offsetPos)+i))
			}
		}
		if outOfBounds {
			if in.Nulls > 0 {
				for i := 0; i < int(block.Len); i++ {
					if wasTruncMaybeNull(outData[i], inData[i], bitutil.BitIsSet(bitmap, int(offsetPos)+i)) {
						return getError(inData[i])
					}
				}
			} else {
				for i := 0; i < int(block.Len); i++ {
					if wasTrunc(outData[i], inData[i]) {
						return getError(inData[i])
					}
				}
			}
		}
		inData = inData[block.Len:]
		outData = outData[block.Len:]
		pos += int64(block.Len)
		offsetPos += int64(block.Len)
	}
	return nil
}

func checkFloatToIntTruncImpl[T constraints.Float](in, out *exec.ArraySpan) error {
	switch out.Type.ID() {
	case arrow.INT8:
		return checkFloatTrunc[T, int8](in, out)
	case arrow.UINT8:
		return checkFloatTrunc[T, uint8](in, out)
	case arrow.INT16:
		return checkFloatTrunc[T, int16](in, out)
	case arrow.UINT16:
		return checkFloatTrunc[T, uint16](in, out)
	case arrow.INT32:
		return checkFloatTrunc[T, int32](in, out)
	case arrow.UINT32:
		return checkFloatTrunc[T, uint32](in, out)
	case arrow.INT64:
		return checkFloatTrunc[T, int64](in, out)
	case arrow.UINT64:
		return checkFloatTrunc[T, uint64](in, out)
	}
	debug.Assert(false, "float to int truncation only for integer output")
	return nil
}

func checkFloatToIntTrunc(in, out *exec.ArraySpan) error {
	switch in.Type.ID() {
	case arrow.FLOAT32:
		return checkFloatToIntTruncImpl[float32](in, out)
	case arrow.FLOAT64:
		return checkFloatToIntTruncImpl[float64](in, out)
	}
	debug.Assert(false, "float to int truncation only for float32 and float64")
	return nil
}

func checkIntToFloatTrunc(in *exec.ArraySpan, outType arrow.Type) error {
	switch in.Type.ID() {
	case arrow.INT8, arrow.INT16, arrow.UINT8, arrow.UINT16:
		// small integers are all exactly representable as whole numbers
		return nil
	case arrow.INT32:
		if outType == arrow.FLOAT64 {
			return nil
		}
		const limit = int32(1 << 24)
		return intsInRange(in, -limit, limit)
	case arrow.UINT32:
		if outType == arrow.FLOAT64 {
			return nil
		}
		return intsInRange(in, 0, uint32(1<<24))
	case arrow.INT64:
		if outType == arrow.FLOAT32 {
			const limit = int64(1 << 24)
			return intsInRange(in, -limit, limit)
		}
		const limit = int64(1 << 53)
		return intsInRange(in, -limit, limit)
	case arrow.UINT64:
		if outType == arrow.FLOAT32 {
			return intsInRange(in, 0, uint64(1<<24))
		}
		return intsInRange(in, 0, uint64(1<<53))
	}
	debug.Assert(false, "intToFloatTrunc should only be called with int input")
	return nil
}

func parseStringToNumberImpl[T arrow.IntType | arrow.UintType | arrow.FloatType, OffsetT int32 | int64](parseFn func(string) (T, error)) exec.ArrayKernelExec {
	return ScalarUnaryNotNullBinaryArg[T, OffsetT](func(_ *exec.KernelCtx, in []byte, err *error) T {
		st := *(*string)(unsafe.Pointer(&in))
		v, e := parseFn(st)
		if e != nil {
			*err = fmt.Errorf("%w: %s", arrow.ErrInvalid, e)
		}
		return v
	})
}

func getParseStringExec[OffsetT int32 | int64](out arrow.Type) exec.ArrayKernelExec {
	switch out {
	case arrow.INT8:
		return parseStringToNumberImpl[int8, OffsetT](func(s string) (int8, error) {
			v, err := strconv.ParseInt(s, 0, 8)
			return int8(v), err
		})
	case arrow.UINT8:
		return parseStringToNumberImpl[uint8, OffsetT](func(s string) (uint8, error) {
			v, err := strconv.ParseUint(s, 0, 8)
			return uint8(v), err
		})
	case arrow.INT16:
		return parseStringToNumberImpl[int16, OffsetT](func(s string) (int16, error) {
			v, err := strconv.ParseInt(s, 0, 16)
			return int16(v), err
		})
	case arrow.UINT16:
		return parseStringToNumberImpl[uint16, OffsetT](func(s string) (uint16, error) {
			v, err := strconv.ParseUint(s, 0, 16)
			return uint16(v), err
		})
	case arrow.INT32:
		return parseStringToNumberImpl[int32, OffsetT](func(s string) (int32, error) {
			v, err := strconv.ParseInt(s, 0, 32)
			return int32(v), err
		})
	case arrow.UINT32:
		return parseStringToNumberImpl[uint32, OffsetT](func(s string) (uint32, error) {
			v, err := strconv.ParseUint(s, 0, 32)
			return uint32(v), err
		})
	case arrow.INT64:
		return parseStringToNumberImpl[int64, OffsetT](func(s string) (int64, error) {
			return strconv.ParseInt(s, 0, 64)
		})
	case arrow.UINT64:
		return parseStringToNumberImpl[uint64, OffsetT](func(s string) (uint64, error) {
			return strconv.ParseUint(s, 0, 64)
		})
	case arrow.FLOAT32:
		return parseStringToNumberImpl[float32, OffsetT](func(s string) (float32, error) {
			v, err := strconv.ParseFloat(s, 32)
			return float32(v), err
		})
	case arrow.FLOAT64:
		return parseStringToNumberImpl[float64, OffsetT](func(s string) (float64, error) {
			return strconv.ParseFloat(s, 64)
		})
	}
	panic("invalid type for getParseStringExec")
}

func addCommonNumberCasts[T numeric](outTy arrow.DataType, kernels []exec.ScalarKernel) []exec.ScalarKernel {
	kernels = append(kernels, GetCommonCastKernels(outTy.ID(), exec.NewOutputType(outTy))...)

	kernels = append(kernels, exec.NewScalarKernel(
		[]exec.InputType{exec.NewExactInput(arrow.FixedWidthTypes.Boolean)},
		exec.NewOutputType(outTy), ScalarUnaryBoolArg(boolToNum[T]), nil))

	for _, inTy := range []arrow.DataType{arrow.BinaryTypes.Binary, arrow.BinaryTypes.String} {
		kernels = append(kernels, exec.NewScalarKernel(
			[]exec.InputType{exec.NewExactInput(inTy)}, exec.NewOutputType(outTy),
			getParseStringExec[int32](outTy.ID()), nil))
	}
	for _, inTy := range []arrow.DataType{arrow.BinaryTypes.LargeBinary, arrow.BinaryTypes.LargeString} {
		kernels = append(kernels, exec.NewScalarKernel(
			[]exec.InputType{exec.NewExactInput(inTy)}, exec.NewOutputType(outTy),
			getParseStringExec[int64](outTy.ID()), nil))
	}
	return kernels
}

func GetCastToInteger[T arrow.IntType | arrow.UintType](outType arrow.DataType) []exec.ScalarKernel {
	kernels := make([]exec.ScalarKernel, 0)

	output := exec.NewOutputType(outType)
	for _, inTy := range intTypes {
		kernels = append(kernels, exec.NewScalarKernel(
			[]exec.InputType{exec.NewExactInput(inTy)}, output,
			CastIntToInt, nil))
	}

	for _, inTy := range floatingTypes {
		kernels = append(kernels, exec.NewScalarKernel(
			[]exec.InputType{exec.NewExactInput(inTy)}, output,
			CastFloatingToInteger, nil))
	}

	kernels = addCommonNumberCasts[T](outType, kernels)
	kernels = append(kernels, exec.NewScalarKernel(
		[]exec.InputType{exec.NewIDInput(arrow.DECIMAL128)}, output,
		CastDecimal128ToInteger[T], nil))
	kernels = append(kernels, exec.NewScalarKernel(
		[]exec.InputType{exec.NewIDInput(arrow.DECIMAL256)}, output,
		CastDecimal256ToInteger[T], nil))
	return kernels
}

func GetCastToFloating[T constraints.Float](outType arrow.DataType) []exec.ScalarKernel {
	kernels := make([]exec.ScalarKernel, 0)

	output := exec.NewOutputType(outType)
	for _, inTy := range intTypes {
		kernels = append(kernels, exec.NewScalarKernel(
			[]exec.InputType{exec.NewExactInput(inTy)}, output,
			CastIntegerToFloating, nil))
	}

	for _, inTy := range floatingTypes {
		kernels = append(kernels, exec.NewScalarKernel(
			[]exec.InputType{exec.NewExactInput(inTy)}, output,
			CastFloatingToFloating, nil))
	}

	kernels = addCommonNumberCasts[T](outType, kernels)
	kernels = append(kernels, exec.NewScalarKernel(
		[]exec.InputType{exec.NewIDInput(arrow.DECIMAL128)}, output,
		CastDecimalToFloating[T], nil))
	kernels = append(kernels, exec.NewScalarKernel(
		[]exec.InputType{exec.NewIDInput(arrow.DECIMAL256)}, output,
		CastDecimalToFloating[T], nil))
	return kernels
}

func resolveOutputFromOptions(ctx *exec.KernelCtx, _ []arrow.DataType) (arrow.DataType, error) {
	return ctx.State.(CastState).ToType, nil
}

func GetCastToDecimal128() []exec.ScalarKernel {
	outputType := exec.NewComputedOutputType(resolveOutputFromOptions)

	kernels := make([]exec.ScalarKernel, 0)
	kernels = append(kernels, GetCommonCastKernels(arrow.DECIMAL128, outputType)...)

	// cast from floating point
	kernels = append(kernels, exec.NewScalarKernel(
		[]exec.InputType{exec.NewExactInput(arrow.PrimitiveTypes.Float32)},
		outputType, CastFloat32ToDecimal, nil))
	kernels = append(kernels, exec.NewScalarKernel(
		[]exec.InputType{exec.NewExactInput(arrow.PrimitiveTypes.Float64)},
		outputType, CastFloat64ToDecimal, nil))

	// cast from integer
	for _, inTy := range intTypes {
		kernels = append(kernels, exec.NewScalarKernel(
			[]exec.InputType{exec.NewExactInput(inTy)}, outputType,
			getCastIntToDecimal[decimal128.Num](inTy.ID()), nil))
	}

	kernels = append(kernels, exec.NewScalarKernel(
		[]exec.InputType{exec.NewIDInput(arrow.DECIMAL128)}, outputType,
		CastDecimalToDecimal, nil))
	kernels = append(kernels, exec.NewScalarKernel(
		[]exec.InputType{exec.NewIDInput(arrow.DECIMAL256)}, outputType,
		CastDecimalToDecimal, nil))
	return kernels
}

func GetCastToDecimal256() []exec.ScalarKernel {
	outputType := exec.NewComputedOutputType(resolveOutputFromOptions)

	kernels := make([]exec.ScalarKernel, 0)
	kernels = append(kernels, GetCommonCastKernels(arrow.DECIMAL256, outputType)...)

	// cast from floating point
	kernels = append(kernels, exec.NewScalarKernel(
		[]exec.InputType{exec.NewExactInput(arrow.PrimitiveTypes.Float32)},
		outputType, CastFloat32ToDecimal, nil))
	kernels = append(kernels, exec.NewScalarKernel(
		[]exec.InputType{exec.NewExactInput(arrow.PrimitiveTypes.Float64)},
		outputType, CastFloat64ToDecimal, nil))

	// cast from integer
	for _, inTy := range intTypes {
		kernels = append(kernels, exec.NewScalarKernel(
			[]exec.InputType{exec.NewExactInput(inTy)}, outputType,
			getCastIntToDecimal[decimal256.Num](inTy.ID()), nil))
	}

	kernels = append(kernels, exec.NewScalarKernel(
		[]exec.InputType{exec.NewIDInput(arrow.DECIMAL128)}, outputType,
		CastDecimalToDecimal, nil))
	kernels = append(kernels, exec.NewScalarKernel(
		[]exec.InputType{exec.NewIDInput(arrow.DECIMAL256)}, outputType,
		CastDecimalToDecimal, nil))
	return kernels
}
