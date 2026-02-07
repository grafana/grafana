//  Copyright (c) 2017 Couchbase, Inc.
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

package zap

import (
	"encoding/binary"
	"io"

	"github.com/RoaringBitmap/roaring/v2"
)

// writes out the length of the roaring bitmap in bytes as varint
// then writes out the roaring bitmap itself
func writeRoaringWithLen(r *roaring.Bitmap, w io.Writer,
	reuseBufVarint []byte) (int, error) {
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

func persistFields(fieldsInv []string, w *CountHashWriter, dictLocs []uint64) (uint64, error) {
	var rv uint64
	var fieldsOffsets []uint64

	for fieldID, fieldName := range fieldsInv {
		// record start of this field
		fieldsOffsets = append(fieldsOffsets, uint64(w.Count()))

		// write out the dict location and field name length
		_, err := writeUvarints(w, dictLocs[fieldID], uint64(len(fieldName)))
		if err != nil {
			return 0, err
		}

		// write out the field name
		_, err = w.Write([]byte(fieldName))
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

// FooterSize is the size of the footer record in bytes
// crc + ver + chunk + field offset + stored offset + num docs + docValueOffset
const FooterSize = 4 + 4 + 4 + 8 + 8 + 8 + 8

func persistFooter(numDocs, storedIndexOffset, fieldsIndexOffset, docValueOffset uint64,
	chunkMode uint32, crcBeforeFooter uint32, writerIn io.Writer) error {
	w := NewCountHashWriter(writerIn)
	w.crc = crcBeforeFooter

	// write out the number of docs
	err := binary.Write(w, binary.BigEndian, numDocs)
	if err != nil {
		return err
	}
	// write out the stored field index location:
	err = binary.Write(w, binary.BigEndian, storedIndexOffset)
	if err != nil {
		return err
	}
	// write out the field index location
	err = binary.Write(w, binary.BigEndian, fieldsIndexOffset)
	if err != nil {
		return err
	}
	// write out the fieldDocValue location
	err = binary.Write(w, binary.BigEndian, docValueOffset)
	if err != nil {
		return err
	}
	// write out 32-bit chunk factor
	err = binary.Write(w, binary.BigEndian, chunkMode)
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

func writeUvarints(w io.Writer, vals ...uint64) (tw int, err error) {
	buf := make([]byte, binary.MaxVarintLen64)
	for _, val := range vals {
		n := binary.PutUvarint(buf, val)
		var nw int
		nw, err = w.Write(buf[:n])
		tw += nw
		if err != nil {
			return tw, err
		}
	}
	return tw, err
}
