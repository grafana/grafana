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

package utils

import "golang.org/x/sys/cpu"

var byteToBoolFunc func([]byte, []bool)

func init() {
	// if the cpu supports AVX2 or SSE4 then use SIMD to accelerate the conversion
	// of a bitmap to a slice of bools in an optimized fashion, otherwise fallback
	// to the pure go implementation
	if cpu.X86.HasAVX2 {
		byteToBoolFunc = bytesToBoolsAVX2
	} else if cpu.X86.HasSSE42 {
		byteToBoolFunc = bytesToBoolsSSE4
	} else {
		byteToBoolFunc = bytesToBoolsGo
	}
}

// BytesToBools efficiently populates a slice of booleans from an input bitmap
func BytesToBools(in []byte, out []bool) {
	byteToBoolFunc(in, out)
}
