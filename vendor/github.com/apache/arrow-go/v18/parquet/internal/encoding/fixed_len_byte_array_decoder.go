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
	"errors"
	"fmt"
	"math"

	"github.com/apache/arrow-go/v18/internal/utils"
	"github.com/apache/arrow-go/v18/parquet"
	"golang.org/x/xerrors"
)

// PlainFixedLenByteArrayDecoder is a plain encoding decoder for Fixed Length Byte Arrays
type PlainFixedLenByteArrayDecoder struct {
	decoder
}

// Type returns the physical type this decoder operates on, FixedLength Byte Arrays
func (PlainFixedLenByteArrayDecoder) Type() parquet.Type {
	return parquet.Types.FixedLenByteArray
}

func (pflba *PlainFixedLenByteArrayDecoder) Discard(n int) (int, error) {
	n = min(n, pflba.nvals)
	numBytesNeeded := n * pflba.typeLen
	if numBytesNeeded > len(pflba.data) || numBytesNeeded > math.MaxInt32 {
		return 0, errors.New("parquet: eof exception")
	}

	pflba.data = pflba.data[numBytesNeeded:]
	pflba.nvals -= n
	return n, nil
}

// Decode populates out with fixed length byte array values until either there are no more
// values to decode or the length of out has been filled. Then returns the total number of values
// that were decoded.
func (pflba *PlainFixedLenByteArrayDecoder) Decode(out []parquet.FixedLenByteArray) (int, error) {
	max := utils.Min(len(out), pflba.nvals)
	numBytesNeeded := max * pflba.typeLen
	if numBytesNeeded > len(pflba.data) || numBytesNeeded > math.MaxInt32 {
		return 0, xerrors.New("parquet: eof exception")
	}

	for idx := range out[:max] {
		out[idx] = pflba.data[:pflba.typeLen]
		pflba.data = pflba.data[pflba.typeLen:]
	}

	pflba.nvals -= max
	return max, nil
}

// DecodeSpaced does the same as Decode but spaces out the resulting slice according to the bitmap leaving space for null values
func (pflba *PlainFixedLenByteArrayDecoder) DecodeSpaced(out []parquet.FixedLenByteArray, nullCount int, validBits []byte, validBitsOffset int64) (int, error) {
	toRead := len(out) - nullCount
	valuesRead, err := pflba.Decode(out[:toRead])
	if err != nil {
		return valuesRead, err
	}
	if valuesRead != toRead {
		return valuesRead, xerrors.New("parquet: number of values / definitions levels read did not match")
	}

	return spacedExpand(out, nullCount, validBits, validBitsOffset), nil
}

// ByteStreamSplitFixedLenByteArrayDecoder is a decoder for BYTE_STREAM_SPLIT-encoded
// bytes representing FixedLenByteArray values
type ByteStreamSplitFixedLenByteArrayDecoder struct {
	decoder
	stride int
}

func (dec *ByteStreamSplitFixedLenByteArrayDecoder) Type() parquet.Type {
	return parquet.Types.FixedLenByteArray
}

func (dec *ByteStreamSplitFixedLenByteArrayDecoder) SetData(nvals int, data []byte) error {
	if nvals*dec.typeLen < len(data) {
		return fmt.Errorf("data size (%d) is too small for the number of values in in BYTE_STREAM_SPLIT (%d)", len(data), nvals)
	}

	if len(data)%dec.typeLen != 0 {
		return fmt.Errorf("ByteStreamSplit data size %d not aligned with type %s and byte_width: %d", len(data), dec.Type(), dec.typeLen)
	}

	nvals = len(data) / dec.typeLen
	dec.stride = nvals

	return dec.decoder.SetData(nvals, data)
}

func (dec *ByteStreamSplitFixedLenByteArrayDecoder) Discard(n int) (int, error) {
	n = min(n, dec.nvals)
	numBytesNeeded := n * dec.typeLen
	if numBytesNeeded > len(dec.data) || numBytesNeeded > math.MaxInt32 {
		return 0, errors.New("parquet: eof exception")
	}

	dec.nvals -= n
	dec.data = dec.data[n:]
	return n, nil
}

func (dec *ByteStreamSplitFixedLenByteArrayDecoder) Decode(out []parquet.FixedLenByteArray) (int, error) {
	toRead := min(len(out), dec.nvals)
	numBytesNeeded := toRead * dec.typeLen
	if numBytesNeeded > len(dec.data) || numBytesNeeded > math.MaxInt32 {
		return 0, xerrors.New("parquet: eof exception")
	}

	for i := range out {
		if cap(out[i]) < dec.typeLen {
			out[i] = make(parquet.FixedLenByteArray, dec.typeLen)
		} else {
			out[i] = out[i][:dec.typeLen]
		}
	}

	switch dec.typeLen {
	case 2:
		decodeByteStreamSplitBatchFLBAWidth2(dec.data, toRead, dec.stride, out)
	case 4:
		decodeByteStreamSplitBatchFLBAWidth4(dec.data, toRead, dec.stride, out)
	case 8:
		decodeByteStreamSplitBatchFLBAWidth8(dec.data, toRead, dec.stride, out)
	default:
		decodeByteStreamSplitBatchFLBA(dec.data, toRead, dec.stride, dec.typeLen, out)
	}

	dec.nvals -= toRead
	dec.data = dec.data[toRead:]
	return toRead, nil
}

func (dec *ByteStreamSplitFixedLenByteArrayDecoder) DecodeSpaced(out []parquet.FixedLenByteArray, nullCount int, validBits []byte, validBitsOffset int64) (int, error) {
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
