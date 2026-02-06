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

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/compute/exec"
	"github.com/apache/arrow-go/v18/arrow/internal/debug"
	"github.com/apache/arrow-go/v18/arrow/scalar"
)

var (
	unsignedIntTypes = []arrow.DataType{
		arrow.PrimitiveTypes.Uint8,
		arrow.PrimitiveTypes.Uint16,
		arrow.PrimitiveTypes.Uint32,
		arrow.PrimitiveTypes.Uint64,
	}
	signedIntTypes = []arrow.DataType{
		arrow.PrimitiveTypes.Int8,
		arrow.PrimitiveTypes.Int16,
		arrow.PrimitiveTypes.Int32,
		arrow.PrimitiveTypes.Int64,
	}
	intTypes      = append(unsignedIntTypes, signedIntTypes...)
	floatingTypes = []arrow.DataType{
		arrow.PrimitiveTypes.Float32,
		arrow.PrimitiveTypes.Float64,
	}
	numericTypes = append(intTypes, floatingTypes...)
	// binary types without fixedsize binary
	baseBinaryTypes = []arrow.DataType{
		arrow.BinaryTypes.Binary,
		arrow.BinaryTypes.LargeBinary,
		arrow.BinaryTypes.String,
		arrow.BinaryTypes.LargeString}
	primitiveTypes = append(append([]arrow.DataType{arrow.Null,
		arrow.FixedWidthTypes.Date32, arrow.FixedWidthTypes.Date64},
		numericTypes...), baseBinaryTypes...)
)

//go:generate stringer -type=CompareOperator -linecomment

type CompareOperator int8

const (
	CmpEQ CompareOperator = iota // equal
	CmpNE                        // not_equal
	CmpGT                        // greater
	CmpGE                        // greater_equal
	CmpLT                        // less
	CmpLE                        // less_equal
)

type simpleBinaryKernel interface {
	Call(*exec.KernelCtx, *exec.ArraySpan, *exec.ArraySpan, *exec.ExecResult) error
	CallScalarLeft(*exec.KernelCtx, scalar.Scalar, *exec.ArraySpan, *exec.ExecResult) error
}

type commutativeBinaryKernel[T simpleBinaryKernel] struct{}

func (commutativeBinaryKernel[T]) CallScalarRight(ctx *exec.KernelCtx, left *exec.ArraySpan, right scalar.Scalar, out *exec.ExecResult) error {
	var t T
	return t.CallScalarLeft(ctx, right, left, out)
}

type SimpleBinaryKernel interface {
	simpleBinaryKernel
	CallScalarRight(*exec.KernelCtx, *exec.ArraySpan, scalar.Scalar, *exec.ExecResult) error
}

func SimpleBinary[K SimpleBinaryKernel](ctx *exec.KernelCtx, batch *exec.ExecSpan, out *exec.ExecResult) error {
	if batch.Len == 0 {
		return nil
	}

	var k K
	if batch.Values[0].IsArray() {
		if batch.Values[1].IsArray() {
			return k.Call(ctx, &batch.Values[0].Array, &batch.Values[1].Array, out)
		}
		return k.CallScalarRight(ctx, &batch.Values[0].Array, batch.Values[1].Scalar, out)
	}

	if batch.Values[1].IsArray() {
		return k.CallScalarLeft(ctx, batch.Values[0].Scalar, &batch.Values[1].Array, out)
	}

	debug.Assert(false, "should be unreachable")
	return fmt.Errorf("%w: should be unreachable", arrow.ErrInvalid)
}
