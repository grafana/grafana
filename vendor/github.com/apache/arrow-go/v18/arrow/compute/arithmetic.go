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

package compute

import (
	"context"
	"fmt"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/compute/exec"
	"github.com/apache/arrow-go/v18/arrow/compute/internal/kernels"
	"github.com/apache/arrow-go/v18/arrow/decimal128"
	"github.com/apache/arrow-go/v18/arrow/decimal256"
	"github.com/apache/arrow-go/v18/arrow/scalar"
)

type (
	RoundOptions           = kernels.RoundOptions
	RoundMode              = kernels.RoundMode
	RoundToMultipleOptions = kernels.RoundToMultipleOptions
)

const (
	// Round to nearest integer less than or equal in magnitude (aka "floor")
	RoundDown = kernels.RoundDown
	// Round to nearest integer greater than or equal in magnitude (aka "ceil")
	RoundUp = kernels.RoundUp
	// Get integral part without fractional digits (aka "trunc")
	RoundTowardsZero = kernels.TowardsZero
	// Round negative values with DOWN and positive values with UP
	RoundTowardsInfinity = kernels.AwayFromZero
	// Round ties with DOWN (aka "round half towards negative infinity")
	RoundHalfDown = kernels.HalfDown
	// Round ties with UP (aka "round half towards positive infinity")
	RoundHalfUp = kernels.HalfUp
	// Round ties with TowardsZero (aka "round half away from infinity")
	RoundHalfTowardsZero = kernels.HalfTowardsZero
	// Round ties with AwayFromZero (aka "round half towards infinity")
	RoundHalfTowardsInfinity = kernels.HalfAwayFromZero
	// Round ties to nearest even integer
	RoundHalfToEven = kernels.HalfToEven
	// Round ties to nearest odd integer
	RoundHalfToOdd = kernels.HalfToOdd
)

var (
	DefaultRoundOptions           = RoundOptions{NDigits: 0, Mode: RoundHalfToEven}
	DefaultRoundToMultipleOptions = RoundToMultipleOptions{
		Multiple: scalar.NewFloat64Scalar(1), Mode: RoundHalfToEven}
)

type arithmeticFunction struct {
	ScalarFunction

	promote decimalPromotion
}

func (fn *arithmeticFunction) Execute(ctx context.Context, opts FunctionOptions, args ...Datum) (Datum, error) {
	return execInternal(ctx, fn, opts, -1, args...)
}

func (fn *arithmeticFunction) checkDecimals(vals ...arrow.DataType) error {
	if !hasDecimal(vals...) {
		return nil
	}

	if len(vals) != 2 {
		return nil
	}

	if fn.promote == decPromoteNone {
		return fmt.Errorf("%w: invalid decimal function: %s", arrow.ErrInvalid, fn.name)
	}

	return castBinaryDecimalArgs(fn.promote, vals...)
}

func (fn *arithmeticFunction) DispatchBest(vals ...arrow.DataType) (exec.Kernel, error) {
	if err := fn.checkArity(len(vals)); err != nil {
		return nil, err
	}

	if err := fn.checkDecimals(vals...); err != nil {
		return nil, err
	}

	if kn, err := fn.DispatchExact(vals...); err == nil {
		return kn, nil
	}

	ensureDictionaryDecoded(vals...)

	// only promote types for binary funcs
	if len(vals) == 2 {
		replaceNullWithOtherType(vals...)
		if unit, istime := commonTemporalResolution(vals...); istime {
			replaceTemporalTypes(unit, vals...)
		} else {
			if dt := commonNumeric(vals...); dt != nil {
				replaceTypes(dt, vals...)
			}
		}
	}

	return fn.DispatchExact(vals...)
}

// an arithmetic function which promotes integers and decimal
// arguments to doubles.
type arithmeticFloatingPointFunc struct {
	arithmeticFunction
}

func (fn *arithmeticFloatingPointFunc) Execute(ctx context.Context, opts FunctionOptions, args ...Datum) (Datum, error) {
	return execInternal(ctx, fn, opts, -1, args...)
}

func (fn *arithmeticFloatingPointFunc) DispatchBest(vals ...arrow.DataType) (exec.Kernel, error) {
	if err := fn.checkArity(len(vals)); err != nil {
		return nil, err
	}

	if kn, err := fn.DispatchExact(vals...); err == nil {
		return kn, nil
	}

	ensureDictionaryDecoded(vals...)

	if len(vals) == 2 {
		replaceNullWithOtherType(vals...)
	}

	for i, v := range vals {
		if arrow.IsInteger(v.ID()) || arrow.IsDecimal(v.ID()) {
			vals[i] = arrow.PrimitiveTypes.Float64
		}
	}

	if dt := commonNumeric(vals...); dt != nil {
		replaceTypes(dt, vals...)
	}

	return fn.DispatchExact(vals...)
}

// function that promotes only decimal arguments to float64
type arithmeticDecimalToFloatingPointFunc struct {
	arithmeticFunction
}

func (fn *arithmeticDecimalToFloatingPointFunc) Execute(ctx context.Context, opts FunctionOptions, args ...Datum) (Datum, error) {
	return execInternal(ctx, fn, opts, -1, args...)
}

func (fn *arithmeticDecimalToFloatingPointFunc) DispatchBest(vals ...arrow.DataType) (exec.Kernel, error) {
	if err := fn.checkArity(len(vals)); err != nil {
		return nil, err
	}

	if kn, err := fn.DispatchExact(vals...); err == nil {
		return kn, nil
	}

	ensureDictionaryDecoded(vals...)
	if len(vals) == 2 {
		replaceNullWithOtherType(vals...)
	}

	for i, t := range vals {
		if arrow.IsDecimal(t.ID()) {
			vals[i] = arrow.PrimitiveTypes.Float64
		}
	}

	if dt := commonNumeric(vals...); dt != nil {
		replaceTypes(dt, vals...)
	}

	return fn.DispatchExact(vals...)
}

// function that promotes only integer arguments to float64
type arithmeticIntegerToFloatingPointFunc struct {
	arithmeticFunction
}

func (fn *arithmeticIntegerToFloatingPointFunc) Execute(ctx context.Context, opts FunctionOptions, args ...Datum) (Datum, error) {
	return execInternal(ctx, fn, opts, -1, args...)
}

