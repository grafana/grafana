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
	"math/bits"
	"reflect"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/bitutil"
	"github.com/apache/arrow-go/v18/arrow/memory"
	"github.com/apache/arrow-go/v18/internal/bitutils"
	"github.com/apache/arrow-go/v18/parquet"
	format "github.com/apache/arrow-go/v18/parquet/internal/gen-go/parquet"
	"github.com/apache/arrow-go/v18/parquet/internal/utils"
	"github.com/apache/arrow-go/v18/parquet/schema"
)

//go:generate go run ../../../arrow/_tools/tmpl/main.go -i -data=physical_types.tmpldata plain_encoder_types.gen.go.tmpl typed_encoder.gen.go.tmpl

// EncoderTraits is an interface for the different types to make it more
// convenient to construct encoders for specific types.
type EncoderTraits interface {
	Encoder(format.Encoding, bool, *schema.Column, memory.Allocator) TypedEncoder
}

// NewEncoder will return the appropriately typed encoder for the requested physical type
// and encoding.
//
// If mem is nil, memory.DefaultAllocator will be used.
func NewEncoder(t parquet.Type, e parquet.Encoding, useDict bool, descr *schema.Column, mem memory.Allocator) TypedEncoder {
	traits := getEncodingTraits(t)
	if traits == nil {
		return nil
	}

	if mem == nil {
		mem = memory.DefaultAllocator
	}
	return traits.Encoder(format.Encoding(e), useDict, descr, mem)
}

type encoder struct {
	descr    *schema.Column
	encoding format.Encoding
	typeLen  int
	mem      memory.Allocator

	sink *PooledBufferWriter
}

// newEncoderBase constructs a new base encoder for embedding on the typed encoders
// encapsulating the common functionality.
func newEncoderBase(e format.Encoding, descr *schema.Column, mem memory.Allocator) encoder {
	typelen := -1
	if descr != nil && descr.PhysicalType() == parquet.Types.FixedLenByteArray {
		typelen = int(descr.TypeLength())
	}
	return encoder{
		descr:    descr,
		encoding: e,
		mem:      mem,
		typeLen:  typelen,
		sink:     NewPooledBufferWriter(1024),
	}
}

func (e *encoder) Release() {
	poolbuf := e.sink.buf
	memory.Set(poolbuf.Buf(), 0)
	poolbuf.ResizeNoShrink(0)
	bufferPool.Put(poolbuf)
	e.sink = nil
}

// ReserveForWrite allocates n bytes so that the next n bytes written do not require new allocations.
func (e *encoder) ReserveForWrite(n int)           { e.sink.Reserve(n) }
func (e *encoder) EstimatedDataEncodedSize() int64 { return int64(e.sink.Len()) }
func (e *encoder) Encoding() parquet.Encoding      { return parquet.Encoding(e.encoding) }
func (e *encoder) Allocator() memory.Allocator     { return e.mem }
func (e *encoder) append(data []byte)              { e.sink.Write(data) }

// FlushValues flushes any unwritten data to the buffer and returns the finished encoded buffer of data.
// This also clears the encoder, ownership of the data belongs to whomever called FlushValues, Release
// should be called on the resulting Buffer when done.
func (e *encoder) FlushValues() (Buffer, error) { return e.sink.Finish(), nil }

// Bytes returns the current bytes that have been written to the encoder's buffer but doesn't transfer ownership.
func (e *encoder) Bytes() []byte { return e.sink.Bytes() }

// Reset drops the data currently in the encoder and resets for new use.
func (e *encoder) Reset() { e.sink.Reset(0) }

type dictEncoder struct {
	encoder

	dictEncodedSize int
	idxBuffer       *memory.Buffer
	idxValues       []int32
	memo            MemoTable

	preservedDict arrow.Array
}

// newDictEncoderBase constructs and returns a dictionary encoder for the appropriate type using the passed
// in memo table for constructing the index.
func newDictEncoderBase(descr *schema.Column, memo MemoTable, mem memory.Allocator) dictEncoder {
	return dictEncoder{
		encoder:   newEncoderBase(format.Encoding_PLAIN_DICTIONARY, descr, mem),
		idxBuffer: memory.NewResizableBuffer(mem),
		memo:      memo,
	}
}

// Reset drops all the currently encoded values from the index and indexes from the data to allow
// restarting the encoding process.
func (d *dictEncoder) Reset() {
	d.encoder.Reset()
	d.dictEncodedSize = 0
	d.idxValues = d.idxValues[:0]
	d.idxBuffer.ResizeNoShrink(0)
	d.memo.Reset()
	if d.preservedDict != nil {
		d.preservedDict.Release()
		d.preservedDict = nil
	}
}

func (d *dictEncoder) Release() {
	d.encoder.Release()
	d.idxBuffer.Release()
	if m, ok := d.memo.(BinaryMemoTable); ok {
		m.Release()
	} else {
		d.memo.Reset()
	}
	if d.preservedDict != nil {
		d.preservedDict.Release()
		d.preservedDict = nil
	}
}

