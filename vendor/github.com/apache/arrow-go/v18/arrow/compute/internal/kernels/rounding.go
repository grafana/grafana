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
	"time"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/compute/exec"
	"github.com/apache/arrow-go/v18/arrow/decimal128"
	"github.com/apache/arrow-go/v18/arrow/decimal256"
	"github.com/apache/arrow-go/v18/arrow/scalar"
	"golang.org/x/exp/constraints"
)

//go:generate stringer -type=RoundMode

type RoundMode int8

const (
	// Round to nearest integer less than or equal in magnitude (aka "floor")
	RoundDown RoundMode = iota
	// Round to nearest integer greater than or equal in magnitude (aka "ceil")
	RoundUp
	// Get integral part without fractional digits (aka "trunc")
	TowardsZero
	// Round negative values with DOWN and positive values with UP
	AwayFromZero
	// Round ties with DOWN (aka "round half towards negative infinity")
	HalfDown
	// Round ties with UP (aka "round half towards positive infinity")
	HalfUp
	// Round ties with TowardsZero (aka "round half away from infinity")
	HalfTowardsZero
	// Round ties with AwayFromZero (aka "round half towards infinity")
	HalfAwayFromZero
	// Round ties to nearest even integer
	HalfToEven
	// Round ties to nearest odd integer
	HalfToOdd
)

type RoundOptions struct {
	NDigits int64
	Mode    RoundMode
}

func (RoundOptions) TypeName() string { return "RoundOptions" }

type RoundState struct {
	RoundOptions
	Pow10 float64
}

func InitRoundState(_ *exec.KernelCtx, args exec.KernelInitArgs) (exec.KernelState, error) {
	var rs RoundState

	opts, ok := args.Options.(*RoundOptions)
	if ok {
		rs.RoundOptions = *opts
	} else {
		if rs.RoundOptions, ok = args.Options.(RoundOptions); !ok {
			return nil, fmt.Errorf("%w: attempted to initialize kernel state from invalid function options",
				arrow.ErrInvalid)
		}
	}

	// Only positive exponents for powers of 10 are used because combining
	// multiply and division operations produced more stable rounding than
	// using multiply-only.  Refer to NumPy's round implementation:
	// https://github.com/numpy/numpy/blob/7b2f20b406d27364c812f7a81a9c901afbd3600c/numpy/core/src/multiarray/calculation.c#L589
	rs.Pow10 = math.Pow10(int(math.Abs(float64(rs.NDigits))))
	return rs, nil
}

type RoundToMultipleOptions struct {
	// Multiple is the multiple to round to.
	//
	// Should be a positive numeric scalar of a type compatible
	// with the argument to be rounded. The cast kernel is used
	// to convert the rounding multiple to match the result type.
	Multiple scalar.Scalar
	// Mode is the rounding and tie-breaking mode
	Mode RoundMode
}

func (RoundToMultipleOptions) TypeName() string { return "RoundToMultipleOptions" }

type RoundToMultipleState = RoundToMultipleOptions

func isPositive(s scalar.Scalar) bool {
	switch s := s.(type) {
	case *scalar.Decimal128:
		return s.Value.Greater(decimal128.Num{})
	case *scalar.Decimal256:
		return s.Value.Greater(decimal256.Num{})
	case *scalar.Int8:
		return s.Value > 0
	case *scalar.Uint8, *scalar.Uint16, *scalar.Uint32, *scalar.Uint64:
		return true
	case *scalar.Int16:
		return s.Value > 0
	case *scalar.Int32:
		return s.Value > 0
	case *scalar.Int64:
		return s.Value > 0
	case *scalar.Float32:
		return s.Value > 0
	case *scalar.Float64:
		return s.Value > 0
	default:
		return false
	}
}

func InitRoundToMultipleState(_ *exec.KernelCtx, args exec.KernelInitArgs) (exec.KernelState, error) {
	var rs RoundToMultipleState

	opts, ok := args.Options.(*RoundToMultipleOptions)
	if ok {
		rs = *opts
	} else {
		if rs, ok = args.Options.(RoundToMultipleOptions); !ok {
			return nil, fmt.Errorf("%w: attempted to initialize kernel state from invalid function options",
				arrow.ErrInvalid)
		}
	}

	mult := rs.Multiple
	if mult == nil || !mult.IsValid() {
		return nil, fmt.Errorf("%w: rounding multiple must be non-null and valid",
			arrow.ErrInvalid)
	}

	if !isPositive(mult) {
		return nil, fmt.Errorf("%w: rounding multiple must be positive", arrow.ErrInvalid)
	}

	// ensure the rounding multiple option matches the kernel's output type.
	// the output type is not available here, so we use the following rule:
	// if "multiple" is neither a floating-point nor decimal type,
	// then cast to float64, else cast to the kernel's input type.
	var toType arrow.DataType
	if !arrow.IsFloating(mult.DataType().ID()) && !arrow.IsDecimal(mult.DataType().ID()) {
		toType = arrow.PrimitiveTypes.Float64
	} else {
		toType = args.Inputs[0]
	}

	if !arrow.TypeEqual(mult.DataType(), toType) {
		castedMultiple, err := mult.CastTo(toType)
		if err != nil {
			return nil, err
		}

		rs.Multiple = castedMultiple
	}

	return rs, nil
}

func getFloatRoundImpl[T constraints.Float](mode RoundMode) func(T) T {
	switch mode {
	case RoundDown:
		return func(t T) T { return T(math.Floor(float64(t))) }
	case RoundUp:
		return func(t T) T { return T(math.Ceil(float64(t))) }
	case TowardsZero: // truncate
		return func(t T) T { return T(math.Trunc(float64(t))) }
	case AwayFromZero:
		return func(t T) T {
			v := float64(t)
			if math.Signbit(v) {
				return T(math.Floor(v))
			}
			return T(math.Ceil(v))
		}
	// the Half variants are only called when the fractional portion
	// was 0.5
	case HalfDown:
		return func(t T) T { return T(math.Floor(float64(t))) }
	case HalfUp:
		return func(t T) T { return T(math.Ceil(float64(t))) }
	case HalfTowardsZero:
		return func(t T) T { return T(math.Trunc(float64(t))) }
	case HalfAwayFromZero:
		return func(t T) T {
			v := float64(t)
			if math.Signbit(v) {
				return T(math.Floor(v))
			}
			return T(math.Ceil(v))
		}
	case HalfToEven:
		return func(t T) T { return T(math.RoundToEven(float64(t))) }
	case HalfToOdd:
		return func(t T) T {
			v := float64(t)
			return T(math.Floor(v*0.5) + math.Ceil(v*0.5))
		}
	}
	panic("invalid rounding mode")
}

