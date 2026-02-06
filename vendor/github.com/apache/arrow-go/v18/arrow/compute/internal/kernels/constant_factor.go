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

var (
	multiplyConstantInt32Int32 func([]int32, []int32, int64) = multiplyConstantGo[int32, int32]
	multiplyConstantInt32Int64 func([]int32, []int64, int64) = multiplyConstantGo[int32, int64]
	multiplyConstantInt64Int32 func([]int64, []int32, int64) = multiplyConstantGo[int64, int32]
	multiplyConstantInt64Int64 func([]int64, []int64, int64) = multiplyConstantGo[int64, int64]

	divideConstantInt32Int32 func([]int32, []int32, int64) = divideConstantGo[int32, int32]
	divideConstantInt32Int64 func([]int32, []int64, int64) = divideConstantGo[int32, int64]
	divideConstantInt64Int32 func([]int64, []int32, int64) = divideConstantGo[int64, int32]
	divideConstantInt64Int64 func([]int64, []int64, int64) = divideConstantGo[int64, int64]
)

func multiplyConstantGo[InT, OutT ~int32 | ~int64](input []InT, output []OutT, factor int64) {
	for i, v := range input {
		output[i] = OutT(v) * OutT(factor)
	}
}

func divideConstantGo[InT, OutT ~int32 | ~int64](input []InT, output []OutT, factor int64) {
	for i, v := range input {
		output[i] = OutT(v / InT(factor))
	}
}

func multiplyConstant(input, output any, factor int64) {
	switch in := input.(type) {
	case []int32:
		switch out := output.(type) {
		case []int32:
			multiplyConstantInt32Int32(in, out, factor)
		case []int64:
			multiplyConstantInt32Int64(in, out, factor)
		}
	case []int64:
		switch out := output.(type) {
		case []int32:
			multiplyConstantInt64Int32(in, out, factor)
		case []int64:
			multiplyConstantInt64Int64(in, out, factor)
		}
	}
}

func divideConstant(input, output any, factor int64) {
	switch in := input.(type) {
	case []int32:
		switch out := output.(type) {
		case []int32:
			divideConstantInt32Int32(in, out, factor)
		case []int64:
			divideConstantInt32Int64(in, out, factor)
		}
	case []int64:
		switch out := output.(type) {
		case []int32:
			divideConstantInt64Int32(in, out, factor)
		case []int64:
			divideConstantInt64Int64(in, out, factor)
		}
	}
}
