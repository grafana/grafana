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
	"math"

	"github.com/apache/arrow-go/v18/arrow"
	"github.com/apache/arrow-go/v18/arrow/memory"
	"github.com/apache/arrow-go/v18/parquet"
	"github.com/apache/arrow-go/v18/parquet/internal/debug"
	"golang.org/x/xerrors"
)

// encodeByteStreamSplit encodes the raw bytes provided by 'in' into the output buffer 'data' using BYTE_STREAM_SPLIT encoding.
// 'data' must have space for at least len(in) bytes.
func encodeByteStreamSplit(data []byte, in []byte, width int) {
	debug.Assert(len(data) >= len(in), fmt.Sprintf("not enough space in destination buffer for encoding, dest: %d bytes, src: %d bytes", len(data), len(in)))
	numElements := len(in) / width
	for stream := 0; stream < width; stream++ {
		for element := 0; element < numElements; element++ {
			encLoc := numElements*stream + element
			decLoc := width*element + stream
			data[encLoc] = in[decLoc]
		}
	}
}

// encodeByteStreamSplitWidth2 implements encodeByteStreamSplit optimized for types stored using 2 bytes.
// 'data' must have space for at least len(in) bytes.
func encodeByteStreamSplitWidth2(data []byte, in []byte) {
	debug.Assert(len(data) >= len(in), fmt.Sprintf("not enough space in destination buffer for encoding, dest: %d bytes, src: %d bytes", len(data), len(in)))
	const width = 2
	numElements := len(in) / width
	for element := 0; element < numElements; element++ {
		decLoc := width * element
		data[element] = in[decLoc]
		data[numElements+element] = in[decLoc+1]
	}
}

// encodeByteStreamSplitWidth4 implements encodeByteStreamSplit optimized for types stored using 4 bytes.
// 'data' must have space for at least len(in) bytes.
func encodeByteStreamSplitWidth4(data []byte, in []byte) {
	debug.Assert(len(data) >= len(in), fmt.Sprintf("not enough space in destination buffer for encoding, dest: %d bytes, src: %d bytes", len(data), len(in)))
	const width = 4
	numElements := len(in) / width
	for element := 0; element < numElements; element++ {
		decLoc := width * element
		data[element] = in[decLoc]
		data[numElements+element] = in[decLoc+1]
		data[numElements*2+element] = in[decLoc+2]
		data[numElements*3+element] = in[decLoc+3]
	}
}

// encodeByteStreamSplitWidth8 implements encodeByteStreamSplit optimized for types stored using 8 bytes.
// 'data' must have space for at least len(in) bytes.
func encodeByteStreamSplitWidth8(data []byte, in []byte) {
	debug.Assert(len(data) >= len(in), fmt.Sprintf("not enough space in destination buffer for encoding, dest: %d bytes, src: %d bytes", len(data), len(in)))
	const width = 8
	numElements := len(in) / width
	for element := 0; element < numElements; element++ {
		decLoc := width * element
		data[element] = in[decLoc]
		data[numElements+element] = in[decLoc+1]
		data[numElements*2+element] = in[decLoc+2]
		data[numElements*3+element] = in[decLoc+3]
		data[numElements*4+element] = in[decLoc+4]
		data[numElements*5+element] = in[decLoc+5]
		data[numElements*6+element] = in[decLoc+6]
		data[numElements*7+element] = in[decLoc+7]
	}
}

// decodeByteStreamSplitBatchWidth4 decodes the batch of nValues raw bytes representing a 4-byte datatype provided by 'data',
// into the output buffer 'out' using BYTE_STREAM_SPLIT encoding.
// 'out' must have space for at least len(data) bytes.
func decodeByteStreamSplitBatchWidth4(data []byte, nValues, stride int, out []byte) {
	const width = 4
	debug.Assert(len(out) >= nValues*width, fmt.Sprintf("not enough space in output buffer for decoding, out: %d bytes, data: %d bytes", len(out), len(data)))
	for element := 0; element < nValues; element++ {
		out[width*element] = data[element]
		out[width*element+1] = data[stride+element]
		out[width*element+2] = data[2*stride+element]
		out[width*element+3] = data[3*stride+element]
	}
}

// decodeByteStreamSplitBatchWidth8 decodes the batch of nValues raw bytes representing a 8-byte datatype provided by 'data',
// into the output buffer 'out' using BYTE_STREAM_SPLIT encoding.
// 'out' must have space for at least len(data) bytes.
func decodeByteStreamSplitBatchWidth8(data []byte, nValues, stride int, out []byte) {
	const width = 8
	debug.Assert(len(out) >= nValues*width, fmt.Sprintf("not enough space in output buffer for decoding, out: %d bytes, data: %d bytes", len(out), len(data)))
	for element := 0; element < nValues; element++ {
		out[width*element] = data[element]
		out[width*element+1] = data[stride+element]
		out[width*element+2] = data[2*stride+element]
		out[width*element+3] = data[3*stride+element]
		out[width*element+4] = data[4*stride+element]
		out[width*element+5] = data[5*stride+element]
		out[width*element+6] = data[6*stride+element]
		out[width*element+7] = data[7*stride+element]
	}
}

