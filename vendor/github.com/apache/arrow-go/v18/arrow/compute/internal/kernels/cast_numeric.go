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

//go:build go1.18

package kernels

import (
	"unsafe"

	"github.com/apache/arrow-go/v18/arrow"
)

var castNumericUnsafe func(itype, otype arrow.Type, in, out []byte, len int) = castNumericGo

func DoStaticCast[InT, OutT numeric](in []InT, out []OutT) {
	for i, v := range in {
		out[i] = OutT(v)
	}
}

func reinterpret[T numeric](b []byte, len int) (res []T) {
	return unsafe.Slice((*T)(unsafe.Pointer(&b[0])), len)
}

func castNumberToNumberUnsafeImpl[T numeric](outT arrow.Type, in []T, out []byte) {
	switch outT {
	case arrow.INT8:
		DoStaticCast(in, reinterpret[int8](out, len(in)))
	case arrow.UINT8:
		DoStaticCast(in, reinterpret[uint8](out, len(in)))
	case arrow.INT16:
		DoStaticCast(in, reinterpret[int16](out, len(in)))
	case arrow.UINT16:
		DoStaticCast(in, reinterpret[uint16](out, len(in)))
	case arrow.INT32:
		DoStaticCast(in, reinterpret[int32](out, len(in)))
	case arrow.UINT32:
		DoStaticCast(in, reinterpret[uint32](out, len(in)))
	case arrow.INT64:
		DoStaticCast(in, reinterpret[int64](out, len(in)))
	case arrow.UINT64:
		DoStaticCast(in, reinterpret[uint64](out, len(in)))
	case arrow.FLOAT32:
		DoStaticCast(in, reinterpret[float32](out, len(in)))
	case arrow.FLOAT64:
		DoStaticCast(in, reinterpret[float64](out, len(in)))
	}
}

func castNumericGo(itype, otype arrow.Type, in, out []byte, len int) {
	switch itype {
	case arrow.INT8:
		castNumberToNumberUnsafeImpl(otype, reinterpret[int8](in, len), out)
	case arrow.UINT8:
		castNumberToNumberUnsafeImpl(otype, reinterpret[uint8](in, len), out)
	case arrow.INT16:
		castNumberToNumberUnsafeImpl(otype, reinterpret[int16](in, len), out)
	case arrow.UINT16:
		castNumberToNumberUnsafeImpl(otype, reinterpret[uint16](in, len), out)
	case arrow.INT32:
		castNumberToNumberUnsafeImpl(otype, reinterpret[int32](in, len), out)
	case arrow.UINT32:
		castNumberToNumberUnsafeImpl(otype, reinterpret[uint32](in, len), out)
	case arrow.INT64:
		castNumberToNumberUnsafeImpl(otype, reinterpret[int64](in, len), out)
	case arrow.UINT64:
		castNumberToNumberUnsafeImpl(otype, reinterpret[uint64](in, len), out)
	case arrow.FLOAT32:
		castNumberToNumberUnsafeImpl(otype, reinterpret[float32](in, len), out)
	case arrow.FLOAT64:
		castNumberToNumberUnsafeImpl(otype, reinterpret[float64](in, len), out)
	}
}
