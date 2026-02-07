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
	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/array"
	"github.com/apache/arrow-go/v18/arrow/compute/exec"
)

type CastOptions struct {
	ToType               arrow.DataType `compute:"to_type"`
	AllowIntOverflow     bool           `compute:"allow_int_overflow"`
	AllowTimeTruncate    bool           `compute:"allow_time_truncate"`
	AllowTimeOverflow    bool           `compute:"allow_time_overflow"`
	AllowDecimalTruncate bool           `compute:"allow_decimal_truncate"`
	AllowFloatTruncate   bool           `compute:"allow_float_truncate"`
	AllowInvalidUtf8     bool           `compute:"allow_invalid_utf8"`
}

func (CastOptions) TypeName() string { return "CastOptions" }

// CastState is the kernel state for Cast functions, it is an alias to
// the CastOptions object.
type CastState = CastOptions

// ZeroCopyCastExec is a kernel for performing a cast which can be executed
// as a zero-copy operation. It simply forwards the buffers to the output.
//
// This can be used for casting a type to itself, or for casts between
// equivalent representations such as Int32 and Date32.
func ZeroCopyCastExec(_ *exec.KernelCtx, batch *exec.ExecSpan, out *exec.ExecResult) error {
	out.Release()
	dt := out.Type
	*out = batch.Values[0].Array
	out.Type = dt
	return nil
}

func recursiveSetSelfAlloc(arr *exec.ArraySpan) {
	for i := range arr.Buffers {
		if len(arr.Buffers[i].Buf) > 0 {
			arr.Buffers[i].SelfAlloc = true
			if arr.Buffers[i].Owner != nil {
				arr.Buffers[i].Owner.Retain()
			}
		}
	}

	for i := range arr.Children {
		recursiveSetSelfAlloc(&arr.Children[i])
	}
}

// CastFromNull is a simple kernel for constructing an array of null values
// for the requested data type, allowing casting of an arrow.Null typed value
// to any other arbitrary data type.
func CastFromNull(ctx *exec.KernelCtx, batch *exec.ExecSpan, out *exec.ExecResult) error {
	arr := array.MakeArrayOfNull(exec.GetAllocator(ctx.Ctx), out.Type, int(batch.Len))
	defer arr.Release()

	out.SetMembers(arr.Data())
	recursiveSetSelfAlloc(out)
	return nil
}

// OutputAllNull is a simple kernel that initializes the output as an array
// whose output is all null by setting nulls to the length.
func OutputAllNull(_ *exec.KernelCtx, batch *exec.ExecSpan, out *exec.ExecResult) error {
	out.Nulls = batch.Len
	return nil
}

func CanCastFromDict(id arrow.Type) bool {
	return arrow.IsPrimitive(id) || arrow.IsBaseBinary(id) || arrow.IsFixedSizeBinary(id)
}

// GetZeroCastKernel returns a kernel for performing ZeroCast execution using
// the ZeroCopyCastExec kernel function.
func GetZeroCastKernel(inID arrow.Type, inType exec.InputType, out exec.OutputType) exec.ScalarKernel {
	k := exec.NewScalarKernel([]exec.InputType{inType}, out, ZeroCopyCastExec, nil)
	k.NullHandling = exec.NullComputedNoPrealloc
	k.MemAlloc = exec.MemNoPrealloc
	return k
}

// GetCommonCastKernels returns the list of kernels common to all types
// such as casting from null or from Extension types of the appropriate
// underlying type.
func GetCommonCastKernels(outID arrow.Type, outType exec.OutputType) (out []exec.ScalarKernel) {
	out = make([]exec.ScalarKernel, 0, 2)

	kernel := exec.NewScalarKernel([]exec.InputType{exec.NewExactInput(arrow.Null)}, outType,
		CastFromNull, nil)
	kernel.NullHandling = exec.NullComputedNoPrealloc
	kernel.MemAlloc = exec.MemNoPrealloc
	out = append(out, kernel)

	return
}
