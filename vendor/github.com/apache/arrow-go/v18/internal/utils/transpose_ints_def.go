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

package utils

import (
	"errors"

	"github.com/apache/arrow-go/v18/arrow"
)

//go:generate go run ../../arrow/_tools/tmpl -i -data=transpose_ints.tmpldata -d arch=avx2 transpose_ints_simd.go.tmpl=transpose_ints_avx2_amd64.go
//go:generate go run ../../arrow/_tools/tmpl -i -data=transpose_ints.tmpldata -d arch=sse4 transpose_ints_simd.go.tmpl=transpose_ints_sse4_amd64.go
//go:generate go run ../../arrow/_tools/tmpl -i -data=transpose_ints.tmpldata transpose_ints_s390x.go.tmpl=transpose_ints_s390x.go
//go:generate go run ../../arrow/_tools/tmpl -i -data=transpose_ints.tmpldata transpose_ints_s390x.go.tmpl=transpose_ints_arm64.go
//go:generate go run ../../arrow/_tools/tmpl -i -data=transpose_ints.tmpldata transpose_ints_noasm.go.tmpl=transpose_ints_noasm.go
//go:generate go run ../../arrow/_tools/tmpl -i -data=transpose_ints.tmpldata transpose_ints.go.tmpl=transpose_ints.go

func bufToTyped(typ arrow.DataType, buf []byte, offset, length int) (interface{}, error) {
	switch typ.ID() {
	case arrow.INT8:
		return arrow.Int8Traits.CastFromBytes(buf)[offset : offset+length], nil
	case arrow.INT16:
		return arrow.Int16Traits.CastFromBytes(buf)[offset : offset+length], nil
	case arrow.INT32:
		return arrow.Int32Traits.CastFromBytes(buf)[offset : offset+length], nil
	case arrow.INT64:
		return arrow.Int64Traits.CastFromBytes(buf)[offset : offset+length], nil
	case arrow.UINT8:
		return arrow.Uint8Traits.CastFromBytes(buf)[offset : offset+length], nil
	case arrow.UINT16:
		return arrow.Uint16Traits.CastFromBytes(buf)[offset : offset+length], nil
	case arrow.UINT32:
		return arrow.Uint32Traits.CastFromBytes(buf)[offset : offset+length], nil
	case arrow.UINT64:
		return arrow.Uint64Traits.CastFromBytes(buf)[offset : offset+length], nil
	}
	return nil, errors.New("only accepts integral types")
}

// TransposeIntsBuffers takes the data-types, byte buffers, and offsets of a source and destination
// buffer to perform TransposeInts on with the provided mapping data.
func TransposeIntsBuffers(inType, outType arrow.DataType, indata, outdata []byte, inOffset, outOffset int, length int, transposeMap []int32) error {
	src, err := bufToTyped(inType, indata, inOffset, length)
	if err != nil {
		return err
	}
	dest, err := bufToTyped(outType, outdata, outOffset, length)
	if err != nil {
		return err
	}

	return TransposeInts(src, dest, transposeMap)
}

