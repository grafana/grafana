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

// Decimal256 traits
var Decimal256Traits decimal256Traits

const (
	Decimal256SizeBytes = int(unsafe.Sizeof(decimal.Decimal256{}))
)

type decimal256Traits struct{}

func (decimal256Traits) BytesRequired(n int) int { return Decimal256SizeBytes * n }

func (decimal256Traits) PutValue(b []byte, v decimal.Decimal256) {
	for i, a := range v.Array() {
		start := i * 8
		endian.Native.PutUint64(b[start:], a)
	}
}

// CastFromBytes reinterprets the slice b to a slice of decimal256
func (decimal256Traits) CastFromBytes(b []byte) []decimal.Decimal256 {
	return GetData[decimal.Decimal256](b)
}

func (decimal256Traits) CastToBytes(b []decimal.Decimal256) []byte {
	return GetBytes(b)
}

func (decimal256Traits) Copy(dst, src []decimal.Decimal256) { copy(dst, src) }