func (d *dictEncoder) expandBuffer(newCap int) {
	if cap(d.idxValues) >= newCap {
		return
	}

	curLen := len(d.idxValues)
	d.idxBuffer.ResizeNoShrink(arrow.Int32Traits.BytesRequired(bitutil.NextPowerOf2(newCap)))
	d.idxValues = arrow.Int32Traits.CastFromBytes(d.idxBuffer.Buf())[: curLen : d.idxBuffer.Len()/arrow.Int32SizeBytes]
}

func (d *dictEncoder) PutIndices(data arrow.Array) error {
	newValues := data.Len() - data.NullN()
	curPos := len(d.idxValues)
	newLen := newValues + curPos
	d.expandBuffer(newLen)
	d.idxValues = d.idxValues[:newLen:cap(d.idxValues)]

	switch data.DataType().ID() {
	case arrow.UINT8, arrow.INT8:
		values := arrow.Uint8Traits.CastFromBytes(data.Data().Buffers()[1].Bytes())[data.Data().Offset():]
		bitutils.VisitSetBitRunsNoErr(data.NullBitmapBytes(),
			int64(data.Data().Offset()), int64(data.Len()),
			func(pos, length int64) {
				for i := int64(0); i < length; i++ {
					d.idxValues[curPos] = int32(values[i+pos])
					curPos++
				}
			})
	case arrow.UINT16, arrow.INT16:
		values := arrow.Uint16Traits.CastFromBytes(data.Data().Buffers()[1].Bytes())[data.Data().Offset():]
		bitutils.VisitSetBitRunsNoErr(data.NullBitmapBytes(),
			int64(data.Data().Offset()), int64(data.Len()),
			func(pos, length int64) {
				for i := int64(0); i < length; i++ {
					d.idxValues[curPos] = int32(values[i+pos])
					curPos++
				}
			})
	case arrow.UINT32, arrow.INT32:
		values := arrow.Uint32Traits.CastFromBytes(data.Data().Buffers()[1].Bytes())[data.Data().Offset():]
		bitutils.VisitSetBitRunsNoErr(data.NullBitmapBytes(),
			int64(data.Data().Offset()), int64(data.Len()),
			func(pos, length int64) {
				for i := int64(0); i < length; i++ {
					d.idxValues[curPos] = int32(values[i+pos])
					curPos++
				}
			})
	case arrow.UINT64, arrow.INT64:
		values := arrow.Uint64Traits.CastFromBytes(data.Data().Buffers()[1].Bytes())[data.Data().Offset():]
		bitutils.VisitSetBitRunsNoErr(data.NullBitmapBytes(),
			int64(data.Data().Offset()), int64(data.Len()),
			func(pos, length int64) {
				for i := int64(0); i < length; i++ {
					d.idxValues[curPos] = int32(values[i+pos])
					curPos++
				}
			})
	default:
		return fmt.Errorf("%w: passed non-integer array to PutIndices", arrow.ErrInvalid)
	}

	return nil
}

// append the passed index to the indexbuffer
func (d *dictEncoder) addIndex(idx int) {
	curLen := len(d.idxValues)
	d.expandBuffer(curLen + 1)
	d.idxValues = append(d.idxValues, int32(idx))
}

// FlushValues dumps all the currently buffered indexes that would become the data page to a buffer and
// returns it or returns nil and any error encountered.
func (d *dictEncoder) FlushValues() (Buffer, error) {
	buf := bufferPool.Get().(*memory.Buffer)
	buf.Reserve(int(d.EstimatedDataEncodedSize()))
	size, err := d.WriteIndices(buf.Buf())
	if err != nil {
		poolBuffer{buf}.Release()
		return nil, err
	}
	buf.ResizeNoShrink(size)
	return poolBuffer{buf}, nil
}

// EstimatedDataEncodedSize returns the maximum number of bytes needed to store the RLE encoded indexes, not including the
// dictionary index in the computation.
func (d *dictEncoder) EstimatedDataEncodedSize() int64 {
	return 1 + int64(utils.MaxRLEBufferSize(d.BitWidth(), len(d.idxValues))+utils.MinRLEBufferSize(d.BitWidth()))
}

// NumEntries returns the number of entires in the dictionary index for this encoder.
func (d *dictEncoder) NumEntries() int {
	return d.memo.Size()
}

// BitWidth returns the max bitwidth that would be necessary for encoding the index values currently
// in the dictionary based on the size of the dictionary index.
func (d *dictEncoder) BitWidth() int {
	switch d.NumEntries() {
	case 0:
		return 0
	case 1:
		return 1
	default:
		return bits.Len32(uint32(d.NumEntries() - 1))
	}
}

// WriteDict writes the dictionary index to the given byte slice.
func (d *dictEncoder) WriteDict(out []byte) {
	d.memo.WriteOut(out)
}