func (fn *arithmeticIntegerToFloatingPointFunc) DispatchBest(vals ...arrow.DataType) (exec.Kernel, error) {
	if err := fn.checkArity(len(vals)); err != nil {
		return nil, err
	}

	if err := fn.checkDecimals(vals...); err != nil {
		return nil, err
	}

	if kn, err := fn.DispatchExact(vals...); err == nil {
		return kn, nil
	}

	ensureDictionaryDecoded(vals...)
	if len(vals) == 2 {
		replaceNullWithOtherType(vals...)
	}

	for i, t := range vals {
		if arrow.IsInteger(t.ID()) {
			vals[i] = arrow.PrimitiveTypes.Float64
		}
	}

	if dt := commonNumeric(vals...); dt != nil {
		replaceTypes(dt, vals...)
	}

	return fn.DispatchExact(vals...)
}

var (
	absoluteValueUncheckedDoc = FunctionDoc{
		Summary: "Calculate the absolute value of the argument, element-wise",
		Description: `Results will wrap around on integer overflow
Use function "abs" if you want overflows to return an error`,
		ArgNames: []string{"x"},
	}
	absoluteValueDoc = FunctionDoc{
		Summary: "Calculate the absolute value of the argument element-wise",
		Description: `This function returns an error on overflow. For a variant that
won't fail on overflow, use function "abs_unchecked"`,
		ArgNames: []string{"x"},
	}
	addUncheckedDoc = FunctionDoc{
		Summary: "Add the arguments element-wise",
		Description: `Results will wrap around on integer overflow
Use the function "add" if you want overflow to return an error`,
		ArgNames: []string{"x", "y"},
	}
	addDoc = FunctionDoc{
		Summary: "Add the arguments element-wise",
		Description: `This function returns an error on overflow.
For a variant that won't fail on overflow, use function "add_unchecked"`,
		ArgNames: []string{"x", "y"},
	}
	subUncheckedDoc = FunctionDoc{
		Summary: "Subtract the arguments element-wise",
		Description: `This Results will wrap around on integer overflow.
Use the function "sub" if you want overflow to return an error`,
		ArgNames: []string{"x", "y"},
	}
	subDoc = FunctionDoc{
		Summary: "Subtract the arguments element-wise",
		Description: `This function returns an error on overflow.
For a variant that won't fail on overflow, use the function "sub_unchecked"`,
		ArgNames: []string{"x", "y"},
	}
	mulUncheckedDoc = FunctionDoc{
		Summary: "Multiply the arguments element-wise",
		Description: `Results will wrap around on integer overflow.
Use function "multiply" if you want overflow to return an error`,
		ArgNames: []string{"x", "y"},
	}
	mulDoc = FunctionDoc{
		Summary: "Multiply the arguments element-wise",
		Description: `This function returns an error on overflow.
For a variant that won't fail on overflow, use the function
"multiply_unchecked"`,
		ArgNames: []string{"x", "y"},
	}
	divUncheckedDoc = FunctionDoc{
		Summary: "Divide the arguments element-wise",
		Description: `Integer division by zero returns an error. However integer
overflow wraps around, and floating-point division by zero returns Inf.
Use the function "divide" if you want to get an error in all the 
aforementioned cases.`,
		ArgNames: []string{"dividend", "divisor"},
	}
	divDoc = FunctionDoc{
		Summary: "Divide the arguments element-wise",
		Description: `An error is returned when trying to divide by zero,
or when integer overflow is encountered.`,
		ArgNames: []string{"dividend", "divisor"},
	}
	negateUncheckedDoc = FunctionDoc{
		Summary: "Negate the argument element-wise",
		Description: `Results will wrap around on integer overflow
Use function "negate" if you want overflow to return an error`,
		ArgNames: []string{"x"},
	}
	negateDoc = FunctionDoc{
		Summary: "Negate the argument element-wise",
		Description: `This function returns an error on overflow. For a variant
that doesn't fail on overflow, use the function "negate_unchecked".`,
		ArgNames: []string{"x"},
	}
	powUncheckedDoc = FunctionDoc{
		Summary: "Raise argument to a power element-wise",
		Description: `Integers to negative integer powers return an error.
However, integer overflow wraps around. If either base or exponent is null
the result will be null.`,
		ArgNames: []string{"base", "exponent"},
	}
	powDoc = FunctionDoc{
		Summary: "Raise argument to a power element-wise",
		Description: `An error is returned when an integer is raised to a negative
power or an integer overflow occurs.`,
		ArgNames: []string{"base", "exponent"},
	}
	sqrtUncheckedDoc = FunctionDoc{
		Summary: "Takes the square root of arguments element-wise",
		Description: `A negative argument returns an NaN. For a variant that returns
an error, use function "sqrt"`,
		ArgNames: []string{"x"},
	}
	sqrtDoc = FunctionDoc{
		Summary: "Takes the square root of arguments element-wise",
		Description: `A negative argument returns an error. For a variant that
instead returns NaN, use function "sqrt_unchecked"`,
		ArgNames: []string{"x"},
	}
	signDoc = FunctionDoc{
		Summary: "Get the signedness of the arguments element-wise",
		Description: `Output is -1 if <0, 1 if >0 and 0 for 0.
NaN values return NaN. Integral values return signedness as Int8,
and floating-point values return it with the same type as the input values.`,
		ArgNames: []string{"x"},
	}
	bitWiseNotDoc = FunctionDoc{
		Summary:     "Bit-wise negate the arguments element-wise",
		Description: "Null values return null",
		ArgNames:    []string{"x"},
	}
	bitWiseAndDoc = FunctionDoc{
		Summary:     "Bit-wise AND the arguments element-wise",
		Description: "Null values return null",
		ArgNames:    []string{"x", "y"},
	}
	bitWiseOrDoc = FunctionDoc{
		Summary:     "Bit-wise OR the arguments element-wise",
		Description: "Null values return null",
		ArgNames:    []string{"x", "y"},
	}
	bitWiseXorDoc = FunctionDoc{
		Summary:     "Bit-wise XOR the arguments element-wise",
		Description: "Null values return null",
		ArgNames:    []string{"x", "y"},
	}
	shiftLeftUncheckedDoc = FunctionDoc{
		Summary: "Left shift `x` by `y`",
		Description: `The shift operates as if on the two's complement representation
of the number. In other words, this is equivalent to multiplying "x" by 2
to the power of "y", even if overflow occurs.
"x" is returned if "y" (the amount to shift by) is (1) negative or (2)
greater than or equal to the precision of "x".
Use function "shift_left" if you want an invalid shift amount to
return an error.`,
		ArgNames: []string{"x", "y"},
	}
	shiftLeftDoc = FunctionDoc{
		Summary: "Left shift `x` by `y`",
		Description: `The shift operates as if on the two's complement representation
of the number. In other words, this is equivalent to multiplying "x" by 2 
to the power of "y", even if overflow occurs.
An error is raised if "y" (the amount to shift by) is (1) negative or (2)
greater than or equal to the precision of "x".
See "shift_left_unchecked" for a variant that doesn't fail for an invalid
shift amount.`,
		ArgNames: []string{"x", "y"},
	}
	shiftRightUncheckedDoc = FunctionDoc{
		Summary: "Right shift `x` by `y`",
		Description: `This is equivalent to dividing "x" by 2 to the power "y".
"x" is returned if "y" (the amount to shift by) is: (1) negative or
(2) greater than or equal to the precision of "x".
Use function "shift_right" if you want an invalid 
shift amount to return an error.`,
		ArgNames: []string{"x", "y"},
	}
	shiftRightDoc = FunctionDoc{
		Summary: "Right shift `x` by `y`",
		Description: `This is equivalent to dividing "x" by 2 to the power "y".
An error is raised if "y" (the amount to shift by) is (1) negative or
(2) greater than or equal to the precision of "x".
See "shift_right_unchecked" for a variant that doesn't fail for
an invalid shift amount.`,
		ArgNames: []string{"x", "y"},
	}
	sinUncheckedDoc = FunctionDoc{
		Summary: "Compute the sine",
		Description: `NaN is returned for invalid input values; to raise an error
instead, see "sin"`,
		ArgNames: []string{"x"},
	}
	sinDoc = FunctionDoc{
		Summary: "Compute the sine",
		Description: `Invalid input values raise an error;
to return NaN instead, see "sin_unchecked".`,
		ArgNames: []string{"x"},
	}
	cosUncheckedDoc = FunctionDoc{
		Summary: "Compute the cosine",
		Description: `NaN is returned for invalid input values;
to raise an error instead, see "cos".`,
		ArgNames: []string{"x"},
	}
	cosDoc = FunctionDoc{
		Summary: "Compute the cosine",
		Description: `Infinite values raise an error;
to return NaN instead, see "cos_unchecked".`,
		ArgNames: []string{"x"},
	}
	tanUncheckedDoc = FunctionDoc{
		Summary: "Compute the tangent",
		Description: `NaN is returned for invalid input values;
to raise an error instead see "tan".`,
		ArgNames: []string{"x"},
	}
	tanDoc = FunctionDoc{
		Summary: "Compute the tangent",
		Description: `Infinite values raise an error;
to return NaN instead, see "tan_unchecked".`,
		ArgNames: []string{"x"},
	}
	asinUncheckedDoc = FunctionDoc{
		Summary: "Compute the inverse sine",
		Description: `NaN is returned for invalid input values;
to raise an error instead, see "asin"`,
		ArgNames: []string{"x"},
	}
	asinDoc = FunctionDoc{
		Summary: "Compute the inverse sine",
		Description: `Invalid input values raise an error;
to return NaN instead see asin_unchecked.`,
		ArgNames: []string{"x"},
	}
	acosUncheckedDoc = FunctionDoc{
		Summary: "Compute the inverse cosine",
		Description: `NaN is returned for invalid input values;
to raise an error instead, see "acos".`,
		ArgNames: []string{"x"},
	}
	acosDoc = FunctionDoc{
		Summary: "Compute the inverse cosine",
		Description: `Invalid input values raise an error;
to return NaN instead, see "acos_unchecked".`,
		ArgNames: []string{"x"},
	}
	atanDoc = FunctionDoc{
		Summary: "Compute the inverse tangent of x",
		Description: `The return value is in the range [-pi/2, pi/2];
for a full return range [-pi, pi], see "atan2"`,
		ArgNames: []string{"x"},
	}
	atan2Doc = FunctionDoc{
		Summary:     "Compute the inverse tangent of y/x",
		Description: "The return value is in the range [-pi, pi].",
		ArgNames:    []string{"y", "x"},
	}
	lnUncheckedDoc = FunctionDoc{
		Summary: "Compute natural logarithm",
		Description: `Non-positive values return -Inf or NaN. Null values return null.
Use function "ln" if you want non-positive values to raise an error.`,
		ArgNames: []string{"x"},
	}
	lnDoc = FunctionDoc{
		Summary: "Compute natural logarithm",
		Description: `Non-positive values raise an error. Null values return null.
Use function "ln_unchecked" if you want non-positive values to return 
-Inf or NaN`,
		ArgNames: []string{"x"},
	}
	log10UncheckedDoc = FunctionDoc{
		Summary: "Compute base 10 logarithm",
		Description: `Non-positive values return -Inf or NaN. Null values return null.
Use function "log10" if you want non-positive values to raise an error.`,
		ArgNames: []string{"x"},
	}
	log10Doc = FunctionDoc{
		Summary: "Compute base 10 logarithm",
		Description: `Non-positive values raise an error. Null values return null.
Use function "log10_unchecked" if you want non-positive values to return
-Inf or NaN.`,
		ArgNames: []string{"x"},
	}
	log2UncheckedDoc = FunctionDoc{
		Summary: "Compute base 2 logarithm",
		Description: `Non-positive values return -Inf or NaN. Null values return null.
Use function "log2" if you want non-positive values to raise an error.`,
		ArgNames: []string{"x"},
	}
	log2Doc = FunctionDoc{
		Summary: "Compute base 2 logarithm",
		Description: `Non-positive values raise an error. Null values return null.
Use function "log2_unchecked" if you want non-positive values to 
return -Inf or NaN`,
		ArgNames: []string{"x"},
	}
	log1pUncheckedDoc = FunctionDoc{
		Summary: "Compute natural log of (1+x)",
		Description: `Values <= -1 return -Inf or NaN. Null values return null.
This function may be more precise than log(1 + x) for x close to zero.
Use function "log1p" if you want invalid values to raise an error.`,
		ArgNames: []string{"x"},
	}
	log1pDoc = FunctionDoc{
		Summary: "Compute natural log of (1+x)",
		Description: `Values <= -1 return -Inf or NaN. Null values return null.
This function may be more precise than (1 + x) for x close to zero.
Use function "log1p_unchecked" if you want invalid values to return
-Inf or NaN.`,
		ArgNames: []string{"x"},
	}
	logbUncheckedDoc = FunctionDoc{
		Summary: "Compute base `b` logarithm",
		Description: `Values <= 0 return -Inf or NaN. Null values return null.
Use function "logb" if you want non-positive values to raise an error.`,
		ArgNames: []string{"x", "b"},
	}
	logbDoc = FunctionDoc{
		Summary: "Compute base `b` logarithm",
		Description: `Values <= 0 returns an error. Null values return null.
Use function "logb_unchecked" if you want non-positive values to return
-Inf or NaN.`,
		ArgNames: []string{"x", "b"},
	}
	floorDoc = FunctionDoc{
		Summary:     "Round down to the nearest integer",
		Description: "Compute the largest integer value not greater than `x`",
		ArgNames:    []string{"x"},
	}
	ceilDoc = FunctionDoc{
		Summary:     "Round up to the nearest integer",
		Description: "Compute the smallest integer value not less than `x`",
		ArgNames:    []string{"x"},
	}
	truncDoc = FunctionDoc{
		Summary:     "Compute the integral part",
		Description: "Compute the nearest integer not greater than `x`",
		ArgNames:    []string{"x"},
	}
	roundDoc = FunctionDoc{
		Summary: "Round to a given precision",
		Description: `Options are used to control the number of digits and rounding mode.
Default behavior is to round to the nearest integer and
use half-to-even rule to break ties.`,
		ArgNames:    []string{"x"},
		OptionsType: "RoundOptions",
	}
	roundToMultipleDoc = FunctionDoc{
		Summary: "Round to a given multiple",
		Description: `Options are used to control the rounding multiple and rounding mode.
Default behavior is to round to the nearest integer and
use half-to-even rule to break ties.`,
		ArgNames:    []string{"x"},
		OptionsType: "RoundToMultipleOptions",
	}
)

