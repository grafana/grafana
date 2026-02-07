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

import "golang.org/x/sys/cpu"

func init() {
	// if the CPU supports AVX2 or SSE4 then let's use those to benefit from SIMD
	// to accelerate the performance for finding the min and max for an integral slice.
	// otherwise fallback to a pure go implementation if the cpu doesn't have these features.
	if cpu.X86.HasAVX2 {
		minmaxFuncs.i8 = int8MaxMinAVX2
		minmaxFuncs.ui8 = uint8MaxMinAVX2
		minmaxFuncs.i16 = int16MaxMinAVX2
		minmaxFuncs.ui16 = uint16MaxMinAVX2
		minmaxFuncs.i32 = int32MaxMinAVX2
		minmaxFuncs.ui32 = uint32MaxMinAVX2
		minmaxFuncs.i64 = int64MaxMinAVX2
		minmaxFuncs.ui64 = uint64MaxMinAVX2
	} else if cpu.X86.HasSSE42 {
		minmaxFuncs.i8 = int8MaxMinSSE4
		minmaxFuncs.ui8 = uint8MaxMinSSE4
		minmaxFuncs.i16 = int16MaxMinSSE4
		minmaxFuncs.ui16 = uint16MaxMinSSE4
		minmaxFuncs.i32 = int32MaxMinSSE4
		minmaxFuncs.ui32 = uint32MaxMinSSE4
		minmaxFuncs.i64 = int64MaxMinSSE4
		minmaxFuncs.ui64 = uint64MaxMinSSE4
	} else {
		minmaxFuncs.i8 = int8MinMax
		minmaxFuncs.ui8 = uint8MinMax
		minmaxFuncs.i16 = int16MinMax
		minmaxFuncs.ui16 = uint16MinMax
		minmaxFuncs.i32 = int32MinMax
		minmaxFuncs.ui32 = uint32MinMax
		minmaxFuncs.i64 = int64MinMax
		minmaxFuncs.ui64 = uint64MinMax
	}
}
