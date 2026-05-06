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

// This file contains convenience functions for utilizing Arm64 Neon intrinsics to quickly
// and efficiently get the min and max from an integral slice.

//go:noescape
func _int32_max_min_neon(values unsafe.Pointer, length int, minout, maxout unsafe.Pointer)

func int32MaxMinNEON(values []int32) (min, max int32) {
	_int32_max_min_neon(unsafe.Pointer(&values[0]), len(values), unsafe.Pointer(&min), unsafe.Pointer(&max))
	return
}

//go:noescape
func _uint32_max_min_neon(values unsafe.Pointer, length int, minout, maxout unsafe.Pointer)

func uint32MaxMinNEON(values []uint32) (min, max uint32) {
	_uint32_max_min_neon(unsafe.Pointer(&values[0]), len(values), unsafe.Pointer(&min), unsafe.Pointer(&max))
	return
}

//go:noescape
func _int64_max_min_neon(values unsafe.Pointer, length int, minout, maxout unsafe.Pointer)

func int64MaxMinNEON(values []int64) (min, max int64) {
	_int64_max_min_neon(unsafe.Pointer(&values[0]), len(values), unsafe.Pointer(&min), unsafe.Pointer(&max))
	return
}

//go:noescape
func _uint64_max_min_neon(values unsafe.Pointer, length int, minout, maxout unsafe.Pointer)

func uint64MaxMinNEON(values []uint64) (min, max uint64) {
	_uint64_max_min_neon(unsafe.Pointer(&values[0]), len(values), unsafe.Pointer(&min), unsafe.Pointer(&max))
	return
}