func getDecRounding[T decimal128.Num | decimal256.Num](mode RoundMode, opsImpl *roundDecImpl[T]) func(val, remainder T, pow10 T, scale int32) T {
	var (
		z   T
		one = opsImpl.fromI64(1)
		neg = opsImpl.fromI64(-1)
	)

	switch mode {
	case RoundDown:
		return func(val, remainder, pow10 T, _ int32) T {
			val = opsImpl.Sub(val, remainder)
			if opsImpl.Sign(val) < 0 {
				val = opsImpl.Sub(val, pow10)
			}
			return val
		}
	case RoundUp:
		return func(val, remainder, pow10 T, _ int32) T {
			val = opsImpl.Sub(val, remainder)
			if opsImpl.Sign(val) > 0 && remainder != z {
				val = opsImpl.Add(val, pow10)
			}
			return val
		}
	case TowardsZero:
		return func(val, remainder, _ T, _ int32) T {
			return opsImpl.Sub(val, remainder)
		}
	case AwayFromZero:
		return func(val, remainder, pow10 T, _ int32) T {
			val = opsImpl.Sub(val, remainder)
			if opsImpl.Sign(remainder) < 0 {
				val = opsImpl.Sub(val, pow10)
			} else if opsImpl.Sign(remainder) > 0 && remainder != z {
				val = opsImpl.Add(val, pow10)
			}
			return val
		}
	// variants for Half_* modes are only invoked when the fractional part
	// is equal to 0.5
	case HalfDown:
		return func(val, remainder, pow10 T, _ int32) T {
			val = opsImpl.Sub(val, remainder)
			if opsImpl.Sign(val) < 0 {
				val = opsImpl.Sub(val, pow10)
			}
			return val
		}
	case HalfUp:
		return func(val, remainder, pow10 T, _ int32) T {
			val = opsImpl.Sub(val, remainder)
			if opsImpl.Sign(val) > 0 && remainder != z {
				val = opsImpl.Add(val, pow10)
			}
			return val
		}
	case HalfTowardsZero:
		return func(val, remainder, _ T, _ int32) T {
			return opsImpl.Sub(val, remainder)
		}
	case HalfAwayFromZero:
		return func(val, remainder, pow10 T, _ int32) T {
			val = opsImpl.Sub(val, remainder)
			if opsImpl.Sign(remainder) < 0 {
				val = opsImpl.Sub(val, pow10)
			} else if opsImpl.Sign(remainder) > 0 && remainder != z {
				val = opsImpl.Add(val, pow10)
			}
			return val
		}
	case HalfToEven:
		return func(val, remainder, _ T, scale int32) T {
			scaled := opsImpl.reduceScale(val, scale, false)
			if opsImpl.lowBits(scaled)%2 != 0 {
				if opsImpl.Sign(remainder) >= 0 {
					scaled = opsImpl.Add(scaled, one)
				} else {
					scaled = opsImpl.Add(scaled, neg)
				}
			}
			return opsImpl.increaseScale(scaled, scale)
		}
	case HalfToOdd:
		return func(val, remainder, _ T, scale int32) T {
			scaled := opsImpl.reduceScale(val, scale, false)
			if opsImpl.lowBits(scaled)%2 == 0 {
				if opsImpl.Sign(remainder) != 0 {
					scaled = opsImpl.Add(scaled, one)
				} else {
					scaled = opsImpl.Add(scaled, neg)
				}
			}
			return opsImpl.increaseScale(scaled, scale)
		}
	}
	panic("invalid rounding mode")
}

type round[T constraints.Float] struct {
	pow10   T
	ndigits int64
	mode    RoundMode

	fn func(T) T
}

func (rnd *round[T]) call(_ *exec.KernelCtx, arg T, e *error) T {
	val := float64(arg)
	// do not process INF or NaN because they will trigger overflow errors
	// at the end of this
	if math.IsInf(val, 0) || math.IsNaN(val) {
		return arg
	}

	var roundVal T
	if rnd.ndigits >= 0 {
		roundVal = arg * rnd.pow10
	} else {
		roundVal = arg / rnd.pow10
	}

	frac := roundVal - T(math.Floor(float64(roundVal)))
	if frac == 0 {
		// scaled value has no fractional component
		// no rounding is needed.
		return arg
	}

	if rnd.mode >= HalfDown && frac != 0.5 {
		roundVal = T(math.Round(float64(roundVal)))
	} else {
		roundVal = rnd.fn(roundVal)
	}

	// equality check is omitted so that the common case of 10^0
	// (integer rounding) uses multiply-only
	if rnd.ndigits > 0 {
		roundVal /= rnd.pow10
	} else {
		roundVal *= rnd.pow10
	}
	if math.IsInf(float64(roundVal), 0) || math.IsNaN(float64(roundVal)) {
		*e = errOverflow
		return arg
	}

	return roundVal
}

func roundKernelFloating[T constraints.Float](ctx *exec.KernelCtx, batch *exec.ExecSpan, out *exec.ExecResult) error {
	opts := ctx.State.(RoundState)
	rnd := round[T]{
		pow10:   T(opts.Pow10),
		ndigits: opts.NDigits,
		mode:    opts.Mode,
		fn:      getFloatRoundImpl[T](opts.Mode),
	}

	return ScalarUnaryNotNull(rnd.call)(ctx, batch, out)
}

func roundToMultipleFloating[T constraints.Float](ctx *exec.KernelCtx, batch *exec.ExecSpan, out *exec.ExecResult) error {
	opts := ctx.State.(RoundToMultipleState)
	rnd := roundToMultiple[T]{
		mode:     opts.Mode,
		multiple: UnboxScalar[T](opts.Multiple.(scalar.PrimitiveScalar)),
		fn:       getFloatRoundImpl[T](opts.Mode),
	}

	return ScalarUnaryNotNull(rnd.call)(ctx, batch, out)
}

type roundDecImpl[T decimal128.Num | decimal256.Num] struct {
	*decOps[T]
	scaleMultiplier     func(int) T
	halfScaleMultiplier func(int) T
	divide              func(a, b T) (res, rem T)
	fitsInPrec          func(T, int32) bool
	less                func(a, b T) bool
	reduceScale         func(T, int32, bool) T
	increaseScale       func(T, int32) T
	lowBits             func(T) uint64
	fromI64             func(int64) T
	str                 func(T, int32) string
}

