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
	"sync"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/array"
	"github.com/apache/arrow-go/v18/arrow/bitutil"
	"github.com/apache/arrow-go/v18/arrow/compute/exec"
	"github.com/apache/arrow-go/v18/arrow/compute/internal/kernels"
)

var (
	castTable map[arrow.Type]*castFunction
	castInit  sync.Once

	castDoc = FunctionDoc{
		Summary:         "cast values to another data type",
		Description:     "Behavior when values wouldn't fit in the target type\ncan be controlled through CastOptions.",
		ArgNames:        []string{"input"},
		OptionsType:     "CastOptions",
		OptionsRequired: true,
	}
	castMetaFunc = NewMetaFunction("cast", Unary(), castDoc,
		func(ctx context.Context, fo FunctionOptions, d ...Datum) (Datum, error) {
			castOpts := fo.(*CastOptions)
			if castOpts == nil || castOpts.ToType == nil {
				return nil, fmt.Errorf("%w: cast requires that options be passed with a ToType", arrow.ErrInvalid)
			}

			if arrow.TypeEqual(d[0].(ArrayLikeDatum).Type(), castOpts.ToType) {
				return NewDatum(d[0]), nil
			}

			fn, err := getCastFunction(castOpts.ToType)
			if err != nil {
				return nil, fmt.Errorf("%w from %s", err, d[0].(ArrayLikeDatum).Type())
			}

			return fn.Execute(ctx, fo, d...)
		})
)

func RegisterScalarCast(reg FunctionRegistry) {
	reg.AddFunction(castMetaFunc, false)
}

type castFunction struct {
	ScalarFunction

	inIDs []arrow.Type
	out   arrow.Type
}

func newCastFunction(name string, outType arrow.Type) *castFunction {
	return &castFunction{
		ScalarFunction: *NewScalarFunction(name, Unary(), EmptyFuncDoc),
		out:            outType,
		inIDs:          make([]arrow.Type, 0, 1),
	}
}

func (cf *castFunction) AddTypeCast(in arrow.Type, kernel exec.ScalarKernel) error {
	kernel.Init = exec.OptionsInit[kernels.CastState]
	if err := cf.AddKernel(kernel); err != nil {
		return err
	}
	cf.inIDs = append(cf.inIDs, in)
	return nil
}

func (cf *castFunction) AddNewTypeCast(inID arrow.Type, inTypes []exec.InputType, out exec.OutputType,
	ex exec.ArrayKernelExec, nullHandle exec.NullHandling, memAlloc exec.MemAlloc) error {

	kn := exec.NewScalarKernel(inTypes, out, ex, nil)
	kn.NullHandling = nullHandle
	kn.MemAlloc = memAlloc
	return cf.AddTypeCast(inID, kn)
}

func (cf *castFunction) DispatchExact(vals ...arrow.DataType) (exec.Kernel, error) {
	if err := cf.checkArity(len(vals)); err != nil {
		return nil, err
	}

	candidates := make([]*exec.ScalarKernel, 0, 1)
	for i := range cf.kernels {
		if cf.kernels[i].Signature.MatchesInputs(vals) {
			candidates = append(candidates, &cf.kernels[i])
		}
	}

	if len(candidates) == 0 {
		return nil, fmt.Errorf("%w: unsupported cast from %s to %s using function %s",
			arrow.ErrNotImplemented, vals[0], cf.out, cf.name)
	}

	if len(candidates) == 1 {
		// one match!
		return candidates[0], nil
	}

	// in this situation we may have both an EXACT type and
	// a SAME_TYPE_ID match. So we will see if there is an exact
	// match among the candidates and if not, we just return the
	// first one
	for _, k := range candidates {
		arg0 := k.Signature.InputTypes[0]
		if arg0.Kind == exec.InputExact {
			// found one!
			return k, nil
		}
	}

	// just return some kernel that matches since we didn't find an exact
	return candidates[0], nil
}

