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
	"unsafe"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/bitutil"
	"github.com/apache/arrow-go/v18/arrow/compute/exec"
	"github.com/apache/arrow-go/v18/arrow/internal/debug"
)

const millisecondsInDay = 86400000

func ShiftTime[InT, OutT int32 | int64](ctx *exec.KernelCtx, op arrow.TimestampConvertOp, factor int64, input, output *exec.ArraySpan) error {
	opts := ctx.State.(CastState)
	inData := exec.GetSpanValues[InT](input, 1)
	outData := exec.GetSpanValues[OutT](output, 1)

	switch {
	case factor == 1:
		for i, v := range inData {
			outData[i] = OutT(v)
		}
		return nil

	case op == arrow.ConvMULTIPLY:
		if opts.AllowTimeOverflow {
			multiplyConstant(inData, outData, factor)
			return nil
		}

		maxVal, minVal := math.MaxInt64/factor, math.MinInt64/factor
		if input.Nulls != 0 && len(input.Buffers[0].Buf) > 0 {
			bitReader := bitutil.NewBitmapReader(input.Buffers[0].Buf, int(input.Offset), int(input.Len))
			for i, v := range inData {
				if bitReader.Set() && (int64(v) < minVal || int64(v) > maxVal) {
					return fmt.Errorf("%w: casting from %s to %s would result in out of bounds timestamp: %v",
						arrow.ErrInvalid, input.Type, output.Type, v)
				}
				outData[i] = OutT(v) * OutT(factor)
				bitReader.Next()
			}
			return nil
		}

		for i, v := range inData {
			if int64(v) < minVal || int64(v) > maxVal {
				return fmt.Errorf("%w: casting from %s to %s would result in out of bounds timestamp: %v",
					arrow.ErrInvalid, input.Type, output.Type, v)
			}
			outData[i] = OutT(v) * OutT(factor)
		}
		return nil
	default:
		if opts.AllowTimeTruncate {
			divideConstant(inData, outData, factor)
			return nil
		}

		if input.Nulls != 0 && len(input.Buffers[0].Buf) > 0 {
			bitReader := bitutil.NewBitmapReader(input.Buffers[0].Buf, int(input.Offset), int(input.Len))
			for i, v := range inData {
				outData[i] = OutT(v / InT(factor))
				if bitReader.Set() && (InT(outData[i])*InT(factor) != v) {
					return fmt.Errorf("%w: casting from %s to %s would lose data: %v",
						arrow.ErrInvalid, input.Type, output.Type, v)
				}
				bitReader.Next()
			}
			return nil
		}

		for i, v := range inData {
			outData[i] = OutT(v / InT(factor))
			if InT(outData[i])*InT(factor) != v {
				return fmt.Errorf("%w: casting from %s to %s would lose data: %v",
					arrow.ErrInvalid, input.Type, output.Type, v)
			}
		}

		return nil
	}
}

func TimestampToDate32(ctx *exec.KernelCtx, batch *exec.ExecSpan, out *exec.ExecResult) error {
	inType := batch.Values[0].Array.Type.(*arrow.TimestampType)
	fnToTime, err := inType.GetToTimeFunc()
	if err != nil {
		return fmt.Errorf("%w: %s", arrow.ErrInvalid, err)
	}

	return ScalarUnaryNotNull(func(_ *exec.KernelCtx, arg0 arrow.Timestamp, _ *error) arrow.Date32 {
		tm := fnToTime(arg0)
		if _, offset := tm.Zone(); offset != 0 {
			// normalize the tm
			tm = tm.Add(time.Duration(offset) * time.Second).UTC()
		}
		return arrow.Date32FromTime(tm)
	})(ctx, batch, out)
}

