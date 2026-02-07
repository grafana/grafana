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
	"fmt"
	"unsafe"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/array"
	"github.com/apache/arrow-go/v18/internal/bitutils"
	"github.com/apache/arrow-go/v18/internal/utils"
	"github.com/apache/arrow-go/v18/parquet"
)

// PlainByteArrayEncoder encodes byte arrays according to the spec for Plain encoding
// by encoding the length as a int32 followed by the bytes of the value.
type PlainByteArrayEncoder struct {
	encoder

	bitSetReader bitutils.SetBitRunReader
}

// PutByteArray writes out the 4 bytes for the length followed by the data
func (enc *PlainByteArrayEncoder) PutByteArray(val parquet.ByteArray) {
	inc := val.Len() + arrow.Uint32SizeBytes
	enc.sink.Reserve(inc)
	vlen := utils.ToLEUint32(uint32(val.Len()))
	enc.sink.UnsafeWrite((*(*[4]byte)(unsafe.Pointer(&vlen)))[:])
	enc.sink.UnsafeWrite(val)
}

// Put writes out all of the values in this slice to the encoding sink
func (enc *PlainByteArrayEncoder) Put(in []parquet.ByteArray) {
	for _, val := range in {
		enc.PutByteArray(val)
	}
}

// PutSpaced uses the bitmap of validBits to leave out anything that is null according
// to the bitmap.
//
// If validBits is nil, this is equivalent to calling Put
func (enc *PlainByteArrayEncoder) PutSpaced(in []parquet.ByteArray, validBits []byte, validBitsOffset int64) {
	if validBits != nil {
		if enc.bitSetReader == nil {
			enc.bitSetReader = bitutils.NewSetBitRunReader(validBits, validBitsOffset, int64(len(in)))
		} else {
			enc.bitSetReader.Reset(validBits, validBitsOffset, int64(len(in)))
		}

		for {
			run := enc.bitSetReader.NextRun()
			if run.Length == 0 {
				break
			}
			enc.Put(in[int(run.Pos):int(run.Pos+run.Length)])
		}
	} else {
		enc.Put(in)
	}
}

// Type returns parquet.Types.ByteArray for the bytearray encoder
func (PlainByteArrayEncoder) Type() parquet.Type {
	return parquet.Types.ByteArray
}

// WriteDict writes the dictionary out to the provided slice, out should be
// at least DictEncodedSize() bytes
func (enc *DictByteArrayEncoder) WriteDict(out []byte) {
	enc.memo.(BinaryMemoTable).VisitValues(0, func(v []byte) {
		binary.LittleEndian.PutUint32(out, uint32(len(v)))
		out = out[arrow.Uint32SizeBytes:]
		copy(out, v)
		out = out[len(v):]
	})
}

// PutByteArray adds a single byte array to buffer, updating the dictionary
// and encoded size if it's a new value
func (enc *DictByteArrayEncoder) PutByteArray(in parquet.ByteArray) {
	memoIdx, found, err := enc.memo.GetOrInsert(in)
	if err != nil {
		panic(err)
	}
	if !found {
		enc.dictEncodedSize += in.Len() + arrow.Uint32SizeBytes
	}
	enc.addIndex(memoIdx)
}

// Put takes a slice of ByteArrays to add and encode.
func (enc *DictByteArrayEncoder) Put(in []parquet.ByteArray) {
	for _, val := range in {
		enc.PutByteArray(val)
	}
}

// PutSpaced like with the non-dict encoder leaves out the values where the validBits bitmap is 0
func (enc *DictByteArrayEncoder) PutSpaced(in []parquet.ByteArray, validBits []byte, validBitsOffset int64) {
	bitutils.VisitSetBitRuns(validBits, validBitsOffset, int64(len(in)), func(pos, length int64) error {
		for i := int64(0); i < length; i++ {
			enc.PutByteArray(in[i+pos])
		}
		return nil
	})
}

func (enc *DictByteArrayEncoder) NormalizeDict(values arrow.Array) (arrow.Array, error) {
	values.Retain()
	return values, nil
}

// PutDictionary allows pre-seeding a dictionary encoder with
// a dictionary from an Arrow Array.
//
// The passed in array must not have any nulls and this can only
// be called on an empty encoder.
func (enc *DictByteArrayEncoder) PutDictionary(values arrow.Array) error {
	if err := enc.canPutDictionary(values); err != nil {
		return err
	}

	if !arrow.IsBaseBinary(values.DataType().ID()) {
		return fmt.Errorf("%w: only binary and string arrays are supported", arrow.ErrInvalid)
	}

	arr := values.(array.BinaryLike)
	data := arr.ValueBytes()
	for i := 0; i < arr.Len(); i++ {
		curOffset := arr.ValueOffset64(i)
		var v []byte
		if i == arr.Len()-1 {
			v = data[curOffset:]
		} else {
			v = data[curOffset:arr.ValueOffset64(i+1)]
		}
		enc.dictEncodedSize += len(v) + arrow.Uint32SizeBytes
		if _, _, err := enc.memo.GetOrInsert(v); err != nil {
			return err
		}
	}

	values.Retain()
	enc.preservedDict = values
	return nil
}