func RegisterScalarArithmetic(reg FunctionRegistry) {
	ops := []struct {
		funcName   string
		op         kernels.ArithmeticOp
		decPromote decimalPromotion
		doc        FunctionDoc
	}{
		{"add_unchecked", kernels.OpAdd, decPromoteAdd, addUncheckedDoc},
		{"add", kernels.OpAddChecked, decPromoteAdd, addDoc},
	}

	for _, o := range ops {
		fn := &arithmeticFunction{*NewScalarFunction(o.funcName, Binary(), o.doc), o.decPromote}
		kns := append(kernels.GetArithmeticBinaryKernels(o.op), kernels.GetDecimalBinaryKernels(o.op)...)
		kns = append(kns, kernels.GetArithmeticFunctionTimeDuration(o.op)...)
		for _, k := range kns {
			if err := fn.AddKernel(k); err != nil {
				panic(err)
			}
		}

		for _, unit := range arrow.TimeUnitValues {
			inType := exec.NewMatchedInput(exec.TimestampTypeUnit(unit))
			inDuration := exec.NewExactInput(&arrow.DurationType{Unit: unit})
			ex := kernels.ArithmeticExecSameType(arrow.TIMESTAMP, o.op)
			err := fn.AddNewKernel([]exec.InputType{inType, inDuration}, kernels.OutputFirstType, ex, nil)
			if err != nil {
				panic(err)
			}
			err = fn.AddNewKernel([]exec.InputType{inDuration, inType}, kernels.OutputLastType, ex, nil)
			if err != nil {
				panic(err)
			}

			matchDur := exec.NewMatchedInput(exec.DurationTypeUnit(unit))
			ex = kernels.ArithmeticExecSameType(arrow.DURATION, o.op)
			err = fn.AddNewKernel([]exec.InputType{matchDur, matchDur}, exec.NewOutputType(&arrow.DurationType{Unit: unit}), ex, nil)
			if err != nil {
				panic(err)
			}
		}

		reg.AddFunction(fn, false)
	}

	ops = []struct {
		funcName   string
		op         kernels.ArithmeticOp
		decPromote decimalPromotion
		doc        FunctionDoc
	}{
		{"sub_unchecked", kernels.OpSub, decPromoteAdd, subUncheckedDoc},
		{"sub", kernels.OpSubChecked, decPromoteAdd, subDoc},
		{"subtract_unchecked", kernels.OpSub, decPromoteAdd, subUncheckedDoc},
		{"subtract", kernels.OpSubChecked, decPromoteAdd, subDoc},
	}

	for _, o := range ops {
		fn := &arithmeticFunction{*NewScalarFunction(o.funcName, Binary(), o.doc), o.decPromote}
		kns := append(kernels.GetArithmeticBinaryKernels(o.op), kernels.GetDecimalBinaryKernels(o.op)...)
		kns = append(kns, kernels.GetArithmeticFunctionTimeDuration(o.op)...)
		for _, k := range kns {
			if err := fn.AddKernel(k); err != nil {
				panic(err)
			}
		}

		for _, unit := range arrow.TimeUnitValues {
			// timestamp - timestamp => duration
			inType := exec.NewMatchedInput(exec.TimestampTypeUnit(unit))
			ex := kernels.ArithmeticExecSameType(arrow.TIMESTAMP, o.op)
			err := fn.AddNewKernel([]exec.InputType{inType, inType}, kernels.OutputResolveTemporal, ex, nil)
			if err != nil {
				panic(err)
			}

			// timestamp - duration => timestamp
			inDuration := exec.NewExactInput(&arrow.DurationType{Unit: unit})
			ex = kernels.ArithmeticExecSameType(arrow.TIMESTAMP, o.op)
			err = fn.AddNewKernel([]exec.InputType{inType, inDuration}, kernels.OutputFirstType, ex, nil)
			if err != nil {
				panic(err)
			}

			// duration - duration = duration
			matchDur := exec.NewMatchedInput(exec.DurationTypeUnit(unit))
			ex = kernels.ArithmeticExecSameType(arrow.DURATION, o.op)
			err = fn.AddNewKernel([]exec.InputType{matchDur, matchDur}, exec.NewOutputType(&arrow.DurationType{Unit: unit}), ex, nil)
			if err != nil {
				panic(err)
			}
		}

		// time32 - time32 = duration
		for _, unit := range []arrow.TimeUnit{arrow.Second, arrow.Millisecond} {
			inType := exec.NewMatchedInput(exec.Time32TypeUnit(unit))
			internalEx := kernels.ArithmeticExecSameType(arrow.TIME32, o.op)
			ex := func(ctx *exec.KernelCtx, batch *exec.ExecSpan, out *exec.ExecResult) error {
				if err := internalEx(ctx, batch, out); err != nil {
					return err
				}
				// the allocated space is for duration (an int64) but we
				// wrote the time32 - time32 as if the output was time32
				// so a quick copy in reverse expands the int32s to int64.
				rawData := arrow.GetData[int32](out.Buffers[1].Buf)
				outData := arrow.GetData[int64](out.Buffers[1].Buf)

				for i := out.Len - 1; i >= 0; i-- {
					outData[i] = int64(rawData[i])
				}
				return nil
			}

			err := fn.AddNewKernel([]exec.InputType{inType, inType},
				exec.NewOutputType(&arrow.DurationType{Unit: unit}), ex, nil)
			if err != nil {
				panic(err)
			}
		}

		// time64 - time64 = duration
		for _, unit := range []arrow.TimeUnit{arrow.Microsecond, arrow.Nanosecond} {
			inType := exec.NewMatchedInput(exec.Time64TypeUnit(unit))
			ex := kernels.ArithmeticExecSameType(arrow.TIME64, o.op)
			err := fn.AddNewKernel([]exec.InputType{inType, inType}, exec.NewOutputType(&arrow.DurationType{Unit: unit}), ex, nil)
			if err != nil {
				panic(err)
			}
		}

		inDate32 := exec.NewExactInput(arrow.FixedWidthTypes.Date32)
		ex := kernels.SubtractDate32(o.op)
		err := fn.AddNewKernel([]exec.InputType{inDate32, inDate32}, exec.NewOutputType(arrow.FixedWidthTypes.Duration_s), ex, nil)
		if err != nil {
			panic(err)
		}

		inDate64 := exec.NewExactInput(arrow.FixedWidthTypes.Date64)
		ex = kernels.ArithmeticExecSameType(arrow.DATE64, o.op)
		err = fn.AddNewKernel([]exec.InputType{inDate64, inDate64}, exec.NewOutputType(arrow.FixedWidthTypes.Duration_ms), ex, nil)
		if err != nil {
			panic(err)
		}

		reg.AddFunction(fn, false)
	}

	oplist := []struct {
		funcName    string
		op          kernels.ArithmeticOp
		decPromote  decimalPromotion
		doc         FunctionDoc
		commutative bool
	}{
		{"multiply_unchecked", kernels.OpMul, decPromoteMultiply, mulUncheckedDoc, true},
		{"multiply", kernels.OpMulChecked, decPromoteMultiply, mulDoc, true},
		{"divide_unchecked", kernels.OpDiv, decPromoteDivide, divUncheckedDoc, false},
		{"divide", kernels.OpDivChecked, decPromoteDivide, divDoc, false},
	}

	for _, o := range oplist {
		fn := &arithmeticFunction{*NewScalarFunction(o.funcName, Binary(), o.doc), o.decPromote}
		for _, k := range append(kernels.GetArithmeticBinaryKernels(o.op), kernels.GetDecimalBinaryKernels(o.op)...) {
			if err := fn.AddKernel(k); err != nil {
				panic(err)
			}
		}

		for _, unit := range arrow.TimeUnitValues {
			durInput := exec.NewExactInput(&arrow.DurationType{Unit: unit})
			i64Input := exec.NewExactInput(arrow.PrimitiveTypes.Int64)
			durOutput := exec.NewOutputType(&arrow.DurationType{Unit: unit})
			ex := kernels.ArithmeticExecSameType(arrow.DURATION, o.op)
			err := fn.AddNewKernel([]exec.InputType{durInput, i64Input}, durOutput, ex, nil)
			if err != nil {
				panic(err)
			}
			if o.commutative {
				err = fn.AddNewKernel([]exec.InputType{i64Input, durInput}, durOutput, ex, nil)
				if err != nil {
					panic(err)
				}
			}
		}

		reg.AddFunction(fn, false)
	}

	ops = []struct {
		funcName   string
		op         kernels.ArithmeticOp
		decPromote decimalPromotion
		doc        FunctionDoc
	}{
		{"abs_unchecked", kernels.OpAbsoluteValue, decPromoteNone, absoluteValueUncheckedDoc},
		{"abs", kernels.OpAbsoluteValueChecked, decPromoteNone, absoluteValueDoc},
		{"negate_unchecked", kernels.OpNegate, decPromoteNone, negateUncheckedDoc},
	}

	for _, o := range ops {
		fn := &arithmeticFunction{*NewScalarFunction(o.funcName, Unary(), o.doc), decPromoteNone}
		kns := append(kernels.GetArithmeticUnaryKernels(o.op), kernels.GetDecimalUnaryKernels(o.op)...)
		for _, k := range kns {
			if err := fn.AddKernel(k); err != nil {
				panic(err)
			}
		}

		reg.AddFunction(fn, false)
	}

	fn := &arithmeticFunction{*NewScalarFunction("negate", Unary(), negateDoc), decPromoteNone}
	kns := append(kernels.GetArithmeticUnarySignedKernels(kernels.OpNegateChecked), kernels.GetDecimalUnaryKernels(kernels.OpNegateChecked)...)
	for _, k := range kns {
		if err := fn.AddKernel(k); err != nil {
			panic(err)
		}
	}

	reg.AddFunction(fn, false)

	ops = []struct {
		funcName   string
		op         kernels.ArithmeticOp
		decPromote decimalPromotion
		doc        FunctionDoc
	}{
		{"sqrt_unchecked", kernels.OpSqrt, decPromoteNone, sqrtUncheckedDoc},
		{"sqrt", kernels.OpSqrtChecked, decPromoteNone, sqrtDoc},
		{"sin_unchecked", kernels.OpSin, decPromoteNone, sinUncheckedDoc},
		{"sin", kernels.OpSinChecked, decPromoteNone, sinDoc},
		{"cos_unchecked", kernels.OpCos, decPromoteNone, cosUncheckedDoc},
		{"cos", kernels.OpCosChecked, decPromoteNone, cosDoc},
		{"tan_unchecked", kernels.OpTan, decPromoteNone, tanUncheckedDoc},
		{"tan", kernels.OpTanChecked, decPromoteNone, tanDoc},
		{"asin_unchecked", kernels.OpAsin, decPromoteNone, asinUncheckedDoc},
		{"asin", kernels.OpAsinChecked, decPromoteNone, asinDoc},
		{"acos_unchecked", kernels.OpAcos, decPromoteNone, acosUncheckedDoc},
		{"acos", kernels.OpAcosChecked, decPromoteNone, acosDoc},
		{"atan", kernels.OpAtan, decPromoteNone, atanDoc},
		{"ln_unchecked", kernels.OpLn, decPromoteNone, lnUncheckedDoc},
		{"ln", kernels.OpLnChecked, decPromoteNone, lnDoc},
		{"log10_unchecked", kernels.OpLog10, decPromoteNone, log10UncheckedDoc},
		{"log10", kernels.OpLog10Checked, decPromoteNone, log10Doc},
		{"log2_unchecked", kernels.OpLog2, decPromoteNone, log2UncheckedDoc},
		{"log2", kernels.OpLog2Checked, decPromoteNone, log2Doc},
		{"log1p_unchecked", kernels.OpLog1p, decPromoteNone, log1pUncheckedDoc},
		{"log1p", kernels.OpLog1pChecked, decPromoteNone, log1pDoc},
	}

	for _, o := range ops {
		fn := &arithmeticFloatingPointFunc{arithmeticFunction{*NewScalarFunction(o.funcName, Unary(), o.doc), decPromoteNone}}
		kns := kernels.GetArithmeticUnaryFloatingPointKernels(o.op)
		for _, k := range kns {
			if err := fn.AddKernel(k); err != nil {
				panic(err)
			}
		}

		reg.AddFunction(fn, false)
	}

	ops = []struct {
		funcName   string
		op         kernels.ArithmeticOp
		decPromote decimalPromotion
		doc        FunctionDoc
	}{
		{"atan2", kernels.OpAtan2, decPromoteNone, atan2Doc},
		{"logb_unchecked", kernels.OpLogb, decPromoteNone, logbUncheckedDoc},
		{"logb", kernels.OpLogbChecked, decPromoteNone, logbDoc},
	}

	for _, o := range ops {
		fn := &arithmeticFloatingPointFunc{arithmeticFunction{*NewScalarFunction(o.funcName, Binary(), addDoc), decPromoteNone}}
		kns := kernels.GetArithmeticFloatingPointKernels(o.op)
		for _, k := range kns {
			if err := fn.AddKernel(k); err != nil {
				panic(err)
			}
		}

		reg.AddFunction(fn, false)
	}

	fn = &arithmeticFunction{*NewScalarFunction("sign", Unary(), signDoc), decPromoteNone}
	kns = kernels.GetArithmeticUnaryFixedIntOutKernels(arrow.PrimitiveTypes.Int8, kernels.OpSign)
	for _, k := range kns {
		if err := fn.AddKernel(k); err != nil {
			panic(err)
		}
	}

	reg.AddFunction(fn, false)

	ops = []struct {
		funcName   string
		op         kernels.ArithmeticOp
		decPromote decimalPromotion
		doc        FunctionDoc
	}{
		{"power_unchecked", kernels.OpPower, decPromoteNone, powUncheckedDoc},
		{"power", kernels.OpPowerChecked, decPromoteNone, powDoc},
	}

	for _, o := range ops {
		fn := &arithmeticDecimalToFloatingPointFunc{arithmeticFunction{*NewScalarFunction(o.funcName, Binary(), o.doc), o.decPromote}}
		kns := kernels.GetArithmeticBinaryKernels(o.op)
		for _, k := range kns {
			if err := fn.AddKernel(k); err != nil {
				panic(err)
			}
		}
		reg.AddFunction(fn, false)
	}

	bitWiseOps := []struct {
		funcName string
		op       kernels.BitwiseOp
		doc      FunctionDoc
	}{
		{"bit_wise_and", kernels.OpBitAnd, bitWiseAndDoc},
		{"bit_wise_or", kernels.OpBitOr, bitWiseOrDoc},
		{"bit_wise_xor", kernels.OpBitXor, bitWiseXorDoc},
	}

	for _, o := range bitWiseOps {
		fn := &arithmeticFunction{*NewScalarFunction(o.funcName, Binary(), o.doc), decPromoteNone}
		kns := kernels.GetBitwiseBinaryKernels(o.op)
		for _, k := range kns {
			if err := fn.AddKernel(k); err != nil {
				panic(err)
			}
		}
		reg.AddFunction(fn, false)
	}

	fn = &arithmeticFunction{*NewScalarFunction("bit_wise_not", Unary(), bitWiseNotDoc), decPromoteNone}
	for _, k := range kernels.GetBitwiseUnaryKernels() {
		if err := fn.AddKernel(k); err != nil {
			panic(err)
		}
	}

	reg.AddFunction(fn, false)

	shiftOps := []struct {
		funcName string
		dir      kernels.ShiftDir
		checked  bool
		doc      FunctionDoc
	}{
		{"shift_left", kernels.ShiftLeft, true, shiftLeftDoc},
		{"shift_left_unchecked", kernels.ShiftLeft, false, shiftLeftUncheckedDoc},
		{"shift_right", kernels.ShiftRight, true, shiftRightDoc},
		{"shift_right_unchecked", kernels.ShiftRight, false, shiftRightUncheckedDoc},
	}

	for _, o := range shiftOps {
		fn := &arithmeticFunction{*NewScalarFunction(o.funcName, Binary(), o.doc), decPromoteNone}
		kns := kernels.GetShiftKernels(o.dir, o.checked)
		for _, k := range kns {
			if err := fn.AddKernel(k); err != nil {
				panic(err)
			}
		}
		reg.AddFunction(fn, false)
	}

	floorFn := &arithmeticIntegerToFloatingPointFunc{arithmeticFunction{*NewScalarFunction("floor", Unary(), floorDoc), decPromoteNone}}
	kns = kernels.GetSimpleRoundKernels(kernels.RoundDown)
	for _, k := range kns {
		if err := floorFn.AddKernel(k); err != nil {
			panic(err)
		}
	}
	floorFn.AddNewKernel([]exec.InputType{exec.NewIDInput(arrow.DECIMAL128)},
		kernels.OutputFirstType, kernels.FixedRoundDecimalExec[decimal128.Num](kernels.RoundDown), nil)
	floorFn.AddNewKernel([]exec.InputType{exec.NewIDInput(arrow.DECIMAL256)},
		kernels.OutputFirstType, kernels.FixedRoundDecimalExec[decimal256.Num](kernels.RoundDown), nil)
	reg.AddFunction(floorFn, false)

	ceilFn := &arithmeticIntegerToFloatingPointFunc{arithmeticFunction{*NewScalarFunction("ceil", Unary(), ceilDoc), decPromoteNone}}
	kns = kernels.GetSimpleRoundKernels(kernels.RoundUp)
	for _, k := range kns {
		if err := ceilFn.AddKernel(k); err != nil {
			panic(err)
		}
	}
	ceilFn.AddNewKernel([]exec.InputType{exec.NewIDInput(arrow.DECIMAL128)},
		kernels.OutputFirstType, kernels.FixedRoundDecimalExec[decimal128.Num](kernels.RoundUp), nil)
	ceilFn.AddNewKernel([]exec.InputType{exec.NewIDInput(arrow.DECIMAL256)},
		kernels.OutputFirstType, kernels.FixedRoundDecimalExec[decimal256.Num](kernels.RoundUp), nil)
	reg.AddFunction(ceilFn, false)

	truncFn := &arithmeticIntegerToFloatingPointFunc{arithmeticFunction{*NewScalarFunction("trunc", Unary(), truncDoc), decPromoteNone}}
	kns = kernels.GetSimpleRoundKernels(kernels.TowardsZero)
	for _, k := range kns {
		if err := truncFn.AddKernel(k); err != nil {
			panic(err)
		}
	}
	truncFn.AddNewKernel([]exec.InputType{exec.NewIDInput(arrow.DECIMAL128)},
		kernels.OutputFirstType, kernels.FixedRoundDecimalExec[decimal128.Num](kernels.TowardsZero), nil)
	truncFn.AddNewKernel([]exec.InputType{exec.NewIDInput(arrow.DECIMAL256)},
		kernels.OutputFirstType, kernels.FixedRoundDecimalExec[decimal256.Num](kernels.TowardsZero), nil)
	reg.AddFunction(truncFn, false)

	roundFn := &arithmeticIntegerToFloatingPointFunc{arithmeticFunction{*NewScalarFunction("round", Unary(), roundDoc), decPromoteNone}}
	kns = kernels.GetRoundUnaryKernels(kernels.InitRoundState, kernels.UnaryRoundExec)
	for _, k := range kns {
		if err := roundFn.AddKernel(k); err != nil {
			panic(err)
		}
	}

	roundFn.defaultOpts = DefaultRoundOptions
	reg.AddFunction(roundFn, false)

	roundToMultipleFn := &arithmeticIntegerToFloatingPointFunc{arithmeticFunction{*NewScalarFunction("round_to_multiple", Unary(), roundToMultipleDoc), decPromoteNone}}
	kns = kernels.GetRoundUnaryKernels(kernels.InitRoundToMultipleState, kernels.UnaryRoundToMultipleExec)
	for _, k := range kns {
		if err := roundToMultipleFn.AddKernel(k); err != nil {
			panic(err)
		}
	}

	roundToMultipleFn.defaultOpts = DefaultRoundToMultipleOptions
	reg.AddFunction(roundToMultipleFn, false)
}