// WriteIndices performs Run Length encoding on the indexes and the writes the encoded
// index value data to the provided byte slice, returning the number of bytes actually written.
// If any error is encountered, it will return -1 and the error.
func (d *dictEncoder) WriteIndices(out []byte) (int, error) {
	out[0] = byte(d.BitWidth())

	enc := utils.NewRleEncoder(utils.NewWriterAtBuffer(out[1:]), d.BitWidth())
	for _, idx := range d.idxValues {
		if err := enc.Put(uint64(idx)); err != nil {
			return -1, err
		}
	}
	nbytes := enc.Flush()

	d.idxValues = d.idxValues[:0]
	return nbytes + 1, nil
}

// Put adds a value to the dictionary data column, inserting the value if it
// didn't already exist in the dictionary.
func (d *dictEncoder) Put(v interface{}) {
	memoIdx, found, err := d.memo.GetOrInsert(v)
	if err != nil {
		panic(err)
	}
	if !found {
		d.dictEncodedSize += int(reflect.TypeOf(v).Size())
	}
	d.addIndex(memoIdx)
}

// DictEncodedSize returns the current size of the encoded dictionary
func (d *dictEncoder) DictEncodedSize() int {
	return d.dictEncodedSize
}

func (d *dictEncoder) canPutDictionary(values arrow.Array) error {
	switch {
	case values.NullN() > 0:
		return fmt.Errorf("%w: inserted dictionary cannot contain nulls",
			arrow.ErrInvalid)
	case d.NumEntries() > 0:
		return fmt.Errorf("%w: can only call PutDictionary on an empty DictEncoder",
			arrow.ErrInvalid)
	}

	return nil
}

func (d *dictEncoder) PreservedDictionary() arrow.Array { return d.preservedDict }

// spacedCompress is a helper function for encoders to remove the slots in the slices passed in according
// to the bitmap which are null into an output slice that is no longer spaced out with slots for nulls.
func spacedCompress(src, out interface{}, validBits []byte, validBitsOffset int64) int {
	nvalid := 0

	// for efficiency we use a type switch because the copy runs significantly faster when typed
	// than calling reflect.Copy
	switch s := src.(type) {
	case []int32:
		o := out.([]int32)
		reader := bitutils.NewSetBitRunReader(validBits, validBitsOffset, int64(len(s)))
		for {
			run := reader.NextRun()
			if run.Length == 0 {
				break
			}
			copy(o[nvalid:], s[int(run.Pos):int(run.Pos+run.Length)])
			nvalid += int(run.Length)
		}
	case []int64:
		o := out.([]int64)
		reader := bitutils.NewSetBitRunReader(validBits, validBitsOffset, int64(len(s)))
		for {
			run := reader.NextRun()
			if run.Length == 0 {
				break
			}
			copy(o[nvalid:], s[int(run.Pos):int(run.Pos+run.Length)])
			nvalid += int(run.Length)
		}
	case []float32:
		o := out.([]float32)
		reader := bitutils.NewSetBitRunReader(validBits, validBitsOffset, int64(len(s)))
		for {
			run := reader.NextRun()
			if run.Length == 0 {
				break
			}
			copy(o[nvalid:], s[int(run.Pos):int(run.Pos+run.Length)])
			nvalid += int(run.Length)
		}
	case []float64:
		o := out.([]float64)
		reader := bitutils.NewSetBitRunReader(validBits, validBitsOffset, int64(len(s)))
		for {
			run := reader.NextRun()
			if run.Length == 0 {
				break
			}
			copy(o[nvalid:], s[int(run.Pos):int(run.Pos+run.Length)])
			nvalid += int(run.Length)
		}
	case []parquet.ByteArray:
		o := out.([]parquet.ByteArray)
		reader := bitutils.NewSetBitRunReader(validBits, validBitsOffset, int64(len(s)))
		for {
			run := reader.NextRun()
			if run.Length == 0 {
				break
			}
			copy(o[nvalid:], s[int(run.Pos):int(run.Pos+run.Length)])
			nvalid += int(run.Length)
		}
	case []parquet.FixedLenByteArray:
		o := out.([]parquet.FixedLenByteArray)
		reader := bitutils.NewSetBitRunReader(validBits, validBitsOffset, int64(len(s)))
		for {
			run := reader.NextRun()
			if run.Length == 0 {
				break
			}
			copy(o[nvalid:], s[int(run.Pos):int(run.Pos+run.Length)])
			nvalid += int(run.Length)
		}
	case []bool:
		o := out.([]bool)
		reader := bitutils.NewSetBitRunReader(validBits, validBitsOffset, int64(len(s)))
		for {
			run := reader.NextRun()
			if run.Length == 0 {
				break
			}
			copy(o[nvalid:], s[int(run.Pos):int(run.Pos+run.Length)])
			nvalid += int(run.Length)
		}
	}

	return nvalid
}