func TimestampToDate64(ctx *exec.KernelCtx, batch *exec.ExecSpan, out *exec.ExecResult) error {
	inType := batch.Values[0].Array.Type.(*arrow.TimestampType)
	fnToTime, err := inType.GetToTimeFunc()
	if err != nil {
		return fmt.Errorf("%w: %s", arrow.ErrInvalid, err)
	}

	return ScalarUnaryNotNull(func(_ *exec.KernelCtx, arg0 arrow.Timestamp, _ *error) arrow.Date64 {
		tm := fnToTime(arg0)
		if _, offset := tm.Zone(); offset != 0 {
			// normalize the tm
			tm = tm.Add(time.Duration(offset) * time.Second).UTC()
		}
		return arrow.Date64FromTime(tm)
	})(ctx, batch, out)
}

func SimpleTemporalCast[I, O arrow.Duration | arrow.Time32 | arrow.Time64 | arrow.Timestamp](ctx *exec.KernelCtx, batch *exec.ExecSpan, out *exec.ExecResult) error {
	var (
		input   = &batch.Values[0].Array
		inType  = input.Type.(arrow.TemporalWithUnit)
		outType = out.Type.(arrow.TemporalWithUnit)
	)

	if inType.TimeUnit() == outType.TimeUnit() && inType.BitWidth() == outType.BitWidth() {
		dt := out.Type
		for i := range out.Buffers {
			if out.Buffers[i].SelfAlloc && out.Buffers[i].Owner != nil {
				out.Buffers[i].Owner.Release()
			}
		}

		*out = *input
		out.Type = dt
		return nil
	}

	op, factor := arrow.GetTimestampConvert(inType.TimeUnit(), outType.TimeUnit())
	inSz := unsafe.Sizeof(I(0))
	outSz := unsafe.Sizeof(O(0))
	switch inSz {
	case 4:
		switch outSz {
		case 4:
			return ShiftTime[int32, int32](ctx, op, factor, input, out)
		default:
			return ShiftTime[int32, int64](ctx, op, factor, input, out)
		}
	default:
		switch outSz {
		case 4:
			return ShiftTime[int64, int32](ctx, op, factor, input, out)
		default:
			return ShiftTime[int64, int64](ctx, op, factor, input, out)
		}
	}
}

func StringToTimestamp[OffsetT int32 | int64](ctx *exec.KernelCtx, batch *exec.ExecSpan, out *exec.ExecResult) error {
	outType := out.Type.(*arrow.TimestampType)
	zn, err := outType.GetZone()
	if err != nil {
		return err
	}

	expectTimezone := outType.TimeZone != ""

	return ScalarUnaryNotNullBinaryArg[arrow.Timestamp, OffsetT](func(_ *exec.KernelCtx, input []byte, err *error) arrow.Timestamp {
		v := *(*string)(unsafe.Pointer(&input))
		o, zonePresent, e := arrow.TimestampFromStringInLocation(v, outType.Unit, zn)
		if e != nil {
			*err = e
		}

		if zonePresent != expectTimezone {
			if expectTimezone {
				*err = fmt.Errorf("%w: failed to parse string '%s' as a value of type %s,"+
					"expected a zone offset. If these timestamps are in local time, cast to timestamp without timezone",
					arrow.ErrInvalid, v, outType)
			} else {
				*err = fmt.Errorf("%w: failed to parse string '%s' as a value of type %s, expected no zone offset",
					arrow.ErrInvalid, v, outType)
			}
		}

		return o
	})(ctx, batch, out)
}

