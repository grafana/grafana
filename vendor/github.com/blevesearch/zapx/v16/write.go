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

func persistFieldsSection(fieldsInv []string, w *CountHashWriter, opaque map[int]resetable) (uint64, error) {
	var rv uint64
	fieldsOffsets := make([]uint64, 0, len(fieldsInv))

	for fieldID, fieldName := range fieldsInv {
		// record start of this field
		fieldsOffsets = append(fieldsOffsets, uint64(w.Count()))

		// write field name length
		_, err := writeUvarints(w, uint64(len(fieldName)))
		if err != nil {
			return 0, err
		}

		// write out the field name
		_, err = w.Write([]byte(fieldName))
		if err != nil {
			return 0, err
		}

		// write out the number of field-specific indexes
		// FIXME hard-coding to 2, and not attempting to support sparseness well
		_, err = writeUvarints(w, uint64(len(segmentSections)))
		if err != nil {
			return 0, err
		}

		// now write pairs of index section ids, and start addresses for each field
		// which has a specific section's data. this serves as the starting point
		// using which a field's section data can be read and parsed.
		for segmentSectionType, segmentSectionImpl := range segmentSections {
			binary.Write(w, binary.BigEndian, segmentSectionType)
			binary.Write(w, binary.BigEndian, uint64(segmentSectionImpl.AddrForField(opaque, fieldID)))
		}
	}

	rv = uint64(w.Count())
	// write out number of fields
	_, err := writeUvarints(w, uint64(len(fieldsInv)))
	if err != nil {
		return 0, err
	}
	// now write out the fields index
	for fieldID := range fieldsInv {
		err := binary.Write(w, binary.BigEndian, fieldsOffsets[fieldID])
		if err != nil {
			return 0, err
		}
	}

	return rv, nil
}

// FooterSize is the size of the footer record in bytes
// crc + ver + chunk + docValueOffset + sectionsIndexOffset + field offset + stored offset + num docs
const FooterSize = 4 + 4 + 4 + 8 + 8 + 8 + 8 + 8

// in the index sections format, the fieldsIndexOffset points to the sectionsIndexOffset
func persistFooter(numDocs, storedIndexOffset, fieldsIndexOffset, sectionsIndexOffset, docValueOffset uint64,
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

	// write out the new field index location (to be removed later, as this can eventually replace the old)
	err = binary.Write(w, binary.BigEndian, sectionsIndexOffset)
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
