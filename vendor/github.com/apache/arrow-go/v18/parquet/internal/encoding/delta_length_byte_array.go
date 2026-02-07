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
	"github.com/apache/arrow-go/v18/arrow/memory"
	"github.com/apache/arrow-go/v18/internal/utils"
	"github.com/apache/arrow-go/v18/parquet"
	"golang.org/x/xerrors"
)

// DeltaLengthByteArrayEncoder encodes data using by taking all of the byte array lengths
// and encoding them in front using delta encoding, followed by all of the binary data
// concatenated back to back. The expected savings is from the cost of encoding the lengths
// and possibly better compression in the data which will no longer be interleaved with the lengths.
//
// This encoding is always preferred over PLAIN for byte array columns where possible.
//
// For example, if the data was "Hello", "World", "Foobar", "ABCDEF" the encoded data would be:
// DeltaEncoding(5, 5, 6, 6) "HelloWorldFoobarABCDEF"
type DeltaLengthByteArrayEncoder struct {
	encoder

	lengthEncoder *DeltaBitPackInt32Encoder
}

// Put writes the provided slice of byte arrays to the encoder
func (enc *DeltaLengthByteArrayEncoder) Put(in []parquet.ByteArray) {
	lengths := make([]int32, len(in))
	totalLen := int(0)
	for idx, val := range in {
		lengths[idx] = int32(val.Len())
		totalLen += val.Len()
	}

	enc.lengthEncoder.Put(lengths)
	enc.sink.Reserve(totalLen)
	for _, val := range in {
		enc.sink.UnsafeWrite(val)
	}
}

// PutSpaced is like Put, but the data is spaced out according to the bitmap provided and is compressed
// accordingly before it is written to drop the null data from the write.
func (enc *DeltaLengthByteArrayEncoder) PutSpaced(in []parquet.ByteArray, validBits []byte, validBitsOffset int64) {
	if validBits != nil {
		data := make([]parquet.ByteArray, len(in))
		nvalid := spacedCompress(in, data, validBits, validBitsOffset)
		enc.Put(data[:nvalid])
	} else {
		enc.Put(in)
	}
}

// Type returns the underlying type which is handled by this encoder, ByteArrays only.
func (DeltaLengthByteArrayEncoder) Type() parquet.Type {
	return parquet.Types.ByteArray
}

// FlushValues flushes any remaining data and returns the final encoded buffer of data
// or returns nil and any error encountered.
func (enc *DeltaLengthByteArrayEncoder) FlushValues() (Buffer, error) {
	ret, err := enc.lengthEncoder.FlushValues()
	if err != nil {
		return nil, err
	}
	defer ret.Release()

	data := enc.sink.Finish()
	defer data.Release()

	output := bufferPool.Get().(*memory.Buffer)
	output.ResizeNoShrink(ret.Len() + data.Len())
	copy(output.Bytes(), ret.Bytes())
	copy(output.Bytes()[ret.Len():], data.Bytes())
	return poolBuffer{output}, nil
}

// DeltaLengthByteArrayDecoder is a decoder for handling data produced by the corresponding
// encoder which expects delta packed lengths followed by the bytes of data.
type DeltaLengthByteArrayDecoder struct {
	decoder

	mem     memory.Allocator
	lengths []int32
}

// Type returns the underlying type which is handled by this encoder, ByteArrays only.
func (DeltaLengthByteArrayDecoder) Type() parquet.Type {
	return parquet.Types.ByteArray
}

func (d *DeltaLengthByteArrayDecoder) Allocator() memory.Allocator { return d.mem }

// SetData sets in the expected data to the decoder which should be nvalues delta packed lengths
// followed by the rest of the byte array data immediately after.
func (d *DeltaLengthByteArrayDecoder) SetData(nvalues int, data []byte) error {
	dec := DeltaBitPackInt32Decoder{
		decoder: newDecoderBase(d.encoding, d.descr),
		mem:     d.mem,
	}

	if err := dec.SetData(nvalues, data); err != nil {
		return err
	}
	d.lengths = make([]int32, dec.totalValues)
	dec.Decode(d.lengths)

	return d.decoder.SetData(nvalues, data[int(dec.bytesRead()):])
}

func (d *DeltaLengthByteArrayDecoder) Discard(n int) (int, error) {
	n = min(n, d.nvals)
	for i := 0; i < n; i++ {
		d.data = d.data[d.lengths[i]:]
	}
	d.nvals -= n
	d.lengths = d.lengths[n:]
	return n, nil
}

// Decode populates the passed in slice with data decoded until it hits the length of out
// or runs out of values in the column to decode, then returns the number of values actually decoded.
func (d *DeltaLengthByteArrayDecoder) Decode(out []parquet.ByteArray) (int, error) {
	max := utils.Min(len(out), d.nvals)
	for i := 0; i < max; i++ {
		out[i] = d.data[:d.lengths[i]:d.lengths[i]]
		d.data = d.data[d.lengths[i]:]
	}
	d.nvals -= max
	d.lengths = d.lengths[max:]
	return max, nil
}

// DecodeSpaced is like Decode, but for spaced data using the provided bitmap to determine where the nulls should be inserted.
func (d *DeltaLengthByteArrayDecoder) DecodeSpaced(out []parquet.ByteArray, nullCount int, validBits []byte, validBitsOffset int64) (int, error) {
	toread := len(out) - nullCount
	values, _ := d.Decode(out[:toread])
	if values != toread {
		return values, xerrors.New("parquet: number of values / definition levels read did not match")
	}

	return spacedExpand(out, nullCount, validBits, validBitsOffset), nil
}
