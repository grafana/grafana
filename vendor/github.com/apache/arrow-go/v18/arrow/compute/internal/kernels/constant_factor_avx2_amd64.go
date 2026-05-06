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

import "unsafe"

//go:noescape
func _multiply_constant_int32_int32_avx2(src, dest unsafe.Pointer, len int, factor int64)

func multiplyConstantInt32Int32Avx2(in []int32, out []int32, factor int64) {
	_multiply_constant_int32_int32_avx2(unsafe.Pointer(&in[0]), unsafe.Pointer(&out[0]), len(out), factor)
}

//go:noescape
func _multiply_constant_int32_int64_avx2(src, dest unsafe.Pointer, len int, factor int64)

func multiplyConstantInt32Int64Avx2(in []int32, out []int64, factor int64) {
	_multiply_constant_int32_int64_avx2(unsafe.Pointer(&in[0]), unsafe.Pointer(&out[0]), len(out), factor)
}

//go:noescape
func _multiply_constant_int64_int32_avx2(src, dest unsafe.Pointer, len int, factor int64)

func multiplyConstantInt64Int32Avx2(in []int64, out []int32, factor int64) {
	_multiply_constant_int64_int32_avx2(unsafe.Pointer(&in[0]), unsafe.Pointer(&out[0]), len(out), factor)
}

//go:noescape
func _multiply_constant_int64_int64_avx2(src, dest unsafe.Pointer, len int, factor int64)

func multiplyConstantInt64Int64Avx2(in []int64, out []int64, factor int64) {
	_multiply_constant_int64_int64_avx2(unsafe.Pointer(&in[0]), unsafe.Pointer(&out[0]), len(out), factor)
}

//go:noescape
func _divide_constant_int32_int32_avx2(src, dest unsafe.Pointer, len int, factor int64)

func divideConstantInt32Int32Avx2(in []int32, out []int32, factor int64) {
	_divide_constant_int32_int32_avx2(unsafe.Pointer(&in[0]), unsafe.Pointer(&out[0]), len(out), factor)
}

//go:noescape
func _divide_constant_int32_int64_avx2(src, dest unsafe.Pointer, len int, factor int64)

func divideConstantInt32Int64Avx2(in []int32, out []int64, factor int64) {
	_divide_constant_int32_int64_avx2(unsafe.Pointer(&in[0]), unsafe.Pointer(&out[0]), len(out), factor)
}

//go:noescape
func _divide_constant_int64_int32_avx2(src, dest unsafe.Pointer, len int, factor int64)

func divideConstantInt64Int32Avx2(in []int64, out []int32, factor int64) {
	_divide_constant_int64_int32_avx2(unsafe.Pointer(&in[0]), unsafe.Pointer(&out[0]), len(out), factor)
}

//go:noescape
func _divide_constant_int64_int64_avx2(src, dest unsafe.Pointer, len int, factor int64)

func divideConstantInt64Int64Avx2(in []int64, out []int64, factor int64) {
	_divide_constant_int64_int64_avx2(unsafe.Pointer(&in[0]), unsafe.Pointer(&out[0]), len(out), factor)
}
