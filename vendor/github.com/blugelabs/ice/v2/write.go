//  Copyright (c) 2020 Couchbase, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// 		http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package ice

import (
	"encoding/binary"
	"io"
	"math"

	"github.com/RoaringBitmap/roaring"
)

const fieldNotUninverted = math.MaxUint64

type varintEncoder func(uint64) (int, error)

func encodeStoredFieldValues(fieldID int,
	storedFieldValues [][]byte,
	curr int, metaEncode varintEncoder, data []byte) (
	newCurr int, newData []byte, err error) {
	for i := 0; i < len(storedFieldValues); i++ {
		// encode field
		_, err := metaEncode(uint64(fieldID))
		if err != nil {
			return 0, nil, err
		}
		// encode start offset
		_, err = metaEncode(uint64(curr))
		if err != nil {
			return 0, nil, err
		}
		// end len
		_, err = metaEncode(uint64(len(storedFieldValues[i])))
		if err != nil {
			return 0, nil, err
		}

		data = append(data, storedFieldValues[i]...)
		curr += len(storedFieldValues[i])
	}

	return curr, data, nil
}

func writePostings(postings *roaring.Bitmap, tfEncoder, locEncoder *chunkedIntCoder,
	use1HitEncoding func(uint64) (bool, uint64, uint64),
	w *countHashWriter, bufMaxVarintLen64 []byte) (
	offset uint64, err error) {
	termCardinality := postings.GetCardinality()
	if termCardinality <= 0 {
		return 0, nil
	}

	if use1HitEncoding != nil {
		encodeAs1Hit, docNum1Hit, normBits1Hit := use1HitEncoding(termCardinality)
		if encodeAs1Hit {
			return fSTValEncode1Hit(docNum1Hit, normBits1Hit), nil
		}
	}

	var tfOffset uint64
	tfOffset, err = tfEncoder.writeAt(w)
	if err != nil {
		return 0, err
	}

	var locOffset uint64
	locOffset, err = locEncoder.writeAt(w)
	if err != nil {
		return 0, err
	}

	postingsOffset := uint64(w.Count())

	n := binary.PutUvarint(bufMaxVarintLen64, tfOffset)
	_, err = w.Write(bufMaxVarintLen64[:n])
	if err != nil {
		return 0, err
	}

	if locOffset > 0 && tfOffset > 0 {
		n = binary.PutUvarint(bufMaxVarintLen64, locOffset-tfOffset)
	} else {
		n = binary.PutUvarint(bufMaxVarintLen64, locOffset)
	}
	_, err = w.Write(bufMaxVarintLen64[:n])
	if err != nil {
		return 0, err
	}

	_, err = writeRoaringWithLen(postings, w, bufMaxVarintLen64)
	if err != nil {
		return 0, err
	}

	return postingsOffset, nil
}

// returns the total # of bytes needed to encode the given uint64's
// into binary.PutUVarint() encoding
func totalUvarintBytes(a, b, c, d uint64) (n int) {
	n = numUvarintBytes(a)
	n += numUvarintBytes(b)
	n += numUvarintBytes(c)
	n += numUvarintBytes(d)
	return n
}

// returns # of bytes needed to encode x in binary.PutUvarint() encoding
func numUvarintBytes(x uint64) (n int) {
	for x >= 0x80 {
		x >>= 7
		n++
	}
	return n + 1
}

// writes out the length of the roaring bitmap in bytes as varint
// then writes out the roaring bitmap itself
func writeRoaringWithLen(r *roaring.Bitmap, w io.Writer,
	reuseBufVarint []byte) (int, error) {
	r.RunOptimize()
	buf, err := r.ToBytes()
	if err != nil {
		return 0, err
	}

	var tw int

	// write out the length
	n := binary.PutUvarint(reuseBufVarint, uint64(len(buf)))
	nw, err := w.Write(reuseBufVarint[:n])
	tw += nw
	if err != nil {
		return tw, err
	}

	// write out the roaring bytes
	nw, err = w.Write(buf)
	tw += nw
	if err != nil {
		return tw, err
	}

	return tw, nil
}

func persistFields(fieldsInv []string, fieldDocs, fieldFreqs map[uint16]uint64,
	w *countHashWriter, dictLocs []uint64) (uint64, error) {
	var rv uint64
	var fieldsOffsets []uint64

	for fieldID, fieldName := range fieldsInv {
		// record start of this field
		fieldsOffsets = append(fieldsOffsets, uint64(w.Count()))

		// write out the dict location and field name length
		err := writeUvarints(w, dictLocs[fieldID], uint64(len(fieldName)))
		if err != nil {
			return 0, err
		}

		// write out the field name
		_, err = w.Write([]byte(fieldName))
		if err != nil {
			return 0, err
		}

		// write out the number of docs using this field
		// and the number of total tokens
		err = writeUvarints(w, fieldDocs[uint16(fieldID)], fieldFreqs[uint16(fieldID)])
		if err != nil {
			return 0, err
		}
	}

	// now write out the fields index
	rv = uint64(w.Count())
	for fieldID := range fieldsInv {
		err := binary.Write(w, binary.BigEndian, fieldsOffsets[fieldID])
		if err != nil {
			return 0, err
		}
	}

	return rv, nil
}

func persistFooter(footer *footer, writerIn io.Writer) error {
	w := newCountHashWriter(writerIn)
	w.crc = footer.crc

	// write out the number of docs
	err := binary.Write(w, binary.BigEndian, footer.numDocs)
	if err != nil {
		return err
	}
	// write out the stored field index location:
	err = binary.Write(w, binary.BigEndian, footer.storedIndexOffset)
	if err != nil {
		return err
	}
	// write out the field index location
	err = binary.Write(w, binary.BigEndian, footer.fieldsIndexOffset)
	if err != nil {
		return err
	}
	// write out the fieldDocValue location
	err = binary.Write(w, binary.BigEndian, footer.docValueOffset)
	if err != nil {
		return err
	}
	// write out 32-bit chunk factor
	err = binary.Write(w, binary.BigEndian, footer.chunkMode)
	if err != nil {
		return err
	}
	// write out 32-bit version
	err = binary.Write(w, binary.BigEndian, Version)
	if err != nil {
		return err
	}
	// write out CRC-32 of everything upto but not including this CRC
	err = binary.Write(w, binary.BigEndian, w.crc)
	if err != nil {
		return err
	}
	return nil
}

func writeUvarints(w io.Writer, vals ...uint64) (err error) {
	buf := make([]byte, binary.MaxVarintLen64)
	for _, val := range vals {
		n := binary.PutUvarint(buf, val)
		_, err = w.Write(buf[:n])
		if err != nil {
			return err
		}
	}
	return err
}
