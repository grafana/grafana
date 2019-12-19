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

	"github.com/apache/arrow/go/arrow/decimal128"
)

// Decimal128 traits
var Decimal128Traits decimal128Traits

const (
	// Decimal128SizeBytes specifies the number of bytes required to store a single decimal128 in memory
	Decimal128SizeBytes = int(unsafe.Sizeof(decimal128.Num{}))
)

type decimal128Traits struct{}

// BytesRequired returns the number of bytes required to store n elements in memory.
func (decimal128Traits) BytesRequired(n int) int { return Decimal128SizeBytes * n }

// PutValue
func (decimal128Traits) PutValue(b []byte, v decimal128.Num) {
	binary.LittleEndian.PutUint64(b[:8], uint64(v.LowBits()))
	binary.LittleEndian.PutUint64(b[8:], uint64(v.HighBits()))
}

// CastFromBytes reinterprets the slice b to a slice of type uint16.
//
// NOTE: len(b) must be a multiple of Uint16SizeBytes.
func (decimal128Traits) CastFromBytes(b []byte) []decimal128.Num {
	h := (*reflect.SliceHeader)(unsafe.Pointer(&b))

	var res []decimal128.Num
	s := (*reflect.SliceHeader)(unsafe.Pointer(&res))
	s.Data = h.Data
	s.Len = h.Len / Decimal128SizeBytes
	s.Cap = h.Cap / Decimal128SizeBytes

	return res
}

// CastToBytes reinterprets the slice b to a slice of bytes.
func (decimal128Traits) CastToBytes(b []decimal128.Num) []byte {
	h := (*reflect.SliceHeader)(unsafe.Pointer(&b))

	var res []byte
	s := (*reflect.SliceHeader)(unsafe.Pointer(&res))
	s.Data = h.Data
	s.Len = h.Len * Decimal128SizeBytes
	s.Cap = h.Cap * Decimal128SizeBytes

	return res
}

// Copy copies src to dst.
func (decimal128Traits) Copy(dst, src []decimal128.Num) { copy(dst, src) }
