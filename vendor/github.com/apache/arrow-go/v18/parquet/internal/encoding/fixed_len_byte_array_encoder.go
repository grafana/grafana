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
	"fmt"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/internal/bitutils"
	"github.com/apache/arrow-go/v18/parquet"
)

// PlainFixedLenByteArrayEncoder writes the raw bytes of the byte array
// always writing typeLength bytes for each value.
type PlainFixedLenByteArrayEncoder struct {
	encoder

	bitSetReader bitutils.SetBitRunReader
}

// Put writes the provided values to the encoder
func (enc *PlainFixedLenByteArrayEncoder) Put(in []parquet.FixedLenByteArray) {
	typeLen := enc.descr.TypeLength()
	if typeLen == 0 {
		return
	}

	bytesNeeded := len(in) * typeLen
	enc.sink.Reserve(bytesNeeded)

	emptyValue := make([]byte, typeLen)

	for _, val := range in {
		if val == nil {
			enc.sink.UnsafeWrite(emptyValue)
		} else {
			enc.sink.UnsafeWrite(val[:typeLen])
		}
	}
}

// PutSpaced is like Put but works with data that is spaced out according to the passed in bitmap
func (enc *PlainFixedLenByteArrayEncoder) PutSpaced(in []parquet.FixedLenByteArray, validBits []byte, validBitsOffset int64) {
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

// Type returns the underlying physical type this encoder works with, Fixed Length byte arrays.
func (PlainFixedLenByteArrayEncoder) Type() parquet.Type {
	return parquet.Types.FixedLenByteArray
}

// ByteStreamSplitFixedLenByteArrayEncoder writes the underlying bytes of the FixedLenByteArray
// into interlaced streams as defined by the BYTE_STREAM_SPLIT encoding
type ByteStreamSplitFixedLenByteArrayEncoder struct {
	PlainFixedLenByteArrayEncoder
	flushBuffer *PooledBufferWriter
}

func (enc *ByteStreamSplitFixedLenByteArrayEncoder) FlushValues() (Buffer, error) {
	in, err := enc.PlainFixedLenByteArrayEncoder.FlushValues()
	if err != nil {
		return nil, err
	}

	if enc.flushBuffer == nil {
		enc.flushBuffer = NewPooledBufferWriter(in.Len())
	}

	enc.flushBuffer.buf.ResizeNoShrink(in.Len())

	switch enc.typeLen {
	case 2:
		encodeByteStreamSplitWidth2(enc.flushBuffer.Bytes(), in.Bytes())
	case 4:
		encodeByteStreamSplitWidth4(enc.flushBuffer.Bytes(), in.Bytes())
	case 8:
		encodeByteStreamSplitWidth8(enc.flushBuffer.Bytes(), in.Bytes())
	default:
		encodeByteStreamSplit(enc.flushBuffer.Bytes(), in.Bytes(), enc.typeLen)
	}

	return enc.flushBuffer.Finish(), nil
}

func (enc *ByteStreamSplitFixedLenByteArrayEncoder) Release() {
	enc.PlainFixedLenByteArrayEncoder.Release()
	releaseBufferToPool(enc.flushBuffer)
	enc.flushBuffer = nil
}

// WriteDict overrides the embedded WriteDict function to call a specialized function
// for copying out the Fixed length values from the dictionary more efficiently.
func (enc *DictFixedLenByteArrayEncoder) WriteDict(out []byte) {
	enc.memo.(BinaryMemoTable).CopyFixedWidthValues(0, enc.typeLen, out)
}

// Put writes fixed length values to a dictionary encoded column
func (enc *DictFixedLenByteArrayEncoder) Put(in []parquet.FixedLenByteArray) {
	for _, v := range in {
		memoIdx, found, err := enc.memo.GetOrInsert(v)
		if err != nil {
			panic(err)
		}
		if !found {
			enc.dictEncodedSize += enc.typeLen
		}
		enc.addIndex(memoIdx)
	}
}

// PutSpaced is like Put but leaves space for nulls
func (enc *DictFixedLenByteArrayEncoder) PutSpaced(in []parquet.FixedLenByteArray, validBits []byte, validBitsOffset int64) {
	bitutils.VisitSetBitRuns(validBits, validBitsOffset, int64(len(in)), func(pos, length int64) error {
		enc.Put(in[pos : pos+length])
		return nil
	})
}

func (enc *DictFixedLenByteArrayEncoder) NormalizeDict(values arrow.Array) (arrow.Array, error) {
	values.Retain()
	return values, nil
}

// PutDictionary allows pre-seeding a dictionary encoder with
// a dictionary from an Arrow Array.
//
// The passed in array must not have any nulls and this can only
// be called on an empty encoder.
func (enc *DictFixedLenByteArrayEncoder) PutDictionary(values arrow.Array) error {
	if values.DataType().ID() != arrow.FIXED_SIZE_BINARY && values.DataType().ID() != arrow.DECIMAL {
		return fmt.Errorf("%w: only fixed size binary and decimal128 arrays are supported", arrow.ErrInvalid)
	}

	if values.DataType().(arrow.FixedWidthDataType).Bytes() != enc.typeLen {
		return fmt.Errorf("%w: size mismatch: %s should have been %d wide",
			arrow.ErrInvalid, values.DataType(), enc.typeLen)
	}

	if err := enc.canPutDictionary(values); err != nil {
		return err
	}

	enc.dictEncodedSize += enc.typeLen * values.Len()
	data := values.Data().Buffers()[1].Bytes()[values.Data().Offset()*enc.typeLen:]
	for i := 0; i < values.Len(); i++ {
		_, _, err := enc.memo.GetOrInsert(data[i*enc.typeLen : (i+1)*enc.typeLen])
		if err != nil {
			return err
		}
	}

	values.Retain()
	enc.preservedDict = values
	return nil
}
