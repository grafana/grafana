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

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/compute/internal/kernels"
)

var (
	runEndEncodeDoc = FunctionDoc{
		Summary:         "Run-end encode array",
		Description:     "Return a run-end encoded version of the input array",
		ArgNames:        []string{"array"},
		OptionsType:     "RunEndEncodeOptions",
		OptionsRequired: true,
	}
	runEndDecodeDoc = FunctionDoc{
		Summary:     "Decode run-end encoded array",
		Description: "Return a decoded version of a run-end encoded input array",
		ArgNames:    []string{"array"},
	}
)

type RunEndEncodeOptions = kernels.RunEndEncodeState

func RegisterVectorRunEndFuncs(reg FunctionRegistry) {
	encKns, decKns := kernels.GetRunEndEncodeKernels()
	encFn := NewVectorFunction("run_end_encode", Unary(), runEndEncodeDoc)
	for _, k := range encKns {
		if err := encFn.AddKernel(k); err != nil {
			panic(err)
		}
	}
	reg.AddFunction(encFn, false)

	decFn := NewVectorFunction("run_end_decode", Unary(), runEndDecodeDoc)
	for _, k := range decKns {
		if err := decFn.AddKernel(k); err != nil {
			panic(err)
		}
	}
	reg.AddFunction(decFn, false)
}

func RunEndEncode(ctx context.Context, opts RunEndEncodeOptions, arg Datum) (Datum, error) {
	return CallFunction(ctx, "run_end_encode", &opts, arg)
}

func RunEndEncodeArray(ctx context.Context, opts RunEndEncodeOptions, input arrow.Array) (arrow.Array, error) {
	out, err := RunEndEncode(ctx, opts, &ArrayDatum{Value: input.Data()})
	if err != nil {
		return nil, err
	}
	defer out.Release()

	return out.(*ArrayDatum).MakeArray(), nil
}

func RunEndDecode(ctx context.Context, arg Datum) (Datum, error) {
	return CallFunction(ctx, "run_end_decode", nil, arg)
}

func RunEndDecodeArray(ctx context.Context, input arrow.Array) (arrow.Array, error) {
	out, err := RunEndDecode(ctx, &ArrayDatum{Value: input.Data()})
	if err != nil {
		return nil, err
	}
	defer out.Release()

	return out.(*ArrayDatum).MakeArray(), nil
}