var (
	roundDec128 = roundDecImpl[decimal128.Num]{
		decOps:              &dec128Ops,
		scaleMultiplier:     decimal128.GetScaleMultiplier,
		halfScaleMultiplier: decimal128.GetHalfScaleMultiplier,
		divide:              func(a, b decimal128.Num) (res, rem decimal128.Num) { return a.Div(b) },
		fitsInPrec:          func(a decimal128.Num, prec int32) bool { return a.FitsInPrecision(prec) },
		less:                func(a, b decimal128.Num) bool { return a.Less(b) },
		reduceScale:         func(a decimal128.Num, scale int32, round bool) decimal128.Num { return a.ReduceScaleBy(scale, round) },
		increaseScale:       func(a decimal128.Num, scale int32) decimal128.Num { return a.IncreaseScaleBy(scale) },
		lowBits:             func(a decimal128.Num) uint64 { return a.LowBits() },
		fromI64:             func(v int64) decimal128.Num { return decimal128.FromI64(v) },
		str:                 func(a decimal128.Num, scale int32) string { return a.ToString(scale) },
	}
	roundDec256 = roundDecImpl[decimal256.Num]{
		decOps:              &dec256Ops,
		scaleMultiplier:     decimal256.GetScaleMultiplier,
		halfScaleMultiplier: decimal256.GetHalfScaleMultiplier,
		divide:              func(a, b decimal256.Num) (res, rem decimal256.Num) { return a.Div(b) },
		fitsInPrec:          func(a decimal256.Num, prec int32) bool { return a.FitsInPrecision(prec) },
		less:                func(a, b decimal256.Num) bool { return a.Less(b) },
		reduceScale:         func(a decimal256.Num, scale int32, round bool) decimal256.Num { return a.ReduceScaleBy(scale, round) },
		increaseScale:       func(a decimal256.Num, scale int32) decimal256.Num { return a.IncreaseScaleBy(scale) },
		lowBits:             func(a decimal256.Num) uint64 { return a.LowBits() },
		fromI64:             func(v int64) decimal256.Num { return decimal256.FromI64(v) },
		str:                 func(a decimal256.Num, scale int32) string { return a.ToString(scale) },
	}
)

type roundDec[T decimal128.Num | decimal256.Num] struct {
	ty      arrow.DecimalType
	mode    RoundMode
	ndigits int64
	pow     int32
	// pow10 is "1" for the given decimal scale. Similarly halfPow10 is "0.5"
	pow10, halfPow10, negHalfPow10 T

	opsImpl *roundDecImpl[T]
	fn      func(T, T, T, int32) T
}

func (rnd *roundDec[T]) call(_ *exec.KernelCtx, arg T, e *error) T {
	var def T
	if rnd.pow >= rnd.ty.GetPrecision() {
		*e = fmt.Errorf("%w: rounding to %d digits will not fit in precision of %s",
			arrow.ErrInvalid, rnd.ndigits, rnd.ty)
		return def
	} else if rnd.pow < 0 {
		// no-op copy output to input
		return arg
	}

	_, remainder := rnd.opsImpl.divide(arg, rnd.pow10)
	// the remainder is effectively the scaled fractional part after division
	if remainder == def {
		return arg
	}

	if rnd.mode >= HalfDown {
		if remainder == rnd.halfPow10 || remainder == rnd.negHalfPow10 {
			// on the halfway point, use tiebreaker
			arg = rnd.fn(arg, remainder, rnd.pow10, rnd.pow)
		} else if rnd.opsImpl.Sign(remainder) >= 0 {
			// positive, round up/down
			arg = rnd.opsImpl.Sub(arg, remainder)
			if rnd.opsImpl.less(rnd.halfPow10, remainder) {
				arg = rnd.opsImpl.Add(arg, rnd.pow10)
			}
		} else {
			// negative, round up/down
			arg = rnd.opsImpl.Sub(arg, remainder)
			if rnd.opsImpl.less(remainder, rnd.negHalfPow10) {
				arg = rnd.opsImpl.Sub(arg, rnd.pow10)
			}
		}
	} else {
		arg = rnd.fn(arg, remainder, rnd.pow10, rnd.pow)
	}

	if !rnd.opsImpl.fitsInPrec(arg, rnd.ty.GetPrecision()) {
		*e = fmt.Errorf("%w: rounded value %s does not fit in precision of %s",
			arrow.ErrInvalid, rnd.opsImpl.str(arg, rnd.ty.GetScale()), rnd.ty)
		return def
	}
	return arg
}

func getRoundKernelDecimal[T decimal128.Num | decimal256.Num]() exec.ArrayKernelExec {
	var def T
	switch any(def).(type) {
	case decimal128.Num:
		return func(ctx *exec.KernelCtx, batch *exec.ExecSpan, out *exec.ExecResult) error {
			return roundKernelDecimal(&roundDec128, ctx, batch, out)
		}
	case decimal256.Num:
		return func(ctx *exec.KernelCtx, batch *exec.ExecSpan, out *exec.ExecResult) error {
			return roundKernelDecimal(&roundDec256, ctx, batch, out)
		}
	}
	panic("should never get here")
}

func roundKernelDecimal[T decimal128.Num | decimal256.Num](opsImpl *roundDecImpl[T], ctx *exec.KernelCtx, batch *exec.ExecSpan, out *exec.ExecResult) error {
	opts := ctx.State.(RoundState)
	rnd := roundDec[T]{
		ty:      out.Type.(arrow.DecimalType),
		ndigits: opts.NDigits,
		mode:    opts.Mode,
		opsImpl: opsImpl,
		fn:      getDecRounding(opts.Mode, opsImpl),
	}

	rnd.pow = rnd.ty.GetScale() - int32(rnd.ndigits)
	if rnd.pow < rnd.ty.GetPrecision() && rnd.pow >= 0 {
		rnd.pow10 = opsImpl.scaleMultiplier(int(rnd.pow))
		rnd.halfPow10 = opsImpl.halfScaleMultiplier(int(rnd.pow))
		rnd.negHalfPow10 = opsImpl.Neg(rnd.halfPow10)
	}

	return ScalarUnaryNotNull(rnd.call)(ctx, batch, out)
}

func getRoundToMultipleKernelDecimal[T decimal128.Num | decimal256.Num]() exec.ArrayKernelExec {
	var def T
	switch any(def).(type) {
	case decimal128.Num:
		return func(ctx *exec.KernelCtx, batch *exec.ExecSpan, out *exec.ExecResult) error {
			return roundToMultipleDecimal(&roundDec128, ctx, batch, out)
		}
	case decimal256.Num:
		return func(ctx *exec.KernelCtx, batch *exec.ExecSpan, out *exec.ExecResult) error {
			return roundToMultipleDecimal(&roundDec256, ctx, batch, out)
		}
	}
	panic("should never get here")
}

