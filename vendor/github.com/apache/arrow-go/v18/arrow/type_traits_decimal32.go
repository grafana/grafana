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
	"unsafe"

	"github.com/apache/arrow-go/v18/arrow/decimal"
	"github.com/apache/arrow-go/v18/arrow/endian"
)

// Decimal32 traits
var Decimal32Traits decimal32Traits

const (
	// Decimal32SizeBytes specifies the number of bytes required to store a single decimal32 in memory
	Decimal32SizeBytes = int(unsafe.Sizeof(decimal.Decimal32(0)))
)

type decimal32Traits struct{}

// BytesRequired returns the number of bytes required to store n elements in memory.
func (decimal32Traits) BytesRequired(n int) int { return Decimal32SizeBytes * n }

// PutValue
func (decimal32Traits) PutValue(b []byte, v decimal.Decimal32) {
	endian.Native.PutUint32(b[:4], uint32(v))
}

// CastFromBytes reinterprets the slice b to a slice of type uint16.
//
// NOTE: len(b) must be a multiple of Uint16SizeBytes.
func (decimal32Traits) CastFromBytes(b []byte) []decimal.Decimal32 {
	return GetData[decimal.Decimal32](b)
}

// CastToBytes reinterprets the slice b to a slice of bytes.
func (decimal32Traits) CastToBytes(b []decimal.Decimal32) []byte {
	return GetBytes(b)
}

// Copy copies src to dst.
func (decimal32Traits) Copy(dst, src []decimal.Decimal32) { copy(dst, src) }