func impl(ctx context.Context, fn string, opts ArithmeticOptions, left, right Datum) (Datum, error) {
	if opts.NoCheckOverflow {
		fn += "_unchecked"
	}
	return CallFunction(ctx, fn, nil, left, right)
}

// Add performs an addition between the passed in arguments (scalar or array)
// and returns the result. If one argument is a scalar and the other is an
// array, the scalar value is added to each value of the array.
//
// ArithmeticOptions specifies whether or not to check for overflows,
// performance is faster if not explicitly checking for overflows but
// will error on an overflow if NoCheckOverflow is false (default).
func Add(ctx context.Context, opts ArithmeticOptions, left, right Datum) (Datum, error) {
	return impl(ctx, "add", opts, left, right)
}

// Sub performs a subtraction between the passed in arguments (scalar or array)
// and returns the result. If one argument is a scalar and the other is an
// array, the scalar value is subtracted from each value of the array.
//
// ArithmeticOptions specifies whether or not to check for overflows,
// performance is faster if not explicitly checking for overflows but
// will error on an overflow if NoCheckOverflow is false (default).
func Subtract(ctx context.Context, opts ArithmeticOptions, left, right Datum) (Datum, error) {
	return impl(ctx, "sub", opts, left, right)
}

// Multiply performs a multiplication between the passed in arguments (scalar or array)
// and returns the result. If one argument is a scalar and the other is an
// array, the scalar value is multiplied against each value of the array.
//
// ArithmeticOptions specifies whether or not to check for overflows,
// performance is faster if not explicitly checking for overflows but
// will error on an overflow if NoCheckOverflow is false (default).
func Multiply(ctx context.Context, opts ArithmeticOptions, left, right Datum) (Datum, error) {
	return impl(ctx, "multiply", opts, left, right)
}

