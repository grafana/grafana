// Copyright 2022 Dolthub, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package values

import (
	"bytes"
	"encoding/binary"
	"math"
)

type Type struct {
	Coll     Collation
	Enc      Encoding
	Nullable bool
}

type ByteSize uint16

const (
	Int8Size    ByteSize = 1
	Uint8Size   ByteSize = 1
	Int16Size   ByteSize = 2
	Uint16Size  ByteSize = 2
	Int24Size   ByteSize = 3
	Uint24Size  ByteSize = 3
	Int32Size   ByteSize = 4
	Uint32Size  ByteSize = 4
	Int48Size   ByteSize = 6
	Uint48Size  ByteSize = 6
	Int64Size   ByteSize = 8
	Uint64Size  ByteSize = 8
	Float32Size ByteSize = 4
	Float64Size ByteSize = 8
)

const maxUint48 = uint64(1<<48 - 1)
const maxUint24 = uint32(1<<24 - 1)

type Collation uint16

const (
	ByteOrderCollation Collation = 0
)

type Encoding uint8

// Constant Size Encodings
const (
	NullEnc    Encoding = 0
	Int8Enc    Encoding = 1
	Uint8Enc   Encoding = 2
	Int16Enc   Encoding = 3
	Uint16Enc  Encoding = 4
	Int24Enc   Encoding = 5
	Uint24Enc  Encoding = 6
	Int32Enc   Encoding = 7
	Uint32Enc  Encoding = 8
	Int64Enc   Encoding = 9
	Uint64Enc  Encoding = 10
	Float32Enc Encoding = 11
	Float64Enc Encoding = 12

	// TODO
	//  TimeEnc
	//  TimestampEnc
	//  DateEnc
	//  TimeEnc
	//  DatetimeEnc
	//  YearEnc

	sentinel Encoding = 127
)

// Variable Size Encodings
const (
	StringEnc Encoding = 128
	BytesEnc  Encoding = 129

	// TODO
	//  DecimalEnc
	//  BitEnc
	//  CharEnc
	//  VarCharEnc
	//  TextEnc
	//  BinaryEnc
	//  VarBinaryEnc
	//  BlobEnc
	//  JSONEnc
	//  EnumEnc
	//  SetEnc
	//  ExpressionEnc
	//  GeometryEnc
)

func ReadBool(val []byte) bool {
	expectSize(val, Int8Size)
	return val[0] == 1
}
func ReadInt8(val []byte) int8 {
	expectSize(val, Int8Size)
	return int8(val[0])
}

func ReadUint8(val []byte) uint8 {
	expectSize(val, Uint8Size)
	return val[0]
}

func ReadInt16(val []byte) int16 {
	expectSize(val, Int16Size)
	return int16(binary.LittleEndian.Uint16(val))
}

func ReadUint16(val []byte) uint16 {
	expectSize(val, Uint16Size)
	return binary.LittleEndian.Uint16(val)
}

func ReadInt24(val []byte) (i int32) {
	expectSize(val, Int24Size)
	var tmp [4]byte
	// copy |val| to |tmp|
	tmp[3], tmp[2] = val[3], val[2]
	tmp[1], tmp[0] = val[1], val[0]
	i = int32(binary.LittleEndian.Uint32(tmp[:]))
	return
}

func ReadUint24(val []byte) (u uint32) {
	expectSize(val, Int24Size)
	var tmp [4]byte
	// copy |val| to |tmp|
	tmp[3], tmp[2] = val[3], val[2]
	tmp[1], tmp[0] = val[1], val[0]
	u = binary.LittleEndian.Uint32(tmp[:])
	return
}

func ReadInt32(val []byte) int32 {
	expectSize(val, Int32Size)
	return int32(binary.LittleEndian.Uint32(val))
}

func ReadUint32(val []byte) uint32 {
	expectSize(val, Uint32Size)
	return binary.LittleEndian.Uint32(val)
}

func ReadInt48(val []byte) (i int64) {
	expectSize(val, Int48Size)
	var tmp [8]byte
	// copy |val| to |tmp|
	tmp[5], tmp[4] = val[5], val[4]
	tmp[3], tmp[2] = val[3], val[2]
	tmp[1], tmp[0] = val[1], val[0]
	i = int64(binary.LittleEndian.Uint64(tmp[:]))
	return
}

