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

package compute

import (
	"context"
	"errors"
	"fmt"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/compute/exec"
	"github.com/apache/arrow-go/v18/arrow/compute/internal/kernels"
	"github.com/apache/arrow-go/v18/arrow/extensions"
	"github.com/apache/arrow-go/v18/internal/hashing"
)

var (
	isinDoc = FunctionDoc{
		Summary: "Find each element in a set of values",
		Description: `For each element in "values", return true if it is found 
in a given set, false otherwise`,
		ArgNames:        []string{"values"},
		OptionsType:     "SetOptions",
		OptionsRequired: true,
	}
)

type NullMatchingBehavior = kernels.NullMatchingBehavior

const (
	NullMatchingMatch        = kernels.NullMatchingMatch
	NullMatchingSkip         = kernels.NullMatchingSkip
	NullMatchingEmitNull     = kernels.NullMatchingEmitNull
	NullMatchingInconclusive = kernels.NullMatchingInconclusive
)

type setLookupFunc struct {
	ScalarFunction
}

func (fn *setLookupFunc) Execute(ctx context.Context, opts FunctionOptions, args ...Datum) (Datum, error) {
	return execInternal(ctx, fn, opts, -1, args...)
}

func (fn *setLookupFunc) DispatchBest(vals ...arrow.DataType) (exec.Kernel, error) {
	ensureDictionaryDecoded(vals...)
	return fn.DispatchExact(vals...)
}

type SetOptions struct {
	ValueSet     Datum
	NullBehavior NullMatchingBehavior
}

func (*SetOptions) TypeName() string { return "SetOptions" }

func initSetLookup(ctx *exec.KernelCtx, args exec.KernelInitArgs) (exec.KernelState, error) {
	if args.Options == nil {
		return nil, fmt.Errorf("%w: calling a set lookup function without SetOptions", ErrInvalid)
	}

	opts, ok := args.Options.(*SetOptions)
	if !ok {
		return nil, fmt.Errorf("%w: expected SetOptions, got %T", ErrInvalid, args.Options)
	}

	valueset, ok := opts.ValueSet.(ArrayLikeDatum)
	if !ok {
		return nil, fmt.Errorf("%w: expected array-like datum, got %T", ErrInvalid, opts.ValueSet)
	}

	argType := args.Inputs[0]
	if (argType.ID() == arrow.STRING || argType.ID() == arrow.LARGE_STRING) && !arrow.IsBaseBinary(valueset.Type().ID()) {
		// don't implicitly cast from a non-binary type to string
		// since most types support casting to string and that may lead to
		// surprises. However we do want most other implicit casts
		return nil, fmt.Errorf("%w: array type doesn't match type of values set: %s vs %s",
			ErrInvalid, argType, valueset.Type())
	}

	if !arrow.TypeEqual(valueset.Type(), argType) {
		result, err := CastDatum(ctx.Ctx, valueset, SafeCastOptions(argType))
		if err == nil {
			defer result.Release()
			valueset = result.(ArrayLikeDatum)
		} else if CanCast(argType, valueset.Type()) {
			// avoid casting from non-binary types to string like above
			// otherwise will try to cast input array to valueset during
			// execution
			if (valueset.Type().ID() == arrow.STRING || valueset.Type().ID() == arrow.LARGE_STRING) && !arrow.IsBaseBinary(argType.ID()) {
				return nil, fmt.Errorf("%w: array type doesn't match type of values set: %s vs %s",
					ErrInvalid, argType, valueset.Type())
			}
		} else {
			return nil, fmt.Errorf("%w: array type doesn't match type of values set: %s vs %s",
				ErrInvalid, argType, valueset.Type())
		}

	}

	internalOpts := kernels.SetLookupOptions{
		ValueSet:     make([]exec.ArraySpan, 1),
		TotalLen:     opts.ValueSet.Len(),
		NullBehavior: opts.NullBehavior,
	}

	switch valueset.Kind() {
	case KindArray:
		internalOpts.ValueSet[0].SetMembers(valueset.(*ArrayDatum).Value)
		internalOpts.ValueSetType = valueset.(*ArrayDatum).Type()
	case KindChunked:
		chnked := valueset.(*ChunkedDatum).Value
		internalOpts.ValueSetType = chnked.DataType()
		internalOpts.ValueSet = make([]exec.ArraySpan, len(chnked.Chunks()))
		for i, c := range chnked.Chunks() {
			internalOpts.ValueSet[i].SetMembers(c.Data())
		}
	default:
		return nil, fmt.Errorf("%w: expected array or chunked array, got %s", ErrInvalid, opts.ValueSet.Kind())
	}

	return kernels.CreateSetLookupState(internalOpts, exec.GetAllocator(ctx.Ctx))
}

