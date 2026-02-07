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
	"context"
	"errors"
	"fmt"
	"unsafe"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/compute"
	"github.com/apache/arrow-go/v18/arrow/memory"
	"github.com/apache/arrow-go/v18/internal/bitutils"
	shared_utils "github.com/apache/arrow-go/v18/internal/utils"
	"github.com/apache/arrow-go/v18/parquet"
	format "github.com/apache/arrow-go/v18/parquet/internal/gen-go/parquet"
	"github.com/apache/arrow-go/v18/parquet/internal/utils"
	"github.com/apache/arrow-go/v18/parquet/schema"
)

type Encoder[T parquet.ColumnTypes] interface {
	TypedEncoder
	Put([]T)
	PutSpaced([]T, []byte, int64)
}

type BooleanEncoder = Encoder[bool]
type Int32Encoder = Encoder[int32]
type Int64Encoder = Encoder[int64]
type Int96Encoder = Encoder[parquet.Int96]
type Float32Encoder = Encoder[float32]
type Float64Encoder = Encoder[float64]
type ByteArrayEncoder = Encoder[parquet.ByteArray]
type FixedLenByteArrayEncoder = Encoder[parquet.FixedLenByteArray]

type Decoder[T parquet.ColumnTypes] interface {
	TypedDecoder
	Decode([]T) (int, error)
	DecodeSpaced([]T, int, []byte, int64) (int, error)
}

type BooleanDecoder = Decoder[bool]
type Int32Decoder = Decoder[int32]
type Int64Decoder = Decoder[int64]
type Int96Decoder = Decoder[parquet.Int96]
type Float32Decoder = Decoder[float32]
type Float64Decoder = Decoder[float64]
type ByteArrayDecoder = Decoder[parquet.ByteArray]
type FixedLenByteArrayDecoder = Decoder[parquet.FixedLenByteArray]

type int32EncoderTraits = intEncodingTraits[int32]
type int32DecoderTraits = intDecoderTraits[int32]
type int64EncoderTraits = intEncodingTraits[int64]
type int64DecoderTraits = intDecoderTraits[int64]
type float32EncoderTraits = floatEncodingTraits[float32]
type float32DecoderTraits = floatDecoderTraits[float32]
type float64EncoderTraits = floatEncodingTraits[float64]
type float64DecoderTraits = floatDecoderTraits[float64]
type DictInt32Encoder = typedDictEncoder[int32]
type DictInt32Decoder = typedDictDecoder[int32]
type DictInt64Encoder = typedDictEncoder[int64]
type DictInt64Decoder = typedDictDecoder[int64]
type DictInt96Decoder = typedDictDecoder[parquet.Int96]
type DictFloat32Encoder = typedDictEncoder[float32]
type DictFloat32Decoder = typedDictDecoder[float32]
type DictFloat64Encoder = typedDictEncoder[float64]
type DictFloat64Decoder = typedDictDecoder[float64]
type DictFixedLenByteArrayDecoder = typedDictDecoder[parquet.FixedLenByteArray]

type intEncodingTraits[T int32 | int64] struct{}

func (intEncodingTraits[T]) Encoder(e format.Encoding, useDict bool, descr *schema.Column, mem memory.Allocator) TypedEncoder {
	if useDict {
		return &typedDictEncoder[T]{newDictEncoderBase(descr, NewDictionary[T](), mem)}
	}

	switch e {
	case format.Encoding_PLAIN:
		return &PlainEncoder[T]{encoder: newEncoderBase(e, descr, mem)}
	case format.Encoding_DELTA_BINARY_PACKED:
		return &deltaBitPackEncoder[T]{
			encoder: newEncoderBase(e, descr, mem),
		}
	case format.Encoding_BYTE_STREAM_SPLIT:
		return &byteStreamSplitEncoder[T]{
			PlainEncoder: PlainEncoder[T]{
				encoder: newEncoderBase(e, descr, mem),
			},
		}
	default:
		panic("unimplemented encoding for integral types: " + e.String())
	}
}

type floatEncodingTraits[T float32 | float64] struct{}

