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
	"bytes"
	"encoding/binary"
	"fmt"
	"math"
	"sort"

	segment "github.com/blugelabs/bluge_segment_api"
)

type docNumTermsVisitor func(docNum uint64, terms []byte) error

type docVisitState struct {
	dvrs    map[uint16]*docValueReader
	segment *Segment
}

type docValueReader struct {
	field          string
	curChunkNum    uint64
	chunkOffsets   []uint64
	dvDataLoc      uint64
	curChunkHeader []metaData
	curChunkData   []byte // compressed data cache
	uncompressed   []byte // temp buf for decompression
}

func (di *docValueReader) size() int {
	return reflectStaticSizedocValueReader + sizeOfPtr +
		len(di.field) +
		len(di.chunkOffsets)*sizeOfUint64 +
		len(di.curChunkHeader)*reflectStaticSizeMetaData +
		len(di.curChunkData)
}

func (di *docValueReader) cloneInto(rv *docValueReader) *docValueReader {
	if rv == nil {
		rv = &docValueReader{}
	}

	rv.field = di.field
	rv.curChunkNum = math.MaxInt64
	rv.chunkOffsets = di.chunkOffsets // immutable, so it's sharable
	rv.dvDataLoc = di.dvDataLoc
	rv.curChunkHeader = rv.curChunkHeader[:0]
	rv.curChunkData = nil
	rv.uncompressed = rv.uncompressed[:0]

	return rv
}

func (di *docValueReader) curChunkNumber() uint64 {
	return di.curChunkNum
}

const fieldDvStartWidth = 8
const fieldDvEndWidth = 8
const fieldDvStartEndWidth = fieldDvStartWidth + fieldDvEndWidth

func (s *Segment) loadFieldDocValueReader(field string,
	fieldDvLocStart, fieldDvLocEnd uint64) (*docValueReader, error) {
	// get the docValue offset for the given fields
	if fieldDvLocStart == fieldNotUninverted {
		// no docValues found, nothing to do
		return nil, nil
	}

	// read the number of chunks, and chunk offsets position
	var numChunks, chunkOffsetsPosition uint64

	if fieldDvLocEnd-fieldDvLocStart > fieldDvStartEndWidth {
		numChunksData, err := s.data.Read(int(fieldDvLocEnd-fieldDvEndWidth), int(fieldDvLocEnd))
		if err != nil {
			return nil, err
		}
		numChunks = binary.BigEndian.Uint64(numChunksData)
		// read the length of chunk offsets
		chunkOffsetsLenData, err := s.data.Read(int(fieldDvLocEnd-fieldDvStartEndWidth), int(fieldDvLocEnd-fieldDvEndWidth))
		if err != nil {
			return nil, err
		}
		chunkOffsetsLen := binary.BigEndian.Uint64(chunkOffsetsLenData)
		// acquire position of chunk offsets
		chunkOffsetsPosition = (fieldDvLocEnd - 16) - chunkOffsetsLen
	} else {
		return nil, fmt.Errorf("loadFieldDocValueReader: fieldDvLoc too small: %d-%d", fieldDvLocEnd, fieldDvLocStart)
	}

	fdvIter := &docValueReader{
		curChunkNum:  math.MaxInt64,
		field:        field,
		chunkOffsets: make([]uint64, int(numChunks)),
	}

	// read the chunk offsets
	var offset uint64
	for i := 0; i < int(numChunks); i++ {
		locData, err := s.data.Read(int(chunkOffsetsPosition+offset), int(chunkOffsetsPosition+offset+binary.MaxVarintLen64))
		if err != nil {
			return nil, err
		}
		loc, read := binary.Uvarint(locData)
		if read <= 0 {
			return nil, fmt.Errorf("corrupted chunk offset during segment load")
		}
		fdvIter.chunkOffsets[i] = loc
		offset += uint64(read)
	}

	// set the data offset
	fdvIter.dvDataLoc = fieldDvLocStart

	return fdvIter, nil
}

