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
	"bytes"
	"encoding/binary"
	"errors"
	"fmt"
	"io"

	"github.com/apache/arrow-go/v18/arrow/bitutil"
	shared_utils "github.com/apache/arrow-go/v18/internal/utils"
	"github.com/apache/arrow-go/v18/parquet"
	"github.com/apache/arrow-go/v18/parquet/internal/utils"
)

// PlainBooleanDecoder is for the Plain Encoding type, there is no
// dictionary decoding for bools.
type PlainBooleanDecoder struct {
	decoder

	bitOffset int
}

// Type for the PlainBooleanDecoder is parquet.Types.Boolean
func (PlainBooleanDecoder) Type() parquet.Type {
	return parquet.Types.Boolean
}

func (dec *PlainBooleanDecoder) SetData(nvals int, data []byte) error {
	if err := dec.decoder.SetData(nvals, data); err != nil {
		return err
	}
	dec.bitOffset = 0
	return nil
}

func (dec *PlainBooleanDecoder) Discard(n int) (int, error) {
	n = min(n, dec.nvals)
	dec.nvals -= n

	if dec.bitOffset+n < 8 {
		dec.bitOffset += n
		return n, nil
	}

	remaining := n - (8 - dec.bitOffset)
	dec.bitOffset = 0
	dec.data = dec.data[1:]

	bytesToSkip := bitutil.BytesForBits(int64(remaining/8) * 8)
	dec.data = dec.data[bytesToSkip:]
	remaining -= int(bytesToSkip * 8)

	dec.bitOffset += remaining
	return n, nil
}

// Decode fills out with bools decoded from the data at the current point
// or until we reach the end of the data.
//
// Returns the number of values decoded
func (dec *PlainBooleanDecoder) Decode(out []bool) (int, error) {
	max := shared_utils.Min(len(out), dec.nvals)

	// attempts to read all remaining bool values from the current data byte
	unalignedExtract := func(i int) int {
		for ; dec.bitOffset < 8 && i < max; i, dec.bitOffset = i+1, dec.bitOffset+1 {
			out[i] = (dec.data[0] & byte(1<<dec.bitOffset)) != 0
		}
		if dec.bitOffset == 8 {
			// we read every bit from this byte
			dec.bitOffset = 0
			dec.data = dec.data[1:] // move data forward
		}
		return i // return the next index for out[]
	}

	// if we aren't at a byte boundary, then get bools until we hit
	// a byte boundary with the bit offset.
	i := 0
	if dec.bitOffset != 0 {
		i = unalignedExtract(i)
	}

	// determine the number of full bytes worth of bits we can decode
	// given the number of values we want to decode.
	bitsRemain := max - i
	batch := (bitsRemain / 8) * 8
	if batch > 0 { // only go in here if there's at least one full byte to decode
		// determine the number of aligned bytes we can grab using SIMD optimized
		// functions to improve performance.
		alignedBytes := bitutil.BytesForBits(int64(batch))
		utils.BytesToBools(dec.data[:alignedBytes], out[i:])

		dec.data = dec.data[alignedBytes:] // move data forward
		i += int(alignedBytes) * 8
	}

	// grab any trailing bits now that we've got our aligned bytes.
	_ = unalignedExtract(i)

	dec.nvals -= max
	return max, nil
}

// DecodeSpaced is like Decode except it expands the values to leave spaces for null
// as determined by the validBits bitmap.
func (dec *PlainBooleanDecoder) DecodeSpaced(out []bool, nullCount int, validBits []byte, validBitsOffset int64) (int, error) {
	if nullCount > 0 {
		toRead := len(out) - nullCount
		valuesRead, err := dec.Decode(out[:toRead])
		if err != nil {
			return 0, err
		}
		if valuesRead != toRead {
			return valuesRead, errors.New("parquet: boolean decoder: number of values / definition levels read did not match")
		}
		return spacedExpand(out, nullCount, validBits, validBitsOffset), nil
	}
	return dec.Decode(out)
}

type RleBooleanDecoder struct {
	decoder

	rleDec *utils.RleDecoder
}

func (RleBooleanDecoder) Type() parquet.Type {
	return parquet.Types.Boolean
}

func (dec *RleBooleanDecoder) SetData(nvals int, data []byte) error {
	dec.nvals = nvals

	if len(data) < 4 {
		return fmt.Errorf("invalid length - %d (corrupt data page?)", len(data))
	}

	// load the first 4 bytes in little-endian which indicates the length
	nbytes := binary.LittleEndian.Uint32(data[:4])
	if nbytes > uint32(len(data)-4) {
		return fmt.Errorf("received invalid number of bytes - %d (corrupt data page?)", nbytes)
	}

	dec.data = data[4:]
	if dec.rleDec == nil {
		dec.rleDec = utils.NewRleDecoder(bytes.NewReader(dec.data), 1)
	} else {
		dec.rleDec.Reset(bytes.NewReader(dec.data), 1)
	}
	return nil
}

func (dec *RleBooleanDecoder) Discard(n int) (int, error) {
	n = min(n, dec.nvals)

	n = dec.rleDec.Discard(n)
	dec.nvals -= n
	return n, nil
}

func (dec *RleBooleanDecoder) Decode(out []bool) (int, error) {
	max := shared_utils.Min(len(out), dec.nvals)

	var (
		buf [1024]uint64
		n   = max
	)

	for n > 0 {
		batch := shared_utils.Min(len(buf), n)
		decoded := dec.rleDec.GetBatch(buf[:batch])
		if decoded != batch {
			return max - n, io.ErrUnexpectedEOF
		}

		for i := 0; i < batch; i++ {
			out[i] = buf[i] != 0
		}
		n -= batch
		out = out[batch:]
	}

	dec.nvals -= max
	return max, nil
}

func (dec *RleBooleanDecoder) DecodeSpaced(out []bool, nullCount int, validBits []byte, validBitsOffset int64) (int, error) {
	if nullCount > 0 {
		toRead := len(out) - nullCount
		valuesRead, err := dec.Decode(out[:toRead])
		if err != nil {
			return 0, err
		}
		if valuesRead != toRead {
			return valuesRead, errors.New("parquet: rle boolean decoder: number of values / definition levels read did not match")
		}
		return spacedExpand(out, nullCount, validBits, validBitsOffset), nil
	}
	return dec.Decode(out)
}
