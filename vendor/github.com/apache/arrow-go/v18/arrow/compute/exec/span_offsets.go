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

//go:build go1.20 || tinygo

package exec

import (
	"unsafe"
)

// convenience function for populating the offsets buffer from a scalar
// value's size.
func setOffsetsForScalar[T int32 | int64](span *ArraySpan, buf []T, valueSize int64, bufidx int) {
	buf[0] = 0
	buf[1] = T(valueSize)

	span.Buffers[bufidx].Buf = unsafe.Slice((*byte)(unsafe.Pointer(unsafe.SliceData(buf))),
		2*int(unsafe.Sizeof(T(0))))

	span.Buffers[bufidx].Owner = nil
	span.Buffers[bufidx].SelfAlloc = false
}
