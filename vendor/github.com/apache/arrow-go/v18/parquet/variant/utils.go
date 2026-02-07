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

package variant

import (
	"encoding/binary"
	"math"
	"unsafe"

	"github.com/apache/arrow-go/v18/arrow/endian"
	"github.com/apache/arrow-go/v18/parquet/internal/debug"
)

func readLEU32(b []byte) uint32 {
	debug.Assert(len(b) <= 4, "buffer too large")
	debug.Assert(len(b) >= 1, "buffer too small")

	var result uint32
	v := (*[4]byte)(unsafe.Pointer(&result))
	copy(v[:], b)

	return endian.FromLE(result)
}

func readLEU64(b []byte) uint64 {
	debug.Assert(len(b) <= 8, "buffer too large")
	debug.Assert(len(b) >= 1, "buffer too small")

	var result uint64
	v := (*[8]byte)(unsafe.Pointer(&result))
	copy(v[:], b)

	return endian.FromLE(result)
}

func readExact[T int8 | int16 | int32 | int64 | float32 | float64](b []byte) T {
	debug.Assert(len(b) >= binary.Size(T(0)), "buffer size mismatch")
	var result T
	binary.Decode(b, binary.LittleEndian, &result)
	return result
}

func primitiveHeader(t PrimitiveType) byte {
	return (byte(t)<<2 | byte(BasicPrimitive))
}

func shortStrHeader(sz int) byte {
	return byte(sz<<2) | byte(BasicShortString)
}

func arrayHeader(large bool, offsetSize uint8) byte {
	var largeBit byte
	if large {
		largeBit = 1
	}

	return (largeBit << (basicTypeBits + 2)) |
		((offsetSize - 1) << basicTypeBits) | byte(BasicArray)
}

func objectHeader(large bool, idSize, offsetSize uint8) byte {
	var largeBit byte
	if large {
		largeBit = 1
	}

	return (largeBit << (basicTypeBits + 4)) |
		((idSize - 1) << (basicTypeBits + 2)) |
		((offsetSize - 1) << basicTypeBits) | byte(BasicObject)
}

func intSize(v int) uint8 {
	debug.Assert(v <= metadataMaxSizeLimit, "size too large")
	debug.Assert(v >= 0, "size cannot be negative")

	switch {
	case v <= math.MaxUint8:
		return 1
	case v <= math.MaxUint16:
		return 2
	case v <= 0xFFFFFF: // MaxUint24
		return 3
	default:
		return 4
	}
}

func writeOffset(buf []byte, v int, nbytes uint8) {
	debug.Assert(nbytes <= 4, "nbytes size too large")
	debug.Assert(nbytes >= 1, "nbytes size too small")

	for i := range nbytes {
		buf[i] = byte((v >> (i * 8)) & 0xFF)
	}
}

func valueSize(v []byte) int {
	basicType, typeInfo := v[0]&basicTypeMask, (v[0]>>basicTypeBits)&typeInfoMask
	switch basicType {
	case byte(BasicShortString):
		return 1 + int(typeInfo)
	case byte(BasicObject):
		var szBytes uint8 = 1
		if ((typeInfo >> 4) & 0x1) != 0 {
			szBytes = 4
		}

		sz := readLEU32(v[1 : 1+szBytes])
		idSize, offsetSize := ((typeInfo>>2)&0b11)+1, uint32((typeInfo&0b11)+1)
		idStart := 1 + szBytes
		offsetStart := uint32(idStart) + sz*uint32(idSize)
		dataStart := offsetStart + (sz+1)*offsetSize

		idx := offsetStart + sz*uint32(offsetSize)
		return int(dataStart + readLEU32(v[idx:idx+offsetSize]))
	case byte(BasicArray):
		var szBytes uint8 = 1
		if ((typeInfo >> 4) & 0x1) != 0 {
			szBytes = 4
		}

		sz := readLEU32(v[1 : 1+szBytes])
		offsetSize, offsetStart := uint32((typeInfo&0b11)+1), uint32(1+szBytes)
		dataStart := offsetStart + (sz+1)*offsetSize

		idx := offsetStart + sz*uint32(offsetSize)
		return int(dataStart + readLEU32(v[idx:idx+offsetSize]))
	default:
		switch PrimitiveType(typeInfo) {
		case PrimitiveNull, PrimitiveBoolTrue, PrimitiveBoolFalse:
			return 1
		case PrimitiveInt8:
			return 2
		case PrimitiveInt16:
			return 3
		case PrimitiveInt32, PrimitiveDate, PrimitiveFloat:
			return 5
		case PrimitiveInt64, PrimitiveDouble, PrimitiveTimeMicrosNTZ,
			PrimitiveTimestampMicros, PrimitiveTimestampMicrosNTZ,
			PrimitiveTimestampNanos, PrimitiveTimestampNanosNTZ:
			return 9
		case PrimitiveDecimal4:
			return 6
		case PrimitiveDecimal8:
			return 10
		case PrimitiveDecimal16:
			return 18
		case PrimitiveBinary, PrimitiveString:
			return 5 + int(readLEU32(v[1:5]))
		case PrimitiveUUID:
			return 17
		default:
			panic("unknown primitive type")
		}
	}
}