func (floatEncodingTraits[T]) Encoder(e format.Encoding, useDict bool, descr *schema.Column, mem memory.Allocator) TypedEncoder {
	if useDict {
		return &typedDictEncoder[T]{newDictEncoderBase(descr, NewDictionary[T](), mem)}
	}

	switch e {
	case format.Encoding_PLAIN:
		return &PlainEncoder[T]{encoder: newEncoderBase(e, descr, mem)}
	case format.Encoding_BYTE_STREAM_SPLIT:
		return &byteStreamSplitEncoder[T]{
			PlainEncoder: PlainEncoder[T]{
				encoder: newEncoderBase(e, descr, mem),
			},
		}
	default:
		panic("unimplemented encoding for float types: " + e.String())
	}
}

type typedDictEncoder[T int32 | int64 | float32 | float64] struct {
	dictEncoder
}

func (enc *typedDictEncoder[T]) Type() parquet.Type {
	return parquet.GetColumnType[T]()
}

func (enc *typedDictEncoder[T]) WriteDict(out []byte) {
	enc.memo.(NumericMemoTable).WriteOutLE(out)
}

func (enc *typedDictEncoder[T]) Put(in []T) {
	for _, val := range in {
		enc.dictEncoder.Put(val)
	}
}

func (enc *typedDictEncoder[T]) PutSpaced(in []T, validBits []byte, validBitsOffset int64) {
	bitutils.VisitSetBitRuns(validBits, validBitsOffset, int64(len(in)), func(pos, length int64) error {
		enc.Put(in[pos : pos+length])
		return nil
	})
}

type arrvalues[T arrow.ValueType] interface {
	arrow.TypedArray[T]
	Values() []T
}

func (enc *typedDictEncoder[T]) NormalizeDict(values arrow.Array) (arrow.Array, error) {
	if _, ok := values.(arrvalues[T]); ok {
		values.Retain()
		return values, nil
	}

	ctx := compute.WithAllocator(context.Background(), enc.mem)
	return compute.CastToType(ctx, values, arrow.GetDataType[T]())
}

func (enc *typedDictEncoder[T]) PutDictionary(values arrow.Array) error {
	if err := enc.canPutDictionary(values); err != nil {
		return err
	}

	enc.dictEncodedSize += values.Len() * int(unsafe.Sizeof(T(0)))
	typedMemo := enc.memo.(TypedMemoTable[T])
	data, ok := values.(arrvalues[T])
	if !ok {
		var err error
		ctx := compute.WithAllocator(context.Background(), enc.mem)
		values, err = compute.CastToType(ctx, values, arrow.GetDataType[T]())
		if err != nil {
			return err
		}
		defer values.Release()
		data = values.(arrvalues[T])
	}

	for _, val := range data.Values() {
		if _, _, err := typedMemo.InsertOrGet(val); err != nil {
			return err
		}
	}

	values.Retain()
	enc.preservedDict = values
	return nil
}

type intDecoderTraits[T int32 | int64] struct{}

func (intDecoderTraits[T]) BytesRequired(n int) int {
	return requiredBytes[T](n)
}

func (intDecoderTraits[T]) Decoder(e parquet.Encoding, descr *schema.Column, useDict bool, mem memory.Allocator) TypedDecoder {
	if useDict {
		return &typedDictDecoder[T]{dictDecoder[T]{decoder: newDecoderBase(format.Encoding_RLE_DICTIONARY, descr), mem: mem}}
	}

	switch e {
	case parquet.Encodings.Plain:
		return &PlainDecoder[T]{decoder: newDecoderBase(format.Encoding(e), descr)}
	case parquet.Encodings.DeltaBinaryPacked:
		if mem == nil {
			mem = memory.DefaultAllocator
		}
		return &deltaBitPackDecoder[T]{
			decoder: newDecoderBase(format.Encoding(e), descr),
			mem:     mem,
		}
	case parquet.Encodings.ByteStreamSplit:
		return &ByteStreamSplitDecoder[T]{decoder: newDecoderBase(format.Encoding(e), descr)}
	default:
		panic("unimplemented encoding for integral types: " + e.String())
	}
}

type floatDecoderTraits[T float32 | float64] struct{}