func unpackDictionary(ctx *exec.KernelCtx, batch *exec.ExecSpan, out *exec.ExecResult) error {
	var (
		dictArr  = batch.Values[0].Array.MakeArray().(*array.Dictionary)
		opts     = ctx.State.(kernels.CastState)
		dictType = dictArr.DataType().(*arrow.DictionaryType)
		toType   = opts.ToType
	)
	defer dictArr.Release()

	if !arrow.TypeEqual(toType, dictType) && !CanCast(dictType, toType) {
		return fmt.Errorf("%w: cast type %s incompatible with dictionary type %s",
			arrow.ErrInvalid, toType, dictType)
	}

	unpacked, err := TakeArray(ctx.Ctx, dictArr.Dictionary(), dictArr.Indices())
	if err != nil {
		return err
	}
	defer unpacked.Release()

	if !arrow.TypeEqual(dictType, toType) {
		unpacked, err = CastArray(ctx.Ctx, unpacked, &opts)
		if err != nil {
			return err
		}
		defer unpacked.Release()
	}

	out.TakeOwnership(unpacked.Data())
	return nil
}

func CastFromExtension(ctx *exec.KernelCtx, batch *exec.ExecSpan, out *exec.ExecResult) error {
	opts := ctx.State.(kernels.CastState)

	arr := batch.Values[0].Array.MakeArray().(array.ExtensionArray)
	defer arr.Release()

	castOpts := CastOptions(opts)
	result, err := CastArray(ctx.Ctx, arr.Storage(), &castOpts)
	if err != nil {
		return err
	}
	defer result.Release()

	out.TakeOwnership(result.Data())
	return nil
}

func CastList[SrcOffsetT, DestOffsetT int32 | int64](ctx *exec.KernelCtx, batch *exec.ExecSpan, out *exec.ExecResult) error {
	var (
		opts       = ctx.State.(kernels.CastState)
		childType  = out.Type.(arrow.NestedType).Fields()[0].Type
		input      = &batch.Values[0].Array
		offsets    = exec.GetSpanOffsets[SrcOffsetT](input, 1)
		isDowncast = kernels.SizeOf[SrcOffsetT]() > kernels.SizeOf[DestOffsetT]()
	)

	out.Buffers[0] = input.Buffers[0]
	out.Buffers[1] = input.Buffers[1]

	if input.Offset != 0 && len(input.Buffers[0].Buf) > 0 {
		out.Buffers[0].WrapBuffer(ctx.AllocateBitmap(input.Len))
		bitutil.CopyBitmap(input.Buffers[0].Buf, int(input.Offset), int(input.Len),
			out.Buffers[0].Buf, 0)
	}

	// Handle list offsets
	// Several cases possible:
	//	- The source offset is non-zero, in which case we slice the
	//	  underlying values and shift the list offsets (regardless of
	//	  their respective types)
	//	- the source offset is zero but the source and destination types
	//	  have different list offset types, in which case we cast the offsets
	//  - otherwise we simply keep the original offsets
	if isDowncast {
		if offsets[input.Len] > SrcOffsetT(kernels.MaxOf[DestOffsetT]()) {
			return fmt.Errorf("%w: array of type %s too large to convert to %s",
				arrow.ErrInvalid, input.Type, out.Type)
		}
	}

	values := input.Children[0].MakeArray()
	defer values.Release()

	if input.Offset != 0 {
		out.Buffers[1].WrapBuffer(
			ctx.Allocate(out.Type.(arrow.OffsetsDataType).
				OffsetTypeTraits().BytesRequired(int(input.Len) + 1)))

		shiftedOffsets := exec.GetSpanOffsets[DestOffsetT](out, 1)
		for i := 0; i < int(input.Len)+1; i++ {
			shiftedOffsets[i] = DestOffsetT(offsets[i] - offsets[0])
		}

		values = array.NewSlice(values, int64(offsets[0]), int64(offsets[input.Len]))
		defer values.Release()
	} else if kernels.SizeOf[SrcOffsetT]() != kernels.SizeOf[DestOffsetT]() {
		out.Buffers[1].WrapBuffer(ctx.Allocate(out.Type.(arrow.OffsetsDataType).
			OffsetTypeTraits().BytesRequired(int(input.Len) + 1)))

		kernels.DoStaticCast(exec.GetSpanOffsets[SrcOffsetT](input, 1),
			exec.GetSpanOffsets[DestOffsetT](out, 1))
	}

	// handle values
	opts.ToType = childType

	castedValues, err := CastArray(ctx.Ctx, values, &opts)
	if err != nil {
		return err
	}
	defer castedValues.Release()

	out.Children = make([]exec.ArraySpan, 1)
	out.Children[0].SetMembers(castedValues.Data())
	for i, b := range out.Children[0].Buffers {
		if b.Owner != nil && b.Owner != values.Data().Buffers()[i] {
			b.Owner.Retain()
			b.SelfAlloc = true
		}
	}
	return nil
}

