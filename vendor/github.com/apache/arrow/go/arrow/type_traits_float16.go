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

package arrow

import (
	"encoding/binary"
	"reflect"
	"unsafe"

	"github.com/apache/arrow/go/arrow/float16"
)

// Float16 traits
var Float16Traits float16Traits

const (
	// Float16SizeBytes specifies the number of bytes required to store a single float16 in memory
	Float16SizeBytes = int(unsafe.Sizeof(uint16(0)))
)

type float16Traits struct{}

// BytesRequired returns the number of bytes required to store n elements in memory.
func (float16Traits) BytesRequired(n int) int { return Float16SizeBytes * n }

// PutValue
func (float16Traits) PutValue(b []byte, v float16.Num) {
	binary.LittleEndian.PutUint16(b, uint16(v.Uint16()))
}

// CastFromBytes reinterprets the slice b to a slice of type uint16.
//
// NOTE: len(b) must be a multiple of Uint16SizeBytes.
func (float16Traits) CastFromBytes(b []byte) []float16.Num {
	h := (*reflect.SliceHeader)(unsafe.Pointer(&b))

	var res []float16.Num
	s := (*reflect.SliceHeader)(unsafe.Pointer(&res))
	s.Data = h.Data
	s.Len = h.Len / Float16SizeBytes
	s.Cap = h.Cap / Float16SizeBytes

	return res
}

// CastToBytes reinterprets the slice b to a slice of bytes.
func (float16Traits) CastToBytes(b []float16.Num) []byte {
	h := (*reflect.SliceHeader)(unsafe.Pointer(&b))

	var res []byte
	s := (*reflect.SliceHeader)(unsafe.Pointer(&res))
	s.Data = h.Data
	s.Len = h.Len * Float16SizeBytes
	s.Cap = h.Cap * Float16SizeBytes

	return res
}

// Copy copies src to dst.
func (float16Traits) Copy(dst, src []float16.Num) { copy(dst, src) }