func (floatDecoderTraits[T]) BytesRequired(n int) int {
	return requiredBytes[T](n)
}

func (floatDecoderTraits[T]) Decoder(e parquet.Encoding, descr *schema.Column, useDict bool, mem memory.Allocator) TypedDecoder {
	if useDict {
		return &typedDictDecoder[T]{dictDecoder: dictDecoder[T]{decoder: newDecoderBase(format.Encoding_RLE_DICTIONARY, descr), mem: mem}}
	}

	switch e {
	case parquet.Encodings.Plain:
		return &PlainDecoder[T]{decoder: newDecoderBase(format.Encoding(e), descr)}
	case parquet.Encodings.ByteStreamSplit:
		return &ByteStreamSplitDecoder[T]{decoder: newDecoderBase(format.Encoding(e), descr)}
	default:
		panic("unimplemented encoding for float types: " + e.String())
	}
}

type typedDictDecoder[T int32 | int64 | float32 | float64 | parquet.Int96 | parquet.ByteArray | parquet.FixedLenByteArray] struct {
	dictDecoder[T]
}

func (d *typedDictDecoder[T]) Type() parquet.Type {
	return parquet.GetColumnType[T]()
}

func (d *typedDictDecoder[T]) Discard(n int) (int, error) {
	n = min(n, d.nvals)
	discarded, err := d.discard(n)
	if err != nil {
		return discarded, err
	}

	if n != discarded {
		return discarded, errors.New("parquet: dict eof exception")
	}
	return n, nil
}

func (d *typedDictDecoder[T]) Decode(out []T) (int, error) {
	vals := min(len(out), d.nvals)
	decoded, err := d.decode(out[:vals])
	if err != nil {
		return decoded, err
	}

	if vals != decoded {
		return decoded, errors.New("parquet: dict eof exception")
	}
	return vals, nil
}

func (d *typedDictDecoder[T]) DecodeSpaced(out []T, nullCount int, validBits []byte, validBitsOffset int64) (int, error) {
	vals := min(len(out), d.nvals)
	decoded, err := d.decodeSpaced(out[:vals], nullCount, validBits, validBitsOffset)
	if err != nil {
		return decoded, err
	}

	if vals != decoded {
		return decoded, errors.New("parquet: dict eof exception")
	}
	return vals, nil
}

type dictConverter[T parquet.ColumnTypes] struct {
	valueDecoder Decoder[T]
	dict         []T
	zeroVal      T
}

func (dc *dictConverter[T]) ensure(idx utils.IndexType) error {
	if len(dc.dict) <= int(idx) {
		if cap(dc.dict) <= int(idx) {
			val := make([]T, int(idx+1)-len(dc.dict))
			n, err := dc.valueDecoder.Decode(val)
			if err != nil {
				return err
			}
			dc.dict = append(dc.dict, val[:n]...)
		} else {
			cur := len(dc.dict)
			n, err := dc.valueDecoder.Decode(dc.dict[cur : idx+1])
			if err != nil {
				return err
			}
			dc.dict = dc.dict[:cur+n]
		}
	}
	return nil
}

func (dc *dictConverter[T]) IsValid(idxes ...utils.IndexType) bool {
	min, max := shared_utils.GetMinMaxInt32(*(*[]int32)(unsafe.Pointer(&idxes)))
	dc.ensure(utils.IndexType(max))

	return min >= 0 && int(min) < len(dc.dict) && int(max) >= 0 && int(max) < len(dc.dict)
}

func (dc *dictConverter[T]) IsValidSingle(idx utils.IndexType) bool {
	dc.ensure(idx)
	return int(idx) >= 0 && int(idx) < len(dc.dict)
}

func (dc *dictConverter[T]) Fill(o []T, val utils.IndexType) error {
	if err := dc.ensure(val); err != nil {
		return err
	}
	o[0] = dc.dict[val]
	for i := 1; i < len(o); i *= 2 {
		copy(o[i:], o[:i])
	}
	return nil
}

func (dc *dictConverter[T]) FillZero(o []T) {
	o[0] = dc.zeroVal
	for i := 1; i < len(o); i *= 2 {
		copy(o[i:], o[:i])
	}
}