func roundToMultipleDecimal[T decimal128.Num | decimal256.Num](opsImpl *roundDecImpl[T], ctx *exec.KernelCtx, batch *exec.ExecSpan, out *exec.ExecResult) error {
	opts := ctx.State.(RoundToMultipleState)
	rnd := roundToMultipleDec[T]{
		ty:      out.Type.(arrow.DecimalType),
		mode:    opts.Mode,
		opsImpl: opsImpl,
		fn:      getDecRounding(opts.Mode, opsImpl),
		mult:    UnboxScalar[T](opts.Multiple.(scalar.PrimitiveScalar)),
	}

	rnd.halfMult = opsImpl.Div(rnd.mult, opsImpl.fromI64(2))
	rnd.negHalfMult = opsImpl.Neg(rnd.halfMult)
	rnd.hasHalfwayPoint = opsImpl.lowBits(rnd.mult)%2 == 0

	return ScalarUnaryNotNull(rnd.call)(ctx, batch, out)
}

type roundToMultiple[T constraints.Float] struct {
	multiple T
	mode     RoundMode

	fn func(T) T
}

func (rnd *roundToMultiple[T]) call(_ *exec.KernelCtx, arg T, e *error) T {
	val := float64(arg)
	// do not process Inf or NaN because they will trigger the overflow error
	// at the end of this.
	if math.IsInf(val, 0) || math.IsNaN(val) {
		return arg
	}

	roundVal := arg / rnd.multiple
	frac := roundVal - T(math.Floor(float64(roundVal)))
	if frac == 0 {
		// scaled value is an integer, no rounding needed
		return arg
	}

	if rnd.mode >= HalfDown && frac != 0.5 {
		roundVal = T(math.Round(float64(roundVal)))
	} else {
		roundVal = rnd.fn(roundVal)
	}
	roundVal *= rnd.multiple

	if math.IsInf(float64(roundVal), 0) || math.IsNaN(float64(roundVal)) {
		*e = errOverflow
		return arg
	}

	return roundVal
}

type roundToMultipleDec[T decimal128.Num | decimal256.Num] struct {
	ty   arrow.DecimalType
	mode RoundMode

	mult, halfMult, negHalfMult T
	hasHalfwayPoint             bool

	opsImpl *roundDecImpl[T]
	fn      func(T, T, T, int32) T
}

func (rnd *roundToMultipleDec[T]) call(_ *exec.KernelCtx, arg T, e *error) T {
	var def T

	val, remainder := rnd.opsImpl.divide(arg, rnd.mult)
	if remainder == def {
		return arg
	}

	one := rnd.opsImpl.fromI64(1)
	if rnd.mode >= HalfDown {
		if rnd.hasHalfwayPoint && (remainder == rnd.halfMult || remainder == rnd.negHalfMult) {
			// on the halfway point, use tiebreaker
			// manually implement rounding since we aren't actually rounding
			// a decimal value, but rather manipulating the multiple
			switch rnd.mode {
			case HalfDown:
				if rnd.opsImpl.Sign(remainder) < 0 {
					val = rnd.opsImpl.Sub(val, one)
				}
			case HalfUp:
				if rnd.opsImpl.Sign(remainder) >= 0 {
					val = rnd.opsImpl.Add(val, one)
				}
			case HalfTowardsZero:
			case HalfAwayFromZero:
				if rnd.opsImpl.Sign(remainder) >= 0 {
					val = rnd.opsImpl.Add(val, one)
				} else {
					val = rnd.opsImpl.Sub(val, one)
				}
			case HalfToEven:
				if rnd.opsImpl.lowBits(val)%2 != 0 {
					if rnd.opsImpl.Sign(remainder) >= 0 {
						val = rnd.opsImpl.Add(val, one)
					} else {
						val = rnd.opsImpl.Sub(val, one)
					}
				}
			case HalfToOdd:
				if rnd.opsImpl.lowBits(val)%2 == 0 {
					if rnd.opsImpl.Sign(remainder) >= 0 {
						val = rnd.opsImpl.Add(val, one)
					} else {
						val = rnd.opsImpl.Sub(val, one)
					}
				}
			}
		} else if rnd.opsImpl.Sign(remainder) >= 0 {
			// positive, round up/down
			if rnd.opsImpl.less(rnd.halfMult, remainder) {
				val = rnd.opsImpl.Add(val, one)
			}
		} else {
			// negative, round up/down
			if rnd.opsImpl.less(remainder, rnd.negHalfMult) {
				val = rnd.opsImpl.Sub(val, one)
			}
		}
	} else {
		// manually implement rounding since we aren't actually rounding
		// a decimal value, but rather manipulating the multiple
		switch rnd.mode {
		case RoundDown:
			if rnd.opsImpl.Sign(remainder) < 0 {
				val = rnd.opsImpl.Sub(val, one)
			}
		case RoundUp:
			if rnd.opsImpl.Sign(remainder) >= 0 {
				val = rnd.opsImpl.Add(val, one)
			}
		case TowardsZero:
		case AwayFromZero:
			if rnd.opsImpl.Sign(remainder) >= 0 {
				val = rnd.opsImpl.Add(val, one)
			} else {
				val = rnd.opsImpl.Sub(val, one)
			}
		}
	}

	roundVal := rnd.opsImpl.Mul(val, rnd.mult)
	if !rnd.opsImpl.fitsInPrec(roundVal, rnd.ty.GetPrecision()) {
		*e = fmt.Errorf("%w: rounded value %s does not fit in precision of %s",
			arrow.ErrInvalid, rnd.opsImpl.str(roundVal, rnd.ty.GetScale()), rnd.ty)
		return def
	}
	return roundVal
}

func UnaryRoundExec(ty arrow.Type) exec.ArrayKernelExec {
	switch ty {
	case arrow.FLOAT32:
		return roundKernelFloating[float32]
	case arrow.FLOAT64:
		return roundKernelFloating[float64]
	case arrow.DECIMAL128:
		return getRoundKernelDecimal[decimal128.Num]()
	case arrow.DECIMAL256:
		return getRoundKernelDecimal[decimal256.Num]()
	}
	panic("should never get here")
}

func UnaryRoundToMultipleExec(ty arrow.Type) exec.ArrayKernelExec {
	switch ty {
	case arrow.FLOAT32:
		return roundToMultipleFloating[float32]
	case arrow.FLOAT64:
		return roundToMultipleFloating[float64]
	case arrow.DECIMAL128:
		return getRoundToMultipleKernelDecimal[decimal128.Num]()
	case arrow.DECIMAL256:
		return getRoundToMultipleKernelDecimal[decimal256.Num]()
	}
	panic("should never get here")
}

