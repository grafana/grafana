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

package bmi

import "unsafe"

//go:noescape
func _extract_bits_bmi2(bitmap, selectBitmap uint64) (res uint64)

// extractBitsBMI2 uses BMI2 to call the pext instruction, Parallel Bits Extract
// in order to quickly and efficiently extract the bits selected in a parallel
// fashion. See the definition of the PEXT instruction for x86/x86-64 cpus
func extractBitsBMI2(bitmap, selectBitmap uint64) uint64 {
	return _extract_bits_bmi2(bitmap, selectBitmap)
}

//go:noescape
func _levels_to_bitmap_bmi2(levels unsafe.Pointer, numLevels int, rhs int16) (res uint64)

// greaterThanBitmapBMI2 builds a bitmap where each set bit indicates the corresponding level
// is greater than the rhs value.
func greaterThanBitmapBMI2(levels []int16, rhs int16) uint64 {
	if len(levels) == 0 {
		return 0
	}

	var (
		p1 = unsafe.Pointer(&levels[0])
		p2 = len(levels)
		p3 = rhs
	)

	return _levels_to_bitmap_bmi2(p1, p2, p3)
}
