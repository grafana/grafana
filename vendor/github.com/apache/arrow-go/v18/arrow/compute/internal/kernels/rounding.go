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
