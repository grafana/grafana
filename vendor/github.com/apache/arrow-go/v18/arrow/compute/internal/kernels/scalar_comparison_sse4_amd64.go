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
func _comparison_equal_arr_arr_sse4(typ int, left, right, out unsafe.Pointer, length int64, offset int)

func comparisonEqualArrArrSSE4(typ arrow.Type, left, right, out []byte, length int64, offset int) {
	_comparison_equal_arr_arr_sse4(int(typ), unsafe.Pointer(&left[0]), unsafe.Pointer(&right[0]), unsafe.Pointer(&out[0]), length, offset)
}

//go:noescape
func _comparison_equal_arr_scalar_sse4(typ int, left, right, out unsafe.Pointer, length int64, offset int)

func comparisonEqualArrScalarSSE4(typ arrow.Type, left, right, out []byte, length int64, offset int) {
	_comparison_equal_arr_scalar_sse4(int(typ), unsafe.Pointer(&left[0]), unsafe.Pointer(&right[0]), unsafe.Pointer(&out[0]), length, offset)
}

//go:noescape
func _comparison_equal_scalar_arr_sse4(typ int, left, right, out unsafe.Pointer, length int64, offset int)

func comparisonEqualScalarArrSSE4(typ arrow.Type, left, right, out []byte, length int64, offset int) {
	_comparison_equal_scalar_arr_sse4(int(typ), unsafe.Pointer(&left[0]), unsafe.Pointer(&right[0]), unsafe.Pointer(&out[0]), length, offset)
}

//go:noescape
func _comparison_not_equal_arr_arr_sse4(typ int, left, right, out unsafe.Pointer, length int64, offset int)

func comparisonNotEqualArrArrSSE4(typ arrow.Type, left, right, out []byte, length int64, offset int) {
	_comparison_not_equal_arr_arr_sse4(int(typ), unsafe.Pointer(&left[0]), unsafe.Pointer(&right[0]), unsafe.Pointer(&out[0]), length, offset)
}

//go:noescape
func _comparison_not_equal_arr_scalar_sse4(typ int, left, right, out unsafe.Pointer, length int64, offset int)

func comparisonNotEqualArrScalarSSE4(typ arrow.Type, left, right, out []byte, length int64, offset int) {
	_comparison_not_equal_arr_scalar_sse4(int(typ), unsafe.Pointer(&left[0]), unsafe.Pointer(&right[0]), unsafe.Pointer(&out[0]), length, offset)
}

//go:noescape
func _comparison_not_equal_scalar_arr_sse4(typ int, left, right, out unsafe.Pointer, length int64, offset int)

func comparisonNotEqualScalarArrSSE4(typ arrow.Type, left, right, out []byte, length int64, offset int) {
	_comparison_not_equal_scalar_arr_sse4(int(typ), unsafe.Pointer(&left[0]), unsafe.Pointer(&right[0]), unsafe.Pointer(&out[0]), length, offset)
}

//go:noescape
func _comparison_greater_arr_arr_sse4(typ int, left, right, out unsafe.Pointer, length int64, offset int)

func comparisonGreaterArrArrSSE4(typ arrow.Type, left, right, out []byte, length int64, offset int) {
	_comparison_greater_arr_arr_sse4(int(typ), unsafe.Pointer(&left[0]), unsafe.Pointer(&right[0]), unsafe.Pointer(&out[0]), length, offset)
}

//go:noescape
func _comparison_greater_arr_scalar_sse4(typ int, left, right, out unsafe.Pointer, length int64, offset int)

func comparisonGreaterArrScalarSSE4(typ arrow.Type, left, right, out []byte, length int64, offset int) {
	_comparison_greater_arr_scalar_sse4(int(typ), unsafe.Pointer(&left[0]), unsafe.Pointer(&right[0]), unsafe.Pointer(&out[0]), length, offset)
}

//go:noescape
func _comparison_greater_scalar_arr_sse4(typ int, left, right, out unsafe.Pointer, length int64, offset int)

func comparisonGreaterScalarArrSSE4(typ arrow.Type, left, right, out []byte, length int64, offset int) {
	_comparison_greater_scalar_arr_sse4(int(typ), unsafe.Pointer(&left[0]), unsafe.Pointer(&right[0]), unsafe.Pointer(&out[0]), length, offset)
}

//go:noescape
func _comparison_greater_equal_arr_arr_sse4(typ int, left, right, out unsafe.Pointer, length int64, offset int)

func comparisonGreaterEqualArrArrSSE4(typ arrow.Type, left, right, out []byte, length int64, offset int) {
	_comparison_greater_equal_arr_arr_sse4(int(typ), unsafe.Pointer(&left[0]), unsafe.Pointer(&right[0]), unsafe.Pointer(&out[0]), length, offset)
}

//go:noescape
func _comparison_greater_equal_arr_scalar_sse4(typ int, left, right, out unsafe.Pointer, length int64, offset int)

func comparisonGreaterEqualArrScalarSSE4(typ arrow.Type, left, right, out []byte, length int64, offset int) {
	_comparison_greater_equal_arr_scalar_sse4(int(typ), unsafe.Pointer(&left[0]), unsafe.Pointer(&right[0]), unsafe.Pointer(&out[0]), length, offset)
}

//go:noescape
func _comparison_greater_equal_scalar_arr_sse4(typ int, left, right, out unsafe.Pointer, length int64, offset int)

func comparisonGreaterEqualScalarArrSSE4(typ arrow.Type, left, right, out []byte, length int64, offset int) {
	_comparison_greater_equal_scalar_arr_sse4(int(typ), unsafe.Pointer(&left[0]), unsafe.Pointer(&right[0]), unsafe.Pointer(&out[0]), length, offset)
}