func GetRoundUnaryKernels(init exec.KernelInitFn, knFn func(arrow.Type) exec.ArrayKernelExec) []exec.ScalarKernel {
	kernels := make([]exec.ScalarKernel, 0)
	for _, ty := range []arrow.DataType{arrow.PrimitiveTypes.Float32, arrow.PrimitiveTypes.Float64,
		&arrow.Decimal128Type{Precision: 1}, &arrow.Decimal256Type{Precision: 1}} {
		tyID := ty.ID()

		var out exec.OutputType
		if arrow.IsDecimal(tyID) {
			out = OutputFirstType
		} else {
			out = exec.NewOutputType(ty)
		}

		kernels = append(kernels, exec.NewScalarKernel(
			[]exec.InputType{exec.NewIDInput(tyID)}, out, knFn(tyID), init))
	}

	return append(kernels, NullExecKernel(1))
}

func GetSimpleRoundKernels(mode RoundMode) []exec.ScalarKernel {
	kernels := make([]exec.ScalarKernel, 0)
	for _, ty := range floatingTypes {
		var ex exec.ArrayKernelExec
		switch ty.ID() {
		case arrow.FLOAT32:
			fn := getFloatRoundImpl[float32](mode)
			ex = ScalarUnary(func(_ *exec.KernelCtx, in []float32, out []float32) error {
				for i, v := range in {
					out[i] = fn(v)
				}
				return nil
			})
		case arrow.FLOAT64:
			fn := getFloatRoundImpl[float64](mode)
			ex = ScalarUnary(func(_ *exec.KernelCtx, in []float64, out []float64) error {
				for i, v := range in {
					out[i] = fn(v)
				}
				return nil
			})
		}
		kernels = append(kernels, exec.NewScalarKernel(
			[]exec.InputType{exec.NewExactInput(ty)}, exec.NewOutputType(ty),
			ex, nil))
	}
	return append(kernels, NullExecKernel(1))
}

func fixedRoundDecimalExec[T decimal128.Num | decimal256.Num](opsImpl *roundDecImpl[T], mode RoundMode) exec.ArrayKernelExec {
	return func(ctx *exec.KernelCtx, batch *exec.ExecSpan, out *exec.ExecResult) error {
		rnd := roundDec[T]{
			ty:      out.Type.(arrow.DecimalType),
			mode:    mode,
			opsImpl: opsImpl,
			fn:      getDecRounding(mode, opsImpl),
		}

		rnd.pow = rnd.ty.GetScale() - int32(rnd.ndigits)
		if rnd.pow < rnd.ty.GetPrecision() && rnd.pow >= 0 {
			rnd.pow10 = opsImpl.scaleMultiplier(int(rnd.pow))
			rnd.halfPow10 = opsImpl.halfScaleMultiplier(int(rnd.pow))
			rnd.negHalfPow10 = opsImpl.Neg(rnd.halfPow10)
		}

		return ScalarUnaryNotNull(rnd.call)(ctx, batch, out)
	}
}

func FixedRoundDecimalExec[T decimal128.Num | decimal256.Num](mode RoundMode) exec.ArrayKernelExec {
	var def T
	switch any(def).(type) {
	case decimal128.Num:
		return func() exec.ArrayKernelExec {
			return fixedRoundDecimalExec(&roundDec128, mode)
		}()
	case decimal256.Num:
		return func() exec.ArrayKernelExec {
			return fixedRoundDecimalExec(&roundDec256, mode)
		}()
	}
	panic("should never get here")
}

// RoundTemporalUnit represents units supported for temporal rounding
type RoundTemporalUnit int8

const (
	RoundTemporalYear RoundTemporalUnit = iota
	RoundTemporalQuarter
	RoundTemporalMonth
	RoundTemporalWeek
	RoundTemporalDay
	RoundTemporalHour
	RoundTemporalMinute
	RoundTemporalSecond
	RoundTemporalMillisecond
	RoundTemporalMicrosecond
	RoundTemporalNanosecond
)

// RoundTemporalOptions provides configuration for temporal rounding operations
type RoundTemporalOptions struct {
	// Multiple is the number of units to round to. Must be positive.
	Multiple int64
	// Unit is the rounding unit (day, hour, etc.)
	Unit RoundTemporalUnit
	// WeekStartsMonday determines the start of the week for week-based rounding
	WeekStartsMonday bool
	// CeilIsStrictlyGreater: if true, ceil returns a value strictly greater than input
	CeilIsStrictlyGreater bool
	// CalendarBasedOrigin: if true, use calendar units as origin (e.g., start of day for hours)
	CalendarBasedOrigin bool
}

func (RoundTemporalOptions) TypeName() string { return "RoundTemporalOptions" }

type roundTemporalState struct {
	RoundTemporalOptions
	mode RoundMode

	// Pre-calculated values to avoid repeated computation
	unitNanos         int64 // Duration of the unit in nanoseconds
	roundingInterval  int64 // unitNanos * Multiple
	isSubDay          bool  // true if this is a sub-day unit (can use fast path)
	useCalendarOrigin bool  // true if using calendar-based origin
}

func InitRoundTemporalState(_ *exec.KernelCtx, args exec.KernelInitArgs) (exec.KernelState, error) {
	var rs roundTemporalState

	opts, ok := args.Options.(*RoundTemporalOptions)
	if ok {
		rs.RoundTemporalOptions = *opts
	} else {
		if rs.RoundTemporalOptions, ok = args.Options.(RoundTemporalOptions); !ok {
			return nil, fmt.Errorf("%w: attempted to initialize kernel state from invalid function options",
				arrow.ErrInvalid)
		}
	}

	if rs.Multiple <= 0 {
		return nil, fmt.Errorf("%w: rounding multiple must be positive", arrow.ErrInvalid)
	}

	// Pre-calculate constants for this rounding operation
	rs.unitNanos, rs.isSubDay = unitInNanos(rs.Unit)
	if rs.isSubDay {
		rs.roundingInterval = rs.unitNanos * rs.Multiple
		rs.useCalendarOrigin = rs.CalendarBasedOrigin && rs.Unit <= RoundTemporalDay
	}

	return rs, nil
}

// unitInNanos returns (nanoseconds, hasFixedDuration) for a temporal unit.
// Returns false for calendar units with variable durations (year, quarter, month, week).
func unitInNanos(unit RoundTemporalUnit) (int64, bool) {
	switch unit {
	case RoundTemporalNanosecond:
		return 1, true
	case RoundTemporalMicrosecond:
		return 1000, true
	case RoundTemporalMillisecond:
		return 1000000, true
	case RoundTemporalSecond:
		return 1000000000, true
	case RoundTemporalMinute:
		return 60 * 1000000000, true
	case RoundTemporalHour:
		return 3600 * 1000000000, true
	case RoundTemporalDay:
		return 86400 * 1000000000, true
	default:
		return 0, false
	}
}