// TransposeInts expects two integral slices and the values they map to. Returning
// an error if either src or dest are not an integral type.
func TransposeInts(src, dest interface{}, mapping []int32) error {
	switch s := src.(type) {
	case []int8:
		switch d := dest.(type) {
		case []int8:
			TransposeInt8Int8(s, d, mapping)
		case []int16:
			TransposeInt8Int16(s, d, mapping)
		case []int32:
			TransposeInt8Int32(s, d, mapping)
		case []int64:
			TransposeInt8Int64(s, d, mapping)
		case []uint8:
			TransposeInt8Uint8(s, d, mapping)
		case []uint16:
			TransposeInt8Uint16(s, d, mapping)
		case []uint32:
			TransposeInt8Uint32(s, d, mapping)
		case []uint64:
			TransposeInt8Uint64(s, d, mapping)
		}
	case []int16:
		switch d := dest.(type) {
		case []int8:
			TransposeInt16Int8(s, d, mapping)
		case []int16:
			TransposeInt16Int16(s, d, mapping)
		case []int32:
			TransposeInt16Int32(s, d, mapping)
		case []int64:
			TransposeInt16Int64(s, d, mapping)
		case []uint8:
			TransposeInt16Uint8(s, d, mapping)
		case []uint16:
			TransposeInt16Uint16(s, d, mapping)
		case []uint32:
			TransposeInt16Uint32(s, d, mapping)
		case []uint64:
			TransposeInt16Uint64(s, d, mapping)
		}
	case []int32:
		switch d := dest.(type) {
		case []int8:
			TransposeInt32Int8(s, d, mapping)
		case []int16:
			TransposeInt32Int16(s, d, mapping)
		case []int32:
			TransposeInt32Int32(s, d, mapping)
		case []int64:
			TransposeInt32Int64(s, d, mapping)
		case []uint8:
			TransposeInt32Uint8(s, d, mapping)
		case []uint16:
			TransposeInt32Uint16(s, d, mapping)
		case []uint32:
			TransposeInt32Uint32(s, d, mapping)
		case []uint64:
			TransposeInt32Uint64(s, d, mapping)
		}
	case []int64:
		switch d := dest.(type) {
		case []int8:
			TransposeInt64Int8(s, d, mapping)
		case []int16:
			TransposeInt64Int16(s, d, mapping)
		case []int32:
			TransposeInt64Int32(s, d, mapping)
		case []int64:
			TransposeInt64Int64(s, d, mapping)
		case []uint8:
			TransposeInt64Uint8(s, d, mapping)
		case []uint16:
			TransposeInt64Uint16(s, d, mapping)
		case []uint32:
			TransposeInt64Uint32(s, d, mapping)
		case []uint64:
			TransposeInt64Uint64(s, d, mapping)
		}
	case []uint8:
		switch d := dest.(type) {
		case []int8:
			TransposeUint8Int8(s, d, mapping)
		case []int16:
			TransposeUint8Int16(s, d, mapping)
		case []int32:
			TransposeUint8Int32(s, d, mapping)
		case []int64:
			TransposeUint8Int64(s, d, mapping)
		case []uint8:
			TransposeUint8Uint8(s, d, mapping)
		case []uint16:
			TransposeUint8Uint16(s, d, mapping)
		case []uint32:
			TransposeUint8Uint32(s, d, mapping)
		case []uint64:
			TransposeUint8Uint64(s, d, mapping)
		}
	case []uint16:
		switch d := dest.(type) {
		case []int8:
			TransposeUint16Int8(s, d, mapping)
		case []int16:
			TransposeUint16Int16(s, d, mapping)
		case []int32:
			TransposeUint16Int32(s, d, mapping)
		case []int64:
			TransposeUint16Int64(s, d, mapping)
		case []uint8:
			TransposeUint16Uint8(s, d, mapping)
		case []uint16:
			TransposeUint16Uint16(s, d, mapping)
		case []uint32:
			TransposeUint16Uint32(s, d, mapping)
		case []uint64:
			TransposeUint16Uint64(s, d, mapping)
		}
	case []uint32:
		switch d := dest.(type) {
		case []int8:
			TransposeUint32Int8(s, d, mapping)
		case []int16:
			TransposeUint32Int16(s, d, mapping)
		case []int32:
			TransposeUint32Int32(s, d, mapping)
		case []int64:
			TransposeUint32Int64(s, d, mapping)
		case []uint8:
			TransposeUint32Uint8(s, d, mapping)
		case []uint16:
			TransposeUint32Uint16(s, d, mapping)
		case []uint32:
			TransposeUint32Uint32(s, d, mapping)
		case []uint64:
			TransposeUint32Uint64(s, d, mapping)
		}
	case []uint64:
		switch d := dest.(type) {
		case []int8:
			TransposeUint64Int8(s, d, mapping)
		case []int16:
			TransposeUint64Int16(s, d, mapping)
		case []int32:
			TransposeUint64Int32(s, d, mapping)
		case []int64:
			TransposeUint64Int64(s, d, mapping)
		case []uint8:
			TransposeUint64Uint8(s, d, mapping)
		case []uint16:
			TransposeUint64Uint16(s, d, mapping)
		case []uint32:
			TransposeUint64Uint32(s, d, mapping)
		case []uint64:
			TransposeUint64Uint64(s, d, mapping)
		}
	}
	return nil
}
