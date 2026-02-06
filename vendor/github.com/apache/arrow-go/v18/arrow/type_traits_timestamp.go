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

	"github.com/apache/arrow-go/v18/arrow/endian"
)

var TimestampTraits timestampTraits

const (
	// TimestampSizeBytes specifies the number of bytes required to store a single Timestamp in memory
	TimestampSizeBytes = int(unsafe.Sizeof(Timestamp(0)))
)

type timestampTraits struct{}

// BytesRequired returns the number of bytes required to store n elements in memory.
func (timestampTraits) BytesRequired(n int) int { return TimestampSizeBytes * n }

func (timestampTraits) PutValue(b []byte, v Timestamp) {
	endian.Native.PutUint64(b, uint64(v))
}

// CastFromBytes reinterprets the slice b to a slice of type Timestamp.
//
// NOTE: len(b) must be a multiple of TimestampSizeBytes.
func (timestampTraits) CastFromBytes(b []byte) []Timestamp {
	return GetData[Timestamp](b)
}

// CastToBytes reinterprets the slice b to a slice of bytes.
func (timestampTraits) CastToBytes(b []Timestamp) []byte {
	return GetBytes(b)
}

// Copy copies src to dst.
func (timestampTraits) Copy(dst, src []Timestamp) { copy(dst, src) }