// Divide performs a division between the passed in arguments (scalar or array)
// and returns the result. If one argument is a scalar and the other is an
// array, the scalar value is used with each value of the array.
//
// ArithmeticOptions specifies whether or not to check for overflows,
// performance is faster if not explicitly checking for overflows but
// will error on an overflow if NoCheckOverflow is false (default).
//
// Will error on divide by zero regardless of whether or not checking for
// overflows.
func Divide(ctx context.Context, opts ArithmeticOptions, left, right Datum) (Datum, error) {
	return impl(ctx, "divide", opts, left, right)
}

// AbsoluteValue returns the AbsoluteValue for each element in the input
// argument. It accepts either a scalar or an array.
//
// ArithmeticOptions specifies whether or not to check for overflows,
// performance is faster if not explicitly checking for overflows but
// will error on an overflow if CheckOverflow is true.
func AbsoluteValue(ctx context.Context, opts ArithmeticOptions, input Datum) (Datum, error) {
	fn := "abs"
	if opts.NoCheckOverflow {
		fn += "_unchecked"
	}
	return CallFunction(ctx, fn, nil, input)
}

// Negate returns a result containing the negation of each element in the
// input argument. It accepts either a scalar or an array.
//
// ArithmeticOptions specifies whether or not to check for overflows,
// or to throw an error on unsigned types.
func Negate(ctx context.Context, opts ArithmeticOptions, input Datum) (Datum, error) {
	fn := "negate"
	if opts.NoCheckOverflow {
		fn += "_unchecked"
	}
	return CallFunction(ctx, fn, nil, input)
}