// roundTimestamp rounds a timestamp value according to the specified options.
// tz specifies the timezone for calendar-aware rounding (nil defaults to UTC).
func roundTimestamp(ts int64, inputUnit arrow.TimeUnit, tz *time.Location, opts roundTemporalState) (int64, error) {
	if tz == nil {
		tz = time.UTC
	}

	// Calendar units with variable duration (year, quarter, month, week) require date arithmetic
	if !opts.isSubDay {
		tsNanos := convertToNanos(ts, inputUnit)
		return roundTimestampCalendar(tsNanos, inputUnit, tz, opts)
	}

	// Day rounding with timezone requires calendar arithmetic (days vary: 23/24/25 hours due to DST)
	isUTC := tz == time.UTC || tz.String() == "UTC"
	if !isUTC && opts.Unit == RoundTemporalDay {
		tsNanos := convertToNanos(ts, inputUnit)
		return roundTimestampCalendar(tsNanos, inputUnit, tz, opts)
	}

	// Sub-day units (hour, minute, second, etc.) use fixed-duration arithmetic
	// Fast path: round directly in input unit if possible (no origin, compatible units)
	if canRoundInInputUnit(inputUnit, opts.unitNanos) && !opts.useCalendarOrigin {
		intervalInInputUnit := opts.roundingInterval / int64(inputUnit.Multiplier())
		rounded := roundToMultipleInt64(ts, intervalInInputUnit, opts.mode, opts.CeilIsStrictlyGreater)
		return rounded, nil
	}

	// Slow path: convert to nanoseconds for calendar origin or incompatible units
	tsNanos := convertToNanos(ts, inputUnit)

	var origin int64 = 0
	if opts.useCalendarOrigin {
		// Calendar origin: round relative to start of day (timezone-aware if tz != nil)
		if tz != nil {
			t := time.Unix(0, tsNanos).In(tz)
			startOfDay := time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, tz)
			origin = startOfDay.UnixNano()
		} else {
			origin = tsNanos
		}
	}

	adjusted := tsNanos - origin
	rounded := roundToMultipleInt64(adjusted, opts.roundingInterval, opts.mode, opts.CeilIsStrictlyGreater)
	result := origin + rounded

	return convertFromNanos(result, inputUnit), nil
}

// canRoundInInputUnit checks if rounding can be done in the input unit
// without converting to nanoseconds (true when rounding interval is evenly divisible).
func canRoundInInputUnit(inputUnit arrow.TimeUnit, roundingIntervalNanos int64) bool {
	return roundingIntervalNanos%int64(inputUnit.Multiplier()) == 0
}

// convertToNanos converts a timestamp value to nanoseconds
func convertToNanos(ts int64, unit arrow.TimeUnit) int64 {
	return ts * int64(unit.Multiplier())
}

// convertFromNanos converts a nanosecond timestamp to the specified unit
func convertFromNanos(nanos int64, unit arrow.TimeUnit) int64 {
	return nanos / int64(unit.Multiplier())
}

func roundToMultipleInt64(value, multiple int64, mode RoundMode, strictCeil bool) int64 {
	if multiple == 0 || value%multiple == 0 {
		if strictCeil && mode == RoundUp {
			return value + multiple
		}
		return value
	}

	quotient := value / multiple
	remainder := value % multiple

	switch mode {
	case RoundDown:
		if remainder < 0 {
			return (quotient - 1) * multiple
		}
		return quotient * multiple
	case RoundUp:
		if remainder > 0 || (strictCeil && remainder == 0) {
			return (quotient + 1) * multiple
		}
		if remainder < 0 {
			return quotient * multiple
		}
		return (quotient + 1) * multiple
	case HalfUp, HalfDown, HalfToEven:
		half := multiple / 2
		absRemainder := remainder
		if absRemainder < 0 {
			absRemainder = -absRemainder
		}

		if absRemainder < half {
			return quotient * multiple
		} else if absRemainder > half {
			if remainder > 0 {
				return (quotient + 1) * multiple
			}
			return (quotient - 1) * multiple
		} else {
			// Exactly on the halfway point
			switch mode {
			case HalfDown:
				if remainder > 0 {
					return quotient * multiple
				}
				return (quotient - 1) * multiple
			case HalfUp:
				if remainder > 0 {
					return (quotient + 1) * multiple
				}
				return quotient * multiple
			case HalfToEven:
				if quotient%2 == 0 {
					return quotient * multiple
				}
				if remainder > 0 {
					return (quotient + 1) * multiple
				}
				return (quotient - 1) * multiple
			}
		}
	}
	return quotient * multiple
}

// halfRoundPeriod performs half-rounding by finding the midpoint between period start and end
func halfRoundPeriod(t, periodStart, periodEnd time.Time) time.Time {
	midPoint := periodStart.Add(periodEnd.Sub(periodStart) / 2)
	if t.Before(midPoint) {
		return periodStart
	}
	return periodEnd
}