func TimestampToTime32(ctx *exec.KernelCtx, batch *exec.ExecSpan, out *exec.ExecResult) error {
	var (
		inType  = batch.Values[0].Type().(*arrow.TimestampType)
		outType = out.Type.(*arrow.Time32Type)
		opts    = ctx.State.(CastState)
	)

	fnToTime, err := inType.GetToTimeFunc()
	if err != nil {
		return fmt.Errorf("%w: %s", arrow.ErrInvalid, err)
	}

	if inType.TimeZone != "" && inType.TimeZone != "UTC" {
		origFn := fnToTime
		fnToTime = func(t arrow.Timestamp) time.Time {
			v := origFn(t)
			_, offset := v.Zone()
			return v.Add(time.Duration(offset) * time.Second).UTC()
		}
	}

	var fn func(time.Duration, *error) arrow.Time32
	switch outType.Unit {
	case arrow.Second:
		fn = func(d time.Duration, _ *error) arrow.Time32 {
			return arrow.Time32(d.Seconds())
		}
	case arrow.Millisecond:
		fn = func(d time.Duration, _ *error) arrow.Time32 {
			return arrow.Time32(d.Milliseconds())
		}
	default:
		return fmt.Errorf("%w: bad unit type for cast to time32: %s",
			arrow.ErrInvalid, outType.Unit)
	}

	op, factor := arrow.GetTimestampConvert(inType.Unit, outType.Unit)
	if op == arrow.ConvDIVIDE && !opts.AllowTimeTruncate {
		origFn := fn
		switch inType.Unit {
		case arrow.Millisecond:
			fn = func(d time.Duration, err *error) arrow.Time32 {
				v := origFn(d, err)
				if int64(v)*factor != d.Milliseconds() {
					*err = fmt.Errorf("%w: cast would lose data: %d", arrow.ErrInvalid, d.Milliseconds())
				}
				return v
			}
		case arrow.Microsecond:
			fn = func(d time.Duration, err *error) arrow.Time32 {
				v := origFn(d, err)
				if int64(v)*factor != d.Microseconds() {
					*err = fmt.Errorf("%w: cast would lose data: %d", arrow.ErrInvalid, d.Microseconds())
				}
				return v
			}
		case arrow.Nanosecond:
			fn = func(d time.Duration, err *error) arrow.Time32 {
				v := origFn(d, err)
				if int64(v)*factor != d.Nanoseconds() {
					*err = fmt.Errorf("%w: cast would lose data: %d", arrow.ErrInvalid, d.Nanoseconds())
				}
				return v
			}
		}
	}

	return ScalarUnaryNotNull(func(_ *exec.KernelCtx, arg0 arrow.Timestamp, err *error) arrow.Time32 {
		t := fnToTime(arg0)
		dur := t.Sub(t.Truncate(24 * time.Hour))
		return fn(dur, err)
	})(ctx, batch, out)
}

func TimestampToTime64(ctx *exec.KernelCtx, batch *exec.ExecSpan, out *exec.ExecResult) error {
	var (
		inType  = batch.Values[0].Type().(*arrow.TimestampType)
		outType = out.Type.(*arrow.Time64Type)
		opts    = ctx.State.(CastState)
	)

	fnToTime, err := inType.GetToTimeFunc()
	if err != nil {
		return fmt.Errorf("%w: %s", arrow.ErrInvalid, err)
	}

	if inType.TimeZone != "" && inType.TimeZone != "UTC" {
		origFn := fnToTime
		fnToTime = func(t arrow.Timestamp) time.Time {
			v := origFn(t)
			_, offset := v.Zone()
			return v.Add(time.Duration(offset) * time.Second).UTC()
		}
	}

	var fn func(time.Duration, *error) arrow.Time64
	op, _ := arrow.GetTimestampConvert(inType.Unit, outType.Unit)
	if op == arrow.ConvDIVIDE && !opts.AllowTimeTruncate {
		// only one case can happen here, microseconds. nanoseconds
		// wouldn't be a downscale
		fn = func(d time.Duration, err *error) arrow.Time64 {
			if d.Nanoseconds() != d.Microseconds()*int64(time.Microsecond) {
				*err = fmt.Errorf("%w: cast would lose data: %d", arrow.ErrInvalid, d.Nanoseconds())
			}
			return arrow.Time64(d.Microseconds())
		}
	} else {
		switch outType.Unit {
		case arrow.Microsecond:
			fn = func(d time.Duration, _ *error) arrow.Time64 {
				return arrow.Time64(d.Microseconds())
			}
		case arrow.Nanosecond:
			fn = func(d time.Duration, _ *error) arrow.Time64 {
				return arrow.Time64(d.Nanoseconds())
			}
		default:
			return fmt.Errorf("%w: bad unit type for cast to time64: %s",
				arrow.ErrInvalid, outType.Unit)
		}
	}

	return ScalarUnaryNotNull(func(_ *exec.KernelCtx, arg0 arrow.Timestamp, err *error) arrow.Time64 {
		t := fnToTime(arg0)
		dur := t.Sub(t.Truncate(24 * time.Hour))
		return fn(dur, err)
	})(ctx, batch, out)
}