func (dc *dictConverter[T]) Copy(o []T, vals []utils.IndexType) error {
	for idx, val := range vals {
		o[idx] = dc.dict[val]
	}
	return nil
}

// the int96EncoderTraits struct is used to make it easy to create encoders and decoders based on type
type int96EncoderTraits struct{}

// Encoder returns an encoder for int96 type data, using the specified encoding type and whether or not
// it should be dictionary encoded.
func (int96EncoderTraits) Encoder(e format.Encoding, useDict bool, descr *schema.Column, mem memory.Allocator) TypedEncoder {
	if useDict {
		return &DictInt96Encoder{newDictEncoderBase(descr, NewBinaryDictionary(mem), mem)}
	}

	switch e {
	case format.Encoding_PLAIN:
		return &PlainInt96Encoder{encoder: newEncoderBase(e, descr, mem)}
	default:
		panic("unimplemented encoding type")
	}
}

// int96DecoderTraits is a helper struct for providing information regardless of the type
// and used as a generic way to create a Decoder or Dictionary Decoder for int96 values
type int96DecoderTraits struct{}

// BytesRequired returns the number of bytes required to store n int96 values.
func (int96DecoderTraits) BytesRequired(n int) int {
	return parquet.Int96Traits.BytesRequired(n)
}

// Decoder returns a decoder for int96 typed data of the requested encoding type if available
func (int96DecoderTraits) Decoder(e parquet.Encoding, descr *schema.Column, useDict bool, mem memory.Allocator) TypedDecoder {
	if useDict {
		return &DictInt96Decoder{dictDecoder[parquet.Int96]{decoder: newDecoderBase(format.Encoding_RLE_DICTIONARY, descr), mem: mem}}
	}

	switch e {
	case parquet.Encodings.Plain:
		return &PlainInt96Decoder{decoder: newDecoderBase(format.Encoding(e), descr)}
	default:
		panic("unimplemented encoding type")
	}
}

// DictInt96Encoder is an encoder for parquet.Int96 data using dictionary encoding
type DictInt96Encoder struct {
	dictEncoder
}

// Type returns the underlying physical type that can be encoded with this encoder
func (enc *DictInt96Encoder) Type() parquet.Type {
	return parquet.Types.Int96
}

// WriteDict populates the byte slice with the dictionary index
func (enc *DictInt96Encoder) WriteDict(out []byte) {
	enc.memo.(BinaryMemoTable).CopyFixedWidthValues(0, parquet.Int96SizeBytes, out)
}

// Put encodes the values passed in, adding to the index as needed
func (enc *DictInt96Encoder) Put(in []parquet.Int96) {
	for _, v := range in {
		memoIdx, found, err := enc.memo.GetOrInsert(v)
		if err != nil {
			panic(err)
		}
		if !found {
			enc.dictEncodedSize += parquet.Int96SizeBytes
		}
		enc.addIndex(memoIdx)
	}
}

// PutSpaced is like Put but assumes space for nulls
func (enc *DictInt96Encoder) PutSpaced(in []parquet.Int96, validBits []byte, validBitsOffset int64) {
	bitutils.VisitSetBitRuns(validBits, validBitsOffset, int64(len(in)), func(pos, length int64) error {
		enc.Put(in[pos : pos+length])
		return nil
	})
}

// PutDictionary allows pre-seeding a dictionary encoder with
// a dictionary from an Arrow Array.
//
// The passed in array must not have any nulls and this can only
// be called on an empty encoder.
func (enc *DictInt96Encoder) PutDictionary(arrow.Array) error {
	return fmt.Errorf("%w: direct PutDictionary to Int96", arrow.ErrNotImplemented)
}

// the boolEncoderTraits struct is used to make it easy to create encoders and decoders based on type
type boolEncoderTraits struct{}