// roundTimestampCalendar handles calendar-based rounding (year, quarter, month, week, day).
// Requires date arithmetic for variable-length periods and timezone-aware boundaries.
func roundTimestampCalendar(tsNanos int64, inputUnit arrow.TimeUnit, tz *time.Location, opts roundTemporalState) (int64, error) {
	// Convert to time.Time for calendar operations in the specified timezone
	secs := tsNanos / 1000000000
	nanos := tsNanos % 1000000000
	t := time.Unix(secs, nanos).In(tz)

	var rounded time.Time

	switch opts.Unit {
	case RoundTemporalYear:
		year := t.Year()
		roundedYear := (year / int(opts.Multiple)) * int(opts.Multiple)
		switch opts.mode {
		case RoundDown:
			rounded = time.Date(roundedYear, 1, 1, 0, 0, 0, 0, tz)
		case RoundUp:
			periodStart := time.Date(roundedYear, 1, 1, 0, 0, 0, 0, tz)
			if opts.CeilIsStrictlyGreater || !t.Equal(periodStart) {
				roundedYear += int(opts.Multiple)
				rounded = time.Date(roundedYear, 1, 1, 0, 0, 0, 0, tz)
			} else {
				rounded = periodStart
			}
		default:
			yearStart := time.Date(roundedYear, 1, 1, 0, 0, 0, 0, tz)
			nextYear := roundedYear + int(opts.Multiple)
			yearEnd := time.Date(nextYear, 1, 1, 0, 0, 0, 0, tz)
			rounded = halfRoundPeriod(t, yearStart, yearEnd)
		}

	case RoundTemporalQuarter:
		// Q1=Jan-Mar, Q2=Apr-Jun, Q3=Jul-Sep, Q4=Oct-Dec
		month := int(t.Month())
		year := t.Year()
		totalQuarters := year*4 + (month-1)/3
		roundedQuarters := (totalQuarters / int(opts.Multiple)) * int(opts.Multiple)
		roundedYear := roundedQuarters / 4
		roundedQuarter := roundedQuarters % 4
		roundedMonth := roundedQuarter*3 + 1 // First month of the quarter

		switch opts.mode {
		case RoundDown:
			rounded = time.Date(roundedYear, time.Month(roundedMonth), 1, 0, 0, 0, 0, tz)
		case RoundUp:
			periodStart := time.Date(roundedYear, time.Month(roundedMonth), 1, 0, 0, 0, 0, tz)
			if opts.CeilIsStrictlyGreater || !t.Equal(periodStart) {
				roundedQuarters += int(opts.Multiple)
				roundedYear = roundedQuarters / 4
				roundedQuarter = roundedQuarters % 4
				roundedMonth = roundedQuarter*3 + 1
				rounded = time.Date(roundedYear, time.Month(roundedMonth), 1, 0, 0, 0, 0, tz)
			} else {
				rounded = periodStart
			}
		default:
			quarterStart := time.Date(roundedYear, time.Month(roundedMonth), 1, 0, 0, 0, 0, tz)
			nextQuarterNum := roundedQuarters + int(opts.Multiple)
			nextYear := nextQuarterNum / 4
			nextQuarter := nextQuarterNum % 4
			nextMonth := nextQuarter*3 + 1
			quarterEnd := time.Date(nextYear, time.Month(nextMonth), 1, 0, 0, 0, 0, tz)
			rounded = halfRoundPeriod(t, quarterStart, quarterEnd)
		}

	case RoundTemporalMonth:
		month := int(t.Month())
		year := t.Year()
		totalMonths := year*12 + month - 1
		roundedMonths := (totalMonths / int(opts.Multiple)) * int(opts.Multiple)
		roundedYear := roundedMonths / 12
		roundedMonth := (roundedMonths % 12) + 1

		switch opts.mode {
		case RoundDown:
			rounded = time.Date(roundedYear, time.Month(roundedMonth), 1, 0, 0, 0, 0, tz)
		case RoundUp:
			periodStart := time.Date(roundedYear, time.Month(roundedMonth), 1, 0, 0, 0, 0, tz)
			if opts.CeilIsStrictlyGreater || !t.Equal(periodStart) {
				roundedMonths += int(opts.Multiple)
				roundedYear = roundedMonths / 12
				roundedMonth = (roundedMonths % 12) + 1
				rounded = time.Date(roundedYear, time.Month(roundedMonth), 1, 0, 0, 0, 0, tz)
			} else {
				rounded = periodStart
			}
		default:
			monthStart := time.Date(roundedYear, time.Month(roundedMonth), 1, 0, 0, 0, 0, tz)
			nextMonthNum := roundedMonths + int(opts.Multiple)
			nextYear := nextMonthNum / 12
			nextMonth := (nextMonthNum % 12) + 1
			monthEnd := time.Date(nextYear, time.Month(nextMonth), 1, 0, 0, 0, 0, tz)
			rounded = halfRoundPeriod(t, monthStart, monthEnd)
		}

	case RoundTemporalWeek:
		weekday := int(t.Weekday())
		if opts.WeekStartsMonday {
			weekday = (weekday + 6) % 7
		}
		startOfWeek := t.AddDate(0, 0, -weekday)
		startOfWeek = time.Date(startOfWeek.Year(), startOfWeek.Month(), startOfWeek.Day(), 0, 0, 0, 0, tz)

		// Calculate N-week periods from epoch for Multiple > 1
		epochInTz := time.Unix(0, 0).In(tz)
		epochWeekday := int(epochInTz.Weekday())
		if opts.WeekStartsMonday {
			epochWeekday = (epochWeekday + 6) % 7
		}
		epochWeekStart := epochInTz.AddDate(0, 0, -epochWeekday)
		epochWeekStart = time.Date(epochWeekStart.Year(), epochWeekStart.Month(), epochWeekStart.Day(), 0, 0, 0, 0, tz)

		daysSinceEpochWeek := int(startOfWeek.Sub(epochWeekStart).Hours() / 24)
		weeksSinceEpoch := daysSinceEpochWeek / 7
		roundedWeeks := (weeksSinceEpoch / int(opts.Multiple)) * int(opts.Multiple)
		roundedWeekStart := epochWeekStart.AddDate(0, 0, roundedWeeks*7)

		switch opts.mode {
		case RoundDown:
			rounded = roundedWeekStart
		case RoundUp:
			if opts.CeilIsStrictlyGreater || !t.Equal(roundedWeekStart) {
				rounded = roundedWeekStart.AddDate(0, 0, 7*int(opts.Multiple))
			} else {
				rounded = roundedWeekStart
			}
		default:
			weekEnd := roundedWeekStart.AddDate(0, 0, 7*int(opts.Multiple))
			rounded = halfRoundPeriod(t, roundedWeekStart, weekEnd)
		}

	case RoundTemporalDay:
		startOfDay := time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, tz)

		switch opts.mode {
		case RoundDown:
			rounded = startOfDay
		case RoundUp:
			if opts.CeilIsStrictlyGreater || !t.Equal(startOfDay) {
				rounded = startOfDay.AddDate(0, 0, 1)
			} else {
				rounded = startOfDay
			}
		default:
			nextDay := startOfDay.AddDate(0, 0, 1)
			rounded = halfRoundPeriod(t, startOfDay, nextDay)
		}

	default:
		return 0, fmt.Errorf("%w: unsupported calendar unit", arrow.ErrNotImplemented)
	}

	// Convert back to the input unit
	roundedNanos := rounded.UnixNano()
	return convertFromNanos(roundedNanos, inputUnit), nil
}

// Kernel execution functions for temporal rounding
func FloorTemporalKernel(ctx *exec.KernelCtx, batch *exec.ExecSpan, out *exec.ExecResult) error {
	state := ctx.State.(roundTemporalState)
	state.mode = RoundDown
	return roundTemporalExec(ctx, batch, out, state)
}