// decodeByteStreamSplitBatchFLBA decodes the batch of nValues FixedLenByteArrays provided by 'data',
// into the output slice 'out' using BYTE_STREAM_SPLIT encoding.
// 'out' must have space for at least nValues slices.
func decodeByteStreamSplitBatchFLBA(data []byte, nValues, stride, width int, out []parquet.FixedLenByteArray) {
	debug.Assert(len(out) >= nValues, fmt.Sprintf("not enough space in output slice for decoding, out: %d values, data: %d values", len(out), nValues))
	for stream := 0; stream < width; stream++ {
		for element := 0; element < nValues; element++ {
			encLoc := stride*stream + element
			out[element][stream] = data[encLoc]
		}
	}
}

// decodeByteStreamSplitBatchFLBAWidth2 decodes the batch of nValues FixedLenByteArrays of length 2 provided by 'data',
// into the output slice 'out' using BYTE_STREAM_SPLIT encoding.
// 'out' must have space for at least nValues slices.
func decodeByteStreamSplitBatchFLBAWidth2(data []byte, nValues, stride int, out []parquet.FixedLenByteArray) {
	debug.Assert(len(out) >= nValues, fmt.Sprintf("not enough space in output slice for decoding, out: %d values, data: %d values", len(out), nValues))
	for element := 0; element < nValues; element++ {
		out[element][0] = data[element]
		out[element][1] = data[stride+element]
	}
}

// decodeByteStreamSplitBatchFLBAWidth4 decodes the batch of nValues FixedLenByteArrays of length 4 provided by 'data',
// into the output slice 'out' using BYTE_STREAM_SPLIT encoding.
// 'out' must have space for at least nValues slices.
func decodeByteStreamSplitBatchFLBAWidth4(data []byte, nValues, stride int, out []parquet.FixedLenByteArray) {
	debug.Assert(len(out) >= nValues, fmt.Sprintf("not enough space in output slice for decoding, out: %d values, data: %d values", len(out), nValues))
	for element := 0; element < nValues; element++ {
		out[element][0] = data[element]
		out[element][1] = data[stride+element]
		out[element][2] = data[stride*2+element]
		out[element][3] = data[stride*3+element]
	}
}

// decodeByteStreamSplitBatchFLBAWidth8 decodes the batch of nValues FixedLenByteArrays of length 8 provided by 'data',
// into the output slice 'out' using BYTE_STREAM_SPLIT encoding.
// 'out' must have space for at least nValues slices.
func decodeByteStreamSplitBatchFLBAWidth8(data []byte, nValues, stride int, out []parquet.FixedLenByteArray) {
	debug.Assert(len(out) >= nValues, fmt.Sprintf("not enough space in output slice for decoding, out: %d values, data: %d values", len(out), nValues))
	for element := 0; element < nValues; element++ {
		out[element][0] = data[element]
		out[element][1] = data[stride+element]
		out[element][2] = data[stride*2+element]
		out[element][3] = data[stride*3+element]
		out[element][4] = data[stride*4+element]
		out[element][5] = data[stride*5+element]
		out[element][6] = data[stride*6+element]
		out[element][7] = data[stride*7+element]
	}
}

func releaseBufferToPool(pooled *PooledBufferWriter) {
	buf := pooled.buf
	memory.Set(buf.Buf(), 0)
	buf.ResizeNoShrink(0)
	bufferPool.Put(buf)
}

func validateByteStreamSplitPageData(typeLen, nvals int, data []byte) (int, error) {
	if nvals*typeLen < len(data) {
		return 0, fmt.Errorf("data size (%d) is too small for the number of values in in BYTE_STREAM_SPLIT (%d)", len(data), nvals)
	}

	if len(data)%typeLen != 0 {
		return 0, fmt.Errorf("ByteStreamSplit data size %d not aligned with byte_width: %d", len(data), typeLen)
	}

	return len(data) / typeLen, nil
}

type byteStreamSplitEncoder[T int32 | int64 | float32 | float64] struct {
	PlainEncoder[T]
	flushBuffer *PooledBufferWriter
}

func (enc *byteStreamSplitEncoder[T]) FlushValues() (Buffer, error) {
	in, err := enc.PlainEncoder.FlushValues()
	if err != nil {
		return nil, err
	}

	if enc.flushBuffer == nil {
		enc.flushBuffer = NewPooledBufferWriter(in.Len())
	}

	enc.flushBuffer.buf.Resize(in.Len())
	var z T
	switch any(z).(type) {
	case int32, float32:
		encodeByteStreamSplitWidth4(enc.flushBuffer.Bytes(), in.Bytes())
	case int64, float64:
		encodeByteStreamSplitWidth8(enc.flushBuffer.Bytes(), in.Bytes())
	}

	return enc.flushBuffer.Finish(), nil
}

