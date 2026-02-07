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
func _levels_to_bitmap_neon(levels unsafe.Pointer, numLevels int, rhs int16) (res uint64)

// greaterThanBitmapNEON builds a bitmap where each set bit indicates the corresponding level
// is greater than the rhs value.
func greaterThanBitmapNEON(levels []int16, rhs int16) uint64 {
	if len(levels) == 0 {
		return 0
	}

	var (
		p1 = unsafe.Pointer(&levels[0])
		p2 = len(levels)
		p3 = rhs
	)

	return _levels_to_bitmap_neon(p1, p2, p3)
}