// Encoder returns an encoder for bool type data, using the specified encoding type and whether or not
// it should be dictionary encoded.
// dictionary encoding does not exist for this type and Encoder will panic if useDict is true
func (boolEncoderTraits) Encoder(e format.Encoding, useDict bool, descr *schema.Column, mem memory.Allocator) TypedEncoder {
	if useDict {
		panic("parquet: no bool dictionary encoding")
	}

	switch e {
	case format.Encoding_PLAIN:
		return &PlainBooleanEncoder{encoder: newEncoderBase(e, descr, mem)}
	case format.Encoding_RLE:
		return &RleBooleanEncoder{encoder: newEncoderBase(e, descr, mem)}
	default:
		panic("unimplemented encoding type")
	}
}

// boolDecoderTraits is a helper struct for providing information regardless of the type
// and used as a generic way to create a Decoder or Dictionary Decoder for bool values
type boolDecoderTraits struct{}

// BytesRequired returns the number of bytes required to store n bool values.
func (boolDecoderTraits) BytesRequired(n int) int {
	return arrow.BooleanTraits.BytesRequired(n)
}

// Decoder returns a decoder for bool typed data of the requested encoding type if available
func (boolDecoderTraits) Decoder(e parquet.Encoding, descr *schema.Column, useDict bool, mem memory.Allocator) TypedDecoder {
	if useDict {
		panic("dictionary decoding unimplemented for bool")
	}

	switch e {
	case parquet.Encodings.Plain:
		return &PlainBooleanDecoder{decoder: newDecoderBase(format.Encoding(e), descr)}
	case parquet.Encodings.RLE:
		return &RleBooleanDecoder{decoder: newDecoderBase(format.Encoding(e), descr)}
	default:
		panic("unimplemented encoding type")
	}
}

// the byteArrayEncoderTraits struct is used to make it easy to create encoders and decoders based on type
type byteArrayEncoderTraits struct{}

// Encoder returns an encoder for byteArray type data, using the specified encoding type and whether or not
// it should be dictionary encoded.
func (byteArrayEncoderTraits) Encoder(e format.Encoding, useDict bool, descr *schema.Column, mem memory.Allocator) TypedEncoder {
	if useDict {
		return &DictByteArrayEncoder{newDictEncoderBase(descr, NewBinaryDictionary(mem), mem)}
	}

	switch e {
	case format.Encoding_PLAIN:
		return &PlainByteArrayEncoder{encoder: newEncoderBase(e, descr, mem)}
	case format.Encoding_DELTA_LENGTH_BYTE_ARRAY:
		return &DeltaLengthByteArrayEncoder{
			encoder: newEncoderBase(e, descr, mem),
			lengthEncoder: &DeltaBitPackInt32Encoder{
				encoder: newEncoderBase(e, descr, mem),
			},
		}
	case format.Encoding_DELTA_BYTE_ARRAY:
		return &DeltaByteArrayEncoder{
			encoder: newEncoderBase(e, descr, mem),
		}
	default:
		panic("unimplemented encoding type")
	}
}

// byteArrayDecoderTraits is a helper struct for providing information regardless of the type
// and used as a generic way to create a Decoder or Dictionary Decoder for byteArray values
type byteArrayDecoderTraits struct{}

// BytesRequired returns the number of bytes required to store n byteArray values.
func (byteArrayDecoderTraits) BytesRequired(n int) int {
	return parquet.ByteArrayTraits.BytesRequired(n)
}

// Decoder returns a decoder for byteArray typed data of the requested encoding type if available
func (byteArrayDecoderTraits) Decoder(e parquet.Encoding, descr *schema.Column, useDict bool, mem memory.Allocator) TypedDecoder {
	if useDict {
		return &DictByteArrayDecoder{dictDecoder[parquet.ByteArray]{decoder: newDecoderBase(format.Encoding_RLE_DICTIONARY, descr), mem: mem}}
	}

	switch e {
	case parquet.Encodings.Plain:
		return &PlainByteArrayDecoder{decoder: newDecoderBase(format.Encoding(e), descr)}
	case parquet.Encodings.DeltaLengthByteArray:
		if mem == nil {
			mem = memory.DefaultAllocator
		}
		return &DeltaLengthByteArrayDecoder{
			decoder: newDecoderBase(format.Encoding(e), descr),
			mem:     mem,
		}
	case parquet.Encodings.DeltaByteArray:
		if mem == nil {
			mem = memory.DefaultAllocator
		}
		return &DeltaByteArrayDecoder{
			DeltaLengthByteArrayDecoder: &DeltaLengthByteArrayDecoder{
				decoder: newDecoderBase(format.Encoding(e), descr),
				mem:     mem,
			}}
	default:
		panic("unimplemented encoding type")
	}
}