// Sign returns -1, 0, or 1 depending on the sign of each element in the
// input. For x in the input:
//
//		if x > 0: 1
//		if x < 0: -1
//	    if x == 0: 0
func Sign(ctx context.Context, input Datum) (Datum, error) {
	return CallFunction(ctx, "sign", nil, input)
}

// Power returns base**exp for each element in the input arrays. Should work
// for both Arrays and Scalars
func Power(ctx context.Context, opts ArithmeticOptions, base, exp Datum) (Datum, error) {
	fn := "power"
	if opts.NoCheckOverflow {
		fn += "_unchecked"
	}
	return CallFunction(ctx, fn, nil, base, exp)
}

// ShiftLeft only accepts integral types and shifts each element of the
// first argument to the left by the value of the corresponding element
// in the second argument.
//
// The value to shift by should be >= 0 and < precision of the type.
func ShiftLeft(ctx context.Context, opts ArithmeticOptions, lhs, rhs Datum) (Datum, error) {
	fn := "shift_left"
	if opts.NoCheckOverflow {
		fn += "_unchecked"
	}
	return CallFunction(ctx, fn, nil, lhs, rhs)
}

// ShiftRight only accepts integral types and shifts each element of the
// first argument to the right by the value of the corresponding element
// in the second argument.
//
// The value to shift by should be >= 0 and < precision of the type.
func ShiftRight(ctx context.Context, opts ArithmeticOptions, lhs, rhs Datum) (Datum, error) {
	fn := "shift_right"
	if opts.NoCheckOverflow {
		fn += "_unchecked"
	}
	return CallFunction(ctx, fn, nil, lhs, rhs)
}

