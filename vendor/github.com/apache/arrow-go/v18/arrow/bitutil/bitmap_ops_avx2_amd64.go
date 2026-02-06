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

//go:build !noasm
// +build !noasm

package bitutil

import (
	"unsafe"
)

//go:noescape
func _bitmap_aligned_and_avx2(left, right, out unsafe.Pointer, length int64)

func bitmapAlignedAndAVX2(left, right, out []byte) {
	_bitmap_aligned_and_avx2(unsafe.Pointer(&left[0]), unsafe.Pointer(&right[0]), unsafe.Pointer(&out[0]), int64(len(out)))
}

//go:noescape
func _bitmap_aligned_or_avx2(left, right, out unsafe.Pointer, length int64)

func bitmapAlignedOrAVX2(left, right, out []byte) {
	_bitmap_aligned_or_avx2(unsafe.Pointer(&left[0]), unsafe.Pointer(&right[0]), unsafe.Pointer(&out[0]), int64(len(out)))
}

//go:noescape
func _bitmap_aligned_and_not_avx2(left, right, out unsafe.Pointer, length int64)

func bitmapAlignedAndNotAVX2(left, right, out []byte) {
	_bitmap_aligned_and_not_avx2(unsafe.Pointer(&left[0]), unsafe.Pointer(&right[0]), unsafe.Pointer(&out[0]), int64(len(out)))
}

//go:noescape
func _bitmap_aligned_xor_avx2(left, right, out unsafe.Pointer, length int64)

func bitmapAlignedXorAVX2(left, right, out []byte) {
	_bitmap_aligned_xor_avx2(unsafe.Pointer(&left[0]), unsafe.Pointer(&right[0]), unsafe.Pointer(&out[0]), int64(len(out)))
}