func CastStruct(ctx *exec.KernelCtx, batch *exec.ExecSpan, out *exec.ExecResult) error {
	var (
		opts          = ctx.State.(kernels.CastState)
		inType        = batch.Values[0].Array.Type.(*arrow.StructType)
		outType       = out.Type.(*arrow.StructType)
		inFieldCount  = inType.NumFields()
		outFieldCount = outType.NumFields()
	)

	fieldsToSelect := make([]int, outFieldCount)
	for i := range fieldsToSelect {
		fieldsToSelect[i] = -1
	}

	outFieldIndex := 0
	for inFieldIndex := 0; inFieldIndex < inFieldCount && outFieldIndex < outFieldCount; inFieldIndex++ {
		inField := inType.Field(inFieldIndex)
		outField := outType.Field(outFieldIndex)
		if inField.Name == outField.Name {
			if inField.Nullable && !outField.Nullable {
				return fmt.Errorf("%w: cannot cast nullable field to non-nullable field: %s %s",
					arrow.ErrType, inType, outType)
			}
			fieldsToSelect[outFieldIndex] = inFieldIndex
			outFieldIndex++
		}
	}

	if outFieldIndex < outFieldCount {
		return fmt.Errorf("%w: struct fields don't match or are in the wrong order: Input: %s Output: %s",
			arrow.ErrType, inType, outType)
	}

	input := &batch.Values[0].Array
	if len(input.Buffers[0].Buf) > 0 {
		out.Buffers[0].WrapBuffer(ctx.AllocateBitmap(input.Len))
		bitutil.CopyBitmap(input.Buffers[0].Buf, int(input.Offset), int(input.Len),
			out.Buffers[0].Buf, 0)
	}

	out.Children = make([]exec.ArraySpan, outFieldCount)
	for outFieldIndex, idx := range fieldsToSelect {
		values := input.Children[idx].MakeArray()
		defer values.Release()
		values = array.NewSlice(values, input.Offset, input.Len)
		defer values.Release()

		opts.ToType = outType.Field(outFieldIndex).Type
		castedValues, err := CastArray(ctx.Ctx, values, &opts)
		if err != nil {
			return err
		}
		defer castedValues.Release()

		out.Children[outFieldIndex].TakeOwnership(castedValues.Data())
	}
	return nil
}

func addListCast[SrcOffsetT, DestOffsetT int32 | int64](fn *castFunction, inType arrow.Type) error {
	kernel := exec.NewScalarKernel([]exec.InputType{exec.NewIDInput(inType)},
		kernels.OutputTargetType, CastList[SrcOffsetT, DestOffsetT], nil)
	kernel.NullHandling = exec.NullComputedNoPrealloc
	kernel.MemAlloc = exec.MemNoPrealloc
	return fn.AddTypeCast(inType, kernel)
}

func addStructToStructCast(fn *castFunction) error {
	kernel := exec.NewScalarKernel([]exec.InputType{exec.NewIDInput(arrow.STRUCT)},
		kernels.OutputTargetType, CastStruct, nil)
	kernel.NullHandling = exec.NullComputedNoPrealloc
	return fn.AddTypeCast(arrow.STRUCT, kernel)
}

func addCastFuncs(fn []*castFunction) {
	for _, f := range fn {
		f.AddNewTypeCast(arrow.EXTENSION, []exec.InputType{exec.NewIDInput(arrow.EXTENSION)},
			f.kernels[0].Signature.OutType, CastFromExtension,
			exec.NullComputedNoPrealloc, exec.MemNoPrealloc)
		castTable[f.out] = f
	}
}

