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

package encoding

import (
	"encoding/binary"
	"errors"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/array"
	"github.com/apache/arrow-go/v18/arrow/memory"
	"github.com/apache/arrow-go/v18/internal/utils"
	"github.com/apache/arrow-go/v18/parquet"
	pqutils "github.com/apache/arrow-go/v18/parquet/internal/utils"
	"golang.org/x/xerrors"
)

// PlainByteArrayDecoder decodes a data chunk for bytearrays according to
// the plain encoding. The byte arrays will use slices to reference the
// data rather than copying it.
//
// The parquet spec defines Plain encoding for ByteArrays as a 4 byte little
// endian integer containing the length of the bytearray followed by that many
// bytes being the raw data of the byte array.
type PlainByteArrayDecoder struct {
	decoder
}

// Type returns parquet.Types.ByteArray for this decoder
func (PlainByteArrayDecoder) Type() parquet.Type {
	return parquet.Types.ByteArray
}

func (pbad *PlainByteArrayDecoder) Discard(n int) (int, error) {
	n = min(n, pbad.nvals)
	// we have to skip the length of each value by first checking
	// the length of the value and then skipping that many bytes
	for i := 0; i < n; i++ {
		if len(pbad.data) < 4 {
			return i, errors.New("parquet: eof skipping bytearray values")
		}

		valueLen := int32(binary.LittleEndian.Uint32(pbad.data[:4]))
		if valueLen < 0 {
			return i, errors.New("parquet: invalid BYTE_ARRAY value")
		}

		if int64(len(pbad.data)) < int64(valueLen)+4 {
			return i, errors.New("parquet: eof skipping bytearray values")
		}

		pbad.data = pbad.data[valueLen+4:]
	}

	pbad.nvals -= n
	return n, nil
}

// Decode will populate the slice of bytearrays in full or until the number
// of values is consumed.
//
// Returns the number of values that were decoded.
func (pbad *PlainByteArrayDecoder) Decode(out []parquet.ByteArray) (int, error) {
	max := utils.Min(len(out), pbad.nvals)

	for i := 0; i < max; i++ {
		// there should always be at least four bytes which is the length of the
		// next value in the data.
		if len(pbad.data) < 4 {
			return i, xerrors.New("parquet: eof reading bytearray")
		}

		// the first 4 bytes are a little endian int32 length
		byteLen := int32(binary.LittleEndian.Uint32(pbad.data[:4]))
		if byteLen < 0 {
			return i, xerrors.New("parquet: invalid BYTE_ARRAY value")
		}

		if int64(len(pbad.data)) < int64(byteLen)+4 {
			return i, xerrors.New("parquet: eof reading bytearray")
		}

		out[i] = pbad.data[4 : byteLen+4 : byteLen+4]
		pbad.data = pbad.data[byteLen+4:]
	}

	pbad.nvals -= max
	return max, nil
}

// DecodeSpaced is like Decode, but expands the slice out to leave empty values
// where the validBits bitmap has 0s
func (pbad *PlainByteArrayDecoder) DecodeSpaced(out []parquet.ByteArray, nullCount int, validBits []byte, validBitsOffset int64) (int, error) {
	toRead := len(out) - nullCount
	valuesRead, err := pbad.Decode(out[:toRead])
	if err != nil {
		return valuesRead, err
	}
	if valuesRead != toRead {
		return valuesRead, xerrors.New("parquet: number of values / definition levels read did not match")
	}

	return spacedExpand(out, nullCount, validBits, validBitsOffset), nil
}

func (d *DictByteArrayDecoder) InsertDictionary(bldr array.Builder) error {
	conv := d.dictValueDecoder.(*dictConverter[parquet.ByteArray])
	dictLength := cap(conv.dict)
	conv.ensure(pqutils.IndexType(dictLength))

	byteArrayData := memory.NewResizableBuffer(d.mem)
	defer byteArrayData.Release()
	byteArrayOffsets := memory.NewResizableBuffer(d.mem)
	defer byteArrayOffsets.Release()

	var totalLen int
	for _, v := range conv.dict {
		totalLen += len(v)
	}
	byteArrayData.ResizeNoShrink(totalLen)
	byteArrayOffsets.ResizeNoShrink((dictLength + 1) * arrow.Int32SizeBytes)

	byteData := byteArrayData.Bytes()
	byteOffsets := arrow.Int32Traits.CastFromBytes(byteArrayOffsets.Bytes())

	var offset int32
	for i, v := range conv.dict {
		n := copy(byteData, v)
		byteData, byteOffsets[i] = byteData[n:], offset
		offset += int32(n)
	}
	byteOffsets[dictLength] = offset

	data := array.NewData(bldr.Type().(*arrow.DictionaryType).ValueType, dictLength,
		[]*memory.Buffer{nil, byteArrayOffsets, byteArrayData}, nil, 0, 0)
	defer data.Release()
	arr := array.NewBinaryData(data)
	defer arr.Release()

	binaryBldr := bldr.(*array.BinaryDictionaryBuilder)
	return binaryBldr.InsertDictValues(arr)
}