// DictByteArrayEncoder is an encoder for parquet.ByteArray data using dictionary encoding
type DictByteArrayEncoder struct {
	dictEncoder
}

// Type returns the underlying physical type that can be encoded with this encoder
func (enc *DictByteArrayEncoder) Type() parquet.Type {
	return parquet.Types.ByteArray
}

// DictByteArrayDecoder is a decoder for decoding dictionary encoded data for parquet.ByteArray columns
type DictByteArrayDecoder struct {
	dictDecoder[parquet.ByteArray]
}

// Type returns the underlying physical type that can be decoded with this decoder
func (DictByteArrayDecoder) Type() parquet.Type {
	return parquet.Types.ByteArray
}

func (d *DictByteArrayDecoder) Discard(n int) (int, error) {
	n = min(n, d.nvals)
	discarded, err := d.discard(n)
	if err != nil {
		return discarded, err
	}
	if n != discarded {
		return discarded, errors.New("parquet: dict eof exception")
	}
	return n, nil
}

// Decode populates the passed in slice with min(len(out), remaining values) values,
// decoding using the dictionary to get the actual values. Returns the number of values
// actually decoded and any error encountered.
func (d *DictByteArrayDecoder) Decode(out []parquet.ByteArray) (int, error) {
	vals := min(len(out), d.nvals)
	decoded, err := d.decode(out[:vals])
	if err != nil {
		return decoded, err
	}
	if vals != decoded {
		return decoded, errors.New("parquet: dict eof exception")
	}
	return vals, nil
}

// Decode spaced is like Decode but will space out the data leaving slots for null values
// based on the provided bitmap.
func (d *DictByteArrayDecoder) DecodeSpaced(out []parquet.ByteArray, nullCount int, validBits []byte, validBitsOffset int64) (int, error) {
	vals := min(len(out), d.nvals)
	decoded, err := d.decodeSpaced(out[:vals], nullCount, validBits, validBitsOffset)
	if err != nil {
		return decoded, err
	}
	if vals != decoded {
		return decoded, errors.New("parquet: dict spaced eof exception")
	}
	return vals, nil
}

// the fixedLenByteArrayEncoderTraits struct is used to make it easy to create encoders and decoders based on type
type fixedLenByteArrayEncoderTraits struct{}

// Encoder returns an encoder for fixedLenByteArray type data, using the specified encoding type and whether or not
// it should be dictionary encoded.
func (fixedLenByteArrayEncoderTraits) Encoder(e format.Encoding, useDict bool, descr *schema.Column, mem memory.Allocator) TypedEncoder {
	if useDict {
		return &DictFixedLenByteArrayEncoder{newDictEncoderBase(descr, NewBinaryDictionary(mem), mem)}
	}

	switch e {
	case format.Encoding_PLAIN:
		return &PlainFixedLenByteArrayEncoder{encoder: newEncoderBase(e, descr, mem)}
	case format.Encoding_BYTE_STREAM_SPLIT:
		return &ByteStreamSplitFixedLenByteArrayEncoder{PlainFixedLenByteArrayEncoder: PlainFixedLenByteArrayEncoder{encoder: newEncoderBase(e, descr, mem)}}
	default:
		panic("unimplemented encoding type")
	}
}

// fixedLenByteArrayDecoderTraits is a helper struct for providing information regardless of the type
// and used as a generic way to create a Decoder or Dictionary Decoder for fixedLenByteArray values
type fixedLenByteArrayDecoderTraits struct{}

// BytesRequired returns the number of bytes required to store n fixedLenByteArray values.
func (fixedLenByteArrayDecoderTraits) BytesRequired(n int) int {
	return parquet.FixedLenByteArrayTraits.BytesRequired(n)
}

