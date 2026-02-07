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
	"github.com/apache/arrow-go/v18/arrow/internal/debug"
)

var (
	MonthIntervalTraits        monthTraits
	DayTimeIntervalTraits      daytimeTraits
	MonthDayNanoIntervalTraits monthDayNanoTraits
)

func init() {
	debug.Assert(MonthIntervalSizeBytes == 4, "MonthIntervalSizeBytes should be 4")
	debug.Assert(DayTimeIntervalSizeBytes == 8, "DayTimeIntervalSizeBytes should be 8")
	debug.Assert(MonthDayNanoIntervalSizeBytes == 16, "MonthDayNanoIntervalSizeBytes should be 16")
}

// MonthInterval traits

const (
	// MonthIntervalSizeBytes specifies the number of bytes required to store a single MonthInterval in memory
	MonthIntervalSizeBytes = int(unsafe.Sizeof(MonthInterval(0)))
)

type monthTraits struct{}

// BytesRequired returns the number of bytes required to store n elements in memory.
func (monthTraits) BytesRequired(n int) int { return MonthIntervalSizeBytes * n }

// PutValue
func (monthTraits) PutValue(b []byte, v MonthInterval) {
	endian.Native.PutUint32(b, uint32(v))
}

// CastFromBytes reinterprets the slice b to a slice of type MonthInterval.
//
// NOTE: len(b) must be a multiple of MonthIntervalSizeBytes.
func (monthTraits) CastFromBytes(b []byte) []MonthInterval {
	return GetData[MonthInterval](b)
}

// CastToBytes reinterprets the slice b to a slice of bytes.
func (monthTraits) CastToBytes(b []MonthInterval) []byte {
	return GetBytes(b)
}

// Copy copies src to dst.
func (monthTraits) Copy(dst, src []MonthInterval) { copy(dst, src) }

// DayTimeInterval traits

const (
	// DayTimeIntervalSizeBytes specifies the number of bytes required to store a single DayTimeInterval in memory
	DayTimeIntervalSizeBytes = int(unsafe.Sizeof(DayTimeInterval{}))
)

type daytimeTraits struct{}

// BytesRequired returns the number of bytes required to store n elements in memory.
func (daytimeTraits) BytesRequired(n int) int { return DayTimeIntervalSizeBytes * n }

// PutValue
func (daytimeTraits) PutValue(b []byte, v DayTimeInterval) {
	endian.Native.PutUint32(b[0:4], uint32(v.Days))
	endian.Native.PutUint32(b[4:8], uint32(v.Milliseconds))
}

// CastFromBytes reinterprets the slice b to a slice of type DayTimeInterval.
//
// NOTE: len(b) must be a multiple of DayTimeIntervalSizeBytes.
func (daytimeTraits) CastFromBytes(b []byte) []DayTimeInterval {
	return GetData[DayTimeInterval](b)
}

// CastToBytes reinterprets the slice b to a slice of bytes.
func (daytimeTraits) CastToBytes(b []DayTimeInterval) []byte {
	return GetBytes(b)
}

// Copy copies src to dst.
func (daytimeTraits) Copy(dst, src []DayTimeInterval) { copy(dst, src) }

// DayTimeInterval traits

const (
	// MonthDayNanoIntervalSizeBytes specifies the number of bytes required to store a single DayTimeInterval in memory
	MonthDayNanoIntervalSizeBytes = int(unsafe.Sizeof(MonthDayNanoInterval{}))
)

type monthDayNanoTraits struct{}

// BytesRequired returns the number of bytes required to store n elements in memory.
func (monthDayNanoTraits) BytesRequired(n int) int { return MonthDayNanoIntervalSizeBytes * n }

// PutValue
func (monthDayNanoTraits) PutValue(b []byte, v MonthDayNanoInterval) {
	endian.Native.PutUint32(b[0:4], uint32(v.Months))
	endian.Native.PutUint32(b[4:8], uint32(v.Days))
	endian.Native.PutUint64(b[8:], uint64(v.Nanoseconds))
}

// CastFromBytes reinterprets the slice b to a slice of type MonthDayNanoInterval.
//
// NOTE: len(b) must be a multiple of MonthDayNanoIntervalSizeBytes.
func (monthDayNanoTraits) CastFromBytes(b []byte) []MonthDayNanoInterval {
	return GetData[MonthDayNanoInterval](b)
}

// CastToBytes reinterprets the slice b to a slice of bytes.
func (monthDayNanoTraits) CastToBytes(b []MonthDayNanoInterval) []byte {
	return GetBytes(b)
}

// Copy copies src to dst.
func (monthDayNanoTraits) Copy(dst, src []MonthDayNanoInterval) { copy(dst, src) }
