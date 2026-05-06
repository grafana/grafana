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
	"github.com/apache/arrow-go/v18/arrow/internal/debug"
)

func haveChunkedArray(values []Datum) bool {
	for _, v := range values {
		if v.Kind() == KindChunked {
			return true
		}
	}
	return false
}

// ExecSpanFromBatch constructs and returns a new ExecSpan from the values
// inside of the ExecBatch which could be scalar or arrays.
//
// This is mostly used for tests but is also a convenience method for other
// cases.
func ExecSpanFromBatch(batch *ExecBatch) *exec.ExecSpan {
	out := &exec.ExecSpan{Len: batch.Len, Values: make([]exec.ExecValue, len(batch.Values))}
	for i, v := range batch.Values {
		outVal := &out.Values[i]
		if v.Kind() == KindScalar {
			outVal.Scalar = v.(*ScalarDatum).Value
		} else {
			outVal.Array.SetMembers(v.(*ArrayDatum).Value)
			outVal.Scalar = nil
		}
	}
	return out
}

// this is the primary driver of execution
func execInternal(ctx context.Context, fn Function, opts FunctionOptions, passedLen int64, args ...Datum) (result Datum, err error) {
	if opts == nil {
		if err = checkOptions(fn, opts); err != nil {
			return
		}
		opts = fn.DefaultOptions()
	}

	// we only allow Array, ChunkedArray, and Scalars for now.
	// RecordBatch and Table datums are disallowed.
	if err = checkAllIsValue(args); err != nil {
		return
	}

	inTypes := make([]arrow.DataType, len(args))
	for i, a := range args {
		inTypes[i] = a.(ArrayLikeDatum).Type()
	}

	var (
		k        exec.Kernel
		executor KernelExecutor
	)

	switch fn.Kind() {
	case FuncScalar:
		executor = scalarExecPool.Get().(*scalarExecutor)
		defer func() {
			executor.Clear()
			scalarExecPool.Put(executor.(*scalarExecutor))
		}()
	case FuncVector:
		executor = vectorExecPool.Get().(*vectorExecutor)
		defer func() {
			executor.Clear()
			vectorExecPool.Put(executor.(*vectorExecutor))
		}()
	default:
		return nil, fmt.Errorf("%w: direct execution of %s", arrow.ErrNotImplemented, fn.Kind())
	}

	if k, err = fn.DispatchBest(inTypes...); err != nil {
		return
	}

	var newArgs []Datum
	// cast arguments if necessary
	for i, arg := range args {
		if !arrow.TypeEqual(inTypes[i], arg.(ArrayLikeDatum).Type()) {
			if newArgs == nil {
				newArgs = make([]Datum, len(args))
				copy(newArgs, args)
			}
			newArgs[i], err = CastDatum(ctx, arg, SafeCastOptions(inTypes[i]))
			if err != nil {
				return nil, err
			}
			defer newArgs[i].Release()
		}
	}
	if newArgs != nil {
		args = newArgs
	}

	kctx := &exec.KernelCtx{Ctx: ctx, Kernel: k}
	init := k.GetInitFn()
	kinitArgs := exec.KernelInitArgs{Kernel: k, Inputs: inTypes, Options: opts}
	if init != nil {
		kctx.State, err = init(kctx, kinitArgs)
		if err != nil {
			return
		}
	}

	if err = executor.Init(kctx, kinitArgs); err != nil {
		return
	}

	input := ExecBatch{Values: args, Len: 0}
	if input.NumValues() == 0 {
		if passedLen != -1 {
			input.Len = passedLen
		}
	} else {
		inferred, allSame := inferBatchLength(input.Values)
		input.Len = inferred
		switch fn.Kind() {
		case FuncScalar:
			if passedLen != -1 && passedLen != inferred {
				return nil, fmt.Errorf("%w: passed batch length for execution did not match actual length for scalar fn execution",
					arrow.ErrInvalid)
			}
		case FuncVector:
			vkernel := k.(*exec.VectorKernel)
			if !(allSame || !vkernel.CanExecuteChunkWise) {
				return nil, fmt.Errorf("%w: vector kernel arguments must all be the same length", arrow.ErrInvalid)
			}
		}
	}

	ectx := GetExecCtx(ctx)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	ch := make(chan Datum, ectx.ExecChannelSize)
	go func() {
		defer close(ch)
		if err = executor.Execute(ctx, &input, ch); err != nil {
			cancel()
		}
	}()

	result = executor.WrapResults(ctx, ch, haveChunkedArray(input.Values))
	if err == nil {
		debug.Assert(executor.CheckResultType(result) == nil, "invalid result type")
	}

	if ctx.Err() == context.Canceled && result != nil {
		result.Release()
	}

	return
}

// CallFunction is a one-shot invoker for all types of functions.
//
// It will perform kernel-dispatch, argument checking, iteration of
// ChunkedArray inputs and wrapping of outputs.
//
// To affect the execution options, you must call SetExecCtx and pass
// the resulting context in here.
func CallFunction(ctx context.Context, funcName string, opts FunctionOptions, args ...Datum) (Datum, error) {
	ectx := GetExecCtx(ctx)
	fn, ok := ectx.Registry.GetFunction(funcName)
	if !ok {
		return nil, fmt.Errorf("%w: function '%s' not found", arrow.ErrKey, funcName)
	}

	return fn.Execute(ctx, opts, args...)
}