func initCastTable() {
	castTable = make(map[arrow.Type]*castFunction)
	addCastFuncs(getBooleanCasts())
	addCastFuncs(getNumericCasts())
	addCastFuncs(getBinaryLikeCasts())
	addCastFuncs(getTemporalCasts())
	addCastFuncs(getNestedCasts())

	nullToExt := newCastFunction("cast_extension", arrow.EXTENSION)
	nullToExt.AddNewTypeCast(arrow.NULL, []exec.InputType{exec.NewExactInput(arrow.Null)},
		kernels.OutputTargetType, kernels.CastFromNull, exec.NullComputedNoPrealloc, exec.MemNoPrealloc)
	castTable[arrow.EXTENSION] = nullToExt
}

func getCastFunction(to arrow.DataType) (*castFunction, error) {
	castInit.Do(initCastTable)

	fn, ok := castTable[to.ID()]
	if ok {
		return fn, nil
	}

	return nil, fmt.Errorf("%w: unsupported cast to %s", arrow.ErrNotImplemented, to)
}

func getNestedCasts() []*castFunction {
	out := make([]*castFunction, 0)

	addKernels := func(fn *castFunction, kernels []exec.ScalarKernel) {
		for _, k := range kernels {
			if err := fn.AddTypeCast(k.Signature.InputTypes[0].MatchID(), k); err != nil {
				panic(err)
			}
		}
	}

	castLists := newCastFunction("cast_list", arrow.LIST)
	addKernels(castLists, kernels.GetCommonCastKernels(arrow.LIST, kernels.OutputTargetType))
	if err := addListCast[int32, int32](castLists, arrow.LIST); err != nil {
		panic(err)
	}
	if err := addListCast[int64, int32](castLists, arrow.LARGE_LIST); err != nil {
		panic(err)
	}
	out = append(out, castLists)

	castLargeLists := newCastFunction("cast_large_list", arrow.LARGE_LIST)
	addKernels(castLargeLists, kernels.GetCommonCastKernels(arrow.LARGE_LIST, kernels.OutputTargetType))
	if err := addListCast[int32, int64](castLargeLists, arrow.LIST); err != nil {
		panic(err)
	}
	if err := addListCast[int64, int64](castLargeLists, arrow.LARGE_LIST); err != nil {
		panic(err)
	}
	out = append(out, castLargeLists)

	castFsl := newCastFunction("cast_fixed_size_list", arrow.FIXED_SIZE_LIST)
	addKernels(castFsl, kernels.GetCommonCastKernels(arrow.FIXED_SIZE_LIST, kernels.OutputTargetType))
	out = append(out, castFsl)

	castStruct := newCastFunction("cast_struct", arrow.STRUCT)
	addKernels(castStruct, kernels.GetCommonCastKernels(arrow.STRUCT, kernels.OutputTargetType))
	if err := addStructToStructCast(castStruct); err != nil {
		panic(err)
	}
	out = append(out, castStruct)

	return out
}

func getBooleanCasts() []*castFunction {
	fn := newCastFunction("cast_boolean", arrow.BOOL)
	kns := kernels.GetBooleanCastKernels()

	for _, k := range kns {
		if err := fn.AddTypeCast(k.Signature.InputTypes[0].Type.ID(), k); err != nil {
			panic(err)
		}
	}

	return []*castFunction{fn}
}