func GetDate32CastKernels() []exec.ScalarKernel {
	outType := exec.NewOutputType(arrow.FixedWidthTypes.Date32)
	out := GetCommonCastKernels(arrow.DATE32, outType)
	out = append(out, GetZeroCastKernel(arrow.INT32, exec.NewExactInput(arrow.PrimitiveTypes.Int32), outType))

	out = append(out, exec.NewScalarKernel(
		[]exec.InputType{exec.NewExactInput(arrow.FixedWidthTypes.Date64)}, outType,
		func(ctx *exec.KernelCtx, input *exec.ExecSpan, out *exec.ExecResult) error {
			return ShiftTime[int64, int32](ctx, arrow.ConvDIVIDE, millisecondsInDay, &input.Values[0].Array, out)
		}, nil))

	out = append(out, exec.NewScalarKernel(
		[]exec.InputType{exec.NewIDInput(arrow.TIMESTAMP)}, outType,
		TimestampToDate32, nil))

	return out
}

func GetDate64CastKernels() []exec.ScalarKernel {
	outType := exec.NewOutputType(arrow.FixedWidthTypes.Date64)
	out := GetCommonCastKernels(arrow.DATE64, outType)
	out = append(out, GetZeroCastKernel(arrow.INT64, exec.NewExactInput(arrow.PrimitiveTypes.Int64), outType))

	out = append(out, exec.NewScalarKernel(
		[]exec.InputType{exec.NewExactInput(arrow.FixedWidthTypes.Date32)}, outType,
		func(ctx *exec.KernelCtx, input *exec.ExecSpan, out *exec.ExecResult) error {
			return ShiftTime[int32, int64](ctx, arrow.ConvMULTIPLY, millisecondsInDay, &input.Values[0].Array, out)
		}, nil))

	out = append(out, exec.NewScalarKernel(
		[]exec.InputType{exec.NewIDInput(arrow.TIMESTAMP)}, outType,
		TimestampToDate64, nil))
	return out
}

func GetTime32CastKernels() []exec.ScalarKernel {
	out := GetCommonCastKernels(arrow.TIME32, OutputTargetType)
	out = append(out, GetZeroCastKernel(arrow.INT32, exec.NewExactInput(arrow.PrimitiveTypes.Int32), OutputTargetType))

	out = append(out, exec.NewScalarKernel(
		[]exec.InputType{exec.NewIDInput(arrow.TIME64)}, OutputTargetType,
		SimpleTemporalCast[arrow.Time64, arrow.Time32], nil))
	out = append(out, exec.NewScalarKernel(
		[]exec.InputType{exec.NewIDInput(arrow.TIME32)}, OutputTargetType,
		SimpleTemporalCast[arrow.Time32, arrow.Time32], nil))
	out = append(out, exec.NewScalarKernel(
		[]exec.InputType{exec.NewIDInput(arrow.TIMESTAMP)}, OutputTargetType,
		TimestampToTime32, nil))

	return out
}