func ReadUint48(val []byte) (u uint64) {
	expectSize(val, Uint48Size)
	var tmp [8]byte
	// copy |val| to |tmp|
	tmp[5], tmp[4] = val[5], val[4]
	tmp[3], tmp[2] = val[3], val[2]
	tmp[1], tmp[0] = val[1], val[0]
	u = binary.LittleEndian.Uint64(tmp[:])
	return
}

func ReadInt64(val []byte) int64 {
	expectSize(val, Int64Size)
	return int64(binary.LittleEndian.Uint64(val))
}

func ReadUint64(val []byte) uint64 {
	expectSize(val, Uint64Size)
	return binary.LittleEndian.Uint64(val)
}

func ReadFloat32(val []byte) float32 {
	expectSize(val, Float32Size)
	return math.Float32frombits(ReadUint32(val))
}

func ReadFloat64(val []byte) float64 {
	expectSize(val, Float64Size)
	return math.Float64frombits(ReadUint64(val))
}

func ReadString(val []byte, coll Collation) string {
	// todo: fix allocation
	return string(val)
}

func ReadBytes(val []byte, coll Collation) []byte {
	// todo: fix collation
	return val
}

func writeBool(buf []byte, val bool) {
	expectSize(buf, 1)
	if val {
		buf[0] = byte(1)
	} else {
		buf[0] = byte(0)
	}
}

func WriteInt8(buf []byte, val int8) []byte {
	expectSize(buf, Int8Size)
	buf[0] = byte(val)
	return buf
}

func WriteUint8(buf []byte, val uint8) []byte {
	expectSize(buf, Uint8Size)
	buf[0] = byte(val)
	return buf
}

func WriteInt16(buf []byte, val int16) []byte {
	expectSize(buf, Int16Size)
	binary.LittleEndian.PutUint16(buf, uint16(val))
	return buf
}

func WriteUint16(buf []byte, val uint16) []byte {
	expectSize(buf, Uint16Size)
	binary.LittleEndian.PutUint16(buf, val)
	return buf
}

func WriteInt24(buf []byte, val int32) []byte {
	expectSize(buf, Int24Size)

	var tmp [4]byte
	binary.LittleEndian.PutUint32(tmp[:], uint32(val))
	// copy |tmp| to |buf|
	buf[2], buf[1], buf[0] = tmp[2], tmp[1], tmp[0]
	return buf
}

func WriteUint24(buf []byte, val uint32) []byte {
	expectSize(buf, Uint24Size)
	if val > maxUint24 {
		panic("uint is greater than max uint24")
	}

	var tmp [4]byte
	binary.LittleEndian.PutUint32(tmp[:], uint32(val))
	// copy |tmp| to |buf|
	buf[2], buf[1], buf[0] = tmp[2], tmp[1], tmp[0]
	return buf
}

func WriteInt32(buf []byte, val int32) []byte {
	expectSize(buf, Int32Size)
	binary.LittleEndian.PutUint32(buf, uint32(val))
	return buf
}

func WriteUint32(buf []byte, val uint32) []byte {
	expectSize(buf, Uint32Size)
	binary.LittleEndian.PutUint32(buf, val)
	return buf
}

func WriteUint48(buf []byte, u uint64) []byte {
	expectSize(buf, Uint48Size)
	if u > maxUint48 {
		panic("uint is greater than max uint48")
	}
	var tmp [8]byte
	binary.LittleEndian.PutUint64(tmp[:], u)
	// copy |tmp| to |buf|
	buf[5], buf[4] = tmp[5], tmp[4]
	buf[3], buf[2] = tmp[3], tmp[2]
	buf[1], buf[0] = tmp[1], tmp[0]
	return buf
}

func WriteInt64(buf []byte, val int64) []byte {
	expectSize(buf, Int64Size)
	binary.LittleEndian.PutUint64(buf, uint64(val))
	return buf
}

func WriteUint64(buf []byte, val uint64) []byte {
	expectSize(buf, Uint64Size)
	binary.LittleEndian.PutUint64(buf, val)
	return buf
}

func WriteFloat32(buf []byte, val float32) []byte {
	expectSize(buf, Float32Size)
	binary.LittleEndian.PutUint32(buf, math.Float32bits(val))
	return buf
}