func getTemporalCasts() []*castFunction {
	output := make([]*castFunction, 0)
	addFn := func(name string, id arrow.Type, kernels []exec.ScalarKernel) {
		fn := newCastFunction(name, id)
		for _, k := range kernels {
			if err := fn.AddTypeCast(k.Signature.InputTypes[0].MatchID(), k); err != nil {
				panic(err)
			}
		}
		fn.AddNewTypeCast(arrow.DICTIONARY, []exec.InputType{exec.NewIDInput(arrow.DICTIONARY)},
			kernels[0].Signature.OutType, unpackDictionary, exec.NullComputedNoPrealloc, exec.MemNoPrealloc)
		output = append(output, fn)
	}

	addFn("cast_timestamp", arrow.TIMESTAMP, kernels.GetTimestampCastKernels())
	addFn("cast_date32", arrow.DATE32, kernels.GetDate32CastKernels())
	addFn("cast_date64", arrow.DATE64, kernels.GetDate64CastKernels())
	addFn("cast_time32", arrow.TIME32, kernels.GetTime32CastKernels())
	addFn("cast_time64", arrow.TIME64, kernels.GetTime64CastKernels())
	addFn("cast_duration", arrow.DURATION, kernels.GetDurationCastKernels())
	addFn("cast_month_day_nano_interval", arrow.INTERVAL_MONTH_DAY_NANO, kernels.GetIntervalCastKernels())
	return output
}

func getNumericCasts() []*castFunction {
	out := make([]*castFunction, 0)

	getFn := func(name string, ty arrow.Type, kns []exec.ScalarKernel) *castFunction {
		fn := newCastFunction(name, ty)
		for _, k := range kns {
			if err := fn.AddTypeCast(k.Signature.InputTypes[0].MatchID(), k); err != nil {
				panic(err)
			}
		}

		fn.AddNewTypeCast(arrow.DICTIONARY, []exec.InputType{exec.NewIDInput(arrow.DICTIONARY)},
			kns[0].Signature.OutType, unpackDictionary, exec.NullComputedNoPrealloc, exec.MemNoPrealloc)

		return fn
	}

	out = append(out, getFn("cast_int8", arrow.INT8, kernels.GetCastToInteger[int8](arrow.PrimitiveTypes.Int8)))
	out = append(out, getFn("cast_int16", arrow.INT16, kernels.GetCastToInteger[int8](arrow.PrimitiveTypes.Int16)))

	castInt32 := getFn("cast_int32", arrow.INT32, kernels.GetCastToInteger[int32](arrow.PrimitiveTypes.Int32))
	castInt32.AddTypeCast(arrow.DATE32,
		kernels.GetZeroCastKernel(arrow.DATE32,
			exec.NewExactInput(arrow.FixedWidthTypes.Date32),
			exec.NewOutputType(arrow.PrimitiveTypes.Int32)))
	castInt32.AddTypeCast(arrow.TIME32,
		kernels.GetZeroCastKernel(arrow.TIME32,
			exec.NewIDInput(arrow.TIME32), exec.NewOutputType(arrow.PrimitiveTypes.Int32)))
	out = append(out, castInt32)

	castInt64 := getFn("cast_int64", arrow.INT64, kernels.GetCastToInteger[int64](arrow.PrimitiveTypes.Int64))
	castInt64.AddTypeCast(arrow.DATE64,
		kernels.GetZeroCastKernel(arrow.DATE64,
			exec.NewIDInput(arrow.DATE64),
			exec.NewOutputType(arrow.PrimitiveTypes.Int64)))
	castInt64.AddTypeCast(arrow.TIME64,
		kernels.GetZeroCastKernel(arrow.TIME64,
			exec.NewIDInput(arrow.TIME64),
			exec.NewOutputType(arrow.PrimitiveTypes.Int64)))
	castInt64.AddTypeCast(arrow.DURATION,
		kernels.GetZeroCastKernel(arrow.DURATION,
			exec.NewIDInput(arrow.DURATION),
			exec.NewOutputType(arrow.PrimitiveTypes.Int64)))
	castInt64.AddTypeCast(arrow.TIMESTAMP,
		kernels.GetZeroCastKernel(arrow.TIMESTAMP,
			exec.NewIDInput(arrow.TIMESTAMP),
			exec.NewOutputType(arrow.PrimitiveTypes.Int64)))
	out = append(out, castInt64)

	out = append(out, getFn("cast_uint8", arrow.UINT8, kernels.GetCastToInteger[uint8](arrow.PrimitiveTypes.Uint8)))
	out = append(out, getFn("cast_uint16", arrow.UINT16, kernels.GetCastToInteger[uint16](arrow.PrimitiveTypes.Uint16)))
	out = append(out, getFn("cast_uint32", arrow.UINT32, kernels.GetCastToInteger[uint32](arrow.PrimitiveTypes.Uint32)))
	out = append(out, getFn("cast_uint64", arrow.UINT64, kernels.GetCastToInteger[uint64](arrow.PrimitiveTypes.Uint64)))

	out = append(out, getFn("cast_half_float", arrow.FLOAT16, kernels.GetCommonCastKernels(arrow.FLOAT16, exec.NewOutputType(arrow.FixedWidthTypes.Float16))))
	out = append(out, getFn("cast_float", arrow.FLOAT32, kernels.GetCastToFloating[float32](arrow.PrimitiveTypes.Float32)))
	out = append(out, getFn("cast_double", arrow.FLOAT64, kernels.GetCastToFloating[float64](arrow.PrimitiveTypes.Float64)))

	// cast to decimal128
	out = append(out, getFn("cast_decimal", arrow.DECIMAL128, kernels.GetCastToDecimal128()))
	// cast to decimal256
	out = append(out, getFn("cast_decimal256", arrow.DECIMAL256, kernels.GetCastToDecimal256()))
	return out
}