func Sin(ctx context.Context, opts ArithmeticOptions, arg Datum) (Datum, error) {
	fn := "sin"
	if opts.NoCheckOverflow {
		fn += "_unchecked"
	}
	return CallFunction(ctx, fn, nil, arg)
}

func Cos(ctx context.Context, opts ArithmeticOptions, arg Datum) (Datum, error) {
	fn := "cos"
	if opts.NoCheckOverflow {
		fn += "_unchecked"
	}
	return CallFunction(ctx, fn, nil, arg)
}

func Tan(ctx context.Context, opts ArithmeticOptions, arg Datum) (Datum, error) {
	fn := "tan"
	if opts.NoCheckOverflow {
		fn += "_unchecked"
	}
	return CallFunction(ctx, fn, nil, arg)
}

func Asin(ctx context.Context, opts ArithmeticOptions, arg Datum) (Datum, error) {
	fn := "asin"
	if opts.NoCheckOverflow {
		fn += "_unchecked"
	}
	return CallFunction(ctx, fn, nil, arg)
}

func Acos(ctx context.Context, opts ArithmeticOptions, arg Datum) (Datum, error) {
	fn := "acos"
	if opts.NoCheckOverflow {
		fn += "_unchecked"
	}
	return CallFunction(ctx, fn, nil, arg)
}

