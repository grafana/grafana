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

//go:build go1.18 && !noasm

package kernels

import (
	"golang.org/x/sys/cpu"
)

func init() {
	if cpu.X86.HasAVX2 {
		multiplyConstantInt32Int32 = multiplyConstantInt32Int32Avx2
		multiplyConstantInt32Int64 = multiplyConstantInt32Int64Avx2
		multiplyConstantInt64Int32 = multiplyConstantInt64Int32Avx2
		multiplyConstantInt64Int64 = multiplyConstantInt64Int64Avx2

		divideConstantInt32Int32 = divideConstantInt32Int32Avx2
		divideConstantInt32Int64 = divideConstantInt32Int64Avx2
		divideConstantInt64Int32 = divideConstantInt64Int32Avx2
		divideConstantInt64Int64 = divideConstantInt64Int64Avx2
	} else if cpu.X86.HasSSE42 {
		multiplyConstantInt32Int32 = multiplyConstantInt32Int32SSE4
		multiplyConstantInt32Int64 = multiplyConstantInt32Int64SSE4
		multiplyConstantInt64Int32 = multiplyConstantInt64Int32SSE4
		multiplyConstantInt64Int64 = multiplyConstantInt64Int64SSE4

		divideConstantInt32Int32 = divideConstantInt32Int32SSE4
		divideConstantInt32Int64 = divideConstantInt32Int64SSE4
		divideConstantInt64Int32 = divideConstantInt64Int32SSE4
		divideConstantInt64Int64 = divideConstantInt64Int64SSE4
	} else {
		multiplyConstantInt32Int32 = multiplyConstantGo[int32, int32]
		multiplyConstantInt32Int64 = multiplyConstantGo[int32, int64]
		multiplyConstantInt64Int32 = multiplyConstantGo[int64, int32]
		multiplyConstantInt64Int64 = multiplyConstantGo[int64, int64]

		divideConstantInt32Int32 = divideConstantGo[int32, int32]
		divideConstantInt32Int64 = divideConstantGo[int32, int64]
		divideConstantInt64Int32 = divideConstantGo[int64, int32]
		divideConstantInt64Int64 = divideConstantGo[int64, int64]
	}
}