func getBinaryLikeCasts() []*castFunction {
	out := make([]*castFunction, 0)

	addFn := func(name string, ty arrow.Type, kns []exec.ScalarKernel) {
		fn := newCastFunction(name, ty)
		for _, k := range kns {
			if err := fn.AddTypeCast(k.Signature.InputTypes[0].MatchID(), k); err != nil {
				panic(err)
			}
		}

		fn.AddNewTypeCast(arrow.DICTIONARY, []exec.InputType{exec.NewIDInput(arrow.DICTIONARY)},
			kns[0].Signature.OutType, unpackDictionary, exec.NullComputedNoPrealloc, exec.MemNoPrealloc)

		out = append(out, fn)
	}

	addFn("cast_binary", arrow.BINARY, kernels.GetToBinaryKernels(arrow.BinaryTypes.Binary))
	addFn("cast_large_binary", arrow.LARGE_BINARY, kernels.GetToBinaryKernels(arrow.BinaryTypes.LargeBinary))
	addFn("cast_string", arrow.STRING, kernels.GetToBinaryKernels(arrow.BinaryTypes.String))
	addFn("cast_large_string", arrow.LARGE_STRING, kernels.GetToBinaryKernels(arrow.BinaryTypes.LargeString))
	addFn("cast_fixed_sized_binary", arrow.FIXED_SIZE_BINARY, kernels.GetFsbCastKernels())
	return out
}

// CastDatum is a convenience function for casting a Datum to another type.
// It is equivalent to calling CallFunction(ctx, "cast", opts, Datum) and
// should work for Scalar, Array or ChunkedArray Datums.
func CastDatum(ctx context.Context, val Datum, opts *CastOptions) (Datum, error) {
	return CallFunction(ctx, "cast", opts, val)
}

// CastArray is a convenience function for casting an Array to another type.
// It is equivalent to constructing a Datum for the array and using
// CallFunction(ctx, "cast", ...).
func CastArray(ctx context.Context, val arrow.Array, opts *CastOptions) (arrow.Array, error) {
	d := NewDatum(val)
	defer d.Release()

	out, err := CastDatum(ctx, d, opts)
	if err != nil {
		return nil, err
	}

	defer out.Release()
	return out.(*ArrayDatum).MakeArray(), nil
}

// CastToType is a convenience function equivalent to calling
// CastArray(ctx, val, compute.SafeCastOptions(toType))
func CastToType(ctx context.Context, val arrow.Array, toType arrow.DataType) (arrow.Array, error) {
	return CastArray(ctx, val, SafeCastOptions(toType))
}

// CanCast returns true if there is an implementation for casting an array
// or scalar value from the specified DataType to the other data type.
func CanCast(from, to arrow.DataType) bool {
	fn, err := getCastFunction(to)
	if err != nil {
		return false
	}

	for _, id := range fn.inIDs {
		if from.ID() == id {
			return true
		}
	}
	return false
}