func Atan(ctx context.Context, arg Datum) (Datum, error) {
	return CallFunction(ctx, "atan", nil, arg)
}

func Atan2(ctx context.Context, x, y Datum) (Datum, error) {
	return CallFunction(ctx, "atan2", nil, x, y)
}

func Ln(ctx context.Context, opts ArithmeticOptions, arg Datum) (Datum, error) {
	fn := "ln"
	if opts.NoCheckOverflow {
		fn += "_unchecked"
	}
	return CallFunction(ctx, fn, nil, arg)
}

func Log10(ctx context.Context, opts ArithmeticOptions, arg Datum) (Datum, error) {
	fn := "log10"
	if opts.NoCheckOverflow {
		fn += "_unchecked"
	}
	return CallFunction(ctx, fn, nil, arg)
}

func Log2(ctx context.Context, opts ArithmeticOptions, arg Datum) (Datum, error) {
	fn := "log2"
	if opts.NoCheckOverflow {
		fn += "_unchecked"
	}
	return CallFunction(ctx, fn, nil, arg)
}

func Log1p(ctx context.Context, opts ArithmeticOptions, arg Datum) (Datum, error) {
	fn := "log1p"
	if opts.NoCheckOverflow {
		fn += "_unchecked"
	}
	return CallFunction(ctx, fn, nil, arg)
}

func Logb(ctx context.Context, opts ArithmeticOptions, x, base Datum) (Datum, error) {
	fn := "logb"
	if opts.NoCheckOverflow {
		fn += "_unchecked"
	}
	return CallFunction(ctx, fn, nil, x, base)
}

func Round(ctx context.Context, opts RoundOptions, arg Datum) (Datum, error) {
	return CallFunction(ctx, "round", &opts, arg)
}

func RoundToMultiple(ctx context.Context, opts RoundToMultipleOptions, arg Datum) (Datum, error) {
	return CallFunction(ctx, "round_to_multiple", &opts, arg)
}
