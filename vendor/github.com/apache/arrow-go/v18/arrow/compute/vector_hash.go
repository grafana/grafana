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
	uniqueDoc = FunctionDoc{
		Summary:     "Compute unique elements",
		Description: "Return an array with distinct values. Nulls in the input are ignored",
		ArgNames:    []string{"array"},
	}
)

func Unique(ctx context.Context, values Datum) (Datum, error) {
	return CallFunction(ctx, "unique", nil, values)
}

func UniqueArray(ctx context.Context, values arrow.Array) (arrow.Array, error) {
	out, err := Unique(ctx, &ArrayDatum{Value: values.Data()})
	if err != nil {
		return nil, err
	}
	defer out.Release()

	return out.(*ArrayDatum).MakeArray(), nil
}

func RegisterVectorHash(reg FunctionRegistry) {
	unique, _, _ := kernels.GetVectorHashKernels()
	uniqFn := NewVectorFunction("unique", Unary(), uniqueDoc)
	for _, vd := range unique {
		if err := uniqFn.AddKernel(vd); err != nil {
			panic(err)
		}
	}
	reg.AddFunction(uniqFn, false)
}
