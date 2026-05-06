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

package utils

import "unsafe"

// This file contains convenience functions for utilizing SSE4 intrinsics to quickly
// and efficiently get the min and max from an integral slice.

//go:noescape
func _int8_max_min_sse4(values unsafe.Pointer, length int, minout, maxout unsafe.Pointer)

func int8MaxMinSSE4(values []int8) (min, max int8) {
	_int8_max_min_sse4(unsafe.Pointer(&values[0]), len(values), unsafe.Pointer(&min), unsafe.Pointer(&max))
	return
}

//go:noescape
func _uint8_max_min_sse4(values unsafe.Pointer, length int, minout, maxout unsafe.Pointer)

func uint8MaxMinSSE4(values []uint8) (min, max uint8) {
	_uint8_max_min_sse4(unsafe.Pointer(&values[0]), len(values), unsafe.Pointer(&min), unsafe.Pointer(&max))
	return
}

//go:noescape
func _int16_max_min_sse4(values unsafe.Pointer, length int, minout, maxout unsafe.Pointer)

func int16MaxMinSSE4(values []int16) (min, max int16) {
	_int16_max_min_sse4(unsafe.Pointer(&values[0]), len(values), unsafe.Pointer(&min), unsafe.Pointer(&max))
	return
}

//go:noescape
func _uint16_max_min_sse4(values unsafe.Pointer, length int, minout, maxout unsafe.Pointer)

func uint16MaxMinSSE4(values []uint16) (min, max uint16) {
	_uint16_max_min_sse4(unsafe.Pointer(&values[0]), len(values), unsafe.Pointer(&min), unsafe.Pointer(&max))
	return
}

//go:noescape
func _int32_max_min_sse4(values unsafe.Pointer, length int, minout, maxout unsafe.Pointer)

func int32MaxMinSSE4(values []int32) (min, max int32) {
	_int32_max_min_sse4(unsafe.Pointer(&values[0]), len(values), unsafe.Pointer(&min), unsafe.Pointer(&max))
	return
}

//go:noescape
func _uint32_max_min_sse4(values unsafe.Pointer, length int, minout, maxout unsafe.Pointer)

func uint32MaxMinSSE4(values []uint32) (min, max uint32) {
	_uint32_max_min_sse4(unsafe.Pointer(&values[0]), len(values), unsafe.Pointer(&min), unsafe.Pointer(&max))
	return
}

//go:noescape
func _int64_max_min_sse4(values unsafe.Pointer, length int, minout, maxout unsafe.Pointer)

func int64MaxMinSSE4(values []int64) (min, max int64) {
	_int64_max_min_sse4(unsafe.Pointer(&values[0]), len(values), unsafe.Pointer(&min), unsafe.Pointer(&max))
	return
}

//go:noescape
func _uint64_max_min_sse4(values unsafe.Pointer, length int, minout, maxout unsafe.Pointer)

func uint64MaxMinSSE4(values []uint64) (min, max uint64) {
	_uint64_max_min_sse4(unsafe.Pointer(&values[0]), len(values), unsafe.Pointer(&min), unsafe.Pointer(&max))
	return
}
