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
	"unsafe"

	"github.com/apache/arrow-go/v18/arrow"
)

//go:noescape
func _arithmetic_unary_same_types_sse4(typ int, op int8, input, output unsafe.Pointer, len int)

func arithmeticUnarySSE4(typ arrow.Type, op ArithmeticOp, input, out []byte, len int) {
	_arithmetic_unary_same_types_sse4(int(typ), int8(op), unsafe.Pointer(&input[0]), unsafe.Pointer(&out[0]), len)
}

//go:noescape
func _arithmetic_binary_sse4(typ int, op int8, inLeft, inRight, out unsafe.Pointer, len int)

func arithmeticSSE4(typ arrow.Type, op ArithmeticOp, left, right, out []byte, len int) {
	_arithmetic_binary_sse4(int(typ), int8(op), unsafe.Pointer(&left[0]), unsafe.Pointer(&right[0]), unsafe.Pointer(&out[0]), len)
}

//go:noescape
func _arithmetic_arr_scalar_sse4(typ int, op int8, inLeft, inRight, out unsafe.Pointer, len int)

func arithmeticArrScalarSSE4(typ arrow.Type, op ArithmeticOp, left []byte, right unsafe.Pointer, out []byte, len int) {
	_arithmetic_arr_scalar_sse4(int(typ), int8(op), unsafe.Pointer(&left[0]), right, unsafe.Pointer(&out[0]), len)
}

//go:noescape
func _arithmetic_scalar_arr_sse4(typ int, op int8, inLeft, inRight, out unsafe.Pointer, len int)

func arithmeticScalarArrSSE4(typ arrow.Type, op ArithmeticOp, left unsafe.Pointer, right, out []byte, len int) {
	_arithmetic_scalar_arr_sse4(int(typ), int8(op), left, unsafe.Pointer(&right[0]), unsafe.Pointer(&out[0]), len)
}

//go:noescape
func _arithmetic_unary_diff_type_sse4(itype, otype int, op int8, input, output unsafe.Pointer, len int)

func arithmeticUnaryDiffTypesSSE4(ityp, otyp arrow.Type, op ArithmeticOp, input, output []byte, len int) {
	_arithmetic_unary_diff_type_sse4(int(ityp), int(otyp), int8(op), unsafe.Pointer(&input[0]), unsafe.Pointer(&output[0]), len)
}