func (di *docValueReader) loadDvChunk(chunkNumber uint64, s *Segment) error {
	// advance to the chunk where the docValues
	// reside for the given docNum
	destChunkDataLoc, curChunkEnd := di.dvDataLoc, di.dvDataLoc
	start, end := readChunkBoundary(int(chunkNumber), di.chunkOffsets)
	if start >= end {
		di.curChunkHeader = di.curChunkHeader[:0]
		di.curChunkData = nil
		di.curChunkNum = chunkNumber
		di.uncompressed = di.uncompressed[:0]
		return nil
	}

	destChunkDataLoc += start
	curChunkEnd += end

	// read the number of docs reside in the chunk
	numDocsData, err := s.data.Read(int(destChunkDataLoc), int(destChunkDataLoc+binary.MaxVarintLen64))
	if err != nil {
		return err
	}
	numDocs, read := binary.Uvarint(numDocsData)
	if read <= 0 {
		return fmt.Errorf("failed to read the chunk")
	}
	chunkMetaLoc := destChunkDataLoc + uint64(read)

	offset := uint64(0)
	if cap(di.curChunkHeader) < int(numDocs) {
		di.curChunkHeader = make([]metaData, int(numDocs))
	} else {
		di.curChunkHeader = di.curChunkHeader[:int(numDocs)]
	}

	diffDocNum := uint64(0)
	diffDvOffset := uint64(0)
	for i := 0; i < int(numDocs); i++ {
		var docNumData []byte
		docNumData, err = s.data.Read(int(chunkMetaLoc+offset), int(chunkMetaLoc+offset+binary.MaxVarintLen64))
		if err != nil {
			return err
		}
		di.curChunkHeader[i].DocNum, read = binary.Uvarint(docNumData)
		di.curChunkHeader[i].DocNum += diffDocNum
		diffDocNum = di.curChunkHeader[i].DocNum
		offset += uint64(read)
		var docDvOffsetData []byte
		docDvOffsetData, err = s.data.Read(int(chunkMetaLoc+offset), int(chunkMetaLoc+offset+binary.MaxVarintLen64))
		if err != nil {
			return err
		}
		di.curChunkHeader[i].DocDvOffset, read = binary.Uvarint(docDvOffsetData)
		di.curChunkHeader[i].DocDvOffset += diffDvOffset
		diffDvOffset = di.curChunkHeader[i].DocDvOffset
		offset += uint64(read)
	}

	compressedDataLoc := chunkMetaLoc + offset
	dataLength := curChunkEnd - compressedDataLoc
	curChunkData, err := s.data.Read(int(compressedDataLoc), int(compressedDataLoc+dataLength))
	if err != nil {
		return err
	}
	di.curChunkData = curChunkData
	di.curChunkNum = chunkNumber
	di.uncompressed = di.uncompressed[:0]
	return nil
}

func (di *docValueReader) iterateAllDocValues(s *Segment, visitor docNumTermsVisitor) error {
	for i := 0; i < len(di.chunkOffsets); i++ {
		err := di.loadDvChunk(uint64(i), s)
		if err != nil {
			return err
		}
		if di.curChunkData == nil || len(di.curChunkHeader) == 0 {
			continue
		}

		// uncompress the already loaded data
		uncompressed, err := ZSTDDecompress(di.uncompressed[:cap(di.uncompressed)], di.curChunkData)
		if err != nil {
			return err
		}
		di.uncompressed = uncompressed

		start := uint64(0)
		for _, entry := range di.curChunkHeader {
			err = visitor(entry.DocNum, uncompressed[start:entry.DocDvOffset])
			if err != nil {
				return err
			}

			start = entry.DocDvOffset
		}
	}

	return nil
}