func GetTime64CastKernels() []exec.ScalarKernel {
	out := GetCommonCastKernels(arrow.TIME64, OutputTargetType)
	out = append(out, GetZeroCastKernel(arrow.INT64, exec.NewExactInput(arrow.PrimitiveTypes.Int64), OutputTargetType))

	out = append(out, exec.NewScalarKernel(
		[]exec.InputType{exec.NewIDInput(arrow.TIME64)}, OutputTargetType,
		SimpleTemporalCast[arrow.Time64, arrow.Time64], nil))
	out = append(out, exec.NewScalarKernel(
		[]exec.InputType{exec.NewIDInput(arrow.TIME32)}, OutputTargetType,
		SimpleTemporalCast[arrow.Time32, arrow.Time64], nil))
	out = append(out, exec.NewScalarKernel(
		[]exec.InputType{exec.NewIDInput(arrow.TIMESTAMP)}, OutputTargetType,
		TimestampToTime64, nil))

	return out
}

func GetDurationCastKernels() []exec.ScalarKernel {
	out := GetCommonCastKernels(arrow.DURATION, OutputTargetType)
	out = append(out, GetZeroCastKernel(arrow.INT64,
		exec.NewExactInput(arrow.PrimitiveTypes.Int64), OutputTargetType))

	out = append(out, exec.NewScalarKernel(
		[]exec.InputType{exec.NewIDInput(arrow.DURATION)}, OutputTargetType,
		SimpleTemporalCast[arrow.Duration, arrow.Duration], nil))
	return out
}

func GetIntervalCastKernels() []exec.ScalarKernel {
	return GetCommonCastKernels(arrow.INTERVAL_MONTH_DAY_NANO, OutputTargetType)
}

func GetTimestampCastKernels() []exec.ScalarKernel {
	out := GetCommonCastKernels(arrow.TIMESTAMP, OutputTargetType)

	// same integer representation
	out = append(out, GetZeroCastKernel(arrow.INT64, exec.NewExactInput(arrow.PrimitiveTypes.Int64), OutputTargetType))
	out = append(out, exec.NewScalarKernel(
		[]exec.InputType{exec.NewIDInput(arrow.DATE32)}, OutputTargetType,
		func(ctx *exec.KernelCtx, input *exec.ExecSpan, out *exec.ExecResult) error {
			op, factor := arrow.GetTimestampConvert(arrow.Second, out.Type.(arrow.TemporalWithUnit).TimeUnit())
			debug.Assert(op == arrow.ConvMULTIPLY, "date32 -> timestamp should be multiply operation")

			// multiply to achieve days -> unit
			factor *= millisecondsInDay / 1000
			return ShiftTime[int32, int64](ctx, op, factor, &input.Values[0].Array, out)
		}, nil))
	out = append(out, exec.NewScalarKernel(
		[]exec.InputType{exec.NewIDInput(arrow.DATE64)}, OutputTargetType,
		func(ctx *exec.KernelCtx, input *exec.ExecSpan, out *exec.ExecResult) error {
			// date64 is ms since epoch
			op, factor := arrow.GetTimestampConvert(arrow.Millisecond, out.Type.(arrow.TemporalWithUnit).TimeUnit())
			debug.Assert(op == arrow.ConvMULTIPLY, "date64 -> timestamp should be multiply operation")

			return ShiftTime[int64, int64](ctx, op, factor, &input.Values[0].Array, out)
		}, nil))

	// string -> timestamp
	out = append(out, exec.NewScalarKernel(
		[]exec.InputType{exec.NewExactInput(arrow.BinaryTypes.String)}, OutputTargetType,
		StringToTimestamp[int32], nil))
	// large_string -> timestamp
	out = append(out, exec.NewScalarKernel(
		[]exec.InputType{exec.NewExactInput(arrow.BinaryTypes.LargeString)}, OutputTargetType,
		StringToTimestamp[int64], nil))
	// from one timestamp to another
	out = append(out, exec.NewScalarKernel(
		[]exec.InputType{exec.NewIDInput(arrow.TIMESTAMP)}, OutputTargetType,
		SimpleTemporalCast[arrow.Timestamp, arrow.Timestamp], nil))
	return out
}