// Decoder returns a decoder for fixedLenByteArray typed data of the requested encoding type if available
func (fixedLenByteArrayDecoderTraits) Decoder(e parquet.Encoding, descr *schema.Column, useDict bool, mem memory.Allocator) TypedDecoder {
	if useDict {
		return &DictFixedLenByteArrayDecoder{dictDecoder[parquet.FixedLenByteArray]{decoder: newDecoderBase(format.Encoding_RLE_DICTIONARY, descr), mem: mem}}
	}

	switch e {
	case parquet.Encodings.Plain:
		return &PlainFixedLenByteArrayDecoder{decoder: newDecoderBase(format.Encoding(e), descr)}
	case parquet.Encodings.ByteStreamSplit:
		return &ByteStreamSplitFixedLenByteArrayDecoder{decoder: newDecoderBase(format.Encoding(e), descr)}
	default:
		panic("unimplemented encoding type")
	}
}

// DictFixedLenByteArrayEncoder is an encoder for parquet.FixedLenByteArray data using dictionary encoding
type DictFixedLenByteArrayEncoder struct {
	dictEncoder
}

// Type returns the underlying physical type that can be encoded with this encoder
func (enc *DictFixedLenByteArrayEncoder) Type() parquet.Type {
	return parquet.Types.FixedLenByteArray
}

// NewDictConverter creates a dict converter of the appropriate type, using the passed in
// decoder as the decoder to decode the dictionary index.
func NewDictConverter[T parquet.ColumnTypes](dict TypedDecoder) utils.DictionaryConverter[T] {
	return &dictConverter[T]{valueDecoder: dict.(Decoder[T]), dict: make([]T, 0, dict.ValuesLeft())}
}

var (
	Int32EncoderTraits             int32EncoderTraits
	Int32DecoderTraits             int32DecoderTraits
	Int64EncoderTraits             int64EncoderTraits
	Int64DecoderTraits             int64DecoderTraits
	Int96EncoderTraits             int96EncoderTraits
	Int96DecoderTraits             int96DecoderTraits
	Float32EncoderTraits           float32EncoderTraits
	Float32DecoderTraits           float32DecoderTraits
	Float64EncoderTraits           float64EncoderTraits
	Float64DecoderTraits           float64DecoderTraits
	BooleanEncoderTraits           boolEncoderTraits
	BooleanDecoderTraits           boolDecoderTraits
	ByteArrayEncoderTraits         byteArrayEncoderTraits
	ByteArrayDecoderTraits         byteArrayDecoderTraits
	FixedLenByteArrayEncoderTraits fixedLenByteArrayEncoderTraits
	FixedLenByteArrayDecoderTraits fixedLenByteArrayDecoderTraits
)

// helper function to get encoding traits object for the physical type indicated
func getEncodingTraits(t parquet.Type) EncoderTraits {
	switch t {
	case parquet.Types.Int32:
		return Int32EncoderTraits
	case parquet.Types.Int64:
		return Int64EncoderTraits
	case parquet.Types.Int96:
		return Int96EncoderTraits
	case parquet.Types.Float:
		return Float32EncoderTraits
	case parquet.Types.Double:
		return Float64EncoderTraits
	case parquet.Types.Boolean:
		return BooleanEncoderTraits
	case parquet.Types.ByteArray:
		return ByteArrayEncoderTraits
	case parquet.Types.FixedLenByteArray:
		return FixedLenByteArrayEncoderTraits
	default:
		return nil
	}
}

// helper function to get decoding traits object for the physical type indicated
func getDecodingTraits(t parquet.Type) DecoderTraits {
	switch t {
	case parquet.Types.Int32:
		return Int32DecoderTraits
	case parquet.Types.Int64:
		return Int64DecoderTraits
	case parquet.Types.Int96:
		return Int96DecoderTraits
	case parquet.Types.Float:
		return Float32DecoderTraits
	case parquet.Types.Double:
		return Float64DecoderTraits
	case parquet.Types.Boolean:
		return BooleanDecoderTraits
	case parquet.Types.ByteArray:
		return ByteArrayDecoderTraits
	case parquet.Types.FixedLenByteArray:
		return FixedLenByteArrayDecoderTraits
	default:
		return nil
	}
}