func (enc *byteStreamSplitEncoder[T]) Release() {
	enc.PlainEncoder.Release()
	releaseBufferToPool(enc.flushBuffer)
	enc.flushBuffer = nil
}

// ByteStreamSplitInt32Encoder writes the underlying bytes of the Int32
// into interlaced streams as defined by the BYTE_STREAM_SPLIT encoding
type ByteStreamSplitInt32Encoder = byteStreamSplitEncoder[int32]

// ByteStreamSplitInt64Encoder writes the underlying bytes of the Int64
// into interlaced streams as defined by the BYTE_STREAM_SPLIT encoding
type ByteStreamSplitInt64Encoder = byteStreamSplitEncoder[int64]

// ByteStreamSplitFloat32Encoder writes the underlying bytes of the Float32
// into interlaced streams as defined by the BYTE_STREAM_SPLIT encoding
type ByteStreamSplitFloat32Encoder = byteStreamSplitEncoder[float32]

// ByteStreamSplitFloat64Encoder writes the underlying bytes of the Float64
// into interlaced streams as defined by the BYTE_STREAM_SPLIT encoding
type ByteStreamSplitFloat64Encoder = byteStreamSplitEncoder[float64]

// ByteStreamSplitFloat32Decoder is a decoder for BYTE_STREAM_SPLIT-encoded
// bytes representing Float32 values
type ByteStreamSplitFloat32Decoder = ByteStreamSplitDecoder[float32]

// ByteStreamSplitFloat64Decoder is a decoder for BYTE_STREAM_SPLIT-encoded
// bytes representing Float64 values
type ByteStreamSplitFloat64Decoder = ByteStreamSplitDecoder[float64]

// ByteStreamSplitInt32Decoder is a decoder for BYTE_STREAM_SPLIT-encoded
// bytes representing Int32 values
type ByteStreamSplitInt32Decoder = ByteStreamSplitDecoder[int32]

// ByteStreamSplitInt64Decoder is a decoder for BYTE_STREAM_SPLIT-encoded
// bytes representing Int64 values
type ByteStreamSplitInt64Decoder = ByteStreamSplitDecoder[int64]

type ByteStreamSplitDecoder[T float32 | float64 | int32 | int64] struct {
	decoder
	stride int
}

func (dec *ByteStreamSplitDecoder[T]) Type() parquet.Type {
	switch v := any(dec).(type) {
	case *ByteStreamSplitDecoder[float32]:
		return parquet.Types.Float
	case *ByteStreamSplitDecoder[float64]:
		return parquet.Types.Double
	case *ByteStreamSplitDecoder[int32]:
		return parquet.Types.Int32
	case *ByteStreamSplitDecoder[int64]:
		return parquet.Types.Int64
	default:
		panic(fmt.Sprintf("ByteStreamSplitDecoder is not supported for type: %T", v))
	}
}

func (dec *ByteStreamSplitDecoder[T]) SetData(nvals int, data []byte) error {
	nvals, err := validateByteStreamSplitPageData(dec.Type().ByteSize(), nvals, data)
	if err != nil {
		return err
	}

	dec.stride = nvals
	return dec.decoder.SetData(nvals, data)
}

func (dec *ByteStreamSplitDecoder[T]) Discard(n int) (int, error) {
	n = min(n, dec.nvals)
	dec.nvals -= n
	dec.data = dec.data[n:]
	return n, nil
}

func (dec *ByteStreamSplitDecoder[T]) Decode(out []T) (int, error) {
	typeLen := dec.Type().ByteSize()
	toRead := min(len(out), dec.nvals)
	numBytesNeeded := toRead * typeLen
	if numBytesNeeded > len(dec.data) || numBytesNeeded > math.MaxInt32 {
		return 0, xerrors.New("parquet: eof exception")
	}

	outBytes := arrow.GetBytes(out)
	switch typeLen {
	case 4:
		decodeByteStreamSplitBatchWidth4(dec.data, toRead, dec.stride, outBytes)
	case 8:
		decodeByteStreamSplitBatchWidth8(dec.data, toRead, dec.stride, outBytes)
	default:
		return 0, fmt.Errorf("encoding ByteStreamSplit is only defined for numeric type of width 4 or 8, found: %d", typeLen)
	}

	dec.nvals -= toRead
	dec.data = dec.data[toRead:]

	return toRead, nil
}

func (dec *ByteStreamSplitDecoder[T]) DecodeSpaced(out []T, nullCount int, validBits []byte, validBitsOffset int64) (int, error) {
	toRead := len(out) - nullCount
	valuesRead, err := dec.Decode(out[:toRead])
	if err != nil {
		return valuesRead, err
	}
	if valuesRead != toRead {
		return valuesRead, xerrors.New("parquet: number of values / definitions levels read did not match")
	}

	return spacedExpand(out, nullCount, validBits, validBitsOffset), nil
}