func WriteFloat64(buf []byte, val float64) []byte {
	expectSize(buf, Float64Size)
	binary.LittleEndian.PutUint64(buf, math.Float64bits(val))
	return buf
}

func WriteString(buf []byte, val string, coll Collation) []byte {
	// todo: fix collation
	expectSize(buf, ByteSize(len(val)))
	copy(buf, val)
	return buf
}

func WriteBytes(buf, val []byte, coll Collation) []byte {
	// todo: fix collation
	expectSize(buf, ByteSize(len(val)))
	copy(buf, val)
	return buf
}

func expectSize(buf []byte, sz ByteSize) {
	if ByteSize(len(buf)) != sz {
		panic("byte slice is not of expected size")
	}
}

func compare(typ Type, left, right []byte) int {
	// order NULLs last
	if left == nil {
		if right == nil {
			return 0
		} else {
			return 1
		}
	} else if right == nil {
		if left == nil {
			return 0
		} else {
			return -1
		}
	}

	switch typ.Enc {
	case Int8Enc:
		return compareInt8(ReadInt8(left), ReadInt8(right))
	case Uint8Enc:
		return compareUint8(ReadUint8(left), ReadUint8(right))
	case Int16Enc:
		return compareInt16(ReadInt16(left), ReadInt16(right))
	case Uint16Enc:
		return compareUint16(ReadUint16(left), ReadUint16(right))
	case Int24Enc:
		panic("24 bit")
	case Uint24Enc:
		panic("24 bit")
	case Int32Enc:
		return compareInt32(ReadInt32(left), ReadInt32(right))
	case Uint32Enc:
		return compareUint32(ReadUint32(left), ReadUint32(right))
	case Int64Enc:
		return compareInt64(ReadInt64(left), ReadInt64(right))
	case Uint64Enc:
		return compareUint64(ReadUint64(left), ReadUint64(right))
	case Float32Enc:
		return compareFloat32(ReadFloat32(left), ReadFloat32(right))
	case Float64Enc:
		return compareFloat64(ReadFloat64(left), ReadFloat64(right))
	case StringEnc:
		return compareString(ReadString(left, typ.Coll), ReadString(right, typ.Coll), typ.Coll)
	case BytesEnc:
		return compareBytes(ReadBytes(left, typ.Coll), ReadBytes(right, typ.Coll), typ.Coll)
	default:
		panic("unknown encoding")
	}
}

// false is less than true
func compareBool(l, r bool) int {
	if l == r {
		return 0
	}
	if !l && r {
		return -1
	}
	return 1
}

func compareInt8(l, r int8) int {
	if l == r {
		return 0
	} else if l < r {
		return -1
	} else {
		return 1
	}
}

func compareUint8(l, r uint8) int {
	if l == r {
		return 0
	} else if l < r {
		return -1
	} else {
		return 1
	}
}

func compareInt16(l, r int16) int {
	if l == r {
		return 0
	} else if l < r {
		return -1
	} else {
		return 1
	}
}

func compareUint16(l, r uint16) int {
	if l == r {
		return 0
	} else if l < r {
		return -1
	} else {
		return 1
	}
}

func compareInt32(l, r int32) int {
	if l == r {
		return 0
	} else if l < r {
		return -1
	} else {
		return 1
	}
}

func compareUint32(l, r uint32) int {
	if l == r {
		return 0
	} else if l < r {
		return -1
	} else {
		return 1
	}
}

func compareInt64(l, r int64) int {
	if l == r {
		return 0
	} else if l < r {
		return -1
	} else {
		return 1
	}
}

func compareUint64(l, r uint64) int {
	if l == r {
		return 0
	} else if l < r {
		return -1
	} else {
		return 1
	}
}

func compareFloat32(l, r float32) int {
	if l == r {
		return 0
	} else if l < r {
		return -1
	} else {
		return 1
	}
}

func compareFloat64(l, r float64) int {
	if l == r {
		return 0
	} else if l < r {
		return -1
	} else {
		return 1
	}
}

func compareString(l, r string, coll Collation) int {
	return bytes.Compare([]byte(l), []byte(r))
}

func compareBytes(l, r []byte, coll Collation) int {
	return bytes.Compare(l, r)
}