func (di *docValueReader) visitDocValues(docNum uint64,
	visitor segment.DocumentValueVisitor) error {
	// binary search the term locations for the docNum
	start, end := di.getDocValueLocs(docNum)
	if start == math.MaxUint64 || end == math.MaxUint64 || start == end {
		return nil
	}

	var uncompressed []byte
	var err error
	// use the uncompressed copy if available
	if len(di.uncompressed) > 0 {
		uncompressed = di.uncompressed
	} else {
		// uncompress the already loaded data
		uncompressed, err = ZSTDDecompress(di.uncompressed[:cap(di.uncompressed)], di.curChunkData)
		if err != nil {
			return err
		}
		di.uncompressed = uncompressed
	}

	// pick the terms for the given docNum
	uncompressed = uncompressed[start:end]
	for {
		i := bytes.Index(uncompressed, termSeparatorSplitSlice)
		if i < 0 {
			break
		}

		visitor(di.field, uncompressed[0:i])
		uncompressed = uncompressed[i+1:]
	}

	return nil
}

func (di *docValueReader) getDocValueLocs(docNum uint64) (start, end uint64) {
	i := sort.Search(len(di.curChunkHeader), func(i int) bool {
		return di.curChunkHeader[i].DocNum >= docNum
	})
	if i < len(di.curChunkHeader) && di.curChunkHeader[i].DocNum == docNum {
		return readDocValueBoundary(i, di.curChunkHeader)
	}
	return math.MaxUint64, math.MaxUint64
}

// VisitDocumentFieldTerms is an implementation of the
// DocumentFieldTermVisitable interface
func (s *Segment) visitDocumentFieldTerms(localDocNum uint64, fields []string,
	visitor segment.DocumentValueVisitor, dvs *docVisitState) (
	*docVisitState, error) {
	if dvs == nil {
		dvs = &docVisitState{}
	} else if dvs.segment != s {
		dvs.segment = s
		dvs.dvrs = nil
	}

	if dvs.dvrs == nil {
		var ok bool
		var fieldIDPlus1 uint16
		dvs.dvrs = make(map[uint16]*docValueReader, len(fields))
		for _, field := range fields {
			if fieldIDPlus1, ok = s.fieldsMap[field]; !ok {
				continue
			}
			fieldID := fieldIDPlus1 - 1
			if dvIter, exists := s.fieldDvReaders[fieldID]; exists &&
				dvIter != nil {
				dvs.dvrs[fieldID] = dvIter.cloneInto(dvs.dvrs[fieldID])
			}
		}
	}

	// find the chunkNumber where the docValues are stored
	// NOTE: doc values continue to use legacy chunk mode
	chunkFactor, err := getChunkSize(legacyChunkMode, 0, 0)
	if err != nil {
		return nil, err
	}
	docInChunk := localDocNum / chunkFactor
	var dvr *docValueReader
	for _, field := range fields {
		var ok bool
		var fieldIDPlus1 uint16
		if fieldIDPlus1, ok = s.fieldsMap[field]; !ok {
			continue
		}
		fieldID := fieldIDPlus1 - 1
		if dvr, ok = dvs.dvrs[fieldID]; ok && dvr != nil {
			// check if the chunk is already loaded
			if docInChunk != dvr.curChunkNumber() {
				err := dvr.loadDvChunk(docInChunk, s)
				if err != nil {
					return dvs, err
				}
			}

			_ = dvr.visitDocValues(localDocNum, visitor)
		}
	}
	return dvs, nil
}

type DocumentValueReader struct {
	fields  []string
	state   *docVisitState
	segment *Segment
}

func (d *DocumentValueReader) VisitDocumentValues(number uint64, visitor segment.DocumentValueVisitor) error {
	state, err := d.segment.visitDocumentFieldTerms(number, d.fields, visitor, d.state)
	if err != nil {
		return err
	}
	d.state = state
	return nil
}

func (s *Segment) DocumentValueReader(fields []string) (segment.DocumentValueReader, error) {
	return &DocumentValueReader{
		fields:  fields,
		segment: s,
	}, nil
}
