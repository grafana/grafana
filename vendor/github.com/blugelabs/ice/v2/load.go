//  Copyright (c) 2020 The Bluge Authors.
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
	"fmt"

	"github.com/blevesearch/vellum"
	segment "github.com/blugelabs/bluge_segment_api"
)

// Open returns an impl of a segment
func Load(data *segment.Data) (segment.Segment, error) {
	return load(data)
}

func load(data *segment.Data) (*Segment, error) {
	footer, err := parseFooter(data)
	if err != nil {
		return nil, fmt.Errorf("error parsing footer: %w", err)
	}
	rv := &Segment{
		data:           data.Slice(0, data.Len()-footerLen),
		footer:         footer,
		fieldsMap:      make(map[string]uint16),
		fieldDvReaders: make(map[uint16]*docValueReader),
		fieldFSTs:      make(map[uint16]*vellum.FST),
		fieldDocs:      make(map[uint16]uint64),
		fieldFreqs:     make(map[uint16]uint64),
	}

	// FIXME temporarily map to existing footer fields
	// rv.memCRC = footer.crc
	// rv.chunkMode = footer.chunkMode
	// rv.numDocs = footer.numDocs
	// rv.storedIndexOffset = footer.storedIndexOffset
	// rv.fieldsIndexOffset = footer.fieldsIndexOffset
	// rv.docValueOffset = footer.docValueOffset

	err = rv.loadFields()
	if err != nil {
		return nil, err
	}

	err = rv.loadStoredFieldChunk()
	if err != nil {
		return nil, err
	}

	err = rv.loadDvReaders()
	if err != nil {
		return nil, err
	}

	rv.updateSize()

	return rv, nil
}

const fileAddrWidth = 8

func (s *Segment) loadFields() error {
	// NOTE for now we assume the fields index immediately precedes
	// the footer, and if this changes, need to adjust accordingly (or
	// store explicit length), where s.mem was sliced from s.mm in Open().
	fieldsIndexEnd := uint64(s.data.Len())

	// iterate through fields index
	var fieldID uint64
	for s.footer.fieldsIndexOffset+(fileAddrWidth*fieldID) < fieldsIndexEnd {
		addrData, err := s.data.Read(int(s.footer.fieldsIndexOffset+(fileAddrWidth*fieldID)),
			int(s.footer.fieldsIndexOffset+(fileAddrWidth*fieldID)+fileAddrWidth))
		if err != nil {
			return err
		}
		addr := binary.BigEndian.Uint64(addrData)

		dictLocData, err := s.data.Read(int(addr), int(fieldsIndexEnd))
		if err != nil {
			return err
		}
		dictLoc, read := binary.Uvarint(dictLocData)
		n := uint64(read)
		s.dictLocs = append(s.dictLocs, dictLoc)

		var nameLen uint64
		nameLenData, err := s.data.Read(int(addr+n), int(fieldsIndexEnd))
		if err != nil {
			return err
		}
		nameLen, read = binary.Uvarint(nameLenData)
		n += uint64(read)

		nameData, err := s.data.Read(int(addr+n), int(addr+n+nameLen))
		if err != nil {
			return err
		}
		n += nameLen

		fieldDocData, err := s.data.Read(int(addr+n), int(fieldsIndexEnd))
		if err != nil {
			return err
		}
		fieldDocVal, read := binary.Uvarint(fieldDocData)
		n += uint64(read)

		fieldFreqData, err := s.data.Read(int(addr+n), int(fieldsIndexEnd))
		if err != nil {
			return err
		}
		fieldFreqVal, _ := binary.Uvarint(fieldFreqData)

		name := string(nameData)
		s.fieldsInv = append(s.fieldsInv, name)
		s.fieldsMap[name] = uint16(fieldID + 1)
		s.fieldDocs[uint16(fieldID)] = fieldDocVal
		s.fieldFreqs[uint16(fieldID)] = fieldFreqVal

		fieldID++
	}
	return nil
}

// loadStoredFieldChunk load storedField chunk offsets
func (s *Segment) loadStoredFieldChunk() error {
	// read chunk num
	chunkOffsetPos := int(s.footer.storedIndexOffset - uint64(sizeOfUint32))
	chunkData, err := s.data.Read(chunkOffsetPos, chunkOffsetPos+sizeOfUint32)
	if err != nil {
		return err
	}
	chunkNum := binary.BigEndian.Uint32(chunkData)
	chunkOffsetPos -= sizeOfUint32
	// read chunk offsets length
	chunkData, err = s.data.Read(chunkOffsetPos, chunkOffsetPos+sizeOfUint32)
	if err != nil {
		return err
	}
	chunkOffsetsLen := binary.BigEndian.Uint32(chunkData)
	// read chunk offsets
	chunkOffsetPos -= int(chunkOffsetsLen)
	var offset, read int
	var offsetata []byte
	s.storedFieldChunkOffsets = make([]uint64, chunkNum)
	for i := 0; i < int(chunkNum); i++ {
		offsetata, err = s.data.Read(chunkOffsetPos+offset, chunkOffsetPos+offset+binary.MaxVarintLen64)
		if err != nil {
			return err
		}
		s.storedFieldChunkOffsets[i], read = binary.Uvarint(offsetata)
		offset += read
	}

	return nil
}