func CeilTemporalKernel(ctx *exec.KernelCtx, batch *exec.ExecSpan, out *exec.ExecResult) error {
	state := ctx.State.(roundTemporalState)
	state.mode = RoundUp
	return roundTemporalExec(ctx, batch, out, state)
}

func RoundTemporalKernel(ctx *exec.KernelCtx, batch *exec.ExecSpan, out *exec.ExecResult) error {
	state := ctx.State.(roundTemporalState)
	state.mode = HalfUp
	return roundTemporalExec(ctx, batch, out, state)
}

func roundTemporalExec(ctx *exec.KernelCtx, batch *exec.ExecSpan, out *exec.ExecResult, state roundTemporalState) error {
	input := &batch.Values[0].Array

	// Handle date types by converting to timestamp equivalents
	switch input.Type.ID() {
	case arrow.DATE32:
		// Date32 stores days since epoch as int32, treat as timestamp[s] at midnight
		fn := func(_ *exec.KernelCtx, days int32, e *error) int32 {
			// Convert days to seconds (timestamp at midnight UTC)
			tsSeconds := int64(days) * 86400
			result, err := roundTimestamp(tsSeconds, arrow.Second, nil, state)
			if err != nil {
				*e = err
				return 0
			}
			// Convert back to days
			return int32(result / 86400)
		}
		return ScalarUnaryNotNull(fn)(ctx, batch, out)

	case arrow.DATE64:
		// Date64 stores milliseconds since epoch, treat as timestamp[ms]
		fn := func(_ *exec.KernelCtx, ms int64, e *error) int64 {
			result, err := roundTimestamp(ms, arrow.Millisecond, nil, state)
			if err != nil {
				*e = err
				return 0
			}
			return result
		}
		return ScalarUnaryNotNull(fn)(ctx, batch, out)

	case arrow.TIME32:
		// Time32 stores time-of-day in seconds or milliseconds
		// Rounding wraps at day boundaries (modulo 24 hours)
		timeType := input.Type.(*arrow.Time32Type)
		fn := func(_ *exec.KernelCtx, time int32, e *error) int32 {
			// Convert to int64 for rounding
			result, err := roundTimestamp(int64(time), timeType.Unit, nil, state)
			if err != nil {
				*e = err
				return 0
			}
			// Wrap at day boundary
			var dayInUnit int64
			if timeType.Unit == arrow.Second {
				dayInUnit = 86400 // 24 hours in seconds
			} else {
				dayInUnit = 86400000 // 24 hours in milliseconds
			}
			wrapped := result % dayInUnit
			if wrapped < 0 {
				wrapped += dayInUnit
			}
			return int32(wrapped)
		}
		return ScalarUnaryNotNull(fn)(ctx, batch, out)

	case arrow.TIME64:
		// Time64 stores time-of-day in microseconds or nanoseconds
		// Rounding wraps at day boundaries (modulo 24 hours)
		timeType := input.Type.(*arrow.Time64Type)
		fn := func(_ *exec.KernelCtx, time int64, e *error) int64 {
			result, err := roundTimestamp(time, timeType.Unit, nil, state)
			if err != nil {
				*e = err
				return 0
			}
			// Wrap at day boundary
			var dayInUnit int64
			if timeType.Unit == arrow.Microsecond {
				dayInUnit = 86400000000 // 24 hours in microseconds
			} else {
				dayInUnit = 86400000000000 // 24 hours in nanoseconds
			}
			wrapped := result % dayInUnit
			if wrapped < 0 {
				wrapped += dayInUnit
			}
			return wrapped
		}
		return ScalarUnaryNotNull(fn)(ctx, batch, out)
	}

	// Handle timestamp types
	inputType := input.Type.(arrow.TemporalWithUnit)

	// Extract timezone if present (for timestamp types)
	var tz *time.Location
	if tsType, ok := input.Type.(*arrow.TimestampType); ok && tsType.TimeZone != "" {
		var err error
		tz, err = time.LoadLocation(tsType.TimeZone)
		if err != nil {
			return fmt.Errorf("%w: invalid timezone %q: %v", arrow.ErrInvalid, tsType.TimeZone, err)
		}
	}

	fn := func(_ *exec.KernelCtx, ts int64, e *error) int64 {
		result, err := roundTimestamp(ts, inputType.TimeUnit(), tz, state)
		if err != nil {
			*e = err
			return 0
		}
		return result
	}

	switch inputType.TimeUnit() {
	case arrow.Second, arrow.Millisecond, arrow.Microsecond, arrow.Nanosecond:
		return ScalarUnaryNotNull(fn)(ctx, batch, out)
	default:
		return fmt.Errorf("%w: unsupported time unit", arrow.ErrNotImplemented)
	}
}

func GetTemporalRoundingKernels(init exec.KernelInitFn, execFn exec.ArrayKernelExec) []exec.ScalarKernel {
	kernels := make([]exec.ScalarKernel, 0)

	// Timestamp kernels
	for _, unit := range arrow.TimeUnitValues {
		kernels = append(kernels, exec.NewScalarKernel(
			[]exec.InputType{exec.NewMatchedInput(exec.TimestampTypeUnit(unit))},
			OutputFirstType,
			execFn,
			init,
		))
	}

	// Date32 kernel
	kernels = append(kernels, exec.NewScalarKernel(
		[]exec.InputType{exec.NewMatchedInput(exec.Date32Type())},
		OutputFirstType,
		execFn,
		init,
	))

	// Date64 kernel
	kernels = append(kernels, exec.NewScalarKernel(
		[]exec.InputType{exec.NewMatchedInput(exec.Date64Type())},
		OutputFirstType,
		execFn,
		init,
	))

	// Time32 kernels (seconds and milliseconds)
	kernels = append(kernels, exec.NewScalarKernel(
		[]exec.InputType{exec.NewMatchedInput(exec.Time32TypeUnit(arrow.Second))},
		OutputFirstType,
		execFn,
		init,
	))
	kernels = append(kernels, exec.NewScalarKernel(
		[]exec.InputType{exec.NewMatchedInput(exec.Time32TypeUnit(arrow.Millisecond))},
		OutputFirstType,
		execFn,
		init,
	))

	// Time64 kernels (microseconds and nanoseconds)
	kernels = append(kernels, exec.NewScalarKernel(
		[]exec.InputType{exec.NewMatchedInput(exec.Time64TypeUnit(arrow.Microsecond))},
		OutputFirstType,
		execFn,
		init,
	))
	kernels = append(kernels, exec.NewScalarKernel(
		[]exec.InputType{exec.NewMatchedInput(exec.Time64TypeUnit(arrow.Nanosecond))},
		OutputFirstType,
		execFn,
		init,
	))

	return append(kernels, NullExecKernel(1))
}