type setLookupState interface {
	Init(kernels.SetLookupOptions) error
	ValueType() arrow.DataType
}

func execIsIn(ctx *exec.KernelCtx, batch *exec.ExecSpan, out *exec.ExecResult) error {
	state := ctx.State.(setLookupState)
	ctx.Kernel.(*exec.ScalarKernel).Data = state
	in := batch.Values[0]

	if !arrow.TypeEqual(in.Type(), state.ValueType()) {
		materialized := in.Array.MakeArray()
		defer materialized.Release()

		castResult, err := CastArray(ctx.Ctx, materialized, SafeCastOptions(state.ValueType()))
		if err != nil {
			if errors.Is(err, arrow.ErrNotImplemented) {
				return fmt.Errorf("%w: array type doesn't match type of values  set: %s vs %s",
					ErrInvalid, in.Type(), state.ValueType())
			}
			return err
		}
		defer castResult.Release()

		var casted exec.ArraySpan
		casted.SetMembers(castResult.Data())
		return kernels.DispatchIsIn(state, &casted, out)
	}

	return kernels.DispatchIsIn(state, &in.Array, out)
}

func IsIn(ctx context.Context, opts SetOptions, values Datum) (Datum, error) {
	return CallFunction(ctx, "is_in", &opts, values)
}

func IsInSet(ctx context.Context, valueSet, values Datum) (Datum, error) {
	return IsIn(ctx, SetOptions{ValueSet: valueSet}, values)
}

func RegisterScalarSetLookup(reg FunctionRegistry) {
	inBase := NewScalarFunction("is_in", Unary(), isinDoc)

	types := []exec.InputType{
		exec.NewMatchedInput(exec.Primitive()),
		exec.NewIDInput(arrow.DECIMAL32),
		exec.NewIDInput(arrow.DECIMAL64),
	}

	outType := exec.NewOutputType(arrow.FixedWidthTypes.Boolean)
	for _, ty := range types {
		kn := exec.NewScalarKernel([]exec.InputType{ty}, outType, execIsIn, initSetLookup)
		kn.MemAlloc = exec.MemPrealloc
		kn.NullHandling = exec.NullComputedPrealloc
		if err := inBase.AddKernel(kn); err != nil {
			panic(err)
		}
	}

	binaryTypes := []exec.InputType{
		exec.NewMatchedInput(exec.BinaryLike()),
		exec.NewMatchedInput(exec.LargeBinaryLike()),
		exec.NewExactInput(extensions.NewUUIDType()),
		exec.NewIDInput(arrow.FIXED_SIZE_BINARY),
		exec.NewIDInput(arrow.DECIMAL128),
		exec.NewIDInput(arrow.DECIMAL256),
	}
	for _, ty := range binaryTypes {
		kn := exec.NewScalarKernel([]exec.InputType{ty}, outType, execIsIn, initSetLookup)
		kn.MemAlloc = exec.MemPrealloc
		kn.NullHandling = exec.NullComputedPrealloc
		kn.CleanupFn = func(state exec.KernelState) error {
			s := state.(*kernels.SetLookupState[[]byte])
			s.Lookup.(*hashing.BinaryMemoTable).Release()
			return nil
		}

		if err := inBase.AddKernel(kn); err != nil {
			panic(err)
		}
	}

	reg.AddFunction(&setLookupFunc{*inBase}, false)
}
